// Server-only helpers for profiles, friends and chat messages. Every query goes through the
// service role client, so each route must check who is asking before calling these.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  HANDLE_PATTERN,
  LINK_TITLE_MAX_LENGTH,
  MESSAGE_MAX_LENGTH,
  hostnameOf,
  normalizeShareUrl,
  type ChatMessage,
  type Reaction,
  type RoomSummary,
} from '@/lib/chat';

type DbError = { code?: string; message?: string } | null;

/** True when a migration in supabase/ has not been run yet. */
export function isMissingTable(error: DbError) {
  return Boolean(error && (error.code === '42P01' || error.code === 'PGRST205'));
}

export function setupRequired() {
  return NextResponse.json({ error: 'setup_required' }, { status: 503 });
}

export function fallbackHandle(userId: string | null) {
  return userId ? `user_${userId.slice(0, 6)}` : 'someone';
}

// ---------- Profiles ----------

/** Returns the person's @ID, creating one from their username the first time. */
export async function ensureHandle(userId: string): Promise<string> {
  const { data: existing, error } = await supabaseAdmin
    .from('user_profiles')
    .select('handle')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (existing?.handle) return existing.handle;

  const { data: user } = await supabaseAdmin.from('users').select('username').eq('id', userId).single();
  const base = (user?.username ?? '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 14) || 'user';

  for (let attempt = 0; attempt < 6; attempt++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const handle = `${base}_${suffix}`.slice(0, 20);
    const { error: insertError } = await supabaseAdmin.from('user_profiles').insert({ user_id: userId, handle });
    if (!insertError) return handle;
    if (insertError.code !== '23505') throw insertError; // anything but "already taken"
    // The person may have gotten a profile in the meantime.
    const { data: again } = await supabaseAdmin.from('user_profiles').select('handle').eq('user_id', userId).maybeSingle();
    if (again?.handle) return again.handle;
  }
  throw new Error('Could not create an ID');
}

export async function handlesFor(userIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const { data, error } = await supabaseAdmin.from('user_profiles').select('user_id, handle').in('user_id', ids);
  // Before the friends migration runs there are no profiles yet; show fallback IDs instead of failing.
  if (isMissingTable(error)) return map;
  if (error) throw error;
  for (const row of data ?? []) map.set(row.user_id, row.handle);
  return map;
}

export function isValidHandle(handle: string) {
  return HANDLE_PATTERN.test(handle);
}

// ---------- Friends ----------

export async function friendIdsOf(userId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
  if (error) throw error;
  return new Set((data ?? []).map((row) => (row.requester_id === userId ? row.addressee_id : row.requester_id)));
}

// ---------- Messages ----------

export interface MessageRow {
  id: string;
  user_id: string | null;
  kind?: 'user' | 'system';
  body: string;
  link_url: string | null;
  link_title: string | null;
  created_at: string;
}

export async function toChatMessages(rows: MessageRow[], reactions?: Map<string, Reaction[]>): Promise<ChatMessage[]> {
  const handles = await handlesFor(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    authorHandle: (row.user_id && handles.get(row.user_id)) || fallbackHandle(row.user_id),
    kind: row.kind ?? 'user',
    body: row.body,
    linkUrl: row.link_url,
    linkTitle: row.link_title,
    createdAt: row.created_at,
    reactions: reactions?.get(row.id) ?? [],
  }));
}

// ---------- Reactions ----------

export type ReactionTable = 'community_message_reactions' | 'chat_message_reactions';

// Message ids go in the request address; keep each request well under URL length limits.
const REACTION_ID_CHUNK = 100;

/** Reactions for the given messages, grouped per message. Empty before the reactions migration runs. */
export async function reactionsFor(table: ReactionTable, messageIds: string[], viewerId: string): Promise<Map<string, Reaction[]>> {
  const result = new Map<string, Reaction[]>();
  const rows: { message_id: string; user_id: string; emoji: string }[] = [];
  for (let i = 0; i < messageIds.length; i += REACTION_ID_CHUNK) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('message_id, user_id, emoji, created_at')
      .in('message_id', messageIds.slice(i, i + REACTION_ID_CHUNK))
      .order('created_at', { ascending: true });
    if (isMissingTable(error)) return result;
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  const handles = await handlesFor(rows.map((row) => row.user_id));
  for (const row of rows) {
    const list = result.get(row.message_id) ?? [];
    let reaction = list.find((r) => r.emoji === row.emoji);
    if (!reaction) {
      reaction = { emoji: row.emoji, count: 0, mine: false, handles: [] };
      list.push(reaction);
    }
    reaction.count++;
    if (row.user_id === viewerId) reaction.mine = true;
    reaction.handles.push(handles.get(row.user_id) || fallbackHandle(row.user_id));
    result.set(row.message_id, list);
  }
  return result;
}

/** Messages ready for the browser, with the viewer's view of their reactions. */
export async function toChatMessagesWithReactions(table: ReactionTable, rows: MessageRow[], viewerId: string) {
  const reactable = rows.filter((row) => (row.kind ?? 'user') === 'user').map((row) => row.id);
  return toChatMessages(rows, await reactionsFor(table, reactable, viewerId));
}

/**
 * Adds (POST) or removes (DELETE) the viewer's reaction, then returns the message's reactions.
 * The route must already have checked that the viewer may see the message.
 */
export async function changeReaction(
  table: ReactionTable,
  messageId: string,
  viewerId: string,
  emoji: string,
  add: boolean
): Promise<Reaction[]> {
  if (add) {
    const { error } = await supabaseAdmin
      .from(table)
      .upsert({ message_id: messageId, user_id: viewerId, emoji }, { onConflict: 'message_id,user_id,emoji', ignoreDuplicates: true });
    if (error) throw error;
  } else {
    const { error } = await supabaseAdmin.from(table).delete().eq('message_id', messageId).eq('user_id', viewerId).eq('emoji', emoji);
    if (error) throw error;
  }
  return (await reactionsFor(table, [messageId], viewerId)).get(messageId) ?? [];
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "?ids=a,b,c" -> up to 200 valid message ids. */
export function parseMessageIds(value: string | null) {
  return [...new Set((value ?? '').split(',').filter((id) => UUID_PATTERN.test(id)))].slice(0, 200);
}

/** Validates a message sent from the composer. */
export function parseMessageInput(payload: {
  body?: unknown;
  linkUrl?: unknown;
  linkTitle?: unknown;
}): { body: string; linkUrl: string | null; linkTitle: string | null } | { error: string } {
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  const hasLink = payload.linkUrl !== undefined && payload.linkUrl !== null && payload.linkUrl !== '';
  const linkUrl = hasLink ? normalizeShareUrl(payload.linkUrl) : null;

  if (hasLink && !linkUrl) return { error: 'Only http and https addresses can be shared' };
  if (!body && !linkUrl) return { error: 'Write a message or attach a site' };
  if (body.length > MESSAGE_MAX_LENGTH) return { error: `Messages can be up to ${MESSAGE_MAX_LENGTH} characters` };

  const rawTitle = typeof payload.linkTitle === 'string' ? payload.linkTitle.trim() : '';
  const linkTitle = linkUrl ? (rawTitle || hostnameOf(linkUrl)).slice(0, LINK_TITLE_MAX_LENGTH) : null;
  return { body, linkUrl, linkTitle };
}

const MIN_GAP_MS = 1500;
const MAX_PER_MINUTE = 20;

/** Simple flood protection per person and table: a short gap between messages and a per-minute cap. */
export async function isSendingTooFast(table: 'community_messages' | 'chat_messages', userId: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('created_at')
    .eq('user_id', userId)
    .gt('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_PER_MINUTE);
  if (error) throw error;
  const latest = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
  return Date.now() - latest < MIN_GAP_MS || (data?.length ?? 0) >= MAX_PER_MINUTE;
}

export const tooFastResponse = () =>
  NextResponse.json({ error: 'You are sending messages too fast. Wait a moment.' }, { status: 429 });

// ---------- Rooms ----------

export async function membershipOf(roomId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('role, last_read_at')
    .eq('room_id', roomId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as { role: 'owner' | 'member'; last_read_at: string } | null;
}

export const notAMember = () => NextResponse.json({ error: 'You are not in this room' }, { status: 403 });

/**
 * A gray one-line note in the room, like "@minji added @junho". The person who caused it has
 * already seen it, so it does not count as unread for them.
 */
export async function postSystemMessage(roomId: string, body: string, actorId?: string) {
  const { error } = await supabaseAdmin.from('chat_messages').insert({ room_id: roomId, user_id: null, kind: 'system', body });
  if (error) throw error;
  const now = new Date().toISOString();
  await supabaseAdmin.from('chat_rooms').update({ last_message_at: now }).eq('id', roomId);
  if (actorId) {
    await supabaseAdmin.from('chat_room_members').update({ last_read_at: now }).eq('room_id', roomId).eq('user_id', actorId);
  }
}

export async function listRoomsFor(userId: string): Promise<RoomSummary[]> {
  const { data: memberships, error } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id, last_read_at')
    .eq('user_id', userId);
  if (error) throw error;
  if (!memberships?.length) return [];

  const roomIds = memberships.map((m) => m.room_id);
  const [{ data: rooms, error: roomsError }, { data: members, error: membersError }] = await Promise.all([
    supabaseAdmin.from('chat_rooms').select('id, name, is_direct, last_message_at').in('id', roomIds),
    supabaseAdmin.from('chat_room_members').select('room_id, user_id').in('room_id', roomIds),
  ]);
  if (roomsError) throw roomsError;
  if (membersError) throw membersError;

  const handles = await handlesFor((members ?? []).map((m) => m.user_id));
  const lastReadByRoom = new Map(memberships.map((m) => [m.room_id, m.last_read_at as string]));

  const summaries = await Promise.all(
    (rooms ?? []).map(async (room) => {
      const roomMembers = (members ?? []).filter((m) => m.room_id === room.id);
      const other = roomMembers.find((m) => m.user_id !== userId);
      const title = room.is_direct
        ? (other && (handles.get(other.user_id) || fallbackHandle(other.user_id))) || 'Just you'
        : room.name;

      const [{ data: last }, { count }] = await Promise.all([
        supabaseAdmin
          .from('chat_messages')
          .select('user_id, kind, body, link_url')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .eq('room_id', room.id)
          .gt('created_at', lastReadByRoom.get(room.id) ?? new Date(0).toISOString())
          .or(`user_id.is.null,user_id.neq.${userId}`),
      ]);

      return {
        id: room.id,
        title,
        isDirect: room.is_direct,
        memberCount: roomMembers.length,
        lastMessage: last
          ? {
              authorHandle: (last.user_id && handles.get(last.user_id)) || fallbackHandle(last.user_id),
              body: last.body,
              hasLink: Boolean(last.link_url),
              kind: last.kind,
            }
          : null,
        lastMessageAt: room.last_message_at,
        unread: count ?? 0,
      } satisfies RoomSummary;
    })
  );

  return summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

// Server-only helpers for profiles, friends and chat messages. Every query goes through the
// service role client, so each route must check who is asking before calling these.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  COLLECTION_NAME_MAX_LENGTH,
  HANDLE_PATTERN,
  LINK_MEMO_MAX_LENGTH,
  LINK_TITLE_MAX_LENGTH,
  MAX_LINKS_PER_MESSAGE,
  MESSAGE_MAX_LENGTH,
  findMentions,
  hostnameOf,
  normalizeShareUrl,
  type ChatMessage,
  type LinkHistoryItem,
  type Person,
  type PublicProfile,
  type Reaction,
  type ReplyPreview,
  type RoomSummary,
  type SharedLink,
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

const PROFILE_COLUMNS = 'user_id, handle, display_name, status_text, avatar_emoji, avatar_color';

/** Public profiles (@ID, display name, status, emoji avatar) for these people. */
export async function profilesFor(userIds: (string | null)[]): Promise<Map<string, PublicProfile>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, PublicProfile>();
  if (ids.length === 0) return map;
  const run = (columns: string) => supabaseAdmin.from('user_profiles').select(columns).in('user_id', ids);
  let { data, error } = await run(PROFILE_COLUMNS);
  // Before the profiles migration only the @ID exists.
  if (error?.code === '42703') ({ data, error } = await run('user_id, handle'));
  // Before the friends migration runs there are no profiles yet; show fallback IDs instead of failing.
  if (isMissingTable(error)) return map;
  if (error) throw error;
  for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
    map.set(row.user_id as string, {
      handle: row.handle as string,
      name: row.display_name ?? null,
      status: row.status_text ?? null,
      emoji: row.avatar_emoji ?? null,
      color: row.avatar_color ?? null,
    });
  }
  return map;
}

export async function handlesFor(userIds: (string | null)[]): Promise<Map<string, string>> {
  const profiles = await profilesFor(userIds);
  return new Map([...profiles].map(([id, profile]) => [id, profile.handle]));
}

/** A person as shown in lists: @ID, display name, avatar and status. */
export function personFrom(id: string, profiles: Map<string, PublicProfile>): Person {
  const profile = profiles.get(id);
  return {
    id,
    handle: profile?.handle || fallbackHandle(id),
    name: profile?.name ?? null,
    emoji: profile?.emoji ?? null,
    color: profile?.color ?? null,
    status: profile?.status ?? null,
  };
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
  collection_name?: string | null;
  reply_to_id?: string | null;
  created_at: string;
}

/** The community room, or a chat room. They keep messages, links and reactions in separate tables. */
export type MessageSource = 'community' | 'room';

const LINK_MESSAGE_COLUMN = { community: 'community_message_id', room: 'chat_message_id' } as const;
const MESSAGE_TABLE = { community: 'community_messages', room: 'chat_messages' } as const;
const REPLY_SNIPPET_LENGTH = 100;

/** The messages being replied to, with enough to show a one-line quote. */
async function replyTargetsFor(source: MessageSource, rows: MessageRow[]) {
  const ids = [...new Set(rows.map((row) => row.reply_to_id).filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return [];
  const { data, error } = await supabaseAdmin.from(MESSAGE_TABLE[source]).select('id, user_id, body, link_url').in('id', ids);
  if (error) throw error;
  return (data ?? []) as { id: string; user_id: string | null; body: string; link_url: string | null }[];
}
const REACTION_TABLE = { community: 'community_message_reactions', room: 'chat_message_reactions' } as const;
// Message ids go in the request address; keep each request well under URL length limits.
const ID_CHUNK = 100;

/** Sites shared with each message, in order. Null before the shared links migration runs. */
async function sharedLinksFor(source: MessageSource, messageIds: string[]): Promise<Map<string, SharedLink[]> | null> {
  const column = LINK_MESSAGE_COLUMN[source];
  const result = new Map<string, SharedLink[]>();
  for (let i = 0; i < messageIds.length; i += ID_CHUNK) {
    const { data, error } = await supabaseAdmin
      .from('shared_links')
      .select(`${column}, url, title, memo, position`)
      .in(column, messageIds.slice(i, i + ID_CHUNK))
      .order('position', { ascending: true });
    if (isMissingTable(error)) return null;
    if (error) throw error;
    for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
      const messageId = row[column] as string;
      const list = result.get(messageId) ?? [];
      list.push({ url: row.url as string, title: row.title as string, memo: row.memo });
      result.set(messageId, list);
    }
  }
  return result;
}

/** Messages ready for the browser: authors' @IDs, shared sites and the viewer's view of reactions. */
export async function buildMessages(source: MessageSource, rows: MessageRow[], viewerId: string): Promise<ChatMessage[]> {
  const userRows = rows.filter((row) => (row.kind ?? 'user') === 'user').map((row) => row.id);
  const replyTargets = await replyTargetsFor(source, rows);
  const [profiles, links, reactions] = await Promise.all([
    profilesFor([...rows.map((row) => row.user_id), ...replyTargets.map((target) => target.user_id), viewerId]),
    sharedLinksFor(source, userRows),
    reactionsFor(REACTION_TABLE[source], userRows, viewerId),
  ]);
  const viewerHandle = profiles.get(viewerId)?.handle;
  const replies = new Map<string, ReplyPreview>(
    replyTargets.map((target) => [
      target.id,
      {
        id: target.id,
        authorHandle: (target.user_id && profiles.get(target.user_id)?.handle) || fallbackHandle(target.user_id),
        authorName: (target.user_id && profiles.get(target.user_id)?.name) || null,
        snippet: target.body.trim().slice(0, REPLY_SNIPPET_LENGTH) || (target.link_url ? 'Shared a site' : 'Message'),
      },
    ])
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    authorHandle: (row.user_id && profiles.get(row.user_id)?.handle) || fallbackHandle(row.user_id),
    authorName: (row.user_id && profiles.get(row.user_id)?.name) || null,
    authorEmoji: (row.user_id && profiles.get(row.user_id)?.emoji) || null,
    authorColor: (row.user_id && profiles.get(row.user_id)?.color) || null,
    replyTo: (row.reply_to_id && replies.get(row.reply_to_id)) || null,
    mentionsMe: Boolean(viewerHandle && row.user_id !== viewerId && findMentions(row.body).includes(viewerHandle)),
    kind: row.kind ?? 'user',
    body: row.body,
    // Messages from before the shared links table only have the one site stored on the message itself.
    links:
      links?.get(row.id) ??
      (row.link_url ? [{ url: row.link_url, title: row.link_title || hostnameOf(row.link_url), memo: null }] : []),
    collectionName: row.collection_name ?? null,
    createdAt: row.created_at,
    reactions: reactions.get(row.id) ?? [],
  }));
}

export interface MessageInput {
  body: string;
  links: SharedLink[];
  collectionName: string | null;
  replyToId: string | null;
}

/**
 * Validates a message sent from the composer: text, and any number of shared sites (up to a limit),
 * each with an optional note. Older pages send a single linkUrl/linkTitle, which still works.
 */
export function parseMessageInput(payload: {
  body?: unknown;
  links?: unknown;
  linkUrl?: unknown;
  linkTitle?: unknown;
  collectionName?: unknown;
  replyToId?: unknown;
}): MessageInput | { error: string } {
  const body = typeof payload.body === 'string' ? payload.body.trim() : '';
  if (body.length > MESSAGE_MAX_LENGTH) return { error: `Messages can be up to ${MESSAGE_MAX_LENGTH} characters` };

  const hasLegacyLink = payload.linkUrl !== undefined && payload.linkUrl !== null && payload.linkUrl !== '';
  const rawLinks: unknown[] = Array.isArray(payload.links)
    ? payload.links
    : hasLegacyLink
      ? [{ url: payload.linkUrl, title: payload.linkTitle }]
      : [];
  if (rawLinks.length > MAX_LINKS_PER_MESSAGE) return { error: `You can share up to ${MAX_LINKS_PER_MESSAGE} sites at once` };

  const links: SharedLink[] = [];
  for (const raw of rawLinks) {
    const item = (raw ?? {}) as { url?: unknown; title?: unknown; memo?: unknown };
    const url = normalizeShareUrl(item.url);
    if (!url) return { error: 'Only http and https addresses can be shared' };
    if (links.some((link) => link.url === url)) continue;
    const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
    const memo = typeof item.memo === 'string' ? item.memo.trim() : '';
    if (memo.length > LINK_MEMO_MAX_LENGTH) return { error: `Notes can be up to ${LINK_MEMO_MAX_LENGTH} characters` };
    links.push({ url, title: (rawTitle || hostnameOf(url)).slice(0, LINK_TITLE_MAX_LENGTH), memo: memo || null });
  }

  if (!body && links.length === 0) return { error: 'Write a message or attach a site' };
  const rawCollection = typeof payload.collectionName === 'string' ? payload.collectionName.trim() : '';
  const collectionName = links.length > 0 && rawCollection ? rawCollection.slice(0, COLLECTION_NAME_MAX_LENGTH) : null;
  const replyToId = typeof payload.replyToId === 'string' && UUID_PATTERN.test(payload.replyToId) ? payload.replyToId : null;
  return { body, links, collectionName, replyToId };
}

/** The columns to insert for a new message; the first site also stays on the message for older pages. */
export function messageColumns(input: MessageInput) {
  return {
    body: input.body,
    link_url: input.links[0]?.url ?? null,
    link_title: input.links[0]?.title ?? null,
    ...(input.collectionName ? { collection_name: input.collectionName } : {}),
    ...(input.replyToId ? { reply_to_id: input.replyToId } : {}),
  };
}

/** A reply must answer a message in the same place (the community room, or the same chat room). */
export async function isValidReplyTarget(source: MessageSource, replyToId: string, roomId: string | null) {
  let query = supabaseAdmin.from(MESSAGE_TABLE[source]).select('id').eq('id', replyToId);
  if (source === 'room') query = query.eq('room_id', roomId as string);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

// ---------- Mentions ----------

const MAX_MENTIONS_PER_MESSAGE = 20;

/**
 * Records who a new message calls with @ID, so they get a badge. In a chat room only its members
 * can be mentioned. Skipped quietly before the mentions migration runs.
 */
export async function saveMentions(source: MessageSource, messageId: string, roomId: string | null, authorId: string, body: string) {
  const handles = findMentions(body).slice(0, MAX_MENTIONS_PER_MESSAGE);
  if (handles.length === 0) return;
  const { data: people, error } = await supabaseAdmin.from('user_profiles').select('user_id').in('handle', handles);
  if (error) throw error;
  let ids = (people ?? []).map((p) => p.user_id as string).filter((id) => id !== authorId);
  if (source === 'room' && ids.length) {
    const { data: members, error: membersError } = await supabaseAdmin
      .from('chat_room_members')
      .select('user_id')
      .eq('room_id', roomId as string)
      .in('user_id', ids);
    if (membersError) throw membersError;
    ids = (members ?? []).map((m) => m.user_id as string);
  }
  if (ids.length === 0) return;
  const { error: insertError } = await supabaseAdmin.from('mentions').insert(
    ids.map((userId) => ({
      user_id: userId,
      author_id: authorId,
      [LINK_MESSAGE_COLUMN[source]]: messageId,
      room_id: source === 'room' ? roomId : null,
    }))
  );
  if (isMissingTable(insertError)) return;
  if (insertError) throw insertError;
}

/** How many mentions the person has not seen yet, in the community room and in chat rooms. */
export async function unseenMentions(userId: string) {
  const count = async (inCommunity: boolean) => {
    let query = supabaseAdmin.from('mentions').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('seen_at', null);
    query = inCommunity ? query.not('community_message_id', 'is', null) : query.not('room_id', 'is', null);
    const { count: n, error } = await query;
    if (isMissingTable(error)) return 0;
    if (error) throw error;
    return n ?? 0;
  };
  const [community, rooms] = await Promise.all([count(true), count(false)]);
  return { community, rooms };
}

/** Marks mentions as seen once the person has the chat open: "community" or a room id. */
export async function markMentionsSeen(userId: string, place: string) {
  let query = supabaseAdmin.from('mentions').update({ seen_at: new Date().toISOString() }).eq('user_id', userId).is('seen_at', null);
  query = place === 'community' ? query.not('community_message_id', 'is', null) : query.eq('room_id', place);
  const { error } = await query;
  if (isMissingTable(error)) return;
  if (error) throw error;
}

/**
 * Whether a message can be stored. Before the shared links migration runs, only a single site
 * without a note (the old kind of message) fits.
 */
export async function canStoreLinks(input: MessageInput) {
  const needsTable = input.links.length > 1 || input.links.some((link) => link.memo) || Boolean(input.collectionName);
  if (!needsTable) return true;
  const { error } = await supabaseAdmin.from('shared_links').select('id', { head: true }).limit(1);
  if (isMissingTable(error)) return false;
  if (error) throw error;
  return true;
}

/** Records the sites shared with a new message, for the message itself and the Link history. */
export async function saveSharedLinks(
  source: MessageSource,
  messageId: string,
  roomId: string | null,
  userId: string,
  links: SharedLink[]
) {
  if (links.length === 0) return;
  const { error } = await supabaseAdmin.from('shared_links').insert(
    links.map((link, position) => ({
      [LINK_MESSAGE_COLUMN[source]]: messageId,
      room_id: source === 'room' ? roomId : null,
      user_id: userId,
      url: link.url,
      title: link.title,
      memo: link.memo,
      position,
    }))
  );
  // Before the migration a single site still lives on the message itself.
  if (isMissingTable(error)) return;
  if (error) throw error;
}

// ---------- Link history ----------

const HISTORY_PAGE = 40;

/** Titles for the viewer's rooms: the group name, or the other person's @ID for a direct chat. */
export async function roomTitlesFor(viewerId: string, roomIds: string[]): Promise<Map<string, string>> {
  const titles = new Map<string, string>();
  if (roomIds.length === 0) return titles;
  const { data: rooms, error } = await supabaseAdmin.from('chat_rooms').select('id, name, is_direct').in('id', roomIds);
  if (error) throw error;
  const directIds = (rooms ?? []).filter((room) => room.is_direct).map((room) => room.id);
  const others = new Map<string, string>();
  if (directIds.length) {
    const { data: members, error: membersError } = await supabaseAdmin
      .from('chat_room_members')
      .select('room_id, user_id')
      .in('room_id', directIds)
      .neq('user_id', viewerId);
    if (membersError) throw membersError;
    for (const member of members ?? []) others.set(member.room_id, member.user_id);
  }
  const handles = await handlesFor([...others.values()]);
  for (const room of rooms ?? []) {
    const other = others.get(room.id);
    titles.set(room.id, room.is_direct ? (other ? `@${handles.get(other) || fallbackHandle(other)}` : 'Just you') : room.name);
  }
  return titles;
}

/**
 * Sites shared where the viewer can read them: the community room and the chat rooms they are in now.
 * `place` is "all", "community" or a room id. Newest first, paged with `before`.
 */
export async function listLinkHistory(
  viewerId: string,
  options: { place: string; before: string | null; query: string }
): Promise<{ items: LinkHistoryItem[]; hasMore: boolean; rooms: { id: string; title: string }[] }> {
  const { data: memberships, error: membershipError } = await supabaseAdmin
    .from('chat_room_members')
    .select('room_id')
    .eq('user_id', viewerId);
  if (membershipError) throw membershipError;
  const roomIds = (memberships ?? []).map((m) => m.room_id as string);
  const titles = await roomTitlesFor(viewerId, roomIds);
  const rooms = roomIds.map((id) => ({ id, title: titles.get(id) ?? 'Room' })).sort((a, b) => a.title.localeCompare(b.title));

  if (options.place !== 'all' && options.place !== 'community' && !roomIds.includes(options.place)) {
    return { items: [], hasMore: false, rooms };
  }

  let query = supabaseAdmin
    .from('shared_links')
    .select('id, url, title, memo, user_id, created_at, community_message_id, chat_message_id, room_id')
    .order('created_at', { ascending: false })
    .order('position', { ascending: true })
    // A little extra so the sites of one message are never split across pages (see below).
    .limit(HISTORY_PAGE + MAX_LINKS_PER_MESSAGE);
  if (options.place === 'community') query = query.not('community_message_id', 'is', null);
  else if (options.place !== 'all') query = query.eq('room_id', options.place);
  else if (roomIds.length) query = query.or(`community_message_id.not.is.null,room_id.in.(${roomIds.join(',')})`);
  else query = query.not('community_message_id', 'is', null);
  if (options.before) query = query.lt('created_at', options.before);
  // Characters with a meaning in the filter syntax are dropped from the search words.
  const words = options.query.replace(/[%,()*\\"]/g, ' ').trim().slice(0, 100);
  if (words) query = query.or(`title.ilike.%${words}%,url.ilike.%${words}%,memo.ilike.%${words}%`);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  // Keep whole messages together: the page ends after the last site of the message it stops in.
  let count = Math.min(rows.length, HISTORY_PAGE);
  while (count < rows.length && rows[count].created_at === rows[count - 1]?.created_at) count++;
  const page = rows.slice(0, count);

  const communityIds = [...new Set(page.map((row) => row.community_message_id).filter(Boolean))] as string[];
  const chatIds = [...new Set(page.map((row) => row.chat_message_id).filter(Boolean))] as string[];
  const [handles, communityMessages, chatMessages] = await Promise.all([
    handlesFor(page.map((row) => row.user_id)),
    communityIds.length
      ? supabaseAdmin.from('community_messages').select('id, collection_name').in('id', communityIds)
      : Promise.resolve({ data: [], error: null }),
    chatIds.length
      ? supabaseAdmin.from('chat_messages').select('id, collection_name').in('id', chatIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (communityMessages.error) throw communityMessages.error;
  if (chatMessages.error) throw chatMessages.error;
  const collections = new Map<string, string | null>(
    [...(communityMessages.data ?? []), ...(chatMessages.data ?? [])].map((m) => [m.id as string, m.collection_name as string | null])
  );

  const items: LinkHistoryItem[] = page.map((row) => {
    const messageId = (row.community_message_id ?? row.chat_message_id) as string;
    return {
      id: row.id,
      url: row.url,
      title: row.title,
      memo: row.memo,
      sharedBy: (row.user_id && handles.get(row.user_id)) || fallbackHandle(row.user_id),
      sharedAt: row.created_at,
      messageId,
      place: row.room_id
        ? { kind: 'room', roomId: row.room_id, title: titles.get(row.room_id) ?? 'Room' }
        : { kind: 'community' },
      collectionName: collections.get(messageId) ?? null,
    };
  });
  return { items, hasMore: rows.length > count, rooms };
}

// ---------- Reactions ----------

export type ReactionTable = 'community_message_reactions' | 'chat_message_reactions';

/** Reactions for the given messages, grouped per message. Empty before the reactions migration runs. */
export async function reactionsFor(table: ReactionTable, messageIds: string[], viewerId: string): Promise<Map<string, Reaction[]>> {
  const result = new Map<string, Reaction[]>();
  const rows: { message_id: string; user_id: string; emoji: string }[] = [];
  for (let i = 0; i < messageIds.length; i += ID_CHUNK) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('message_id, user_id, emoji, created_at')
      .in('message_id', messageIds.slice(i, i + ID_CHUNK))
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

  const profiles = await profilesFor((members ?? []).map((m) => m.user_id));
  const handles = new Map([...profiles].map(([id, profile]) => [id, profile.handle]));
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
        person: room.is_direct && other ? personFrom(other.user_id, profiles) : null,
      } satisfies RoomSummary;
    })
  );

  return summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
}

// ---------- Notifications ----------

export interface MentionNotice {
  messageId: string;
  authorHandle: string;
  authorName: string | null;
  authorEmoji: string | null;
  snippet: string;
  createdAt: string;
}

/**
 * What a notification needs about unseen mentions: the newest one in the community room
 * (its text and author), and which chat rooms have any.
 */
export async function mentionDetails(userId: string): Promise<{ community: MentionNotice | null; roomIds: string[] }> {
  const empty = { community: null, roomIds: [] as string[] };
  const { data, error } = await supabaseAdmin
    .from('mentions')
    .select('community_message_id, room_id, created_at')
    .eq('user_id', userId)
    .is('seen_at', null)
    .order('created_at', { ascending: false })
    .limit(50);
  if (isMissingTable(error)) return empty;
  if (error) throw error;
  const rows = data ?? [];
  const roomIds = [...new Set(rows.map((row) => row.room_id).filter(Boolean))] as string[];
  const newest = rows.find((row) => row.community_message_id);
  if (!newest) return { community: null, roomIds };

  const { data: message, error: messageError } = await supabaseAdmin
    .from('community_messages')
    .select('id, user_id, body, created_at')
    .eq('id', newest.community_message_id as string)
    .maybeSingle();
  if (messageError) throw messageError;
  if (!message) return { community: null, roomIds };
  const author = (await profilesFor([message.user_id])).get(message.user_id);
  return {
    community: {
      messageId: message.id,
      authorHandle: author?.handle || fallbackHandle(message.user_id),
      authorName: author?.name ?? null,
      authorEmoji: author?.emoji ?? null,
      snippet: message.body.trim().slice(0, 140),
      createdAt: message.created_at,
    },
    roomIds,
  };
}

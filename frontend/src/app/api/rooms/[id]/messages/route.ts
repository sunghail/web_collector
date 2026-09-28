import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  UUID_PATTERN,
  buildMessages,
  canStoreLinks,
  isMissingTable,
  isSendingTooFast,
  isValidReplyTarget,
  membershipOf,
  messageColumns,
  notAMember,
  parseMessageInput,
  saveMentions,
  saveSharedLinks,
  setupRequired,
  tooFastResponse,
  type MessageRow,
} from '@/lib/chat-server';
import { withPageTitles } from '@/lib/siteInfo';

const PAGE_SIZE = 50;
const SELECT = 'id, user_id, kind, body, link_url, link_title, created_at';
// Newer columns arrive with later migrations (shared links, then replies); older databases skip them.
const COLUMN_SETS = [`${SELECT}, collection_name, reply_to_id`, `${SELECT}, collection_name`, SELECT];

/** Runs a message query with the newest columns the database has. */
async function selectMessages<T>(run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>) {
  let result = await run(COLUMN_SETS[0]);
  for (let i = 1; i < COLUMN_SETS.length && result.error?.code === '42703'; i++) result = await run(COLUMN_SETS[i]);
  return result;
}

// GET /api/rooms/:id/messages (?after=ISO | ?before=ISO) -> members only
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notAMember();

  const after = request.nextUrl.searchParams.get('after');
  const before = request.nextUrl.searchParams.get('before');

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();

    if (after) {
      const { data, error } = await selectMessages((columns) =>
        supabaseAdmin
          .from('chat_messages')
          .select(columns)
          .eq('room_id', id)
          .gt('created_at', after)
          .order('created_at', { ascending: true })
          .limit(200)
      );
      if (error) throw error;
      const messages = await buildMessages('room', data as unknown as MessageRow[], authUser.userId);
      return NextResponse.json({ messages, hasMore: false });
    }

    const { data, error } = await selectMessages((columns) => {
      let query = supabaseAdmin
        .from('chat_messages')
        .select(columns)
        .eq('room_id', id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (before) query = query.lt('created_at', before);
      return query;
    });
    if (error) throw error;

    const rows = data as unknown as MessageRow[];
    return NextResponse.json({
      messages: await buildMessages('room', rows.slice(0, PAGE_SIZE).reverse(), authUser.userId),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room messages GET error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

// POST /api/rooms/:id/messages { body, links?: [{ url, title, memo }], collectionName?, replyToId? } -> members only
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notAMember();

  let payload: Parameters<typeof parseMessageInput>[0];
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const input = parseMessageInput(payload);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();
    if (!(await canStoreLinks(input))) return setupRequired();
    if (await isSendingTooFast('chat_messages', authUser.userId)) return tooFastResponse();
    // Sites attached by their bare address get their page title (a moment at most).
    input.links = await withPageTitles(input.links);
    if (input.replyToId && !(await isValidReplyTarget('room', input.replyToId, id))) {
      return NextResponse.json({ error: 'The message you replied to is gone' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({ room_id: id, user_id: authUser.userId, ...messageColumns(input) })
      .select(SELECT)
      .single();
    if (error) throw error;

    const row = { ...(data as MessageRow), collection_name: input.collectionName, reply_to_id: input.replyToId };
    await saveSharedLinks('room', row.id, id, authUser.userId, input.links);
    // A missed mention badge must not fail the message itself.
    await saveMentions('room', row.id, id, authUser.userId, input.body).catch((error) => console.error('Mentions error:', error));

    const now = new Date().toISOString();
    await Promise.all([
      supabaseAdmin.from('chat_rooms').update({ last_message_at: now }).eq('id', id),
      supabaseAdmin.from('chat_room_members').update({ last_read_at: now }).eq('room_id', id).eq('user_id', authUser.userId),
    ]);

    const [message] = await buildMessages('room', [row], authUser.userId);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room messages POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

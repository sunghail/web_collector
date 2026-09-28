import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  buildMessages,
  canStoreLinks,
  isMissingTable,
  isSendingTooFast,
  messageColumns,
  parseMessageInput,
  saveSharedLinks,
  setupRequired,
  tooFastResponse,
  type MessageRow,
} from '@/lib/chat-server';

const PAGE_SIZE = 50;
const SELECT = 'id, user_id, body, link_url, link_title, created_at';
// collection_name arrives with the shared links migration; asked for only once it exists.
const SELECT_WITH_COLLECTION = `${SELECT}, collection_name`;

/** Runs a message query, falling back to the older columns before the shared links migration. */
async function selectMessages<T>(run: (columns: string) => PromiseLike<{ data: T | null; error: { code?: string } | null }>) {
  const first = await run(SELECT_WITH_COLLECTION);
  if (first.error?.code === '42703') return run(SELECT); // column does not exist yet
  return first;
}

// GET /api/community/messages            -> the latest page
// GET /api/community/messages?after=ISO  -> anything newer (polling)
// GET /api/community/messages?before=ISO -> the page before (scrolling up)
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const after = request.nextUrl.searchParams.get('after');
  const before = request.nextUrl.searchParams.get('before');

  try {
    if (after) {
      const { data, error } = await selectMessages((columns) =>
        supabaseAdmin
          .from('community_messages')
          .select(columns)
          .gt('created_at', after)
          .order('created_at', { ascending: true })
          .limit(200)
      );
      if (isMissingTable(error)) return setupRequired();
      if (error) throw error;
      const messages = await buildMessages('community', data as unknown as MessageRow[], authUser.userId);
      return NextResponse.json({ messages, hasMore: false });
    }

    const { data, error } = await selectMessages((columns) => {
      let query = supabaseAdmin
        .from('community_messages')
        .select(columns)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE + 1);
      if (before) query = query.lt('created_at', before);
      return query;
    });
    if (isMissingTable(error)) return setupRequired();
    if (error) throw error;

    const rows = data as unknown as MessageRow[];
    return NextResponse.json({
      messages: await buildMessages('community', rows.slice(0, PAGE_SIZE).reverse(), authUser.userId),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch (error) {
    console.error('Community GET error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

// POST /api/community/messages { body, links?: [{ url, title, memo }], collectionName? }
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: Parameters<typeof parseMessageInput>[0];
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const input = parseMessageInput(payload);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    if (!(await canStoreLinks(input))) return setupRequired();
    if (await isSendingTooFast('community_messages', authUser.userId)) return tooFastResponse();

    const { data, error } = await supabaseAdmin
      .from('community_messages')
      .insert({ user_id: authUser.userId, ...messageColumns(input) })
      .select(SELECT)
      .single();
    if (isMissingTable(error)) return setupRequired();
    if (error) throw error;

    const row = { ...(data as MessageRow), collection_name: input.collectionName };
    await saveSharedLinks('community', row.id, null, authUser.userId, input.links);
    const [message] = await buildMessages('community', [row], authUser.userId);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Community POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

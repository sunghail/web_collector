import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  isMissingTable,
  isSendingTooFast,
  parseMessageInput,
  setupRequired,
  toChatMessages,
  toChatMessagesWithReactions,
  tooFastResponse,
  type MessageRow,
} from '@/lib/chat-server';

const PAGE_SIZE = 50;
const SELECT = 'id, user_id, body, link_url, link_title, created_at';

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
      const { data, error } = await supabaseAdmin
        .from('community_messages')
        .select(SELECT)
        .gt('created_at', after)
        .order('created_at', { ascending: true })
        .limit(200);
      if (isMissingTable(error)) return setupRequired();
      if (error) throw error;
      return NextResponse.json({ messages: await toChatMessagesWithReactions('community_message_reactions', data as MessageRow[], authUser.userId), hasMore: false });
    }

    let query = supabaseAdmin
      .from('community_messages')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (before) query = query.lt('created_at', before);

    const { data, error } = await query;
    if (isMissingTable(error)) return setupRequired();
    if (error) throw error;

    const rows = data as MessageRow[];
    return NextResponse.json({
      messages: await toChatMessagesWithReactions('community_message_reactions', rows.slice(0, PAGE_SIZE).reverse(), authUser.userId),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch (error) {
    console.error('Community GET error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: { body?: unknown; linkUrl?: unknown; linkTitle?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const input = parseMessageInput(payload);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    if (await isSendingTooFast('community_messages', authUser.userId)) return tooFastResponse();

    const { data, error } = await supabaseAdmin
      .from('community_messages')
      .insert({ user_id: authUser.userId, body: input.body, link_url: input.linkUrl, link_title: input.linkTitle })
      .select(SELECT)
      .single();
    if (isMissingTable(error)) return setupRequired();
    if (error) throw error;

    const [message] = await toChatMessages([data as MessageRow]);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Community POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

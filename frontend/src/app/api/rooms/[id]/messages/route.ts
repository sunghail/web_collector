import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  isMissingTable,
  isSendingTooFast,
  membershipOf,
  notAMember,
  parseMessageInput,
  setupRequired,
  toChatMessages,
  toChatMessagesWithReactions,
  tooFastResponse,
  type MessageRow,
} from '@/lib/chat-server';

const PAGE_SIZE = 50;
const SELECT = 'id, user_id, kind, body, link_url, link_title, created_at';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/rooms/:id/messages (?after=ISO | ?before=ISO) -> members only
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return notAMember();

  const after = request.nextUrl.searchParams.get('after');
  const before = request.nextUrl.searchParams.get('before');

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();

    if (after) {
      const { data, error } = await supabaseAdmin
        .from('chat_messages')
        .select(SELECT)
        .eq('room_id', id)
        .gt('created_at', after)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return NextResponse.json({ messages: await toChatMessagesWithReactions('chat_message_reactions', data as MessageRow[], authUser.userId), hasMore: false });
    }

    let query = supabaseAdmin
      .from('chat_messages')
      .select(SELECT)
      .eq('room_id', id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE + 1);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) throw error;

    const rows = data as MessageRow[];
    return NextResponse.json({
      messages: await toChatMessagesWithReactions('chat_message_reactions', rows.slice(0, PAGE_SIZE).reverse(), authUser.userId),
      hasMore: rows.length > PAGE_SIZE,
    });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room messages GET error:', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

// POST /api/rooms/:id/messages { body, linkUrl?, linkTitle? } -> members only
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return notAMember();

  let payload: { body?: unknown; linkUrl?: unknown; linkTitle?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const input = parseMessageInput(payload);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();
    if (await isSendingTooFast('chat_messages', authUser.userId)) return tooFastResponse();

    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .insert({ room_id: id, user_id: authUser.userId, body: input.body, link_url: input.linkUrl, link_title: input.linkTitle })
      .select(SELECT)
      .single();
    if (error) throw error;

    const now = new Date().toISOString();
    await Promise.all([
      supabaseAdmin.from('chat_rooms').update({ last_message_at: now }).eq('id', id),
      supabaseAdmin.from('chat_room_members').update({ last_read_at: now }).eq('room_id', id).eq('user_id', authUser.userId),
    ]);

    const [message] = await toChatMessages([data as MessageRow]);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room messages POST error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ROOM_NAME_MAX_LENGTH } from '@/lib/chat';
import {
  ensureHandle,
  friendIdsOf,
  handlesFor,
  isMissingTable,
  listRoomsFor,
  postSystemMessage,
  setupRequired,
} from '@/lib/chat-server';

const MAX_MEMBERS = 50;

// GET /api/rooms -> my rooms, most recent first, with unread counts
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json({ rooms: await listRoomsFor(authUser.userId) });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Rooms GET error:', error);
    return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });
  }
}

// POST /api/rooms { name, memberIds } -> a new group room with some of my friends
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authUser.userId;

  let payload: { name?: unknown; memberIds?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name || name.length > ROOM_NAME_MAX_LENGTH) {
    return NextResponse.json({ error: `Give the room a name (up to ${ROOM_NAME_MAX_LENGTH} characters)` }, { status: 400 });
  }
  const memberIds = Array.isArray(payload.memberIds)
    ? [...new Set(payload.memberIds.filter((id): id is string => typeof id === 'string' && id !== me))]
    : [];
  if (memberIds.length === 0) return NextResponse.json({ error: 'Add at least one friend' }, { status: 400 });
  if (memberIds.length >= MAX_MEMBERS) return NextResponse.json({ error: `A room can have up to ${MAX_MEMBERS} people` }, { status: 400 });

  try {
    const friends = await friendIdsOf(me);
    if (memberIds.some((id) => !friends.has(id))) {
      return NextResponse.json({ error: 'You can only add your friends' }, { status: 403 });
    }

    const { data: room, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ name, is_direct: false, created_by: me })
      .select('id')
      .single();
    if (error) throw error;

    const { error: membersError } = await supabaseAdmin.from('chat_room_members').insert([
      { room_id: room.id, user_id: me, role: 'owner' },
      ...memberIds.map((id) => ({ room_id: room.id, user_id: id, role: 'member' })),
    ]);
    if (membersError) throw membersError;

    const myHandle = await ensureHandle(me);
    const handles = await handlesFor(memberIds);
    const invited = memberIds.map((id) => `@${handles.get(id) ?? 'someone'}`).join(', ');
    await postSystemMessage(room.id, `@${myHandle} made this room with ${invited}`, me);

    return NextResponse.json({ room: { id: room.id } }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Rooms POST error:', error);
    return NextResponse.json({ error: 'Failed to create the room' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ROOM_NAME_MAX_LENGTH, type RoomDetail } from '@/lib/chat';
import {
  ensureHandle,
  fallbackHandle,
  handlesFor,
  isMissingTable,
  membershipOf,
  notAMember,
  postSystemMessage,
  setupRequired,
} from '@/lib/chat-server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/rooms/:id -> name and members (members only)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return notAMember();

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();

    const [{ data: room, error }, { data: members, error: membersError }] = await Promise.all([
      supabaseAdmin.from('chat_rooms').select('id, name, is_direct').eq('id', id).single(),
      supabaseAdmin.from('chat_room_members').select('user_id, role, joined_at').eq('room_id', id).order('joined_at'),
    ]);
    if (error) throw error;
    if (membersError) throw membersError;

    const handles = await handlesFor((members ?? []).map((m) => m.user_id));
    const people = (members ?? []).map((m) => ({
      id: m.user_id,
      handle: handles.get(m.user_id) || fallbackHandle(m.user_id),
      role: m.role as 'owner' | 'member',
    }));
    const other = people.find((p) => p.id !== authUser.userId);

    const detail: RoomDetail = {
      id: room.id,
      name: room.name,
      title: room.is_direct ? other?.handle ?? 'Just you' : room.name,
      isDirect: room.is_direct,
      ownerId: people.find((p) => p.role === 'owner')?.id ?? null,
      members: people,
    };
    return NextResponse.json({ room: detail });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room GET error:', error);
    return NextResponse.json({ error: 'Failed to load the room' }, { status: 500 });
  }
}

// PATCH /api/rooms/:id { name } -> rename a group room (any member)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID.test(id)) return notAMember();

  let payload: { name?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (!name || name.length > ROOM_NAME_MAX_LENGTH) {
    return NextResponse.json({ error: `Room names are 1–${ROOM_NAME_MAX_LENGTH} characters` }, { status: 400 });
  }

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();
    const { data: room, error: roomError } = await supabaseAdmin.from('chat_rooms').select('name, is_direct').eq('id', id).single();
    if (roomError) throw roomError;
    if (room.is_direct) return NextResponse.json({ error: 'Direct chats cannot be renamed' }, { status: 400 });
    if (room.name === name) return NextResponse.json({ success: true });

    const { error } = await supabaseAdmin.from('chat_rooms').update({ name }).eq('id', id);
    if (error) throw error;
    await postSystemMessage(id, `@${await ensureHandle(authUser.userId)} renamed the room to “${name}”`, authUser.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room PATCH error:', error);
    return NextResponse.json({ error: 'Failed to rename the room' }, { status: 500 });
  }
}

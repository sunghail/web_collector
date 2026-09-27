import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureHandle, friendIdsOf, handlesFor, membershipOf, notAMember, postSystemMessage } from '@/lib/chat-server';

const MAX_MEMBERS = 50;

// POST /api/rooms/:id/members { userIds } -> any member can add their own friends to a group room
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const me = authUser.userId;

  let payload: { userIds?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const requested = Array.isArray(payload.userIds)
    ? [...new Set(payload.userIds.filter((uid): uid is string => typeof uid === 'string'))]
    : [];
  if (requested.length === 0) return NextResponse.json({ error: 'Pick at least one friend' }, { status: 400 });

  try {
    if (!(await membershipOf(id, me))) return notAMember();
    const { data: room, error: roomError } = await supabaseAdmin.from('chat_rooms').select('is_direct').eq('id', id).single();
    if (roomError) throw roomError;
    if (room.is_direct) return NextResponse.json({ error: 'Make a group room to chat with more people' }, { status: 400 });

    const friends = await friendIdsOf(me);
    if (requested.some((uid) => !friends.has(uid))) {
      return NextResponse.json({ error: 'You can only add your friends' }, { status: 403 });
    }

    const { data: current, error: currentError } = await supabaseAdmin.from('chat_room_members').select('user_id').eq('room_id', id);
    if (currentError) throw currentError;
    const existing = new Set((current ?? []).map((m) => m.user_id));
    const toAdd = requested.filter((uid) => !existing.has(uid));
    if (toAdd.length === 0) return NextResponse.json({ added: 0 });
    if (existing.size + toAdd.length > MAX_MEMBERS) {
      return NextResponse.json({ error: `A room can have up to ${MAX_MEMBERS} people` }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('chat_room_members')
      .insert(toAdd.map((uid) => ({ room_id: id, user_id: uid, role: 'member' })));
    if (error) throw error;

    const handles = await handlesFor(toAdd);
    await postSystemMessage(
      id,
      `@${await ensureHandle(me)} added ${toAdd.map((uid) => `@${handles.get(uid) ?? 'someone'}`).join(', ')}`,
      me
    );
    return NextResponse.json({ added: toAdd.length });
  } catch (error) {
    console.error('Room members POST error:', error);
    return NextResponse.json({ error: 'Failed to add people' }, { status: 500 });
  }
}

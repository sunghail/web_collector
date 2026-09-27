import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureHandle, fallbackHandle, handlesFor, membershipOf, notAMember, postSystemMessage } from '@/lib/chat-server';

// DELETE /api/rooms/:id/members/:userId
//   your own id -> leave the room (the last person out deletes it)
//   someone else -> remove them (group room owner only)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, userId } = await params;
  const me = authUser.userId;

  try {
    const mine = await membershipOf(id, me);
    if (!mine) return notAMember();

    const { data: room, error: roomError } = await supabaseAdmin.from('chat_rooms').select('is_direct').eq('id', id).single();
    if (roomError) throw roomError;

    const isLeaving = userId === me;
    if (!isLeaving) {
      if (room.is_direct || mine.role !== 'owner') {
        return NextResponse.json({ error: 'Only the room owner can remove people' }, { status: 403 });
      }
      if (!(await membershipOf(id, userId))) return NextResponse.json({ error: 'They are not in this room' }, { status: 404 });
    }

    const { error } = await supabaseAdmin.from('chat_room_members').delete().eq('room_id', id).eq('user_id', userId);
    if (error) throw error;

    const { data: remaining, error: remainingError } = await supabaseAdmin
      .from('chat_room_members')
      .select('user_id, role, joined_at')
      .eq('room_id', id)
      .order('joined_at');
    if (remainingError) throw remainingError;

    if (!remaining?.length) {
      // Nobody left: remove the room and its messages.
      await supabaseAdmin.from('chat_rooms').delete().eq('id', id);
      return NextResponse.json({ success: true, deleted: true });
    }

    // Hand the room to whoever joined earliest if the owner left.
    if (!room.is_direct && !remaining.some((m) => m.role === 'owner')) {
      await supabaseAdmin.from('chat_room_members').update({ role: 'owner' }).eq('room_id', id).eq('user_id', remaining[0].user_id);
    }

    const handles = await handlesFor([userId]);
    const who = `@${handles.get(userId) ?? fallbackHandle(userId)}`;
    await postSystemMessage(id, isLeaving ? `${who} left the room` : `@${await ensureHandle(me)} removed ${who}`, isLeaving ? undefined : me);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room member DELETE error:', error);
    return NextResponse.json({ error: 'Failed to update the room' }, { status: 500 });
  }
}

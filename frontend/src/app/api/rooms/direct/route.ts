import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { friendIdsOf, isMissingTable, setupRequired } from '@/lib/chat-server';

// POST /api/rooms/direct { userId } -> the 1:1 room with a friend, created the first time
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authUser.userId;

  let payload: { userId?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const other = typeof payload.userId === 'string' ? payload.userId : '';

  try {
    const friends = await friendIdsOf(me);
    if (!friends.has(other)) return NextResponse.json({ error: 'You can only message your friends' }, { status: 403 });

    // A direct room both of us are still in.
    const { data: mine, error: mineError } = await supabaseAdmin.from('chat_room_members').select('room_id').eq('user_id', me);
    if (mineError) throw mineError;
    const myRoomIds = (mine ?? []).map((row) => row.room_id);
    if (myRoomIds.length) {
      const { data: shared, error: sharedError } = await supabaseAdmin
        .from('chat_room_members')
        .select('room_id, chat_rooms!inner(is_direct)')
        .eq('user_id', other)
        .eq('chat_rooms.is_direct', true)
        .in('room_id', myRoomIds)
        .limit(1);
      if (sharedError) throw sharedError;
      if (shared?.length) return NextResponse.json({ room: { id: shared[0].room_id } });
    }

    const { data: room, error } = await supabaseAdmin
      .from('chat_rooms')
      .insert({ name: null, is_direct: true, created_by: me })
      .select('id')
      .single();
    if (error) throw error;
    const { error: membersError } = await supabaseAdmin.from('chat_room_members').insert([
      { room_id: room.id, user_id: me, role: 'member' },
      { room_id: room.id, user_id: other, role: 'member' },
    ]);
    if (membersError) throw membersError;

    return NextResponse.json({ room: { id: room.id } }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Direct room error:', error);
    return NextResponse.json({ error: 'Failed to open the chat' }, { status: 500 });
  }
}

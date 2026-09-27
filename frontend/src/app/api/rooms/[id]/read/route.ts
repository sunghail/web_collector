import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/rooms/:id/read -> mark everything in the room as read for me
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const { error } = await supabaseAdmin
      .from('chat_room_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('room_id', id)
      .eq('user_id', authUser.userId);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room read error:', error);
    return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
  }
}

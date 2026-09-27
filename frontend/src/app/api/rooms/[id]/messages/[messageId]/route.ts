import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

// DELETE /api/rooms/:id/messages/:messageId -> people can remove only their own messages
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string; messageId: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, messageId } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('room_id', id)
      .eq('user_id', authUser.userId)
      .select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room message DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isMissingTable, listRoomsFor, unseenMentions } from '@/lib/chat-server';

// GET /api/social/summary -> numbers for the sidebar badges
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [{ count: pendingRequests, error }, rooms, mentions] = await Promise.all([
      supabaseAdmin
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', authUser.userId)
        .eq('status', 'pending'),
      listRoomsFor(authUser.userId),
      unseenMentions(authUser.userId),
    ]);
    if (error) throw error;
    return NextResponse.json({
      pendingRequests: pendingRequests ?? 0,
      unreadMessages: rooms.reduce((sum, room) => sum + room.unread, 0),
      // @mentions not seen yet: the community room has no unread count of its own, so these show there.
      mentions,
    });
  } catch (error) {
    // Before the friends migration runs, just show no badges.
    if (isMissingTable(error as { code?: string })) return NextResponse.json({ pendingRequests: 0, unreadMessages: 0, setupRequired: true });
    console.error('Social summary error:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

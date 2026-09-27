import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isMissingTable, listRoomsFor } from '@/lib/chat-server';

// GET /api/social/summary -> numbers for the sidebar badges
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [{ count: pendingRequests, error }, rooms] = await Promise.all([
      supabaseAdmin
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .eq('addressee_id', authUser.userId)
        .eq('status', 'pending'),
      listRoomsFor(authUser.userId),
    ]);
    if (error) throw error;
    return NextResponse.json({
      pendingRequests: pendingRequests ?? 0,
      unreadMessages: rooms.reduce((sum, room) => sum + room.unread, 0),
    });
  } catch (error) {
    // Before the friends migration runs, just show no badges.
    if (isMissingTable(error as { code?: string })) return NextResponse.json({ pendingRequests: 0, unreadMessages: 0, setupRequired: true });
    console.error('Social summary error:', error);
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE /api/friends/:userId -> stop being friends. Shared rooms stay; you just can't add each other anymore.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = await params;
  if (!UUID.test(userId)) return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
  const me = authUser.userId;

  try {
    const { data, error } = await supabaseAdmin
      .from('friendships')
      .delete()
      .eq('status', 'accepted')
      .or(`and(requester_id.eq.${me},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me})`)
      .select('id');
    if (error) throw error;
    if (!data?.length) return NextResponse.json({ error: 'Friend not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove friend' }, { status: 500 });
  }
}

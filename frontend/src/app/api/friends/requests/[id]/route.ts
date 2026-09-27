import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

async function loadRequest(id: string) {
  const { data, error } = await supabaseAdmin
    .from('friendships')
    .select('id, requester_id, addressee_id, status')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// PATCH /api/friends/requests/:id { action: "accept" } -> only the person who was asked can accept
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  let payload: { action?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (payload.action !== 'accept') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });

  try {
    const row = await loadRequest(id);
    if (!row || row.status !== 'pending' || row.addressee_id !== authUser.userId) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const { error } = await supabaseAdmin
      .from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend request PATCH error:', error);
    return NextResponse.json({ error: 'Failed to accept the request' }, { status: 500 });
  }
}

// DELETE /api/friends/requests/:id -> decline (if you were asked) or cancel (if you asked)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  try {
    const row = await loadRequest(id);
    const isParty = row && (row.requester_id === authUser.userId || row.addressee_id === authUser.userId);
    if (!row || row.status !== 'pending' || !isParty) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }
    const { error } = await supabaseAdmin.from('friendships').delete().eq('id', id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Friend request DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove the request' }, { status: 500 });
  }
}

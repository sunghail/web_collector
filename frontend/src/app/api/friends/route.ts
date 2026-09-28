import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeHandle, type FriendRequest, type Person } from '@/lib/chat';
import { ensureHandle, isMissingTable, personFrom, profilesFor, setupRequired } from '@/lib/chat-server';

const MAX_PENDING_OUTGOING = 30;

interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
}

// GET /api/friends -> { friends, incoming, outgoing }
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authUser.userId;

  try {
    const { data, error } = await supabaseAdmin
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
      .order('created_at', { ascending: false });
    if (isMissingTable(error)) return setupRequired();
    if (error) throw error;

    const rows = (data ?? []) as FriendshipRow[];
    const otherOf = (row: FriendshipRow) => (row.requester_id === me ? row.addressee_id : row.requester_id);
    const profiles = await profilesFor(rows.map(otherOf));
    const person = (id: string): Person => personFrom(id, profiles);

    const friends = rows
      .filter((row) => row.status === 'accepted')
      .map((row) => person(otherOf(row)))
      .sort((a, b) => a.handle.localeCompare(b.handle));
    const toRequest = (row: FriendshipRow): FriendRequest => ({ id: row.id, person: person(otherOf(row)), createdAt: row.created_at });
    const incoming = rows.filter((row) => row.status === 'pending' && row.addressee_id === me).map(toRequest);
    const outgoing = rows.filter((row) => row.status === 'pending' && row.requester_id === me).map(toRequest);

    return NextResponse.json({ friends, incoming, outgoing });
  } catch (error) {
    console.error('Friends GET error:', error);
    return NextResponse.json({ error: 'Failed to load friends' }, { status: 500 });
  }
}

// POST /api/friends { handle } -> send a friend request (or accept theirs if they already asked)
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = authUser.userId;

  let payload: { handle?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const handle = normalizeHandle(payload.handle);
  if (!handle) return NextResponse.json({ error: 'Enter an ID' }, { status: 400 });

  try {
    await ensureHandle(me);
    const { data: target, error: targetError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, handle')
      .eq('handle', handle)
      .maybeSingle();
    if (isMissingTable(targetError)) return setupRequired();
    if (targetError) throw targetError;
    if (!target) return NextResponse.json({ error: `No one has the ID @${handle}` }, { status: 404 });
    if (target.user_id === me) return NextResponse.json({ error: 'That is your own ID' }, { status: 400 });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from('friendships')
      .select('id, requester_id, status')
      .or(
        `and(requester_id.eq.${me},addressee_id.eq.${target.user_id}),and(requester_id.eq.${target.user_id},addressee_id.eq.${me})`
      )
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.status === 'accepted') {
      return NextResponse.json({ error: `You and @${target.handle} are already friends` }, { status: 409 });
    }
    if (existing && existing.requester_id === me) {
      return NextResponse.json({ error: `You already asked @${target.handle}` }, { status: 409 });
    }
    if (existing) {
      // They asked first, so asking back means yes.
      const { error } = await supabaseAdmin
        .from('friendships')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', existing.id);
      if (error) throw error;
      return NextResponse.json({ status: 'accepted', person: { id: target.user_id, handle: target.handle } });
    }

    const { count } = await supabaseAdmin
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', me)
      .eq('status', 'pending');
    if ((count ?? 0) >= MAX_PENDING_OUTGOING) {
      return NextResponse.json({ error: 'You have too many requests waiting. Cancel some first.' }, { status: 429 });
    }

    const { error } = await supabaseAdmin.from('friendships').insert({ requester_id: me, addressee_id: target.user_id });
    if (error?.code === '23505') return NextResponse.json({ error: `You already asked @${target.handle}` }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ status: 'pending', person: { id: target.user_id, handle: target.handle } }, { status: 201 });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Friends POST error:', error);
    return NextResponse.json({ error: 'Failed to send the request' }, { status: 500 });
  }
}

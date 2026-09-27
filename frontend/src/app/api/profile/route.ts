import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizeHandle } from '@/lib/chat';
import { ensureHandle, isMissingTable, isValidHandle, setupRequired } from '@/lib/chat-server';

// GET /api/profile -> my public @ID (created the first time)
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const handle = await ensureHandle(authUser.userId);
    return NextResponse.json({ profile: { id: authUser.userId, handle } });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Failed to load your profile' }, { status: 500 });
  }
}

// PUT /api/profile { handle } -> change my @ID
export async function PUT(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: { handle?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const handle = normalizeHandle(payload.handle);
  if (!isValidHandle(handle)) {
    return NextResponse.json(
      { error: 'Use 3–20 characters: lowercase letters, numbers, _ and .' },
      { status: 400 }
    );
  }

  try {
    await ensureHandle(authUser.userId);
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .update({ handle, updated_at: new Date().toISOString() })
      .eq('user_id', authUser.userId);
    if (error?.code === '23505') return NextResponse.json({ error: 'That ID is already taken' }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ profile: { id: authUser.userId, handle } });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Failed to change your ID' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  DISPLAY_NAME_MAX_LENGTH,
  STATUS_MAX_LENGTH,
  isAllowedAvatarColor,
  isAllowedAvatarEmoji,
  normalizeHandle,
} from '@/lib/chat';
import { ensureHandle, isMissingTable, isValidHandle, personFrom, profilesFor, setupRequired } from '@/lib/chat-server';

async function myProfile(userId: string) {
  await ensureHandle(userId);
  return personFrom(userId, await profilesFor([userId]));
}

// GET /api/profile -> my public profile: @ID (created the first time), display name, status and avatar
export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json({ profile: await myProfile(authUser.userId) });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Profile GET error:', error);
    return NextResponse.json({ error: 'Failed to load your profile' }, { status: 500 });
  }
}

/** A text field from the request: undefined when not sent, null when cleared, or an error. */
function optionalText(value: unknown, max: number): string | null | undefined | { error: true } {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return { error: true };
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (trimmed.length > max) return { error: true };
  return trimmed || null;
}

// PUT /api/profile { handle?, name?, status?, emoji?, color? } -> change any part of my profile
export async function PUT(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let payload: { handle?: unknown; name?: unknown; status?: unknown; emoji?: unknown; color?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const changes: Record<string, string | null> = {};
  if (payload.handle !== undefined) {
    const handle = normalizeHandle(payload.handle);
    if (!isValidHandle(handle)) {
      return NextResponse.json({ error: 'Use 3–20 characters: lowercase letters, numbers, _ and .' }, { status: 400 });
    }
    changes.handle = handle;
  }
  const name = optionalText(payload.name, DISPLAY_NAME_MAX_LENGTH);
  if (name && typeof name === 'object') {
    return NextResponse.json({ error: `Names can be up to ${DISPLAY_NAME_MAX_LENGTH} characters` }, { status: 400 });
  }
  if (name !== undefined) changes.display_name = name;
  const status = optionalText(payload.status, STATUS_MAX_LENGTH);
  if (status && typeof status === 'object') {
    return NextResponse.json({ error: `Status can be up to ${STATUS_MAX_LENGTH} characters` }, { status: 400 });
  }
  if (status !== undefined) changes.status_text = status;
  if (payload.emoji !== undefined) {
    if (payload.emoji !== null && !isAllowedAvatarEmoji(payload.emoji)) {
      return NextResponse.json({ error: 'Pick an avatar from the list' }, { status: 400 });
    }
    changes.avatar_emoji = payload.emoji;
  }
  if (payload.color !== undefined) {
    if (payload.color !== null && !isAllowedAvatarColor(payload.color)) {
      return NextResponse.json({ error: 'Pick a color from the list' }, { status: 400 });
    }
    changes.avatar_color = payload.color;
  }

  try {
    await ensureHandle(authUser.userId);
    if (Object.keys(changes).length) {
      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ ...changes, updated_at: new Date().toISOString() })
        .eq('user_id', authUser.userId);
      if (error?.code === '23505') return NextResponse.json({ error: 'That ID is already taken' }, { status: 409 });
      if (error?.code === '42703') return setupRequired(); // profile columns not added yet
      if (error) throw error;
    }
    return NextResponse.json({ profile: await myProfile(authUser.userId) });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Profile PUT error:', error);
    return NextResponse.json({ error: 'Failed to save your profile' }, { status: 500 });
  }
}

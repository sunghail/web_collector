import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { UUID_PATTERN, markMentionsSeen } from '@/lib/chat-server';

// POST /api/mentions/seen { place: "community" } -> the community room is open, so its mentions are seen.
// (Chat rooms clear theirs through POST /api/rooms/:id/read.)
export async function POST(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let place: unknown;
  try {
    place = ((await request.json()) as { place?: unknown }).place;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (place !== 'community' && !(typeof place === 'string' && UUID_PATTERN.test(place))) {
    return NextResponse.json({ error: 'Invalid place' }, { status: 400 });
  }

  try {
    await markMentionsSeen(authUser.userId, place as string);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mentions seen error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

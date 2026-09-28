import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { isMissingTable, listLinkHistory, setupRequired } from '@/lib/chat-server';

// GET /api/shared-links?place=all|community|<roomId>&before=ISO&q=words
// -> every site shared where you can read it (the community room and your chat rooms), newest first.
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = request.nextUrl.searchParams;
  try {
    const result = await listLinkHistory(authUser.userId, {
      place: params.get('place') || 'all',
      before: params.get('before'),
      query: params.get('q') || '',
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Link history GET error:', error);
    return NextResponse.json({ error: 'Failed to load the link history' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { parseMessageIds, reactionsFor } from '@/lib/chat-server';

// GET /api/community/messages/reactions?ids=a,b,c -> current reactions for messages already on screen.
// Polling for new messages only brings new ones, so open chats use this to keep reactions up to date.
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ids = parseMessageIds(request.nextUrl.searchParams.get('ids'));
  try {
    const reactions = await reactionsFor('community_message_reactions', ids, authUser.userId);
    return NextResponse.json({ reactions: Object.fromEntries(reactions) });
  } catch (error) {
    console.error('Community reactions GET error:', error);
    return NextResponse.json({ error: 'Failed to load reactions' }, { status: 500 });
  }
}

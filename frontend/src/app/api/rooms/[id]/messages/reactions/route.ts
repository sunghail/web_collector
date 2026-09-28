import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { UUID_PATTERN, membershipOf, notAMember, parseMessageIds, reactionsFor } from '@/lib/chat-server';

// GET /api/rooms/:id/messages/reactions?ids=a,b,c -> current reactions for this room's messages on screen (members only)
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notAMember();

  const ids = parseMessageIds(request.nextUrl.searchParams.get('ids'));
  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();
    if (ids.length === 0) return NextResponse.json({ reactions: {} });

    // Only messages in this room: being a member here must not reveal reactions elsewhere.
    const { data, error } = await supabaseAdmin.from('chat_messages').select('id').eq('room_id', id).in('id', ids);
    if (error) throw error;
    const reactions = await reactionsFor('chat_message_reactions', (data ?? []).map((row) => row.id), authUser.userId);
    return NextResponse.json({ reactions: Object.fromEntries(reactions) });
  } catch (error) {
    console.error('Room reactions GET error:', error);
    return NextResponse.json({ error: 'Failed to load reactions' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isAllowedReaction } from '@/lib/chat';
import { UUID_PATTERN, changeReaction, isMissingTable, membershipOf, notAMember, setupRequired } from '@/lib/chat-server';

type Params = Promise<{ id: string; messageId: string }>;
const notFound = () => NextResponse.json({ error: 'Message not found' }, { status: 404 });

async function handle(request: NextRequest, params: Params, add: boolean) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, messageId } = await params;
  if (!UUID_PATTERN.test(id)) return notAMember();
  if (!UUID_PATTERN.test(messageId)) return notFound();

  let emoji: unknown = request.nextUrl.searchParams.get('emoji');
  if (add) {
    try {
      emoji = ((await request.json()) as { emoji?: unknown }).emoji;
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }
  }
  if (!isAllowedReaction(emoji)) return NextResponse.json({ error: 'That reaction is not available' }, { status: 400 });

  try {
    if (!(await membershipOf(id, authUser.userId))) return notAMember();
    // The message must be in this room, and system notes ("@a joined") take no reactions.
    const { data: message, error } = await supabaseAdmin
      .from('chat_messages')
      .select('id, kind')
      .eq('id', messageId)
      .eq('room_id', id)
      .maybeSingle();
    if (error) throw error;
    if (!message || message.kind !== 'user') return notFound();
    return NextResponse.json({ reactions: await changeReaction('chat_message_reactions', messageId, authUser.userId, emoji, add) });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Room reaction error:', error);
    return NextResponse.json({ error: 'Failed to update the reaction' }, { status: 500 });
  }
}

// POST /api/rooms/:id/messages/:messageId/reactions { emoji } -> add my reaction (members only)
export function POST(request: NextRequest, { params }: { params: Params }) {
  return handle(request, params, true);
}

// DELETE /api/rooms/:id/messages/:messageId/reactions?emoji=👍 -> remove my reaction (members only)
export function DELETE(request: NextRequest, { params }: { params: Params }) {
  return handle(request, params, false);
}

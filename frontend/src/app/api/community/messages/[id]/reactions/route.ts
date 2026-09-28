import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { isAllowedReaction } from '@/lib/chat';
import { UUID_PATTERN, changeReaction, isMissingTable, setupRequired } from '@/lib/chat-server';

const notFound = () => NextResponse.json({ error: 'Message not found' }, { status: 404 });

async function handle(request: NextRequest, params: Promise<{ id: string }>, add: boolean) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return notFound();

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
    const { data: message, error } = await supabaseAdmin.from('community_messages').select('id').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!message) return notFound();
    return NextResponse.json({ reactions: await changeReaction('community_message_reactions', id, authUser.userId, emoji, add) });
  } catch (error) {
    if (isMissingTable(error as { code?: string })) return setupRequired();
    console.error('Community reaction error:', error);
    return NextResponse.json({ error: 'Failed to update the reaction' }, { status: 500 });
  }
}

// POST /api/community/messages/:id/reactions { emoji } -> add my reaction
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params, true);
}

// DELETE /api/community/messages/:id/reactions?emoji=👍 -> remove my reaction
export function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handle(request, params, false);
}

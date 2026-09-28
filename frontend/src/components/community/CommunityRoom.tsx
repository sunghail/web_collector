'use client';

import { Menu, MessagesSquare } from 'lucide-react';
import { ChatThread } from '@/components/chat/ChatThread';

interface CommunityRoomProps {
  currentUserId: string;
  onOpenSidebar: () => void;
  /** Called after a shared site is saved, so the link list can refresh. */
  onLinkSaved: () => void;
  /** A message to scroll to, e.g. when coming from the Link history. */
  focusMessageId?: string | null;
  onFocused?: () => void;
}

/** The one open room everyone shares. */
export function CommunityRoom({ currentUserId, onOpenSidebar, onLinkSaved, focusMessageId, onFocused }: CommunityRoomProps) {
  return (
    <div className="h-dvh">
      <ChatThread
        endpoint="/community/messages"
        currentUserId={currentUserId}
        placeholder="Message everyone"
        footnote="Everyone signed in can read this room. Enter to send, Shift+Enter for a new line."
        emptyState={{ title: 'Say hello', body: 'Nobody has written yet. Start the room, or share a site you love.' }}
        setupHint={
          <>
            Run <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/20260923_add_community_messages.sql</code> in the
            Supabase SQL editor, then reload this page.
          </>
        }
        onLinkSaved={onLinkSaved}
        focusMessageId={focusMessageId}
        onFocused={onFocused}
        header={
          <header className="shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-md">
            <div className="flex h-16 items-center gap-3 px-4 md:px-8">
              <button
                type="button"
                onClick={onOpenSidebar}
                aria-label="Open sidebar"
                className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              >
                <Menu className="size-5" />
              </button>
              <MessagesSquare className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <h1 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.015em]">Community</h1>
                <p className="truncate text-xs text-muted-foreground">One open room for everyone using Web Collector</p>
              </div>
            </div>
          </header>
        }
      />
    </div>
  );
}

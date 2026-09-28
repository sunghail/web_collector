'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BookmarkPlus, ExternalLink, FolderOpen, History, Menu, MessageSquareText, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { SiteIcon } from '@/components/chat/SiteIcon';
import api from '@/lib/api';
import { hostnameOf, type LinkHistoryItem } from '@/lib/chat';
import type { ChatPlace } from '@/lib/shareToChat';

interface LinkHistoryViewProps {
  onOpenSidebar: () => void;
  /** Opens the chat the site was shared in, scrolled to that message. */
  onGoToMessage: (place: ChatPlace, messageId: string) => void;
  onLinkSaved: () => void;
}

type ApiError = { response?: { status?: number; data?: { error?: string } } };

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dayFormat.format(date);
}

/** Every site shared in the community room and your chat rooms: who shared it, where, and their note. */
export function LinkHistoryView({ onOpenSidebar, onGoToMessage, onLinkSaved }: LinkHistoryViewProps) {
  const [items, setItems] = useState<LinkHistoryItem[]>([]);
  const [rooms, setRooms] = useState<{ id: string; title: string }[]>([]);
  const [place, setPlace] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const requestId = useRef(0);

  // Search after a short pause in typing.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(
    async (before: string | null) => {
      const id = ++requestId.current;
      try {
        const response = await api.get('/shared-links', { params: { place, q: search || undefined, before: before || undefined } });
        if (id !== requestId.current) return;
        const page: LinkHistoryItem[] = response.data.items ?? [];
        setItems((current) => (before ? [...current, ...page] : page));
        setHasMore(Boolean(response.data.hasMore));
        setRooms(response.data.rooms || []);
      } catch (error) {
        if ((error as ApiError)?.response?.data?.error === 'setup_required') setNeedsSetup(true);
        else toast.error('Could not load the link history');
      }
    },
    [place, search]
  );

  useEffect(() => {
    setIsLoading(true);
    load(null).finally(() => setIsLoading(false));
  }, [load]);

  const loadMore = async () => {
    const last = items[items.length - 1];
    if (!last) return;
    setIsLoadingMore(true);
    await load(last.sharedAt);
    setIsLoadingMore(false);
  };

  const save = async (item: LinkHistoryItem) => {
    try {
      await api.post('/links', { title: item.title, url: item.url, memo: item.memo, categoryId: null });
      toast.success('Saved to your Inbox');
      onLinkSaved();
    } catch (error) {
      if ((error as ApiError)?.response?.status === 409) toast.message('Already in your links');
      else toast.error('Could not save the site');
    }
  };

  const goTo = (item: LinkHistoryItem) =>
    onGoToMessage(item.place.kind === 'community' ? { kind: 'community' } : { kind: 'room', roomId: item.place.roomId }, item.messageId);

  const iconButton =
    'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

  return (
    <div className="flex h-dvh min-h-0 flex-col">
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
          <History className="size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.015em]">Link history</h1>
            <p className="truncate text-xs text-muted-foreground">Every site shared in the community and your chats</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row md:px-8">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles, addresses and notes"
              aria-label="Search shared links"
              className="h-9 pl-9"
            />
          </div>
          <NativeSelect value={place} onChange={(e) => setPlace(e.target.value)} aria-label="Where" className="h-9 sm:w-56">
            <option value="all">All chats</option>
            <option value="community">Community</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      </header>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        <div className="mx-auto max-w-3xl">
          {isLoading && (
            <div className="flex h-40 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
            </div>
          )}

          {!isLoading && needsSetup && (
            <div className="mx-auto mt-10 max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <h2 className="text-[15px] font-semibold">This isn&apos;t set up yet</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Run <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/20260928_add_shared_links.sql</code> in the Supabase SQL
                editor, then reload.
              </p>
            </div>
          )}

          {!isLoading && !needsSetup && items.length === 0 && (
            <div className="mt-16 flex flex-col items-center text-center">
              <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
                <History className="size-6" />
              </div>
              <h2 className="text-[15px] font-semibold">{search ? 'Nothing matches' : 'No shared sites yet'}</h2>
              <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                {search ? 'Try other words, or look in all chats.' : 'Sites shared in the community and your chats will show up here.'}
              </p>
            </div>
          )}

          {!isLoading &&
            items.map((item, index) => {
              const newDay = index === 0 || dayLabel(items[index - 1].sharedAt) !== dayLabel(item.sharedAt);
              return (
                <div key={item.id}>
                  {newDay && (
                    <div className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground first:mt-0">
                      {dayLabel(item.sharedAt)}
                    </div>
                  )}
                  <div className="group mb-2 flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
                    <SiteIcon url={item.url} />
                    <div className="min-w-0 flex-1">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="block truncate text-[14px] font-semibold outline-none hover:underline focus-visible:underline"
                      >
                        {item.title}
                      </a>
                      <span className="block truncate text-xs text-muted-foreground">{hostnameOf(item.url)}</span>
                      {item.memo && (
                        <p className="mt-1.5 whitespace-pre-wrap break-words rounded-lg bg-muted/60 px-2.5 py-1.5 text-[13px] leading-relaxed">
                          {item.memo}
                        </p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground/80">@{item.sharedBy}</span>
                        <span>·</span>
                        <span>{item.place.kind === 'community' ? 'Community' : item.place.title}</span>
                        {item.collectionName && (
                          <>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <FolderOpen className="size-3" />
                              {item.collectionName}
                            </span>
                          </>
                        )}
                        <span>·</span>
                        <time dateTime={item.sharedAt}>{timeFormat.format(new Date(item.sharedAt))}</time>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button type="button" onClick={() => goTo(item)} title="Go to the message" aria-label="Go to the message" className={iconButton}>
                        <MessageSquareText className="size-4" />
                      </button>
                      <button type="button" onClick={() => save(item)} title="Save to my links" aria-label={`Save ${item.title}`} className={iconButton}>
                        <BookmarkPlus className="size-4" />
                      </button>
                      <a href={item.url} target="_blank" rel="noopener noreferrer nofollow" title="Open" aria-label={`Open ${item.title}`} className={iconButton}>
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

          {!isLoading && hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
                {isLoadingMore ? 'Loading…' : 'Show older'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

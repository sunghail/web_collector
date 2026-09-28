'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CornerDownLeft, History, Inbox, LayoutGrid, MessageCircle, MessagesSquare, Search, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { SiteIcon } from '@/components/chat/SiteIcon';
import api from '@/lib/api';
import { hostnameOf } from '@/lib/chat';
import { INBOX_CATEGORY_ID } from '@/lib/linkUtils';
import type { Category, Link } from '@/types';
import type { SocialView } from '@/components/layout/Sidebar';

interface QuickOpenProps {
  /** Show a category (null for All links, or the Inbox id). */
  onSelectCategory: (categoryId: string | null) => void;
  onOpenView: (view: SocialView) => void;
}

type Item =
  | { kind: 'link'; id: string; link: Link; category: string }
  | { kind: 'place'; id: string; label: string; detail: string; icon: ReactNode; run: () => void };

const MAX_RESULTS = 40;

/** Ctrl+K (⌘K on Mac): type a few letters of a saved link and open it, or jump to a category or screen. */
export function QuickOpen({ onSelectCategory, onOpenView }: QuickOpenProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [links, setLinks] = useState<Link[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActive(0);
    Promise.all([api.get('/links'), api.get('/categories')])
      .then(([linksResponse, categoriesResponse]) => {
        setLinks(((linksResponse.data.links || []) as Link[]).filter((link) => link.type !== 'macro'));
        setCategories(categoriesResponse.data.categories || []);
      })
      .catch(() => undefined);
  }, [isOpen]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const close = (run: () => void) => () => {
      run();
      setIsOpen(false);
    };
    const places: Item[] = [
      { kind: 'place', id: 'all', label: 'All links', detail: 'Go to', icon: <LayoutGrid className="size-4" />, run: close(() => onSelectCategory(null)) },
      { kind: 'place', id: 'inbox', label: 'Inbox', detail: 'Go to', icon: <Inbox className="size-4" />, run: close(() => onSelectCategory(INBOX_CATEGORY_ID)) },
      ...categories.map<Item>((category) => ({
        kind: 'place',
        id: `category-${category.id}`,
        label: category.name,
        detail: 'Category',
        icon: <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />,
        run: close(() => onSelectCategory(category.id)),
      })),
      { kind: 'place', id: 'chats', label: 'Chats', detail: 'Go to', icon: <MessageCircle className="size-4" />, run: close(() => onOpenView('chats')) },
      { kind: 'place', id: 'friends', label: 'Friends', detail: 'Go to', icon: <Users className="size-4" />, run: close(() => onOpenView('friends')) },
      { kind: 'place', id: 'community', label: 'Community', detail: 'Go to', icon: <MessagesSquare className="size-4" />, run: close(() => onOpenView('community')) },
      { kind: 'place', id: 'history', label: 'Link history', detail: 'Go to', icon: <History className="size-4" />, run: close(() => onOpenView('history')) },
    ];
    const linkItems = links.map<Item>((link) => ({
      kind: 'link',
      id: link.id,
      link,
      category: link.category_id ? categoryName.get(link.category_id) ?? '' : 'Inbox',
    }));
    if (!q) return [...linkItems.slice(0, 8), ...places];

    // Titles that start with the words rank first, then anything that contains them.
    const score = (text: string) => (text.startsWith(q) ? 2 : text.includes(q) ? 1 : 0);
    const matchedLinks = linkItems
      .map((item) => {
        const link = (item as Extract<Item, { kind: 'link' }>).link;
        const best = Math.max(score(link.title.toLowerCase()) * 2, score(hostnameOf(link.url)), score((link.memo ?? '').toLowerCase()));
        return { item, best };
      })
      .filter((entry) => entry.best > 0)
      .sort((a, b) => b.best - a.best)
      .map((entry) => entry.item);
    const matchedPlaces = places.filter((item) => item.kind === 'place' && item.label.toLowerCase().includes(q));
    return [...matchedLinks, ...matchedPlaces].slice(0, MAX_RESULTS);
  }, [query, links, categories, onSelectCategory, onOpenView]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    if (item.kind === 'place') {
      item.run();
      return;
    }
    window.open(item.link.url, '_blank', 'noopener,noreferrer');
    setIsOpen(false);
  };

  // Keep the highlighted row in view while moving with the arrow keys.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[560px]" showCloseButton={false}>
        <DialogTitle className="sr-only">Quick open</DialogTitle>
        <DialogDescription className="sr-only">Type to find a saved link, a category or a screen.</DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const step = e.key === 'ArrowDown' ? 1 : -1;
                setActive((i) => (items.length ? (i + step + items.length) % items.length : 0));
              } else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                choose(items[active]);
              }
            }}
            placeholder="Open a link, or go to a category…"
            aria-label="Search links and places"
            className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listRef} className="custom-scrollbar max-h-[min(420px,60vh)] overflow-y-auto p-1.5" role="listbox" aria-label="Results">
          {items.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing matches.</p>}
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={index === active}
              data-index={index}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(item)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${index === active ? 'bg-accent' : ''}`}
            >
              {item.kind === 'link' ? (
                <>
                  <SiteIcon url={item.link.url} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{item.link.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.link.memo ? `${item.link.memo} · ${hostnameOf(item.link.url)}` : hostnameOf(item.link.url)}
                    </span>
                  </span>
                  <span className="max-w-[30%] shrink-0 truncate text-[11px] text-muted-foreground">{item.category}</span>
                </>
              ) : (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{item.icon}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.label}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{item.detail}</span>
                </>
              )}
              {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto">Ctrl K</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

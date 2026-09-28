'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, FolderUp, Inbox, LayoutGrid, Link2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SiteIcon } from './SiteIcon';
import api from '@/lib/api';
import { MAX_LINKS_PER_MESSAGE, hostnameOf, normalizeShareUrl, type SharedLink } from '@/lib/chat';
import type { Category, Link } from '@/types';

interface ShareSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chosen sites; `collectionName` is set when a whole category is shared. */
  onPick: (sites: SharedLink[], collectionName: string | null) => void;
}

/** Which folder of saved links is open: all of them, the Inbox (no category), or one category. */
type Folder = { kind: 'all' } | { kind: 'inbox' } | { kind: 'category'; category: Category };

const rowButton = 'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent disabled:opacity-50';

function toShared(link: Link): SharedLink {
  return { url: link.url, title: link.title, memo: link.memo || null };
}

/**
 * Pick saved links to attach (browse by category, or search; tick as many as you like),
 * share a whole category at once, or paste any address.
 */
export function ShareSiteDialog({ open, onOpenChange, onPick }: ShareSiteDialogProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Map<string, SharedLink>>(new Map());
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    setFolder(null);
    setQuery('');
    setSelected(new Map());
    setAddress('');
    setTitle('');
    setIsLoading(true);
    Promise.all([api.get('/links'), api.get('/categories')])
      .then(([linksResponse, categoriesResponse]) => {
        const saved: Link[] = (linksResponse.data.links || []).filter((link: Link) => link.type !== 'macro');
        setLinks(saved.sort((a, b) => a.order_index - b.order_index));
        const list: Category[] = categoriesResponse.data.categories || [];
        setCategories(list.sort((a, b) => a.order_index - b.order_index));
      })
      .catch(() => {
        setLinks([]);
        setCategories([]);
      })
      .finally(() => setIsLoading(false));
  }, [open]);

  const countIn = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const link of links) counts.set(link.category_id, (counts.get(link.category_id) ?? 0) + 1);
    return counts;
  }, [links]);
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const q = query.trim().toLowerCase();
  // Searching always looks through every saved link, whichever folder is open.
  const shownLinks = useMemo(() => {
    if (q) return links.filter((link) => link.title.toLowerCase().includes(q) || link.url.toLowerCase().includes(q));
    if (!folder || folder.kind === 'all') return links;
    if (folder.kind === 'inbox') return links.filter((link) => !link.category_id);
    return links.filter((link) => link.category_id === folder.category.id);
  }, [links, folder, q]);

  const normalizedAddress = normalizeShareUrl(address);
  const pickedCount = selected.size + (normalizedAddress && !selected.has(normalizedAddress) ? 1 : 0);
  const isFull = selected.size >= MAX_LINKS_PER_MESSAGE;

  const toggle = (link: Link) =>
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(link.url)) next.delete(link.url);
      else if (next.size < MAX_LINKS_PER_MESSAGE) next.set(link.url, toShared(link));
      return next;
    });

  const finish = (sites: SharedLink[], collectionName: string | null) => {
    onPick(sites, collectionName);
    onOpenChange(false);
  };

  const attachPicked = () => {
    const sites = [...selected.values()];
    if (normalizedAddress && !selected.has(normalizedAddress)) {
      sites.push({ url: normalizedAddress, title: title.trim() || hostnameOf(normalizedAddress), memo: null });
    }
    if (sites.length) finish(sites.slice(0, MAX_LINKS_PER_MESSAGE), null);
  };

  const folderTitle = !folder ? '' : folder.kind === 'all' ? 'All links' : folder.kind === 'inbox' ? 'Inbox' : folder.category.name;
  const showFolders = !folder && !q;
  const openCategoryLinks = folder?.kind === 'category' && !q ? shownLinks : [];

  const folderRow = (key: string, icon: React.ReactNode, name: string, count: number, next: Folder) => (
    <button key={key} type="button" onClick={() => setFolder(next)} className={rowButton} disabled={count === 0}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      <ChevronRight className="size-4 text-muted-foreground" />
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Share sites</DialogTitle>
          <DialogDescription>Everyone in the room will see them and can save them to their own links.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <Label className="text-[13px]">From your links</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all saved links"
              aria-label="Search all saved links"
              className="h-9 pl-9"
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            {folder && !q && (
              <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setFolder(null)}
                  className="flex h-7 items-center gap-0.5 rounded-md pl-1 pr-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ChevronLeft className="size-4" />
                  Categories
                </button>
                <span className="flex min-w-0 flex-1 items-center gap-1.5 text-[13px] font-medium">
                  {folder.kind === 'category' && (
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: folder.category.color }} />
                  )}
                  <span className="truncate">{folderTitle}</span>
                </span>
                {folder.kind === 'category' && openCategoryLinks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => finish(openCategoryLinks.slice(0, MAX_LINKS_PER_MESSAGE).map(toShared), folder.category.name)}
                    title="Send every site in this category; others can save it as a category"
                    className="flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <FolderUp className="size-3.5" />
                    Share whole category
                  </button>
                )}
              </div>
            )}

            <div className="custom-scrollbar h-64 space-y-0.5 overflow-y-auto p-1.5">
              {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}

              {!isLoading && showFolders && links.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">You have no saved links yet.</p>
              )}

              {!isLoading && showFolders && links.length > 0 && (
                <>
                  {folderRow('all', <LayoutGrid className="size-4" />, 'All links', links.length, { kind: 'all' })}
                  {(countIn.get(null) ?? 0) > 0 &&
                    folderRow('inbox', <Inbox className="size-4" />, 'Inbox', countIn.get(null) ?? 0, { kind: 'inbox' })}
                  {categories.map((category) =>
                    folderRow(
                      category.id,
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: category.color }} />,
                      category.name,
                      countIn.get(category.id) ?? 0,
                      { kind: 'category', category }
                    )
                  )}
                </>
              )}

              {!isLoading && !showFolders && shownLinks.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">{q ? 'No links match.' : 'Nothing here yet.'}</p>
              )}

              {!isLoading &&
                !showFolders &&
                shownLinks.map((link) => {
                  const isPicked = selected.has(link.url);
                  return (
                    <button
                      key={link.id}
                      type="button"
                      role="checkbox"
                      aria-checked={isPicked}
                      onClick={() => toggle(link)}
                      disabled={!isPicked && isFull}
                      className={`${rowButton} ${isPicked ? 'bg-primary/[0.07]' : ''}`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          isPicked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                        }`}
                        aria-hidden="true"
                      >
                        {isPicked && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <SiteIcon url={link.url} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{link.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{hostnameOf(link.url)}</span>
                      </span>
                      {/* While searching, say where each result lives. */}
                      {q && (
                        <span className="max-w-[35%] shrink-0 truncate text-[11px] text-muted-foreground">
                          {link.category_id ? categoryName.get(link.category_id) ?? '' : 'Inbox'}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
          {selected.size > 0 && (
            <p className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>
                {selected.size} selected{isFull ? ` (up to ${MAX_LINKS_PER_MESSAGE})` : ''}
              </span>
              <button type="button" onClick={() => setSelected(new Map())} className="underline-offset-2 hover:text-foreground hover:underline">
                Clear
              </button>
            </p>
          )}
        </div>

        <form
          className="space-y-2.5 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            attachPicked();
          }}
        >
          <Label htmlFor="share-address" className="text-[13px]">Or paste an address</Label>
          <div className="relative">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="share-address"
              type="url"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="https://example.com"
              className="pl-9"
            />
          </div>
          {normalizedAddress && (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              aria-label="Title"
              maxLength={200}
            />
          )}
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pickedCount === 0}>
              {pickedCount > 1 ? `Attach ${pickedCount} sites` : 'Attach'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

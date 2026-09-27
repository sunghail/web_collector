'use client';

import { useEffect, useMemo, useState } from 'react';
import { Link2, Search } from 'lucide-react';
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
import { hostnameOf, normalizeShareUrl } from '@/lib/chat';
import type { Link } from '@/types';

export interface SharedSite {
  url: string;
  title: string;
}

interface ShareSiteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (site: SharedSite) => void;
}

/** Pick one of your saved links, or paste any address, to attach to a message. */
export function ShareSiteDialog({ open, onOpenChange, onPick }: ShareSiteDialogProps) {
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [address, setAddress] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setAddress('');
    setTitle('');
    setIsLoading(true);
    api
      .get('/links')
      .then((response) => setLinks((response.data.links || []).filter((link: Link) => link.type !== 'macro')))
      .catch(() => setLinks([]))
      .finally(() => setIsLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return links;
    return links.filter((link) => link.title.toLowerCase().includes(q) || link.url.toLowerCase().includes(q));
  }, [links, query]);

  const normalizedAddress = normalizeShareUrl(address);

  const pick = (site: SharedSite) => {
    onPick(site);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Share a site</DialogTitle>
          <DialogDescription>Everyone in the room will see it and can save it to their own links.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <Label className="text-[13px]">From your links</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a saved link"
              aria-label="Find a saved link"
              className="h-9 pl-9"
            />
          </div>
          <div className="custom-scrollbar max-h-56 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
            {isLoading && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && filtered.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {links.length === 0 ? 'You have no saved links yet.' : 'No links match.'}
              </p>
            )}
            {!isLoading &&
              filtered.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => pick({ url: link.url, title: link.title })}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
                >
                  <SiteIcon url={link.url} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{link.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{hostnameOf(link.url)}</span>
                  </span>
                </button>
              ))}
          </div>
        </div>

        <form
          className="space-y-2.5 border-t border-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (normalizedAddress) pick({ url: normalizedAddress, title: title.trim() || hostnameOf(normalizedAddress) });
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
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            aria-label="Title"
            maxLength={200}
          />
          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!normalizedAddress}>
              Attach
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

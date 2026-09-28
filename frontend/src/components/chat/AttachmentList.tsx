'use client';

import { FolderOpen, X } from 'lucide-react';
import { LINK_MEMO_MAX_LENGTH, hostnameOf, type SharedLink } from '@/lib/chat';
import { SiteIcon } from './SiteIcon';

/**
 * Sites waiting to be sent with the next message. Each can get a short note ("what is this site?"),
 * which is shown with the site in the chat and in the Link history.
 */
export function AttachmentList({
  links,
  collectionName,
  onChange,
  onClearCollection,
}: {
  links: SharedLink[];
  collectionName: string | null;
  onChange: (links: SharedLink[]) => void;
  /** Stop sending these as a category (the sites stay attached). */
  onClearCollection: () => void;
}) {
  if (links.length === 0) return null;

  const update = (index: number, patch: Partial<SharedLink>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  return (
    <div className="mb-2 max-w-xl overflow-hidden rounded-xl border border-border bg-card font-sans shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
        {collectionName ? (
          <>
            <FolderOpen className="size-3.5 text-primary" />
            <span className="min-w-0 flex-1 truncate">
              Sharing the category <span className="font-semibold text-foreground">{collectionName}</span>
            </span>
            <button type="button" onClick={onClearCollection} className="shrink-0 underline-offset-2 hover:text-foreground hover:underline">
              Send as separate sites
            </button>
          </>
        ) : (
          <span className="flex-1">
            {links.length === 1 ? '1 site attached' : `${links.length} sites attached`} · add a note so people know what it is
          </span>
        )}
        <button
          type="button"
          onClick={() => onChange([])}
          aria-label="Remove all attached sites"
          title="Remove all"
          className="flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="custom-scrollbar max-h-60 divide-y divide-border overflow-y-auto">
        {links.map((link, index) => (
          <div key={link.url} className="flex items-start gap-3 p-2 pr-1.5">
            <SiteIcon url={link.url} />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{link.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{hostnameOf(link.url)}</span>
              </div>
              <input
                value={link.memo ?? ''}
                onChange={(e) => update(index, { memo: e.target.value })}
                maxLength={LINK_MEMO_MAX_LENGTH}
                placeholder="Add a note (optional)"
                aria-label={`Note for ${link.title}`}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
              />
            </div>
            <button
              type="button"
              onClick={() => onChange(links.filter((_, i) => i !== index))}
              aria-label={`Remove ${link.title}`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

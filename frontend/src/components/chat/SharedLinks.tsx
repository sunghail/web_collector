'use client';

import { useState } from 'react';
import { BookmarkPlus, ExternalLink, FolderDown, FolderOpen } from 'lucide-react';
import { hostnameOf, type SharedLink } from '@/lib/chat';
import { SiteIcon } from './SiteIcon';

const iconButton =
  'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';
const COLLAPSED_COUNT = 5;

function LinkRow({ link, canSave, onSave, compact }: { link: SharedLink; canSave: boolean; onSave: () => void; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${compact ? 'rounded-lg px-1.5 py-1.5 hover:bg-accent/50' : 'p-2.5 pr-2'}`}>
      <SiteIcon url={link.url} />
      <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" className="min-w-0 flex-1 outline-none focus-visible:underline">
        <span className="block truncate text-[13px] font-semibold">{link.title || hostnameOf(link.url)}</span>
        {/* Sites attached from a typed address are titled by their address; no need to repeat it. */}
        {link.title !== hostnameOf(link.url) && (
          <span className="block truncate text-xs text-muted-foreground">{hostnameOf(link.url)}</span>
        )}
        {link.memo && <span className="mt-1 block whitespace-pre-wrap break-words text-xs text-foreground/80">{link.memo}</span>}
      </a>
      <div className="flex shrink-0 items-center gap-0.5 self-start">
        {canSave && (
          <button type="button" onClick={onSave} title="Save to my links" aria-label={`Save ${link.title} to my links`} className={iconButton}>
            <BookmarkPlus className="size-4" />
          </button>
        )}
        <a href={link.url} target="_blank" rel="noopener noreferrer nofollow" title="Open" aria-label={`Open ${link.title}`} className={iconButton}>
          <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}

/**
 * Sites shared with a message: one card for a single site, or a list for several.
 * A shared category shows its name and a button to save it all as a category.
 */
export function SharedLinks({
  links,
  collectionName,
  canSave,
  onSave,
  onSaveAll,
}: {
  links: SharedLink[];
  collectionName: string | null;
  canSave: boolean;
  onSave: (link: SharedLink) => void;
  onSaveAll: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (links.length === 0) return null;

  if (links.length === 1 && !collectionName) {
    return (
      <div className="mt-1.5 max-w-md rounded-xl border border-border bg-card font-sans shadow-card">
        <LinkRow link={links[0]} canSave={canSave} onSave={() => onSave(links[0])} />
      </div>
    );
  }

  const shown = isExpanded ? links : links.slice(0, COLLAPSED_COUNT);
  return (
    <div className="mt-1.5 max-w-md overflow-hidden rounded-xl border border-border bg-card font-sans shadow-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {collectionName ? (
          <>
            <FolderOpen className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{collectionName}</span>
          </>
        ) : (
          <span className="flex-1 text-[13px] font-semibold">Shared sites</span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">{links.length} sites</span>
        {canSave && collectionName && (
          <button
            type="button"
            onClick={onSaveAll}
            title={`Save all as the category “${collectionName}”`}
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            <FolderDown className="size-3.5" />
            Save all
          </button>
        )}
      </div>
      <div className="p-1">
        {shown.map((link) => (
          <LinkRow key={link.url} link={link} canSave={canSave} onSave={() => onSave(link)} compact />
        ))}
      </div>
      {links.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full border-t border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          {isExpanded ? 'Show less' : `Show all ${links.length} sites`}
        </button>
      )}
    </div>
  );
}

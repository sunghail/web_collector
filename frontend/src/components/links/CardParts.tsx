'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getCardHeight, useCardPreferences } from '@/lib/cardPreferences';

// The sortable wrapper starts a keyboard drag on Enter/Space; keep those keys for the card's own action.
export function stopDragKeys(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.stopPropagation();
  }
}

/** Layout and hover settings, read once per card. */
export function useCardStyle() {
  const layout = useCardPreferences((s) => s.layout);
  const hoverEffect = useCardPreferences((s) => s.hoverEffect);
  const compactHeight = useCardPreferences((s) => s.compactHeight);
  const tileHeight = useCardPreferences((s) => s.tileHeight);
  const isTile = layout === 'tile';

  return {
    isTile,
    hoverEffect,
    height: getCardHeight({ layout, compactHeight, tileHeight, hoverEffect }),
    /** Class for the card title, so the title can turn blue on hover. */
    titleClass: hoverEffect === 'bar' || hoverEffect === 'title' ? 'group-hover:text-primary transition-colors' : '',
    /** Padding etc. for the clickable area inside the card. */
    bodyClass: isTile
      ? 'flex min-w-0 flex-1 flex-col justify-center gap-2.5 self-stretch rounded-xl px-4 py-3 text-left outline-none'
      : 'flex min-w-0 flex-1 items-center gap-3.5 self-stretch rounded-xl pl-4 pr-1 text-left outline-none',
  };
}

export function CardShell({ children }: { children: ReactNode }) {
  const { isTile, hoverEffect, height } = useCardStyle();

  return (
    <div
      style={{ height }}
      className={`
        group relative flex overflow-hidden rounded-xl border border-border bg-card shadow-card
        transition-[transform,box-shadow,border-color] duration-200
        has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring
        has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background
        ${isTile ? 'items-stretch' : 'items-center'}
        ${hoverEffect === 'lift' ? 'hover:-translate-y-px hover:border-foreground/20 hover:shadow-raised' : 'hover:shadow-raised'}
      `}
    >
      {children}
      {hoverEffect === 'bar' && (
        <span className="pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 origin-left scale-x-0 rounded-b-2xl bg-primary transition-transform duration-200 group-hover:scale-x-100" />
      )}
    </div>
  );
}

interface FaviconTileProps {
  src?: string;
  /** The image is already a full tile (fallback icons) and should fill the slot. */
  fill?: boolean;
  /** Bigger icon for the tile layout. */
  size?: 'sm' | 'lg';
  onError?: () => void;
}

export function FaviconTile({ src, fill, size = 'sm', onError }: FaviconTileProps) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-10 w-10 rounded-[10px]';
  const inner = size === 'lg' ? 'h-8 w-8' : 'h-7 w-7';

  if (!src) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center bg-muted`}>
        <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" />
        </svg>
      </span>
    );
  }

  if (fill) {
    return <img src={src} alt="" draggable={false} className={`${box} shrink-0`} />;
  }

  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden bg-white ring-1 ring-inset ring-black/[.06]`}>
      <img src={toFaviconProxy(src)} alt="" draggable={false} className={`${inner} object-contain`} onError={onError} />
    </span>
  );
}

// Google's favicon service shows a generic globe (with HTTP 404) for unknown sites, which the
// browser renders as a normal image. Route those URLs through /api/favicon so the 404 becomes
// an image error and the card can use its fallback icon.
function toFaviconProxy(src: string) {
  try {
    const url = new URL(src);
    if (url.hostname === 'www.google.com' && url.pathname === '/s2/favicons') {
      return `/api/favicon${url.search}`;
    }
  } catch {
    // Relative or data URL: use as is.
  }
  return src;
}

interface CardMenuProps {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Send the link to the community room or a chat. */
  onShare?: () => void;
}

export function CardMenu({ label, onEdit, onDelete, onShare }: CardMenuProps) {
  const { isTile } = useCardStyle();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          onKeyDown={stopDragKeys}
          className={`
            h-9 w-9 shrink-0 text-muted-foreground/70 hover:text-foreground group-hover:text-foreground
            data-[state=open]:bg-accent data-[state=open]:text-foreground
            ${isTile ? 'absolute top-1.5 right-1.5 z-10' : 'mr-1.5'}
          `}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round">
            <path d="M6 12h.01M12 12h.01M18 12h.01" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onShare && (
          <DropdownMenuItem onClick={onShare} className="cursor-pointer">
            <Send className="mr-2 size-4" />
            Share to chat
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

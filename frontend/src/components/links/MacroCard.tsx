'use client';

import { useState } from 'react';
import { Link as LinkType } from '@/types';
import { getFallbackFaviconDataUrl, normalizeFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { CardMenu, CardShell, FaviconTile, stopDragKeys, useCardStyle } from './CardParts';

interface MacroCardProps {
  link: LinkType;
  categoryDefaultFaviconId?: string | null;
  onEdit: (link: LinkType) => void;
  onDelete: (id: string) => void;
}

export function MacroCard({ link, categoryDefaultFaviconId, onEdit, onDelete }: MacroCardProps) {
  const [imageError, setImageError] = useState(false);
  const items = link.macro_items || [];
  const { isTile, titleClass, bodyClass } = useCardStyle();

  // Find the first item with a favicon for the main display
  const primaryFavicon = items.find(
    (item) => item.resolved_favicon || item.custom_favicon
  );
  const rawFaviconUrl = primaryFavicon?.resolved_favicon || primaryFavicon?.custom_favicon || null;
  const faviconUrl = normalizeFallbackFaviconDataUrl(rawFaviconUrl) || rawFaviconUrl;
  const fallbackFaviconUrl = getFallbackFaviconDataUrl(categoryDefaultFaviconId);

  const handleClick = () => {
    if (items.length === 0) return;

    const urls = items
      .map((item) => item.resolved_url || item.custom_url)
      .filter(Boolean) as string[];

    if (urls.length === 0) return;

    // Electron: use IPC to open all URLs reliably
    const electronAPI = (window as unknown as { electronAPI?: { openUrls?: (urls: string[]) => Promise<void> } }).electronAPI;
    if (electronAPI?.openUrls) {
      electronAPI.openUrls(urls);
      return;
    }

    // Browser: staggered open to avoid popup blocker
    window.open(urls[0], '_blank', 'noopener,noreferrer');
    urls.slice(1).forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      }, (index + 1) * 300);
    });
  };

  return (
    <CardShell>
      <button
        type="button"
        onClick={handleClick}
        onKeyDown={stopDragKeys}
        className={bodyClass}
      >
        {/* Favicon with count badge */}
        <span className={`relative shrink-0 ${isTile ? 'self-start' : ''}`}>
          {faviconUrl && !imageError ? (
            <FaviconTile src={faviconUrl} size={isTile ? 'lg' : 'sm'} onError={() => setImageError(true)} />
          ) : (
            <FaviconTile src={fallbackFaviconUrl} size={isTile ? 'lg' : 'sm'} fill />
          )}
          <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-card">
            {items.length}
          </span>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className={`truncate text-sm font-semibold text-card-foreground ${titleClass}`}>{link.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'site' : 'sites'} · opens together
          </span>
        </span>
      </button>
      <CardMenu label={`${link.title} menu`} onEdit={() => onEdit(link)} onDelete={() => onDelete(link.id)} />
    </CardShell>
  );
}

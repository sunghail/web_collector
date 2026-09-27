'use client';

import { useState } from 'react';
import { Link as LinkType } from '@/types';
import { getFallbackFaviconDataUrl, normalizeFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { CardMenu, CardShell, FaviconTile, stopDragKeys, useCardStyle } from './CardParts';

interface LinkCardProps {
  link: LinkType;
  categoryDefaultFaviconId?: string | null;
  onEdit: (link: LinkType) => void;
  onDelete: (id: string) => void;
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

export function LinkCard({ link, categoryDefaultFaviconId, onEdit, onDelete }: LinkCardProps) {
  const [imageError, setImageError] = useState(false);
  const { isTile, titleClass, bodyClass } = useCardStyle();

  const getFaviconUrl = (url: string) => {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
    } catch {
      return null;
    }
  };

  const showFavicon = link.show_favicon !== false;
  const linkFavicon = normalizeFallbackFaviconDataUrl(link.favicon) || link.favicon;
  const faviconUrl = showFavicon ? (linkFavicon || getFaviconUrl(link.url)) : null;
  const fallbackFaviconUrl = getFallbackFaviconDataUrl(categoryDefaultFaviconId);
  const hostname = getHostname(link.url);

  return (
    <CardShell>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onKeyDown={stopDragKeys}
        title={link.memo || undefined}
        className={bodyClass}
      >
        {faviconUrl && !imageError ? (
          <FaviconTile src={faviconUrl} size={isTile ? 'lg' : 'sm'} onError={() => setImageError(true)} />
        ) : showFavicon ? (
          <FaviconTile src={fallbackFaviconUrl} size={isTile ? 'lg' : 'sm'} fill />
        ) : (
          <FaviconTile size={isTile ? 'lg' : 'sm'} />
        )}
        <span className="flex min-w-0 flex-col gap-1">
          <span className={`truncate text-sm font-semibold text-card-foreground ${titleClass}`}>{link.title}</span>
          <span className="truncate text-xs text-muted-foreground">
            {link.memo ? `${link.memo} · ${hostname}` : hostname}
          </span>
        </span>
      </a>
      <CardMenu label={`${link.title} menu`} onEdit={() => onEdit(link)} onDelete={() => onDelete(link.id)} />
    </CardShell>
  );
}

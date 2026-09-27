'use client';

import { useState } from 'react';
import { FaviconTile } from '@/components/links/CardParts';
import { getFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { hostnameOf } from '@/lib/chat';

/** A site's favicon, falling back to the default bookmark icon when the site has none. */
export function SiteIcon({ url, size = 'sm' }: { url: string; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <FaviconTile src={getFallbackFaviconDataUrl(null)} size={size} fill />;
  }

  return (
    <FaviconTile
      src={`https://www.google.com/s2/favicons?domain=${hostnameOf(url)}&sz=64`}
      size={size}
      onError={() => setFailed(true)}
    />
  );
}

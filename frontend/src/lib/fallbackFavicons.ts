export const DEFAULT_FALLBACK_FAVICON_ID = 'bookmark-core';

export interface FallbackFavicon {
  id: string;
  name: string;
  accent: string;
  description: string;
  svg: string;
  /** Earlier designs, kept so data URLs already saved on links still resolve to this id. */
  legacySvgs?: string[];
}

export const fallbackFavicons: FallbackFavicon[] = [
  {
    id: 'bookmark-core',
    name: 'Bookmark Core',
    accent: '#0a84ff',
    description: 'Safe default for saved websites.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0A84FF"/><path d="M23 16h18a3 3 0 0 1 3 3v28l-12-8-12 8V19a3 3 0 0 1 3-3z" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#172033"/><path d="M20 16h24a4 4 0 0 1 4 4v31L32 42 16 51V20a4 4 0 0 1 4-4z" fill="#0a84ff"/><path d="M24 23h16M24 30h11" stroke="#eaf4ff" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'quiet-globe',
    name: 'Quiet Globe',
    accent: '#2fa84f',
    description: 'Generic web icon with a calm signal.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2FA84F"/><circle cx="32" cy="32" r="14" fill="none" stroke="#ffffff" stroke-width="4"/><ellipse cx="32" cy="32" rx="6" ry="14" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M18 32h28" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#14231a"/><circle cx="32" cy="32" r="19" fill="#34c759"/><path d="M13 32h38M32 13c7 7 7 31 0 38M32 13c-7 7-7 31 0 38" stroke="#092512" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'link-spark',
    name: 'Link Spark',
    accent: '#f76b15',
    description: 'For unknown links with energy.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F76B15"/><path d="M30 19h-8a3 3 0 0 0-3 3v20a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3v-8" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 17h11v11" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M47 17L31 33" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2a2112"/><path d="M41 19H29a3.5 3.5 0 0 0 0 7h3.55L21.5 37.05a3.54 3.54 0 0 0 5 5L37.55 31V34.5a3.5 3.5 0 0 0 7 0v-12A3.5 3.5 0 0 0 41 19z" fill="#ffb340"/><path d="M19 45h26" stroke="#fff1d8" stroke-width="5" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'soft-folder',
    name: 'Soft Folder',
    accent: '#ffc21a',
    description: 'Good for uncategorized local-like items.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#FFC21A"/><path d="M16 22a3 3 0 0 1 3-3h8.5l4 4H45a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3z" fill="#5A4300"/><path d="M16 29h32" stroke="#FFC21A" stroke-width="3"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2b250f"/><path d="M12 24a6 6 0 0 1 6-6h11l5 6h12a6 6 0 0 1 6 6v18H12V24z" fill="#ffd43b"/><path d="M12 30h40v16a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V30z" fill="#ffb340"/></svg>'],
  },
  {
    id: 'compass-dot',
    name: 'Compass Dot',
    accent: '#0b8fd9',
    description: 'Navigation metaphor for web shortcuts.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0B8FD9"/><circle cx="32" cy="32" r="14" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M38.5 25.5L35 35 25.5 38.5 29 29z" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#10242c"/><circle cx="32" cy="32" r="20" fill="#5ac8fa"/><path d="M39 18l-5 17-16 11 5-17 16-11z" fill="#083241"/><circle cx="32" cy="32" r="4" fill="#e9fbff"/></svg>'],
  },
  {
    id: 'stacked-pages',
    name: 'Stacked Pages',
    accent: '#9b51e0',
    description: 'Feels like collected resources.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#9B51E0"/><rect x="25" y="15" width="21" height="26" rx="3.5" fill="none" stroke="#ffffff" stroke-width="4" opacity=".55"/><rect x="18" y="22" width="21" height="27" rx="3.5" fill="#ffffff"/><path d="M23.5 31h10M23.5 37h6.5" stroke="#9B51E0" stroke-width="3" stroke-linecap="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#24142d"/><rect x="18" y="14" width="30" height="38" rx="6" fill="#6d2e8f"/><rect x="14" y="18" width="30" height="38" rx="6" fill="#af52de"/><path d="M22 29h14M22 37h10" stroke="#f8e7ff" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'pinboard',
    name: 'Pinboard',
    accent: '#e5364e',
    description: 'Bookmark as pinned reference.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#E5364E"/><path d="M25 17h14" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 17h8v9l6 7H22l6-7z" fill="#ffffff"/><path d="M32 33v14" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2b1218"/><path d="M22 16h20l-4 17 9 9-15 3-15-3 9-9-4-17z" fill="#ff2d55"/><path d="M32 44v9" stroke="#ffd9e1" stroke-width="5" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'tiny-window',
    name: 'Tiny Window',
    accent: '#556070',
    description: 'Neutral app/window fallback.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#556070"/><rect x="16" y="19" width="32" height="26" rx="4" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M16 27.5h32" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="21.5" cy="23.3" r="1.6" fill="#ffffff"/><circle cx="26.5" cy="23.3" r="1.6" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#202124"/><rect x="14" y="18" width="36" height="30" rx="6" fill="#8e8e93"/><circle cx="21" cy="25" r="2.5" fill="#ff453a"/><circle cx="29" cy="25" r="2.5" fill="#ffcc00"/><circle cx="37" cy="25" r="2.5" fill="#34c759"/><path d="M20 35h24" stroke="#f2f2f7" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'north-star',
    name: 'North Star',
    accent: '#1d2433',
    description: 'Minimal, clear, high-contrast.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1D2433"/><path d="M32 14c1.6 9.5 7.8 15.9 17 18-9.2 2.1-15.4 8.5-17 18-1.6-9.5-7.8-15.9-17-18 9.2-2.1 15.4-8.5 17-18z" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1f2023"/><path d="M32 10l6 16 16 6-16 6-6 16-6-16-16-6 16-6 6-16z" fill="#ffffff"/><circle cx="32" cy="32" r="5" fill="#0a84ff"/></svg>'],
  },
  {
    id: 'collector-grid',
    name: 'Collector Grid',
    accent: '#0fa89a',
    description: 'Collection system identity.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0FA89A"/><rect x="18" y="18" width="12" height="12" rx="3.5" fill="#ffffff"/><rect x="34" y="18" width="12" height="12" rx="3.5" fill="#ffffff"/><rect x="18" y="34" width="12" height="12" rx="3.5" fill="#ffffff"/><rect x="34" y="34" width="12" height="12" rx="3.5" fill="#ffffff" opacity=".55"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#112725"/><g fill="#00c7be"><rect x="16" y="16" width="13" height="13" rx="4"/><rect x="35" y="16" width="13" height="13" rx="4"/><rect x="16" y="35" width="13" height="13" rx="4"/><rect x="35" y="35" width="13" height="13" rx="4"/></g></svg>'],
  },
  {
    id: 'paper-plane',
    name: 'Paper Plane',
    accent: '#4f6bf5',
    description: 'Open and go quickly.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#4F6BF5"/><path d="M46 18L17 30.5l11.5 5 5 11.5z" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 18L28.5 35.5" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#10212d"/><path d="M12 30l40-16-16 40-7-17-17-7z" fill="#64d2ff"/><path d="M29 37l23-23" stroke="#073246" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'command-tile',
    name: 'Command Tile',
    accent: '#1b1f24',
    description: 'Useful for tool/developer links.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#1B1F24"/><path d="M20 25l7 7-7 7" fill="none" stroke="#3DDC84" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 40h12" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#121f16"/><rect x="14" y="18" width="36" height="28" rx="7" fill="#30d158"/><path d="M22 28l6 4-6 4M33 38h10" stroke="#082312" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
  },
  {
    id: 'archive-box',
    name: 'Archive Box',
    accent: '#9c7a54',
    description: 'Warm, quiet fallback for saved items.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#9C7A54"/><rect x="16" y="18" width="32" height="9" rx="2.5" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M19 27v15a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3V27" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M28 34h8" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2a2119"/><path d="M15 24h34v24a6 6 0 0 1-6 6H21a6 6 0 0 1-6-6V24z" fill="#ac8e68"/><path d="M12 17h40v11H12z" fill="#d2ad7f"/><path d="M26 34h12" stroke="#fff3df" stroke-width="4" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'pulse-bolt',
    name: 'Pulse Bolt',
    accent: '#ff9f0a',
    description: 'Clear signal when favicon is missing.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#FF9F0A"/><path d="M35.5 14L19.5 35H31l-2.5 15L44.5 29H33z" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#291b0b"/><path d="M36 8L16 35h15l-3 21 20-28H34l2-20z" fill="#ff9500"/></svg>'],
  },
  {
    id: 'layered-ring',
    name: 'Layered Ring',
    accent: '#5856d6',
    description: 'Abstract, polished, app-like.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#5856D6"/><circle cx="27" cy="32" r="10" fill="none" stroke="#ffffff" stroke-width="4"/><circle cx="37" cy="32" r="10" fill="none" stroke="#ffffff" stroke-width="4" opacity=".55"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#171737"/><circle cx="28" cy="28" r="15" fill="#5856d6"/><circle cx="38" cy="36" r="15" fill="#7d7aff" fill-opacity=".72"/><circle cx="33" cy="32" r="8" fill="#f3f2ff"/></svg>'],
  },
  {
    id: 'search-lens',
    name: 'Search Lens',
    accent: '#06a3c4',
    description: 'Good for unknown web destinations.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#06A3C4"/><circle cx="29" cy="29" r="10" fill="none" stroke="#ffffff" stroke-width="4"/><path d="M36.5 36.5L46 46" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#11262b"/><circle cx="29" cy="29" r="14" fill="none" stroke="#40c8e0" stroke-width="8"/><path d="M40 40l10 10" stroke="#e8fbff" stroke-width="7" stroke-linecap="round"/></svg>'],
  },
  {
    id: 'route-flag',
    name: 'Route Flag',
    accent: '#f25c54',
    description: 'Shortcut destination marker.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#F25C54"/><path d="M21 47V17" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 17h21l-5 7.5 5 7.5H22z" fill="#ffffff"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2b1515"/><path d="M20 52V13" stroke="#ffdede" stroke-width="6" stroke-linecap="round"/><path d="M23 14h25l-6 10 6 10H23V14z" fill="#ff6b6b"/></svg>'],
  },
  {
    id: 'clean-w',
    name: 'Clean W',
    accent: '#0a64d6',
    description: 'Brand-leaning Web Collector fallback.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0A64D6"/><path d="M17 22l6.5 20L32 28l8.5 14L47 22" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#121f31"/><path d="M14 20l8 26 10-18 10 18 8-26" fill="none" stroke="#0a84ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
  },
  {
    id: 'gem-link',
    name: 'Gem Link',
    accent: '#c443e0',
    description: 'Premium-looking unknown site icon.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#C443E0"/><path d="M24.5 18h15l7.5 9.5L32 46 17 27.5z" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.5 27.5h29" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 27.5L32 46l5-18.5" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#25142f"/><path d="M20 14h24l10 14-22 24-22-24 10-14z" fill="#bf5af2"/><path d="M20 14l12 38 12-38M10 28h44" stroke="#f7e6ff" stroke-width="3" stroke-linejoin="round"/></svg>'],
  },
  {
    id: 'quiet-initial',
    name: 'Quiet Initial',
    accent: '#80848e',
    description: 'Simple letter-style placeholder.',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#80848E"/><path d="M22 46l10-28 10 28" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M25.8 36h12.4" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    legacySvgs: ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#242529"/><circle cx="32" cy="32" r="20" fill="#3a3b40"/><path d="M21 23l5 18 6-12 6 12 5-18" fill="none" stroke="#f5f5f7" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>'],
  },
];

const dataUrlCache = new Map<string, string>();
const legacyDataUrlCache = new Map<string, string[]>();

const lightDetailColors = [
  '#ffffff',
  '#fff',
  '#eaf4ff',
  '#fff1d8',
  '#f8e7ff',
  '#ffd9e1',
  '#f2f2f7',
  '#e9fbff',
  '#fff3df',
  '#e8fbff',
  '#ffdede',
  '#f5f5f7',
  '#f7e6ff',
];

function replaceSvgColor(svg: string, from: string, to: string) {
  return svg.split(from).join(to);
}

// Earlier designs were shown recolored onto a white tile; saved links may hold either variant.
function getLegacyLightBackgroundSvg(svg: string) {
  let normalized = svg;

  for (const color of [...lightDetailColors].sort((a, b) => b.length - a.length)) {
    normalized = replaceSvgColor(normalized, color, '#1f2937');
  }

  normalized = normalized.replace(
    /(<rect width="64" height="64" rx="16" fill=")[^"]+("\/>)/,
    '$1#ffffff$2'
  );

  return normalized;
}

function getSvgDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getFallbackFavicon(id?: string | null): FallbackFavicon {
  return (
    fallbackFavicons.find((favicon) => favicon.id === id) ||
    fallbackFavicons.find((favicon) => favicon.id === DEFAULT_FALLBACK_FAVICON_ID) ||
    fallbackFavicons[0]
  );
}

export function isFallbackFaviconId(id: unknown): id is string {
  return typeof id === 'string' && fallbackFavicons.some((favicon) => favicon.id === id);
}

export function normalizeFallbackFaviconId(id: unknown): string | null {
  return isFallbackFaviconId(id) ? id : null;
}

export function getFallbackFaviconDataUrl(id?: string | null): string {
  const favicon = getFallbackFavicon(id);
  const cached = dataUrlCache.get(favicon.id);
  if (cached) return cached;

  const dataUrl = getSvgDataUrl(favicon.svg);
  dataUrlCache.set(favicon.id, dataUrl);
  return dataUrl;
}

function getLegacyFallbackFaviconDataUrls(favicon: FallbackFavicon): string[] {
  const cached = legacyDataUrlCache.get(favicon.id);
  if (cached) return cached;

  const dataUrls = (favicon.legacySvgs ?? []).flatMap((svg) => [
    getSvgDataUrl(getLegacyLightBackgroundSvg(svg)),
    getSvgDataUrl(svg),
  ]);
  legacyDataUrlCache.set(favicon.id, dataUrls);
  return dataUrls;
}

export function getFallbackFaviconIdFromDataUrl(dataUrl?: string | null): string | null {
  if (!dataUrl?.startsWith('data:image/svg+xml')) {
    return null;
  }

  return (
    fallbackFavicons.find((favicon) => {
      return (
        getFallbackFaviconDataUrl(favicon.id) === dataUrl ||
        getLegacyFallbackFaviconDataUrls(favicon).includes(dataUrl)
      );
    })?.id ||
    null
  );
}

export function normalizeFallbackFaviconDataUrl(dataUrl: unknown): string | undefined {
  if (typeof dataUrl !== 'string') {
    return undefined;
  }

  const fallbackId = getFallbackFaviconIdFromDataUrl(dataUrl);

  return fallbackId ? getFallbackFaviconDataUrl(fallbackId) : undefined;
}

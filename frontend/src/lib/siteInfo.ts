// Server only: reads a web page's title so shared and saved sites show "Notion – Templates" instead of "notion.so".
//
// The server fetches addresses that people type, so it must not be usable to reach private networks
// (cloud metadata services, databases, the machine itself). Every address, including each redirect,
// is resolved first and refused if any of its IPs is private; only ports 80 and 443 are allowed,
// and the page is read for a few seconds and a few hundred kilobytes at most.
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 4000;
const MAX_BYTES = 300_000;
const MAX_REDIRECTS = 3;
const TITLE_MAX_LENGTH = 200;
const CACHE_LIMIT = 500;
const CACHE_MS = 60 * 60 * 1000;

export interface SiteInfo {
  title: string | null;
  siteName: string | null;
}

const cache = new Map<string, { info: SiteInfo; at: number }>();

function ipv4ToNumber(ip: string) {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0);
}

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function isPrivateV4(ip: string) {
  const n = ipv4ToNumber(ip);
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((n & mask) >>> 0) === ((ipv4ToNumber(base) & mask) >>> 0);
  });
}

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 4) return isPrivateV4(ip);
  const lower = ip.toLowerCase();
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateV4(mapped[1]);
  return (
    lower === '::' ||
    lower === '::1' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    /^fe[89ab]/.test(lower) ||
    lower.startsWith('ff') ||
    lower.startsWith('64:ff9b:') ||
    lower.startsWith('2001:db8')
  );
}

/** True when the address is a public web page we may fetch. */
async function isFetchable(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (url.port && url.port !== '80' && url.port !== '443') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return false;
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((entry) => !isPrivateAddress(entry.address));
  } catch {
    return false;
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(text: string) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (whole, code: string) => {
    const lower = code.toLowerCase();
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16));
    if (lower.startsWith('#')) return String.fromCodePoint(Number(lower.slice(1)));
    return ENTITIES[lower] ?? whole;
  });
}

function clean(text: string | undefined | null) {
  if (!text) return null;
  const value = decodeEntities(text).replace(/\s+/g, ' ').trim();
  return value ? value.slice(0, TITLE_MAX_LENGTH) : null;
}

/** <meta property="og:title" content="…"> in either attribute order. */
function metaContent(html: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`,
      'i'
    );
    const match = html.match(pattern);
    if (match) return match[1] ?? match[2];
  }
  return null;
}

function charsetOf(contentType: string | null, head: string) {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  return (fromHeader || fromMeta || 'utf-8').toLowerCase();
}

async function readLimited(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => undefined);
  const bytes = new Uint8Array(Math.min(size, MAX_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const part = chunk.subarray(0, Math.min(chunk.length, bytes.length - offset));
    bytes.set(part, offset);
    offset += part.length;
    if (offset >= bytes.length) break;
  }
  return bytes;
}

async function fetchInfo(address: string): Promise<SiteInfo> {
  const empty: SiteInfo = { title: null, siteName: null };
  let url = new URL(address);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isFetchable(url))) return empty;
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WebCollector/2.0; +https://web-collector.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko,en;q=0.8',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      await response.body?.cancel().catch(() => undefined);
      if (!location) return empty;
      url = new URL(location, url);
      continue;
    }
    const contentType = response.headers.get('content-type');
    if (!response.ok || !contentType?.includes('html')) {
      await response.body?.cancel().catch(() => undefined);
      return empty;
    }
    const bytes = await readLimited(response);
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
    let html: string;
    try {
      html = new TextDecoder(charsetOf(contentType, head)).decode(bytes);
    } catch {
      html = new TextDecoder().decode(bytes);
    }
    const title =
      clean(metaContent(html, ['og:title', 'twitter:title'])) ?? clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    return { title, siteName: clean(metaContent(html, ['og:site_name'])) };
  }
  return empty;
}

/** The page's title and site name, or nulls when it cannot be read. Never throws. */
export async function getSiteInfo(address: string): Promise<SiteInfo> {
  const cached = cache.get(address);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.info;
  let info: SiteInfo;
  try {
    info = await fetchInfo(address);
  } catch {
    info = { title: null, siteName: null };
  }
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(address, { info, at: Date.now() });
  return info;
}

/** Gives sites still titled by their bare address a real page title, within a time budget. */
export async function withPageTitles<T extends { url: string; title: string }>(links: T[], budgetMs = 2500): Promise<T[]> {
  const bare = (link: T) => {
    try {
      return link.title === new URL(link.url).hostname.replace(/^www\./, '');
    } catch {
      return false;
    }
  };
  if (!links.some(bare)) return links;
  const titled = Promise.all(
    links.map(async (link) => {
      if (!bare(link)) return link;
      const { title } = await getSiteInfo(link.url);
      return title ? { ...link, title } : link;
    })
  );
  const timeout = new Promise<T[]>((resolve) => setTimeout(() => resolve(links), budgetMs));
  return Promise.race([titled, timeout]);
}

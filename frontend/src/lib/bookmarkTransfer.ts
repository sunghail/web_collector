import { Category, Link } from '@/types';

export interface BookmarkExportPayload {
  app: 'web-collector';
  version: 1;
  exportedAt: string;
  categories: Pick<Category, 'id' | 'name' | 'color' | 'default_favicon_id' | 'order_index'>[];
  links: Link[];
}

export interface ParsedBookmarkLink {
  title: string;
  url: string;
  categoryName?: string | null;
  memo?: string | null;
  favicon?: string | null;
  showFavicon?: boolean;
  type?: Link['type'];
  macroItems?: Array<{
    sourceLinkId?: string | null;
    custom_url?: string | null;
    custom_title?: string | null;
    order_index: number;
  }>;
  sourceId?: string;
}

export interface ParsedBookmarks {
  categories: Array<{
    sourceId?: string;
    name: string;
    color?: string;
    defaultFaviconId?: string | null;
    orderIndex?: number;
  }>;
  links: ParsedBookmarkLink[];
}

export function createBookmarkExportPayload(categories: Category[], links: Link[]): BookmarkExportPayload {
  return {
    app: 'web-collector',
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
      default_favicon_id: category.default_favicon_id,
      order_index: category.order_index,
    })),
    links,
  };
}

export function parseBookmarkImport(text: string, fileName: string): ParsedBookmarks {
  const trimmed = text.trim();
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.json') || trimmed.startsWith('{')) {
    return parseJsonImport(trimmed);
  }

  return parseHtmlBookmarkImport(text);
}

function parseJsonImport(text: string): ParsedBookmarks {
  const payload = JSON.parse(text) as Partial<BookmarkExportPayload>;
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  const links = Array.isArray(payload.links) ? payload.links : [];

  const categoryNameById = new Map<string, string>();
  const parsedCategories = categories
    .filter((category) => typeof category.name === 'string' && category.name.trim())
    .map((category) => {
      categoryNameById.set(category.id, category.name.trim());
      return {
        sourceId: category.id,
        name: category.name.trim(),
        color: category.color,
        defaultFaviconId: category.default_favicon_id,
        orderIndex: category.order_index,
      };
    });

  const parsedLinks = links
    .filter((link) => typeof link.url === 'string' && link.url.trim())
    .map((link) => ({
      title: link.title || link.url,
      url: link.url,
      categoryName: link.category_id ? categoryNameById.get(link.category_id) || null : null,
      memo: link.memo,
      favicon: link.favicon,
      showFavicon: link.show_favicon,
      type: link.type || 'link',
      macroItems: (link.macro_items || []).map((item, index) => ({
        sourceLinkId: item.link_id,
        custom_url: item.custom_url || item.resolved_url || null,
        custom_title: item.custom_title || item.resolved_title || null,
        order_index: item.order_index ?? index,
      })),
      sourceId: link.id,
    }));

  return { categories: parsedCategories, links: parsedLinks };
}

function parseHtmlBookmarkImport(text: string): ParsedBookmarks {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const links: ParsedBookmarkLink[] = [];
  const categories = new Map<string, { name: string }>();

  doc.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href')?.trim();
    if (!href) return;

    const categoryName = findBookmarkFolderName(anchor);
    if (categoryName) {
      categories.set(categoryName.toLowerCase(), { name: categoryName });
    }

    links.push({
      title: anchor.textContent?.trim() || href,
      url: href,
      categoryName,
      type: 'link',
    });
  });

  return {
    categories: Array.from(categories.values()),
    links,
  };
}

function findBookmarkFolderName(anchor: HTMLAnchorElement): string | null {
  let node: Element | null = anchor.parentElement;

  while (node) {
    const previousHeading = findPreviousHeading(node);
    if (previousHeading) {
      const name = previousHeading.textContent?.trim();
      if (name) return name;
    }
    node = node.parentElement;
  }

  return null;
}

function findPreviousHeading(node: Element): HTMLHeadingElement | null {
  let previous = node.previousElementSibling;

  while (previous) {
    if (/^H[1-6]$/.test(previous.tagName)) {
      return previous as HTMLHeadingElement;
    }
    previous = previous.previousElementSibling;
  }

  return null;
}

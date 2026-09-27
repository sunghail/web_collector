export const INBOX_CATEGORY_ID = '__inbox__';

export function normalizeUrlForDuplicate(input: string): string {
  const value = input.trim();

  if (!value) return '';

  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();

    if (
      (url.protocol === 'http:' && url.port === '80') ||
      (url.protocol === 'https:' && url.port === '443')
    ) {
      url.port = '';
    }

    if (url.pathname === '/') {
      url.pathname = '';
    }

    const params = Array.from(url.searchParams.entries()).sort(([a], [b]) => a.localeCompare(b));
    url.search = '';
    params.forEach(([key, val]) => url.searchParams.append(key, val));

    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.replace(/\/$/, '').toLowerCase();
  }
}

export function isInboxCategoryId(categoryId: string | null | undefined): boolean {
  return categoryId === INBOX_CATEGORY_ID;
}

export function toStoredCategoryId(categoryId: string | null | undefined): string | null {
  if (!categoryId || isInboxCategoryId(categoryId)) return null;
  return categoryId;
}

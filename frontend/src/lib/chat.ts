// Shared by the browser and the API routes: message shapes and input rules for every chat.

export interface ChatMessage {
  id: string;
  /** Null for system notes ("@a added @b"), or when the author deleted their account. */
  userId: string | null;
  /** The author's public @ID. Login usernames are never sent to other people. */
  authorHandle: string;
  kind: 'user' | 'system';
  body: string;
  /** Sites shared with the message, in order, each with the sharer's optional note. */
  links: SharedLink[];
  /** Set when a whole category was shared, so others can save it as a category. */
  collectionName: string | null;
  createdAt: string;
  /** Emoji reactions, in the order each emoji was first used. Empty for system notes. */
  reactions: Reaction[];
}

export interface SharedLink {
  url: string;
  title: string;
  memo: string | null;
}

/** One site in the Link history screen. */
export interface LinkHistoryItem {
  id: string;
  url: string;
  title: string;
  memo: string | null;
  sharedBy: string;
  sharedAt: string;
  messageId: string;
  /** Where it was shared: the community room, or a chat room you are in. */
  place: { kind: 'community' } | { kind: 'room'; roomId: string; title: string };
  collectionName: string | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  /** Whether the person viewing reacted with this emoji. */
  mine: boolean;
  /** @IDs of everyone who reacted, for the tooltip. */
  handles: string[];
}

/** Shown when pointing at a message. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/** Behind the + button. */
export const MORE_REACTIONS: { label: string; emojis: string[] }[] = [
  { label: 'Reactions', emojis: ['👏', '🎉', '🔥', '💯', '✨', '😍'] },
  { label: 'Check & opinion', emojis: ['✅', '👀', '🤔', '👌', '🙌', '💡'] },
  { label: 'For links', emojis: ['🔖', '📌', '🚀', '⭐'] },
];

const ALLOWED_REACTIONS = new Set([...QUICK_REACTIONS, ...MORE_REACTIONS.flatMap((group) => group.emojis)]);

export function isAllowedReaction(value: unknown): value is string {
  return typeof value === 'string' && ALLOWED_REACTIONS.has(value);
}

export interface Person {
  id: string;
  handle: string;
}

export interface FriendRequest {
  id: string;
  person: Person;
  createdAt: string;
}

export interface RoomSummary {
  id: string;
  /** Group name, or the other person's @ID for a direct chat. */
  title: string;
  isDirect: boolean;
  memberCount: number;
  lastMessage: { authorHandle: string; body: string; hasLink: boolean; kind: 'user' | 'system' } | null;
  lastMessageAt: string;
  unread: number;
}

export interface RoomDetail {
  id: string;
  title: string;
  name: string | null;
  isDirect: boolean;
  ownerId: string | null;
  members: (Person & { role: 'owner' | 'member' })[];
}

export const MESSAGE_MAX_LENGTH = 1000;
export const LINK_TITLE_MAX_LENGTH = 200;
export const LINK_MEMO_MAX_LENGTH = 300;
export const COLLECTION_NAME_MAX_LENGTH = 50;
export const MAX_LINKS_PER_MESSAGE = 30;
export const ROOM_NAME_MAX_LENGTH = 50;
export const HANDLE_PATTERN = /^[a-z0-9_.]{3,20}$/;

/** "@Minji " -> "minji". */
export function normalizeHandle(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/^@+/, '').toLowerCase() : '';
}

/** Only plain web addresses may be shared. Returns the normalized URL, or null. */
export function normalizeShareUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Web addresses written in message text: "https://…", "http://…" or "www.…".
export const ADDRESS_PATTERN = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
// Punctuation right after an address usually ends the sentence, not the address.
const TRAILING_PUNCTUATION = /[.,!?;:'")\]}]+$/;

/** One address as written in text: the address itself, punctuation after it, and a safe link (or null). */
export function readAddress(written: string) {
  const trailing = written.match(TRAILING_PUNCTUATION)?.[0] ?? '';
  const address = trailing ? written.slice(0, -trailing.length) : written;
  const href = normalizeShareUrl(/^www\./i.test(address) ? `https://${address}` : address);
  return { address, trailing, href };
}

/** The web addresses in a message, as safe links, each once and in order. */
export function findAddresses(text: string): string[] {
  const found: string[] = [];
  for (const match of text.match(ADDRESS_PATTERN) ?? []) {
    const { href } = readAddress(match);
    if (href && !found.includes(href)) found.push(href);
  }
  return found;
}

/** True when the text is nothing but web addresses (and spaces), so it can be sent as site cards alone. */
export function isOnlyAddresses(text: string) {
  return text.trim().length > 0 && text.replace(ADDRESS_PATTERN, '').trim().length === 0 && findAddresses(text).length > 0;
}

/**
 * What to send. Addresses written in the text also go along as site cards; text that is nothing but
 * addresses is sent as the cards alone. Notes are trimmed, and a shared category stays a category
 * only when nothing else was added to it.
 */
export function composeMessage(text: string, attached: SharedLink[], collectionName: string | null) {
  const body = text.trim();
  const known = new Set(attached.map((link) => link.url));
  const fromText: SharedLink[] = findAddresses(body)
    .filter((url) => !known.has(url))
    .map((url) => ({ url, title: hostnameOf(url), memo: null }));
  const links = [...attached, ...fromText]
    .slice(0, MAX_LINKS_PER_MESSAGE)
    .map((link) => ({ ...link, memo: link.memo?.trim() || null }));
  return {
    body: isOnlyAddresses(body) ? '' : body,
    links,
    collectionName: links.length > 0 && fromText.length === 0 ? collectionName : null,
  };
}

// Shared by the browser and the API routes: message shapes and input rules for every chat.

export interface ChatMessage {
  id: string;
  /** Null for system notes ("@a added @b"), or when the author deleted their account. */
  userId: string | null;
  /** The author's public @ID. Login usernames are never sent to other people. */
  authorHandle: string;
  kind: 'user' | 'system';
  body: string;
  linkUrl: string | null;
  linkTitle: string | null;
  createdAt: string;
  /** Emoji reactions, in the order each emoji was first used. Empty for system notes. */
  reactions: Reaction[];
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

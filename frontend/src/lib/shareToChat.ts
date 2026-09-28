import { create } from 'zustand';
import type { SharedLink } from '@/lib/chat';

/**
 * What to share from outside a chat: some links (e.g. from a link card's menu),
 * or a whole category, sent as a collection others can save as a category.
 */
export type ShareRequest =
  | { kind: 'links'; links: SharedLink[] }
  | { kind: 'category'; categoryId: string; name: string };

interface ShareToChatState {
  request: ShareRequest | null;
  open: (request: ShareRequest) => void;
  close: () => void;
}

/** Opens the "Share to chat" dialog from anywhere (it is mounted once, on the dashboard). */
export const useShareToChat = create<ShareToChatState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

/** Where a message goes: the community room, or one of your chat rooms. */
export type ChatPlace = { kind: 'community' } | { kind: 'room'; roomId: string };

export function messagesEndpoint(place: ChatPlace) {
  return place.kind === 'community' ? '/community/messages' : `/rooms/${place.roomId}/messages`;
}

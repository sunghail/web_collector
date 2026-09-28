'use client';

import { useEffect, useRef } from 'react';
import type { Person, RoomSummary } from '@/lib/chat';
import type { ChatPlace } from '@/lib/shareToChat';
import { notificationPermission, useNotificationPreferences } from '@/lib/notificationPreferences';

export interface SummaryRoom {
  id: string;
  title: string;
  isDirect: boolean;
  unread: number;
  lastMessage: RoomSummary['lastMessage'];
  lastMessageAt: string;
  person: Person | null;
  hasUnseenMention: boolean;
}

export interface MentionNotice {
  messageId: string;
  authorHandle: string;
  authorName: string | null;
  authorEmoji: string | null;
  snippet: string;
  createdAt: string;
}

/** What GET /api/social/summary returns. */
export interface SocialSummary {
  pendingRequests: number;
  unreadMessages: number;
  mentions?: { community: number; rooms: number };
  rooms?: SummaryRoom[];
  communityMention?: MentionNotice | null;
}

interface Where {
  view: string;
  activeRoomId: string | null;
  /** Opens the chat a notification is about. */
  onOpen: (place: ChatPlace, messageId?: string | null) => void;
}

interface Snapshot {
  rooms: Map<string, { unread: number; at: string }>;
  communityMentionId: string | null;
}

/** Brings the app to the front: the desktop app's window may be hidden in the tray. */
function bringToFront() {
  window.focus();
  window.electronAPI?.showMainWindow?.();
}

/**
 * Shows a system notification for each new message that arrived since the last summary
 * (one per chat), following the notification settings. Nothing is shown for the first summary,
 * or for the chat that is open on screen right now.
 */
export function useMessageNotifications(summary: SocialSummary | null, where: Where) {
  const hydrate = useNotificationPreferences((state) => state.hydrate);
  const previous = useRef<Snapshot | null>(null);
  const whereRef = useRef(where);
  whereRef.current = where;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!summary?.rooms) return;
    const before = previous.current;
    previous.current = {
      rooms: new Map(summary.rooms.map((room) => [room.id, { unread: room.unread, at: room.lastMessageAt }])),
      communityMentionId: summary.communityMention?.messageId ?? null,
    };
    // The first summary only sets the starting point: no pop-ups for messages from before.
    if (!before) return;

    const prefs = useNotificationPreferences.getState();
    if (!prefs.enabled || notificationPermission() !== 'granted') return;

    const { view, activeRoomId, onOpen } = whereRef.current;
    const onScreen = document.visibilityState === 'visible' && document.hasFocus();
    const show = (title: string, body: string, tag: string, open: () => void) => {
      try {
        const notification = new Notification(title, { body, tag, icon: '/icon.png', silent: !prefs.sound });
        notification.onclick = () => {
          bringToFront();
          open();
          notification.close();
        };
      } catch {
        // Some browsers only allow notifications from a service worker; skip quietly there.
      }
    };

    for (const room of summary.rooms) {
      const old = before.rooms.get(room.id);
      const added = room.unread - (old?.unread ?? 0);
      if (added <= 0 || room.lastMessageAt === old?.at || room.lastMessage?.kind !== 'user') continue;
      const wanted = room.isDirect ? prefs.direct : prefs.groups || (prefs.mentions && room.hasUnseenMention);
      if (!wanted) continue;
      if (onScreen && view === 'chats' && activeRoomId === room.id) continue;

      const last = room.lastMessage;
      const text = last.body || (last.hasLink ? 'Shared a site' : 'New message');
      const more = added > 1 ? ` (+${added - 1} more)` : '';
      const who = room.person?.name || `@${room.title}`;
      const title = room.isDirect
        ? `${room.person?.emoji ? `${room.person.emoji} ` : ''}${who}${more}`
        : `${room.title}${room.hasUnseenMention ? ' · mentioned you' : ''}${more}`;
      const body = !prefs.preview ? 'New message' : room.isDirect ? text : `${last.authorHandle}: ${text}`;
      show(title, body, `room-${room.id}`, () => onOpen({ kind: 'room', roomId: room.id }));
    }

    const mention = summary.communityMention;
    if (mention && mention.messageId !== before.communityMentionId && prefs.mentions && !(onScreen && view === 'community')) {
      const who = mention.authorName || `@${mention.authorHandle}`;
      show(
        `${mention.authorEmoji ? `${mention.authorEmoji} ` : ''}${who} mentioned you in Community`,
        prefs.preview ? mention.snippet || 'New message' : 'New message',
        `community-${mention.messageId}`,
        () => onOpen({ kind: 'community' }, mention.messageId)
      );
    }
  }, [summary]);
}

/** A sample notification from the settings screen. */
export function showTestNotification(sound: boolean) {
  try {
    const notification = new Notification('🦊 Minji', {
      body: 'This is how new messages will look.',
      tag: 'web-collector-test',
      icon: '/icon.png',
      silent: !sound,
    });
    notification.onclick = () => {
      bringToFront();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

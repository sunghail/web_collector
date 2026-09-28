'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, CornerUpLeft, Link2, SendHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import {
  MAX_LINKS_PER_MESSAGE,
  MESSAGE_MAX_LENGTH,
  composeMessage,
  hostnameOf,
  normalizeShareUrl,
  type ChatMessage,
  type Person,
  type Reaction,
  type SharedLink,
} from '@/lib/chat';
import { useMyProfile } from '@/lib/myProfile';
import { Avatar } from '@/components/social/SocialParts';
import { chatFontFamily, useChatPreferences } from '@/lib/chatPreferences';
import { ShareSiteDialog } from './ShareSiteDialog';
import { MessageActions, ReactionChips } from './Reactions';
import { SharedLinks } from './SharedLinks';
import { AttachmentList } from './AttachmentList';
import { MessageText } from './MessageText';
import { MentionPicker } from './MentionPicker';
import type { Category } from '@/types';

const POLL_MS = 4000;
const GROUP_WINDOW_MS = 5 * 60 * 1000;
const NEAR_BOTTOM_PX = 120;
// Ctrl + wheel changes the text size one step per mouse notch; touchpad pinches send many small deltas.
const WHEEL_STEP_DELTA = 40;
// Reactions on messages already shown are refreshed every other poll, for the latest messages only.
const REACTION_REFRESH_EVERY = 2;
const REACTION_REFRESH_LIMIT = 100;
// Going to a message from the Link history loads older pages until it shows up, up to this many.
const FOCUS_PAGE_LIMIT = 20;

function sameReactions(a: Reaction[], b: Reaction[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What the reactions look like right after clicking, before the server answers. */
function toggledLocally(reactions: Reaction[], emoji: string, add: boolean): Reaction[] {
  const existing = reactions.find((r) => r.emoji === emoji);
  if (add) {
    if (existing) return reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
    return [...reactions, { emoji, count: 1, mine: true, handles: [] }];
  }
  if (!existing) return reactions;
  return existing.count <= 1
    ? reactions.filter((r) => r.emoji !== emoji)
    : reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r));
}

export interface ChatThreadProps {
  /** API path for this thread's messages, e.g. "/community/messages" or "/rooms/<id>/messages". */
  endpoint: string;
  currentUserId: string;
  header: ReactNode;
  placeholder: string;
  footnote: string;
  emptyState: { title: string; body: string };
  /** Shown when the server says the database tables are missing. */
  setupHint: ReactNode;
  /** Called after a shared site is saved, so the link list can refresh. */
  onLinkSaved: () => void;
  /** Called whenever newer messages are shown (first load, polling, sending), e.g. to mark a room read. */
  onSeen?: () => void;
  /** Called when the server says this thread is no longer yours (removed from a room, room deleted). */
  onGone?: () => void;
  /** A message to scroll to and highlight once loaded, e.g. when coming from the Link history. */
  focusMessageId?: string | null;
  onFocused?: () => void;
  /** People who can be @mentioned here besides recent writers, e.g. room members or friends. */
  mentionCandidates?: Person[];
}

// "@mi" right before the caret: the start of a mention being typed.
const MENTION_AT_CARET = /(^|\s)@([a-z0-9_.]{0,20})$/i;
const MENTION_SUGGESTIONS = 6;

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', weekday: 'short' });

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return dateFormat.format(date);
}

type ApiError = { response?: { status?: number; data?: { error?: string } } };

function errorMessage(error: unknown, fallback: string) {
  return (error as ApiError)?.response?.data?.error || fallback;
}

function isSetupRequired(error: unknown) {
  return (error as ApiError)?.response?.data?.error === 'setup_required';
}

function isGone(error: unknown) {
  const status = (error as ApiError)?.response?.status;
  return status === 403 || status === 404;
}

export function ChatThread({
  endpoint,
  currentUserId,
  header,
  placeholder,
  footnote,
  emptyState,
  setupHint,
  onLinkSaved,
  onSeen,
  onGone,
  focusMessageId,
  onFocused,
  mentionCandidates,
}: ChatThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<SharedLink[]>([]);
  // Set when a whole category is attached, so others can save it as a category.
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasUnseen, setHasUnseen] = useState(false);
  const [sizeHint, setSizeHint] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  // The mention being typed: where its "@" is and the letters after it.
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Bumped to go to a message that is quoted in a reply.
  const [jumpRequest, setJumpRequest] = useState(0);
  const myProfile = useMyProfile((state) => state.profile);
  const { fontSize, font, textColor, hydrate: hydrateChatPreferences } = useChatPreferences();

  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCreatedAt = useRef<string | null>(null);
  // How to adjust the scroll after the next render: stick to the bottom, or keep place after loading older messages.
  const pendingScroll = useRef<{ type: 'bottom' } | { type: 'keep'; previousHeight: number } | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;
  // Messages whose reaction is on its way to the server; a refresh must not undo the click meanwhile.
  const reactionsInFlight = useRef(new Set<string>());
  const pollCount = useRef(0);
  const callbacks = useRef({ onSeen, onGone, onFocused });
  callbacks.current = { onSeen, onGone, onFocused };
  const focusTarget = useRef<string | null>(focusMessageId ?? null);
  const focusPagesLoaded = useRef(0);

  const isNearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  /**
   * Adds messages not seen yet, keeping time order. Only polling advances the cursor: a message we
   * just sent must not make the next poll skip someone else's message written a moment earlier.
   */
  const mergeNewer = useCallback((incoming: ChatMessage[], advanceCursor = true) => {
    if (incoming.length === 0) return;
    setMessages((current) => {
      const known = new Set(current.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return current;
      return [...current, ...fresh].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
    if (advanceCursor) lastCreatedAt.current = incoming[incoming.length - 1].createdAt;
  }, []);

  const handleFailure = useCallback((error: unknown, fallback: string) => {
    if (isSetupRequired(error)) setNeedsSetup(true);
    else if (isGone(error)) callbacks.current.onGone?.();
    else toast.error(errorMessage(error, fallback));
  }, []);

  // First page.
  useEffect(() => {
    let cancelled = false;
    api
      .get(endpoint)
      .then((response) => {
        if (cancelled) return;
        const page: ChatMessage[] = response.data.messages || [];
        setMessages(page);
        setHasMore(Boolean(response.data.hasMore));
        lastCreatedAt.current = page.length ? page[page.length - 1].createdAt : new Date(0).toISOString();
        pendingScroll.current = { type: 'bottom' };
        callbacks.current.onSeen?.();
      })
      .catch((error) => !cancelled && handleFailure(error, 'Could not load messages'))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [endpoint, handleFailure]);

  // Check for new messages every few seconds while the page is visible.
  const refreshReactions = useCallback(async () => {
    const shown = messagesRef.current.filter((m) => m.kind === 'user').slice(-REACTION_REFRESH_LIMIT);
    if (shown.length === 0) return;
    const response = await api.get(`${endpoint}/reactions`, { params: { ids: shown.map((m) => m.id).join(',') } });
    const latest: Record<string, Reaction[]> = response.data.reactions || {};
    const shownIds = new Set(shown.map((m) => m.id));
    let changed = false;
    const next = messagesRef.current.map((m) => {
      if (!shownIds.has(m.id) || reactionsInFlight.current.has(m.id)) return m;
      const reactions = latest[m.id] ?? [];
      if (sameReactions(m.reactions, reactions)) return m;
      changed = true;
      return { ...m, reactions };
    });
    if (!changed) return;
    if (isNearBottom()) pendingScroll.current = { type: 'bottom' };
    setMessages(next);
  }, [endpoint]);

  const pollNewer = useCallback(async () => {
    if (!lastCreatedAt.current || document.hidden) return;
    pollCount.current += 1;
    if (pollCount.current % REACTION_REFRESH_EVERY === 0) refreshReactions().catch(() => undefined);
    try {
      const response = await api.get(endpoint, { params: { after: lastCreatedAt.current } });
      const incoming: ChatMessage[] = response.data.messages || [];
      if (incoming.length === 0) return;
      if (isNearBottom()) pendingScroll.current = { type: 'bottom' };
      else setHasUnseen(true);
      mergeNewer(incoming);
      callbacks.current.onSeen?.();
    } catch (error) {
      // A missed poll is fine; the next one catches up. Leaving a room is not.
      if (isGone(error)) callbacks.current.onGone?.();
    }
  }, [endpoint, mergeNewer, refreshReactions]);

  useEffect(() => {
    if (needsSetup) return;
    const timer = window.setInterval(pollNewer, POLL_MS);
    window.addEventListener('focus', pollNewer);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', pollNewer);
    };
  }, [pollNewer, needsSetup]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const pending = pendingScroll.current;
    if (!el || !pending) return;
    if (pending.type === 'bottom') {
      el.scrollTop = el.scrollHeight;
      setHasUnseen(false);
    } else {
      el.scrollTop += el.scrollHeight - pending.previousHeight;
    }
    pendingScroll.current = null;
  }, [messages, fontSize, font]);

  useEffect(() => {
    hydrateChatPreferences();
  }, [hydrateChatPreferences]);

  // Ctrl + wheel inside the chat resizes its text instead of zooming the whole page.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let pending = 0;
    let hintTimer: number | undefined;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      pending += event.deltaY;
      if (Math.abs(pending) < WHEEL_STEP_DELTA) return;
      const step = pending < 0 ? 1 : -1;
      pending = 0;
      const { fontSize: current, setPreferences } = useChatPreferences.getState();
      if (isNearBottom()) pendingScroll.current = { type: 'bottom' };
      setPreferences({ fontSize: current + step });
      setSizeHint(useChatPreferences.getState().fontSize);
      window.clearTimeout(hintTimer);
      hintTimer = window.setTimeout(() => setSizeHint(null), 900);
    };
    root.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      root.removeEventListener('wheel', onWheel);
      window.clearTimeout(hintTimer);
    };
  }, []);

  const loadEarlier = async () => {
    if (!messages.length) return;
    setIsLoadingEarlier(true);
    try {
      const response = await api.get(endpoint, { params: { before: messages[0].createdAt } });
      const older: ChatMessage[] = response.data.messages || [];
      pendingScroll.current = { type: 'keep', previousHeight: scrollRef.current?.scrollHeight ?? 0 };
      setMessages((current) => [...older, ...current]);
      setHasMore(Boolean(response.data.hasMore));
    } catch (error) {
      handleFailure(error, 'Could not load earlier messages');
    } finally {
      setIsLoadingEarlier(false);
    }
  };

  /** Adds sites to the next message, skipping ones already attached. */
  const attach = (sites: SharedLink[], collection: string | null = null) => {
    if (collection) {
      setAttachments(sites.slice(0, MAX_LINKS_PER_MESSAGE));
      setCollectionName(collection);
    } else {
      setAttachments((current) => {
        const known = new Set(current.map((site) => site.url));
        return [...current, ...sites.filter((site) => !known.has(site.url))].slice(0, MAX_LINKS_PER_MESSAGE);
      });
      // Adding other sites makes it no longer just that one category.
      setCollectionName(null);
    }
    textareaRef.current?.focus();
  };

  const send = async () => {
    const body = text.trim();
    if ((!body && attachments.length === 0) || isSending) return;
    setIsSending(true);
    try {
      const response = await api.post(endpoint, { ...composeMessage(body, attachments, collectionName), replyToId: replyingTo?.id ?? null });
      pendingScroll.current = { type: 'bottom' };
      mergeNewer([response.data.message], false);
      setText('');
      setAttachments([]);
      setCollectionName(null);
      setReplyingTo(null);
      setMention(null);
      textareaRef.current?.focus();
      callbacks.current.onSeen?.();
    } catch (error) {
      handleFailure(error, 'Could not send the message');
    } finally {
      setIsSending(false);
    }
  };

  const remove = async (message: ChatMessage) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      await api.delete(`${endpoint}/${message.id}`);
      setMessages((current) => current.filter((m) => m.id !== message.id));
    } catch (error) {
      handleFailure(error, 'Could not delete the message');
    }
  };

  const setReactions = (messageId: string, reactions: Reaction[]) => {
    if (isNearBottom()) pendingScroll.current = { type: 'bottom' };
    setMessages((current) => current.map((m) => (m.id === messageId ? { ...m, reactions } : m)));
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    const shown = messagesRef.current.find((m) => m.id === message.id) ?? message;
    const add = !shown.reactions.find((r) => r.emoji === emoji)?.mine;
    const path = `${endpoint}/${message.id}/reactions`;
    reactionsInFlight.current.add(message.id);
    setReactions(message.id, toggledLocally(shown.reactions, emoji, add));
    try {
      const response = add ? await api.post(path, { emoji }) : await api.delete(path, { params: { emoji } });
      setReactions(message.id, response.data.reactions || []);
    } catch (error) {
      setReactions(message.id, shown.reactions);
      handleFailure(error, 'Could not update the reaction');
    } finally {
      reactionsInFlight.current.delete(message.id);
    }
  };

  const saveSite = async (site: SharedLink) => {
    try {
      await api.post('/links', { title: site.title || hostnameOf(site.url), url: site.url, memo: site.memo, categoryId: null });
      toast.success('Saved to your Inbox');
      onLinkSaved();
    } catch (error) {
      const status = (error as ApiError)?.response?.status;
      if (status === 409) toast.message('Already in your links');
      else toast.error('Could not save the site');
    }
  };

  /** Saves a shared category: into your category of the same name, or a new one. */
  const saveCollection = async (message: ChatMessage) => {
    const name = message.collectionName;
    if (!name) return;
    const toastId = toast.loading(`Saving “${name}”…`);
    try {
      const existing: Category[] = (await api.get('/categories')).data.categories || [];
      let category = existing.find((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
      if (!category) category = (await api.post('/categories', { name, color: '#8e8e93' })).data.category as Category;
      let saved = 0;
      let already = 0;
      for (const site of message.links) {
        try {
          await api.post('/links', { title: site.title, url: site.url, memo: site.memo, categoryId: category.id });
          saved += 1;
        } catch (error) {
          if ((error as ApiError)?.response?.status === 409) already += 1;
          else throw error;
        }
      }
      toast.success(`Saved ${saved} ${saved === 1 ? 'site' : 'sites'} to “${category.name}”${already ? ` · ${already} already saved` : ''}`, { id: toastId });
      onLinkSaved();
    } catch {
      toast.error('Could not save the category', { id: toastId });
    }
  };

  // Coming from the Link history: find the message (loading older pages if needed), then show it.
  useEffect(() => {
    if (focusMessageId) {
      focusTarget.current = focusMessageId;
      focusPagesLoaded.current = 0;
    }
  }, [focusMessageId]);

  const jumpTo = (messageId: string) => {
    focusTarget.current = messageId;
    focusPagesLoaded.current = 0;
    setJumpRequest((n) => n + 1);
  };

  useEffect(() => {
    const target = focusTarget.current;
    if (!target || isLoading || isLoadingEarlier) return;
    if (messages.some((m) => m.id === target)) {
      focusTarget.current = null;
      requestAnimationFrame(() => {
        document.getElementById(`message-${target}`)?.scrollIntoView({ block: 'center' });
        setHighlightId(target);
        window.setTimeout(() => setHighlightId((current) => (current === target ? null : current)), 2600);
      });
      callbacks.current.onFocused?.();
    } else if (hasMore && focusPagesLoaded.current < FOCUS_PAGE_LIMIT) {
      focusPagesLoaded.current += 1;
      loadEarlier();
    } else {
      focusTarget.current = null;
      toast.message('That message was deleted or is too old to show');
      callbacks.current.onFocused?.();
    }
    // loadEarlier reads the latest messages itself; running again whenever the list changes is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading, isLoadingEarlier, hasMore, focusMessageId, jumpRequest]);

  // Grow the textarea with its content, up to a few lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text, fontSize, font]);

  // Who can be mentioned: people given by the screen, plus everyone who wrote here; never yourself.
  const people = (() => {
    const byId = new Map<string, Person>();
    for (const person of mentionCandidates ?? []) byId.set(person.id, person);
    for (const m of messages) {
      if (m.kind !== 'user' || !m.userId || byId.has(m.userId)) continue;
      byId.set(m.userId, { id: m.userId, handle: m.authorHandle, name: m.authorName, emoji: m.authorEmoji, color: m.authorColor });
    }
    byId.delete(currentUserId);
    return [...byId.values()];
  })();
  const suggestions = mention
    ? people
        .filter((p) => {
          const q = mention.query.toLowerCase();
          return p.handle.startsWith(q) || (p.name ?? '').toLowerCase().includes(q);
        })
        .slice(0, MENTION_SUGGESTIONS)
    : [];

  /** Finds a mention being typed right before the caret. */
  const updateMention = (value: string, caret: number | null) => {
    const before = value.slice(0, caret ?? value.length);
    const match = before.match(MENTION_AT_CARET);
    if (!match) {
      setMention(null);
      return;
    }
    setMention({ start: before.length - match[2].length - 1, query: match[2] });
    setMentionIndex(0);
  };

  const insertMention = (person: Person) => {
    if (!mention) return;
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? text.length;
    const inserted = `@${person.handle} `;
    const next = text.slice(0, mention.start) + inserted + text.slice(caret);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      const position = mention.start + inserted.length;
      el?.focus();
      el?.setSelectionRange(position, position);
    });
  };

  /** A pasted address first shows as "notion.so"; swap in the page title once it is known. */
  const lookUpTitle = async (url: string) => {
    try {
      const { data } = await api.get('/site-info', { params: { url } });
      if (!data.title) return;
      setAttachments((current) =>
        current.map((site) => (site.url === url && site.title === hostnameOf(url) ? { ...site, title: data.title } : site))
      );
    } catch {
      // Keep the address as the title.
    }
  };

  const remaining = MESSAGE_MAX_LENGTH - text.length;
  const canSend = (text.trim().length > 0 || attachments.length > 0) && remaining >= 0 && !isSending && !needsSetup;

  return (
    <div ref={rootRef} className="relative flex h-full min-h-0 flex-col">
      {header}

      {sizeHint !== null && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2 rounded-full bg-foreground/85 px-3 py-1 text-xs font-medium tabular-nums text-background shadow-raised" role="status">
          Text size {sizeHint}px
        </div>
      )}

      <div ref={scrollRef} className="custom-scrollbar relative min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-8">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
          </div>
        )}

        {!isLoading && needsSetup && (
          <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <h2 className="text-[15px] font-semibold">This isn&apos;t set up yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">{setupHint}</p>
          </div>
        )}

        {!isLoading && !needsSetup && messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-[15px] font-semibold">{emptyState.title}</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{emptyState.body}</p>
          </div>
        )}

        {!isLoading && !needsSetup && messages.length > 0 && (
          <div className="mx-auto max-w-3xl" style={{ fontSize, fontFamily: chatFontFamily(font) }}>
            {hasMore && (
              <div className="mb-4 flex justify-center">
                <Button variant="outline" size="sm" onClick={loadEarlier} disabled={isLoadingEarlier}>
                  {isLoadingEarlier ? 'Loading…' : 'Load earlier messages'}
                </Button>
              </div>
            )}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const date = new Date(message.createdAt);
              const newDay = !previous || new Date(previous.createdAt).toDateString() !== date.toDateString();
              const dayDivider = newDay && (
                <div className="my-4 flex items-center gap-3 text-[0.86em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {dayLabel(date)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              );

              if (message.kind === 'system') {
                return (
                  <div key={message.id}>
                    {dayDivider}
                    <p className="my-3 text-center text-[0.86em] text-muted-foreground">{message.body}</p>
                  </div>
                );
              }

              const continues =
                !newDay &&
                previous.kind !== 'system' &&
                previous.userId === message.userId &&
                date.getTime() - new Date(previous.createdAt).getTime() < GROUP_WINDOW_MS;
              const isMine = message.userId === currentUserId;

              return (
                <div key={message.id} id={`message-${message.id}`} className="scroll-mt-24">
                  {dayDivider}
                  <div
                    className={`group relative flex gap-3 rounded-lg px-2 py-1 transition-colors duration-700 hover:bg-accent/50 ${continues ? '' : 'mt-3'} ${
                      highlightId === message.id
                        ? 'bg-primary/10 ring-2 ring-primary/40'
                        : message.mentionsMe
                          ? 'bg-amber-400/10 shadow-[inset_3px_0_0] shadow-amber-400'
                          : ''
                    }`}
                  >
                    <div className="w-8 shrink-0">
                      {!continues && (
                        <Avatar
                          handle={message.authorHandle}
                          name={message.authorName}
                          emoji={message.authorEmoji}
                          color={message.authorColor}
                          size="chat"
                          tone={isMine ? 'primary' : 'muted'}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      {!continues && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-[0.93em] font-semibold">{message.authorName || message.authorHandle}</span>
                          {message.authorName && <span className="text-[0.79em] text-muted-foreground">@{message.authorHandle}</span>}
                          {isMine && <span className="text-[0.79em] text-muted-foreground">you</span>}
                          <time className="text-[0.79em] text-muted-foreground" dateTime={message.createdAt}>
                            {timeFormat.format(date)}
                          </time>
                        </div>
                      )}
                      {message.replyTo && (
                        <button
                          type="button"
                          onClick={() => jumpTo(message.replyTo!.id)}
                          title="Go to the original message"
                          className="mb-0.5 mt-0.5 flex max-w-full items-center gap-1.5 rounded-md border-l-2 border-primary/40 bg-muted/60 px-2 py-1 text-left text-[0.86em] text-muted-foreground transition-colors hover:bg-muted"
                        >
                          <CornerUpLeft className="size-3 shrink-0" />
                          <span className="shrink-0 font-medium text-foreground/80">
                            {message.replyTo.authorName || `@${message.replyTo.authorHandle}`}
                          </span>
                          <span className="truncate">{message.replyTo.snippet}</span>
                        </button>
                      )}
                      {message.body && (
                        <p className="whitespace-pre-wrap break-words leading-relaxed" style={textColor ? { color: textColor } : undefined}>
                          <MessageText text={message.body} myHandle={myProfile?.handle} />
                        </p>
                      )}
                      <SharedLinks
                        links={message.links ?? []}
                        collectionName={message.collectionName ?? null}
                        canSave={!isMine}
                        onSave={saveSite}
                        onSaveAll={() => saveCollection(message)}
                      />
                      <ReactionChips reactions={message.reactions ?? []} onToggle={(emoji) => toggleReaction(message, emoji)} />
                    </div>
                    <MessageActions
                      onReact={(emoji) => toggleReaction(message, emoji)}
                      onReply={() => {
                        setReplyingTo(message);
                        textareaRef.current?.focus();
                      }}
                      onDelete={isMine ? () => remove(message) : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {hasUnseen && (
        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
              setHasUnseen(false);
            }}
            className="pointer-events-auto absolute -top-12 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-raised"
          >
            <ArrowDown className="size-3.5" />
            New messages
          </button>
        </div>
      )}

      <div className="shrink-0 border-t border-border/80 bg-background/85 px-4 py-3 backdrop-blur-md md:px-8">
        <div className="relative mx-auto max-w-3xl">
          {replyingTo && (
            <div className="mb-2 flex max-w-xl items-center gap-2 rounded-lg border-l-2 border-primary bg-card px-3 py-1.5 text-xs shadow-card">
              <CornerUpLeft className="size-3.5 shrink-0 text-primary" />
              <span className="shrink-0 font-medium">Replying to {replyingTo.authorName || `@${replyingTo.authorHandle}`}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {replyingTo.body || (replyingTo.links.length ? 'Shared a site' : '')}
              </span>
              <button
                type="button"
                onClick={() => setReplyingTo(null)}
                aria-label="Cancel reply"
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
          {mention && suggestions.length > 0 && (
            <MentionPicker people={suggestions} activeIndex={mentionIndex} onPick={insertMention} onHover={setMentionIndex} />
          )}
          <AttachmentList
            links={attachments}
            collectionName={collectionName}
            onChange={(next) => {
              setAttachments(next);
              if (next.length === 0) setCollectionName(null);
            }}
            onClearCollection={() => setCollectionName(null)}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-1.5 rounded-xl border border-input bg-card p-1.5 shadow-card transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20"
          >
            <button
              type="button"
              onClick={() => setIsShareOpen(true)}
              disabled={needsSetup}
              aria-label="Share sites"
              title="Share sites"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Link2 className="size-[18px]" />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                updateMention(e.target.value, e.target.selectionStart);
              }}
              onClick={(e) => updateMention(text, e.currentTarget.selectionStart)}
              onBlur={() => window.setTimeout(() => setMention(null), 150)}
              onPaste={(e) => {
                // Pasting just a web address attaches it as a site card instead of plain text.
                const pasted = e.clipboardData.getData('text').trim();
                if (!/^https?:\/\/\S+$/i.test(pasted)) return;
                const url = normalizeShareUrl(pasted);
                if (!url) return;
                e.preventDefault();
                attach([{ url, title: hostnameOf(url), memo: null }]);
                lookUpTitle(url);
              }}
              onKeyDown={(e) => {
                // While mention suggestions are open, the arrows, Enter and Tab pick from them.
                if (mention && suggestions.length > 0 && !e.nativeEvent.isComposing) {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const step = e.key === 'ArrowDown' ? 1 : -1;
                    setMentionIndex((i) => (i + step + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    insertMention(suggestions[mentionIndex] ?? suggestions[0]);
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMention(null);
                    return;
                  }
                }
                if (e.key === 'Escape' && replyingTo) {
                  setReplyingTo(null);
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={needsSetup}
              placeholder={placeholder}
              aria-label="Message"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 outline-none placeholder:text-muted-foreground"
              style={{ fontSize, fontFamily: chatFontFamily(font) }}
            />
            <Button type="submit" size="icon" disabled={!canSend} aria-label="Send" className="size-9 shrink-0">
              <SendHorizontal className="size-4" />
            </Button>
          </form>
          <div className="mt-1.5 flex justify-between gap-3 px-1 text-[11px] text-muted-foreground">
            <span>{footnote}</span>
            {remaining < 200 && <span className={`tabular-nums ${remaining < 0 ? 'text-destructive' : ''}`}>{remaining}</span>}
          </div>
        </div>
      </div>

      <ShareSiteDialog open={isShareOpen} onOpenChange={setIsShareOpen} onPick={attach} />
    </div>
  );
}

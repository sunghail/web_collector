'use client';

import { useEffect, useState } from 'react';
import { MessagesSquare, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { MAX_LINKS_PER_MESSAGE, MESSAGE_MAX_LENGTH, composeMessage, type RoomSummary, type SharedLink } from '@/lib/chat';
import { messagesEndpoint, useShareToChat, type ChatPlace } from '@/lib/shareToChat';
import type { Link } from '@/types';
import { AttachmentList } from './AttachmentList';

type ApiError = { response?: { data?: { error?: string } } };

/**
 * "Share to chat" from outside a chat: a link card's menu, or a category in the sidebar.
 * Pick the community room or one of your rooms, add notes or a message, and send.
 */
export function ShareToChatDialog({ onOpenPlace }: { onOpenPlace: (place: ChatPlace) => void }) {
  const { request, close } = useShareToChat();
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [place, setPlace] = useState<ChatPlace>({ kind: 'community' });
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!request) return;
    setBody('');
    setPlace({ kind: 'community' });
    setIsLoading(true);

    const linksReady =
      request.kind === 'links'
        ? Promise.resolve(request.links)
        : api.get('/links', { params: { categoryId: request.categoryId } }).then((response) =>
            ((response.data.links || []) as Link[])
              .filter((link) => link.type !== 'macro')
              .sort((a, b) => a.order_index - b.order_index)
              .map((link) => ({ url: link.url, title: link.title, memo: link.memo || null }))
          );
    setCollectionName(request.kind === 'category' ? request.name : null);

    Promise.all([
      linksReady,
      api.get('/rooms').then((response) => (response.data.rooms || []) as RoomSummary[]).catch(() => []),
    ])
      .then(([sites, roomList]) => {
        setLinks(sites.slice(0, MAX_LINKS_PER_MESSAGE));
        setRooms(roomList);
      })
      .catch(() => {
        toast.error('Could not load the sites to share');
        close();
      })
      .finally(() => setIsLoading(false));
  }, [request, close]);

  const placeTitle = (target: ChatPlace) => {
    if (target.kind === 'community') return 'Community';
    const room = rooms.find((r) => r.id === target.roomId);
    return room ? (room.isDirect ? `@${room.title}` : room.title) : 'the room';
  };

  const send = async () => {
    if (links.length === 0 || isSending) return;
    setIsSending(true);
    try {
      await api.post(messagesEndpoint(place), composeMessage(body, links, collectionName));
      const target = place;
      toast.success(`Shared to ${placeTitle(target)}`, { action: { label: 'Open', onClick: () => onOpenPlace(target) } });
      close();
    } catch (error) {
      const message = (error as ApiError)?.response?.data?.error;
      toast.error(message === 'setup_required' ? 'Sharing is not set up yet' : message || 'Could not share');
    } finally {
      setIsSending(false);
    }
  };

  const placeButton = (target: ChatPlace, key: string, icon: React.ReactNode, title: string, detail: string) => {
    const isSelected =
      target.kind === place.kind && (target.kind === 'community' || (place.kind === 'room' && place.roomId === target.roomId));
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => setPlace(target)}
        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
          isSelected ? 'bg-primary/[0.07] ring-1 ring-primary' : 'hover:bg-accent'
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{title}</span>
          <span className="block truncate text-xs text-muted-foreground">{detail}</span>
        </span>
      </button>
    );
  };

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Share to chat</DialogTitle>
          <DialogDescription>
            {collectionName ? 'Send the whole category; others can save it as a category.' : 'Add a note so people know what it is.'}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
          </div>
        ) : (
          <>
            {links.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                Nothing to share here yet.
              </p>
            ) : (
              <AttachmentList
                links={links}
                collectionName={collectionName}
                onChange={setLinks}
                onClearCollection={() => setCollectionName(null)}
              />
            )}

            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              rows={2}
              placeholder="Add a message (optional)"
              aria-label="Message"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
            />

            <div className="space-y-1.5">
              <div className="text-[13px] font-medium">Send to</div>
              <div className="custom-scrollbar max-h-52 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Send to">
                {placeButton({ kind: 'community' }, 'community', <MessagesSquare className="size-4" />, 'Community', 'Everyone signed in')}
                {rooms.map((room) =>
                  placeButton(
                    { kind: 'room', roomId: room.id },
                    room.id,
                    <Users className="size-4" />,
                    room.isDirect ? `@${room.title}` : room.title,
                    room.isDirect ? 'Direct chat' : `${room.memberCount} people`
                  )
                )}
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="button" onClick={send} disabled={isLoading || isSending || links.length === 0}>
            {isSending ? 'Sending…' : `Share to ${placeTitle(place)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

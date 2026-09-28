'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Menu, MessageCircle, MessagesSquare, Pencil, Plus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ChatThread } from '@/components/chat/ChatThread';
import api from '@/lib/api';
import type { RoomDetail, RoomSummary } from '@/lib/chat';
import { AddPeopleDialog, MembersDialog, NewRoomDialog, RenameRoomDialog } from './RoomDialogs';
import { Avatar, SetupNotice, errorMessage, isSetupRequired } from './SocialParts';

interface ChatsViewProps {
  currentUserId: string;
  roomId: string | null;
  onSelectRoom: (roomId: string | null) => void;
  onOpenSidebar: () => void;
  onOpenFriends: () => void;
  onLinkSaved: () => void;
  /** Called when unread counts may have changed, so the sidebar badge can update. */
  onChanged: () => void;
  /** A message in the open room to scroll to, e.g. when coming from the Link history. */
  focusMessageId?: string | null;
  onFocused?: () => void;
}

const LIST_POLL_MS = 8000;
const shortTime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' });

function when(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString() ? shortTime.format(date) : shortDate.format(date);
}

function preview(room: RoomSummary) {
  const last = room.lastMessage;
  if (!last) return 'No messages yet';
  if (last.kind === 'system') return last.body;
  const text = last.body || (last.hasLink ? 'Shared a site' : '');
  return room.isDirect ? text : `${last.authorHandle}: ${text}`;
}

function RoomList({
  rooms,
  selectedId,
  onSelect,
  onNew,
}: {
  rooms: RoomSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
      {rooms.length === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium">No chats yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Start one with your friends.</p>
          <Button size="sm" className="mt-4 gap-1.5" onClick={onNew}>
            <Plus className="size-4" />
            New room
          </Button>
        </div>
      )}
      {rooms.map((room) => {
        const isSelected = room.id === selectedId;
        return (
          <button
            key={room.id}
            type="button"
            onClick={() => onSelect(room.id)}
            aria-current={isSelected ? 'true' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${
              isSelected ? 'bg-card shadow-card ring-1 ring-border/70' : 'hover:bg-accent/60'
            }`}
          >
            {room.isDirect ? (
              <Avatar handle={room.title} />
            ) : (
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary" aria-hidden="true">
                <Users className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span className={`min-w-0 flex-1 truncate text-[13.5px] ${room.unread ? 'font-semibold' : 'font-medium'}`}>
                  {room.isDirect ? `@${room.title}` : room.title}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{when(room.lastMessageAt)}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-2">
                <span className={`min-w-0 flex-1 truncate text-xs ${room.unread ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {preview(room)}
                </span>
                {room.unread > 0 && (
                  <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {room.unread > 99 ? '99+' : room.unread}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ChatsView({
  currentUserId,
  roomId,
  onSelectRoom,
  onOpenSidebar,
  onOpenFriends,
  onLinkSaved,
  onChanged,
  focusMessageId,
  onFocused,
}: ChatsViewProps) {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [dialog, setDialog] = useState<'new' | 'add' | 'members' | 'rename' | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get('/rooms');
      setRooms(response.data.rooms);
    } catch (error) {
      if (isSetupRequired(error)) setNeedsSetup(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRooms();
    const timer = window.setInterval(() => !document.hidden && loadRooms(), LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadRooms]);

  const loadRoom = useCallback(async (id: string) => {
    try {
      const response = await api.get(`/rooms/${id}`);
      setRoom(response.data.room);
    } catch (error) {
      setRoom(null);
      onSelectRoom(null);
      if (!isSetupRequired(error)) toast.error(errorMessage(error, 'Could not open the room'));
    }
  }, [onSelectRoom]);

  useEffect(() => {
    setRoom(null);
    if (roomId) loadRoom(roomId);
  }, [roomId, loadRoom]);

  // Mark the open room read whenever new messages show up in it.
  const markRead = useCallback(() => {
    if (!roomId) return;
    setRooms((current) => current.map((r) => (r.id === roomId ? { ...r, unread: 0 } : r)));
    api
      .post(`/rooms/${roomId}/read`)
      .then(() => {
        onChangedRef.current();
        loadRooms();
      })
      .catch(() => undefined);
  }, [roomId, loadRooms]);

  const refreshRoom = () => {
    if (roomId) loadRoom(roomId);
    loadRooms();
  };

  const leftRoom = () => {
    toast.success('You left the room');
    onSelectRoom(null);
    loadRooms();
    onChanged();
  };

  const roomHeader = room && (
    <header className="shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-3 md:px-6">
        <button
          type="button"
          onClick={() => onSelectRoom(null)}
          aria-label="Back to chats"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => setDialog('members')}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-left hover:bg-accent/60"
          title="See people in this room"
        >
          {room.isDirect ? (
            <Avatar handle={room.title} />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/12 text-primary" aria-hidden="true">
              <Users className="size-4" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{room.isDirect ? `@${room.title}` : room.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {room.isDirect ? 'Direct chat' : `${room.members.length} people · ${room.members.map((m) => `@${m.handle}`).join(', ')}`}
            </span>
          </span>
        </button>
        {!room.isDirect && (
          <>
            <Button variant="ghost" size="icon" onClick={() => setDialog('rename')} aria-label="Rename room" title="Rename room" className="size-9">
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setDialog('add')} aria-label="Add people" title="Add people" className="size-9">
              <UserPlus className="size-4" />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" onClick={() => setDialog('members')} aria-label="People in this room" title="People" className="size-9">
          <Users className="size-4" />
        </Button>
      </div>
    </header>
  );

  return (
    <div className="flex h-dvh min-h-0">
      {/* Room list: always on wide screens; on narrow screens only when no room is open. */}
      <aside
        className={`w-full flex-col border-r border-border bg-sidebar/40 lg:flex lg:w-80 lg:shrink-0 ${roomId ? 'hidden' : 'flex'}`}
        aria-label="Chats"
      >
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-border/80 px-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label="Open sidebar"
            className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <MessageCircle className="size-5 shrink-0 text-primary" />
          <h1 className="flex-1 text-[19px] font-semibold tracking-[-0.015em]">Chats</h1>
          {!needsSetup && (
            <Button size="sm" className="gap-1.5" onClick={() => setDialog('new')}>
              <Plus className="size-4" />
              New room
            </Button>
          )}
        </div>
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
          </div>
        ) : needsSetup ? (
          <div className="px-4">
            <SetupNotice />
          </div>
        ) : (
          <RoomList rooms={rooms} selectedId={roomId} onSelect={onSelectRoom} onNew={() => setDialog('new')} />
        )}
      </aside>

      {/* Conversation */}
      <section className={`min-w-0 flex-1 flex-col ${roomId ? 'flex' : 'hidden lg:flex'}`}>
        {roomId && room ? (
          <ChatThread
            key={room.id}
            endpoint={`/rooms/${room.id}/messages`}
            currentUserId={currentUserId}
            header={roomHeader}
            placeholder={room.isDirect ? `Message @${room.title}` : `Message ${room.title}`}
            footnote="Only people in this room can read it. Enter to send, Shift+Enter for a new line."
            emptyState={{ title: 'Start the conversation', body: 'Say hi, or share a site with the link button next to the message box.' }}
            setupHint="Run supabase/20260927_add_friends_and_chat_rooms.sql in the Supabase SQL editor, then reload."
            onLinkSaved={onLinkSaved}
            focusMessageId={focusMessageId}
            onFocused={onFocused}
            onSeen={markRead}
            onGone={() => {
              toast.message('You are no longer in this room');
              onSelectRoom(null);
              loadRooms();
            }}
          />
        ) : roomId ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
              <MessagesSquare className="size-6" />
            </div>
            <h2 className="text-[15px] font-semibold">Pick a chat</h2>
            <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
              Choose a room on the left, make a new one, or message a friend from the Friends screen.
            </p>
            <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={onOpenFriends}>
              <Users className="size-4" />
              Go to Friends
            </Button>
          </div>
        )}
      </section>

      <NewRoomDialog
        open={dialog === 'new'}
        onOpenChange={(open) => setDialog(open ? 'new' : null)}
        onCreated={(id) => {
          loadRooms();
          onSelectRoom(id);
        }}
      />
      {room && (
        <>
          <AddPeopleDialog room={room} open={dialog === 'add'} onOpenChange={(open) => setDialog(open ? 'add' : null)} onAdded={refreshRoom} />
          <MembersDialog
            room={room}
            currentUserId={currentUserId}
            open={dialog === 'members'}
            onOpenChange={(open) => setDialog(open ? 'members' : null)}
            onChanged={refreshRoom}
            onLeft={leftRoom}
          />
          <RenameRoomDialog room={room} open={dialog === 'rename'} onOpenChange={(open) => setDialog(open ? 'rename' : null)} onRenamed={refreshRoom} />
        </>
      )}
    </div>
  );
}

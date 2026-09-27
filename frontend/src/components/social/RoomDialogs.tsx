'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Crown, LogOut, Search, UserMinus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { ROOM_NAME_MAX_LENGTH, type Person, type RoomDetail } from '@/lib/chat';
import { Avatar, errorMessage } from './SocialParts';

/** Checkbox list of friends with a search box. */
function FriendPicker({
  excludeIds,
  selected,
  onChange,
}: {
  excludeIds?: Set<string>;
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [friends, setFriends] = useState<Person[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api
      .get('/friends')
      .then((response) => setFriends(response.data.friends))
      .catch(() => setFriends([]));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().replace(/^@/, '').toLowerCase();
    return (friends ?? []).filter((f) => !excludeIds?.has(f.id) && (!q || f.handle.includes(q)));
  }, [friends, excludeIds, query]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a friend" aria-label="Find a friend" className="h-9 pl-9" />
      </div>
      <div className="custom-scrollbar max-h-60 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5" role="group" aria-label="Friends">
        {friends === null && <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>}
        {friends !== null && visible.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {friends.length === 0 ? 'Add friends first, from the Friends screen.' : 'No one else to add.'}
          </p>
        )}
        {visible.map((friend) => {
          const isChecked = selected.has(friend.id);
          return (
            <button
              key={friend.id}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => toggle(friend.id)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-accent"
            >
              <Avatar handle={friend.handle} size="sm" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">@{friend.handle}</span>
              <span
                className={`flex size-5 items-center justify-center rounded-md border transition-colors ${
                  isChecked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                }`}
              >
                {isChecked && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NewRoomDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (roomId: string) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSelected(new Set());
  }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const response = await api.post('/rooms', { name: name.trim(), memberIds: [...selected] });
      onOpenChange(false);
      onCreated(response.data.room.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not create the room'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>New chat room</DialogTitle>
          <DialogDescription>Name the room and pick friends to invite. You can add more people later.</DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="room-name" className="text-[13px]">Room name</Label>
            <Input
              id="room-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={ROOM_NAME_MAX_LENGTH}
              placeholder="e.g. Study group"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">People</Label>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            </div>
            <FriendPicker selected={selected} onChange={setSelected} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || selected.size === 0 || isSaving}>
              {isSaving ? 'Creating…' : 'Create room'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddPeopleDialog({
  room,
  open,
  onOpenChange,
  onAdded,
}: {
  room: RoomDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const memberIds = useMemo(() => new Set(room.members.map((m) => m.id)), [room.members]);

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const add = async () => {
    setIsSaving(true);
    try {
      await api.post(`/rooms/${room.id}/members`, { userIds: [...selected] });
      onOpenChange(false);
      onAdded();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not add people'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Add people to {room.title}</DialogTitle>
          <DialogDescription>You can add your friends. They will see earlier messages too.</DialogDescription>
        </DialogHeader>
        {open && <FriendPicker excludeIds={memberIds} selected={selected} onChange={setSelected} />}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={add} disabled={selected.size === 0 || isSaving}>
            {isSaving ? 'Adding…' : `Add ${selected.size || ''}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersDialog({
  room,
  currentUserId,
  open,
  onOpenChange,
  onChanged,
  onLeft,
}: {
  room: RoomDetail;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const isOwner = room.ownerId === currentUserId;

  const removeMember = async (person: Person) => {
    if (!window.confirm(`Remove @${person.handle} from this room?`)) return;
    try {
      await api.delete(`/rooms/${room.id}/members/${person.id}`);
      toast.success(`Removed @${person.handle}`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not remove them'));
    }
  };

  const leave = async () => {
    const question = room.isDirect
      ? `Leave the chat with @${room.title}? It disappears from your list.`
      : `Leave “${room.title}”?`;
    if (!window.confirm(question)) return;
    try {
      await api.delete(`/rooms/${room.id}/members/${currentUserId}`);
      onOpenChange(false);
      onLeft();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not leave the room'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{room.isDirect ? `Chat with @${room.title}` : room.title}</DialogTitle>
          <DialogDescription>{room.members.length} {room.members.length === 1 ? 'person' : 'people'} in this room</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          {room.members.map((member) => (
            <div key={member.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/60">
              <Avatar handle={member.handle} size="sm" tone={member.id === currentUserId ? 'primary' : 'muted'} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                @{member.handle}
                {member.id === currentUserId && <span className="ml-1.5 text-xs font-normal text-muted-foreground">you</span>}
              </span>
              {member.role === 'owner' && !room.isDirect && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Crown className="size-3.5" />
                  Owner
                </span>
              )}
              {isOwner && !room.isDirect && member.id !== currentUserId && (
                <button
                  type="button"
                  onClick={() => removeMember(member)}
                  aria-label={`Remove @${member.handle}`}
                  title="Remove from room"
                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <DialogFooter className="border-t border-border pt-4 sm:justify-between">
          <Button type="button" variant="ghost" onClick={leave} className="gap-1.5 text-destructive hover:text-destructive">
            <LogOut className="size-4" />
            {room.isDirect ? 'Leave chat' : 'Leave room'}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RenameRoomDialog({
  room,
  open,
  onOpenChange,
  onRenamed,
}: {
  room: RoomDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(room.name ?? '');

  useEffect(() => {
    if (open) setName(room.name ?? '');
  }, [open, room.name]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/rooms/${room.id}`, { name: name.trim() });
      onOpenChange(false);
      onRenamed();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not rename the room'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Rename room</DialogTitle>
          <DialogDescription>Everyone in the room sees the new name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={ROOM_NAME_MAX_LENGTH} aria-label="Room name" />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || name.trim() === room.name}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

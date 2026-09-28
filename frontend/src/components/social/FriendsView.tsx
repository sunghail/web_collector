'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, MessageCircle, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { normalizeHandle, type FriendRequest, type Person } from '@/lib/chat';
import { useMyProfile } from '@/lib/myProfile';
import { ProfileCard } from './ProfileCard';
import { Avatar, PageHeader, PersonName, SetupNotice, errorMessage, isSetupRequired } from './SocialParts';

interface FriendsViewProps {
  onOpenSidebar: () => void;
  /** Open (or create) the 1:1 chat with a friend. */
  onMessage: (friend: Person) => void;
  /** Called when requests change, so the sidebar badge can update. */
  onChanged: () => void;
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
        <span className="h-px flex-1 bg-border" />
      </div>
      {children}
    </section>
  );
}

const rowClass = 'flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card';

export function FriendsView({ onOpenSidebar, onMessage, onChanged }: FriendsViewProps) {
  const { profile: myProfile, set: setMyProfile } = useMyProfile();
  const [friends, setFriends] = useState<Person[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profile, list] = await Promise.all([api.get('/profile'), api.get('/friends')]);
      setMyProfile(profile.data.profile);
      setFriends(list.data.friends);
      setIncoming(list.data.incoming);
      setOutgoing(list.data.outgoing);
    } catch (error) {
      if (isSetupRequired(error)) setNeedsSetup(true);
      else toast.error(errorMessage(error, 'Could not load friends'));
    } finally {
      setIsLoading(false);
    }
  }, [setMyProfile]);

  useEffect(() => {
    load();
    // Pick up requests from other people while this screen is open.
    const timer = window.setInterval(() => !document.hidden && load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  const refresh = async () => {
    await load();
    onChanged();
  };

  const addFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const handle = normalizeHandle(addInput);
    if (!handle) return;
    setIsAdding(true);
    try {
      const response = await api.post('/friends', { handle });
      toast.success(
        response.data.status === 'accepted'
          ? `You and @${response.data.person.handle} are now friends`
          : `Request sent to @${response.data.person.handle}`
      );
      setAddInput('');
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not send the request'));
    } finally {
      setIsAdding(false);
    }
  };

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error, failure));
    }
  };

  return (
    <div className="flex h-dvh flex-col">
      <PageHeader
        icon={<Users className="size-5" />}
        title="Friends"
        subtitle="Add people by their ID, then chat with them"
        onOpenSidebar={onOpenSidebar}
      />

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8">
        {isLoading && (
          <div className="flex h-40 items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
          </div>
        )}

        {!isLoading && needsSetup && <SetupNotice />}

        {!isLoading && !needsSetup && (
          <div className="mx-auto max-w-2xl space-y-8">
            {myProfile && <ProfileCard profile={myProfile} />}

            {/* Add a friend */}
            <Section title="Add a friend">
              <form onSubmit={addFriend} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    value={addInput}
                    onChange={(e) => setAddInput(e.target.value)}
                    placeholder="their ID"
                    aria-label="Friend's ID"
                    className="pl-7"
                  />
                </div>
                <Button type="submit" disabled={!normalizeHandle(addInput) || isAdding} className="gap-1.5">
                  <UserPlus className="size-4" />
                  {isAdding ? 'Sending…' : 'Send request'}
                </Button>
              </form>
            </Section>

            {/* Requests */}
            {(incoming.length > 0 || outgoing.length > 0) && (
              <Section title="Requests" count={incoming.length + outgoing.length}>
                <div className="space-y-2">
                  {incoming.map((request) => (
                    <div key={request.id} className={rowClass}>
                      <Avatar {...request.person} />
                      <div className="min-w-0 flex-1">
                        <PersonName person={request.person} />
                        <div className="text-xs text-muted-foreground">wants to be friends</div>
                      </div>
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() =>
                          run(
                            () => api.patch(`/friends/requests/${request.id}`, { action: 'accept' }),
                            `You and @${request.person.handle} are now friends`,
                            'Could not accept'
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(() => api.delete(`/friends/requests/${request.id}`), 'Request declined', 'Could not decline')
                        }
                      >
                        Decline
                      </Button>
                    </div>
                  ))}
                  {outgoing.map((request) => (
                    <div key={request.id} className={rowClass}>
                      <Avatar {...request.person} />
                      <div className="min-w-0 flex-1">
                        <PersonName person={request.person} />
                        <div className="text-xs text-muted-foreground">waiting for them to accept</div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() =>
                          run(() => api.delete(`/friends/requests/${request.id}`), 'Request canceled', 'Could not cancel')
                        }
                      >
                        <X className="size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Friends */}
            <Section title="Friends" count={friends.length}>
              {friends.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No friends yet. Ask someone for their ID and add them above.
                </p>
              ) : (
                <div className="space-y-2">
                  {friends.map((friend) => (
                    <div key={friend.id} className={`group ${rowClass}`}>
                      <Avatar {...friend} />
                      <div className="min-w-0 flex-1">
                        <PersonName person={friend} showStatus />
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => onMessage(friend)}>
                        <MessageCircle className="size-3.5" />
                        Message
                      </Button>
                      <button
                        type="button"
                        aria-label={`Remove @${friend.handle}`}
                        title="Remove friend"
                        onClick={() => {
                          if (!window.confirm(`Remove @${friend.handle} from your friends?`)) return;
                          run(() => api.delete(`/friends/${friend.id}`), `Removed @${friend.handle}`, 'Could not remove');
                        }}
                        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-60 transition-opacity hover:bg-accent hover:text-destructive hover:opacity-100 group-hover:opacity-100"
                      >
                        <UserMinus className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

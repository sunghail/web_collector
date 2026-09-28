'use client';

import { useState } from 'react';
import { Check, Copy, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  DISPLAY_NAME_MAX_LENGTH,
  HANDLE_PATTERN,
  STATUS_MAX_LENGTH,
  normalizeHandle,
  type Person,
} from '@/lib/chat';
import { useMyProfile } from '@/lib/myProfile';
import { Avatar, errorMessage } from './SocialParts';

/** My profile at the top of the Friends screen: see it, copy my @ID, or edit everything in place. */
export function ProfileCard({ profile }: { profile: Person }) {
  const setMyProfile = useMyProfile((s) => s.set);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draft, setDraft] = useState({ handle: '', name: '', status: '', emoji: null as string | null, color: null as string | null });

  const startEditing = () => {
    setDraft({
      handle: profile.handle,
      name: profile.name ?? '',
      status: profile.status ?? '',
      emoji: profile.emoji ?? null,
      color: profile.color ?? null,
    });
    setIsEditing(true);
  };

  const handle = normalizeHandle(draft.handle);
  const isHandleValid = HANDLE_PATTERN.test(handle);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isHandleValid) return;
    setIsSaving(true);
    try {
      const response = await api.put('/profile', {
        handle,
        name: draft.name,
        status: draft.status,
        emoji: draft.emoji,
        color: draft.color,
      });
      setMyProfile(response.data.profile);
      setIsEditing(false);
      toast.success('Your profile is updated');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save your profile'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isEditing) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">My profile</div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <Avatar {...profile} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xl font-semibold tracking-[-0.02em]">{profile.name || `@${profile.handle}`}</div>
            {profile.name && <div className="truncate text-sm text-muted-foreground">@{profile.handle}</div>}
            <div className="mt-1 truncate text-sm text-muted-foreground">{profile.status || 'No status yet'}</div>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard?.writeText(`@${profile.handle}`);
                toast.success('ID copied');
              }}
            >
              <Copy className="size-3.5" />
              Copy ID
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEditing}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Share your ID so friends can find you. Your login name stays private.</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-4">
        <Avatar handle={handle || profile.handle} name={draft.name} emoji={draft.emoji} color={draft.color} size="xl" />
        <div className="text-sm text-muted-foreground">Pick an emoji and a color. Everyone sees it next to your messages.</div>
      </div>

      <div className="space-y-2">
        <div className="text-[13px] font-medium">Avatar</div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-12" role="radiogroup" aria-label="Avatar emoji">
          <button
            type="button"
            role="radio"
            aria-checked={draft.emoji === null}
            onClick={() => setDraft({ ...draft, emoji: null })}
            title="First letter instead"
            className={`flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
              draft.emoji === null ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-accent'
            }`}
          >
            Aa
          </button>
          {AVATAR_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={draft.emoji === emoji}
              aria-label={emoji}
              onClick={() => setDraft({ ...draft, emoji })}
              className={`flex size-9 items-center justify-center rounded-lg text-xl leading-none transition-colors ${
                draft.emoji === emoji ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-accent'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1" role="radiogroup" aria-label="Avatar color">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={draft.color === color}
              aria-label={color}
              onClick={() => setDraft({ ...draft, color })}
              className={`flex size-7 items-center justify-center rounded-full border border-black/10 transition-transform ${
                draft.color === color ? 'ring-2 ring-foreground/60 ring-offset-2 ring-offset-card' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: color }}
            >
              {draft.color === color && <Check className="size-3.5 text-neutral-800" strokeWidth={3} />}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[13px] font-medium">Name</span>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            placeholder="How people see you, e.g. Minji"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[13px] font-medium">ID</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
            <Input
              value={draft.handle}
              onChange={(e) => setDraft({ ...draft, handle: e.target.value })}
              className="pl-7"
              maxLength={21}
              aria-invalid={!isHandleValid}
            />
          </div>
          <span className={`block text-xs ${isHandleValid ? 'text-muted-foreground' : 'text-destructive'}`}>
            3–20 characters: lowercase letters, numbers, _ and .
          </span>
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[13px] font-medium">Status</span>
        <Input
          value={draft.status}
          onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          maxLength={STATUS_MAX_LENGTH}
          placeholder="What are you up to? e.g. Reading papers 📚"
        />
      </label>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isHandleValid || isSaving}>
          {isSaving ? 'Saving…' : 'Save profile'}
        </Button>
      </div>
    </form>
  );
}

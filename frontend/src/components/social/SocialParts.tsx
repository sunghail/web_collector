'use client';

import type { ReactNode } from 'react';
import { Menu } from 'lucide-react';

export type ApiError = { response?: { status?: number; data?: { error?: string } } };

export function errorMessage(error: unknown, fallback: string) {
  return (error as ApiError)?.response?.data?.error || fallback;
}

export function isSetupRequired(error: unknown) {
  return (error as ApiError)?.response?.data?.error === 'setup_required';
}

const avatarSizes = {
  xs: { box: 'size-6', letter: 'text-[10px]', emoji: 'text-sm' },
  sm: { box: 'size-7', letter: 'text-[11px]', emoji: 'text-base' },
  chat: { box: 'size-8', letter: 'text-xs', emoji: 'text-lg' },
  md: { box: 'size-9', letter: 'text-xs', emoji: 'text-xl' },
  lg: { box: 'size-12', letter: 'text-base', emoji: 'text-2xl' },
  xl: { box: 'size-16', letter: 'text-xl', emoji: 'text-4xl' },
} as const;

/**
 * A person's picture: their emoji on their color when they picked one,
 * otherwise the first letter of their name or @ID.
 */
export function Avatar({
  handle,
  name,
  emoji,
  color,
  size = 'md',
  tone = 'muted',
}: {
  handle: string;
  name?: string | null;
  emoji?: string | null;
  color?: string | null;
  size?: keyof typeof avatarSizes;
  tone?: 'muted' | 'primary';
}) {
  const dims = avatarSizes[size];
  if (emoji) {
    return (
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-full font-sans leading-none ${dims.box} ${dims.emoji}`}
        style={{ backgroundColor: color || '#e5e7eb' }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`
        flex shrink-0 items-center justify-center rounded-full font-sans font-semibold ${dims.box} ${dims.letter}
        ${color ? 'text-neutral-800' : tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}
      `}
      style={color ? { backgroundColor: color } : undefined}
    >
      {(name || handle).charAt(0).toUpperCase()}
    </span>
  );
}

/** "Minji @minji" (or just "@minji" before they set a name), with an optional status line. */
export function PersonName({
  person,
  showStatus = false,
  suffix,
}: {
  person: { handle: string; name?: string | null; status?: string | null };
  showStatus?: boolean;
  suffix?: ReactNode;
}) {
  return (
    <span className="block min-w-0">
      <span className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-sm font-semibold">{person.name || `@${person.handle}`}</span>
        {person.name && <span className="shrink-0 truncate text-xs text-muted-foreground">@{person.handle}</span>}
        {suffix}
      </span>
      {showStatus && person.status && <span className="block truncate text-xs text-muted-foreground">{person.status}</span>}
    </span>
  );
}

/** The top bar used by the Friends and Chats screens. */
export function PageHeader({ icon, title, subtitle, onOpenSidebar, actions }: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onOpenSidebar: () => void;
  actions?: ReactNode;
}) {
  return (
    <header className="shrink-0 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 md:px-8">
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open sidebar"
          className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
        >
          <Menu className="size-5" />
        </button>
        <span className="shrink-0 text-primary">{icon}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-semibold leading-tight tracking-[-0.015em]">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}

export function SetupNotice() {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <h2 className="text-[15px] font-semibold">Friends and chats are not set up yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Run <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/20260927_add_friends_and_chat_rooms.sql</code> in the
        Supabase SQL editor, then reload this page.
      </p>
    </div>
  );
}

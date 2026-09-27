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

export function Avatar({ handle, size = 'md', tone = 'muted' }: { handle: string; size?: 'sm' | 'md'; tone?: 'muted' | 'primary' }) {
  return (
    <span
      aria-hidden="true"
      className={`
        flex shrink-0 items-center justify-center rounded-full font-semibold
        ${size === 'sm' ? 'size-7 text-[11px]' : 'size-9 text-xs'}
        ${tone === 'primary' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}
      `}
    >
      {handle.charAt(0).toUpperCase()}
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

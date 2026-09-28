import Link from 'next/link';
import type { ReactNode } from 'react';

export const LEGAL_UPDATED = 'September 28, 2026';
export const REPO_URL = 'https://github.com/sunghail/web_collector';

/** Shared frame for the privacy policy and terms pages. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <nav className="mx-auto flex max-w-3xl items-center px-5 py-4 sm:px-8 sm:py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icon.png" alt="" className="size-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Web Collector</span>
        </Link>
      </nav>
      <main className="mx-auto max-w-3xl px-5 pb-20 sm:px-8">
        <h1 className="mt-6 text-3xl font-bold tracking-[-0.02em]">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
      <LegalFooter />
    </div>
  );
}

export function LegalFooter() {
  return (
    <footer className="flex items-center justify-center gap-4 border-t border-border py-6 text-xs text-muted-foreground">
      <span>Web Collector</span>
      <Link href="/privacy" className="hover:text-foreground">
        Privacy
      </Link>
      <Link href="/terms" className="hover:text-foreground">
        Terms
      </Link>
    </footer>
  );
}

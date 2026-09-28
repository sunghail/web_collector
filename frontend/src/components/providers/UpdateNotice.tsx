'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';

/** The build this page was loaded from (set in next.config.ts). */
const LOADED_BUILD = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Tells people when a newer version of the site has been deployed, with a button to refresh.
 * Pages (and the desktop app, which shows the site) otherwise keep running the old code until reopened.
 */
export function UpdateNotice() {
  const pathname = usePathname();
  // Small widget windows refresh with the main app; no notice there.
  const isWidget = pathname?.startsWith('/widget');

  useEffect(() => {
    if (LOADED_BUILD === 'dev' || isWidget) return;
    let isShown = false;

    const check = async () => {
      if (isShown || document.hidden) return;
      try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (!response.ok) return;
        const { buildId } = (await response.json()) as { buildId?: string };
        if (!buildId || buildId === 'dev' || buildId === LOADED_BUILD) return;
        isShown = true;
        toast('A new version of Web Collector is ready', {
          id: 'new-version',
          description: 'Refresh to get the latest changes.',
          duration: Infinity,
          action: { label: 'Refresh', onClick: () => window.location.reload() },
        });
      } catch {
        // Offline or the server is busy: try again on the next check.
      }
    };

    const onVisible = () => {
      if (!document.hidden) check();
    };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    check();
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isWidget]);

  return null;
}

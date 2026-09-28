'use client';

import { useEffect, useState } from 'react';
import { Download, Laptop, Monitor, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LatestRelease } from '@/lib/release';

type Os = 'windows' | 'mac' | 'mobile' | 'other';

function detectOs(): Os {
  const ua = navigator.userAgent;
  // iPads can report themselves as a Mac; touch support gives them away.
  if (/Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'mobile';
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || ua;
  if (/Win/i.test(platform)) return 'windows';
  if (/Mac/i.test(platform)) return 'mac';
  return 'other';
}

function formatSize(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

const dateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' });

const platforms = {
  windows: { label: 'Windows', icon: <Monitor className="size-4" />, note: 'Windows 10 or later' },
  mac: { label: 'Mac', icon: <Laptop className="size-4" />, note: 'Intel and Apple Silicon' },
} as const;

/** "Get the desktop app" block on the landing page. Buttons always point at the newest release. */
export function DownloadSection() {
  const [os, setOs] = useState<Os>('other');
  const [release, setRelease] = useState<LatestRelease | null | undefined>(undefined);
  const [releasesPage, setReleasesPage] = useState('https://github.com/sunghail/web_collector/releases');
  const [isInApp, setIsInApp] = useState(false);

  useEffect(() => {
    setOs(detectOs());
    setIsInApp(Boolean(window.electronAPI));
    fetch('/api/download/latest')
      .then((r) => r.json())
      .then((data) => {
        setRelease(data.release ?? null);
        if (data.releasesPage) setReleasesPage(data.releasesPage);
      })
      .catch(() => setRelease(null));
  }, []);

  // Already running the desktop app: nothing to download.
  if (isInApp) return null;

  const primary: 'windows' | 'mac' = os === 'mac' ? 'mac' : 'windows';
  const secondary: 'windows' | 'mac' = primary === 'mac' ? 'windows' : 'mac';
  const isLoading = release === undefined;
  const hasRelease = Boolean(release && (release.windows || release.mac));

  const button = (platform: 'windows' | 'mac', variant: 'default' | 'outline') => {
    const installer = release?.[platform];
    const info = platforms[platform];
    return (
      <Button asChild={Boolean(installer)} variant={variant} disabled={!installer} className="h-11 w-full justify-start gap-2.5 px-4">
        {installer ? (
          <a href={`/api/download/${platform}`}>
            {info.icon}
            <span className="flex-1 text-left">Download for {info.label}</span>
            <span className="text-xs opacity-75">{formatSize(installer.size)}</span>
          </a>
        ) : (
          <span className="flex w-full items-center gap-2.5">
            {info.icon}
            <span className="flex-1 text-left">{info.label} {isLoading ? '…' : '· coming soon'}</span>
          </span>
        )}
      </Button>
    );
  };

  return (
    <section id="download" aria-labelledby="download-title" className="mx-auto max-w-4xl scroll-mt-24">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="grid items-center gap-6 sm:grid-cols-[1fr_280px]">
          <div>
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Download className="size-5" />
            </div>
            <h2 id="download-title" className="text-2xl font-bold tracking-[-0.02em]">Get the desktop app</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Your links one click away, with a tray icon and floating category widgets. It uses the same account as the website.
            </p>
            {release && (
              <p className="mt-3 text-xs text-muted-foreground">
                Version {release.version} · {dateFormat.format(new Date(release.publishedAt))} ·{' '}
                <a href={release.releaseUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                  What&apos;s new
                </a>
              </p>
            )}
          </div>

          <div className="space-y-2">
            {os === 'mobile' ? (
              <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                The desktop app is for Windows and Mac. Open this page on your computer to download it.
              </p>
            ) : (
              <>
                {button(primary, 'default')}
                <p className="px-1 text-xs text-muted-foreground">{platforms[primary].note}</p>
                <div className="pt-1">{button(secondary, 'outline')}</div>
              </>
            )}
            {!isLoading && !hasRelease && (
              <p className="px-1 text-xs text-muted-foreground">
                No release yet.{' '}
                <a href={releasesPage} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                  Check the releases page
                </a>
              </p>
            )}
          </div>
        </div>

        <details className="group mt-6 rounded-xl border border-border px-4 py-3 text-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
            <ShieldAlert className="size-4 text-muted-foreground" />
            Seeing a security warning when you install?
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
          </summary>
          <div className="mt-3 grid gap-4 text-muted-foreground sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Windows</p>
              <p>
                If Windows says it protected your PC, click <b>More info</b>, then <b>Run anyway</b>. The app is not yet signed with a
                paid certificate, so Windows does not recognize it.
              </p>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium text-foreground">Mac</p>
              <p>
                Open the file and drag <b>Web Collector</b> into Applications. The first time you open it, go to <b>System Settings →
                Privacy &amp; Security</b> and click <b>Open Anyway</b>. On older macOS, right-click the app and choose <b>Open</b>.
              </p>
              <p className="text-xs">
                New Mac versions are announced in the app; download them here and replace the old app.
              </p>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}

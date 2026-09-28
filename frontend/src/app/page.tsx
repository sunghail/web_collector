'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, FolderTree, Layers, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useAuthStore } from '@/store/authStore';
import { getFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import { DownloadSection } from '@/components/download/DownloadSection';

const previewSections = [
  {
    name: 'Work',
    color: '#34c759',
    links: [
      { title: 'Team docs', domain: 'docs.example.com', icon: 'stacked-pages' },
      { title: 'Deploys', domain: 'deploy.example.com', icon: 'command-tile' },
      { title: 'Design files', domain: 'design.example.com', icon: 'gem-link' },
    ],
  },
  {
    name: 'Reading',
    color: '#007AFF',
    links: [
      { title: 'Papers', domain: 'papers.example.com', icon: 'search-lens' },
      { title: 'Newsletter', domain: 'news.example.com', icon: 'paper-plane' },
    ],
  },
];

const features = [
  {
    icon: <FolderTree className="size-4" />,
    title: 'Categories you control',
    body: 'Color them, reorder them, and drag links between them.',
  },
  {
    icon: <Layers className="size-4" />,
    title: 'Macros',
    body: 'Open a set of sites together, like your morning routine.',
  },
  {
    icon: <MousePointerClick className="size-4" />,
    title: 'One click away',
    body: 'Search with /, and import or export your bookmarks any time.',
  },
];

function PreviewCard({ title, domain, icon }: { title: string; domain: string; icon: string }) {
  return (
    <div className="flex h-14 items-center gap-3 rounded-xl border border-border bg-card px-3 shadow-card">
      <img src={getFallbackFaviconDataUrl(icon)} alt="" className="size-8 rounded-lg" />
      <div className="min-w-0">
        <div className="truncate text-[13px] font-semibold">{title}</div>
        <div className="truncate text-[11px] text-muted-foreground">{domain}</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <img src="/icon.png" alt="" className="size-7 rounded-lg" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Web Collector</span>
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <a href="#download">Download</a>
          </Button>
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="fade-in mx-auto max-w-2xl pb-14 pt-12 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground shadow-card">
            <span className="size-1.5 rounded-full bg-primary" />
            Personal bookmark manager
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-[56px]">
            Every site you use,
            <br />
            on one calm page.
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
            Save links, sort them into categories, and open them in a click. On the web or as a desktop app.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Button asChild className="h-11 w-full gap-2 px-5 sm:w-auto">
              <Link href="/register">
                Start collecting
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full px-5 sm:w-auto">
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </section>

        {/* A still picture of the dashboard, drawn with the real card style. */}
        <section aria-label="Preview" className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-raised">
            <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted/50 px-4">
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
              <span className="size-2.5 rounded-full bg-border" />
            </div>
            <div className="flex">
              <div className="hidden w-44 shrink-0 space-y-1 border-r border-border bg-sidebar p-3 sm:block">
                <div className="rounded-lg bg-card px-2.5 py-1.5 text-[12px] font-medium shadow-card ring-1 ring-border/70">All links</div>
                <div className="px-2.5 py-1.5 text-[12px] text-muted-foreground">Inbox</div>
                <div className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Categories</div>
                {previewSections.map((section) => (
                  <div key={section.name} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-muted-foreground">
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: section.color }} />
                    {section.name}
                  </div>
                ))}
              </div>
              <div className="flex-1 space-y-6 p-5 sm:p-6">
                {previewSections.map((section) => (
                  <div key={section.name} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: section.color }} />
                      <span className="text-[13px] font-semibold">{section.name}</span>
                      <span className="text-[11px] text-muted-foreground">{section.links.length}</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {section.links.map((link) => (
                        <PreviewCard key={link.title} {...link} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-4xl gap-6 py-16 sm:grid-cols-3 sm:py-20">
          {features.map((feature) => (
            <div key={feature.title} className="space-y-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">{feature.icon}</div>
              <h2 className="text-[15px] font-semibold">{feature.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </section>
        <div className="pb-20">
          <DownloadSection />
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Web Collector
      </footer>
    </div>
  );
}

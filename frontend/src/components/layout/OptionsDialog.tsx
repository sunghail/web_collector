'use client';

import { useEffect, useState } from 'react';
import { Info, LayoutGrid, MessageSquare, Palette, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { WebStyleSettings } from '@/components/settings/WebStyleSettings';
import { LinkCardSettings } from '@/components/settings/LinkCardSettings';
import { AppSettings } from '@/components/settings/AppSettings';
import { ChatSettings } from '@/components/settings/ChatSettings';
import { useLanguage, useT, type Language, type MessageKey } from '@/lib/i18n';

type Tab = 'style' | 'cards' | 'chat' | 'app';

const tabs: { id: Tab; name: MessageKey; icon: React.ReactNode }[] = [
  { id: 'style', name: 'tab.style', icon: <Palette className="size-4" /> },
  { id: 'cards', name: 'tab.cards', icon: <LayoutGrid className="size-4" /> },
  { id: 'chat', name: 'tab.chat', icon: <MessageSquare className="size-4" /> },
  { id: 'app', name: 'tab.app', icon: <Info className="size-4" /> },
];

const languages: { id: Language; name: string }[] = [
  { id: 'ko', name: '한국어' },
  { id: 'en', name: 'English' },
];

export function OptionsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('style');
  const { language, setLanguage, hydrate } = useLanguage();
  const t = useT();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label={t('settings.title')} title={t('settings.title')} className={triggerClassName}>
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[540px] lg:max-w-[900px]">
        <DialogHeader className="space-y-3 border-b border-border px-6 pb-4 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle>{t('settings.title')}</DialogTitle>
              <DialogDescription className="mt-1">{t('settings.description')}</DialogDescription>
            </div>
            <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label={t('settings.language')}>
              {languages.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={language === option.id}
                  onClick={() => setLanguage(option.id)}
                  className={`h-7 rounded-md px-2.5 text-xs transition-colors ${
                    language === option.id ? 'bg-primary font-medium text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5" role="tablist" aria-label={t('settings.sections')}>
            {tabs.map((option) => {
              const isSelected = tab === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  id={`settings-tab-${option.id}`}
                  aria-selected={isSelected}
                  aria-controls={`settings-panel-${option.id}`}
                  onClick={() => setTab(option.id)}
                  className={`
                    flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] transition-colors
                    ${isSelected ? 'bg-card font-medium text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'}
                  `}
                >
                  <span className="hidden sm:inline-flex">{option.icon}</span>
                  {t(option.name)}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div
          role="tabpanel"
          id={`settings-panel-${tab}`}
          aria-labelledby={`settings-tab-${tab}`}
          className="custom-scrollbar min-h-[440px] flex-1 overflow-y-auto px-6 py-5"
        >
          {tab === 'style' && <WebStyleSettings />}
          {tab === 'cards' && <LinkCardSettings />}
          {tab === 'chat' && <ChatSettings />}
          {tab === 'app' && (
            <div className="max-w-[492px]">
              <AppSettings />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

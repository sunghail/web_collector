'use client';

import { useState } from 'react';
import { Info, LayoutGrid, Palette, Settings } from 'lucide-react';
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

type Tab = 'style' | 'cards' | 'app';

const tabs: { id: Tab; name: string; icon: React.ReactNode }[] = [
  { id: 'style', name: 'Web style', icon: <Palette className="size-4" /> },
  { id: 'cards', name: 'Link cards', icon: <LayoutGrid className="size-4" /> },
  { id: 'app', name: 'App', icon: <Info className="size-4" /> },
];

export function OptionsDialog({ triggerClassName }: { triggerClassName?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('style');

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button type="button" aria-label="Settings" title="Settings" className={triggerClassName}>
          <Settings className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[540px]">
        <DialogHeader className="space-y-3 border-b border-border px-6 pb-4 pt-6">
          <div>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className="mt-1">Changes apply right away and are saved on this device.</DialogDescription>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-0.5" role="tablist" aria-label="Settings sections">
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
                  {option.icon}
                  {option.name}
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
          {tab === 'app' && <AppSettings />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

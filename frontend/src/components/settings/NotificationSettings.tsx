'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { notificationPermission, useNotificationPreferences, type NotificationPreferences } from '@/lib/notificationPreferences';
import { showTestNotification } from '@/hooks/useMessageNotifications';
import { Group } from './SettingsParts';
import { useT, type MessageKey } from '@/lib/i18n';

const rows: { key: keyof NotificationPreferences; label: MessageKey; description: MessageKey }[] = [
  { key: 'direct', label: 'notify.direct', description: 'notify.directHint' },
  { key: 'groups', label: 'notify.groups', description: 'notify.groupsHint' },
  { key: 'mentions', label: 'notify.mentions', description: 'notify.mentionsHint' },
  { key: 'sound', label: 'notify.sound', description: 'notify.soundHint' },
  { key: 'preview', label: 'notify.preview', description: 'notify.previewHint' },
];

/** Message notifications: on/off, what to be told about, and the browser's permission. */
export function NotificationSettings() {
  const prefs = useNotificationPreferences();
  const { hydrate, setPreferences } = prefs;
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const t = useT();

  useEffect(() => {
    hydrate();
    setPermission(notificationPermission());
  }, [hydrate]);

  const askPermission = async () => {
    if (permission === 'unsupported') return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') toast.success(t('notify.on'));
  };

  const setEnabled = async (enabled: boolean) => {
    setPreferences({ enabled });
    if (enabled && permission === 'default') await askPermission();
  };

  return (
    <Group label={t('notify.title')} hint={t('notify.hint')}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium">{t('notify.main')}</div>
          <div className="text-xs text-muted-foreground">{t('notify.mainHint')}</div>
        </div>
        <Switch checked={prefs.enabled} onCheckedChange={setEnabled} aria-label={t('notify.main')} />
      </div>

      {prefs.enabled && permission === 'unsupported' && (
        <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{t('notify.unsupported')}</p>
      )}
      {prefs.enabled && permission === 'denied' && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {t('notify.denied')}
        </p>
      )}
      {prefs.enabled && permission === 'default' && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-primary/[0.07] px-3 py-2">
          <span className="text-xs">{t('notify.ask')}</span>
          <Button size="sm" onClick={askPermission}>
            {t('notify.allow')}
          </Button>
        </div>
      )}

      <div className={`space-y-2.5 border-t border-border pt-3 ${prefs.enabled ? '' : 'opacity-60'}`}>
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px]">{t(row.label)}</div>
              <div className="text-xs text-muted-foreground">{t(row.description)}</div>
            </div>
            <Switch
              checked={prefs[row.key]}
              onCheckedChange={(value) => setPreferences({ [row.key]: value })}
              disabled={!prefs.enabled}
              aria-label={t(row.label)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!prefs.enabled || permission !== 'granted'}
          onClick={() => {
            if (!showTestNotification(prefs.sound)) toast.error(t('notify.testFailed'));
          }}
        >
          <BellRing className="size-3.5" />
          {t('notify.test')}
        </Button>
      </div>
    </Group>
  );
}

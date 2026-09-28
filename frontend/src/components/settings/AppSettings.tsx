'use client';

import { useEffect, useState } from 'react';
import { Download, Laptop, Monitor, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Group } from './SettingsParts';
import { NotificationSettings } from './NotificationSettings';
import { useT, type Translate } from '@/lib/i18n';

const idleUpdateStatus: UpdateStatusPayload = {
  status: 'idle',
  message: 'Check for updates.',
  currentVersion: '',
};

/** The update status in the chosen language (the desktop app reports it in English). */
function describeUpdate(update: UpdateStatusPayload, t: Translate) {
  const version = update.version ?? '';
  const text = (() => {
    switch (update.status) {
      case 'idle':
        return t('update.msg.idle');
      case 'checking':
        return t('update.msg.checking');
      case 'not-available':
        return t('update.msg.latest');
      case 'available':
        return update.message.startsWith('Opened') ? t('update.msg.openedPage') : t('update.msg.available', { version });
      case 'downloading':
        return t('update.msg.downloading', { percent: update.percent ?? 0 });
      case 'downloaded':
        return update.message.startsWith('Restarting') ? t('update.msg.restarting') : t('update.msg.downloaded', { version });
      case 'unsupported':
        return t('update.msg.unsupported');
      default:
        return t('update.msg.error', { detail: update.message.replace(/^Update (check|download) failed: /, '') });
    }
  })();
  // No version number known: drop the empty "()".
  return text.replace(/s*()/, '');
}

function getUpdateRows(updateStatus: UpdateStatusPayload, t: Translate) {
  const isDownloaded = updateStatus.status === 'downloaded';
  const isDownloading = updateStatus.status === 'downloading';
  const hasUpdate = updateStatus.status === 'available' || isDownloading || isDownloaded;
  const downloadPercent = isDownloaded ? 100 : isDownloading ? Math.min(updateStatus.percent ?? 0, 100) : 0;

  return [
    {
      label: t('update.downloadCheck'),
      value: hasUpdate ? '100%' : updateStatus.status === 'checking' ? t('update.checking') : t('update.ready'),
      percent: hasUpdate ? 100 : updateStatus.status === 'checking' ? 45 : 0,
    },
    {
      label: t('update.applyInstaller'),
      value: isDownloaded ? t('update.ready') : isDownloading ? `${downloadPercent}%` : t('update.waiting'),
      percent: downloadPercent,
    },
  ];
}

export function AppSettings() {
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusPayload>(idleUpdateStatus);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const t = useT();

  useEffect(() => {
    const electronAPI = window.electronAPI;
    setIsDesktopApp(Boolean(electronAPI));
    electronAPI?.getAppVersion?.()
      .then((version) => {
        setAppVersion(version);
        setUpdateStatus((prev) => ({ ...prev, currentVersion: version }));
      })
      .catch(() => undefined);

    electronAPI?.onUpdateStatus?.((payload) => {
      setUpdateStatus(payload);
      if (payload.currentVersion) setAppVersion(payload.currentVersion);
    });

    return () => {
      electronAPI?.removeUpdateStatusListener?.();
    };
  }, []);

  const handleUpdateAction = async () => {
    const electronAPI = window.electronAPI;

    if (!electronAPI?.checkForUpdates) {
      setUpdateStatus({
        status: 'unsupported',
        message: 'Updates are available only in the desktop app.',
        currentVersion: appVersion,
      });
      return;
    }

    if (updateStatus.status === 'downloaded' && electronAPI.installUpdate) {
      setUpdateStatus(await electronAPI.installUpdate());
      return;
    }

    if (updateStatus.status === 'available' && electronAPI.downloadUpdate) {
      setUpdateStatus({ ...updateStatus, status: 'downloading', message: 'Downloading update.' });
      setUpdateStatus(await electronAPI.downloadUpdate());
      return;
    }

    setUpdateStatus({ status: 'checking', message: 'Checking for updates.', currentVersion: appVersion });
    setUpdateStatus(await electronAPI.checkForUpdates());
  };

  const isBusy = updateStatus.status === 'checking' || updateStatus.status === 'downloading';
  const buttonLabel =
    updateStatus.status === 'available'
      ? t('update.download')
      : updateStatus.status === 'downloaded'
        ? t('update.restart')
        : updateStatus.status === 'checking'
          ? t('update.checking')
          : updateStatus.status === 'downloading'
            ? `${updateStatus.percent ?? 0}%`
            : t('update.check');
  const buttonIcon =
    updateStatus.status === 'available' || updateStatus.status === 'downloading' ? (
      <Download className={updateStatus.status === 'downloading' ? 'animate-pulse' : ''} />
    ) : updateStatus.status === 'downloaded' ? (
      <RotateCcw />
    ) : (
      <RefreshCw className={updateStatus.status === 'checking' ? 'animate-spin' : ''} />
    );
  const showProgress = ['checking', 'available', 'downloading', 'downloaded'].includes(updateStatus.status);

  return (
    <div className="space-y-4">
      <NotificationSettings />

      {!isDesktopApp && (
        <Group label={t('app.desktop')}>
          <p className="text-[13px] text-muted-foreground">{t('app.desktopHint')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="gap-2">
              <a href="/api/download/windows">
                <Monitor className="size-4" />
                Windows
              </a>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="/api/download/mac">
                <Laptop className="size-4" />
                Mac
              </a>
            </Button>
          </div>
        </Group>
      )}

      {isDesktopApp && (
      <Group label={t('app.updates')}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px]">{appVersion ? t('app.version', { version: appVersion }) : 'Web Collector'}</div>
            <div className="text-xs text-muted-foreground">{describeUpdate(updateStatus, t)}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant={updateStatus.status === 'downloaded' ? 'default' : 'outline'}
            onClick={handleUpdateAction}
            disabled={isBusy}
          >
            {buttonIcon}
            {buttonLabel}
          </Button>
        </div>
        {showProgress && (
          <div className="grid gap-2">
            {getUpdateRows(updateStatus, t).map((row) => (
              <div key={row.label} className="rounded-lg border border-border p-2.5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium">{row.label}</span>
                  <span className="text-muted-foreground">{row.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${row.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Group>
      )}

      <Group label={t('app.keyboard')}>
        <div className="flex items-center justify-between text-[13px]">
          <span>{t('key.quickOpen')}</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">Ctrl K</kbd>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span>{t('key.search')}</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">/</kbd>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span>{t('key.clearSearch')}</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">Esc</kbd>
        </div>
      </Group>
    </div>
  );
}

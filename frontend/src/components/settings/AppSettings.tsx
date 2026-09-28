'use client';

import { useEffect, useState } from 'react';
import { Download, Laptop, Monitor, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Group } from './SettingsParts';

const idleUpdateStatus: UpdateStatusPayload = {
  status: 'idle',
  message: 'Check for updates.',
  currentVersion: '',
};

function getUpdateRows(updateStatus: UpdateStatusPayload) {
  const isDownloaded = updateStatus.status === 'downloaded';
  const isDownloading = updateStatus.status === 'downloading';
  const hasUpdate = updateStatus.status === 'available' || isDownloading || isDownloaded;
  const downloadPercent = isDownloaded ? 100 : isDownloading ? Math.min(updateStatus.percent ?? 0, 100) : 0;

  return [
    {
      label: 'Download check',
      value: hasUpdate ? '100%' : updateStatus.status === 'checking' ? 'Checking' : 'Ready',
      percent: hasUpdate ? 100 : updateStatus.status === 'checking' ? 45 : 0,
    },
    {
      label: 'Apply installer',
      value: isDownloaded ? 'Ready' : isDownloading ? `${downloadPercent}%` : 'Waiting',
      percent: downloadPercent,
    },
  ];
}

export function AppSettings() {
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusPayload>(idleUpdateStatus);
  const [isDesktopApp, setIsDesktopApp] = useState(false);

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
      ? 'Download'
      : updateStatus.status === 'downloaded'
        ? 'Restart to install'
        : updateStatus.status === 'checking'
          ? 'Checking'
          : updateStatus.status === 'downloading'
            ? `${updateStatus.percent ?? 0}%`
            : 'Check for updates';
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
      {!isDesktopApp && (
        <Group label="Desktop app">
          <p className="text-[13px] text-muted-foreground">
            Tray icon, floating category widgets and automatic updates. Same account as this website.
          </p>
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
      <Group label="Updates">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px]">{appVersion ? `Version ${appVersion}` : 'Web Collector'}</div>
            <div className="text-xs text-muted-foreground">{updateStatus.message}</div>
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
            {getUpdateRows(updateStatus).map((row) => (
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

      <Group label="Keyboard">
        <div className="flex items-center justify-between text-[13px]">
          <span>Search links</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">/</kbd>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span>Clear search</span>
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">Esc</kbd>
        </div>
      </Group>
    </div>
  );
}

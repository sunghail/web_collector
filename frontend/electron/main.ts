import { app, BrowserWindow, shell, ipcMain, Menu, screen } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { startNextServer, stopNextServer } from './next-server';
import { createTray, destroyTray } from './tray';

interface WidgetCategoryData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  defaultFaviconId?: string | null;
}

interface WidgetState {
  window: BrowserWindow;
  categories: WidgetCategoryData[];
  activeCategoryId: string;
}

interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface WidgetLayoutEntry {
  categories: WidgetCategoryData[];
  activeCategoryId: string;
  bounds: WidgetBounds;
}

interface WidgetLayoutFile {
  version: 1;
  widgets: WidgetLayoutEntry[];
}

type UpdateStatus =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'unsupported';

interface UpdateStatusPayload {
  status: UpdateStatus;
  message: string;
  currentVersion: string;
  version?: string;
  percent?: number;
}

let mainWindow: BrowserWindow | null = null;
let appBaseUrl: string | null = null;
let nextServerPort: number | null = null;
const widgetStates = new Map<number, WidgetState>();

const isDev = !app.isPackaged;
const useSingleInstanceLock = app.isPackaged;
const WIDGET_WIDTH = 340;
const WIDGET_HEIGHT = 560;
let widgetLayoutSaveTimer: NodeJS.Timeout | null = null;
let updateDownloaded = false;
let updateDownloadedVersion: string | undefined;
let isQuitting = false;

// High-DPI support for Windows
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');

function isExternalUrl(url: string) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function sendUpdateStatus(payload: UpdateStatusPayload) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('app:update-status', payload);
    }
  }
}

function makeUpdatePayload(
  status: UpdateStatus,
  message: string,
  options: Omit<Partial<UpdateStatusPayload>, 'status' | 'message' | 'currentVersion'> = {}
): UpdateStatusPayload {
  return {
    status,
    message,
    currentVersion: app.getVersion(),
    ...options,
  };
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus(makeUpdatePayload('checking', 'Checking for updates.'));
  });

  autoUpdater.on('update-available', (info) => {
    updateDownloaded = false;
    updateDownloadedVersion = info.version;
    sendUpdateStatus(
      makeUpdatePayload('available', `Version ${info.version} is available.`, {
        version: info.version,
      })
    );
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus(
      makeUpdatePayload('not-available', 'You are using the latest version.', {
        version: info.version,
      })
    );
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    sendUpdateStatus(
      makeUpdatePayload('downloading', `Downloading update. ${percent}%`, {
        version: updateDownloadedVersion,
        percent,
      })
    );
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true;
    updateDownloadedVersion = info.version;
    sendUpdateStatus(
      makeUpdatePayload('downloaded', `Version ${info.version} has been downloaded.`, {
        version: info.version,
        percent: 100,
      })
    );
  });

  autoUpdater.on('error', (error) => {
    sendUpdateStatus(
      makeUpdatePayload('error', `Update check failed: ${getErrorMessage(error)}`)
    );
  });
}

async function checkForAppUpdates(): Promise<UpdateStatusPayload> {
  if (!app.isPackaged) {
    return makeUpdatePayload('unsupported', 'Updates are available only in the installed desktop app.');
  }

  try {
    updateDownloaded = false;
    updateDownloadedVersion = undefined;
    const result = await autoUpdater.checkForUpdates();
    const version = result?.updateInfo?.version;

    if (version && version !== app.getVersion()) {
      return makeUpdatePayload('available', `Version ${version} is available.`, {
        version,
      });
    }

    return makeUpdatePayload('not-available', 'You are using the latest version.', {
      version,
    });
  } catch (error) {
    return makeUpdatePayload('error', `Update check failed: ${getErrorMessage(error)}`);
  }
}

async function downloadAppUpdate(): Promise<UpdateStatusPayload> {
  if (!app.isPackaged) {
    return makeUpdatePayload('unsupported', 'Updates are available only in the installed desktop app.');
  }

  try {
    await autoUpdater.downloadUpdate();
    return makeUpdatePayload(
      updateDownloaded ? 'downloaded' : 'downloading',
      updateDownloaded
        ? `Version ${updateDownloadedVersion} has been downloaded.`
        : 'Downloading update.',
      {
        version: updateDownloadedVersion,
        percent: updateDownloaded ? 100 : undefined,
      }
    );
  } catch (error) {
    return makeUpdatePayload('error', `Update download failed: ${getErrorMessage(error)}`);
  }
}

function installAppUpdate(): UpdateStatusPayload {
  if (!app.isPackaged) {
    return makeUpdatePayload('unsupported', 'Updates are available only in the installed desktop app.');
  }

  if (!updateDownloaded) {
    return makeUpdatePayload('error', 'Download the update first.', {
      version: updateDownloadedVersion,
    });
  }

  autoUpdater.quitAndInstall(true, true);
  return makeUpdatePayload('downloaded', 'Restarting to install the update.', {
    version: updateDownloadedVersion,
    percent: 100,
  });
}

function normalizeOpenPath(targetPath: string) {
  if (process.platform !== 'win32' && targetPath.startsWith('~/')) {
    return path.join(app.getPath('home'), targetPath.slice(2));
  }

  return targetPath;
}

function configureExternalLinkHandling(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

async function ensureAppBaseUrl() {
  if (appBaseUrl) {
    return appBaseUrl;
  }

  if (isDev) {
    appBaseUrl = process.env.ELECTRON_DEV_URL || 'http://localhost:30101';
    return appBaseUrl;
  }

  if (nextServerPort === null) {
    nextServerPort = await startNextServer();
  }

  appBaseUrl = `http://localhost:${nextServerPort}`;
  return appBaseUrl;
}

async function loadRoute(window: BrowserWindow, route: string) {
  const baseUrl = await ensureAppBaseUrl();
  const targetUrl = new URL(route.startsWith('/') ? route : `/${route}`, `${baseUrl}/`);
  await window.loadURL(targetUrl.toString());
}

function getWidgetPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  const offset = widgetStates.size % 6;

  return {
    x: Math.max(workArea.x + 16, workArea.x + workArea.width - WIDGET_WIDTH - 24 - offset * 28),
    y: workArea.y + 48 + offset * 24,
  };
}

function getWidgetLayoutPath() {
  return path.join(app.getPath('userData'), 'widget-layout.json');
}

function readWidgetLayout(): WidgetLayoutEntry[] {
  try {
    const layoutPath = getWidgetLayoutPath();
    if (!fs.existsSync(layoutPath)) {
      return [];
    }

    const parsed = JSON.parse(fs.readFileSync(layoutPath, 'utf8')) as WidgetLayoutFile;
    if (!Array.isArray(parsed.widgets)) {
      return [];
    }

    return parsed.widgets.filter((entry) => {
      return (
        Array.isArray(entry.categories) &&
        entry.categories.length > 0 &&
        typeof entry.activeCategoryId === 'string' &&
        typeof entry.bounds?.x === 'number' &&
        typeof entry.bounds?.y === 'number' &&
        typeof entry.bounds?.width === 'number' &&
        typeof entry.bounds?.height === 'number'
      );
    });
  } catch (error) {
    console.warn('[widget] failed to read widget layout', error);
    return [];
  }
}

function writeWidgetLayout(entries: WidgetLayoutEntry[]) {
  try {
    const layoutPath = getWidgetLayoutPath();
    fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
    fs.writeFileSync(
      layoutPath,
      JSON.stringify(
        {
          version: 1,
          widgets: entries,
        } satisfies WidgetLayoutFile,
        null,
        2
      )
    );
  } catch (error) {
    console.warn('[widget] failed to write widget layout', error);
  }
}

function clampWidgetBounds(bounds: WidgetBounds): WidgetBounds {
  const display = screen.getDisplayMatching(bounds);
  const { workArea } = display;
  const width = Math.max(300, Math.min(bounds.width, workArea.width));
  const height = Math.max(420, Math.min(bounds.height, workArea.height));

  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
  };
}

function findSavedWidgetLayout(categoryId: string) {
  return readWidgetLayout().find((entry) => {
    return entry.categories.some((category) => category.categoryId === categoryId);
  });
}

function getWidgetLayoutEntriesFromWindows(): WidgetLayoutEntry[] {
  return Array.from(widgetStates.values())
    .filter((state) => !state.window.isDestroyed() && state.categories.length > 0)
    .map((state) => ({
      categories: state.categories,
      activeCategoryId: state.activeCategoryId,
      bounds: state.window.getBounds(),
    }));
}

function saveWidgetLayoutNow() {
  if (widgetLayoutSaveTimer) {
    clearTimeout(widgetLayoutSaveTimer);
    widgetLayoutSaveTimer = null;
  }

  writeWidgetLayout(getWidgetLayoutEntriesFromWindows());
}

function scheduleWidgetLayoutSave() {
  if (widgetLayoutSaveTimer) {
    clearTimeout(widgetLayoutSaveTimer);
  }

  widgetLayoutSaveTimer = setTimeout(saveWidgetLayoutNow, 250);
}

function removeWidgetLayoutForCategories(categories: WidgetCategoryData[]) {
  const ids = new Set(categories.map((category) => category.categoryId));
  const entries = readWidgetLayout().filter((entry) => {
    return !entry.categories.some((category) => ids.has(category.categoryId));
  });
  writeWidgetLayout(entries);
}

function findWidgetStateByCategory(categoryId: string) {
  for (const state of widgetStates.values()) {
    if (state.categories.some((category) => category.categoryId === categoryId)) {
      return state;
    }
  }

  return null;
}

function focusWidget(window: BrowserWindow) {
  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function closeAllWidgetWindows() {
  saveWidgetLayoutNow();
  const widgetWindows = Array.from(widgetStates.values()).map((state) => state.window);
  widgetStates.clear();

  for (const widgetWindow of widgetWindows) {
    if (!widgetWindow.isDestroyed()) {
      widgetWindow.destroy();
    }
  }
}

function closeWidgetWindow(widgetWindow: BrowserWindow | null) {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    return;
  }

  const state = widgetStates.get(widgetWindow.id);
  if (state) {
    removeWidgetLayoutForCategories(state.categories);
  }
  widgetStates.delete(widgetWindow.id);
  widgetWindow.close();
}

function removeCategoryFromWidget(widgetWindow: BrowserWindow | null, categoryId: string) {
  if (!widgetWindow || widgetWindow.isDestroyed()) {
    return;
  }

  const state = widgetStates.get(widgetWindow.id);
  if (!state) {
    return;
  }

  state.categories = state.categories.filter((category) => category.categoryId !== categoryId);

  if (state.categories.length === 0) {
    closeWidgetWindow(widgetWindow);
    return;
  }

  if (state.activeCategoryId === categoryId) {
    state.activeCategoryId = state.categories[0].categoryId;
    widgetWindow.webContents.send('widget:switch-category', state.activeCategoryId);
  }

  scheduleWidgetLayoutSave();
}

function toggleWidgetWindows() {
  if (widgetStates.size === 0) {
    return;
  }

  const shouldHide = Array.from(widgetStates.values()).some((state) => state.window.isVisible());

  for (const { window } of widgetStates.values()) {
    if (window.isDestroyed()) {
      continue;
    }

    if (shouldHide) {
      window.hide();
    } else {
      window.show();
    }
  }
}

function showWidgetWindow(widgetWindow: BrowserWindow, focus = true) {
  if (focus) {
    focusWidget(widgetWindow);
    return;
  }

  widgetWindow.showInactive();
}

function configureWidgetWindowBehavior(widgetWindow: BrowserWindow) {
  if (process.platform === 'darwin') {
    widgetWindow.setVisibleOnAllWorkspaces(true, {
      visibleOnFullScreen: true,
      skipTransformProcessType: true,
    });
    widgetWindow.setAlwaysOnTop(true, 'floating');
    widgetWindow.setFullScreenable(false);
    return;
  }

  widgetWindow.setAlwaysOnTop(true);
}

async function createWidgetWindow(
  category: WidgetCategoryData,
  restoredLayout?: WidgetLayoutEntry,
  options: { focus?: boolean } = {}
) {
  const preloadPath = path.join(__dirname, 'preload.js');
  const categories = restoredLayout?.categories?.length ? restoredLayout.categories : [category];
  const activeCategory =
    categories.find((item) => item.categoryId === restoredLayout?.activeCategoryId) || category;
  const fallbackPosition = getWidgetPosition();
  const initialBounds = restoredLayout?.bounds
    ? clampWidgetBounds(restoredLayout.bounds)
    : { ...fallbackPosition, width: WIDGET_WIDTH, height: WIDGET_HEIGHT };
  const shouldFocus = options.focus ?? true;

  console.log('[widget] create', category);
  const widgetWindow = new BrowserWindow({
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: 300,
    minHeight: 420,
    x: initialBounds.x,
    y: initialBounds.y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: process.platform !== 'darwin',
    title: `${activeCategory.categoryName} Widget`,
    icon: isDev
      ? path.join(__dirname, '..', 'resources', 'icon.png')
      : path.join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  configureExternalLinkHandling(widgetWindow);
  configureWidgetWindowBehavior(widgetWindow);

  widgetWindow.once('ready-to-show', () => {
    console.log('[widget] ready-to-show', widgetWindow.id);
    showWidgetWindow(widgetWindow, shouldFocus);
  });

  widgetWindow.webContents.on('did-finish-load', () => {
    console.log('[widget] did-finish-load', widgetWindow.id);
    if (!widgetWindow.isDestroyed()) {
      widgetWindow.webContents.send('widget:set-category', activeCategory);
      if (categories.length > 1) {
        widgetWindow.webContents.send(
          'widget:add-categories',
          categories.filter((item) => item.categoryId !== activeCategory.categoryId)
        );
      }
      if (!widgetWindow.isVisible()) {
        showWidgetWindow(widgetWindow, shouldFocus);
      }
    }
  });

  widgetWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[widget] did-fail-load', widgetWindow.id, errorCode, errorDescription);
  });

  widgetWindow.on('closed', () => {
    console.log('[widget] closed', widgetWindow.id);
    widgetStates.delete(widgetWindow.id);
    if (!isQuitting) {
      scheduleWidgetLayoutSave();
    }
  });

  widgetWindow.on('moved', scheduleWidgetLayoutSave);
  widgetWindow.on('resized', scheduleWidgetLayoutSave);

  widgetStates.set(widgetWindow.id, {
    window: widgetWindow,
    categories,
    activeCategoryId: activeCategory.categoryId,
  });

  const query = new URLSearchParams({
    categoryId: activeCategory.categoryId,
    categoryName: activeCategory.categoryName,
    categoryColor: activeCategory.categoryColor,
    ...(activeCategory.defaultFaviconId ? { defaultFaviconId: activeCategory.defaultFaviconId } : {}),
  });

  await loadRoute(widgetWindow, `/widget?${query.toString()}`);
  scheduleWidgetLayoutSave();

  return widgetWindow;
}

async function openWidget(category: WidgetCategoryData) {
  console.log('[widget] open request', category);
  const existing = findWidgetStateByCategory(category.categoryId);

  if (existing) {
    console.log('[widget] focus existing', existing.window.id, category.categoryId);
    existing.activeCategoryId = category.categoryId;
    existing.window.webContents.send('widget:switch-category', category.categoryId);
    focusWidget(existing.window);
    scheduleWidgetLayoutSave();
    return existing.window;
  }

  return createWidgetWindow(category, findSavedWidgetLayout(category.categoryId));
}

async function restoreWidgetWindows() {
  const layouts = readWidgetLayout();
  for (const layout of layouts) {
    const activeCategory =
      layout.categories.find((category) => category.categoryId === layout.activeCategoryId) ||
      layout.categories[0];

    if (!activeCategory || findWidgetStateByCategory(activeCategory.categoryId)) {
      continue;
    }

    await createWidgetWindow(activeCategory, layout, { focus: false });
  }
}

// Single instance lock
const gotTheLock = useSingleInstanceLock ? app.requestSingleInstanceLock() : true;

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    configureAutoUpdater();
    await createWindow();
    if (app.isPackaged) {
      await restoreWidgetWindows();
    }
  });
}

async function createWindow() {
  const preloadPath = path.join(__dirname, 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: isDev ? 'Web Collector (Dev)' : 'Web Collector',
    icon: isDev
      ? path.join(__dirname, '..', 'resources', 'icon.png')
      : path.join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Show when ready to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (app.isPackaged && !isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  configureExternalLinkHandling(mainWindow);

  // IPC: open multiple URLs in default browser
  ipcMain.handle('open-urls', async (_event, urls: string[]) => {
    for (const url of urls) {
      if (isExternalUrl(url)) {
        await shell.openExternal(url);
      }
    }
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:check-for-updates', async () => checkForAppUpdates());

  ipcMain.handle('app:download-update', async () => downloadAppUpdate());

  ipcMain.handle('app:install-update', () => installAppUpdate());

  ipcMain.handle('open-widget', async (_event, category: WidgetCategoryData) => {
    await openWidget(category);
  });

  ipcMain.on('open-path', async (_event, targetPath: string) => {
    if (!targetPath) {
      return;
    }

    await shell.openPath(normalizeOpenPath(targetPath));
  });

  ipcMain.on('widget:toggle', () => {
    toggleWidgetWindows();
  });

  ipcMain.on('widget:close-self', (event) => {
    const widgetWindow = BrowserWindow.fromWebContents(event.sender);
    closeWidgetWindow(widgetWindow);
  });

  ipcMain.on('widget:remove-category', (event, categoryId: string) => {
    const widgetWindow = BrowserWindow.fromWebContents(event.sender);
    removeCategoryFromWidget(widgetWindow, categoryId);
  });

  ipcMain.on('widget:detach-category', async (event, category: WidgetCategoryData) => {
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    removeCategoryFromWidget(sourceWindow, category.categoryId);
    await openWidget(category);
  });

  // Create system tray only for packaged builds to avoid dev/runtime collisions.
  if (app.isPackaged) {
    createTray(mainWindow);
  }

  // Load the app
  if (isDev) {
    // Development: connect to Next.js dev server
    const devUrl = await ensureAppBaseUrl();
    console.log(`Loading dev URL: ${devUrl}`);

    try {
      await loadRoute(mainWindow, '/');
    } catch (err) {
      console.error('Failed to load dev URL. Is Next.js dev server running?', err);
      // Retry after a short delay
      setTimeout(async () => {
        try {
          if (mainWindow) {
            await loadRoute(mainWindow, '/');
          }
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
        }
      }, 3000);
    }
  } else {
    // Production: start embedded Next.js server
    try {
      await loadRoute(mainWindow, '/');
    } catch (err) {
      console.error('Failed to start Next.js server:', err);
    }
  }
}

app.on('window-all-closed', () => {
  // On Windows, don't quit when all windows are closed (tray keeps running)
});

app.on('before-quit', () => {
  isQuitting = true;
  closeAllWidgetWindows();
  if (app.isPackaged) {
    destroyTray();
  }
  stopNextServer();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

import { app, BrowserWindow, dialog, shell, ipcMain, Menu, screen, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import fs from 'fs';
import { getAppUrl, isSignInPage } from './app-config';
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
const widgetStates = new Map<number, WidgetState>();
const UPDATE_CHECK_DELAY_MS = 15_000;
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
// macOS will not install updates for an unsigned app, so there we point people to the download page instead.
const canSelfInstallUpdates = process.platform !== 'darwin';
const promptedUpdateVersions = new Set<string>();
// Local files a widget link may open. Programs and scripts are refused.
const BLOCKED_OPEN_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh',
  '.hta', '.lnk', '.reg', '.jar', '.app', '.pkg', '.command', '.sh', '.dmg',
]);

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

function getDownloadPageUrl() {
  return `${getAppUrl()}/#download`;
}

/** On macOS: tell people once per version that a new release exists, and offer the download page. */
async function promptMacDownload(version: string) {
  if (promptedUpdateVersions.has(version)) return;
  promptedUpdateVersions.add(version);
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Open download page', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update available',
    message: `Web Collector ${version} is available.`,
    detail: 'Download the new version and replace the app in your Applications folder.',
  });
  if (response === 0) await shell.openExternal(getDownloadPageUrl());
}

/** On Windows: the update is already downloaded; offer to restart now. */
async function promptRestartToUpdate(version: string) {
  if (promptedUpdateVersions.has(version)) return;
  promptedUpdateVersions.add(version);
  const { response } = await dialog.showMessageBox({
    type: 'info',
    buttons: ['Restart now', 'Later'],
    defaultId: 0,
    cancelId: 1,
    title: 'Update ready',
    message: `Web Collector ${version} is ready to install.`,
    detail: 'Restart now, or it will install the next time you quit the app.',
  });
  if (response === 0) {
    isQuitting = true;
    autoUpdater.quitAndInstall(true, true);
  }
}

/** Quietly checks for a new release at startup and every few hours. */
function scheduleAutomaticUpdateChecks() {
  if (!app.isPackaged) return;
  const check = () => {
    autoUpdater.checkForUpdates().catch((error) => console.warn('[update] check failed', getErrorMessage(error)));
  };
  setTimeout(check, UPDATE_CHECK_DELAY_MS);
  setInterval(check, UPDATE_CHECK_INTERVAL_MS);
}

function configureAutoUpdater() {
  // Windows downloads in the background and installs on restart; macOS only announces the release.
  autoUpdater.autoDownload = canSelfInstallUpdates;
  autoUpdater.autoInstallOnAppQuit = canSelfInstallUpdates;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus(makeUpdatePayload('checking', 'Checking for updates.'));
  });

  autoUpdater.on('update-available', (info) => {
    updateDownloaded = false;
    updateDownloadedVersion = info.version;
    sendUpdateStatus(
      makeUpdatePayload(
        'available',
        canSelfInstallUpdates
          ? `Version ${info.version} is available.`
          : `Version ${info.version} is available. Download it from the website.`,
        { version: info.version }
      )
    );
    if (!canSelfInstallUpdates) promptMacDownload(info.version);
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
    promptRestartToUpdate(info.version);
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

  if (!canSelfInstallUpdates) {
    await shell.openExternal(getDownloadPageUrl());
    return makeUpdatePayload('available', 'Opened the download page in your browser.', {
      version: updateDownloadedVersion,
    });
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

  isQuitting = true;
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

function ensureAppBaseUrl() {
  if (!appBaseUrl) appBaseUrl = getAppUrl();
  return appBaseUrl;
}

function isAppUrl(rawUrl: string) {
  try {
    return new URL(rawUrl).origin === new URL(ensureAppBaseUrl()).origin;
  } catch {
    return false;
  }
}

/** IPC requests are only accepted from our own site, never from other pages a window might show. */
function isTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url;
  const trusted = Boolean(senderUrl && isAppUrl(senderUrl));
  if (!trusted) console.warn('[ipc] ignored a request from', senderUrl);
  return trusted;
}

function configureExternalLinkHandling(window: BrowserWindow) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // The window stays on our site (and the Google sign-in pages); other sites open in the browser.
  window.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url)) return;
    try {
      if (isSignInPage(new URL(url))) return;
    } catch {
      // Not a web address; handled below.
    }
    event.preventDefault();
    if (isExternalUrl(url)) shell.openExternal(url);
  });
}

function offlinePage() {
  const retryUrl = ensureAppBaseUrl();
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Web Collector</title>
<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#f6f6f4;color:#1a1a19}
@media (prefers-color-scheme:dark){body{background:#111112;color:#ededec}}
div{text-align:center;max-width:360px;padding:24px}h1{font-size:18px;margin:0 0 8px}p{font-size:14px;opacity:.7;margin:0 0 20px}
a{display:inline-block;padding:10px 18px;border-radius:10px;background:#2563eb;color:#fff;text-decoration:none;font-size:14px}</style></head>
<body><div><h1>Can't reach Web Collector</h1><p>Check your internet connection, then try again.</p><a href="${retryUrl}">Try again</a></div></body></html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function loadRoute(window: BrowserWindow, route: string) {
  const baseUrl = ensureAppBaseUrl();
  const targetUrl = new URL(route.startsWith('/') ? route : `/${route}`, `${baseUrl}/`);
  try {
    await window.loadURL(targetUrl.toString());
  } catch (error) {
    const message = getErrorMessage(error);
    // ERR_ABORTED only means the page moved on to another address; that is fine.
    if (message.includes('ERR_ABORTED')) return;
    console.error('[load] failed to open', targetUrl.toString(), message);
    if (!window.isDestroyed()) await window.loadURL(offlinePage());
  }
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
    scheduleAutomaticUpdateChecks();
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

  // IPC: every request is checked to come from our own site (isTrustedSender).
  ipcMain.handle('open-urls', async (event, urls: string[]) => {
    if (!isTrustedSender(event) || !Array.isArray(urls)) return;
    for (const url of urls.slice(0, 50)) {
      if (typeof url === 'string' && isExternalUrl(url)) {
        await shell.openExternal(url);
      }
    }
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:check-for-updates', async (event) =>
    isTrustedSender(event) ? checkForAppUpdates() : makeUpdatePayload('error', 'Not allowed.')
  );

  ipcMain.handle('app:download-update', async (event) =>
    isTrustedSender(event) ? downloadAppUpdate() : makeUpdatePayload('error', 'Not allowed.')
  );

  ipcMain.handle('app:install-update', (event) =>
    isTrustedSender(event) ? installAppUpdate() : makeUpdatePayload('error', 'Not allowed.')
  );

  ipcMain.handle('open-widget', async (event, category: WidgetCategoryData) => {
    if (!isTrustedSender(event)) return;
    await openWidget(category);
  });

  // Widget links may point at local folders or documents. Programs and scripts are never opened.
  ipcMain.on('open-path', async (event, targetPath: string) => {
    if (!isTrustedSender(event) || typeof targetPath !== 'string' || !targetPath) {
      return;
    }

    const resolved = normalizeOpenPath(targetPath);
    if (BLOCKED_OPEN_EXTENSIONS.has(path.extname(resolved).toLowerCase())) {
      console.warn('[open-path] refused to open a program or script', resolved);
      return;
    }

    await shell.openPath(resolved);
  });

  ipcMain.on('widget:toggle', (event) => {
    if (!isTrustedSender(event)) return;
    toggleWidgetWindows();
  });

  ipcMain.on('widget:close-self', (event) => {
    if (!isTrustedSender(event)) return;
    const widgetWindow = BrowserWindow.fromWebContents(event.sender);
    closeWidgetWindow(widgetWindow);
  });

  ipcMain.on('widget:remove-category', (event, categoryId: string) => {
    if (!isTrustedSender(event)) return;
    const widgetWindow = BrowserWindow.fromWebContents(event.sender);
    removeCategoryFromWidget(widgetWindow, categoryId);
  });

  ipcMain.on('widget:detach-category', async (event, category: WidgetCategoryData) => {
    if (!isTrustedSender(event)) return;
    const sourceWindow = BrowserWindow.fromWebContents(event.sender);
    removeCategoryFromWidget(sourceWindow, category.categoryId);
    await openWidget(category);
  });

  // Create system tray only for packaged builds to avoid dev/runtime collisions.
  if (app.isPackaged) {
    createTray(mainWindow);
  }

  // Load the web app: the Vercel site in installed builds, the local dev server while developing.
  console.log(`Loading ${ensureAppBaseUrl()}`);
  await loadRoute(mainWindow, '/');
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
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  }
});

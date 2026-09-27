import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

type IpcCallback = (event: IpcRendererEvent, ...args: unknown[]) => void;
type PayloadCallback = (payload: unknown) => void;

const onChannel = (channel: string, callback: IpcCallback) => {
  ipcRenderer.on(channel, callback);
};

const onPayloadChannel = (channel: string, callback: PayloadCallback) => {
  ipcRenderer.on(channel, (_event, payload) => callback(payload));
};

const removeChannelListeners = (channel: string) => {
  ipcRenderer.removeAllListeners(channel);
};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  version: process.versions.electron,
  getAppVersion: () => ipcRenderer.invoke('app:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('app:check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('app:download-update'),
  installUpdate: () => ipcRenderer.invoke('app:install-update'),
  openUrls: (urls: string[]) => ipcRenderer.invoke('open-urls', urls),
  openPath: (targetPath: string) => ipcRenderer.send('open-path', targetPath),
  openWidget: (category: { categoryId: string; categoryName: string; categoryColor: string; defaultFaviconId?: string | null }) =>
    ipcRenderer.invoke('open-widget', category),
  sendToggleWidget: () => ipcRenderer.send('widget:toggle'),
  closeWidgetSelf: () => ipcRenderer.send('widget:close-self'),
  removeCategory: (categoryId: string) => ipcRenderer.send('widget:remove-category', categoryId),
  detachCategory: (data: { categoryId: string; categoryName: string; categoryColor: string; defaultFaviconId?: string | null }) =>
    ipcRenderer.send('widget:detach-category', data),
  onSetCategory: (callback: IpcCallback) => onChannel('widget:set-category', callback),
  onAddCategories: (callback: IpcCallback) => onChannel('widget:add-categories', callback),
  onSwitchCategory: (callback: IpcCallback) => onChannel('widget:switch-category', callback),
  onMergePreview: (callback: IpcCallback) => onChannel('widget:merge-preview', callback),
  onMergeAnimate: (callback: IpcCallback) => onChannel('widget:merge-animate', callback),
  onUpdateStatus: (callback: PayloadCallback) => onPayloadChannel('app:update-status', callback),
  removeSetCategoryListener: () => removeChannelListeners('widget:set-category'),
  removeAddCategoriesListener: () => removeChannelListeners('widget:add-categories'),
  removeSwitchCategoryListener: () => removeChannelListeners('widget:switch-category'),
  removeMergePreviewListener: () => removeChannelListeners('widget:merge-preview'),
  removeMergeAnimateListener: () => removeChannelListeners('widget:merge-animate'),
  removeUpdateStatusListener: () => removeChannelListeners('app:update-status'),
});

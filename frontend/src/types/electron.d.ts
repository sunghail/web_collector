/* eslint-disable @typescript-eslint/no-explicit-any */
interface WidgetCategoryData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  defaultFaviconId?: string | null;
}

type UpdateStatus =
  | 'idle'
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

interface ElectronAPI {
  platform: string;
  version: string;
  getAppVersion?: () => Promise<string>;
  checkForUpdates?: () => Promise<UpdateStatusPayload>;
  downloadUpdate?: () => Promise<UpdateStatusPayload>;
  installUpdate?: () => Promise<UpdateStatusPayload>;
  openUrls?: (urls: string[]) => Promise<void>;
  openPath?: (path: string) => void;
  openWidget?: (category: WidgetCategoryData) => Promise<void>;
  sendToggleWidget?: () => void;
  closeWidgetSelf?: () => void;
  removeCategory?: (categoryId: string) => void;
  detachCategory?: (data: WidgetCategoryData) => void;
  onSetCategory: (callback: (...args: any[]) => void) => void;
  onAddCategories: (callback: (...args: any[]) => void) => void;
  onSwitchCategory: (callback: (...args: any[]) => void) => void;
  onMergePreview: (callback: (...args: any[]) => void) => void;
  onMergeAnimate: (callback: (...args: any[]) => void) => void;
  onUpdateStatus?: (callback: (payload: UpdateStatusPayload) => void) => void;
  removeSetCategoryListener: () => void;
  removeAddCategoriesListener: () => void;
  removeSwitchCategoryListener: () => void;
  removeMergePreviewListener: () => void;
  removeMergeAnimateListener: () => void;
  removeUpdateStatusListener?: () => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

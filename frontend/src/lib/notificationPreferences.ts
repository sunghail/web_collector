import { create } from 'zustand';

export interface NotificationPreferences {
  /** Master switch for message notifications on this device. */
  enabled: boolean;
  /** New messages in 1:1 chats. */
  direct: boolean;
  /** New messages in group rooms. */
  groups: boolean;
  /** Being @mentioned, including in the community room and in group rooms with the setting above off. */
  mentions: boolean;
  sound: boolean;
  /** Show the message text; off shows only "New message" (handy on a shared screen). */
  preview: boolean;
}

export const NOTIFICATION_DEFAULTS: NotificationPreferences = {
  enabled: true,
  direct: true,
  groups: true,
  mentions: true,
  sound: true,
  preview: true,
};

const STORAGE_KEY = 'notification-preferences';

function normalize(raw: unknown): NotificationPreferences {
  const saved = (raw ?? {}) as Partial<Record<keyof NotificationPreferences, unknown>>;
  const flag = (key: keyof NotificationPreferences) => (typeof saved[key] === 'boolean' ? (saved[key] as boolean) : NOTIFICATION_DEFAULTS[key]);
  return {
    enabled: flag('enabled'),
    direct: flag('direct'),
    groups: flag('groups'),
    mentions: flag('mentions'),
    sound: flag('sound'),
    preview: flag('preview'),
  };
}

interface NotificationPreferencesState extends NotificationPreferences {
  isHydrated: boolean;
  hydrate: () => void;
  setPreferences: (patch: Partial<NotificationPreferences>) => void;
}

/** Message notification settings, saved on this device like the other appearance settings. */
export const useNotificationPreferences = create<NotificationPreferencesState>((set, get) => ({
  ...NOTIFICATION_DEFAULTS,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return;
    let saved = NOTIFICATION_DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = normalize(JSON.parse(raw));
    } catch {
      // Unreadable or missing storage: keep the defaults.
    }
    set({ ...saved, isHydrated: true });
  },

  setPreferences: (patch) => {
    const current = get();
    const next = normalize({ ...current, ...patch });
    set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies for this session.
    }
  },
}));

/** "granted", "denied", "default", or "unsupported" when the browser has no notifications. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

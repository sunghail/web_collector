import { create } from 'zustand';
import { HEX_COLOR } from '@/lib/appearance';

export type ChatFontId = 'default' | 'rounded' | 'serif' | 'pen' | 'mono';

export interface ChatFont {
  id: ChatFontId;
  name: string;
  description: string;
  family: string;
  /** Google Fonts family to load when chosen; system fonts need nothing. */
  webFont?: string;
}

export const CHAT_FONTS: ChatFont[] = [
  { id: 'default', name: 'Default', description: 'Same as the app', family: 'var(--font-sans)' },
  { id: 'rounded', name: 'Rounded', description: 'Soft and friendly', family: '"Gowun Dodum", var(--font-sans)', webFont: 'Gowun+Dodum' },
  { id: 'serif', name: 'Serif', description: 'Like a book', family: '"Nanum Myeongjo", "Batang", "AppleMyungjo", serif', webFont: 'Nanum+Myeongjo:wght@400;700' },
  { id: 'pen', name: 'Handwriting', description: 'Written by pen', family: '"Nanum Pen Script", var(--font-sans)', webFont: 'Nanum+Pen+Script' },
  { id: 'mono', name: 'Monospace', description: 'Even letter widths', family: 'var(--font-mono)' },
];

/** null follows the theme's normal text color. */
export const CHAT_TEXT_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#db2777', '#0891b2'];

export const CHAT_FONT_SIZE = { min: 12, max: 24, default: 14 } as const;

export interface ChatPreferences {
  fontSize: number;
  font: ChatFontId;
  textColor: string | null;
}

export const CHAT_PREFERENCE_DEFAULTS: ChatPreferences = {
  fontSize: CHAT_FONT_SIZE.default,
  font: 'default',
  textColor: null,
};

const STORAGE_KEY = 'chat-preferences';

function normalize(raw: unknown): ChatPreferences {
  const saved = (raw ?? {}) as Partial<ChatPreferences>;
  const size = Math.round(Number(saved.fontSize) || CHAT_FONT_SIZE.default);
  return {
    fontSize: Math.min(CHAT_FONT_SIZE.max, Math.max(CHAT_FONT_SIZE.min, size)),
    font: CHAT_FONTS.some((f) => f.id === saved.font) ? (saved.font as ChatFontId) : 'default',
    textColor: typeof saved.textColor === 'string' && HEX_COLOR.test(saved.textColor) ? saved.textColor.toLowerCase() : null,
  };
}

/** Adds the Google Fonts stylesheet for a chat font the first time it is used. */
export function loadChatFont(id: ChatFontId) {
  const font = CHAT_FONTS.find((f) => f.id === id);
  if (!font?.webFont || typeof document === 'undefined') return;
  const linkId = `chat-font-${font.id}`;
  if (document.getElementById(linkId)) return;
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.webFont}&display=swap`;
  document.head.appendChild(link);
}

export function chatFontFamily(id: ChatFontId) {
  return (CHAT_FONTS.find((f) => f.id === id) ?? CHAT_FONTS[0]).family;
}

interface ChatPreferencesState extends ChatPreferences {
  isHydrated: boolean;
  hydrate: () => void;
  setPreferences: (patch: Partial<ChatPreferences>) => void;
  reset: () => void;
}

export const useChatPreferences = create<ChatPreferencesState>((set, get) => ({
  ...CHAT_PREFERENCE_DEFAULTS,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return;
    let saved = CHAT_PREFERENCE_DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = normalize(JSON.parse(raw));
    } catch {
      // Unreadable or missing storage: keep the defaults.
    }
    set({ ...saved, isHydrated: true });
    loadChatFont(saved.font);
  },

  setPreferences: (patch) => {
    const current = get();
    const next = normalize({ fontSize: current.fontSize, font: current.font, textColor: current.textColor, ...patch });
    set(next);
    loadChatFont(next.font);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies for this session.
    }
  },

  reset: () => get().setPreferences(CHAT_PREFERENCE_DEFAULTS),
}));

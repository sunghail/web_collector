import { create } from 'zustand';

export type CardLayout = 'compact' | 'tile';
export type CardHoverEffect = 'lift' | 'bar' | 'title' | 'none';

export interface CardPreferences {
  layout: CardLayout;
  /** Row height for the compact (horizontal) layout, in px. */
  compactHeight: number;
  /** Card height for the tile (vertical) layout, in px. */
  tileHeight: number;
  hoverEffect: CardHoverEffect;
}

export const CARD_PREFERENCE_DEFAULTS: CardPreferences = {
  layout: 'compact',
  compactHeight: 72,
  tileHeight: 150,
  hoverEffect: 'lift',
};

export const CARD_HEIGHT_RANGE = {
  compact: { min: 56, max: 112 },
  tile: { min: 120, max: 220 },
} as const;

const STORAGE_KEY = 'card-preferences';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalize(raw: unknown): CardPreferences {
  const saved = (raw ?? {}) as Partial<CardPreferences>;
  return {
    layout: saved.layout === 'tile' ? 'tile' : 'compact',
    compactHeight: clamp(
      Number(saved.compactHeight) || CARD_PREFERENCE_DEFAULTS.compactHeight,
      CARD_HEIGHT_RANGE.compact.min,
      CARD_HEIGHT_RANGE.compact.max
    ),
    tileHeight: clamp(
      Number(saved.tileHeight) || CARD_PREFERENCE_DEFAULTS.tileHeight,
      CARD_HEIGHT_RANGE.tile.min,
      CARD_HEIGHT_RANGE.tile.max
    ),
    hoverEffect: (['lift', 'bar', 'title', 'none'] as const).includes(saved.hoverEffect as CardHoverEffect)
      ? (saved.hoverEffect as CardHoverEffect)
      : CARD_PREFERENCE_DEFAULTS.hoverEffect,
  };
}

interface CardPreferencesState extends CardPreferences {
  /** False until the saved values are read, so server and client render the same first paint. */
  isHydrated: boolean;
  hydrate: () => void;
  setPreferences: (patch: Partial<CardPreferences>) => void;
  reset: () => void;
}

export const useCardPreferences = create<CardPreferencesState>((set, get) => ({
  ...CARD_PREFERENCE_DEFAULTS,
  isHydrated: false,

  hydrate: () => {
    if (get().isHydrated) return;
    let saved: CardPreferences = CARD_PREFERENCE_DEFAULTS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = normalize(JSON.parse(raw));
    } catch {
      // Unreadable or missing storage: keep the defaults.
    }
    set({ ...saved, isHydrated: true });
  },

  setPreferences: (patch) => {
    const next = normalize({ ...get(), ...patch });
    set(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the change still applies for this session.
    }
  },

  reset: () => get().setPreferences(CARD_PREFERENCE_DEFAULTS),
}));

/** Height in px for whichever layout is active. */
export function getCardHeight(prefs: CardPreferences) {
  return prefs.layout === 'tile' ? prefs.tileHeight : prefs.compactHeight;
}

// Web style (colors, corners, shadows) and accent color, both saved in this browser.
// globals.css holds the preset styles and preset accents; a custom style is written
// into a <style id="custom-style"> tag built from the values below.

export const STYLE_STORAGE_KEY = 'app-style';
export const CUSTOM_STYLE_STORAGE_KEY = 'app-style-custom';
/** The generated CSS for the custom style, so the boot script can apply it without any logic. */
export const CUSTOM_STYLE_CSS_STORAGE_KEY = 'app-style-css';
export const ACCENT_STORAGE_KEY = 'accent-color';
export const CUSTOM_ACCENT_STORAGE_KEY = 'accent-custom';
const CUSTOM_STYLE_ELEMENT_ID = 'custom-style';

export type PresetStyleId = 'default' | 'macos' | 'notion' | 'glass' | 'dashboard';
export type StyleId = PresetStyleId | 'custom';
export type AccentId = 'blue' | 'graphite' | 'green' | 'orange' | 'violet' | 'rose' | 'custom';
export type ShadowLevel = 'none' | 'soft' | 'strong';

export interface StylePalette {
  background: string;
  sidebar: string;
  card: string;
  border: string;
  text: string;
}

export interface CustomStyle {
  /** The preset this was started from, for "Reset". */
  base: PresetStyleId;
  /** Corner radius of link cards in px; buttons are 4px tighter, dialogs 4px rounder. */
  cornerRadius: number;
  shadow: ShadowLevel;
  light: StylePalette;
  dark: StylePalette;
}

export const CORNER_RANGE = { min: 0, max: 24 } as const;

export const PALETTE_FIELDS: { key: keyof StylePalette; label: string }[] = [
  { key: 'background', label: 'Page background' },
  { key: 'sidebar', label: 'Sidebar' },
  { key: 'card', label: 'Cards & dialogs' },
  { key: 'border', label: 'Borders' },
  { key: 'text', label: 'Text' },
];

export const PRESET_STYLES: {
  id: PresetStyleId;
  name: string;
  description: string;
  cornerRadius: number;
  shadow: ShadowLevel;
  light: StylePalette;
  dark: StylePalette;
}[] = [
  {
    id: 'default',
    name: 'Default',
    description: 'Warm, quiet neutrals',
    cornerRadius: 14,
    shadow: 'soft',
    light: { background: '#f6f6f4', sidebar: '#efefec', card: '#ffffff', border: '#e3e2de', text: '#1a1a19' },
    dark: { background: '#111112', sidebar: '#151517', card: '#1a1a1c', border: '#2a2a2d', text: '#ededec' },
  },
  {
    id: 'macos',
    name: 'macOS',
    description: 'Crisp grays, soft corners',
    cornerRadius: 16,
    shadow: 'soft',
    light: { background: '#f5f5f7', sidebar: '#e8e8ec', card: '#ffffff', border: '#d9d9de', text: '#1d1d1f' },
    dark: { background: '#1c1c1e', sidebar: '#232325', card: '#2c2c2e', border: '#3a3a3c', text: '#f5f5f7' },
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Flat, paper white',
    cornerRadius: 10,
    shadow: 'none',
    light: { background: '#ffffff', sidebar: '#f7f7f5', card: '#ffffff', border: '#e9e9e7', text: '#37352f' },
    dark: { background: '#191919', sidebar: '#202020', card: '#202020', border: '#2f2f2f', text: '#e6e6e5' },
  },
  {
    id: 'glass',
    name: 'Glass',
    description: 'Frosted, lavender light',
    cornerRadius: 18,
    shadow: 'soft',
    light: { background: '#efeaf9', sidebar: '#f6f3fc', card: '#fbfaff', border: '#ddd5f0', text: '#221d33' },
    dark: { background: '#15121f', sidebar: '#1d1929', card: '#262036', border: '#332c47', text: '#eeeaf7' },
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Cool slate, tight corners',
    cornerRadius: 12,
    shadow: 'soft',
    light: { background: '#f1f5f9', sidebar: '#e6ecf3', card: '#ffffff', border: '#dbe2ea', text: '#0f172a' },
    dark: { background: '#0b1220', sidebar: '#0e1628', card: '#111a2e', border: '#1e2a44', text: '#e6edf6' },
  },
];

/** Swatch colors shown in settings; the real values live in globals.css. */
export const ACCENTS: { id: Exclude<AccentId, 'custom'>; name: string; swatch: string }[] = [
  { id: 'blue', name: 'Blue', swatch: '#2563eb' },
  { id: 'graphite', name: 'Graphite', swatch: '#2f2f33' },
  { id: 'green', name: 'Green', swatch: '#15803d' },
  { id: 'orange', name: 'Orange', swatch: '#d9480f' },
  { id: 'violet', name: 'Violet', swatch: '#6d3fe0' },
  { id: 'rose', name: 'Rose', swatch: '#d61f4f' },
];

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the change still applies for this session.
  }
}

export function getPreset(id: PresetStyleId) {
  return PRESET_STYLES.find((preset) => preset.id === id) ?? PRESET_STYLES[0];
}

/** White or near-black, whichever reads better on the given color. */
export function readableTextOn(hex: string) {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  // Contrast against white vs. against #111.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.0555 ? '#ffffff' : '#111111';
}

// ---------- Style ----------

export function customStyleFromPreset(id: PresetStyleId): CustomStyle {
  const preset = getPreset(id);
  return {
    base: preset.id,
    cornerRadius: preset.cornerRadius,
    shadow: preset.shadow,
    light: { ...preset.light },
    dark: { ...preset.dark },
  };
}

function isPalette(value: unknown): value is StylePalette {
  const palette = value as StylePalette;
  return Boolean(palette) && PALETTE_FIELDS.every(({ key }) => typeof palette[key] === 'string' && HEX_COLOR.test(palette[key]));
}

export function getSavedStyle(): { id: StyleId; custom: CustomStyle } {
  const saved = read(STYLE_STORAGE_KEY);
  let custom = customStyleFromPreset('default');
  try {
    const parsed = JSON.parse(read(CUSTOM_STYLE_STORAGE_KEY) || 'null') as CustomStyle | null;
    if (parsed && isPalette(parsed.light) && isPalette(parsed.dark)) {
      custom = {
        base: PRESET_STYLES.some((p) => p.id === parsed.base) ? parsed.base : 'default',
        cornerRadius: Math.min(CORNER_RANGE.max, Math.max(CORNER_RANGE.min, Number(parsed.cornerRadius) || 0)),
        shadow: (['none', 'soft', 'strong'] as const).includes(parsed.shadow) ? parsed.shadow : 'soft',
        light: parsed.light,
        dark: parsed.dark,
      };
    }
  } catch {
    // Broken saved value: start from the default preset.
  }
  const id = saved === 'custom' || PRESET_STYLES.some((p) => p.id === saved) ? (saved as StyleId) : 'default';
  return { id, custom };
}

const SHADOWS: Record<ShadowLevel, { light: [string, string]; dark: [string, string] }> = {
  none: {
    light: ['0 0 0 transparent', '0 6px 20px -8px rgba(0, 0, 0, 0.16)'],
    dark: ['0 0 0 transparent', '0 8px 24px -8px rgba(0, 0, 0, 0.6)'],
  },
  soft: {
    light: ['0 1px 2px rgba(20, 20, 18, 0.04), 0 1px 1px rgba(20, 20, 18, 0.03)', '0 8px 24px -8px rgba(20, 20, 18, 0.16), 0 2px 6px rgba(20, 20, 18, 0.05)'],
    dark: ['0 1px 2px rgba(0, 0, 0, 0.3)', '0 12px 32px -10px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.3)'],
  },
  strong: {
    light: ['0 2px 6px rgba(20, 20, 18, 0.08), 0 1px 2px rgba(20, 20, 18, 0.06)', '0 16px 40px -10px rgba(20, 20, 18, 0.28), 0 4px 10px rgba(20, 20, 18, 0.08)'],
    dark: ['0 2px 8px rgba(0, 0, 0, 0.5)', '0 18px 44px -10px rgba(0, 0, 0, 0.75), 0 4px 10px rgba(0, 0, 0, 0.4)'],
  },
};

function paletteVars(p: StylePalette, shadow: [string, string]) {
  const mix = (percent: number, base: string) => `color-mix(in srgb, ${p.text} ${percent}%, ${base})`;
  return [
    `--background:${p.background}`,
    `--foreground:${p.text}`,
    `--surface:${p.card}`,
    `--card:${p.card}`,
    `--card-foreground:${p.text}`,
    `--popover:${p.card}`,
    `--popover-foreground:${p.text}`,
    `--secondary:${mix(7, p.card)}`,
    `--secondary-foreground:${p.text}`,
    `--muted:${mix(6, p.card)}`,
    `--muted-foreground:${mix(62, p.card)}`,
    `--accent:${mix(7, p.card)}`,
    `--accent-foreground:${p.text}`,
    `--border:${p.border}`,
    `--input:${mix(12, p.border)}`,
    `--sidebar:${p.sidebar}`,
    `--sidebar-foreground:${p.text}`,
    `--sidebar-accent:${mix(7, 'transparent')}`,
    `--sidebar-accent-foreground:${p.text}`,
    `--sidebar-border:${p.border}`,
    `--shadow-card:${shadow[0]}`,
    `--shadow-raised:${shadow[1]}`,
  ].join(';');
}

export function buildCustomStyleCss(style: CustomStyle) {
  const shadows = SHADOWS[style.shadow];
  return (
    `html[data-style="custom"]{--radius:${style.cornerRadius - 4}px;${paletteVars(style.light, shadows.light)}}` +
    `html[data-style="custom"].dark{${paletteVars(style.dark, shadows.dark)}}`
  );
}

function setCustomStyleElement(css: string) {
  let element = document.getElementById(CUSTOM_STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!element) {
    element = document.createElement('style');
    element.id = CUSTOM_STYLE_ELEMENT_ID;
    document.head.appendChild(element);
  }
  element.textContent = css;
}

export function applyPresetStyle(id: PresetStyleId) {
  if (id === 'default') {
    delete document.documentElement.dataset.style;
  } else {
    document.documentElement.dataset.style = id;
  }
  write(STYLE_STORAGE_KEY, id);
}

export function applyCustomStyle(style: CustomStyle) {
  const css = buildCustomStyleCss(style);
  setCustomStyleElement(css);
  document.documentElement.dataset.style = 'custom';
  write(STYLE_STORAGE_KEY, 'custom');
  write(CUSTOM_STYLE_STORAGE_KEY, JSON.stringify(style));
  write(CUSTOM_STYLE_CSS_STORAGE_KEY, css);
}

// ---------- Accent ----------

export function getSavedAccent(): { id: AccentId; custom: string } {
  const saved = read(ACCENT_STORAGE_KEY);
  const custom = read(CUSTOM_ACCENT_STORAGE_KEY);
  const customColor = custom && HEX_COLOR.test(custom) ? custom : '#0f9d8a';
  if (saved === 'custom' || ACCENTS.some((accent) => accent.id === saved)) {
    return { id: saved as AccentId, custom: customColor };
  }
  return { id: 'blue', custom: customColor };
}

/** Applies a preset accent, or a custom hex color when id is "custom". */
export function applyAccent(id: AccentId, customColor?: string) {
  const root = document.documentElement;
  root.style.removeProperty('--primary');
  root.style.removeProperty('--primary-foreground');

  if (id === 'custom' && customColor && HEX_COLOR.test(customColor)) {
    delete root.dataset.accent;
    root.style.setProperty('--primary', customColor);
    root.style.setProperty('--primary-foreground', readableTextOn(customColor));
    write(CUSTOM_ACCENT_STORAGE_KEY, customColor);
  } else if (id === 'blue' || id === 'custom') {
    delete root.dataset.accent;
  } else {
    root.dataset.accent = id;
  }
  write(ACCENT_STORAGE_KEY, id);
}

/** Runs before first paint (see app/layout.tsx) so the saved look never flashes the default. */
export const appearanceBootScript = `try{
var d=document.documentElement,ls=localStorage,s=ls.getItem('${STYLE_STORAGE_KEY}'),a=ls.getItem('${ACCENT_STORAGE_KEY}');
if(s==='custom'){var css=ls.getItem('${CUSTOM_STYLE_CSS_STORAGE_KEY}');if(css){var t=document.createElement('style');t.id='${CUSTOM_STYLE_ELEMENT_ID}';t.textContent=css;document.head.appendChild(t);d.dataset.style='custom'}}
else if(s&&s!=='default')d.dataset.style=s;
if(a==='custom'){var c=ls.getItem('${CUSTOM_ACCENT_STORAGE_KEY}');
if(c&&/^#[0-9a-f]{6}$/i.test(c)){var l=function(i){var v=parseInt(c.slice(i,i+2),16)/255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)};
var L=0.2126*l(1)+0.7152*l(3)+0.0722*l(5);d.style.setProperty('--primary',c);d.style.setProperty('--primary-foreground',1.05/(L+0.05)>=(L+0.05)/0.0555?'#ffffff':'#111111')}}
else if(a&&a!=='blue')d.dataset.accent=a;
}catch(e){}`;

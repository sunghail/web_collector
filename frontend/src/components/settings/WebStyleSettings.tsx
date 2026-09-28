'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Check, Monitor, Moon, Plus, RotateCcw, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ColorField, Group, Segmented, WithPreview } from './SettingsParts';
import {
  ACCENTS,
  CORNER_RANGE,
  HEX_COLOR,
  PALETTE_FIELDS,
  PRESET_STYLES,
  applyAccent,
  applyCustomStyle,
  applyPresetStyle,
  customStyleFromPreset,
  getPreset,
  getSavedAccent,
  getSavedStyle,
  readableTextOn,
  type AccentId,
  type CustomStyle,
  type PresetStyleId,
  type ShadowLevel,
  type StyleId,
  type StylePalette,
} from '@/lib/appearance';

const modes = [
  { id: 'light' as const, name: 'Light', icon: <Sun className="size-3.5" /> },
  { id: 'dark' as const, name: 'Dark', icon: <Moon className="size-3.5" /> },
  { id: 'system' as const, name: 'System', icon: <Monitor className="size-3.5" /> },
];

const shadowOptions: { id: ShadowLevel; name: string }[] = [
  { id: 'none', name: 'None' },
  { id: 'soft', name: 'Soft' },
  { id: 'strong', name: 'Strong' },
];

function Thumbnail({ palette, radius, isSelected }: { palette: StylePalette; radius: number; isSelected: boolean }) {
  const inner = Math.max(2, Math.round(radius / 4));
  return (
    <span
      className={`
        flex h-12 overflow-hidden border transition-shadow
        ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border group-hover/style:border-foreground/25'}
      `}
      style={{ backgroundColor: palette.background, borderRadius: Math.max(4, Math.round(radius / 2)) }}
      aria-hidden="true"
    >
      <span className="w-3.5 shrink-0" style={{ backgroundColor: palette.sidebar, borderRight: `1px solid ${palette.border}` }} />
      <span className="flex flex-1 flex-col justify-center gap-1 px-1.5">
        <span className="h-2.5" style={{ backgroundColor: palette.card, border: `1px solid ${palette.border}`, borderRadius: inner }} />
        <span className="h-2.5 w-2/3" style={{ backgroundColor: palette.card, border: `1px solid ${palette.border}`, borderRadius: inner }} />
      </span>
    </span>
  );
}

/** A small live picture of the app, drawn with the real theme classes so it follows every change. */
function StylePreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background" aria-hidden="true">
      <div className="flex h-36 lg:h-48">
        <div className="w-24 shrink-0 space-y-1 border-r border-sidebar-border bg-sidebar p-2">
          <div className="rounded-md bg-card px-2 py-1 text-[10px] font-medium text-foreground shadow-card ring-1 ring-border/70">All links</div>
          <div className="px-2 py-1 text-[10px] text-muted-foreground">Inbox</div>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[#34c759]" />
            Web
          </div>
        </div>
        <div className="flex-1 space-y-2.5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">All links</span>
            <span className="rounded-md bg-primary px-2 py-0.5 text-[9px] font-medium text-primary-foreground">Add</span>
          </div>
          {['Team docs', 'Newsletter', 'Design files'].map((title, index) => (
            <div key={title} className={`${index === 2 ? 'hidden lg:flex' : 'flex'} h-9 items-center gap-2 rounded-xl border border-border bg-card px-2 shadow-card`}>
              <span className="size-5 rounded-md bg-primary/80" />
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-semibold text-card-foreground">{title}</span>
                <span className="block truncate text-[9px] text-muted-foreground">example.com</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WebStyleSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [style, setStyle] = useState<StyleId>('default');
  const [custom, setCustom] = useState<CustomStyle>(() => customStyleFromPreset('default'));
  const [accent, setAccent] = useState<AccentId>('blue');
  const [customAccent, setCustomAccent] = useState('#0f9d8a');
  const [customAccentDraft, setCustomAccentDraft] = useState('#0f9d8a');

  useEffect(() => {
    const savedStyle = getSavedStyle();
    const savedAccent = getSavedAccent();
    setStyle(savedStyle.id);
    setCustom(savedStyle.custom);
    setAccent(savedAccent.id);
    setCustomAccent(savedAccent.custom);
    setCustomAccentDraft(savedAccent.custom);
  }, []);

  const mode: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';
  // What the editor shows: the custom values, or the preset in use (editing it starts a custom copy).
  const shown: CustomStyle = style === 'custom' ? custom : customStyleFromPreset(style);

  const selectPreset = (id: PresetStyleId) => {
    applyPresetStyle(id);
    setStyle(id);
  };

  const selectCustom = () => {
    applyCustomStyle(custom);
    setStyle('custom');
  };

  const updateCustom = (change: (current: CustomStyle) => CustomStyle) => {
    const next = change(shown);
    applyCustomStyle(next);
    setCustom(next);
    setStyle('custom');
  };

  const resetToBase = () => {
    const fresh = customStyleFromPreset(shown.base);
    // Keep the saved custom style in sync, then go back to the preset itself.
    applyCustomStyle(fresh);
    setCustom(fresh);
    selectPreset(shown.base);
  };

  const handleAccentChange = (id: AccentId) => {
    applyAccent(id, customAccent);
    setAccent(id);
  };

  const handleCustomAccent = (color: string) => {
    setCustomAccentDraft(color);
    if (!HEX_COLOR.test(color)) return;
    setCustomAccent(color);
    setAccent('custom');
    applyAccent('custom', color);
  };

  return (
    <WithPreview preview={<StylePreview />}>

      <Group label="Mode">
        <Segmented label="Color mode" value={(theme ?? 'system') as 'light' | 'dark' | 'system'} options={modes} onChange={setTheme} />
      </Group>

      <Group label="Preset">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Style preset">
          {PRESET_STYLES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={style === preset.id}
              onClick={() => selectPreset(preset.id)}
              title={preset.description}
              className="group/style space-y-1.5 text-left"
            >
              <Thumbnail palette={preset[mode]} radius={preset.cornerRadius} isSelected={style === preset.id} />
              <span className={`block text-xs ${style === preset.id ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                {preset.name}
              </span>
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={style === 'custom'}
            onClick={selectCustom}
            title="Your own colors and corners"
            className="group/style space-y-1.5 text-left"
          >
            <Thumbnail palette={custom[mode]} radius={custom.cornerRadius} isSelected={style === 'custom'} />
            <span className={`block text-xs ${style === 'custom' ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
              Custom
            </span>
          </button>
        </div>
      </Group>

      <Group
        label="Customize"
        hint={style === 'custom' ? `Based on ${getPreset(shown.base).name}` : 'Any change switches to Custom'}
        value={
          style === 'custom' && (
            <Button type="button" variant="ghost" size="sm" onClick={resetToBase} className="-my-1 h-7 gap-1.5 px-2 text-xs">
              <RotateCcw className="size-3.5" />
              Reset to {getPreset(shown.base).name}
            </Button>
          )
        }
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <label htmlFor="corner-radius">Corners</label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {shown.cornerRadius === 0 ? 'Square' : `${shown.cornerRadius}px`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-4 shrink-0 border-2 border-muted-foreground/60" aria-hidden="true" />
            <input
              id="corner-radius"
              type="range"
              min={CORNER_RANGE.min}
              max={CORNER_RANGE.max}
              step={1}
              value={shown.cornerRadius}
              onChange={(e) => updateCustom((current) => ({ ...current, cornerRadius: Number(e.target.value) }))}
              className="w-full accent-primary"
            />
            <span className="size-4 shrink-0 rounded-full border-2 border-muted-foreground/60" aria-hidden="true" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-[13px]">Shadows</span>
          <div className="w-56">
            <Segmented
              label="Shadows"
              value={shown.shadow}
              options={shadowOptions}
              onChange={(shadow) => updateCustom((current) => ({ ...current, shadow }))}
            />
          </div>
        </div>

        <div className="space-y-2.5 border-t border-border pt-3">
          <div className="text-xs text-muted-foreground">
            Colors for <span className="font-medium text-foreground">{mode === 'dark' ? 'dark' : 'light'} mode</span>
            {' '}· switch the mode above to edit the other one
          </div>
          {PALETTE_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              value={shown[mode][field.key]}
              onChange={(value) =>
                updateCustom((current) => ({ ...current, [mode]: { ...current[mode], [field.key]: value } }))
              }
            />
          ))}
        </div>
      </Group>

      <Group label="Accent">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Accent color">
          {ACCENTS.map((option) => {
            const isSelected = accent === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={option.name}
                title={option.name}
                onClick={() => handleAccentChange(option.id)}
                className={`
                  flex size-7 items-center justify-center rounded-full transition-transform
                  ${isSelected ? 'ring-2 ring-foreground/60 ring-offset-2 ring-offset-popover' : 'hover:scale-110'}
                `}
                style={{ backgroundColor: option.swatch }}
              >
                {isSelected && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            );
          })}
          {/* Custom: the swatch is a color picker; picking a color selects it. */}
          <label
            title="Pick your own color"
            className={`
              relative flex size-7 cursor-pointer items-center justify-center rounded-full transition-transform
              ${accent === 'custom' ? 'ring-2 ring-foreground/60 ring-offset-2 ring-offset-popover' : 'hover:scale-110'}
            `}
            style={{
              background:
                accent === 'custom' ? customAccent : 'conic-gradient(#ff5f6d, #ffc371, #47e891, #3aa8ff, #9b6bff, #ff5f6d)',
            }}
            onClick={() => accent !== 'custom' && handleAccentChange('custom')}
          >
            {accent === 'custom' ? (
              <Check className="size-3.5" strokeWidth={3} style={{ color: readableTextOn(customAccent) }} />
            ) : (
              <Plus className="size-3.5 text-white drop-shadow" strokeWidth={3} />
            )}
            <input
              type="color"
              value={customAccent}
              onChange={(e) => handleCustomAccent(e.target.value)}
              aria-label="Custom accent color"
              className="absolute inset-0 cursor-pointer rounded-full opacity-0"
            />
          </label>

          {accent === 'custom' && (
            <input
              value={customAccentDraft}
              onChange={(e) => handleCustomAccent(e.target.value.trim())}
              aria-label="Custom accent hex code"
              placeholder="#0f9d8a"
              spellCheck={false}
              className={`
                ml-auto h-8 w-24 rounded-lg border bg-card px-2.5 font-mono text-xs shadow-card outline-none transition-[border-color,box-shadow]
                focus-visible:ring-[3px] focus-visible:ring-primary/20
                ${HEX_COLOR.test(customAccentDraft) ? 'border-input focus-visible:border-primary' : 'border-destructive'}
              `}
            />
          )}
        </div>
      </Group>
    </WithPreview>
  );
}

'use client';

import { useEffect } from 'react';
import { Check, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { readableTextOn } from '@/lib/appearance';
import {
  CHAT_FONTS,
  CHAT_FONT_SIZE,
  CHAT_PREFERENCE_DEFAULTS,
  CHAT_TEXT_COLORS,
  chatFontFamily,
  loadChatFont,
  useChatPreferences,
} from '@/lib/chatPreferences';
import { ChoiceButton, Group, WithPreview } from './SettingsParts';
import { useT, type MessageKey } from '@/lib/i18n';

const sampleMessages: { author: string | MessageKey; initial: string; time: string; body: MessageKey; isMine?: boolean }[] = [
  { author: 'minji', initial: 'M', time: '9:12', body: 'chatPreview.first' },
  { author: 'chatPreview.you', initial: 'Y', time: '9:14', body: 'chatPreview.second', isMine: true },
];

/** A few chat messages drawn with the chosen size, font and color. */
function ChatPreview() {
  const { fontSize, font, textColor } = useChatPreferences();
  const t = useT();
  return (
    <div
      className="space-y-3 overflow-hidden rounded-xl border border-border bg-background p-3.5"
      style={{ fontSize, fontFamily: chatFontFamily(font) }}
      aria-hidden="true"
    >
      {sampleMessages.map((message) => (
        <div key={message.time} className="flex gap-2.5">
          <span
            className={`flex size-7 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-semibold ${
              message.isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
            }`}
          >
            {message.isMine ? t(message.author as MessageKey).charAt(0).toUpperCase() : message.initial}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[0.93em] font-semibold text-foreground">{message.isMine ? t(message.author as MessageKey) : message.author}</span>
              <span className="text-[0.79em] text-muted-foreground">{message.time}</span>
            </div>
            <p className="break-words leading-relaxed text-foreground" style={textColor ? { color: textColor } : undefined}>
              {t(message.body)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ChatSettings() {
  const { fontSize, font, textColor, hydrate, setPreferences, reset } = useChatPreferences();
  const t = useT();

  useEffect(() => {
    hydrate();
    // Load every font so each choice below is shown in its own letters.
    CHAT_FONTS.forEach((option) => loadChatFont(option.id));
  }, [hydrate]);

  const isDefault =
    fontSize === CHAT_PREFERENCE_DEFAULTS.fontSize &&
    font === CHAT_PREFERENCE_DEFAULTS.font &&
    textColor === CHAT_PREFERENCE_DEFAULTS.textColor;
  const isCustomColor = textColor !== null && !CHAT_TEXT_COLORS.includes(textColor);
  const swatchRing = (isSelected: boolean) =>
    isSelected ? 'ring-2 ring-foreground/60 ring-offset-2 ring-offset-popover' : 'hover:scale-110';

  return (
    <WithPreview preview={<ChatPreview />}>
      <Group
        label={t('chat.textSize')}
        hint={t('chat.textSizeHint')}
        value={<span className="text-xs tabular-nums text-muted-foreground">{fontSize}px</span>}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">A</span>
          <input
            type="range"
            aria-label={t('chat.textSize')}
            min={CHAT_FONT_SIZE.min}
            max={CHAT_FONT_SIZE.max}
            step={1}
            value={fontSize}
            onChange={(e) => setPreferences({ fontSize: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <span className="text-lg text-muted-foreground">A</span>
        </div>
      </Group>

      <Group label={t('chat.font')}>
        <div className="grid grid-cols-2 gap-2">
          {CHAT_FONTS.map((option) => (
            <ChoiceButton
              key={option.id}
              isSelected={font === option.id}
              onClick={() => setPreferences({ font: option.id })}
              title={t(`font.${option.id}` as MessageKey)}
              description={t(`font.${option.id}Hint` as MessageKey)}
              style={{ fontFamily: option.family }}
            />
          ))}
        </div>
      </Group>

      <Group label={t('chat.textColor')} hint={t('chat.textColorHint')}>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('chat.textColor')}>
          <button
            type="button"
            role="radio"
            aria-checked={textColor === null}
            onClick={() => setPreferences({ textColor: null })}
            title={t('chat.colorDefaultTitle')}
            className={`flex h-7 items-center rounded-full border border-border bg-card px-3 text-xs font-medium transition-transform ${swatchRing(textColor === null)}`}
          >
            {t('chat.colorDefault')}
          </button>
          {CHAT_TEXT_COLORS.map((color) => {
            const isSelected = textColor === color;
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={color}
                title={color}
                onClick={() => setPreferences({ textColor: color })}
                className={`flex size-7 items-center justify-center rounded-full transition-transform ${swatchRing(isSelected)}`}
                style={{ backgroundColor: color }}
              >
                {isSelected && <Check className="size-3.5 text-white" strokeWidth={3} />}
              </button>
            );
          })}
          {/* Custom: the swatch is a color picker; picking a color selects it. */}
          <label
            title={t('accent.custom')}
            className={`relative flex size-7 cursor-pointer items-center justify-center rounded-full transition-transform ${swatchRing(isCustomColor)}`}
            style={{
              background: isCustomColor ? textColor! : 'conic-gradient(#ff5f6d, #ffc371, #47e891, #3aa8ff, #9b6bff, #ff5f6d)',
            }}
          >
            {isCustomColor ? (
              <Check className="size-3.5" strokeWidth={3} style={{ color: readableTextOn(textColor!) }} />
            ) : (
              <Plus className="size-3.5 text-white drop-shadow" strokeWidth={3} />
            )}
            <input
              type="color"
              value={textColor ?? '#2563eb'}
              onChange={(e) => setPreferences({ textColor: e.target.value })}
              aria-label={t('accent.custom')}
              className="absolute inset-0 cursor-pointer rounded-full opacity-0"
            />
          </label>
        </div>
        {textColor && <p className="text-xs text-muted-foreground">{t('chat.readable')}</p>}
      </Group>

      {!isDefault && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="size-3.5" />
            {t('chat.reset')}
          </Button>
        </div>
      )}
    </WithPreview>
  );
}

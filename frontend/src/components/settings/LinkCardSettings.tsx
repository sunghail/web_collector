'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardStylePreview } from '@/components/layout/CardStylePreview';
import { ChoiceButton, Group, WithPreview } from './SettingsParts';
import { useT, type MessageKey } from '@/lib/i18n';
import {
  CARD_HEIGHT_RANGE,
  CARD_PREFERENCE_DEFAULTS,
  useCardPreferences,
  type CardHoverEffect,
  type CardLayout,
} from '@/lib/cardPreferences';

const cardLayouts: { id: CardLayout; name: MessageKey; description: MessageKey }[] = [
  { id: 'compact', name: 'cards.compact', description: 'cards.compactHint' },
  { id: 'tile', name: 'cards.tile', description: 'cards.tileHint' },
];

const hoverEffects: { id: CardHoverEffect; name: MessageKey; description: MessageKey }[] = [
  { id: 'lift', name: 'effect.lift', description: 'effect.liftHint' },
  { id: 'bar', name: 'effect.bar', description: 'effect.barHint' },
  { id: 'title', name: 'effect.title', description: 'effect.titleHint' },
  { id: 'none', name: 'effect.none', description: 'effect.noneHint' },
];

export function LinkCardSettings() {
  const { layout, hoverEffect, compactHeight, tileHeight, setPreferences, reset } = useCardPreferences();
  const [previewedEffect, setPreviewedEffect] = useState<CardHoverEffect | null>(null);
  const t = useT();

  const heightRange = CARD_HEIGHT_RANGE[layout];
  const cardHeight = layout === 'tile' ? tileHeight : compactHeight;
  const effectInPreview = previewedEffect ?? hoverEffect;
  const isDefault =
    layout === CARD_PREFERENCE_DEFAULTS.layout &&
    hoverEffect === CARD_PREFERENCE_DEFAULTS.hoverEffect &&
    compactHeight === CARD_PREFERENCE_DEFAULTS.compactHeight &&
    tileHeight === CARD_PREFERENCE_DEFAULTS.tileHeight;

  return (
    <WithPreview
      preview={
        <CardStylePreview
          layout={layout}
          height={cardHeight}
          effect={effectInPreview}
          replayKey={`${layout}-${cardHeight}-${effectInPreview}`}
          hold={previewedEffect !== null}
        />
      }
    >
      <Group label={t('cards.shape')}>
        <div className="grid grid-cols-2 gap-2">
          {cardLayouts.map((option) => (
            <ChoiceButton
              key={option.id}
              isSelected={layout === option.id}
              onClick={() => setPreferences({ layout: option.id })}
              title={t(option.name)}
              description={t(option.description)}
            />
          ))}
        </div>
      </Group>

      <Group label={t('cards.size')} value={<span className="text-xs tabular-nums text-muted-foreground">{cardHeight}px</span>}>
        <input
          type="range"
          aria-label={t('cards.height')}
          min={heightRange.min}
          max={heightRange.max}
          step={4}
          value={cardHeight}
          onChange={(e) => {
            const value = Number(e.target.value);
            setPreferences(layout === 'tile' ? { tileHeight: value } : { compactHeight: value });
          }}
          className="w-full accent-primary"
        />
      </Group>

      <Group label={t('cards.animation')} hint={t('cards.animationHint')}>
        <div className="grid grid-cols-2 gap-2">
          {hoverEffects.map((option) => (
            <ChoiceButton
              key={option.id}
              isSelected={hoverEffect === option.id}
              onClick={() => setPreferences({ hoverEffect: option.id })}
              onMouseEnter={() => setPreviewedEffect(option.id)}
              onMouseLeave={() => setPreviewedEffect(null)}
              onFocus={() => setPreviewedEffect(option.id)}
              onBlur={() => setPreviewedEffect(null)}
              title={t(option.name)}
              description={t(option.description)}
            />
          ))}
        </div>
      </Group>

      {!isDefault && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="size-3.5" />
            {t('cards.reset')}
          </Button>
        </div>
      )}
    </WithPreview>
  );
}

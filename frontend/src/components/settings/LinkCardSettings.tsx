'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardStylePreview } from '@/components/layout/CardStylePreview';
import { ChoiceButton, Group } from './SettingsParts';
import {
  CARD_HEIGHT_RANGE,
  CARD_PREFERENCE_DEFAULTS,
  useCardPreferences,
  type CardHoverEffect,
  type CardLayout,
} from '@/lib/cardPreferences';

const cardLayouts: { id: CardLayout; name: string; description: string }[] = [
  { id: 'compact', name: 'Compact', description: 'One row per link' },
  { id: 'tile', name: 'Tile', description: 'Icon above the title' },
];

const hoverEffects: { id: CardHoverEffect; name: string; description: string }[] = [
  { id: 'lift', name: 'Lift', description: 'Raises slightly' },
  { id: 'bar', name: 'Accent bar', description: 'Bar sweeps in, title colors' },
  { id: 'title', name: 'Accent title', description: 'Title only' },
  { id: 'none', name: 'None', description: 'Shadow only' },
];

export function LinkCardSettings() {
  const { layout, hoverEffect, compactHeight, tileHeight, setPreferences, reset } = useCardPreferences();
  const [previewedEffect, setPreviewedEffect] = useState<CardHoverEffect | null>(null);

  const heightRange = CARD_HEIGHT_RANGE[layout];
  const cardHeight = layout === 'tile' ? tileHeight : compactHeight;
  const effectInPreview = previewedEffect ?? hoverEffect;
  const isDefault =
    layout === CARD_PREFERENCE_DEFAULTS.layout &&
    hoverEffect === CARD_PREFERENCE_DEFAULTS.hoverEffect &&
    compactHeight === CARD_PREFERENCE_DEFAULTS.compactHeight &&
    tileHeight === CARD_PREFERENCE_DEFAULTS.tileHeight;

  return (
    <div className="space-y-4">
      <CardStylePreview
        layout={layout}
        height={cardHeight}
        effect={effectInPreview}
        replayKey={`${layout}-${cardHeight}-${effectInPreview}`}
        hold={previewedEffect !== null}
      />

      <Group label="Shape">
        <div className="grid grid-cols-2 gap-2">
          {cardLayouts.map((option) => (
            <ChoiceButton
              key={option.id}
              isSelected={layout === option.id}
              onClick={() => setPreferences({ layout: option.id })}
              title={option.name}
              description={option.description}
            />
          ))}
        </div>
      </Group>

      <Group label="Size" value={<span className="text-xs tabular-nums text-muted-foreground">{cardHeight}px</span>}>
        <input
          type="range"
          aria-label="Card height"
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

      <Group label="Animation" hint="Point at one to preview it">
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
              title={option.name}
              description={option.description}
            />
          ))}
        </div>
      </Group>

      {!isDefault && (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-xs">
            <RotateCcw className="size-3.5" />
            Reset link cards
          </Button>
        </div>
      )}
    </div>
  );
}

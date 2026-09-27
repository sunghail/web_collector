'use client';

import { useEffect, useState } from 'react';
import { getFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';
import type { CardHoverEffect, CardLayout } from '@/lib/cardPreferences';

interface CardStylePreviewProps {
  layout: CardLayout;
  height: number;
  /** Effect to show, which is the hovered option while one is hovered. */
  effect: CardHoverEffect;
  /** Bumping this replays the effect, e.g. when the dialog opens or a choice changes. */
  replayKey: string;
  /** Keep the effect showing, e.g. while an option is pointed at. */
  hold?: boolean;
}

/**
 * Sample card that plays the hover effect on its own, so the effects can be
 * compared without leaving the settings dialog.
 */
export function CardStylePreview({ layout, height, effect, replayKey, hold }: CardStylePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const isTile = layout === 'tile';

  useEffect(() => {
    setIsPlaying(true);
    const timer = setTimeout(() => setIsPlaying(false), 1400);
    return () => clearTimeout(timer);
  }, [replayKey]);

  const isActive = hold || isPlaying;
  const titleActive = (effect === 'bar' || effect === 'title') && isActive;
  const liftActive = effect === 'lift' && isActive;

  return (
    <div
      className="flex items-center justify-center rounded-xl bg-muted/60 p-5"
      onMouseEnter={() => setIsPlaying(true)}
      onMouseLeave={() => setIsPlaying(false)}
    >
      <div
        style={{ height, width: isTile ? 150 : '100%' }}
        className={`
          relative flex overflow-hidden rounded-xl border bg-card shadow-card
          transition-[transform,box-shadow,border-color] duration-200
          ${isTile ? 'items-stretch' : 'items-center'}
          ${liftActive ? '-translate-y-px border-foreground/20 shadow-raised' : 'border-border'}
          ${isActive && effect !== 'lift' ? 'shadow-raised' : ''}
        `}
      >
        <div
          className={
            isTile
              ? 'flex min-w-0 flex-1 flex-col justify-center gap-2.5 px-4 py-3'
              : 'flex min-w-0 flex-1 items-center gap-3.5 pl-4 pr-3'
          }
        >
          <img
            src={getFallbackFaviconDataUrl('bookmark-core')}
            alt=""
            className={isTile ? 'h-12 w-12 rounded-xl' : 'h-10 w-10 rounded-[10px]'}
          />
          <div className="flex min-w-0 flex-col gap-1">
            <div
              className={`truncate text-sm font-semibold transition-colors ${
                titleActive ? 'text-primary' : 'text-card-foreground'
              }`}
            >
              Example site
            </div>
            <div className="truncate text-xs text-muted-foreground">example.com</div>
          </div>
        </div>
        {effect === 'bar' && (
          <span
            className={`pointer-events-none absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-b-2xl bg-primary transition-transform duration-200 ${
              isActive ? 'scale-x-100' : 'scale-x-0'
            }`}
          />
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { HEX_COLOR } from '@/lib/appearance';
import { useT } from '@/lib/i18n';

/** A bordered box with a small uppercase label, used to group related settings. */
export function Group({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint?: string;
  value?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border p-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {label}
          {hint && <span className="ml-2 font-normal normal-case tracking-normal">{hint}</span>}
        </span>
        {value}
      </div>
      {children}
    </div>
  );
}

/**
 * Settings on the left, a live preview on the right that stays in view while the settings scroll.
 * On narrow screens it is pinned above the settings instead, covering them as they scroll under it
 * (the negative margins stretch its background over the panel's padding).
 */
export function WithPreview({ preview, children }: { preview: ReactNode; children: ReactNode }) {
  const t = useT();
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-6">
      <aside className="sticky -top-5 z-10 -mx-6 -mt-5 space-y-2 border-b border-border bg-popover px-6 pb-3 pt-5 lg:top-0 lg:col-start-2 lg:row-start-1 lg:m-0 lg:self-start lg:border-0 lg:p-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t('preview')}</span>
        {preview}
      </aside>
      <div className="space-y-4 lg:col-start-1 lg:row-start-1">{children}</div>
    </div>
  );
}

export function ChoiceButton({
  isSelected,
  onClick,
  title,
  description,
  ...rest
}: {
  isSelected: boolean;
  onClick: () => void;
  title: string;
  description: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`
        rounded-lg border px-3 py-2.5 text-left transition-colors
        ${isSelected ? 'border-primary bg-primary/[0.07] ring-1 ring-primary' : 'border-border hover:bg-accent'}
      `}
      {...rest}
    >
      <div className="text-[13px] font-medium">{title}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; name: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const isSelected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.id)}
            className={`
              flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] transition-colors
              ${isSelected ? 'bg-card font-medium text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'}
            `}
          >
            {option.icon}
            {option.name}
          </button>
        );
      })}
    </div>
  );
}

/** A color swatch (opens the system picker) with a hex field beside it. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const isValid = HEX_COLOR.test(draft);

  return (
    <div className="flex items-center gap-3">
      <label
        className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-input shadow-card"
        style={{ backgroundColor: value }}
        title={label}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <span className="min-w-0 flex-1 truncate text-[13px]">{label}</span>
      <input
        value={draft}
        onChange={(e) => {
          const next = e.target.value.trim();
          setDraft(next);
          if (HEX_COLOR.test(next)) onChange(next.toLowerCase());
        }}
        onBlur={() => setDraft(value)}
        aria-label={`${label} (hex)`}
        spellCheck={false}
        className={`
          h-8 w-24 rounded-lg border bg-card px-2.5 font-mono text-xs shadow-card outline-none transition-[border-color,box-shadow]
          focus-visible:ring-[3px] focus-visible:ring-primary/20
          ${isValid ? 'border-input focus-visible:border-primary' : 'border-destructive'}
        `}
      />
    </div>
  );
}

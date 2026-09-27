'use client';

import { forwardRef, useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Show the "/" shortcut hint while the field is empty and unfocused. */
  showShortcut?: boolean;
}

export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  { value, onChange, className, showShortcut = true },
  ref
) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <label
      className={`
        group relative flex h-9 items-center gap-2 rounded-lg border border-input bg-card px-3 shadow-card transition-[border-color,box-shadow]
        focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/20
        ${className ?? ''}
      `}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={ref}
        type="text"
        inputMode="search"
        aria-label="Search links"
        placeholder="Search links"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onChange('');
            e.currentTarget.blur();
          }
        }}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="-mr-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : (
        showShortcut &&
        !isFocused && (
          <kbd className="rounded-md border border-border bg-muted px-1.5 text-[11px] leading-5 text-muted-foreground">/</kbd>
        )
      )}
    </label>
  );
});

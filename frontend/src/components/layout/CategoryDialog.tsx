'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DEFAULT_FALLBACK_FAVICON_ID,
  fallbackFavicons,
  getFallbackFaviconDataUrl,
} from '@/lib/fallbackFavicons';

export const CATEGORY_COLORS = [
  '#007AFF', '#34c759', '#ff3b30', '#af52de',
  '#ff9500', '#ff2d55', '#5ac8fa', '#8e8e93',
  '#ffcc00', '#00c7be', '#5856d6', '#ac8e68',
  '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4',
];

export interface CategoryFormValues {
  name: string;
  color: string;
  defaultFaviconId: string | null;
}

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialValues?: CategoryFormValues;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}

const EMPTY_VALUES: CategoryFormValues = { name: '', color: CATEGORY_COLORS[0], defaultFaviconId: null };

export function CategoryDialog({ open, onOpenChange, mode, initialValues, onSubmit }: CategoryDialogProps) {
  const [values, setValues] = useState<CategoryFormValues>(initialValues ?? EMPTY_VALUES);
  const [hexInput, setHexInput] = useState(values.color);
  const [isSaving, setIsSaving] = useState(false);

  // Start from the given values each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    const start = initialValues ?? EMPTY_VALUES;
    setValues(start);
    setHexInput(start.color);
  }, [open, initialValues]);

  const setColor = (color: string) => {
    setValues((current) => ({ ...current, color }));
    setHexInput(color);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.name.trim()) return;
    setIsSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isPresetColor = CATEGORY_COLORS.some((c) => c.toLowerCase() === values.color.toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'New category' : 'Edit category'}</DialogTitle>
          <DialogDescription>
            The icon is used for links in this category when a site has none of its own.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="category-name" className="text-[13px]">Name</Label>
            <Input
              id="category-name"
              autoFocus
              placeholder="e.g. Design inspiration"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </div>

          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-[13px] font-medium">Color</legend>
            <div className="grid grid-cols-8 gap-2">
              {CATEGORY_COLORS.map((color) => {
                const isSelected = values.color.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={isSelected}
                    onClick={() => setColor(color)}
                    className={`
                      relative flex size-8 items-center justify-center rounded-full transition-transform
                      ${isSelected ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover' : 'hover:scale-110'}
                    `}
                    style={{ backgroundColor: color }}
                  >
                    {isSelected && <Check className="size-4 text-white drop-shadow" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <label
                className={`
                  relative size-8 shrink-0 overflow-hidden rounded-full border border-input
                  ${!isPresetColor ? 'ring-2 ring-foreground/70 ring-offset-2 ring-offset-popover' : ''}
                `}
                style={{ backgroundColor: values.color }}
                title="Pick a custom color"
              >
                <input
                  type="color"
                  value={values.color}
                  onChange={(e) => setColor(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Custom color"
                />
              </label>
              <Input
                value={hexInput}
                onChange={(e) => {
                  setHexInput(e.target.value);
                  if (/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                    setValues({ ...values, color: e.target.value });
                  }
                }}
                aria-label="Hex color"
                placeholder="#000000"
                className="h-8 w-28 font-mono text-xs"
              />
              <span className="text-xs text-muted-foreground">Custom</span>
            </div>
          </fieldset>

          <fieldset className="space-y-2.5">
            <legend className="mb-2.5 text-[13px] font-medium">Default icon</legend>
            <div className="grid grid-cols-7 gap-1.5">
              <button
                type="button"
                aria-pressed={values.defaultFaviconId === null}
                onClick={() => setValues({ ...values, defaultFaviconId: null })}
                title="Use the global default"
                className={`
                  flex h-10 items-center justify-center rounded-lg border text-[11px] font-medium transition-colors
                  ${values.defaultFaviconId === null
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'}
                `}
              >
                Global
              </button>
              {fallbackFavicons.map((favicon) => {
                const isSelected = values.defaultFaviconId === favicon.id;
                return (
                  <button
                    key={favicon.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={favicon.name}
                    onClick={() => setValues({ ...values, defaultFaviconId: favicon.id })}
                    title={favicon.id === DEFAULT_FALLBACK_FAVICON_ID ? `${favicon.name} (global default)` : favicon.name}
                    className={`
                      flex h-10 items-center justify-center rounded-lg border transition-colors
                      ${isSelected ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent'}
                    `}
                  >
                    <img src={getFallbackFaviconDataUrl(favicon.id)} alt="" className="size-7 rounded-[7px]" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !values.name.trim()}>
              {isSaving ? 'Saving…' : mode === 'create' ? 'Create category' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

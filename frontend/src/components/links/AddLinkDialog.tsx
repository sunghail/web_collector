'use client';

import { useState, useEffect } from 'react';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Link2 } from 'lucide-react';
import { Category, Link } from '@/types';
import {
  DEFAULT_FALLBACK_FAVICON_ID,
  fallbackFavicons,
  getFallbackFaviconDataUrl,
  getFallbackFaviconIdFromDataUrl,
} from '@/lib/fallbackFavicons';

interface AddLinkDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    url: string,
    categoryId?: string,
    memo?: string,
    showFavicon?: boolean,
    favicon?: string
  ) => Promise<void>;
  categories: Category[];
  selectedCategoryId: string | null;
  editingLink?: Link | null;
}

export function AddLinkDialog({
  isOpen,
  onClose,
  onSubmit,
  categories,
  selectedCategoryId,
  editingLink,
}: AddLinkDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    categoryId: selectedCategoryId || '',
    memo: '',
    showFavicon: true,
    faviconChoice: 'auto',
  });

  useEffect(() => {
    if (editingLink) {
      const fallbackId = getFallbackFaviconIdFromDataUrl(editingLink.favicon);
      setFormData({
        title: editingLink.title,
        url: editingLink.url,
        categoryId: editingLink.category_id || '',
        memo: editingLink.memo || '',
        showFavicon: editingLink.show_favicon !== false,
        faviconChoice: fallbackId || 'auto',
      });
    } else {
      setFormData({
        title: '',
        url: '',
        categoryId: selectedCategoryId || '',
        memo: '',
        showFavicon: true,
        faviconChoice: 'auto',
      });
    }
  }, [editingLink, selectedCategoryId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.url.trim()) return;

    setIsLoading(true);
    try {
      // Auto-generate title from URL if not provided
      let title = formData.title.trim();
      if (!title) {
        try {
          title = new URL(formData.url).hostname.replace('www.', '');
        } catch {
          title = formData.url;
        }
      }

      const favicon =
        formData.faviconChoice === 'auto'
          ? undefined
          : getFallbackFaviconDataUrl(formData.faviconChoice);

      await onSubmit(
        title,
        formData.url,
        formData.categoryId || undefined,
        formData.memo,
        formData.showFavicon,
        favicon
      );
      setFormData({
        title: '',
        url: '',
        categoryId: selectedCategoryId || '',
        memo: '',
        showFavicon: true,
        faviconChoice: 'auto',
      });
      onClose();
    } catch (error) {
      console.error('Failed to add link:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>{editingLink ? 'Edit link' : 'New link'}</DialogTitle>
          <DialogDescription>
            {editingLink ? 'Change where it goes or how it looks.' : 'Paste an address. Leave the title blank to use the site address.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="link-url" className="text-[13px]">Address</Label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="link-url"
                type="url"
                autoFocus
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-title" className="text-[13px]">
              Title <span className="font-normal text-muted-foreground">· optional</span>
            </Label>
            <Input
              id="link-title"
              placeholder="Uses the site address if empty"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-category" className="text-[13px]">Category</Label>
            <NativeSelect
              id="link-category"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            >
              <option value="">Inbox</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-2">
            <Label htmlFor="link-memo" className="text-[13px]">
              Memo <span className="font-normal text-muted-foreground">· optional</span>
            </Label>
            <textarea
              id="link-memo"
              placeholder="A short note, shown under the title"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              className="min-h-[64px] w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-card outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20"
              rows={2}
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="link-show-icon" className="text-[13px]">Icon</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formData.showFavicon ? 'Shown' : 'Hidden'}</span>
                <Switch
                  id="link-show-icon"
                  aria-label="Show icon"
                  checked={formData.showFavicon}
                  onCheckedChange={(showFavicon) => setFormData({ ...formData, showFavicon })}
                />
              </div>
            </div>
            <div
              className={`grid grid-cols-7 gap-1.5 transition-opacity ${formData.showFavicon ? '' : 'pointer-events-none opacity-40'}`}
              aria-disabled={!formData.showFavicon}
            >
              <button
                type="button"
                aria-pressed={formData.faviconChoice === 'auto'}
                onClick={() => setFormData({ ...formData, faviconChoice: 'auto' })}
                title="Use the site's own icon"
                className={`
                  flex h-10 items-center justify-center rounded-lg border text-[11px] font-medium transition-colors
                  ${formData.faviconChoice === 'auto'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'}
                `}
              >
                Site
              </button>
              {fallbackFavicons.map((favicon) => {
                const isSelected = formData.faviconChoice === favicon.id;
                return (
                  <button
                    key={favicon.id}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={favicon.name}
                    onClick={() => setFormData({ ...formData, faviconChoice: favicon.id })}
                    title={favicon.id === DEFAULT_FALLBACK_FAVICON_ID ? `${favicon.name} (default)` : favicon.name}
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
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !formData.url.trim()}>
              {isLoading ? 'Saving…' : editingLink ? 'Save changes' : 'Add link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

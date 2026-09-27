'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Category, Link, MacroItemInput } from '@/types';

interface MacroItemEntry {
  tempId: string;
  type: 'link' | 'custom';
  link_id?: string;
  link_title?: string;
  link_favicon?: string;
  custom_url?: string;
  custom_title?: string;
}

interface AddMacroDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    title: string,
    categoryId: string | undefined,
    macroItems: MacroItemInput[]
  ) => Promise<void>;
  categories: Category[];
  selectedCategoryId: string | null;
  allLinks: Link[];
  editingMacro?: Link | null;
}

export function AddMacroDialog({
  isOpen,
  onClose,
  onSubmit,
  categories,
  selectedCategoryId,
  allLinks,
  editingMacro,
}: AddMacroDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(selectedCategoryId || '');
  const [items, setItems] = useState<MacroItemEntry[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  // Only normal links (not macros)
  const availableLinks = useMemo(
    () => allLinks.filter((l) => l.type !== 'macro'),
    [allLinks]
  );

  // Set of selected link IDs for checkbox state
  const selectedLinkIds = useMemo(
    () => new Set(items.filter((i) => i.type === 'link').map((i) => i.link_id)),
    [items]
  );

  // Group links by category
  const linksByCategory = useMemo(() => {
    const grouped: Record<string, Link[]> = {};
    const uncategorized: Link[] = [];

    availableLinks.forEach((link) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !link.title.toLowerCase().includes(q) &&
          !link.url.toLowerCase().includes(q)
        )
          return;
      }
      if (link.category_id) {
        if (!grouped[link.category_id]) grouped[link.category_id] = [];
        grouped[link.category_id].push(link);
      } else {
        uncategorized.push(link);
      }
    });

    return { grouped, uncategorized };
  }, [availableLinks, searchQuery]);

  // Sort categories by order_index
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order_index - b.order_index),
    [categories]
  );

  useEffect(() => {
    if (editingMacro) {
      setTitle(editingMacro.title);
      setCategoryId(editingMacro.category_id || '');
      const entries: MacroItemEntry[] = (editingMacro.macro_items || []).map(
        (item, idx) => {
          if (item.link_id) {
            return {
              tempId: `existing-${idx}`,
              type: 'link' as const,
              link_id: item.link_id,
              link_title: item.resolved_title || 'Unknown link',
              link_favicon: item.resolved_favicon || undefined,
            };
          }
          return {
            tempId: `existing-${idx}`,
            type: 'custom' as const,
            custom_url: item.custom_url || item.resolved_url || '',
            custom_title: item.custom_title || item.resolved_title || '',
          };
        }
      );
      setItems(entries);
    } else {
      setTitle('');
      setCategoryId(selectedCategoryId || '');
      setItems([]);
    }
    setExpandedCategories(new Set());
    setShowUrlInput(false);
    setSearchQuery('');
    setCustomUrl('');
    setCustomTitle('');
  }, [editingMacro, selectedCategoryId, isOpen]);

  const toggleCategory = (catId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const toggleLink = (link: Link) => {
    if (selectedLinkIds.has(link.id)) {
      // Remove
      setItems((prev) => prev.filter((i) => !(i.type === 'link' && i.link_id === link.id)));
    } else {
      // Add
      setItems((prev) => [
        ...prev,
        {
          tempId: `link-${Date.now()}-${link.id}`,
          type: 'link',
          link_id: link.id,
          link_title: link.title,
          link_favicon: link.favicon || undefined,
        },
      ]);
    }
  };

  const handleAddCustomUrl = () => {
    if (!customUrl.trim()) return;
    let finalTitle = customTitle.trim();
    if (!finalTitle) {
      try {
        finalTitle = new URL(customUrl).hostname.replace('www.', '');
      } catch {
        finalTitle = customUrl;
      }
    }
    setItems((prev) => [
      ...prev,
      {
        tempId: `custom-${Date.now()}`,
        type: 'custom',
        custom_url: customUrl.trim(),
        custom_title: finalTitle,
      },
    ]);
    setCustomUrl('');
    setCustomTitle('');
    setShowUrlInput(false);
  };

  const handleRemoveItem = (tempId: string) => {
    setItems((prev) => prev.filter((item) => item.tempId !== tempId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || items.length === 0) return;

    setIsLoading(true);
    try {
      const macroItems: MacroItemInput[] = items.map((item, index) => {
        if (item.type === 'link') {
          return { link_id: item.link_id, order_index: index };
        }
        return {
          custom_url: item.custom_url,
          custom_title: item.custom_title,
          order_index: index,
        };
      });

      await onSubmit(title.trim(), categoryId || undefined, macroItems);
      onClose();
    } catch (error) {
      console.error('Failed to save macro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // When searching, auto-expand all categories that have matching results
  useEffect(() => {
    if (searchQuery) {
      const toExpand = new Set<string>();
      sortedCategories.forEach((cat) => {
        if (linksByCategory.grouped[cat.id]?.length) {
          toExpand.add(cat.id);
        }
      });
      if (linksByCategory.uncategorized.length) {
        toExpand.add('__uncategorized__');
      }
      setExpandedCategories(toExpand);
    }
  }, [searchQuery, sortedCategories, linksByCategory]);

  const renderLinkRow = (link: Link) => {
    const isChecked = selectedLinkIds.has(link.id);
    return (
      <label
        key={link.id}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors ${
          isChecked ? 'bg-primary/10' : 'hover:bg-muted'
        }`}
      >
        {/* Favicon */}
        <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center overflow-hidden">
          {link.favicon ? (
            <img src={link.favicon} alt="" className="w-4 h-4 object-contain" />
          ) : (
            <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
            </svg>
          )}
        </div>

        {/* Title */}
        <span className="flex-1 text-sm truncate">{link.title}</span>

        {/* Checkbox */}
        <div
          className={`w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
            isChecked
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/40 hover:border-muted-foreground'
          }`}
          onClick={(e) => {
            e.preventDefault();
            toggleLink(link);
          }}
        >
          {isChecked && (
            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </label>
    );
  };

  const renderCategoryAccordion = (catId: string, catName: string, catColor: string | null, links: Link[]) => {
    if (links.length === 0) return null;
    const isExpanded = expandedCategories.has(catId);
    const selectedInCategory = links.filter((l) => selectedLinkIds.has(l.id)).length;

    return (
      <div key={catId} className="overflow-hidden rounded-lg">
        {/* Category header */}
        <button
          type="button"
          onClick={() => toggleCategory(catId)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent"
        >
          {/* Expand arrow */}
          <svg
            className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>

          {/* Color dot */}
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: catColor || '#888' }}
          />

          {/* Name */}
          <span className="flex-1 text-sm font-medium text-left truncate">
            {catName}
          </span>

          {/* Count */}
          <span className="text-xs text-muted-foreground shrink-0">
            {selectedInCategory > 0 && (
              <span className="text-primary font-medium mr-1">{selectedInCategory} selected</span>
            )}
            {links.length}
          </span>
        </button>

        {/* Links list */}
        {isExpanded && (
          <div className="py-0.5 pl-6">
            {links.map(renderLinkRow)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingMacro ? 'Edit macro' : 'New macro'}</DialogTitle>
          <DialogDescription>A macro opens all of its sites at once with one click.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="macro-title" className="text-[13px]">Name</Label>
            <Input
              id="macro-title"
              autoFocus
              placeholder="e.g. Morning routine"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="macro-category" className="text-[13px]">Category</Label>
            <NativeSelect
              id="macro-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Inbox</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Link selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">Sites</Label>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary">
                {items.length} selected
              </span>
            </div>

            {/* Search */}
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <Input
                type="search"
                placeholder="Find a saved link"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-9"
              />
            </div>

            {/* Category accordions */}
            <div className="custom-scrollbar max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border p-1.5">
              {sortedCategories.map((cat) =>
                renderCategoryAccordion(
                  cat.id,
                  cat.name,
                  cat.color,
                  linksByCategory.grouped[cat.id] || []
                )
              )}

              {/* Inbox */}
              {linksByCategory.uncategorized.length > 0 &&
                renderCategoryAccordion(
                  '__uncategorized__',
                  'Inbox',
                  null,
                  linksByCategory.uncategorized
                )}

              {/* No results */}
              {sortedCategories.every(
                (cat) => !(linksByCategory.grouped[cat.id]?.length)
              ) &&
                linksByCategory.uncategorized.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No links found
                  </p>
                )}
            </div>

            {/* Custom URL section */}
            <div className="pt-1">
              {!showUrlInput ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUrlInput(true)}
                  className="w-full gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  Add an address that isn't saved
                </Button>
              ) : (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium">New address</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowUrlInput(false);
                        setCustomUrl('');
                        setCustomTitle('');
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <Input
                    type="url"
                    placeholder="https://example.com"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    className="h-9"
                    autoFocus
                  />
                  <Input
                    placeholder="Title (optional)"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddCustomUrl}
                    disabled={!customUrl.trim()}
                    className="w-full"
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>

            {/* Selected custom URLs display */}
            {items.filter((i) => i.type === 'custom').length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Added addresses</span>
                {items
                  .filter((i) => i.type === 'custom')
                  .map((item) => (
                    <div
                      key={item.tempId}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
                    >
                      <div className="w-5 h-5 rounded shrink-0 flex items-center justify-center overflow-hidden">
                        {item.custom_url && (
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(item.custom_url).hostname; } catch { return ''; } })()}&sz=32`}
                            alt=""
                            className="w-4 h-4 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                      </div>
                      <span className="flex-1 text-sm truncate">
                        {item.custom_title || item.custom_url}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.tempId)}
                        className="shrink-0 w-5 h-5 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-1">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || items.length === 0 || !title.trim()}>
              {isLoading ? 'Saving…' : editingMacro ? 'Save changes' : 'Create macro'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

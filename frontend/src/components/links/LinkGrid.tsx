'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link2, Plus, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LinkCard } from './LinkCard';
import { MacroCard } from './MacroCard';
import { Link, Category } from '@/types';
import { INBOX_CATEGORY_ID } from '@/lib/linkUtils';
import { getCardHeight, useCardPreferences } from '@/lib/cardPreferences';

const CATEGORY_DROP_PREFIX = 'category-drop:';
const INBOX_COLOR = 'var(--muted-foreground)';

function getCategoryDropId(categoryId: string | null) {
  return `${CATEGORY_DROP_PREFIX}${categoryId || INBOX_CATEGORY_ID}`;
}

function getCategoryIdFromDropId(id: string): string | null {
  if (!id.startsWith(CATEGORY_DROP_PREFIX)) return null;
  const rawId = id.slice(CATEGORY_DROP_PREFIX.length);
  return rawId === INBOX_CATEGORY_ID ? null : rawId;
}

interface LinkGridProps {
  links: Link[];
  categories?: Category[];
  onEdit: (link: Link) => void;
  onDelete: (id: string) => void;
  onReorder?: (linkIds: string[]) => Promise<void>;
  onMoveCategory?: (linkId: string, categoryId: string | null) => Promise<void>;
  /** Shown as the empty state's button. */
  onAddLink?: () => void;
  /** True when the list is filtered by a search, which changes the empty state. */
  isSearching?: boolean;
  isLoading?: boolean;
  groupByCategory?: boolean;
  viewMode?: 'grid' | 'list';
}

interface Group {
  key: string;
  categoryId: string | null;
  name: string;
  color: string;
  defaultFaviconId: string | null;
  links: Link[];
}

function CategoryDropZone({
  categoryId,
  className,
  children,
}: {
  categoryId: string | null;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: getCategoryDropId(categoryId) });

  return (
    <div
      ref={setNodeRef}
      className={`${className || ''} transition-[background-color,box-shadow] ${
        isOver ? 'bg-primary/[0.04] ring-2 ring-primary/35' : ''
      }`}
    >
      {children}
    </div>
  );
}

function SortableLinkCard({
  link,
  categoryDefaultFaviconId,
  onEdit,
  onDelete,
}: {
  link: Link;
  categoryDefaultFaviconId?: string | null;
  onEdit: (link: Link) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const CardComponent = link.type === 'macro' ? MacroCard : LinkCard;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <CardComponent link={link} categoryDefaultFaviconId={categoryDefaultFaviconId} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

function SectionHeader({ name, color, count }: { name: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <h2 className="text-sm font-semibold tracking-[-0.005em]">{name}</h2>
      <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function EmptySlot({ height, isDragging }: { height: number; isDragging: boolean }) {
  return (
    <div
      style={{ height }}
      className="flex items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground"
    >
      {isDragging ? 'Drop here' : 'No links yet'}
    </div>
  );
}

export function LinkGrid({
  links,
  categories = [],
  onEdit,
  onDelete,
  onReorder,
  onMoveCategory,
  onAddLink,
  isSearching,
  isLoading,
  groupByCategory = false,
  viewMode = 'grid',
}: LinkGridProps) {
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const cardPreferences = useCardPreferences();
  const cardHeight = getCardHeight(cardPreferences);
  // Tiles are narrower than compact rows, so more of them fit per row.
  const gridClass =
    cardPreferences.layout === 'tile'
      ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6'
      : 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveLinkId(String(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveLinkId(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    const activeLink = links.find((link) => link.id === activeId);
    if (!activeLink) return;

    const overLink = links.find((link) => link.id === overId);
    const targetCategoryId = overId.startsWith(CATEGORY_DROP_PREFIX)
      ? getCategoryIdFromDropId(overId)
      : overLink
        ? overLink.category_id
        : activeLink.category_id;

    if (groupByCategory && targetCategoryId !== activeLink.category_id && onMoveCategory) {
      await onMoveCategory(activeId, targetCategoryId);
      return;
    }

    if (active.id !== over.id && onReorder) {
      const oldIndex = links.findIndex((l) => l.id === active.id);
      const newIndex = links.findIndex((l) => l.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      await onReorder(arrayMove(links, oldIndex, newIndex).map((l) => l.id));
    }
  };

  const getCategoryDefaultFaviconId = (categoryId: string | null) => {
    if (!categoryId) return null;
    return categories.find((category) => category.id === categoryId)?.default_favicon_id || null;
  };

  const renderCards = (items: Link[], defaultFaviconId: string | null) =>
    items.map((link) => (
      <SortableLinkCard
        key={link.id}
        link={link}
        categoryDefaultFaviconId={defaultFaviconId ?? getCategoryDefaultFaviconId(link.category_id)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ));

  if (isLoading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{ height: cardHeight }}
            className="flex animate-pulse items-center gap-3 rounded-xl border border-border bg-card px-4"
          >
            <div className="size-10 shrink-0 rounded-[10px] bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-2/3 rounded bg-muted" />
              <div className="h-3 w-1/2 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
          {isSearching ? <SearchX className="size-6" /> : <Link2 className="size-6" />}
        </div>
        <h3 className="text-[15px] font-semibold">{isSearching ? 'Nothing matches' : 'No links here yet'}</h3>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
          {isSearching
            ? 'Try another word, or search by site address.'
            : 'Save a website and it will show up here.'}
        </p>
        {!isSearching && onAddLink && (
          <Button onClick={onAddLink} className="mt-5 gap-1.5">
            <Plus className="size-4" />
            Add a link
          </Button>
        )}
      </div>
    );
  }

  const dndProps = {
    sensors,
    collisionDetection: closestCenter,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragCancel: () => setActiveLinkId(null),
  };

  if (!groupByCategory) {
    return (
      <DndContext {...dndProps}>
        <SortableContext items={links.map((l) => l.id)} strategy={rectSortingStrategy}>
          <div className={gridClass}>{renderCards(links, null)}</div>
        </SortableContext>
      </DndContext>
    );
  }

  // Every category gets a section (empty ones too, so links can be dropped in), then the Inbox.
  const groups: Group[] = [
    ...[...categories]
      .sort((a, b) => a.order_index - b.order_index)
      .map((category) => ({
        key: category.id,
        categoryId: category.id,
        name: category.name,
        color: category.color,
        defaultFaviconId: category.default_favicon_id || null,
        links: links.filter((link) => link.category_id === category.id),
      })),
    {
      key: INBOX_CATEGORY_ID,
      categoryId: null,
      name: 'Inbox',
      color: INBOX_COLOR,
      defaultFaviconId: null,
      links: links.filter((link) => !link.category_id),
    },
  ];

  if (viewMode === 'list') {
    return (
      <DndContext {...dndProps}>
        <div className="custom-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 md:-mx-8 md:px-8">
          {groups.map((group) => (
            <CategoryDropZone
              key={group.key}
              categoryId={group.categoryId}
              className="flex w-72 shrink-0 flex-col rounded-2xl border border-border bg-muted/40 p-3"
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <h2 className="flex-1 truncate text-[13px] font-semibold">{group.name}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">{group.links.length}</span>
              </div>
              <SortableContext items={group.links.map((l) => l.id)} strategy={rectSortingStrategy}>
                <div className="custom-scrollbar max-h-[calc(100vh-220px)] min-h-16 space-y-2 overflow-y-auto">
                  {renderCards(group.links, group.defaultFaviconId)}
                  {group.links.length === 0 && <EmptySlot height={64} isDragging={Boolean(activeLinkId)} />}
                </div>
              </SortableContext>
            </CategoryDropZone>
          ))}
        </div>
      </DndContext>
    );
  }

  return (
    <DndContext {...dndProps}>
      <div className="space-y-9">
        {groups.map((group) => {
          // The Inbox section only matters when it has links or while dragging.
          if (group.categoryId === null && group.links.length === 0 && !activeLinkId) return null;

          return (
            <CategoryDropZone key={group.key} categoryId={group.categoryId} className="-m-2 space-y-3.5 rounded-2xl p-2">
              <SectionHeader name={group.name} color={group.color} count={group.links.length} />
              <SortableContext items={group.links.map((l) => l.id)} strategy={rectSortingStrategy}>
                <div className={gridClass}>
                  {renderCards(group.links, group.defaultFaviconId)}
                  {group.links.length === 0 && <EmptySlot height={cardHeight} isDragging={Boolean(activeLinkId)} />}
                </div>
              </SortableContext>
            </CategoryDropZone>
          );
        })}
      </div>
    </DndContext>
  );
}

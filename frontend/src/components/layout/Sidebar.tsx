'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AppWindow,
  GripVertical,
  History,
  Inbox,
  LayoutGrid,
  LogOut,
  MessageCircle,
  MessagesSquare,
  PanelLeft,
  PanelLeftClose,
  Pencil,
  Plus,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { OptionsDialog } from './OptionsDialog';
import { CategoryDialog, type CategoryFormValues } from './CategoryDialog';
import { Category } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { INBOX_CATEGORY_ID } from '@/lib/linkUtils';
import { useShareToChat } from '@/lib/shareToChat';
import { toast } from 'sonner';

export type SocialView = 'community' | 'chats' | 'friends' | 'history';

interface SidebarProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
  onOpenWidget?: (category: Category) => void;
  onCreateCategory: (name: string, color: string, defaultFaviconId?: string | null) => Promise<void>;
  onUpdateCategory: (id: string, name: string, color: string, defaultFaviconId?: string | null) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onReorderCategories?: (categoryIds: string[]) => Promise<void>;
  /** Link count per category id (INBOX_CATEGORY_ID for uncategorized). */
  linkCounts?: Record<string, number>;
  totalLinks?: number;
  /** Which social screen is open instead of the link list, if any. */
  socialView?: SocialView | null;
  onOpenSocial?: (view: SocialView) => void;
  unreadMessages?: number;
  pendingRequests?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const rowClass = (isSelected: boolean, isCollapsed: boolean) => `
  flex h-9 w-full items-center gap-2.5 rounded-lg text-[13.5px] transition-colors outline-none
  focus-visible:ring-2 focus-visible:ring-ring
  ${isCollapsed ? 'justify-center px-0' : 'px-2.5'}
  ${isSelected
    ? 'bg-card text-foreground font-medium shadow-card ring-1 ring-border/70'
    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-foreground'}
`;

function NavItem({
  icon,
  label,
  count,
  badge,
  isSelected,
  isCollapsed,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  count?: number;
  badge?: number;
  isSelected: boolean;
  isCollapsed: boolean;
  onClick: () => void;
}) {
  const badgeText = badge && badge > 99 ? '99+' : badge;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={isSelected ? 'page' : undefined}
      aria-label={isCollapsed ? label : undefined}
      title={isCollapsed ? label : undefined}
      className={rowClass(isSelected, isCollapsed)}
    >
      <span className={`relative shrink-0 ${isSelected ? 'text-primary' : ''}`}>
        {icon}
        {isCollapsed && badge ? <span className="absolute -right-1 -top-1 size-2 rounded-full bg-primary ring-2 ring-sidebar" /> : null}
      </span>
      {!isCollapsed && <span className="flex-1 truncate text-left">{label}</span>}
      {!isCollapsed && badge ? (
        <span
          className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
          aria-label={`${badge} new`}
        >
          {badgeText}
        </span>
      ) : (
        !isCollapsed && count !== undefined && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

interface SortableCategoryProps {
  category: Category;
  isSelected: boolean;
  isCollapsed: boolean;
  count?: number;
  onSelect: () => void;
  onOpenWidget?: () => void;
  onShare?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCategory({ category, isSelected, isCollapsed, count, onSelect, onOpenWidget, onShare, onEdit, onDelete }: SortableCategoryProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const actionClass =
    'flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground';

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* Grab anywhere on the row with a pointer; the handle is the keyboard way to reorder. */}
      <button
        type="button"
        onClick={onSelect}
        onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLButtonElement> | undefined}
        aria-current={isSelected ? 'page' : undefined}
        aria-label={isCollapsed ? category.name : undefined}
        title={isCollapsed ? category.name : undefined}
        className={`${rowClass(isSelected, isCollapsed)} ${isCollapsed ? '' : 'pr-2'}`}
      >
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
        {!isCollapsed && <span className="flex-1 truncate text-left">{category.name}</span>}
        {!isCollapsed && count !== undefined && (
          <span
            className={`text-xs tabular-nums transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 ${
              count === 0 ? 'text-muted-foreground/60' : 'text-muted-foreground'
            }`}
          >
            {count}
          </span>
        )}
      </button>

      {!isCollapsed && (
        <>
          <span
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${category.name}`}
            className="absolute -left-3 top-1/2 flex h-6 w-3 -translate-y-1/2 cursor-grab items-center justify-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-70 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-3" />
          </span>
          <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {onOpenWidget && (
              <button type="button" onClick={onOpenWidget} className={actionClass} aria-label={`Open ${category.name} as a widget`} title="Open as widget">
                <AppWindow className="size-3.5" />
              </button>
            )}
            {onShare && (
              <button type="button" onClick={onShare} className={actionClass} aria-label={`Share ${category.name} to a chat`} title="Share to chat">
                <Send className="size-3.5" />
              </button>
            )}
            <button type="button" onClick={onEdit} className={actionClass} aria-label={`Edit ${category.name}`} title="Edit">
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className={`${actionClass} hover:text-destructive`}
              aria-label={`Delete ${category.name}`}
              title="Delete"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Sidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onOpenWidget,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  linkCounts,
  totalLinks,
  socialView = null,
  onOpenSocial,
  unreadMessages = 0,
  pendingRequests = 0,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<{ id: string; values: CategoryFormValues } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorderCategories) return;

    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    try {
      await onReorderCategories(arrayMove(categories, oldIndex, newIndex).map((c) => c.id));
    } catch {
      toast.error('Failed to reorder categories');
    }
  };

  const handleCreate = async (values: CategoryFormValues) => {
    try {
      await onCreateCategory(values.name, values.color, values.defaultFaviconId);
      toast.success('Category created');
    } catch (error) {
      toast.error('Failed to create category');
      throw error;
    }
  };

  const handleUpdate = async (values: CategoryFormValues) => {
    if (!editing) return;
    try {
      await onUpdateCategory(editing.id, values.name, values.color, values.defaultFaviconId);
      toast.success('Category updated');
    } catch (error) {
      toast.error('Failed to update category');
      throw error;
    }
  };

  const handleDelete = async (category: Category) => {
    const count = linkCounts?.[category.id] ?? 0;
    const message = count
      ? `Delete “${category.name}”? Its ${count} ${count === 1 ? 'link moves' : 'links move'} to the Inbox.`
      : `Delete “${category.name}”?`;
    if (!window.confirm(message)) return;
    try {
      await onDeleteCategory(category.id);
    } catch {
      toast.error('Failed to delete category');
    }
  };

  // On phones the sidebar covers the page, so close it after a choice.
  const handleSelect = (id: string | null) => {
    onSelectCategory(id);
    if (window.innerWidth < 768) onToggleCollapse();
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch {
      toast.error('Failed to log out');
    }
  };

  const footerButton =
    'flex size-8 items-center justify-center rounded-lg text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground';

  return (
    <>
      {!isCollapsed && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden" onClick={onToggleCollapse} />
      )}
      <aside
        className={`
          fixed left-0 top-0 z-50 h-screen border-r border-sidebar-border bg-sidebar
          transition-[width,transform] duration-300 ease-out
          ${isCollapsed ? 'w-16 max-md:-translate-x-full' : 'w-[85vw] max-w-[300px] md:w-64'}
        `}
      >
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className={`flex h-16 shrink-0 items-center gap-2.5 ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}>
            {!isCollapsed && (
              <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5">
                <img src="/icon.png" alt="" className="size-7 rounded-lg" />
                <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">Web Collector</span>
              </Link>
            )}
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`${footerButton} ${isCollapsed ? '' : 'ml-auto'}`}
            >
              {isCollapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          </div>

          {/* Library */}
          <nav className="space-y-0.5 px-3" aria-label="Library">
            <NavItem
              icon={<LayoutGrid className="size-4" />}
              label="All links"
              count={totalLinks}
              isSelected={!socialView && selectedCategoryId === null}
              isCollapsed={isCollapsed}
              onClick={() => handleSelect(null)}
            />
            <NavItem
              icon={<Inbox className="size-4" />}
              label="Inbox"
              count={linkCounts ? linkCounts[INBOX_CATEGORY_ID] ?? 0 : undefined}
              isSelected={!socialView && selectedCategoryId === INBOX_CATEGORY_ID}
              isCollapsed={isCollapsed}
              onClick={() => handleSelect(INBOX_CATEGORY_ID)}
            />
          </nav>

          {onOpenSocial && (
            <nav className="mt-4 space-y-0.5 px-3" aria-label="People">
              {!isCollapsed && (
                <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">People</div>
              )}
              {([
                { view: 'chats' as const, label: 'Chats', icon: <MessageCircle className="size-4" />, badge: unreadMessages },
                { view: 'friends' as const, label: 'Friends', icon: <Users className="size-4" />, badge: pendingRequests },
                { view: 'community' as const, label: 'Community', icon: <MessagesSquare className="size-4" />, badge: 0 },
                { view: 'history' as const, label: 'Link history', icon: <History className="size-4" />, badge: 0 },
              ]).map((item) => (
                <NavItem
                  key={item.view}
                  icon={item.icon}
                  label={item.label}
                  badge={item.badge}
                  isSelected={socialView === item.view}
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    onOpenSocial(item.view);
                    if (window.innerWidth < 768) onToggleCollapse();
                  }}
                />
              ))}
            </nav>
          )}

          {/* Categories */}
          {isCollapsed ? (
            <div className="mx-4 my-3 h-px bg-sidebar-border" />
          ) : (
            <div className="flex items-center px-5 pb-1.5 pt-6">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Categories
              </span>
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                aria-label="New category"
                title="New category"
                className="-mr-1.5 ml-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <Plus className="size-4" />
              </button>
            </div>
          )}

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5">
                  {categories.map((category) => (
                    <SortableCategory
                      key={category.id}
                      category={category}
                      isSelected={!socialView && selectedCategoryId === category.id}
                      isCollapsed={isCollapsed}
                      count={linkCounts ? linkCounts[category.id] ?? 0 : undefined}
                      onSelect={() => handleSelect(category.id)}
                      onOpenWidget={onOpenWidget ? () => onOpenWidget(category) : undefined}
                      onShare={
                        onOpenSocial && (linkCounts?.[category.id] ?? 0) > 0
                          ? () => useShareToChat.getState().open({ kind: 'category', categoryId: category.id, name: category.name })
                          : undefined
                      }
                      onEdit={() =>
                        setEditing({
                          id: category.id,
                          values: {
                            name: category.name,
                            color: category.color,
                            defaultFaviconId: category.default_favicon_id || null,
                          },
                        })
                      }
                      onDelete={() => handleDelete(category)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {!isCollapsed && categories.length === 0 && (
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <Plus className="size-4" />
                Add your first category
              </button>
            )}
          </div>

          {/* Account */}
          <div
            className={`flex shrink-0 items-center gap-2 border-t border-sidebar-border px-3 py-3 ${
              isCollapsed ? 'flex-col' : ''
            }`}
          >
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary"
              title={user?.username}
            >
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{user?.username || 'User'}</span>
            )}
            <OptionsDialog triggerClassName={footerButton} />
            <button type="button" onClick={handleLogout} aria-label="Log out" title="Log out" className={`${footerButton} hover:text-destructive`}>
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      <CategoryDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} mode="create" onSubmit={handleCreate} />
      <CategoryDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        mode="edit"
        initialValues={editing?.values}
        onSubmit={handleUpdate}
      />
    </>
  );
}

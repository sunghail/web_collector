'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Columns3, Download, Layers, LayoutGrid, Link2, Menu, Plus, Upload } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { SearchField } from '@/components/layout/SearchField';
import { CommunityRoom } from '@/components/community/CommunityRoom';
import { ChatsView } from '@/components/social/ChatsView';
import { FriendsView } from '@/components/social/FriendsView';
import { LinkHistoryView } from '@/components/social/LinkHistoryView';
import { ShareToChatDialog } from '@/components/chat/ShareToChatDialog';
import type { ChatPlace } from '@/lib/shareToChat';
import { QuickOpen } from '@/components/links/QuickOpen';
import { useMyProfile } from '@/lib/myProfile';
import { useMessageNotifications, type SocialSummary } from '@/hooks/useMessageNotifications';
import { useNotificationPreferences } from '@/lib/notificationPreferences';
import type { SocialView } from '@/components/layout/Sidebar';
import { LinkGrid } from '@/components/links/LinkGrid';
import { AddLinkDialog } from '@/components/links/AddLinkDialog';
import { AddMacroDialog } from '@/components/links/AddMacroDialog';
import { useAuthStore } from '@/store/authStore';
import { Category, Link, MacroItemInput } from '@/types';
import api from '@/lib/api';
import { createBookmarkExportPayload, parseBookmarkImport } from '@/lib/bookmarkTransfer';
import { INBOX_CATEGORY_ID, toStoredCategoryId } from '@/lib/linkUtils';
import { useCardPreferences } from '@/lib/cardPreferences';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading, checkAuth } = useAuthStore();
  const [view, setView] = useState<'links' | SocialView>('links');
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  // A chat message to scroll to after opening its chat (from the Link history).
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);
  const [socialBadges, setSocialBadges] = useState({ unreadMessages: 0, pendingRequests: 0, communityMentions: 0 });
  const loadMyProfile = useMyProfile((state) => state.load);
  const [socialSummary, setSocialSummary] = useState<SocialSummary | null>(null);

  // Sidebar badges for unread chat messages and friend requests.
  const refreshSocialBadges = useCallback(async () => {
    try {
      const response = await api.get('/social/summary');
      setSocialSummary(response.data);
      setSocialBadges({
        unreadMessages: response.data.unreadMessages ?? 0,
        pendingRequests: response.data.pendingRequests ?? 0,
        communityMentions: response.data.mentions?.community ?? 0,
      });
    } catch {
      // Badges are a nice-to-have; try again on the next tick.
    }
  }, []);

  const [categories, setCategories] = useState<Category[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const hydrateCardPreferences = useCardPreferences((s) => s.hydrate);

  useEffect(() => {
    hydrateCardPreferences();
  }, [hydrateCardPreferences]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddLinkOpen, setIsAddLinkOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [isAddMacroOpen, setIsAddMacroOpen] = useState(false);
  const [editingMacro, setEditingMacro] = useState<Link | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isElectron, setIsElectron] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      e.preventDefault();
      searchInputRef.current?.focus();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('linkViewMode') as 'grid' | 'list';
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, []);

  useEffect(() => {
    setIsElectron(Boolean(window.electronAPI?.openWidget));
  }, []);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('linkViewMode', mode);
  };

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch data
  const fetchCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchLinks = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = selectedCategoryId ? { categoryId: selectedCategoryId } : {};
      const response = await api.get('/links', { params });
      setLinks(response.data.links || []);
    } catch (error) {
      console.error('Failed to fetch links:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategoryId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchCategories();
      fetchLinks();
    }
  }, [isAuthenticated, fetchCategories, fetchLinks]);

  useEffect(() => {
    if (!isAuthenticated) return;
    refreshSocialBadges();
    loadMyProfile();
    const timer = window.setInterval(() => {
      if (!document.hidden || useNotificationPreferences.getState().enabled) refreshSocialBadges();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, refreshSocialBadges, loadMyProfile]);

  const getDuplicateMessage = (error: unknown) => {
    const response = (error as {
      response?: {
        status?: number;
        data?: {
          duplicate?: {
            title?: string;
            category_id?: string | null;
          };
        };
      };
    }).response;
    if (response?.status !== 409) return null;

    const duplicate = response.data?.duplicate;
    const duplicateTitle = duplicate?.title;
    const duplicateCategoryId = duplicate?.category_id;
    const duplicateLocation = duplicateCategoryId
      ? categories.find((category) => category.id === duplicateCategoryId)?.name || 'another category'
      : 'Inbox';

    return duplicateTitle
      ? `Already saved in ${duplicateLocation}: ${duplicateTitle}`
      : `This link is already saved in ${duplicateLocation}`;
  };

  // Category actions
  const handleCreateCategory = async (name: string, color: string, defaultFaviconId?: string | null) => {
    const response = await api.post('/categories', { name, color, defaultFaviconId });
    setCategories([...categories, response.data.category]);
  };

  const handleUpdateCategory = async (id: string, name: string, color: string, defaultFaviconId?: string | null) => {
    const response = await api.put(`/categories/${id}`, { name, color, defaultFaviconId });
    setCategories(categories.map((c) => (c.id === id ? response.data.category : c)));
  };

  const handleDeleteCategory = async (id: string) => {
    await api.delete(`/categories/${id}`);
    setCategories(categories.filter((c) => c.id !== id));
    if (selectedCategoryId === id) {
      setSelectedCategoryId(null);
    }
    toast.success('Category deleted');
  };

  const handleReorderCategories = async (categoryIds: string[]) => {
    // Optimistic update
    const reorderedCategories = categoryIds.map((id, index) => {
      const category = categories.find((c) => c.id === id)!;
      return { ...category, order_index: index };
    });
    setCategories(reorderedCategories);

    // API call
    await api.put('/categories/reorder', { categoryIds });
  };

  // Link actions
  const handleAddLink = async (
    title: string,
    url: string,
    categoryId?: string,
    memo?: string,
    showFavicon?: boolean,
    favicon?: string
  ) => {
    try {
      const storedCategoryId = toStoredCategoryId(categoryId);

      if (editingLink) {
        const response = await api.put(`/links/${editingLink.id}`, {
          title,
          url,
          categoryId: storedCategoryId,
          memo,
          showFavicon,
          favicon,
        });
        setLinks(links.map((l) => (l.id === editingLink.id ? response.data.link : l)));
        setEditingLink(null);
        toast.success('Link updated!');
      } else {
        const response = await api.post('/links', { title, url, categoryId: storedCategoryId, memo, showFavicon, favicon });
        setLinks([response.data.link, ...links]);
        toast.success('Link added!');
      }
    } catch (error) {
      const duplicateMessage = getDuplicateMessage(error);
      if (duplicateMessage) {
        toast.error(duplicateMessage);
      } else {
        toast.error(editingLink ? 'Failed to update link' : 'Failed to add link');
      }
      throw error;
    }
  };

  // Macro actions
  const handleAddMacro = async (title: string, categoryId: string | undefined, macroItems: MacroItemInput[]) => {
    const storedCategoryId = toStoredCategoryId(categoryId);

    if (editingMacro) {
      const response = await api.put(`/links/${editingMacro.id}`, {
        title,
        categoryId: storedCategoryId,
        macroItems,
      });
      setLinks(links.map((l) => (l.id === editingMacro.id ? response.data.link : l)));
      setEditingMacro(null);
      toast.success('Macro updated!');
    } else {
      const response = await api.post('/links', {
        title,
        categoryId: storedCategoryId,
        type: 'macro',
        macroItems,
      });
      setLinks([response.data.link, ...links]);
      toast.success('Macro created!');
    }
  };

  const handleEditLink = (link: Link) => {
    if (link.type === 'macro') {
      setEditingMacro(link);
      setIsAddMacroOpen(true);
    } else {
      setEditingLink(link);
      setIsAddLinkOpen(true);
    }
  };

  const handleDeleteLink = async (id: string) => {
    await api.delete(`/links/${id}`);
    setLinks(links.filter((l) => l.id !== id));
    toast.success('Deleted');
  };

  const handleMoveLinkCategory = async (linkId: string, categoryId: string | null) => {
    const previousLinks = links;
    const targetCategoryId = toStoredCategoryId(categoryId);

    setLinks((currentLinks) =>
      currentLinks.map((link) =>
        link.id === linkId ? { ...link, category_id: targetCategoryId } : link
      )
    );

    try {
      await api.put(`/links/${linkId}`, { categoryId: targetCategoryId });
      const targetName =
        targetCategoryId === null
          ? 'Inbox'
          : categories.find((category) => category.id === targetCategoryId)?.name || 'category';
      toast.success(`Moved to ${targetName}`);
    } catch (error) {
      setLinks(previousLinks);
      toast.error('Failed to move link');
      throw error;
    }
  };

  const handleExportBookmarks = async () => {
    try {
      const response = await api.get('/links');
      const payload = createBookmarkExportPayload(categories, response.data.links || []);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `web-collector-bookmarks-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Bookmarks exported');
    } catch (error) {
      console.error('Failed to export bookmarks:', error);
      toast.error('Failed to export bookmarks');
    }
  };

  const handleImportBookmarks = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const parsed = parseBookmarkImport(await file.text(), file.name);
      const categoryByName = new Map(categories.map((category) => [category.name.trim().toLowerCase(), category]));
      const sourceLinkToId = new Map<string, string>();
      let createdCategories = 0;
      let createdLinks = 0;
      let skippedDuplicates = 0;
      let failedCategories = 0;
      let failedLinks = 0;

      for (const category of parsed.categories) {
        const name = category.name.trim();
        if (!name) continue;

        const key = name.toLowerCase();
        let existingCategory = categoryByName.get(key);

        if (!existingCategory) {
          try {
            const response = await api.post('/categories', {
              name,
              color: category.color || '#8e8e93',
              defaultFaviconId: category.defaultFaviconId ?? null,
            });
            const createdCategory = response.data.category as Category;
            existingCategory = createdCategory;
            categoryByName.set(key, createdCategory);
            createdCategories += 1;
          } catch (error) {
            failedCategories += 1;
            console.error('Failed to import category:', name, error);
          }
        }
      }

      const normalLinks = parsed.links.filter((link) => link.type !== 'macro');
      const macroLinks = parsed.links.filter((link) => link.type === 'macro');

      for (const link of normalLinks) {
        const categoryId = link.categoryName
          ? categoryByName.get(link.categoryName.trim().toLowerCase())?.id
          : null;

        try {
          const response = await api.post('/links', {
            title: link.title,
            url: link.url,
            categoryId,
            memo: link.memo,
            showFavicon: link.showFavicon,
            favicon: link.favicon || undefined,
          });
          createdLinks += 1;
          if (link.sourceId) {
            sourceLinkToId.set(link.sourceId, response.data.link.id);
          }
        } catch (error) {
          const duplicate = (error as { response?: { status?: number; data?: { duplicate?: { id?: string } } } }).response?.data?.duplicate;
          if ((error as { response?: { status?: number } }).response?.status === 409) {
            skippedDuplicates += 1;
            if (link.sourceId && duplicate?.id) {
              sourceLinkToId.set(link.sourceId, duplicate.id);
            }
            continue;
          }
          failedLinks += 1;
          console.error('Failed to import link:', link.url, error);
        }
      }

      for (const link of macroLinks) {
        const macroItems = (link.macroItems || [])
          .map((item, index) => {
            if (item.sourceLinkId && sourceLinkToId.has(item.sourceLinkId)) {
              return { link_id: sourceLinkToId.get(item.sourceLinkId), order_index: item.order_index ?? index };
            }

            if (item.custom_url) {
              return {
                custom_url: item.custom_url,
                custom_title: item.custom_title || undefined,
                order_index: item.order_index ?? index,
              };
            }

            return null;
          })
          .filter(Boolean);

        if (macroItems.length === 0) continue;

        const categoryId = link.categoryName
          ? categoryByName.get(link.categoryName.trim().toLowerCase())?.id
          : null;

        try {
          await api.post('/links', {
            title: link.title,
            categoryId,
            type: 'macro',
            macroItems,
          });
          createdLinks += 1;
        } catch (error) {
          failedLinks += 1;
          console.error('Failed to import macro:', link.title, error);
        }
      }

      await fetchCategories();
      await fetchLinks();
      const summary = [
        `Imported ${createdLinks} links`,
        createdCategories ? `${createdCategories} categories` : '',
        skippedDuplicates ? `skipped ${skippedDuplicates} duplicates` : '',
        failedCategories || failedLinks ? `failed ${failedCategories + failedLinks}` : '',
      ].filter(Boolean);

      if (failedCategories || failedLinks) {
        toast.warning(summary.join(', '));
      } else {
        toast.success(summary.join(', '));
      }
    } catch (error) {
      console.error('Failed to import bookmarks:', error);
      toast.error('Failed to import bookmarks');
    } finally {
      event.target.value = '';
      setIsImporting(false);
    }
  };

  const handleOpenWidget = async (category?: Category) => {
    const targetCategory = category || selectedCategory;

    if (!targetCategory || !window.electronAPI?.openWidget) {
      console.warn('Widget API unavailable or no category selected', {
        hasApi: Boolean(window.electronAPI?.openWidget),
        selectedCategoryId: targetCategory?.id || selectedCategoryId,
      });
      return;
    }

    try {
      console.log('Opening widget for category', targetCategory);
      await window.electronAPI.openWidget({
        categoryId: targetCategory.id,
        categoryName: targetCategory.name,
        categoryColor: targetCategory.color,
        defaultFaviconId: targetCategory.default_favicon_id,
      });
    } catch (error) {
      console.error('Failed to open widget:', error);
      toast.error('Failed to open widget');
    }
  };

  const handleReorderLinks = async (linkIds: string[]) => {
    // Optimistic update
    const reorderedLinks = linkIds.map((id) => {
      return links.find((l) => l.id === id)!;
    });
    setLinks(reorderedLinks);

    // API call
    await api.put('/links/reorder', { linkIds });
  };

  // Filter links by search (including macro_items)
  const linkCounts = links.reduce<Record<string, number>>((counts, link) => {
    const key = link.category_id || INBOX_CATEGORY_ID;
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const filteredLinks = links.filter((link) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();

    // Match title or url
    if (link.title.toLowerCase().includes(query)) return true;
    if (link.url.toLowerCase().includes(query)) return true;

    // For macros, also search inside macro_items
    if (link.type === 'macro' && link.macro_items) {
      return link.macro_items.some(
        (item) =>
          (item.resolved_url && item.resolved_url.toLowerCase().includes(query)) ||
          (item.resolved_title && item.resolved_title.toLowerCase().includes(query)) ||
          (item.custom_url && item.custom_url.toLowerCase().includes(query)) ||
          (item.custom_title && item.custom_title.toLowerCase().includes(query))
      );
    }

    return false;
  });

  // Get category name for header
  const isInboxSelected = selectedCategoryId === INBOX_CATEGORY_ID;
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  /** Opens the community room or a chat room, optionally at a given message. */
  const openChat = (place: ChatPlace, messageId: string | null = null) => {
    setFocusMessageId(messageId);
    if (place.kind === 'community') {
      setView('community');
    } else {
      setActiveRoomId(place.roomId);
      setView('chats');
    }
  };

  // Pop-up notifications for new messages, following the settings.
  useMessageNotifications(socialSummary, {
    view,
    activeRoomId,
    onOpen: (place, messageId) => openChat(place, messageId ?? null),
  });

  // Saving from a chat can add links and, for a shared category, a category too.
  const handleLinkSavedFromChat = () => {
    fetchLinks();
    fetchCategories();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const pageTitle = isInboxSelected ? 'Inbox' : selectedCategory ? selectedCategory.name : 'All links';
  const titleDotColor = isInboxSelected ? undefined : selectedCategory?.color;
  const showViewToggle = selectedCategoryId === null && !searchQuery;
  const menuItemClass = 'cursor-pointer gap-2.5 py-2';

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={(id) => {
          setSelectedCategoryId(id);
          setView('links');
        }}
        onOpenWidget={isElectron ? handleOpenWidget : undefined}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onReorderCategories={handleReorderCategories}
        linkCounts={linkCounts}
        totalLinks={links.length}
        socialView={view === 'links' ? null : view}
        onOpenSocial={(next) => {
          setFocusMessageId(null);
          setView(next);
        }}
        unreadMessages={socialBadges.unreadMessages}
        pendingRequests={socialBadges.pendingRequests}
        communityMentions={socialBadges.communityMentions}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      <main className={`min-h-screen transition-[margin] duration-300 ml-0 ${isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'}`}>
        {view === 'community' && user ? (
          <CommunityRoom
            currentUserId={user.id}
            onOpenSidebar={() => setIsSidebarCollapsed(false)}
            onLinkSaved={handleLinkSavedFromChat}
            focusMessageId={focusMessageId}
            onFocused={() => setFocusMessageId(null)}
            unseenMentions={socialBadges.communityMentions}
            onMentionsSeen={refreshSocialBadges}
          />
        ) : view === 'chats' && user ? (
          <ChatsView
            currentUserId={user.id}
            roomId={activeRoomId}
            onSelectRoom={setActiveRoomId}
            onOpenSidebar={() => setIsSidebarCollapsed(false)}
            onOpenFriends={() => setView('friends')}
            onLinkSaved={handleLinkSavedFromChat}
            onChanged={refreshSocialBadges}
            focusMessageId={focusMessageId}
            onFocused={() => setFocusMessageId(null)}
          />
        ) : view === 'history' && user ? (
          <LinkHistoryView
            onOpenSidebar={() => setIsSidebarCollapsed(false)}
            onGoToMessage={openChat}
            onLinkSaved={handleLinkSavedFromChat}
          />
        ) : view === 'friends' && user ? (
          <FriendsView
            onOpenSidebar={() => setIsSidebarCollapsed(false)}
            onChanged={refreshSocialBadges}
            onMessage={async (friend) => {
              try {
                const response = await api.post('/rooms/direct', { userId: friend.id });
                setActiveRoomId(response.data.room.id);
                setView('chats');
              } catch {
                toast.error(`Could not open the chat with @${friend.handle}`);
              }
            }}
          />
        ) : (
        <>
        <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 md:px-8">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              aria-label="Open sidebar"
              className="-ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>

            <div className="flex min-w-[8.5rem] flex-1 items-center gap-2.5">
              {isInboxSelected && <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" />}
              {titleDotColor && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: titleDotColor }} />}
              <h1 className="truncate text-[19px] font-semibold tracking-[-0.015em]">{pageTitle}</h1>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                {searchQuery ? `${filteredLinks.length} found` : filteredLinks.length}
              </span>
            </div>

            <SearchField
              ref={searchInputRef}
              value={searchQuery}
              onChange={setSearchQuery}
              className="hidden min-w-0 w-64 shrink sm:flex lg:w-72"
            />

            {showViewToggle && (
              <div className="hidden rounded-lg bg-muted p-0.5 sm:flex" role="radiogroup" aria-label="Layout">
                {([
                  { id: 'grid', label: 'Sections', icon: <LayoutGrid className="size-4" /> },
                  { id: 'list', label: 'Board', icon: <Columns3 className="size-4" /> },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={viewMode === option.id}
                    aria-label={`${option.label} view`}
                    title={`${option.label} view`}
                    onClick={() => handleViewModeChange(option.id)}
                    className={`flex size-8 items-center justify-center rounded-md transition-colors ${
                      viewMode === option.id
                        ? 'bg-card text-foreground shadow-card'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.icon}
                  </button>
                ))}
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="h-9 gap-1.5 pl-3 pr-2.5">
                  <Plus className="size-4" />
                  <span className="hidden sm:inline">Add</span>
                  <ChevronDown className="size-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingLink(null);
                    setIsAddLinkOpen(true);
                  }}
                  className={menuItemClass}
                >
                  <Link2 className="size-4" />
                  <div>
                    <div>New link</div>
                    <div className="text-xs text-muted-foreground">Save one website</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditingMacro(null);
                    setIsAddMacroOpen(true);
                  }}
                  className={menuItemClass}
                >
                  <Layers className="size-4" />
                  <div>
                    <div>New macro</div>
                    <div className="text-xs text-muted-foreground">Open several sites at once</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImporting}
                  className={menuItemClass}
                >
                  <Upload className="size-4" />
                  {isImporting ? 'Importing…' : 'Import bookmarks'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportBookmarks} disabled={isImporting} className={menuItemClass}>
                  <Download className="size-4" />
                  Export bookmarks
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="px-4 pb-3 sm:hidden">
            <SearchField value={searchQuery} onChange={setSearchQuery} showShortcut={false} />
          </div>
        </header>

        <div className="px-4 py-6 md:px-8 md:py-7">
          <LinkGrid
            links={filteredLinks}
            categories={categories}
            onEdit={handleEditLink}
            onDelete={handleDeleteLink}
            onReorder={handleReorderLinks}
            onMoveCategory={handleMoveLinkCategory}
            onAddLink={() => {
              setEditingLink(null);
              setIsAddLinkOpen(true);
            }}
            isSearching={Boolean(searchQuery)}
            isLoading={isLoading}
            groupByCategory={selectedCategoryId === null && !searchQuery}
            viewMode={selectedCategoryId === null && !searchQuery ? viewMode : 'grid'}
          />
        </div>
        </>
        )}
      </main>

      <input
        ref={importInputRef}
        type="file"
        accept=".json,.html,.htm"
        className="hidden"
        onChange={handleImportBookmarks}
      />

      <ShareToChatDialog onOpenPlace={(place) => openChat(place)} />
      <QuickOpen
        onSelectCategory={(id) => {
          setSelectedCategoryId(id);
          setView('links');
        }}
        onOpenView={(next) => {
          setFocusMessageId(null);
          setView(next);
        }}
      />

      {/* Add/Edit Link Dialog */}
      <AddLinkDialog
        isOpen={isAddLinkOpen}
        onClose={() => {
          setIsAddLinkOpen(false);
          setEditingLink(null);
        }}
        onSubmit={handleAddLink}
        categories={categories}
        selectedCategoryId={isInboxSelected ? null : selectedCategoryId}
        editingLink={editingLink}
      />

      {/* Add/Edit Macro Dialog */}
      <AddMacroDialog
        isOpen={isAddMacroOpen}
        onClose={() => {
          setIsAddMacroOpen(false);
          setEditingMacro(null);
        }}
        onSubmit={handleAddMacro}
        categories={categories}
        selectedCategoryId={isInboxSelected ? null : selectedCategoryId}
        allLinks={links}
        editingMacro={editingMacro}
      />
    </div>
  );
}

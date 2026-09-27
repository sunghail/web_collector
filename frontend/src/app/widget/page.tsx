'use client';

import { useState, useEffect, useRef } from 'react';
import { Link } from '@/types';
import api from '@/lib/api';
import { getFallbackFaviconDataUrl, normalizeFallbackFaviconDataUrl } from '@/lib/fallbackFavicons';

interface CategoryData {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  defaultFaviconId?: string | null;
}

const themes = {
  dark: {
    bgRgb: '30, 30, 30',
    border: 'rgba(255, 255, 255, 0.15)',
    headerBorder: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    textMuted: 'rgba(255, 255, 255, 0.5)',
    textFaint: 'rgba(255, 255, 255, 0.35)',
    textTiny: 'rgba(255, 255, 255, 0.2)',
    closeBtn: 'rgba(255, 255, 255, 0.15)',
    closeBtnHover: 'rgba(255, 255, 255, 0.25)',
    closeIcon: 'rgba(255, 255, 255, 0.8)',
    hoverBg: 'rgba(255, 255, 255, 0.1)',
    iconBg: 'rgba(255, 255, 255, 0.15)',
    iconText: 'rgba(255, 255, 255, 0.6)',
    arrow: 'rgba(255, 255, 255, 0.3)',
    footerBorder: 'rgba(255, 255, 255, 0.08)',
    spinner: 'rgba(255, 255, 255, 0.2)',
    spinnerTop: 'rgba(255, 255, 255, 0.8)',
    scrollThumb: 'rgba(255, 255, 255, 0.15)',
    scrollThumbHover: 'rgba(255, 255, 255, 0.25)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    dropdownBg: 'rgba(45, 45, 45, 0.98)',
    dropdownHover: 'rgba(255, 255, 255, 0.1)',
    dropdownActiveBg: 'rgba(255, 255, 255, 0.06)',
  },
  light: {
    bgRgb: '255, 255, 255',
    border: 'rgba(0, 0, 0, 0.12)',
    headerBorder: 'rgba(0, 0, 0, 0.08)',
    text: '#1a1a1a',
    textMuted: 'rgba(0, 0, 0, 0.45)',
    textFaint: 'rgba(0, 0, 0, 0.35)',
    textTiny: 'rgba(0, 0, 0, 0.2)',
    closeBtn: 'rgba(0, 0, 0, 0.08)',
    closeBtnHover: 'rgba(0, 0, 0, 0.15)',
    closeIcon: 'rgba(0, 0, 0, 0.6)',
    hoverBg: 'rgba(0, 0, 0, 0.06)',
    iconBg: 'rgba(0, 0, 0, 0.08)',
    iconText: 'rgba(0, 0, 0, 0.5)',
    arrow: 'rgba(0, 0, 0, 0.25)',
    footerBorder: 'rgba(0, 0, 0, 0.06)',
    spinner: 'rgba(0, 0, 0, 0.15)',
    spinnerTop: 'rgba(0, 0, 0, 0.6)',
    scrollThumb: 'rgba(0, 0, 0, 0.12)',
    scrollThumbHover: 'rgba(0, 0, 0, 0.2)',
    shadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
    dropdownBg: 'rgba(250, 250, 250, 0.98)',
    dropdownHover: 'rgba(0, 0, 0, 0.06)',
    dropdownActiveBg: 'rgba(0, 0, 0, 0.04)',
  },
};

function isLocalFilePath(url: string) {
  return (
    /^[A-Za-z]:\\/.test(url) ||
    url.startsWith('\\\\') ||
    url.startsWith('/') ||
    url.startsWith('~/') ||
    url.startsWith('file://')
  );
}

function toOpenableLocalPath(url: string) {
  if (!url.startsWith('file://')) {
    return url;
  }

  try {
    const parsed = new URL(url);
    const decodedPath = decodeURIComponent(parsed.pathname);
    if (window.electronAPI?.platform === 'win32' && /^\/[A-Za-z]:/.test(decodedPath)) {
      return decodedPath.slice(1).replace(/\//g, '\\');
    }

    return decodedPath;
  } catch {
    return url;
  }
}

function getHttpErrorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null || !('response' in error)) {
    return undefined;
  }

  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
}

export default function WidgetPage() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryData | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [opacity, setOpacity] = useState(0.92);
  const [showOpacitySlider, setShowOpacitySlider] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mergePreview, setMergePreview] = useState<{ show: boolean; categories: CategoryData[] }>({ show: false, categories: [] });
  const [mergeSlideColor, setMergeSlideColor] = useState<string | null>(null);
  const [draggingCategory, setDraggingCategory] = useState<CategoryData | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('categoryId');
    const categoryName = params.get('categoryName');

    if (!categoryId || !categoryName) {
      return;
    }

    const initialCategory = {
      categoryId,
      categoryName,
      categoryColor: params.get('categoryColor') || '#007AFF',
      defaultFaviconId: params.get('defaultFaviconId'),
    };

    setCategories((prev) => {
      if (prev.some((category) => category.categoryId === initialCategory.categoryId)) {
        return prev;
      }

      return [initialCategory, ...prev];
    });

    setActiveCategory((prev) => prev || initialCategory);
  }, []);

  // Load saved opacity
  useEffect(() => {
    const saved = localStorage.getItem('widget-opacity');
    if (saved) setOpacity(parseFloat(saved));
  }, []);

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    localStorage.setItem('widget-opacity', String(value));
  };

  // Detect theme
  useEffect(() => {
    const detectTheme = () => {
      const stored = localStorage.getItem('theme');
      if (stored === 'light') {
        setIsDark(false);
      } else if (stored === 'dark') {
        setIsDark(true);
      } else {
        setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    };

    detectTheme();

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme') detectTheme();
    };
    window.addEventListener('storage', onStorage);
    const interval = setInterval(detectTheme, 2000);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // IPC: initial category
  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) return;

    electronAPI.onSetCategory((_event: unknown, data: CategoryData) => {
      setCategories([data]);
      setActiveCategory(data);
    });

    // IPC: add categories (merge)
    electronAPI.onAddCategories((_event: unknown, newCats: CategoryData[]) => {
      setCategories((prev) => {
        const merged = [...prev];
        for (const cat of newCats) {
          if (!merged.find((c) => c.categoryId === cat.categoryId)) {
            merged.push(cat);
          }
        }
        return merged;
      });
    });

    // IPC: switch to a specific category
    electronAPI.onSwitchCategory((_event: unknown, categoryId: string) => {
      setCategories((prev) => {
        const found = prev.find((c) => c.categoryId === categoryId);
        if (found) setActiveCategory(found);
        return prev;
      });
    });

    // IPC: merge preview (glow effect + incoming category dots)
    electronAPI.onMergePreview((_event: unknown, data: { show: boolean; categories: CategoryData[] }) => {
      setMergePreview(data);
    });

    // IPC: merge with slide-in animation
    electronAPI.onMergeAnimate((_event: unknown, data: { color: string; categories: CategoryData[] }) => {
      // Show color slide-in
      setMergeSlideColor(data.color);

      // Add categories after a short delay
      setTimeout(() => {
        setCategories((prev) => {
          const merged = [...prev];
          for (const cat of data.categories) {
            if (!merged.find((c) => c.categoryId === cat.categoryId)) {
              merged.push(cat);
            }
          }
          return merged;
        });
      }, 300);

      // Remove slide overlay after animation
      setTimeout(() => {
        setMergeSlideColor(null);
      }, 800);
    });

    return () => {
      electronAPI.removeSetCategoryListener();
      electronAPI.removeAddCategoriesListener();
      electronAPI.removeSwitchCategoryListener();
      electronAPI.removeMergePreviewListener();
      electronAPI.removeMergeAnimateListener();
    };
  }, []);

  // Fetch links when active category changes
  useEffect(() => {
    if (!activeCategory) return;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let cancelled = false;

    const fetchLinks = async () => {
      if (retryCount === 0) setIsLoading(true);
      try {
        const response = await api.get('/links', {
          params: { categoryId: activeCategory.categoryId },
        });
        setLinks(response.data.links || []);
        setIsLoading(false);
      } catch (error: unknown) {
        // Retry on 401 - user might not be logged in yet (widget restored before auth)
        if (getHttpErrorStatus(error) === 401 && !cancelled && retryCount < 10) {
          retryCount++;
          retryTimeout = setTimeout(fetchLinks, 3000);
          return; // Keep isLoading true during retries to avoid flickering
        }
        setLinks([]);
        setIsLoading(false);
      }
    };

    fetchLinks();
    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
    };
  }, [activeCategory]);

  const handleLinkClick = (url: string) => {
    if (isLocalFilePath(url) && window.electronAPI?.openPath) {
      window.electronAPI.openPath(toOpenableLocalPath(url));
    } else {
      window.open(url, '_blank');
    }
  };

  const handleMacroClick = (link: Link) => {
    const items = link.macro_items || [];
    const urls = items
      .map((item) => item.resolved_url || item.custom_url)
      .filter(Boolean) as string[];

    if (urls.length === 0) return;

    // Electron: use IPC
    if (window.electronAPI?.openUrls) {
      window.electronAPI.openUrls(urls);
      return;
    }

    // Fallback: staggered open
    window.open(urls[0], '_blank');
    urls.slice(1).forEach((url, index) => {
      setTimeout(() => {
        window.open(url, '_blank');
      }, (index + 1) * 300);
    });
  };

  const handleClose = () => {
    if (window.electronAPI?.closeWidgetSelf) {
      window.electronAPI.closeWidgetSelf();
    } else {
      window.electronAPI?.sendToggleWidget?.();
    }
  };

  const handleCategorySwitch = (cat: CategoryData) => {
    setActiveCategory(cat);
    setShowDropdown(false);
  };

  const handleRemoveCategory = (categoryId: string) => {
    window.electronAPI?.removeCategory?.(categoryId);
    setCategories((prev) => {
      const updated = prev.filter((c) => c.categoryId !== categoryId);
      // If we removed the active category, switch to first remaining
      if (activeCategory?.categoryId === categoryId && updated.length > 0) {
        setActiveCategory(updated[0]);
      }
      // If no categories left, close this widget only
      if (updated.length === 0) {
        if (window.electronAPI?.closeWidgetSelf) {
          window.electronAPI.closeWidgetSelf();
        } else {
          window.electronAPI?.sendToggleWidget?.();
        }
      }
      if (updated.length <= 1) {
        setShowDropdown(false);
      }
      return updated;
    });
  };

  // Drag-to-detach: mousedown on dropdown item → drag outside → create new widget
  const handleDetachStart = (cat: CategoryData, e: React.MouseEvent) => {
    if (categories.length < 2) return;
    e.preventDefault();
    setDraggingCategory(cat);

    const handleMouseUp = () => {
      setDraggingCategory(null);
      document.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };

    const handleMouseLeave = () => {
      // Mouse left the widget window → detach this category
      if (cat) {
        window.electronAPI?.detachCategory?.({
          categoryId: cat.categoryId,
          categoryName: cat.categoryName,
          categoryColor: cat.categoryColor,
          defaultFaviconId: cat.defaultFaviconId,
        });
        // Remove from local state
        setCategories((prev) => {
          const updated = prev.filter((c) => c.categoryId !== cat.categoryId);
          if (activeCategory?.categoryId === cat.categoryId && updated.length > 0) {
            setActiveCategory(updated[0]);
          }
          return updated;
        });
        setShowDropdown(false);
      }
      setDraggingCategory(null);
      document.removeEventListener('mouseup', handleMouseUp);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
  };

  const t = isDark ? themes.dark : themes.light;
  const accentColor = activeCategory?.categoryColor || '#007AFF';
  const hasMultipleCategories = categories.length > 1;
  const fallbackFaviconUrl = getFallbackFaviconDataUrl(activeCategory?.defaultFaviconId);

  return (
    <div
      className="widget-container"
      style={{
        width: '100%',
        height: '100vh',
        background: 'transparent',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: `rgba(${t.bgRgb}, ${opacity})`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: mergePreview.show ? `2px solid ${accentColor}` : `1px solid ${t.border}`,
          boxShadow: mergePreview.show
            ? `0 0 20px ${accentColor}80, 0 0 40px ${accentColor}40, ${t.shadow}`
            : t.shadow,
          transform: mergePreview.show ? 'scale(1.02)' : 'scale(1)',
          transition: 'box-shadow 0.3s ease, border 0.3s ease, transform 0.3s ease',
        }}
      >
        {/* Merge slide-in overlay */}
        {mergeSlideColor && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: '50%',
              backgroundColor: mergeSlideColor,
              opacity: 0.25,
              borderRadius: '0 12px 12px 0',
              zIndex: 100,
              animation: 'merge-slide-in 0.5s ease-out forwards, merge-fade-out 0.3s ease 0.5s forwards',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Color accent bar */}
        <div
          style={{
            height: '3px',
            backgroundColor: accentColor,
            flexShrink: 0,
          }}
        />

        {/* Header - draggable */}
        <div
          ref={dropdownRef}
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'grab',
            borderBottom: `1px solid ${t.headerBorder}`,
            flexShrink: 0,
            position: 'relative',
            // @ts-expect-error Electron CSS extension
            WebkitAppRegion: 'drag',
          }}
        >
          {/* Category selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: 0,
              cursor: hasMultipleCategories ? 'pointer' : 'grab',
              // @ts-expect-error Electron CSS extension
              WebkitAppRegion: hasMultipleCategories ? 'no-drag' : 'drag',
            }}
            onClick={hasMultipleCategories ? () => setShowDropdown(!showDropdown) : undefined}
          >
            <div
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: accentColor,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0px',
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  color: t.text,
                  fontSize: '13px',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeCategory?.categoryName || 'Widget'}
              </span>
              {/* Merge preview: show incoming categories inline */}
              {mergePreview.show && mergePreview.categories.length > 0 && (
                <>
                  <span style={{ color: t.textMuted, fontSize: '12px', margin: '0 5px', flexShrink: 0 }}>/</span>
                  {mergePreview.categories.map((cat, idx) => (
                    <span
                      key={cat.categoryId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        animation: 'preview-name-slide 0.25s ease-out',
                      }}
                    >
                      {idx > 0 && <span style={{ color: t.textMuted, fontSize: '12px', margin: '0 3px' }}>/</span>}
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.categoryColor, flexShrink: 0 }} />
                      <span style={{ color: cat.categoryColor, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{cat.categoryName}</span>
                    </span>
                  ))}
                </>
              )}
            </div>
            {/* Chevron for multi-category */}
            {hasMultipleCategories && (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke={t.textMuted}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  flexShrink: 0,
                  transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>

          {/* Close button */}
          <button
            data-no-drag
            onClick={handleClose}
            style={{
              background: t.closeBtn,
              border: 'none',
              borderRadius: '50%',
              width: '22px',
              height: '22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              // @ts-expect-error Electron CSS extension
              WebkitAppRegion: 'no-drag',
              color: t.closeIcon,
              fontSize: '14px',
              lineHeight: 1,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = t.closeBtnHover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = t.closeBtn;
            }}
          >
            &#x2715;
          </button>

          {/* Category dropdown */}
          {showDropdown && hasMultipleCategories && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                right: '0',
                backgroundColor: t.dropdownBg,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderBottom: `1px solid ${t.border}`,
                zIndex: 50,
                // @ts-expect-error Electron CSS extension
                WebkitAppRegion: 'no-drag',
              }}
            >
              {categories.map((cat) => (
                <div
                  key={cat.categoryId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '8px 10px 8px 14px',
                    background:
                      draggingCategory?.categoryId === cat.categoryId
                        ? t.dropdownHover
                        : cat.categoryId === activeCategory?.categoryId
                          ? t.dropdownActiveBg
                          : 'transparent',
                    cursor: 'grab',
                    textAlign: 'left' as const,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (cat.categoryId !== activeCategory?.categoryId && !draggingCategory) {
                      (e.currentTarget as HTMLElement).style.background = t.dropdownHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!draggingCategory) {
                      (e.currentTarget as HTMLElement).style.background =
                        cat.categoryId === activeCategory?.categoryId
                          ? t.dropdownActiveBg
                          : 'transparent';
                    }
                  }}
                  onMouseDown={(e) => handleDetachStart(cat, e)}
                  onClick={() => handleCategorySwitch(cat)}
                >
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: cat.categoryColor,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: t.text,
                      fontSize: '12px',
                      fontWeight: cat.categoryId === activeCategory?.categoryId ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {cat.categoryName}
                  </span>
                  {/* Active check mark */}
                  {cat.categoryId === activeCategory?.categoryId && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {/* X button to remove category */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveCategory(cat.categoryId);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      opacity: 0.4,
                      transition: 'opacity 0.15s, background 0.15s',
                      color: t.closeIcon,
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.9';
                      (e.currentTarget as HTMLElement).style.background = t.closeBtnHover;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.opacity = '0.4';
                      (e.currentTarget as HTMLElement).style.background = 'none';
                    }}
                    title="카테고리 제거"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Links list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '6px',
          }}
          className="widget-scrollbar"
        >
          {categories.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: t.textMuted,
                fontSize: '12px',
                textAlign: 'center',
                padding: '20px',
              }}
            >
              대시보드에서 카테고리를 선택하세요
            </div>
          )}

          {isLoading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: t.textMuted,
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  border: `2px solid ${t.spinner}`,
                  borderTopColor: t.spinnerTop,
                  borderRadius: '50%',
                  animation: 'widget-spin 0.6s linear infinite',
                }}
              />
            </div>
          )}

          {!isLoading && activeCategory && links.length === 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: t.textMuted,
                fontSize: '12px',
              }}
            >
              링크가 없습니다
            </div>
          )}

          {!isLoading &&
            links.map((link) =>
              link.type === 'macro' ? (
                /* Macro item */
                <button
                  key={link.id}
                  data-no-drag
                  onClick={() => handleMacroClick(link)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = t.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {/* Stacked icon for macro */}
                  <div style={{ position: 'relative', width: '24px', height: '24px', flexShrink: 0 }}>
                    <div
                      style={{
                        position: 'absolute',
                        top: '3px',
                        left: '3px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: t.iconBg,
                        border: `1px solid ${t.border}`,
                        transform: 'rotate(6deg)',
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '1px',
                        left: '1px',
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        backgroundColor: t.iconBg,
                        border: `1px solid ${t.border}`,
                        transform: 'rotate(3deg)',
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        backgroundColor: t.iconBg,
                        border: `1px solid ${t.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <span style={{ fontSize: '9px', fontWeight: 700, color: accentColor }}>
                        {(link.macro_items || []).length}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <span
                    style={{
                      color: t.text,
                      fontSize: '12px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {link.title}
                  </span>

                  {/* Multi-arrow icon */}
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={accentColor}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </button>
              ) : (
                /* Normal link item */
                <button
                  key={link.id}
                  data-no-drag
                  onClick={() => handleLinkClick(link.url)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = t.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {/* Favicon */}
                  {isLocalFilePath(link.url) ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#fbbf24" style={{ flexShrink: 0 }}>
                      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>
                  ) : link.show_favicon && link.favicon ? (
                    <img
                      src={normalizeFallbackFaviconDataUrl(link.favicon) || link.favicon}
                      alt=""
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        flexShrink: 0,
                        objectFit: 'contain',
                      }}
                      onError={(e) => {
                        const image = e.target as HTMLImageElement;
                        if (image.src !== fallbackFaviconUrl) {
                          image.src = fallbackFaviconUrl;
                        }
                      }}
                    />
                  ) : link.show_favicon ? (
                    <img
                      src={fallbackFaviconUrl}
                      alt=""
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        flexShrink: 0,
                        objectFit: 'contain',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '5px',
                        backgroundColor: t.iconBg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        color: t.iconText,
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {link.title.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Title */}
                  <span
                    style={{
                      color: t.text,
                      fontSize: '12px',
                      fontWeight: 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {link.title}
                  </span>

                  {/* Arrow icon */}
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={t.arrow}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M7 17L17 7M17 7H7M17 7v10" />
                  </svg>
                </button>
              )
            )}
        </div>

        {/* Opacity slider - animated */}
        <div
          style={{
            overflow: 'hidden',
            maxHeight: showOpacitySlider ? '40px' : '0px',
            opacity: showOpacitySlider ? 1 : 0,
            transition: 'max-height 0.25s ease, opacity 0.2s ease',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              padding: '8px 14px',
              borderTop: `1px solid ${t.footerBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.01"
              value={opacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              className="widget-slider"
            />
            <span style={{ color: t.text, opacity: 0.6, fontSize: '10px', minWidth: '28px', textAlign: 'right' }}>
              {Math.round(opacity * 100)}%
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '6px 14px 8px',
            borderTop: `1px solid ${t.footerBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: t.textFaint,
              fontSize: '10px',
            }}
          >
            {hasMultipleCategories && (
              <span style={{ color: t.textTiny, marginRight: '4px' }}>
                {categories.length} categories
              </span>
            )}
            {links.length} {links.length === 1 ? 'link' : 'links'}
          </span>
          <button
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              color: showOpacitySlider ? accentColor : t.text,
              opacity: showOpacitySlider ? 1 : 0.5,
              transition: 'color 0.15s, opacity 0.15s',
            }}
            title="밝기 조절"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        html, body {
          background: transparent !important;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        @keyframes widget-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes merge-slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 0.25;
          }
        }

        @keyframes merge-fade-out {
          from { opacity: 0.25; }
          to { opacity: 0; }
        }

        @keyframes preview-name-slide {
          from {
            opacity: 0;
            transform: translateX(-8px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes preview-dot-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.3);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .widget-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .widget-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .widget-scrollbar::-webkit-scrollbar-thumb {
          background: ${t.scrollThumb};
          border-radius: 2px;
        }
        .widget-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${t.scrollThumbHover};
        }

        .widget-slider {
          flex: 1;
          height: 3px;
          -webkit-appearance: none;
          appearance: none;
          background: ${t.footerBorder};
          border-radius: 2px;
          outline: none;
          cursor: pointer;
        }
        .widget-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: ${accentColor};
          cursor: pointer;
          transition: transform 0.15s;
        }
        .widget-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}

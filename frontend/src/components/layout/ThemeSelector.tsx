'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type ThemeStyle = 'macos' | 'notion' | 'glass' | 'dashboard';

interface Theme {
  id: ThemeStyle;
  name: string;
  description: string;
  preview: {
    bg: string;
    primary: string;
    accent: string;
  };
}

const themes: Theme[] = [
  {
    id: 'macos',
    name: 'macOS',
    description: 'Clean Apple-inspired design',
    preview: {
      bg: '#f5f5f7',
      primary: '#007AFF',
      accent: '#e8e8ed',
    },
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Minimal and focused',
    preview: {
      bg: '#ffffff',
      primary: '#37352f',
      accent: '#f7f6f3',
    },
  },
  {
    id: 'glass',
    name: 'Glassmorphism',
    description: 'Modern frosted glass effect',
    preview: {
      bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      primary: '#ffffff',
      accent: 'rgba(255, 255, 255, 0.2)',
    },
  },
  {
    id: 'dashboard',
    name: 'Dashboard Pro',
    description: 'Professional dark theme',
    preview: {
      bg: '#0f172a',
      primary: '#3b82f6',
      accent: '#334155',
    },
  },
];

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState<ThemeStyle>('macos');

  const handleThemeChange = (themeId: ThemeStyle) => {
    // Remove all theme classes
    document.documentElement.classList.remove(
      'theme-macos',
      'theme-notion',
      'theme-glass',
      'theme-dashboard'
    );

    // Add new theme class
    if (themeId !== 'macos') {
      document.documentElement.classList.add(`theme-${themeId}`);
    }

    setCurrentTheme(themeId);

    // Save to localStorage
    localStorage.setItem('theme-style', themeId);
  };

  // Load saved theme on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme-style') as ThemeStyle | null;
      if (savedTheme && themes.find(t => t.id === savedTheme)) {
        handleThemeChange(savedTheme);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentThemeData = themes.find(t => t.id === currentTheme);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-9 h-9 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Theme Style
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {themes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            className="cursor-pointer flex items-center gap-3 py-2"
          >
            {/* Theme preview */}
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-border overflow-hidden"
              style={{ background: theme.preview.bg }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: theme.preview.primary }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{theme.name}</span>
                {currentTheme === theme.id && (
                  <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-muted-foreground truncate block">
                {theme.description}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


"use client";

import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { Switch } from '@/components/ui/switch';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  // This state will reflect the actual applied theme (light/dark), resolving 'system'.
  const [isEffectivelyDark, setIsEffectivelyDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      let currentThemeIsDark;
      if (theme === 'system') {
        currentThemeIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      } else {
        currentThemeIsDark = theme === 'dark';
      }
      setIsEffectivelyDark(currentThemeIsDark);
    }
  }, [theme, mounted]);

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light');
  };

  if (!mounted) {
    // Render a placeholder to prevent layout shift and hydration errors.
    // Approximate size: Sun (20px) + space (8px) + Switch (44px) + space (8px) + Moon (20px) = 100px width. Switch height is 24px.
    return <div className="flex items-center space-x-2 w-[100px] h-[24px]" />;
  }

  return (
    <div className="flex items-center space-x-2">
      <Sun className={`h-5 w-5 transition-colors ${!isEffectivelyDark ? 'text-primary' : 'text-muted-foreground'}`} />
      <Switch
        id="theme-mode-switch"
        checked={isEffectivelyDark}
        onCheckedChange={handleThemeToggle}
        aria-label={`Switch to ${isEffectivelyDark ? 'light' : 'dark'} mode`}
      />
      <Moon className={`h-5 w-5 transition-colors ${isEffectivelyDark ? 'text-primary' : 'text-muted-foreground'}`} />
    </div>
  );
}

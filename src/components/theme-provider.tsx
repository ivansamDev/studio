"use client"

import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
  // Note: The props 'attribute', 'enableSystem', 'disableTransitionOnChange'
  // are often used with shadcn/ui's ThemeProvider but are not declared or used
  // in this custom ThemeProvider. This fix addresses only the localStorage issue.
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme", // Default storage key
  ...props
}: ThemeProviderProps) {
  // Initialize theme state with defaultTheme.
  // localStorage will be checked after mount.
  const [theme, setThemeInternal] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);

  // Effect to load theme from localStorage on mount (client-side only)
  useEffect(() => {
    setMounted(true); // Mark as mounted
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme) {
        setThemeInternal(storedTheme);
      } else {
        // If no theme in localStorage, ensure defaultTheme is set.
        // This is mostly for safety, as useState already initializes with defaultTheme.
        setThemeInternal(defaultTheme);
      }
    } catch (e) {
      console.warn(`Failed to access localStorage for theme (key: ${storageKey}):`, e);
      // Fallback to defaultTheme if localStorage access fails
      setThemeInternal(defaultTheme);
    }
  }, [storageKey, defaultTheme]); // Re-run if storageKey or defaultTheme prop changes

  // Effect to apply the theme to the documentElement (client-side only)
  useEffect(() => {
    // Only run if mounted and theme is determined
    if (!mounted) {
      return;
    }

    const root = window.document.documentElement;
    root.classList.remove("light", "dark"); // Remove previous theme classes

    let currentTheme = theme;
    if (currentTheme === "system") {
      currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }

    root.classList.add(currentTheme);
  }, [theme, mounted]); // Re-run when theme state or mounted status changes

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
    } catch (e) {
      console.warn(`Failed to set theme in localStorage (key: ${storageKey}):`, e);
    }
    setThemeInternal(newTheme);
  };

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

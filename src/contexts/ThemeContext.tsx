/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'marriage-platform.theme';

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Enable the page-wide colour transition only for the duration of the switch,
  // so a toggle reads as a smooth tint shift — never a flash, never a transform.
  const applyWithTransition = useCallback((next: Theme) => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    setThemeState(next);
    window.setTimeout(() => root.classList.remove('theme-transition'), 300);
  }, []);

  const toggleTheme = useCallback(() => {
    applyWithTransition(theme === 'dark' ? 'light' : 'dark');
  }, [theme, applyWithTransition]);

  const setTheme = useCallback((next: Theme) => applyWithTransition(next), [applyWithTransition]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

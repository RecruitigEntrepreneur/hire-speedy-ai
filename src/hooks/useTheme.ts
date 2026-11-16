import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'matchunt-theme';
const SYNC_EVENT = 'matchunt:theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem(STORAGE_KEY, theme);
    // Knopf oben und Einstellungen › Darstellung zeigen immer dasselbe (15.11.2026)
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: theme }));
  }, [theme]);

  useEffect(() => {
    const sync = (e: Event) => {
      const t = (e as CustomEvent<Theme>).detail;
      setThemeState((prev) => (prev === t ? prev : t));
    };
    window.addEventListener(SYNC_EVENT, sync);
    return () => window.removeEventListener(SYNC_EVENT, sync);
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme };
}

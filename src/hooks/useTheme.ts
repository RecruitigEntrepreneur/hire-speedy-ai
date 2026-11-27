import { useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

const STORAGE_KEY = 'matchunt-theme';
const SYNC_EVENT = 'matchunt:theme';

/**
 * `standard`: gilt nur, solange niemand selbst gewählt hat. Die Einstiege von außen
 * (Kunden-Aufnahme, Anmeldung, Headhunter-Onboarding) starten hell (26.11.2026);
 * die Wahl wird gespeichert und gilt danach überall.
 */
export function useTheme(standard: Theme = 'dark') {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try { return (localStorage.getItem(STORAGE_KEY) as Theme) || standard; } catch { return standard; }
    }
    return standard;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* privates Fenster: dann nur für diese Seite */ }
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

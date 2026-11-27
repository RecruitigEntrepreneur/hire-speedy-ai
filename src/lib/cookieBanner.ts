import { useSyncExternalStore } from 'react';

/**
 * Steht der Cookie-Hinweis gerade offen? Der Rundgang wartet so lange: Der Hinweis liegt unten
 * über der Seite, und das Licht des Rundgangs fiel sonst auf ihn statt auf das Ziel dahinter
 * (Marko 17.11.: „hier stimmt was nicht“ bei „Ihre Stelle steht schon hier“).
 */
let open = false;
const listeners = new Set<() => void>();

export function setCookieBannerOpen(value: boolean) {
  if (open === value) return;
  open = value;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function useCookieBannerOpen(): boolean {
  return useSyncExternalStore(subscribe, () => open, () => false);
}

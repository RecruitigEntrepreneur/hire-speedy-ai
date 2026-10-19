import { matchPath } from 'react-router-dom';

export interface RouteMatch {
  pattern: string;
  file: string;
}

/**
 * Route und Datei zum aktuellen Pfad, aus der Routen-Tabelle (src/App.tsx).
 * Bei mehreren Treffern gewinnt die spezifischste Route (meiste feste Teile).
 * Die Tabelle wird erst beim Senden nachgeladen.
 */
export async function resolveRoute(pathname: string): Promise<RouteMatch | null> {
  try {
    const { default: routes } = await import('virtual:feedback-routes');
    let best: RouteMatch | null = null;
    let bestScore = -1;
    for (const route of routes) {
      if (route.path === '*' || !matchPath({ path: route.path, end: true }, pathname)) continue;
      const segments = route.path.split('/').filter(Boolean);
      const score = segments.filter((s) => !s.startsWith(':') && s !== '*').length * 10 + segments.length;
      if (score > bestScore) {
        best = { pattern: route.path, file: route.file };
        bestScore = score;
      }
    }
    return best;
  } catch {
    return null;
  }
}

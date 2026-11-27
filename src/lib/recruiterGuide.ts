/**
 * Technik der begleiteten Rundgänge (Headhunter und Kunde): Schritt-Typ, Seitenabgleich,
 * Platz der Karte, Merker. Die Schritte selbst stehen in lib/recruiterTour.ts (Headhunter)
 * und lib/clientGuide.ts (Kunde). Ziele sind CSS-Selektoren, meist [data-tour="…"].
 */

export interface GuideStep {
  id: string;
  /** Kapitel, 1 bis 6. */
  chapter: number;
  /** Pfad, auf dem der Schritt spielt; `:id` steht für einen beliebigen Abschnitt. */
  route: string;
  /**
   * Adresse zum Hinnavigieren, wenn sie mehr als `route` braucht, etwa einen Reiter
   * (`/dashboard/jobs?tab=review`). Ohne Angabe gilt `route`.
   */
  path?: string;
  /** Bild auf der Beispiel-Bühne des Kunden-Rundgangs (`/dashboard/rundgang`). */
  scene?: string;
  /** Hervorgehobenes Element; ohne Ziel steht die Karte in der Mitte. */
  target?: string;
  title: string;
  body: string;
  /** Text, wenn der Headhunter das Ziel nicht selbst anklicken kann (Handy, schmales Fenster). */
  narrowBody?: string;
  /**
   * Der Headhunter klickt das Ziel selbst. Mit `to` geht es weiter, sobald diese
   * Seite offen ist, sonst direkt nach dem Klick. Unter `minWidth` bleibt das Ziel
   * gesperrt, und der Knopf mit `label` führt weiter.
   */
  click?: {
    label: string; to?: string; minWidth?: number;
    /** So lange bleibt das Ergebnis des Klicks stehen, bevor es weitergeht (Bestätigung nach „Senden“). */
    delay?: number;
  };
  /** Mitmach-Schritt: Ein Zeiger macht den Klick einmal vor, dann klickt der Nutzer (guideDemo.ts). */
  show?: boolean;
  /** Wohin der Zeiger tippt, wenn das markierte Ziel größer ist (ganze Zeile, Knopf darin). */
  pointAt?: string;
  /**
   * Der Zeiger fährt nacheinander Stellen an und zeigt dort ein kurzes Schild (Marko 16.11.:
   * „gefällt uns, wenn sich die Dinge selbst bewegen und es dadurch erklärt wird“).
   */
  points?: { at: string; label: string }[];
  /**
   * Bereich, der leuchtet, während der Zeiger die `points` anfährt (Stellenseite: Kopf mit Reitern
   * und Honorar); danach zieht sich das Licht auf `target` zusammen, das der Nutzer anklickt.
   */
  pointArea?: string;
  /**
   * Nichts abdunkeln, nichts einrahmen: Die Seite bleibt, wie sie ist, die Karte steht oben rechts
   * (Übersicht, Marko 18.11.: „jeden Bereich kurz erklären, nicht alle leuchten“).
   */
  bare?: boolean;
  /** Beschriftung des Hauptknopfs statt „Weiter“ bzw. „Los geht's“ (etwa „Stelle besetzen“). */
  nextLabel?: string;
  /** Bevorzugte Seite der Karte. Bei Menüs „left“: Die Karte steht neben dem offenen Menü. */
  side?: 'right' | 'bottom' | 'left' | 'top';
  /**
   * Die Vorführung öffnet erst ein Menü (Neue Stelle, Glocke, Kandidat anlegen): Die Karte ist schon
   * am Knopf schmal und lässt dem Menü Platz, beim Aufgehen bleibt sie stehen. Vorher stand sie breit
   * am Knopf und sprang danach schmal ans Menü (Marko 17.11.: „erscheint zuerst in einer anderen Form
   * ganz kurz“; „leichter Slide, aber nicht die Form ändern“).
   */
  cardAtTarget?: boolean;
  /**
   * Bereich, der beim Vorführen leuchtet, während die Bühne das Fenster sichtbar ausfüllt;
   * danach zieht sich das Licht auf `target` zusammen.
   */
  fillArea?: string;
  /** Ziel nur zeigen, nicht anklicken lassen. */
  lockTarget?: boolean;
  /** Schritt nur ab dieser Fensterbreite. */
  minWidth?: number;
  /** Fehlt das Ziel, springt „Weiter“ zu diesem Schritt. */
  skipWhenMissing?: string;
  /**
   * Das Ziel entsteht erst durch den Nutzer (etwa das Profil nach dem Einlesen
   * der Anzeige). Bis es da ist, keine Karte, nur ein Hinweis mit diesem Text.
   */
  wait?: string;
  /** Fehlt das Ziel, geht es ohne Karte direkt weiter (etwa ein Bildschirm, der übersprungen wurde). */
  autoSkip?: boolean;
  /**
   * Der Rundgang führt NICHT selbst auf die Seite dieses Schritts, sondern wartet,
   * bis der Nutzer dort ankommt (etwa nach dem Einreichen). Solange: Hinweis mit diesem Text.
   */
  hold?: string;
  /** Solange der Nutzer hier ist, bietet der Hinweis kein „Weiter“ an (etwa mitten in der Aufnahme). */
  holdWhile?: string;
}

export function matchRoute(pattern: string, pathname: string): boolean {
  // "/dashboard/aufnahme*": der Pfad selbst und alles darunter.
  if (pattern.endsWith('*')) {
    const base = pattern.slice(0, -1).replace(/\/$/, '');
    const path = pathname.replace(/\/$/, '');
    return path === base || path.startsWith(`${base}/`);
  }
  const source = pattern.split('/').map(part => (part.startsWith(':') ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/');
  return new RegExp(`^${source}/?$`).test(pathname);
}

/**
 * Steht der Nutzer auf der Seite dieses Schritts? Hat der Schritt eine eigene Adresse mit
 * Suchteil (`path`, etwa Reiter oder Bühnenbild), muss auch der stimmen.
 */
export function atStep(step: Pick<GuideStep, 'route' | 'path'>, pathname: string, search: string): boolean {
  if (!matchRoute(step.route, pathname)) return false;
  const query = step.path?.split('?')[1];
  if (!query) return true;
  const here = new URLSearchParams(search);
  return [...new URLSearchParams(query)].every(([key, value]) => here.get(key) === value);
}

/**
 * Nach Browser-Zurück oder -Vor: der Schritt, zu dem die Adresse gehört, vom aktuellen aus
 * zuerst rückwärts gesucht (zwei Schritte können dieselbe Seite haben). -1, wenn keiner passt.
 */
export function nearestStepAt(steps: Pick<GuideStep, 'route' | 'path'>[], from: number, pathname: string, search: string): number {
  for (let j = from - 1; j >= 0; j -= 1) if (atStep(steps[j], pathname, search)) return j;
  for (let j = from + 1; j < steps.length; j += 1) if (atStep(steps[j], pathname, search)) return j;
  return -1;
}

export interface TourRect { top: number; left: number; width: number; height: number }
export interface TourSize { width: number; height: number }
export interface CardPlacement { top: number; left: number; side: 'right' | 'bottom' | 'left' | 'top' | 'center' }

/** Ein Rechteck um alle sichtbaren Ziele; null, wenn keins sichtbar ist. */
export function unionRect(rects: TourRect[]): TourRect | null {
  const visible = rects.filter(r => r.width > 0 && r.height > 0);
  if (!visible.length) return null;
  const top = Math.min(...visible.map(r => r.top));
  const left = Math.min(...visible.map(r => r.left));
  const bottom = Math.max(...visible.map(r => r.top + r.height));
  const right = Math.max(...visible.map(r => r.left + r.width));
  return { top, left, width: right - left, height: bottom - top };
}

const MARGIN = 16;
const GAP = 16;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Karte neben das Ziel: rechts, darunter, links, darüber. Passt nichts, etwa bei
 * einem großen Ziel, kommt sie in die freiere Bildschirmhälfte. Immer im Bild.
 *
 * `prefer`: die Seite, auf der die Karte in diesem Schritt schon steht. Solange sie dort
 * noch passt, bleibt sie dort; sonst spränge sie bei jeder kleinen Verschiebung des
 * Ziels (Laden, Scrollen) auf eine andere Seite.
 */
export function placeCard(target: TourRect | null, card: TourSize, viewport: TourSize, prefer?: CardPlacement['side']): CardPlacement {
  const centerLeft = Math.max(MARGIN, (viewport.width - card.width) / 2);
  if (!target) return { side: 'center', top: Math.max(MARGIN, (viewport.height - card.height) / 2), left: centerLeft };
  const maxTop = viewport.height - card.height - MARGIN;
  const maxLeft = viewport.width - card.width - MARGIN;
  const midTop = clamp(target.top + target.height / 2 - card.height / 2, MARGIN, maxTop);
  const alignedLeft = clamp(target.left, MARGIN, maxLeft);
  const sides: Record<Exclude<CardPlacement['side'], 'center'>, () => CardPlacement | null> = {
    right: () => { const left = target.left + target.width + GAP; return left <= maxLeft ? { side: 'right', left, top: midTop } : null; },
    bottom: () => { const top = target.top + target.height + GAP; return top <= maxTop ? { side: 'bottom', top, left: alignedLeft } : null; },
    left: () => { const left = target.left - GAP - card.width; return left >= MARGIN ? { side: 'left', left, top: midTop } : null; },
    top: () => { const top = target.top - GAP - card.height; return top >= MARGIN ? { side: 'top', top, left: alignedLeft } : null; },
  };
  if (prefer && prefer !== 'center') {
    const kept = sides[prefer]();
    if (kept) return kept;
  }
  // Breite Ziele (Kopf eines Profils, eine Karte über die ganze Seite): lieber darüber als
  // links in die Seitenleiste gequetscht.
  const order = target.width > viewport.width * 0.5 ? (['right', 'bottom', 'top', 'left'] as const) : (['right', 'bottom', 'left', 'top'] as const);
  for (const side of order) {
    const placed = sides[side]();
    if (placed) return placed;
  }
  const upperHalfFree = target.top + target.height / 2 > viewport.height / 2;
  return { side: 'center', top: upperHalfFree ? MARGIN : Math.max(MARGIN, maxTop), left: centerLeft };
}

/**
 * Merker im Konto (user_metadata), damit der Rundgang auf keinem Gerät zweimal von selbst startet.
 * Neue Schlüssel für den Rundgang an echten Seiten (17.11.2026): Wer den alten gesehen hat,
 * bekommt den neuen einmal von selbst, wie beim Kunden.
 */
export const TOUR_SEEN_KEY = 'recruiter_app_tour_seen_at';
/** „Später“ im ersten Schritt: startet nicht mehr von selbst, bleibt aber im Start-Kasten offen. */
export const TOUR_POSTPONED_KEY = 'recruiter_app_tour_postponed_at';
/** Rückfallebene, falls das Speichern im Konto scheitert. */
export const tourStorageKey = (userId: string) => `matchunt.recruiterAppTour.${userId}`;
export const tourPostponedStorageKey = (userId: string) => `matchunt.recruiterAppTourPostponed.${userId}`;

type TourUser = { id: string; user_metadata?: Record<string, unknown> } | null;
const marked = (user: NonNullable<TourUser>, storage: Pick<Storage, 'getItem'> | null, metaKey: string, key: string) => {
  if (user.user_metadata?.[metaKey]) return true;
  try { return Boolean(storage?.getItem(key)); } catch { return false; }
};

/** Ganz gesehen oder beendet: Im Start-Kasten ist der Rundgang erledigt. */
export function tourSeen(user: TourUser, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  return marked(user, storage, TOUR_SEEN_KEY, tourStorageKey(user.id));
}

/** Startet nicht mehr von selbst: gesehen oder auf „Später“ verschoben. */
export function tourSettled(user: TourUser, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  return tourSeen(user, storage) || marked(user, storage, TOUR_POSTPONED_KEY, tourPostponedStorageKey(user.id));
}

/** Laufender Rundgang je Browser-Tab, damit Neuladen an derselben Stelle weitermacht. */
export interface GuideState { userId: string; stepId: string; paused: boolean; jobPath?: string }
/** Eigener Schlüssel ab dem Rundgang an echten Seiten (17.11.2026): Die alten Schritte gibt es nicht mehr. */
export const GUIDE_STATE_KEY = 'matchunt.recruiterGuide2';

export function readGuideState(
  storage: Pick<Storage, 'getItem'> | null,
  userId: string,
  steps: GuideStep[],
  key: string = GUIDE_STATE_KEY,
  dynamicRoute: string = '/recruiter/jobs/:id',
): GuideState | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const state = JSON.parse(raw) as Partial<GuideState>;
    if (state.userId !== userId || !steps.some(step => step.id === state.stepId)) return null;
    return { userId, stepId: state.stepId!, paused: state.paused === true, ...(typeof state.jobPath === 'string' && matchRoute(dynamicRoute, state.jobPath) ? { jobPath: state.jobPath } : {}) };
  } catch { return null; }
}

/** Ein Muster wie "/dashboard/aufnahme*" als Adresse zum Hinnavigieren. */
export const concretePath = (route: string) => route.replace(/\*$/, '').replace(/\/$/, '') || '/';

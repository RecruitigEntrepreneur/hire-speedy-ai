/**
 * Begleiteter Rundgang für Headhunter (Entscheidung 21.09.2026): sechs Kapitel,
 * seitenübergreifend. Der Headhunter klickt Menüpunkte und die erste Position
 * selbst; alles andere geht mit „Weiter“. Unumkehrbares („Ich suche“, Einreichen)
 * wird nur gezeigt. Wo ein neuer Headhunter noch nichts sieht, erklärt ein
 * Beispiel im Rundgang. Ziele sind CSS-Selektoren, meist [data-tour="…"].
 */
import i18n from '@/i18n';

export type GuideExample = 'job' | 'submit' | 'candidate' | 'pipeline' | 'optin' | 'task' | 'interview'
  // Kunden-Rundgang (lib/clientGuide.ts)
  | 'clientSubmit' | 'clientStatus' | 'clientCandidate';

export interface GuideStep {
  id: string;
  /** Kapitel, 1 bis 6. */
  chapter: number;
  /** Pfad, auf dem der Schritt spielt; `:id` steht für einen beliebigen Abschnitt. */
  route: string;
  /** Hervorgehobenes Element; ohne Ziel steht die Karte in der Mitte. */
  target?: string;
  title: string;
  body: string;
  /** Text, wenn der Headhunter das Ziel nicht selbst anklicken kann (Handy, schmales Fenster). */
  narrowBody?: string;
  example?: GuideExample;
  /** Beispiel nur zeigen, wenn das Ziel fehlt, etwa ohne offene Positionen. */
  exampleWhenMissing?: boolean;
  /**
   * Der Headhunter klickt das Ziel selbst. Mit `to` geht es weiter, sobald diese
   * Seite offen ist, sonst direkt nach dem Klick. Unter `minWidth` bleibt das Ziel
   * gesperrt, und der Knopf mit `label` führt weiter.
   */
  click?: { label: string; to?: string; minWidth?: number };
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

/** Kapitel als Schlüssel; die Namen liest `guideChapters()` in der aktuellen Sprache. */
export const GUIDE_CHAPTERS = ['overview', 'jobs', 'briefing', 'candidates', 'pipeline', 'tasks'] as const;

// Texte stehen in src/i18n/locales/recruiterGuide und werden erst beim Lesen geholt (README Regel 7),
// damit ein Sprachwechsel sofort gilt. Wer die Schritte zeigt, lädt den Namespace `recruiterGuide`.
const tx = (key: string, options?: Record<string, unknown>): string => i18n.t(`recruiterGuide:${key}`, options);
export const guideChapters = (): string[] => GUIDE_CHAPTERS.map(key => tx(`chapters.${key}`));

/** Ab dieser Breite gibt es das Seitenmenü (md). */
const MENU = 768;
/** Ab dieser Breite öffnet die Jobvorschau neben der Liste statt als eigenes Fenster (lg). */
const PANEL = 1024;
const nav = (href: string) => `[data-tour="nav:${href}"]`;
const at = (id: string) => `[data-tour="${id}"]`;

type StepDef = Omit<GuideStep, 'title' | 'body' | 'narrowBody' | 'click'> & {
  /** Es gibt einen eigenen Text für schmale Fenster (steps.<id>.narrowBody). */
  narrow?: boolean;
  /** Klick-Schritt; die Beschriftung steht unter steps.<id>.action. */
  click?: { to?: string; minWidth?: number };
};
const text = (target: object, field: string, read: () => string) =>
  Object.defineProperty(target, field, { enumerable: true, get: read });
/** Schritt, dessen Texte (title, body, narrowBody, click.label) bei jedem Lesen aus der Übersetzung kommen. */
const step = ({ narrow, click, ...rest }: StepDef): GuideStep => {
  const s = { ...rest } as GuideStep;
  text(s, 'title', () => tx(`steps.${rest.id}.title`));
  text(s, 'body', () => tx(`steps.${rest.id}.body`));
  if (narrow) text(s, 'narrowBody', () => tx(`steps.${rest.id}.narrowBody`));
  if (click) s.click = text({ ...click }, 'label', () => tx(`steps.${rest.id}.action`)) as GuideStep['click'];
  return s;
};
type MenuKey = 'jobs' | 'candidates' | 'pipeline' | 'tasks' | 'interviews';
const menuStep = (id: string, chapter: number, route: string, href: string, menu: MenuKey): GuideStep => {
  const label = () => tx(`menu.items.${menu}`);
  const s = { id, chapter, route, target: nav(href) } as GuideStep;
  text(s, 'title', () => tx(`steps.${id}.title`));
  text(s, 'body', () => tx('menu.body', { label: label() }));
  text(s, 'narrowBody', () => tx('menu.narrowBody', { label: label() }));
  s.click = text({ to: href, minWidth: MENU }, 'label', () => tx('menu.open', { label: label() })) as GuideStep['click'];
  return s;
};

export const GUIDE_STEPS: GuideStep[] = [
  // 1 · Übersicht
  step({ id: 'welcome', chapter: 1, route: '/recruiter' }),
  step({ id: 'cockpit', chapter: 1, route: '/recruiter', target: at('dashboard.header') }),
  step({ id: 'topJobs', chapter: 1, route: '/recruiter', target: at('dashboard.topJobs') }),
  menuStep('navJobs', 1, '/recruiter', '/recruiter/jobs', 'jobs'),

  // 2 · Offene Jobs
  step({ id: 'filters', chapter: 2, route: '/recruiter/jobs', target: at('jobs.filters') }),
  step({ id: 'card', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'),
    example: 'job', exampleWhenMissing: true, skipWhenMissing: 'candidatesAdd' }),
  step({ id: 'activate', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard.activate'), lockTarget: true }),
  step({ id: 'openPreview', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'), minWidth: PANEL, click: {} }),
  step({ id: 'preview', chapter: 2, route: '/recruiter/jobs', target: at('jobs.preview'), minWidth: PANEL }),
  step({ id: 'openBriefing', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'), narrow: true,
    click: { to: '/recruiter/jobs/:id', minWidth: PANEL } }),

  // 3 · Briefing
  step({ id: 'jobHeader', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] header' }),
  step({ id: 'jobTabs', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] [role="tablist"]' }),
  step({ id: 'jobSubmit', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] aside', lockTarget: true, example: 'submit' }),
  menuStep('navCandidates', 3, '/recruiter/jobs/:id', '/recruiter/candidates', 'candidates'),

  // 4 · Meine Kandidaten
  step({ id: 'candidatesAdd', chapter: 4, route: '/recruiter/candidates', target: at('candidates.add'), lockTarget: true, example: 'candidate' }),
  menuStep('navPipeline', 4, '/recruiter/candidates', '/recruiter/submissions', 'pipeline'),

  // 5 · Pipeline
  step({ id: 'pipeline', chapter: 5, route: '/recruiter/submissions', target: at('pipeline.overview'), example: 'pipeline' }),
  step({ id: 'optin', chapter: 5, route: '/recruiter/submissions', target: at('pipeline.overview'), example: 'optin' }),
  menuStep('navTasks', 5, '/recruiter/submissions', '/recruiter/influence', 'tasks'),

  // 6 · Aufgaben & Interviews
  step({ id: 'tasks', chapter: 6, route: '/recruiter/influence', target: at('tasks.list'), example: 'task' }),
  menuStep('navInterviews', 6, '/recruiter/influence', '/recruiter/interviews', 'interviews'),
  step({ id: 'interviews', chapter: 6, route: '/recruiter/interviews', target: at('interviews.stats'), example: 'interview' }),
  step({ id: 'done', chapter: 6, route: '/recruiter/interviews' }),
];

/** Schritte, die bei dieser Fensterbreite vorkommen. */
export const visibleSteps = (width: number) => GUIDE_STEPS.filter(step => !step.minWidth || width >= step.minWidth);

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
 */
export function placeCard(target: TourRect | null, card: TourSize, viewport: TourSize): CardPlacement {
  const centerLeft = Math.max(MARGIN, (viewport.width - card.width) / 2);
  if (!target) return { side: 'center', top: Math.max(MARGIN, (viewport.height - card.height) / 2), left: centerLeft };
  const maxTop = viewport.height - card.height - MARGIN;
  const maxLeft = viewport.width - card.width - MARGIN;
  const midTop = clamp(target.top + target.height / 2 - card.height / 2, MARGIN, maxTop);
  const alignedLeft = clamp(target.left, MARGIN, maxLeft);
  const right = target.left + target.width + GAP;
  if (right <= maxLeft) return { side: 'right', left: right, top: midTop };
  const below = target.top + target.height + GAP;
  if (below <= maxTop) return { side: 'bottom', top: below, left: alignedLeft };
  const left = target.left - GAP - card.width;
  if (left >= MARGIN) return { side: 'left', left, top: midTop };
  const above = target.top - GAP - card.height;
  if (above >= MARGIN) return { side: 'top', top: above, left: alignedLeft };
  const upperHalfFree = target.top + target.height / 2 > viewport.height / 2;
  return { side: 'center', top: upperHalfFree ? MARGIN : Math.max(MARGIN, maxTop), left: centerLeft };
}

/** Merker im Konto (user_metadata), damit der Rundgang auf keinem Gerät zweimal von selbst startet. */
export const TOUR_SEEN_KEY = 'recruiter_tour_seen_at';
/** Rückfallebene, falls das Speichern im Konto scheitert. */
export const tourStorageKey = (userId: string) => `matchunt.recruiterTour.${userId}`;

export function tourSeen(user: { id: string; user_metadata?: Record<string, unknown> } | null, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  if (user.user_metadata?.[TOUR_SEEN_KEY]) return true;
  try { return Boolean(storage?.getItem(tourStorageKey(user.id))); } catch { return false; }
}

/** Laufender Rundgang je Browser-Tab, damit Neuladen an derselben Stelle weitermacht. */
export interface GuideState { userId: string; stepId: string; paused: boolean; jobPath?: string }
export const GUIDE_STATE_KEY = 'matchunt.recruiterGuide';

export function readGuideState(
  storage: Pick<Storage, 'getItem'> | null,
  userId: string,
  steps: GuideStep[] = GUIDE_STEPS,
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

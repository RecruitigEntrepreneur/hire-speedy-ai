/**
 * Begleiteter Rundgang für Headhunter (Entscheidung 21.09.2026): sechs Kapitel,
 * seitenübergreifend. Der Headhunter klickt Menüpunkte und die erste Position
 * selbst; alles andere geht mit „Weiter“. Unumkehrbares („Ich suche“, Einreichen)
 * wird nur gezeigt. Wo ein neuer Headhunter noch nichts sieht, erklärt ein
 * Beispiel im Rundgang. Ziele sind CSS-Selektoren, meist [data-tour="…"].
 */

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

export const GUIDE_CHAPTERS = ['Übersicht', 'Offene Jobs', 'Briefing', 'Meine Kandidaten', 'Pipeline', 'Aufgaben & Interviews'] as const;

/** Ab dieser Breite gibt es das Seitenmenü (md). */
const MENU = 768;
/** Ab dieser Breite öffnet die Jobvorschau neben der Liste statt als eigenes Fenster (lg). */
const PANEL = 1024;
const nav = (href: string) => `[data-tour="nav:${href}"]`;
const at = (id: string) => `[data-tour="${id}"]`;
const menuStep = (id: string, chapter: number, route: string, href: string, label: string, title: string): GuideStep => ({
  id, chapter, route, target: nav(href), title,
  body: `Klick links im Menü auf „${label}“.`,
  narrowBody: `Tipp auf „${label} öffnen“.`,
  click: { label: `${label} öffnen`, to: href, minWidth: MENU },
});

export const GUIDE_STEPS: GuideStep[] = [
  // 1 · Übersicht
  { id: 'welcome', chapter: 1, route: '/recruiter', title: 'Willkommen bei Matchunt',
    body: 'Wir gehen einmal gemeinsam durch die Plattform. Das dauert etwa drei Minuten. Du klickst selbst, und wir zeigen dir, wie du hier zu deiner ersten Besetzung kommst.' },
  { id: 'cockpit', chapter: 1, route: '/recruiter', target: at('dashboard.header'), title: 'Dein Cockpit',
    body: 'Hier startest du jeden Tag. Oben siehst du, was gerade ansteht. Mit „Kandidaten anlegen“ nimmst du jederzeit neue Kandidaten auf.' },
  { id: 'topJobs', chapter: 1, route: '/recruiter', target: at('dashboard.topJobs'), title: 'Top Jobs',
    body: 'Eine Auswahl offener Positionen. Alle Positionen, mit Filtern und Sortierung, findest du unter „Offene Jobs“.' },
  menuStep('navJobs', 1, '/recruiter', '/recruiter/jobs', 'Offene Jobs', 'Auf zu den Positionen'),

  // 2 · Offene Jobs
  { id: 'filters', chapter: 2, route: '/recruiter/jobs', target: at('jobs.filters'), title: 'Finden, was zu dir passt',
    body: 'Such nach Stichworten und filtere nach Remote, Level oder Branche. Sortier nach „Höchste Fee“ oder „Wenig Konkurrenz“, um die besten Chancen zuerst zu sehen. Die Reiter „Dringend“, „Neu“ und „Top“ bringen dich schnell zu den heißesten Positionen.' },
  { id: 'card', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'), title: 'So liest du eine Position',
    body: 'Oben stehen die Rolle und deine Fee in Euro. Darunter die Firma, anonym als Branche, Größe und Region, dazu Ort, Gehaltsband und die wichtigsten Skills. Unten siehst du, wie viele Headhunter schon suchen und einreichen.',
    example: 'job', exampleWhenMissing: true, skipWhenMissing: 'candidatesAdd' },
  { id: 'activate', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard.activate'), lockTarget: true, title: '„Ich suche“ heißt: Ich bin dabei',
    body: 'Damit übernimmst du eine Position verbindlich. Das belegt einen deiner Slots und lässt sich derzeit nicht zurücknehmen. Ziel ist die erste Einreichung innerhalb von 14 Tagen. Sag deshalb nur zu, wenn du passende Kandidaten im Kopf hast.' },
  { id: 'openPreview', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'), minWidth: PANEL, title: 'Schau genauer hin',
    body: 'Klick auf die Position. Rechts öffnet sich eine Vorschau.', click: { label: 'Vorschau öffnen' } },
  { id: 'preview', chapter: 2, route: '/recruiter/jobs', target: at('jobs.preview'), minWidth: PANEL, title: 'Die Vorschau',
    body: 'Hier stehen die wichtigsten Anforderungen und Eckdaten. Einen Kandidaten vorschlagen kannst du von hier aus, sobald du „Ich suche“ gewählt hast.' },
  { id: 'openBriefing', chapter: 2, route: '/recruiter/jobs', target: at('jobs.firstCard'), title: 'Zum ganzen Briefing',
    body: 'Klick noch einmal auf die Position. Dann öffnet sich das vollständige Briefing.',
    narrowBody: 'Tipp auf „Briefing öffnen“. Dann siehst du das vollständige Briefing zu dieser Position.',
    click: { label: 'Briefing öffnen', to: '/recruiter/jobs/:id', minWidth: PANEL } },

  // 3 · Briefing
  { id: 'jobHeader', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] header', title: 'Dein Mandatsbriefing',
    body: 'Alles, was der Kunde in der Aufnahme gesagt hat, an einem Ort. Damit sprichst du Kandidaten gezielt an, ohne die Firma zu nennen.' },
  { id: 'jobTabs', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] [role="tablist"]', title: 'Drei Blickwinkel',
    body: '„Briefing“ für die Details, „Meine Kandidaten“ für deine Vorstellungen zu dieser Position und „Aus der Anzeige“ für den Originaltext.' },
  { id: 'jobSubmit', chapter: 3, route: '/recruiter/jobs/:id', target: '[data-tour-scope="job"] aside', lockTarget: true, example: 'submit', title: 'So stellst du jemanden vor',
    body: 'Mit „Vorstellung vorbereiten“ wählst du einen Kandidaten, schreibst deine Einschätzung und bestätigst seine Einwilligung. Nach einer Prüfansicht geht die Vorstellung an den Kunden, zunächst anonym.' },
  menuStep('navCandidates', 3, '/recruiter/jobs/:id', '/recruiter/candidates', 'Meine Kandidaten', 'Deine Kandidaten'),

  // 4 · Meine Kandidaten
  { id: 'candidatesAdd', chapter: 4, route: '/recruiter/candidates', target: at('candidates.add'), lockTarget: true, example: 'candidate', title: 'Kandidaten aufnehmen',
    body: 'Über „Kandidat hinzufügen“ legst du Kandidaten von Hand an, lädst einen Lebenslauf hoch oder übernimmst sie aus HubSpot. Danach stehen sie in deiner Liste, etwa so:' },
  menuStep('navPipeline', 4, '/recruiter/candidates', '/recruiter/submissions', 'Pipeline', 'Deine Pipeline'),

  // 5 · Pipeline
  { id: 'pipeline', chapter: 5, route: '/recruiter/submissions', target: at('pipeline.overview'), example: 'pipeline', title: 'Jede Vorstellung auf einen Blick',
    body: 'Hier verfolgst du jede Vorstellung durch die Phasen bis zur Vermittlung. „Offenes Honorar“ zeigt dir, was in deiner Pipeline steckt.' },
  { id: 'optin', chapter: 5, route: '/recruiter/submissions', target: at('pipeline.overview'), example: 'optin', title: 'Der wichtigste Moment: das Opt-In',
    body: 'Will der Kunde deinen Kandidaten kennenlernen, steht die Vorstellung auf „Interview angefragt“. Dann holst du die Zustimmung deines Kandidaten ein. Erst danach siehst du, um welche Firma es geht.' },
  menuStep('navTasks', 5, '/recruiter/submissions', '/recruiter/influence', 'Aufgaben', 'Deine Aufgaben'),

  // 6 · Aufgaben & Interviews
  { id: 'tasks', chapter: 6, route: '/recruiter/influence', target: at('tasks.list'), example: 'task', title: 'Was jetzt dran ist',
    body: 'Hier sammelt Matchunt deine nächsten Schritte, sortiert nach Wirkung: Opt-In einholen, nachfassen, Interviews vorbereiten. Am besten startest du jeden Tag hier.' },
  menuStep('navInterviews', 6, '/recruiter/influence', '/recruiter/interviews', 'Interviews', 'Deine Termine'),
  { id: 'interviews', chapter: 6, route: '/recruiter/interviews', target: at('interviews.stats'), example: 'interview', title: 'Interviews im Griff',
    body: 'Alle Termine deiner Kandidaten: heute, diese Woche und noch ohne Termin. Nach jedem Interview hältst du kurz fest, wie es gelaufen ist (Debrief).' },
  { id: 'done', chapter: 6, route: '/recruiter/interviews', title: 'Bereit für deine erste Vorstellung?',
    body: 'Such dir eine Position, zu der dir ein Kandidat einfällt. Den Rundgang kannst du jederzeit im Dashboard über „Rundgang“ neu starten.' },
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

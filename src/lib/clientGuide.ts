/**
 * Begleiteter Rundgang für Kunden (Entscheidung 24.09.2026): vier Kapitel,
 * das Herzstück ist das Anlegen einer Stelle. Der Kunde legt dabei seine ERSTE
 * ECHTE Stelle an -- der Rundgang läuft in der echten Aufnahme mit. Einreichen
 * wird nur gezeigt, nie ausgelöst.
 *
 * Automatisch startet er nur für neue Kunden (Konto ohne Stellen); alle anderen
 * erreichen ihn über „Rundgang“ im Dashboard. Technik und Einblendung teilt er
 * mit dem Headhunter-Rundgang (lib/recruiterGuide.ts), nur mit „Sie“.
 */
import i18n from '@/i18n';
import type { GuideStep } from './recruiterGuide';

/** Kapitel als Schlüssel; die Namen liest `clientGuideChapters()` in der aktuellen Sprache. */
export const CLIENT_GUIDE_CHAPTERS = ['welcome', 'create', 'after', 'candidates'] as const;
export const clientGuideChapters = (): string[] => CLIENT_GUIDE_CHAPTERS.map((key) => i18n.t(`clientGuide:chapters.${key}`));

/** Ab dieser Breite gibt es das Seitenmenü (md). */
const MENU = 768;
const at = (id: string) => `[data-tour="${id}"]`;
const nav = (href: string) => `[data-tour="nav:${href}"]`;
/** Die Aufnahme liegt unter /dashboard/aufnahme und /dashboard/aufnahme/:id. */
const AUFNAHME = '/dashboard/aufnahme*';

// Texte stehen in src/i18n/locales/clientGuide und werden erst beim Lesen geholt (README Regel 7),
// damit ein Sprachwechsel sofort gilt. Wer die Schritte zeigt, lädt den Namespace `clientGuide`.
const tx = (key: string): string => i18n.t(`clientGuide:${key}`);
const text = (target: object, field: string, read: () => string) =>
  Object.defineProperty(target, field, { enumerable: true, get: read });

type StepDef = Omit<GuideStep, 'title' | 'body' | 'narrowBody' | 'click' | 'wait' | 'hold'> & {
  /** Eigene Texte unter steps.<id>.narrowBody / .wait / .hold. */
  narrow?: boolean; wait?: boolean; hold?: boolean;
  /** Klick-Schritt; die Beschriftung steht unter steps.<id>.action. */
  click?: { to?: string; minWidth?: number };
};
/** Schritt, dessen Texte bei jedem Lesen aus der Übersetzung kommen. */
const step = ({ narrow, wait, hold, click, ...rest }: StepDef): GuideStep => {
  const s = { ...rest } as GuideStep;
  const k = (field: string) => () => tx(`steps.${rest.id}.${field}`);
  text(s, 'title', k('title'));
  text(s, 'body', k('body'));
  if (narrow) text(s, 'narrowBody', k('narrowBody'));
  if (wait) text(s, 'wait', k('wait'));
  if (hold) text(s, 'hold', k('hold'));
  if (click) s.click = text({ ...click }, 'label', k('action')) as GuideStep['click'];
  return s;
};

export const CLIENT_GUIDE_STEPS: GuideStep[] = [
  // 1 · Willkommen
  step({ id: 'c-welcome', chapter: 1, route: '/dashboard' }),
  step({ id: 'c-entry', chapter: 1, route: '/dashboard', target: at('client.entry') }),
  step({ id: 'c-decide', chapter: 1, route: '/dashboard', target: at('client.decide') }),

  // 2 · Stelle anlegen
  step({ id: 'c-start', narrow: true, chapter: 2, route: '/dashboard', target: at('client.entry'),
    click: { to: AUFNAHME } }),
  step({ id: 'c-kind', chapter: 2, route: AUFNAHME, target: at('intake.kind'), autoSkip: true,
    click: {} }),
  step({ id: 'c-ways', chapter: 2, route: AUFNAHME, target: at('intake.ways'), autoSkip: true,
    click: {} }),
  step({ id: 'c-profile', wait: true, chapter: 2, route: AUFNAHME, target: at('intake.head') }),
  step({ id: 'c-criteria', chapter: 2, route: AUFNAHME, target: at('intake.criteria') }),
  step({ id: 'c-briefing', chapter: 2, route: AUFNAHME, target: at('intake.briefing') }),
  step({ id: 'c-save', chapter: 2, route: AUFNAHME, target: at('intake.footer') }),
  step({ id: 'c-submit', chapter: 2, route: AUFNAHME, example: 'clientSubmit' }),

  // 3 · Nach dem Einreichen
  step({ id: 'c-jobs', hold: true, chapter: 3, route: '/dashboard/jobs', target: at('jobs.main'), example: 'clientStatus', exampleWhenMissing: true, holdWhile: AUFNAHME }),

  // 4 · Kandidaten & Team
  step({ id: 'c-navCandidates', narrow: true, chapter: 4, route: '/dashboard/jobs', target: nav('/dashboard/candidates'),
    click: { to: '/dashboard/candidates', minWidth: MENU } }),
  step({ id: 'c-candidates', chapter: 4, route: '/dashboard/candidates', target: at('candidates.header'), example: 'clientCandidate' }),
  step({ id: 'c-navTeam', narrow: true, chapter: 4, route: '/dashboard/candidates', target: nav('/dashboard/team'),
    click: { to: '/dashboard/team', minWidth: MENU } }),
  step({ id: 'c-team', chapter: 4, route: '/dashboard/team', target: at('team.header') }),
  step({ id: 'c-done', chapter: 4, route: '/dashboard/team' }),
];

/** Laufender Rundgang je Browser-Tab. */
export const CLIENT_GUIDE_STATE_KEY = 'matchunt.clientGuide';
/** Merker im Konto (user_metadata). */
export const CLIENT_TOUR_SEEN_KEY = 'client_tour_seen_at';
export const clientTourStorageKey = (userId: string) => `matchunt.clientTour.${userId}`;

export function clientTourSeen(user: { id: string; user_metadata?: Record<string, unknown> } | null, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  if (user.user_metadata?.[CLIENT_TOUR_SEEN_KEY]) return true;
  try { return Boolean(storage?.getItem(clientTourStorageKey(user.id))); } catch { return false; }
}

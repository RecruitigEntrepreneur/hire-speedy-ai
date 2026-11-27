/**
 * Begleiteter Rundgang für Headhunter, an echten Seiten. Fassung 3 (19.11.2026, mit Marko als
 * Wireframes Schritt für Schritt abgestimmt): erst die Übersicht, dann einmal eine Stelle besetzen,
 * 19 Schritte in 6 Kapiteln.
 *
 *   1 Dein Start               echt: Übersicht, der Zeiger erklärt vier Bereiche (nichts leuchtet)
 *   2 Stelle finden            Bühne: Stelle wählen, Stellenseite ansehen, „Ich suche“ (mitmachen)
 *   3 Kandidat und Vorstellung Bühne: Lebenslauf in die Kopfzeile ziehen, drei Häkchen, Ablage legt an,
 *                              Interview kurz „aus dem Kopf“, Einreichen, Stelle wählen, Vorstellen
 *   4 Interview                Bühne: Interviews (Meldungen oben rechts), Aufgabe Nachgespräch, Nachgespräch
 *   5 Angebot und Geld         Bühne: Empfehlung, Angebot, Verdienste (Meldungen oben rechts)
 *   6 Dein Konto               echt: Profil mit Terminseite
 *
 * Die Bühne (pages/recruiter/RecruiterTour.tsx) zeigt die ECHTEN Seiten und Fenster mit einem
 * Beispiel: Stelle „Senior Controller“ bei der fiktiven Nordwerk Medizintechnik GmbH,
 * Kandidat Daniel Roth (lib/recruiterDemoData.ts). Gespeichert, hochgeladen und gesendet wird
 * nichts; die Lebenslauf-Ablage zeigt solange nur das Beispiel (lib/lebenslaufAblage.ts).
 *
 * Fassung 2 (17.11.2026) begann mit der Jobliste und legte Kandidaten über das Menü an; Marko:
 * „er soll den Kandidaten oben in die Hauptleiste ziehen“, „Einfügen macht doch keiner“.
 */
import i18n from '@/i18n';
import type { GuideStep } from './recruiterGuide';

/** Die Bühne: echte Seiten mit Beispieldaten. */
export const RECRUITER_TOUR_STAGE = '/recruiter/rundgang';

/** Feste Kennungen des Beispiels (gültige UUIDs, damit Seiten sie wie echte behandeln). */
export const HH_DEMO_IDS = {
  job: '00000000-0000-4000-a000-0000000b0001',
  job2: '00000000-0000-4000-a000-0000000b0002',
  job3: '00000000-0000-4000-a000-0000000b0003',
  job4: '00000000-0000-4000-a000-0000000b0004',
  company: '00000000-0000-4000-a000-0000000b0010',
  candidate: '00000000-0000-4000-a000-0000000b0020',
  candidate2: '00000000-0000-4000-a000-0000000b0021',
  candidate3: '00000000-0000-4000-a000-0000000b0022',
  submission: '00000000-0000-4000-a000-0000000b0030',
  submission2: '00000000-0000-4000-a000-0000000b0031',
  submission3: '00000000-0000-4000-a000-0000000b0032',
  interview: '00000000-0000-4000-a000-0000000b0040',
  interview2: '00000000-0000-4000-a000-0000000b0041',
  offer: '00000000-0000-4000-a000-0000000b0050',
  placement: '00000000-0000-4000-a000-0000000b0060',
  activation: '00000000-0000-4000-a000-0000000b0070',
  client: '00000000-0000-4000-a000-0000000b0080',
} as const;

/** Echte Seiten, die die Bühne zeigt (eigener Adressraum, components/client/tour/DemoScope.tsx). */
export const RECRUITER_TOUR_PAGES = {
  dashboard: '/recruiter',
  jobs: '/recruiter/jobs',
  job: `/recruiter/jobs/${HH_DEMO_IDS.job}`,
  candidates: '/recruiter/candidates',
  dossier: `/recruiter/candidates/${HH_DEMO_IDS.candidate}`,
  tasks: '/recruiter/influence',
  interviews: '/recruiter/interviews',
  earnings: '/recruiter/earnings',
} as const;

/** Stand der Beispiel-Geschichte: welche Daten die Seiten lesen. */
export type HhDemoPhase =
  | 'market'      // vier offene Stellen, noch keine Suche
  | 'searching'   // „Ich suche“ läuft, Firma sichtbar
  | 'candidate'   // Daniel angelegt, Interview steht noch aus
  | 'ready'       // Interview abgeschlossen, bereit zum Vorstellen
  | 'requested'   // vorgestellt, Nordwerk möchte Daniel sprechen
  | 'scheduled'   // Termin steht
  | 'interviewed' // Gespräch vorbei, Nachgespräch fällig
  | 'offerWanted' // Nordwerk will ein Angebot machen: Empfehlung
  | 'offer'       // Angebot liegt beim Headhunter
  | 'placed';     // Vertrag, Rechnung bezahlt, Antritt steht an

export interface RecruiterTourScene {
  phase: HhDemoPhase;
  page: keyof typeof RECRUITER_TOUR_PAGES;
  search?: string;
  /** Fenster, das der Schritt offen zeigt (die Seite liest `location.state.tour`). */
  open?: 'activate';
  /** So arbeitet der Headhunter das Fenster durch (components/recruiter/tour/hhAutofill.ts). */
  fill?: 'activate' | 'cvDrag' | 'cvTicks' | 'quickInterview' | 'vorstellen' | 'debrief' | 'recommend' | 'offerTalked';
  /** Meldungen oben rechts beim ersten Besuch, wie live (Glocke), nacheinander. */
  notify?: ('requested' | 'scheduled' | 'feedback' | 'offer' | 'paid')[];
  /** Stand der Lebenslauf-Ablage im Beispiel (ohne Angabe: leer). */
  ablage?: 'leer' | 'fenster' | 'angelegt';
}

/** Die Bilder der Bühne; die Schlüssel stehen als `scene` in den Schritten. */
export const RECRUITER_TOUR_SCENES: Record<string, RecruiterTourScene> = {
  markt: { phase: 'market', page: 'jobs' },
  stelle: { phase: 'market', page: 'job' },
  aktivieren: { phase: 'market', page: 'job', open: 'activate', fill: 'activate' },
  ablegen: { phase: 'searching', page: 'dashboard', fill: 'cvDrag' },
  hochladen: { phase: 'searching', page: 'dashboard', fill: 'cvTicks', ablage: 'fenster' },
  angelegt: { phase: 'searching', page: 'dashboard', ablage: 'angelegt' },
  // Die Akte öffnet das kurze Interview selbst mit `?interview=quick` (RecruiterCandidateDetail).
  kurzInterview: { phase: 'candidate', page: 'dossier', search: '?interview=quick', fill: 'quickInterview', ablage: 'angelegt' },
  akteBereit: { phase: 'ready', page: 'dossier' },
  // `?einreichen=alle` zeigt erst die Stellenwahl, `?einreichen=<Stelle>` gleich die Passung.
  stellenwahl: { phase: 'ready', page: 'dossier', search: '?einreichen=alle' },
  vorstellen: { phase: 'ready', page: 'dossier', search: `?einreichen=${HH_DEMO_IDS.job}`, fill: 'vorstellen' },
  termin: { phase: 'scheduled', page: 'interviews', notify: ['requested', 'scheduled'] },
  aufgaben: { phase: 'interviewed', page: 'tasks' },
  nachgespraech: { phase: 'interviewed', page: 'dossier', search: '?nachgespraech=1', fill: 'debrief', notify: ['feedback'] },
  empfehlung: { phase: 'offerWanted', page: 'dossier', search: `?empfehlung=${HH_DEMO_IDS.submission}`, fill: 'recommend' },
  angebot: { phase: 'offer', page: 'dossier', search: `?angebot=${HH_DEMO_IDS.submission}`, fill: 'offerTalked', notify: ['offer'] },
  geld: { phase: 'placed', page: 'earnings', search: `?besetzung=${HH_DEMO_IDS.placement}`, notify: ['paid'] },
};

/** Kapitel als Schlüssel; die Namen stehen unter recruiterGuide:chapters. */
export const RECRUITER_GUIDE_CHAPTERS = ['start', 'search', 'candidate', 'interview', 'money', 'account'] as const;
export const recruiterGuideChapters = (): string[] => RECRUITER_GUIDE_CHAPTERS.map((key) => i18n.t(`recruiterGuide:chapters.${key}`));

const at = (id: string) => `[data-tour="${id}"]`;
/** Beispielkandidat und -firma in den Texten. */
const tx = (key: string): string => i18n.t(`recruiterGuide:${key}`, { name: 'Daniel Roth', first: 'Daniel', company: 'Nordwerk Medizintechnik' });
const text = (target: object, field: string, read: () => string) =>
  Object.defineProperty(target, field, { enumerable: true, get: read });

type StepDef = Omit<GuideStep, 'title' | 'body' | 'narrowBody' | 'click' | 'wait' | 'hold' | 'points' | 'nextLabel'> & {
  /** Abweichender Text unter steps.<id>.<body>, etwa im Wartezustand. */
  body?: string;
  /** Mitmach-Schritt; Beschriftung unter steps.<id>.action. */
  click?: { to?: string; minWidth?: number; delay?: number };
  /** Stellen, die der Zeiger mit Schild anfährt; die Schilder stehen unter steps.<id>.p1, p2 … */
  points?: string[];
  /** Eigene Beschriftung des Hauptknopfs unter steps.<id>.next. */
  next?: boolean;
};

const step = ({ body = 'body', click, points, next, ...rest }: StepDef): GuideStep => {
  const s = { ...rest } as GuideStep;
  text(s, 'title', () => tx(`steps.${rest.id}.title`));
  text(s, 'body', () => tx(`steps.${rest.id}.${body}`));
  if (click) s.click = text({ ...click }, 'label', () => tx(`steps.${rest.id}.action`)) as GuideStep['click'];
  if (points) s.points = points.map((at, i) => text({ at }, 'label', () => tx(`steps.${rest.id}.p${i + 1}`)) as { at: string; label: string });
  if (next) text(s, 'nextLabel', () => tx(`steps.${rest.id}.next`));
  return s;
};
/** Jedes Bühnenbild hat eine eigene Adresse: So führt auch das Zurück des Browsers einen Schritt zurück. */
const stage = (def: Omit<StepDef, 'route' | 'path'> & { scene: string }) =>
  step({ ...def, route: RECRUITER_TOUR_STAGE, path: `${RECRUITER_TOUR_STAGE}?schritt=${def.id}` });

export interface RecruiterGuideContext {
  /** Unterschrieben, Matchunt zeichnet noch gegen: Suchen und Einreichen sind bis dahin gesperrt. */
  waiting?: boolean;
}

export function recruiterGuideSteps(ctx: RecruiterGuideContext = {}): GuideStep[] {
  const job = HH_DEMO_IDS.job;
  return [
    // 1 · Dein Start -- echt: Der Zeiger fährt die Bereiche der Übersicht an, nichts leuchtet.
    step({ id: 'h-welcome', chapter: 1, route: '/recruiter', body: ctx.waiting ? 'bodyWaiting' : 'body', target: at('dashboard.header'), bare: true, next: true,
      points: [at('dashboard.header'), at('dashboard.tasks'), at('dashboard.pipeline'), at('dashboard.topJobs')] }),

    // 2 · Stelle finden -- Bühne
    stage({ id: 'h-jobs', chapter: 2, scene: 'markt', target: `[data-job-card="${job}"]`, click: {}, show: true }),
    stage({ id: 'h-jobPage', chapter: 2, scene: 'stelle', target: at('job.search'), pointArea: at('job.head'), click: {},
      points: [at('job.tab.ad'), at('job.tab.briefing'), at('job.earning')] }),
    stage({ id: 'h-activateWindow', chapter: 2, scene: 'aktivieren', target: at('activation.confirm'), fillArea: at('activation.window'),
      click: { delay: 1600 }, show: true }),

    // 3 · Kandidat und Vorstellung
    stage({ id: 'h-cvDrag', chapter: 3, scene: 'ablegen', target: at('dashboard.header'), fillArea: at('dashboard.header') }),
    stage({ id: 'h-cvUpload', chapter: 3, scene: 'hochladen', target: at('ablage.submit'), fillArea: at('ablage.window'),
      click: { delay: 700 }, show: true }),
    stage({ id: 'h-cvCreated', chapter: 3, scene: 'angelegt', target: at('ablage.name'), click: {}, show: true }),
    stage({ id: 'h-quick', chapter: 3, scene: 'kurzInterview', target: at('capture.complete'), fillArea: at('capture.window'),
      click: { delay: 1400 }, show: true }),
    stage({ id: 'h-submit', chapter: 3, scene: 'akteBereit', target: at('dossier.submit'), click: {}, show: true }),
    stage({ id: 'h-chooseJob', chapter: 3, scene: 'stellenwahl', target: `[data-job-row="${job}"]`, click: {}, show: true }),
    stage({ id: 'h-present', chapter: 3, scene: 'vorstellen', target: at('vorstellen.send'), fillArea: at('vorstellen.window'),
      click: { delay: 1800 }, show: true }),

    // 4 · Interview
    stage({ id: 'h-interviews', chapter: 4, scene: 'termin', target: at('interviews.next') }),
    // Die ganze Zeile leuchtet (sonst verdeckte die Karte die Aufgabe), der Zeiger tippt auf „Aufgabe öffnen“.
    stage({ id: 'h-tasks', chapter: 4, scene: 'aufgaben', target: at('tasks.next'), pointAt: at('tasks.open'), click: { delay: 250 }, show: true }),
    stage({ id: 'h-debrief', chapter: 4, scene: 'nachgespraech', target: at('debrief.save'), fillArea: at('debrief.window'),
      click: { delay: 1200 }, show: true }),

    // 5 · Angebot und Geld
    stage({ id: 'h-recommend', chapter: 5, scene: 'empfehlung', target: at('recommend.send'), fillArea: at('recommend.window'),
      click: { delay: 1200 }, show: true }),
    stage({ id: 'h-offer', chapter: 5, scene: 'angebot', target: at('offerAnswer.accept'), fillArea: at('offerAnswer.window'),
      click: { delay: 1200 }, show: true }),
    stage({ id: 'h-earnings', chapter: 5, scene: 'geld', target: at('besetzung.window') }),

    // 6 · Dein Konto -- echt
    step({ id: 'h-profile', chapter: 6, route: '/recruiter/profile/terminseite', target: at('profile.tab.booking') }),
    step({ id: 'h-done', chapter: 6, route: '/recruiter/profile/terminseite' }),
  ];
}

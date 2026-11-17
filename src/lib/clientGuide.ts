/**
 * Begleiteter Rundgang für Kunden, Fassung 3 (Entscheidung Marko 16.11.2026):
 * ein Weg, einmal und fertig. Er zeigt die EIGENE Stelle des Kunden -- die hat er im
 * Onboarding schon eingereicht -- und spielt den Rest an einem Beispielkandidaten
 * durch, gebaut aus den Angaben dieser Stelle (lib/clientDemo.ts): Kandidaten, Interview,
 * Angebot, Einstellung. Zum Schluss geht es zurück auf die echten Seiten seines Kontos.
 *
 *   1 Ihre Stelle             echt (Meine Stellen, Stellenseite, auch in der Prüfung)
 *   2 Ihre Kandidaten         Bühne: echte Aufgaben-Seite und echtes Bewerberprofil mit Beispieldaten;
 *                             mitmachen: Prüfen, Interview anfragen, Anfrage senden
 *   3 Interview & Entscheidung Bühne: echte Interviews-Seite, echtes Feedback-Fenster; mitmachen: Angebot machen
 *   4 Angebot & Einstellung   Bühne: Empfehlung, echtes Angebots- und Vertragsfenster, Besetzungen;
 *                             bei Contracting „Der Einsatz“ (echtes Einsatz-Fenster)
 *   5 Ihr Konto               echt (Aufgaben, Team, Glocke, Neue Stelle)
 *
 * Demo-Modus (16.11.2026, Marko: „die ganze Seite ausgefüllt sehen, wie es wirklich ist“):
 * Die Bühne zeigt die echten Seiten; ihre Daten kommen aus lib/clientDemoData.ts.
 *
 * Fassung 1 (24.09.2026) ließ den Kunden im Rundgang eine echte Stelle anlegen und
 * hing seit der Aufnahme in Etappen (11.11.2026) dort fest, weil die Ziele fehlten.
 * Fassung 2 (28.09.2026, Beispielstelle) wurde nie fertig gebaut.
 *
 * Er startet einmal von selbst für jeden Kunden, auch für bestehende (eigener Merker);
 * „Später“ verschiebt nur. Technik und Einblendung teilt er mit dem Headhunter-Rundgang.
 */
import i18n from '@/i18n';
import type { GuideStep } from './recruiterGuide';
import { DEMO, DEMO_IDS, type TourJobState } from './clientDemo';
import type { DemoPhase } from './clientDemoData';

/** Die Bühne: echte Seiten mit Beispieldaten (pages/dashboard/ClientTour.tsx). */
export const CLIENT_TOUR_STAGE = '/dashboard/rundgang';

/** Echte Seiten, die die Bühne zeigt (eigener Adressraum, components/client/tour/DemoScope.tsx). */
export const CLIENT_TOUR_PAGES = {
  jobs: '/dashboard/jobs',
  tasks: '/dashboard/aufgaben',
  profile: `/dashboard/candidates/${DEMO_IDS.submission}`,
  interviews: '/dashboard/interviews',
  placements: '/dashboard/besetzungen',
  // Aufnahme einer neuen Position (Fenster über dem Dashboard); auf der Bühne wird nichts gespeichert.
  intake: '/dashboard/aufnahme',
  team: '/dashboard/team',
} as const;

export interface ClientTourScene {
  /** Stand der Geschichte: welche Beispieldaten die Seiten lesen (lib/clientDemoData.ts). */
  phase: DemoPhase;
  page: keyof typeof CLIENT_TOUR_PAGES;
  /** Suchteil der Seite, etwa der Reiter „In Prüfung“. */
  search?: string;
  /** Fenster im Profil, das der Schritt offen zeigt (CandidateDetail liest `state.open`). */
  open?: 'interview' | 'offer' | 'contract';
  /** Feedback-Fenster über die Aufgabe (`?aufgabe=feedback:…`). */
  feedbackTask?: boolean;
  /** So füllt der Kunde das Fenster aus (components/client/tour/demoAutofill.ts). */
  fill?: 'request' | 'feedback' | 'offer' | 'offerSend' | 'einsatz' | 'contract' | 'newJob' | 'bell' | 'intakeKind' | 'invite';
  /** „Meine Stellen“ mit der Stelle, wie sie läuft: live, drei Kandidaten, zwei Headhunter. */
  live?: boolean;
  /** Besonderer Moment beim ersten Besuch: Freigabe des Namens, Stationen der Besetzung. */
  moment?: 'reveal' | 'hired';
}

/** Die Bilder der Bühne; die Schlüssel stehen als `scene` in den Schritten. */
export const CLIENT_TOUR_SCENES: Record<string, ClientTourScene> = {
  // Der Zeiger öffnet das Menü „Neue Stelle“, der Kunde klickt „Neue Stelle anlegen“. Im Hintergrund
  // laufen drei Stellen mit Kandidaten (Marko 17.11.: „ein lebhaftes Beispiel“).
  stellenNeu: { phase: 'review', page: 'jobs', fill: 'newJob', live: true },
  // Das echte Aufnahme-Fenster, kurz (Marko 17.11.: „das kennt der Kunde schon“, aber „ein Klick muss sein
  // beim Wählen der Art“): Der Kunde klickt die Art seiner Stelle, dann stehen die Wege da.
  aufnahmeArt: { phase: 'review', page: 'intake' },
  // Ohne den Klick davor (Neuladen, Sprung): Die Art wird sofort gewählt.
  aufnahmeWege: { phase: 'review', page: 'intake', fill: 'intakeKind' },
  // Marko 17.11.: „bei Meine Jobs nicht so leer die Karte“ -- die Stelle, wie sie läuft.
  stellenLive: { phase: 'review', page: 'jobs', live: true },
  aufgaben: { phase: 'review', page: 'tasks' },
  profil: { phase: 'review', page: 'profile' },
  anfrage: { phase: 'review', page: 'profile', open: 'interview', fill: 'request' },
  zusage: { phase: 'scheduled', page: 'profile', moment: 'reveal' },
  interviews: { phase: 'scheduled', page: 'interviews' },
  // Nach dem Gespräch: Julia meldet den Eindruck des Kandidaten (echte Meldung aus dem Nachgespräch).
  // Auf „Aufgaben“, wo gerade „Feedback geben“ dazukam (Marko 17.11.: Aufgaben zwischen den Schritten zeigen).
  eindruck: { phase: 'interviewed', page: 'tasks', fill: 'bell' },
  feedback: { phase: 'interviewed', page: 'profile', feedbackTask: true, fill: 'feedback' },
  empfehlung: { phase: 'recommended', page: 'profile' },
  angebot: { phase: 'recommended', page: 'profile', open: 'offer', fill: 'offer' },
  angebotSenden: { phase: 'recommended', page: 'profile', open: 'offer', fill: 'offerSend' },
  einsatz: { phase: 'recommended', page: 'profile', open: 'offer', fill: 'einsatz' },
  // Glückwunsch: Die Zusage kommt als Meldung, der Zeiger öffnet die Glocke.
  // Auf „Aufgaben“: Dort steht schon „Arbeitsvertrag schicken“.
  angenommen: { phase: 'accepted', page: 'tasks', fill: 'bell' },
  vertrag: { phase: 'accepted', page: 'profile', open: 'contract', fill: 'contract' },
  besetzung: { phase: 'signed', page: 'placements', moment: 'hired' },
  // Marko 17.11.: „Holen Sie Ihr Team dazu“ zeigen statt nur sagen -- der Zeiger lädt eine Kollegin ein (nichts wird verschickt).
  team: { phase: 'signed', page: 'team', fill: 'invite' },
};

/** Kapitel als Schlüssel; bei Contracting heißt Kapitel 4 „Der Einsatz“. */
export const CLIENT_GUIDE_CHAPTERS = ['job', 'candidates', 'interview', 'offer', 'account'] as const;
const chapterKeys = (contracting: boolean) => CLIENT_GUIDE_CHAPTERS.map((k) => (k === 'offer' && contracting ? 'einsatz' : k));
export const clientGuideChapters = (contracting = false): string[] =>
  chapterKeys(contracting).map((key) => i18n.t(`clientGuide:chapters.${key}`));

const at = (id: string) => `[data-tour="${id}"]`;

// Texte stehen in src/i18n/locales/clientGuide und werden erst beim Lesen geholt (README Regel 7),
// damit ein Sprachwechsel sofort gilt. Wer die Schritte zeigt, lädt den Namespace `clientGuide`.
// {{hh}}, {{hhFirst}} und {{name}} sind Beispiel-Headhunter und Beispielkandidat (lib/clientDemo.ts).
const tx = (key: string): string => i18n.t(`clientGuide:${key}`, { hh: DEMO.headhunter, hhFirst: DEMO.headhunter.split(' ')[0], name: DEMO.name });
const text = (target: object, field: string, read: () => string) =>
  Object.defineProperty(target, field, { enumerable: true, get: read });

type StepDef = Omit<GuideStep, 'title' | 'body' | 'narrowBody' | 'click' | 'wait' | 'hold' | 'points'> & {
  /** Abweichender Text unter steps.<id>.<body> (etwa `bodyExample`), je nach Lage des Kunden. */
  body?: string;
  /** Mitmach-Schritt: geklickt wird auf der Bühne, ohne Wechsel der echten Adresse. Beschriftung: steps.<id>.action. */
  click?: { to?: string; minWidth?: number; delay?: number; /** Beschriftung unter steps.<id>.<labelKey> statt `action`. */ labelKey?: string };
  /** Stellen, die der Zeiger mit Schild anfährt; Schilder unter steps.<id>.p1, p2 … */
  points?: string[];
};

/** Schritt, dessen Texte bei jedem Lesen aus der Übersetzung kommen. */
const step = ({ body = 'body', click, points, ...rest }: StepDef): GuideStep => {
  const s = { ...rest } as GuideStep;
  if (points) s.points = points.map((selector, i) => text({ at: selector }, 'label', () => tx(`steps.${rest.id}.p${i + 1}`)) as { at: string; label: string });
  text(s, 'title', () => tx(`steps.${rest.id}.title`));
  text(s, 'body', () => tx(`steps.${rest.id}.${body}`));
  if (click) {
    const { labelKey = 'action', ...rest2 } = click;
    s.click = text({ ...rest2 }, 'label', () => tx(`steps.${rest.id}.${labelKey}`)) as GuideStep['click'];
  }
  return s;
};
/** Jedes Bühnenbild hat eine eigene Adresse: So führt auch das Zurück des Browsers einen Schritt zurück. */
const stage = (def: Omit<StepDef, 'route' | 'path'> & { scene: string }) =>
  step({ ...def, route: CLIENT_TOUR_STAGE, path: `${CLIENT_TOUR_STAGE}?schritt=${def.id}` });

/** Die Stellenkarte, wie sie läuft; der Zeiger fährt Stand, Kandidaten, Neuigkeit und Suchende an. */
const liveCard = (id: string, jobId: string, body: string) => {
  const card = `[data-tour-job="${jobId}"]`;
  return stage({ id, chapter: 1, scene: 'stellenLive', target: card, body,
    points: ['steps', 'people', 'news', 'searchers'].map((part) => `${card} [data-card="${part}"]`) });
};

/** Was der Rundgang über den Kunden wissen muss, um seine Schritte zu bauen. */
export interface ClientGuideContext {
  /** Neueste eingereichte Stelle; ohne sie läuft Kapitel 1 auf der Bühne. */
  jobId: string | null;
  state: TourJobState;
  contracting: boolean;
  /** Rahmenvertrag unterschrieben, Matchunt zeichnet noch gegen: Seiten sind bis dahin gesperrt. */
  waiting?: boolean;
}

export function clientGuideSteps(ctx: ClientGuideContext): GuideStep[] {
  const real = !!ctx.jobId && ctx.state !== 'none';
  const live = real && ctx.state === 'live';
  const lage = !real ? 'bodyExample' : live ? 'bodyLive' : 'body';
  return [
    // 1 · Ihre Stelle. Zuerst, wie man Positionen abgibt (Marko 17.11.: echtes Aufnahme-Fenster,
    // „danach geht es mit der Stelle weiter, die der Kunde schon aufgenommen hat“).
    step({ id: 'c-welcome', chapter: 1, route: '/dashboard', body: real ? 'body' : 'bodyExample' }),
    // Der Zeiger öffnet „Neue Stelle“ und zeigt auf „Neue Stelle anlegen“; geklickt wird selbst.
    stage({ id: 'c-jobsNew', chapter: 1, scene: 'stellenNeu', target: at('jobs.newBlank'), fillArea: at('jobs.new'), click: {}, show: true, side: 'left',
      body: ctx.waiting ? 'bodyWaiting' : 'body' }),
    stage({ id: 'c-intakeKind', chapter: 1, scene: 'aufnahmeArt', target: `[data-kind="${ctx.contracting ? 'freelance' : 'full-time'}"]`,
      click: { labelKey: ctx.contracting ? 'actionContracting' : 'action' }, show: true, side: 'bottom' }),
    stage({ id: 'c-intakeWays', chapter: 1, scene: 'aufnahmeWege', target: at('intake.ways'), points: ['[data-intake-way="paste"]'] }),
    ...(real
      ? [
        step({ id: 'c-myJob', chapter: 1, route: '/dashboard/jobs', path: live ? '/dashboard/jobs' : '/dashboard/jobs?tab=review',
          target: `[data-tour-job="${ctx.jobId}"]`, body: lage }),
        live
          ? step({ id: 'c-jobPage', chapter: 1, route: `/dashboard/jobs/${ctx.jobId}`, target: at('job.tabs') })
          // In der Prüfung zeigt die echte Stellenseite die Angaben aus der Aufnahme und den Stand der Prüfung.
          : step({ id: 'c-jobReview', chapter: 1, route: `/dashboard/jobs/${ctx.jobId}`, target: at('job.review') }),
        // Noch nicht live: So sieht seine Karte aus, sobald die Suche läuft (live ist sie schon voll).
        ...(live ? [] : [liveCard('c-jobLive', ctx.jobId!, 'body')]),
      ]
      // Ohne eigene Stelle: gleich die Karte, wie sie läuft, mit dem Titel aus der Aufnahme.
      : [liveCard('c-jobsExample', DEMO_IDS.job, ctx.waiting ? 'bodyWaiting' : 'body')]),

    // 2 · Ihre Kandidaten -- echte Seiten mit einem Beispielkandidaten an seiner Stelle
    // Markiert ist die ganze Zeile „Kandidat prüfen“; der Zeiger tippt auf ihren Knopf.
    stage({ id: 'c-candidate', chapter: 2, scene: 'aufgaben', target: '[data-tour-task-row="review"]', pointAt: '[data-tour-task="review"]', click: {}, show: true, body: real ? 'body' : 'bodyExample' }),
    // Der Zeiger fährt die Stellen mit Schild an (Marko 16.11.: „intelligenter, Dinge bewegen sich selbst“).
    stage({ id: 'c-profile', chapter: 2, scene: 'profil', target: at('candidate.head'), body: ctx.contracting ? 'bodyContracting' : 'body',
      points: [at('candidate.name'), at('candidate.facts'), at('candidate.submitter'), at('candidate.tasks')] }),
    stage({ id: 'c-talk', chapter: 2, scene: 'profil', target: at('candidate.talk'), points: [at('candidate.insights'), at('candidate.fit'), at('candidate.must')] }),
    stage({ id: 'c-career', chapter: 2, scene: 'profil', target: at('candidate.career'), points: [at('candidate.career'), at('candidate.ask')] }),
    stage({ id: 'c-request', chapter: 2, scene: 'profil', target: at('candidate.main'), click: {}, show: true }),
    stage({ id: 'c-invite', chapter: 2, scene: 'anfrage', target: at('request.send'), fillArea: at('request.grid'), click: { delay: 1200 }, show: true }),
    stage({ id: 'c-reveal', chapter: 2, scene: 'zusage', target: at('candidate.head') }),

    // 3 · Interview und Entscheidung
    stage({ id: 'c-agenda', chapter: 3, scene: 'interviews', target: at('interviews.next') }),
    // Marko 17.11.: vor dem Feedback die Meldung, dass dem Kandidaten das Gespräch gefallen hat.
    stage({ id: 'c-impression', chapter: 3, scene: 'eindruck', target: at('bell.menu'), fillArea: at('header.bell'), side: 'left' }),
    ...(ctx.contracting
      ? [
        stage({ id: 'c-feedback', chapter: 3, scene: 'feedback', target: at('feedback.ways'), fillArea: at('feedback.window'), body: 'bodyContracting' }),
        // 4 · Der Einsatz: Angebot und Arbeitsvertrag gibt es bei Contracting nicht (Etappe 1, 11.11.2026).
        stage({ id: 'c-einsatz', chapter: 4, scene: 'einsatz', target: at('offer.window') }),
      ]
      : [
        stage({ id: 'c-feedback', chapter: 3, scene: 'feedback', target: '[data-way="offer"]', fillArea: at('feedback.window'), click: {}, show: true }),
        // 4 · Angebot und Einstellung
        stage({ id: 'c-recommendation', chapter: 4, scene: 'empfehlung', target: at('candidate.recommendation') }),
        stage({ id: 'c-offer', chapter: 4, scene: 'angebot', target: at('offer.next'), fillArea: at('offer.window'), click: {}, show: true }),
        stage({ id: 'c-offerSend', chapter: 4, scene: 'angebotSenden', target: at('offer.send'), click: { delay: 1800 }, show: true }),
        // Glückwunsch (Marko 16.11.: „sonst merkt man kaum, dass er zugesagt hat“): Meldung und Glocke.
        stage({ id: 'c-accepted', chapter: 4, scene: 'angenommen', target: at('bell.menu'), fillArea: at('header.bell'), side: 'left' }),
        // Marko 17.11.: „wir schicken ihn selbst zu, dann ist es einfacher“ -- der Zeiger wählt
        // „Selbst verschicken“, gespeichert wird selbst; hochgeladen wird im Rundgang nichts.
        stage({ id: 'c-contract', chapter: 4, scene: 'vertrag', target: at('contract.saveSelf'), fillArea: at('contract.window'), click: {}, show: true }),
        stage({ id: 'c-hired', chapter: 4, scene: 'besetzung', target: at('besetzung.card') }),
      ]),

    // 5 · Ihr Konto -- wieder echt
    // „Aufgaben“ zeigt der Rundgang im Ablauf (Kandidat prüfen, Feedback, Vertrag); im neuen Konto wäre die Seite hier leer.
    stage({ id: 'c-team', chapter: 5, scene: 'team', target: at('team.inviteWindow'), fillArea: at('team.invite') }),
    step({ id: 'c-notify', chapter: 5, route: '/dashboard', target: at('header.notify') }),
    // Neue Positionen: der Einstieg auf dem Dashboard, mit den Entwürfen (im Wartezustand gibt es ihn nicht).
    ...(ctx.waiting ? [] : [step({ id: 'c-positionEntry', chapter: 5, route: '/dashboard', target: at('client.entry') })]),
    step({ id: 'c-done', chapter: 5, route: '/dashboard', body: lage }),
  ];
}

/** Laufender Rundgang je Browser-Tab (eigener Schlüssel: Fassung 1 hatte andere Schritte). */
export const CLIENT_GUIDE_STATE_KEY = 'matchunt.clientGuide3';
/**
 * Merker im Konto (user_metadata). Neue Schlüssel für Fassung 3: Wer den alten Rundgang
 * gesehen hat, bekommt den neuen einmal von selbst.
 */
export const CLIENT_TOUR_SEEN_KEY = 'client_app_tour_seen_at';
/** „Später“ im ersten Schritt: startet nicht mehr von selbst, bleibt aber im Start-Kasten offen. */
export const CLIENT_TOUR_POSTPONED_KEY = 'client_app_tour_postponed_at';
export const clientTourStorageKey = (userId: string) => `matchunt.clientAppTour.${userId}`;
export const clientTourPostponedStorageKey = (userId: string) => `matchunt.clientAppTourPostponed.${userId}`;

type TourUser = { id: string; user_metadata?: Record<string, unknown> } | null;
function gemerkt(user: NonNullable<TourUser>, storage: Pick<Storage, 'getItem'> | null, metaKey: string, storageKey: (id: string) => string) {
  if (user.user_metadata?.[metaKey]) return true;
  try { return Boolean(storage?.getItem(storageKey(user.id))); } catch { return false; }
}

/** Ganz gesehen oder beendet: Im Start-Kasten ist der Rundgang erledigt. */
export function clientTourSeen(user: TourUser, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  return gemerkt(user, storage, CLIENT_TOUR_SEEN_KEY, clientTourStorageKey);
}

/** Startet nicht mehr von selbst: gesehen oder auf „Später“ verschoben. */
export function clientTourSettled(user: TourUser, storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!user) return true;
  return clientTourSeen(user, storage) || gemerkt(user, storage, CLIENT_TOUR_POSTPONED_KEY, clientTourPostponedStorageKey);
}

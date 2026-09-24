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
import type { GuideStep } from './recruiterGuide';

export const CLIENT_GUIDE_CHAPTERS = ['Willkommen', 'Stelle anlegen', 'Nach dem Einreichen', 'Kandidaten & Team'] as const;

/** Ab dieser Breite gibt es das Seitenmenü (md). */
const MENU = 768;
const at = (id: string) => `[data-tour="${id}"]`;
const nav = (href: string) => `[data-tour="nav:${href}"]`;
/** Die Aufnahme liegt unter /dashboard/aufnahme und /dashboard/aufnahme/:id. */
const AUFNAHME = '/dashboard/aufnahme*';

export const CLIENT_GUIDE_STEPS: GuideStep[] = [
  // 1 · Willkommen
  { id: 'c-welcome', chapter: 1, route: '/dashboard', title: 'Willkommen bei Matchunt',
    body: 'In wenigen Minuten zeigen wir Ihnen, wie Sie eine Stelle an unsere Headhunter geben und passende Kandidaten bekommen. Dabei legen Sie gleich Ihre erste Stelle an. Sie klicken selbst, wir erklären.' },
  { id: 'c-entry', chapter: 1, route: '/dashboard', target: at('client.entry'), title: 'Hier beginnt jede Stelle',
    body: '„Position aufnehmen“ ist der wichtigste Knopf. Angefangene Stellen finden Sie hier später unter „Weitermachen“.' },
  { id: 'c-decide', chapter: 1, route: '/dashboard', target: at('client.decide'), title: 'Was auf Sie wartet',
    body: '„Braucht Entscheidung“ zeigt Kandidaten und Termine, bei denen Sie am Zug sind. Je schneller Sie reagieren, desto besser die Chancen.' },

  // 2 · Stelle anlegen
  { id: 'c-start', chapter: 2, route: '/dashboard', target: at('client.entry'), title: 'Legen wir Ihre erste Stelle an',
    body: 'Fügen Sie Ihre Stellenanzeige ein und klicken Sie auf „Profil bauen“. Keine Anzeige zur Hand? Dann „Von Hand beschreiben“.',
    narrowBody: 'Tippen Sie auf „Position aufnehmen“.',
    click: { label: 'Position aufnehmen', to: AUFNAHME } },
  { id: 'c-kind', chapter: 2, route: AUFNAHME, target: at('intake.kind'), autoSkip: true,
    title: 'Festanstellung oder Contracting?',
    body: 'Danach richtet sich, wonach wir fragen und was in der Vereinbarung steht. Wählen Sie die passende Art.',
    click: { label: 'Weiter' } },
  { id: 'c-ways', chapter: 2, route: AUFNAHME, target: at('intake.ways'), autoSkip: true,
    title: 'Der schnellste Weg: Ihre Anzeige',
    body: 'Anzeige einfügen, Link oder PDF: Wir bauen daraus das Profil, Sie prüfen nur noch. Ohne Anzeige beschreiben Sie die Stelle von Hand.',
    click: { label: 'Weiter' } },
  { id: 'c-profile', chapter: 2, route: AUFNAHME, target: at('intake.head'),
    wait: 'Der Rundgang wartet, bis Ihr Profil steht.',
    title: 'Prüfen statt tippen',
    body: 'Ihr Profil steht. Alles aus Ihrer Anzeige ist mit „aus der Anzeige“ markiert: „✓ stimmt“ bestätigt, sonst einfach ändern. „Alle bestätigen“ übernimmt alles auf einmal.' },
  { id: 'c-criteria', chapter: 2, route: AUFNAHME, target: at('intake.criteria'),
    title: 'Die wichtigste Angabe',
    body: 'Stufen Sie jede Anforderung ein: unverzichtbar, verhandelbar oder lernbar. Daran messen die Headhunter jeden Kandidaten.' },
  { id: 'c-briefing', chapter: 2, route: AUFNAHME, target: at('intake.briefing'),
    title: 'Das Briefing: was in keiner Anzeige steht',
    body: 'Acht Fragen aus echten Vermittlungsgesprächen, etwa warum die Stelle offen ist und wer bei Ihnen Erfolg hat. Genau das macht die Ansprache der Headhunter überzeugend.' },
  { id: 'c-save', chapter: 2, route: AUFNAHME, target: at('intake.footer'),
    title: 'Nichts geht verloren',
    body: 'Alles wird laufend gespeichert. Mit „Später“ machen Sie jederzeit unter „Weitermachen“ weiter. „Weiter“ führt zum Einreichen, sobald Briefing und Anforderungen stehen.' },
  { id: 'c-submit', chapter: 2, route: AUFNAHME, example: 'clientSubmit',
    title: 'Füllen Sie in Ruhe aus',
    body: 'Beantworten Sie jetzt die Fragen und reichen Sie ein, wenn Sie so weit sind. Der Rundgang wartet so lange und geht danach unter „Meine Jobs“ weiter.' },

  // 3 · Nach dem Einreichen
  { id: 'c-jobs', chapter: 3, route: '/dashboard/jobs', target: at('jobs.main'), example: 'clientStatus', exampleWhenMissing: true,
    hold: 'Der Rundgang geht weiter, sobald Sie eingereicht oder „Später“ gewählt haben.', holdWhile: AUFNAHME,
    title: 'Wo steht meine Stelle?',
    body: 'Unter „Meine Jobs“ sehen Sie jede Stelle mit ihrem Stand: Eingereicht → Prüfung durch Matchunt (meist unter 24 Std.) → Live → Erste Kandidaten. Entwürfe stehen unter „Entwürfe“.' },

  // 4 · Kandidaten & Team
  { id: 'c-navCandidates', chapter: 4, route: '/dashboard/jobs', target: nav('/dashboard/candidates'),
    title: 'Ihre Kandidaten', body: 'Klicken Sie links im Menü auf „Bewerber“.', narrowBody: 'Tippen Sie auf „Bewerber öffnen“.',
    click: { label: 'Bewerber öffnen', to: '/dashboard/candidates', minWidth: MENU } },
  { id: 'c-candidates', chapter: 4, route: '/dashboard/candidates', target: at('candidates.header'), example: 'clientCandidate',
    title: 'Kandidaten kommen anonym',
    body: 'Sie sehen zuerst ein anonymes Profil mit der Einschätzung des Headhunters. Wollen Sie jemanden kennenlernen, fragt der Headhunter die Person. Danach sehen Sie Namen und Lebenslauf.' },
  { id: 'c-navTeam', chapter: 4, route: '/dashboard/candidates', target: nav('/dashboard/team'),
    title: 'Ihr Team', body: 'Klicken Sie links im Menü auf „Team“.', narrowBody: 'Tippen Sie auf „Team öffnen“.',
    click: { label: 'Team öffnen', to: '/dashboard/team', minWidth: MENU } },
  { id: 'c-team', chapter: 4, route: '/dashboard/team', target: at('team.header'),
    title: 'Holen Sie Ihr Team dazu',
    body: 'Laden Sie Kollegen ein: HR reicht Stellen ein, der Fachbereich gibt Feedback zu Kandidaten.' },
  { id: 'c-done', chapter: 4, route: '/dashboard/team', title: 'Geschafft',
    body: 'Sie kennen jetzt die wichtigsten Wege. Den Rundgang starten Sie jederzeit neu über „Rundgang“ im Dashboard.' },
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

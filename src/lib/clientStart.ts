/**
 * „Ihr Start bei Matchunt“ im Kunden-Dashboard (Entscheidung 26.09.2026).
 *
 * Ersetzt den alten Kasten „Verifikation erforderlich“: Er las die Tabelle des
 * früheren Kunden-Onboardings (client_verifications) und schickte Kunden, die
 * längst per DocuSign unterschrieben hatten, zu „AGB akzeptieren“ und in ein
 * altes Onboarding mit eigenen AGB (Live-Fall Kanna Medics). Die Schritte hier
 * kommen aus echten Daten: Rahmenvertrag, Stellen, Firmendaten, Rundgang.
 */

export type ClientStepId = 'contract' | 'position' | 'company' | 'tour';
/** done: erledigt · waiting: liegt bei Matchunt · open: der Kunde ist dran */
export type ClientStepState = 'done' | 'waiting' | 'open';
export interface ClientStep { id: ClientStepId; label: string; state: ClientStepState; detail: string; action?: string }

export interface StartFramework { agreement_number: string | null; status: string; countersigned_at: string | null }
export interface StartJob { title: string | null; status: string }

/** Merker im Konto: Die „Alles eingerichtet“-Zeile wurde ausgeblendet. */
export const CLIENT_START_HIDDEN_KEY = 'client_start_hidden_at';

const datum = (v: string | null) => (v
  ? new Date(v).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })
  : '');
const titel = (j: StartJob) => j.title?.trim() || 'Ihre Position';

export function clientStartSteps(input: {
  framework: StartFramework | null;
  jobs: StartJob[];
  /** Was für die Rechnung an Firmendaten fehlt, als lesbare Bezeichnungen. */
  missingCompany: string[];
  tourDone: boolean;
}): ClientStep[] {
  const { framework: rv, jobs } = input;

  const contract: ClientStep = !rv
    ? { id: 'contract', label: 'Vertrag', state: 'open', detail: 'Der Rahmenvertrag entsteht mit Ihrer ersten Position.' }
    : rv.status === 'active'
    ? { id: 'contract', label: 'Vertrag', state: 'done',
        detail: ['Rahmenvertrag', rv.agreement_number, 'beidseitig unterzeichnet'].filter(Boolean).join(' ')
          + (rv.countersigned_at ? ` am ${datum(rv.countersigned_at)}` : '') }
    : rv.status === 'customer_signed'
    ? { id: 'contract', label: 'Vertrag', state: 'waiting', detail: 'Ihre Unterschrift liegt vor. Matchunt zeichnet gegen.' }
    : rv.status === 'sent'
    ? { id: 'contract', label: 'Vertrag', state: 'open', detail: 'Der Rahmenvertrag wartet auf Ihre Unterschrift in DocuSign.' }
    : { id: 'contract', label: 'Vertrag', state: 'waiting', detail: 'Matchunt bereitet Ihren Rahmenvertrag vor.' };

  const live = jobs.find(j => j.status === 'published');
  const inReview = jobs.find(j => j.status === 'pending_approval');
  const position: ClientStep = live
    ? { id: 'position', label: 'Erste Position', state: 'done', detail: `${titel(live)} ist für unsere Recruiter freigegeben` }
    : inReview
    ? { id: 'position', label: 'Erste Position', state: 'waiting', detail: `${titel(inReview)} wird von Matchunt geprüft` }
    : { id: 'position', label: 'Erste Position', state: 'open', detail: 'Beschreiben Sie Ihre erste Position, wir kümmern uns um die Suche.', action: 'Position aufnehmen' };

  const company: ClientStep = input.missingCompany.length
    ? { id: 'company', label: 'Firmendaten für Rechnungen', state: 'open', detail: `Es fehlt: ${input.missingCompany.join(', ')}`, action: 'Ergänzen' }
    : { id: 'company', label: 'Firmendaten für Rechnungen', state: 'done', detail: 'Firmierung und Anschrift sind hinterlegt' };

  const tour: ClientStep = input.tourDone
    ? { id: 'tour', label: 'Rundgang', state: 'done', detail: 'Das Wichtigste in zwei Minuten', action: 'Nochmal ansehen' }
    : { id: 'tour', label: 'Rundgang', state: 'open', detail: 'Das Wichtigste in zwei Minuten', action: 'Rundgang starten' };

  return [contract, position, company, tour];
}

/** Der Rahmenvertrag, der für den Kunden gerade zählt: der wirksame, sonst der am weitesten fortgeschrittene. */
const RANG = ['active', 'customer_signed', 'sent', 'pending_release', 'draft'];
export function currentFramework(rows: StartFramework[]): StartFramework | null {
  return [...rows].filter(r => RANG.includes(r.status)).sort((a, b) => RANG.indexOf(a.status) - RANG.indexOf(b.status))[0] ?? null;
}

export const clientStartDone = (steps: ClientStep[]) => steps.filter(s => s.state === 'done').length;

/**
 * „Ihr Start bei Matchunt“ im Kunden-Dashboard (Entscheidung 26.09.2026).
 *
 * Ersetzt den alten Kasten „Verifikation erforderlich“: Er las die Tabelle des
 * früheren Kunden-Onboardings (client_verifications) und schickte Kunden, die
 * längst per DocuSign unterschrieben hatten, zu „AGB akzeptieren“ und in ein
 * altes Onboarding mit eigenen AGB (Live-Fall Kanna Medics). Die Schritte hier
 * kommen aus echten Daten: Rahmenvertrag, Stellen, Firmendaten, Kalender
 * (seit 02.10.2026), Rundgang.
 */
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import type { CalendarState } from '@/lib/interviewScheduling';

export type ClientStepId = 'contract' | 'position' | 'company' | 'calendar' | 'tour';
/** done: erledigt · waiting: liegt bei Matchunt · open: der Kunde ist dran */
export type ClientStepState = 'done' | 'waiting' | 'open';
export interface ClientStep { id: ClientStepId; label: string; state: ClientStepState; detail: string; action?: string }

export interface StartFramework { agreement_number: string | null; status: string; countersigned_at: string | null }
export interface StartJob { title: string | null; status: string }

/** Merker im Konto: Die „Alles eingerichtet“-Zeile wurde ausgeblendet. */
export const CLIENT_START_HIDDEN_KEY = 'client_start_hidden_at';

const datum = (v: string | null) => (v
  ? new Date(v).toLocaleDateString(intlLocale(i18n.language), { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })
  : '');
const t = (key: string, options?: Record<string, unknown>) => i18n.t(`clientDashboard:start.${key}`, options) as string;
const titel = (j: StartJob) => j.title?.trim() || t('yourPosition');

export function clientStartSteps(input: {
  framework: StartFramework | null;
  jobs: StartJob[];
  /** Was für die Rechnung an Firmendaten fehlt, als lesbare Bezeichnungen (schon übersetzt). */
  missingCompany: string[];
  /** Stand der Kalender-Verbindung; null = unbekannt (noch nicht geladen oder Fehler). */
  calendar: CalendarState | null;
  tourDone: boolean;
}): ClientStep[] {
  const { framework: rv, jobs } = input;

  const contract: ClientStep = !rv
    ? { id: 'contract', label: t('contract'), state: 'open', detail: t('contractNone') }
    : rv.status === 'active'
    ? { id: 'contract', label: t('contract'), state: 'done',
        detail: (rv.agreement_number ? t('contractActiveNumber', { number: rv.agreement_number }) : t('contractActive'))
          + (rv.countersigned_at ? t('contractOnDate', { date: datum(rv.countersigned_at) }) : '') }
    : rv.status === 'customer_signed'
    ? { id: 'contract', label: t('contract'), state: 'waiting', detail: t('contractCustomerSigned') }
    : rv.status === 'sent'
    ? { id: 'contract', label: t('contract'), state: 'open', detail: t('contractSent') }
    : { id: 'contract', label: t('contract'), state: 'waiting', detail: t('contractPreparing') };

  const live = jobs.find(j => j.status === 'published');
  const inReview = jobs.find(j => j.status === 'pending_approval');
  const position: ClientStep = live
    ? { id: 'position', label: t('position'), state: 'done', detail: t('positionLive', { title: titel(live) }) }
    : inReview
    ? { id: 'position', label: t('position'), state: 'waiting', detail: t('positionReview', { title: titel(inReview) }) }
    : { id: 'position', label: t('position'), state: 'open', detail: t('positionOpen'), action: t('positionAction') };

  const company: ClientStep = input.missingCompany.length
    ? { id: 'company', label: t('company'), state: 'open', detail: t('companyMissing', { fields: input.missingCompany.join(', ') }), action: t('companyAction') }
    : { id: 'company', label: t('company'), state: 'done', detail: t('companyDone') };

  // not_configured: Die Microsoft-App von Matchunt fehlt noch. Dann gibt es für
  // den Kunden nichts zu tun, der Schritt erscheint gar nicht.
  const calendar: ClientStep | null = input.calendar === 'not_configured'
    ? null
    : input.calendar === 'connected'
    ? { id: 'calendar', label: t('calendar'), state: 'done', detail: t('calendarConnected') }
    : input.calendar === 'it_pending'
    ? { id: 'calendar', label: t('calendar'), state: 'waiting', detail: t('calendarItPending'), action: t('calendarView') }
    : input.calendar === 'expired'
    ? { id: 'calendar', label: t('calendar'), state: 'open', detail: t('calendarExpired'), action: t('calendarReconnect') }
    : { id: 'calendar', label: t('calendar'), state: 'open', detail: t('calendarOpen'), action: t('calendarConnect') };

  const tour: ClientStep = input.tourDone
    ? { id: 'tour', label: t('tour'), state: 'done', detail: t('tourDetail'), action: t('tourAgain') }
    : { id: 'tour', label: t('tour'), state: 'open', detail: t('tourDetail'), action: t('tourStart') };

  return calendar ? [contract, position, company, calendar, tour] : [contract, position, company, tour];
}

/** Der Rahmenvertrag, der für den Kunden gerade zählt: der wirksame, sonst der am weitesten fortgeschrittene. */
const RANG = ['active', 'customer_signed', 'sent', 'pending_release', 'draft'];
export function currentFramework(rows: StartFramework[]): StartFramework | null {
  return [...rows].filter(r => RANG.includes(r.status)).sort((a, b) => RANG.indexOf(a.status) - RANG.indexOf(b.status))[0] ?? null;
}

export const clientStartDone = (steps: ClientStep[]) => steps.filter(s => s.state === 'done').length;

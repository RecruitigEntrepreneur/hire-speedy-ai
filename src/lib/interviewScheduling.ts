// Interview-Terminierung (Stand 02.10.2026): gemeinsame Typen und Aufrufe für
// Kundenfenster, Kalender-Verbindung, Kandidatenseite und Bestätigung aus der
// Mail. Die Logik liegt serverseitig in den Edge Functions interview-request,
// calendar-connect, get-interview-by-token, process-interview-response und
// interview-client-link; hier stehen nur die Verträge und dünne Aufrufer.
import { supabase } from '@/integrations/supabase/client';

export type SlotStatus = 'all' | 'required' | 'busy' | 'booked';
export type Weekday = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type WeeklyWindows = Partial<Record<Weekday, [string, string][]>>;

export interface InterviewHoursRules {
  weekly: WeeklyWindows;
  bufferMinutes: number;
  minNoticeHours: number;
  horizonDays: number;
  skipHolidays: boolean;
  absences: { from: string; to: string }[];
}

export const DEFAULT_INTERVIEW_HOURS: InterviewHoursRules = {
  weekly: {
    '1': [['09:00', '12:00'], ['14:00', '17:00']],
    '2': [['09:00', '12:00'], ['14:00', '17:00']],
    '3': [['09:00', '12:00'], ['14:00', '17:00']],
    '4': [['09:00', '12:00'], ['14:00', '17:00']],
    '5': [['09:00', '12:00']],
  },
  bufferMinutes: 0,
  minNoticeHours: 24,
  horizonDays: 14,
  skipHolidays: true,
  absences: [],
};

export const WEEKDAY_LABELS: Record<Weekday, string> = { '1': 'Mo', '2': 'Di', '3': 'Mi', '4': 'Do', '5': 'Fr', '6': 'Sa', '7': 'So' };
export const INTERVIEW_DURATIONS = [30, 45, 60, 90, 120] as const;
export const MAX_PROPOSALS = 5;

/** Person aus dem Team des Kunden. */
export interface TeamPerson { userId: string; name: string; email: string; title: string | null; role: string }

export type MeetingFormat = 'teams' | 'phone' | 'onsite';
export type FunctionKey = 'fachbereich' | 'fuehrungskraft' | 'geschaeftsfuehrung' | 'hr' | 'andere';
export const FUNCTION_LABELS: Record<FunctionKey, string> = { fachbereich: 'Fachbereich', fuehrungskraft: 'Führungskraft', geschaeftsfuehrung: 'Geschäftsführung', hr: 'HR', andere: 'Andere' };
/** Vorgeschlagener Zugriff je Funktion: Geschäftsführung und HR sehen alles. */
export const FUNCTION_DEFAULT_ACCESS: Record<FunctionKey, 'job' | 'all'> = { fachbereich: 'job', fuehrungskraft: 'job', geschaeftsfuehrung: 'all', hr: 'all', andere: 'job' };

/** Teilnehmer auf Kundenseite, wie er im Anfrage-Fenster gewählt wird. */
export interface AttendeeDraft {
  userId?: string | null;
  email: string;
  name: string;
  title?: string | null;
  required: boolean;
  kind: 'client_user' | 'external';
  /** entscheidet über die Einstellung */
  decisionMaker?: boolean;
  functionKey?: FunctionKey | null;
  /** gerade ins Team eingeladen, Einladung noch offen */
  invited?: boolean;
}

export interface InviteColleagueInput {
  submissionId: string;
  name: string;
  email: string;
  functionKey: FunctionKey;
  functionLabel?: string;
  decisionMaker: boolean;
  access: 'job' | 'all';
}
export interface InviteColleagueResult { attendee: AttendeeDraft; emailSent: boolean; note: string | null }

export type CalendarState = 'not_configured' | 'not_connected' | 'connected' | 'expired' | 'it_pending';

export interface CalendarStatus {
  state: CalendarState;
  provider: 'microsoft' | null;
  accountEmail: string | null;
  /** Link an die IT wurde gesendet und noch nicht bestätigt */
  itRequest: { itEmail: string; sentAt: string } | null;
}

export interface RequestContext {
  submissionId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  candidateLabel: string;
  candidateName: string | null;
  identityUnlocked: boolean;
  recruiterName: string | null;
  /** Nummer der Runde, die jetzt angefragt würde */
  round: number;
  me: TeamPerson;
  team: TeamPerson[];
  /** Teilnehmer der letzten Runde (für Runde 2 vorausgewählt) */
  previousAttendees: AttendeeDraft[];
  calendar: CalendarStatus;
  hours: InterviewHoursRules;
  defaultMessage: string;
  /** offene Anfrage, die durch eine neue ersetzt würde */
  openRequest: { interviewId: string; status: string; createdAt: string } | null;
  /** Firmenanschrift aus den Firmendaten (Vorbelegung „Vor Ort“), mehrzeilig */
  onsiteDefault: string | null;
  /** Darf Kollegen ins Team einladen; sonst Namen der Admins */
  invite: { allowed: boolean; adminNames: string[] };
}

export interface ScheduleSlot { start: string; status: SlotStatus; missing: string[]; unknown: string[] }
export interface ScheduleDay { date: string; label: string; slots: ScheduleSlot[] }

export interface AvailabilityResult {
  /** frei/belegt aus Outlook berücksichtigt */
  connected: boolean;
  /** Eigener Outlook-Kalender gelesen; false bei Verbindung heißt: Zeiten ungeprüft */
  selfVisible?: boolean;
  stepMinutes: number;
  days: ScheduleDay[];
  people: { key: string; name: string; required: boolean; visible: boolean }[];
}

export interface AvailabilityInput {
  submissionId: string;
  durationMinutes: number;
  /** Montag der angezeigten Woche, YYYY-MM-DD (deutsche Zeit) */
  weekStart: string;
  attendees: AttendeeDraft[];
}

export interface CheckTimeInput {
  submissionId: string;
  durationMinutes: number;
  /** frei eingegebene Startzeit (ISO) */
  start: string;
  attendees: AttendeeDraft[];
}

/** Ergebnis wie eine Kachel im Raster, plus Hinweise zu Interview-Zeiten und Vorlauf */
export interface CheckTimeResult {
  start: string;
  status: ScheduleSlot['status'];
  missing: string[];
  unknown: string[];
  inHours: boolean;
  shortNotice: boolean;
  connected: boolean;
  selfVisible: boolean;
}

export interface SendInput {
  submissionId: string;
  meetingFormat: MeetingFormat;
  /** Pflicht bei „Vor Ort“ */
  onsiteAddress?: string | null;
  /** Hinweis für den Kandidaten bei „Vor Ort“ (Empfang, Parken) */
  locationNote?: string | null;
  durationMinutes: number;
  slots: string[];
  attendees: AttendeeDraft[];
  allowAlternative: boolean;
  alternativeRules: InterviewHoursRules;
  message: string;
  round: number;
  /** offene Anfrage, die ersetzt wird („Neue Termine vorschlagen“) */
  replacesInterviewId?: string | null;
}

export interface SendResult { interviewId: string; candidateMailSent: boolean; recruiterMailSent: boolean; warning: string | null }
export interface MailPreview { subject: string; html: string; fromName: string }

/** Ruft eine Edge Function auf und reicht deren Fehlermeldung (message) durch. */
export async function callFunction<T>(name: string, body: Record<string, unknown>, fallback = 'Das hat nicht geklappt. Bitte erneut versuchen.'): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = fallback;
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      const detail = await ctx.clone().json().catch(() => null);
      if (typeof detail?.message === 'string') message = detail.message;
    }
    throw new Error(message);
  }
  return data as T;
}

export const interviewApi = {
  context: (submissionId: string) => callFunction<RequestContext>('interview-request', { action: 'context', submissionId }),
  availability: (input: AvailabilityInput) => callFunction<AvailabilityResult>('interview-request', { action: 'availability', ...input }),
  checkTime: (input: CheckTimeInput) => callFunction<CheckTimeResult>('interview-request', { action: 'check_time', ...input }),
  preview: (input: SendInput) => callFunction<MailPreview>('interview-request', { action: 'preview', ...input }),
  send: (input: SendInput) => callFunction<SendResult>('interview-request', { action: 'send', ...input }),
  confirmAlternative: (interviewId: string) => callFunction<{ scheduledAt: string }>('interview-request', { action: 'confirm_alternative', interviewId }),
  withdraw: (interviewId: string, reason: string) => callFunction<{ ok: true }>('interview-request', { action: 'withdraw', interviewId, reason }),
  inviteColleague: (input: InviteColleagueInput) => callFunction<InviteColleagueResult>('interview-request', { action: 'invite_colleague', ...input }),
};

export const calendarApi = {
  status: () => callFunction<CalendarStatus>('calendar-connect', { action: 'status' }),
  /** liefert die Microsoft-Anmeldeseite; der Rücksprung landet auf returnPath */
  connect: (returnPath: string) => callFunction<{ url: string }>('calendar-connect', { action: 'connect', returnPath }),
  disconnect: () => callFunction<{ ok: true }>('calendar-connect', { action: 'disconnect' }),
  requestIt: (itEmail: string) => callFunction<{ sent: boolean; link: string }>('calendar-connect', { action: 'it_request', itEmail }),
};

/** Interview-Zeiten liegen je Nutzer in client_interview_hours (RLS: nur eigene Zeile). */
export const hoursApi = {
  async load(userId: string): Promise<InterviewHoursRules> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).from('client_interview_hours').select('rules').eq('user_id', userId).maybeSingle();
    return normalizeRules(data?.rules);
  },
  async save(userId: string, rules: InterviewHoursRules): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from('client_interview_hours')
      .upsert({ user_id: userId, rules: normalizeRules(rules), updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error('Die Interview-Zeiten konnten nicht gespeichert werden.');
  },
};

// ---------------------------------------------------------------------------
// Kandidatenseite (/interview/respond/:token) — ohne Anmeldung, nur Token
// ---------------------------------------------------------------------------

export type CandidateState = 'open' | 'alternative_requested' | 'scheduled' | 'declined' | 'cancelled' | 'expired' | 'completed';

export interface CandidateView {
  state: CandidateState;
  companyName: string;
  jobTitle: string;
  durationMinutes: number;
  format: MeetingFormat;
  /** Vor Ort: Adresse, Hinweis, Kartenlink */
  onsite: { address: string; note: string | null; mapsUrl: string } | null;
  /** Telefon: hinterlegte Nummer des Kandidaten, maskiert („··· 11“), oder null */
  phoneOnFile: string | null;
  /** Telefon: bestätigte Rückrufnummer, maskiert */
  callPhone: string | null;
  message: string | null;
  /** Gesprächspartner auf Kundenseite: nur Name und Rolle, keine Mailadressen */
  interviewers: { name: string; title: string | null }[];
  recruiter: { name: string; phone: string | null; email: string | null } | null;
  candidateFirstName: string | null;
  /** Einwilligung nötig (erste Runde) oder schon erteilt */
  consentRequired: boolean;
  consentText: string;
  consentVersion: string;
  slots: { start: string; available: boolean }[];
  allowAlternative: boolean;
  /** book = Wahl wird sofort gebucht (Kalender verbunden), request = Unternehmen bestätigt */
  alternativeMode: 'book' | 'request';
  alternatives: { date: string; label: string; times: string[] }[];
  scheduled: { start: string; joinUrl: string | null; icsUrl: string | null } | null;
  requested: { start: string; message: string | null } | null;
  round: number;
}

export const CANDIDATE_CONSENT_VERSION = '2026-10-v1';

export const candidateApi = {
  load: (token: string) => callFunction<CandidateView>('get-interview-by-token', { token }),
  accept: (token: string, slotStart: string, consent: boolean, phone?: string) =>
    callFunction<CandidateView>('process-interview-response', { action: 'accept', token, slotStart, consentGiven: consent, consentTextVersion: CANDIDATE_CONSENT_VERSION, phone }),
  alternative: (token: string, start: string, message: string, consent: boolean, phone?: string) =>
    callFunction<CandidateView>('process-interview-response', { action: 'alternative', token, start, message, consentGiven: consent, consentTextVersion: CANDIDATE_CONSENT_VERSION, phone }),
  decline: (token: string, reason: string) =>
    callFunction<CandidateView>('process-interview-response', { action: 'decline', token, reason }),
};

// ---------------------------------------------------------------------------
// Bestätigung einer anderen Zeit direkt aus der Mail (/interview/bestaetigen/:token)
// ---------------------------------------------------------------------------

export interface ClientLinkView {
  state: 'open' | 'confirmed' | 'expired' | 'gone';
  jobTitle: string;
  candidateLabel: string;
  requestedStart: string | null;
  durationMinutes: number;
  candidateMessage: string | null;
  scheduledAt: string | null;
}

export const clientLinkApi = {
  peek: (token: string) => callFunction<ClientLinkView>('interview-client-link', { action: 'peek', token }),
  confirm: (token: string) => callFunction<ClientLinkView>('interview-client-link', { action: 'confirm', token }),
};

// ---------------------------------------------------------------------------
// Anzeige in deutscher Zeit (der Browser kann in einer anderen Zone stehen)
// ---------------------------------------------------------------------------

const TZ = 'Europe/Berlin';
export const fmtTime = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
export const fmtDayShort = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso)).replace(/\.(?=,)/, '').replace(/\.$/, '');
export const fmtDayLong = (iso: string) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
export const fmtRange = (iso: string, minutes: number) => `${fmtDayShort(iso)} · ${fmtTime(iso)}–${fmtTime(new Date(Date.parse(iso) + minutes * 60000).toISOString())}`;

/** Montag (YYYY-MM-DD, deutsche Zeit) der Woche, in der iso liegt, verschoben um weeks. */
export function weekStartOf(iso: string, weeks = 0): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(iso)).map((p) => [p.type, Number(p.value)]));
  const day = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const iso1 = ((day.getUTCDay() + 6) % 7);
  day.setUTCDate(day.getUTCDate() - iso1 + weeks * 7);
  return day.toISOString().slice(0, 10);
}

/** Puffer-Stufen, die der Kunde wählen kann; ältere Werte (z. B. 30) rasten auf die nächstkleinere Stufe ein. */
export const BUFFER_STEPS = [0, 5, 10, 15] as const;
const bufferStep = (minutes: number) => [...BUFFER_STEPS].reverse().find((s) => minutes >= s) ?? 0;

/** Gleiche Regeln wie serverseitig (_shared/interview-availability.ts normalizeRules). */
export function normalizeRules(raw: unknown): InterviewHoursRules {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<InterviewHoursRules>;
  const weekly: WeeklyWindows = {};
  const source = r.weekly && typeof r.weekly === 'object' ? r.weekly : DEFAULT_INTERVIEW_HOURS.weekly;
  for (const day of ['1', '2', '3', '4', '5', '6', '7'] as Weekday[]) {
    const list = (source as WeeklyWindows)[day];
    if (!Array.isArray(list)) continue;
    const valid = list.filter((w) => Array.isArray(w) && /^\d{2}:\d{2}$/.test(w[0]) && /^\d{2}:\d{2}$/.test(w[1]) && w[0] < w[1]);
    if (valid.length) weekly[day] = valid.map((w) => [w[0], w[1]] as [string, string]);
  }
  const num = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  };
  return {
    weekly,
    bufferMinutes: bufferStep(num(r.bufferMinutes, DEFAULT_INTERVIEW_HOURS.bufferMinutes, 0, 120)),
    minNoticeHours: num(r.minNoticeHours, DEFAULT_INTERVIEW_HOURS.minNoticeHours, 0, 24 * 14),
    horizonDays: num(r.horizonDays, DEFAULT_INTERVIEW_HOURS.horizonDays, 1, 60),
    skipHolidays: r.skipHolidays !== false,
    absences: Array.isArray(r.absences)
      ? r.absences.filter((a) => a && /^\d{4}-\d{2}-\d{2}$/.test(a.from) && /^\d{4}-\d{2}-\d{2}$/.test(a.to) && a.from <= a.to)
      : [],
  };
}

/** Kurzbeschreibung der Interview-Zeiten, z. B. „Mo–Do 09–12 und 14–17 · Fr 09–12“. */
export function describeHours(rules: InterviewHoursRules): string {
  const groups: { days: Weekday[]; key: string }[] = [];
  for (const d of ['1', '2', '3', '4', '5', '6', '7'] as Weekday[]) {
    const windows = rules.weekly[d];
    if (!windows?.length) continue;
    const key = windows.map(([a, b]) => `${a.replace(':00', '')}–${b.replace(':00', '')}`).join(' und ');
    const last = groups[groups.length - 1];
    if (last && last.key === key && Number(last.days[last.days.length - 1]) === Number(d) - 1) last.days.push(d);
    else groups.push({ days: [d], key });
  }
  if (!groups.length) return 'keine Zeiten festgelegt';
  return groups.map((g) => `${WEEKDAY_LABELS[g.days[0]]}${g.days.length > 1 ? `–${WEEKDAY_LABELS[g.days[g.days.length - 1]]}` : ''} ${g.key}`).join(' · ');
}

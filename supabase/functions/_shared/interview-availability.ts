// Berechnet, welche Interview-Zeiten passen: aus den Interview-Zeiten des
// Kunden (Wochenfenster, Puffer, Vorlauf, Feiertage, Abwesenheit), den
// belegten Zeiten aus Outlook und den schon gebuchten Matchunt-Interviews.
// Reine Funktionen ohne Datenbank, damit sie getestet werden können.
import { berlinDateKey, berlinLocalToUtc, berlinParts, nextDateKey } from './interview-time.ts';

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

export interface Interval { start: number; end: number }

export interface ScheduleParticipant {
  key: string;
  name: string;
  required: boolean;
  /** null = Kalender nicht sichtbar (z. B. extern) */
  busy: Interval[] | null;
  /** schon gebuchte Matchunt-Interviews dieser Person */
  booked?: Interval[];
}

export type SlotStatus = 'all' | 'required' | 'busy' | 'booked';

export interface ScheduleSlot {
  start: string;
  status: SlotStatus;
  /** optionale Personen, die zu dieser Zeit belegt sind */
  missing: string[];
  /** Personen ohne sichtbaren Kalender */
  unknown: string[];
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};

function easterUtc(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return Date.UTC(year, Math.floor(n / 31) - 1, (n % 31) + 1);
}

/** Gesetzliche Feiertage in Bayern (wie beim Vertragsfristen-Rechner). */
export function isBavarianHoliday(dateKey: string): boolean {
  const fixed = ['01-01', '01-06', '05-01', '08-15', '10-03', '11-01', '12-25', '12-26'];
  if (fixed.includes(dateKey.slice(5))) return true;
  const [y, m, d] = dateKey.split('-').map(Number);
  const day = Date.UTC(y, m - 1, d);
  return [-2, 1, 39, 50, 60].some((offset) => easterUtc(y) + offset * 86400000 === day);
}

function inAbsence(dateKey: string, absences: InterviewHoursRules['absences']) {
  return absences.some((a) => dateKey >= a.from && dateKey <= a.to);
}

/** Zeitfenster aus den Interview-Zeiten im Zeitraum [fromMs, toMs), in UTC. */
export function windowIntervals(rules: InterviewHoursRules, fromMs: number, toMs: number): Interval[] {
  const out: Interval[] = [];
  let key = berlinDateKey(fromMs);
  const lastKey = berlinDateKey(toMs);
  for (let guard = 0; key <= lastKey && guard < 400; guard++, key = nextDateKey(key)) {
    const [y, m, d] = key.split('-').map(Number);
    const weekday = String(berlinParts(berlinLocalToUtc(y, m, d, 12, 0)).weekday) as Weekday;
    if (rules.skipHolidays && isBavarianHoliday(key)) continue;
    if (inAbsence(key, rules.absences)) continue;
    for (const [from, to] of rules.weekly[weekday] ?? []) {
      const s = berlinLocalToUtc(y, m, d, Math.floor(toMinutes(from) / 60), toMinutes(from) % 60);
      const e = berlinLocalToUtc(y, m, d, Math.floor(toMinutes(to) / 60), toMinutes(to) % 60);
      const start = Math.max(s, fromMs), end = Math.min(e, toMs);
      if (end > start) out.push({ start, end });
    }
  }
  return out;
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Schrittweite der angebotenen Startzeiten: kurze Gespräche halbstündlich, sonst stündlich. */
export function stepFor(durationMinutes: number) {
  return durationMinutes <= 45 ? 30 : 60;
}

export interface SlotQuery {
  rules: InterviewHoursRules;
  durationMinutes: number;
  fromMs: number;
  toMs: number;
  nowMs: number;
  participants: ScheduleParticipant[];
  stepMinutes?: number;
}

/**
 * Alle Startzeiten in den Interview-Zeiten, in die das Gespräch samt Puffer
 * passt, mit Status: alle frei / alle Pflicht-Teilnehmer frei / belegt.
 */
export function scheduleSlots(q: SlotQuery): ScheduleSlot[] {
  const step = (q.stepMinutes ?? stepFor(q.durationMinutes)) * 60000;
  const dur = q.durationMinutes * 60000;
  const buffer = q.rules.bufferMinutes * 60000;
  const earliest = q.nowMs + q.rules.minNoticeHours * 3600000;
  const slots: ScheduleSlot[] = [];
  for (const w of windowIntervals(q.rules, q.fromMs, q.toMs)) {
    // Startzeiten auf volle Schritte in deutscher Zeit ausrichten
    const p = berlinParts(w.start);
    const minuteOfDay = p.hour * 60 + p.minute;
    const stepMin = step / 60000;
    let start = w.start + ((stepMin - (minuteOfDay % stepMin)) % stepMin) * 60000;
    for (; start + dur <= w.end; start += step) {
      if (start < earliest) continue;
      const slot: Interval = { start, end: start + dur };
      const padded: Interval = { start: start - buffer, end: start + dur + buffer };
      let requiredBusy = false;
      let requiredBooked = false;
      const missing: string[] = [];
      const unknown: string[] = [];
      for (const person of q.participants) {
        const isBooked = (person.booked ?? []).some((b) => overlaps(b, padded));
        // Der Puffer des Kunden gilt vor und nach jedem Termin, auch vor/nach Outlook-Terminen
        const isBusy = person.busy?.some((b) => overlaps(b, padded)) ?? false;
        if (person.busy === null && !isBooked) unknown.push(person.name);
        if (!isBooked && !isBusy) continue;
        if (!person.required) missing.push(person.name);
        else if (isBusy) requiredBusy = true;
        else requiredBooked = true;
      }
      const status: SlotStatus = requiredBusy ? 'busy' : requiredBooked ? 'booked' : missing.length ? 'required' : 'all';
      slots.push({ start: new Date(start).toISOString(), status, missing, unknown });
    }
  }
  return slots;
}

/** Zeiten, die ein Kandidat als andere Zeit wählen darf (alle Pflicht-Teilnehmer frei, keine bereits vorgeschlagene Zeit). */
export function alternativeSlots(q: SlotQuery & { exclude?: string[] }): ScheduleSlot[] {
  const excluded = new Set((q.exclude ?? []).map((iso) => Date.parse(iso)));
  return scheduleSlots(q).filter((s) => (s.status === 'all' || s.status === 'required') && !excluded.has(Date.parse(s.start)));
}

/** Prüft eine konkrete Zeit, z. B. bevor eine Wahl des Kandidaten gebucht wird. */
export function isSlotStillFree(q: SlotQuery, startIso: string): boolean {
  const t = Date.parse(startIso);
  return scheduleSlots({ ...q, fromMs: t - 3600000, toMs: t + q.durationMinutes * 60000 + 3600000 })
    .some((s) => Date.parse(s.start) === t && (s.status === 'all' || s.status === 'required'));
}

/** Puffer-Stufen, die der Kunde wählen kann; ältere Werte (z. B. 30) rasten auf die nächstkleinere Stufe ein. */
export const BUFFER_STEPS = [0, 5, 10, 15] as const;
const bufferStep = (minutes: number) => [...BUFFER_STEPS].reverse().find((s) => minutes >= s) ?? 0;

/** Liest gespeicherte Interview-Zeiten robust ein und füllt Lücken mit Standardwerten. */
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

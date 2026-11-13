// Reine Hilfsfunktionen für das Kundenfenster „Interview anfragen“
// (src/components/interview/request). Alles in deutscher Zeit, unabhängig
// davon, in welcher Zeitzone der Browser steht.
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import {
  WEEKDAY_LABELS,
  fmtTime,
  weekStartOf,
  type AttendeeDraft,
  type AvailabilityResult,
  type ScheduleSlot,
  type Weekday,
} from './interviewScheduling';

const TZ = 'Europe/Berlin';
// Anzeige-Texte im Namespace clientInterviews, beim Aufruf gelesen (README Regel 7).
const tx = (key: string, options?: Record<string, unknown>) => i18n.t(`clientInterviews:util.${key}`, options) as string;

const wallClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function berlinParts(utcMs: number) {
  const p = Object.fromEntries(
    wallClock
      .formatToParts(new Date(utcMs))
      .filter((x) => x.type !== 'literal')
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
  return p;
}

/** Abstand der deutschen Zeit zu UTC in Millisekunden zum Zeitpunkt utcMs (+1 h Winter, +2 h Sommer). */
export function berlinOffsetMs(utcMs: number): number {
  const p = berlinParts(utcMs);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/**
 * Uhrzeit in deutscher Zeit (Kalendertag YYYY-MM-DD + HH:MM) als ISO-Zeitpunkt in UTC.
 * Sommer-/Winterzeit wird über Intl ermittelt. Ungültige Eingaben → null.
 */
export function berlinLocalToIso(dateKey: string, hhmm: string): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const tm = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!dm || !tm) return null;
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (hour > 23 || minute > 59) return null;
  const target = Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hour, minute);
  // Zwei Durchgänge, damit der Versatz am Tag der Zeitumstellung stimmt.
  let utc = target - berlinOffsetMs(target);
  utc = target - berlinOffsetMs(utc);
  return new Date(utc).toISOString();
}

/** Kalendertag (YYYY-MM-DD) in deutscher Zeit. */
export function berlinDateKey(iso: string): string {
  const p = berlinParts(Date.parse(iso));
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** ISO-Wochentag (1 = Montag … 7 = Sonntag) eines Kalendertags YYYY-MM-DD. */
export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1;
}

/** ISO-Wochentag in deutscher Zeit. */
export function berlinWeekday(iso: string): number {
  return weekdayOfKey(berlinDateKey(iso));
}

/** Kalendertag + n Tage (YYYY-MM-DD). */
/** „heute“, „morgen“, „übermorgen“, „in 5 Tagen“ – nach Kalendertagen in deutscher Zeit. */
export function relativeDay(iso: string, nowIso: string = new Date().toISOString()): string {
  const days = Math.round((Date.parse(berlinDateKey(iso)) - Date.parse(berlinDateKey(nowIso))) / 86_400_000);
  if (days < 0) return tx('past');
  if (days === 0) return tx('today');
  if (days === 1) return tx('tomorrow');
  if (days === 2) return tx('dayAfter');
  return tx('inDays', { count: days });
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Startwoche des Rasters: diese Woche, ab Freitag (deutsche Zeit) die nächste. */
export function initialWeekStart(nowIso: string): string {
  return weekStartOf(nowIso, berlinWeekday(nowIso) >= 5 ? 1 : 0);
}

const monthLong = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(i18n.language), { timeZone: 'UTC', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)));
};
const dayNum = (dateKey: string) => Number(dateKey.slice(8, 10));

/** „5.–9. Oktober“, über Monatsgrenzen „28. September – 2. Oktober“. */
export function weekRangeLabel(fromKey: string, toKey: string): string {
  if (fromKey.slice(0, 7) === toKey.slice(0, 7)) {
    return tx('weekSameMonth', { from: dayNum(fromKey), to: dayNum(toKey), month: monthLong(toKey) });
  }
  return tx('weekTwoMonths', { from: dayNum(fromKey), fromMonth: monthLong(fromKey), to: dayNum(toKey), toMonth: monthLong(toKey) });
}

/** Spaltenkopf „Mo 5.10.“ für einen Kalendertag YYYY-MM-DD. */
export function dayHeaderLabel(dateKey: string): string {
  const wd = String(weekdayOfKey(dateKey)) as Weekday;
  return tx('dayHeader', { wd: WEEKDAY_LABELS[wd], d: dayNum(dateKey), m: Number(dateKey.slice(5, 7)) });
}

/** „1. Oktober“ in deutscher Zeit. */
export function fmtDateDayMonth(iso: string): string {
  return new Intl.DateTimeFormat(intlLocale(i18n.language), { timeZone: TZ, day: 'numeric', month: 'long' }).format(new Date(iso));
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Beschriftung einer Slot-Kachel. */
export function slotText(slot: ScheduleSlot, peopleCount: number): string {
  const time = fmtTime(slot.start);
  if (slot.status === 'busy') return tx('slotBusy', { time });
  if (slot.status === 'booked') return tx('slotBooked', { time });
  if (slot.status === 'required') {
    return slot.missing.length ? tx('slotWithout', { time, names: slot.missing.map(firstName).join(', ') }) : time;
  }
  return peopleCount > 1 ? tx('slotAll', { time }) : time;
}

/** Eindeutiger Schlüssel eines Teilnehmers (Nutzer-ID, sonst E-Mail). */
export function attendeeIdentity(a: Pick<AttendeeDraft, 'userId' | 'email'>): string {
  return a.userId || a.email.trim().toLowerCase();
}

export function sameAttendee(
  a: Pick<AttendeeDraft, 'userId' | 'email'>,
  b: Pick<AttendeeDraft, 'userId' | 'email'>,
): boolean {
  if (a.userId && b.userId) return a.userId === b.userId;
  return a.email.trim().toLowerCase() === b.email.trim().toLowerCase();
}

/** Person aus dem Verfügbarkeits-Ergebnis zu einem Teilnehmer (Schlüssel = Nutzer-ID oder E-Mail). */
export function personFor(
  people: AvailabilityResult['people'] | undefined,
  a: AttendeeDraft,
): AvailabilityResult['people'][number] | null {
  if (!people?.length) return null;
  const email = a.email.trim().toLowerCase();
  const byKey = people.find((p) => (a.userId && p.key === a.userId) || p.key.trim().toLowerCase() === email);
  if (byKey) return byKey;
  const byName = people.filter((p) => p.name === a.name);
  return byName.length === 1 ? byName[0] : null;
}

/** „Interview anfragen“, ab Runde 2 „Zweites Interview anfragen“ usw. */
export function roundTitle(round: number): string {
  if (!round || round <= 1) return tx('round1');
  return round <= 5 ? tx(`round${round}`) : tx('roundN', { n: round });
}

/** „A“, „A und B“, „A, B und C“ */
export function joinNames(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  return tx('joinNames', { list: list.slice(0, -1).join(', '), last: list[list.length - 1] });
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Zeitfenster „HH:MM“ gültig und Beginn vor Ende. */
export function isValidWindow(from: string, to: string): boolean {
  return /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from < to;
}

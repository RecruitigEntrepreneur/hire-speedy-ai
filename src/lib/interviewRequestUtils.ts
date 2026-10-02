// Reine Hilfsfunktionen für das Kundenfenster „Interview anfragen“
// (src/components/interview/request). Alles in deutscher Zeit, unabhängig
// davon, in welcher Zeitzone der Browser steht.
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
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long' }).format(new Date(Date.UTC(y, m - 1, d)));
};
const dayNum = (dateKey: string) => Number(dateKey.slice(8, 10));

/** „5.–9. Oktober“, über Monatsgrenzen „28. September – 2. Oktober“. */
export function weekRangeLabel(fromKey: string, toKey: string): string {
  if (fromKey.slice(0, 7) === toKey.slice(0, 7)) {
    return `${dayNum(fromKey)}.–${dayNum(toKey)}. ${monthLong(toKey)}`;
  }
  return `${dayNum(fromKey)}. ${monthLong(fromKey)} – ${dayNum(toKey)}. ${monthLong(toKey)}`;
}

/** Spaltenkopf „Mo 5.10.“ für einen Kalendertag YYYY-MM-DD. */
export function dayHeaderLabel(dateKey: string): string {
  const wd = String(weekdayOfKey(dateKey)) as Weekday;
  return `${WEEKDAY_LABELS[wd]} ${dayNum(dateKey)}.${Number(dateKey.slice(5, 7))}.`;
}

/** „1. Oktober“ in deutscher Zeit. */
export function fmtDateDayMonth(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: TZ, day: 'numeric', month: 'long' }).format(new Date(iso));
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** Beschriftung einer Slot-Kachel. */
export function slotText(slot: ScheduleSlot, peopleCount: number): string {
  const time = fmtTime(slot.start);
  if (slot.status === 'busy') return `${time} · belegt`;
  if (slot.status === 'booked') return `${time} · Interview`;
  if (slot.status === 'required') {
    return slot.missing.length ? `${time} · ohne ${slot.missing.map(firstName).join(', ')}` : time;
  }
  return peopleCount > 1 ? `${time} · alle` : time;
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

const ORDINALS = ['', '', 'Zweites', 'Drittes', 'Viertes', 'Fünftes'];

/** „Interview anfragen“, ab Runde 2 „Zweites Interview anfragen“ usw. */
export function roundTitle(round: number): string {
  if (!round || round <= 1) return 'Interview anfragen';
  return `${ORDINALS[round] ?? `${round}.`} Interview anfragen`;
}

/** „A“, „A und B“, „A, B und C“ */
export function joinNames(names: string[]): string {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? '';
  return `${list.slice(0, -1).join(', ')} und ${list[list.length - 1]}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Zeitfenster „HH:MM“ gültig und Beginn vor Ende. */
export function isValidWindow(from: string, to: string): boolean {
  return /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to) && from < to;
}

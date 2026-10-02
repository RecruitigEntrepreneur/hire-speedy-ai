// Zeitrechnung für Interviews: gespeichert wird immer UTC, angezeigt und
// geplant immer in deutscher Zeit (Europe/Berlin). Die Edge Runtime läuft in
// UTC, deshalb nie getHours()/getDay() auf Termine anwenden.
export const INTERVIEW_TZ = 'Europe/Berlin';

export interface BerlinParts { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number }

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: INTERVIEW_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** Bestandteile eines Zeitpunkts in deutscher Zeit; weekday nach ISO (1 = Montag … 7 = Sonntag). */
export function berlinParts(ms: number): BerlinParts {
  const p = Object.fromEntries(partsFormat.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  const utcDay = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second, weekday: ((utcDay + 6) % 7) + 1 };
}

/** Wandelt eine Uhrzeit in deutscher Zeit in einen UTC-Zeitstempel (Sommer-/Winterzeit korrekt). */
export function berlinLocalToUtc(year: number, month: number, day: number, hour: number, minute: number): number {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = berlinParts(guess);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (shown === target) break;
    guess += target - shown;
  }
  return guess;
}

/** Kalendertag in deutscher Zeit als YYYY-MM-DD. */
export function berlinDateKey(ms: number): string {
  const p = berlinParts(ms);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Nächster Kalendertag (YYYY-MM-DD) nach dem gegebenen Tag. */
export function nextDateKey(key: string, days = 1): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const ms = (iso: string | number) => (typeof iso === 'number' ? iso : Date.parse(iso));

/** „Dienstag, 6. Oktober 2026“ */
export function formatBerlinDateLong(iso: string | number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: INTERVIEW_TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ms(iso)));
}

/** „Di, 6. Okt“ */
export function formatBerlinDateShort(iso: string | number): string {
  const s = new Intl.DateTimeFormat('de-DE', { timeZone: INTERVIEW_TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ms(iso)));
  return s.replace(/\.(?=,)/, '').replace(/\.$/, '');
}

/** „10:00“ */
export function formatBerlinTime(iso: string | number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: INTERVIEW_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms(iso)));
}

/** „Di, 6. Okt · 10:00–11:00“ */
export function formatBerlinRange(iso: string | number, durationMinutes: number): string {
  const start = ms(iso);
  return `${formatBerlinDateShort(start)} · ${formatBerlinTime(start)}–${formatBerlinTime(start + durationMinutes * 60000)}`;
}

/** Sommer- oder Winterzeit als Kürzel für Hinweise in Mails („MESZ“ / „MEZ“). */
export function berlinZoneLabel(iso: string | number): string {
  const p = berlinParts(ms(iso));
  const offset = (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms(iso)) / 3600000;
  return Math.round(offset) === 2 ? 'MESZ' : 'MEZ';
}

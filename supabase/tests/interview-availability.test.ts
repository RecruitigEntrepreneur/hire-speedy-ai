import { alternativeSlots, DEFAULT_INTERVIEW_HOURS, isBavarianHoliday, isSlotStillFree, normalizeRules, scheduleSlots, windowIntervals } from '../functions/_shared/interview-availability.ts';
import { berlinLocalToUtc, formatBerlinDateShort, formatBerlinRange, formatBerlinTime, berlinZoneLabel } from '../functions/_shared/interview-time.ts';
const assert = (v: unknown, m = 'Assertion failed') => { if (!v) throw Error(m); };
const eq = (a: unknown, b: unknown, m = '') => { if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(`${m} erwartet ${JSON.stringify(b)}, war ${JSON.stringify(a)}`); };

// Freitag, 2. Oktober 2026, 14:05 in Berlin
const NOW = berlinLocalToUtc(2026, 10, 2, 14, 5);
const MON = berlinLocalToUtc(2026, 10, 5, 0, 0);
const SAT = berlinLocalToUtc(2026, 10, 10, 0, 0);
const at = (d: number, h: number, m = 0) => berlinLocalToUtc(2026, 10, d, h, m);
const iso = (d: number, h: number, m = 0) => new Date(at(d, h, m)).toISOString();

Deno.test('Berlin-Zeit: 10:00 im Oktober ist 08:00 UTC, nach der Zeitumstellung 09:00 UTC', () => {
  eq(new Date(at(6, 10)).toISOString(), '2026-10-06T08:00:00.000Z');
  eq(new Date(berlinLocalToUtc(2026, 10, 27, 10, 0)).toISOString(), '2026-10-27T09:00:00.000Z');
  eq(formatBerlinTime('2026-10-06T08:00:00.000Z'), '10:00');
  eq(formatBerlinRange('2026-10-06T08:00:00.000Z', 60), 'Di, 6. Okt · 10:00–11:00');
  eq(berlinZoneLabel('2026-10-06T08:00:00.000Z'), 'MESZ');
  eq(berlinZoneLabel('2026-12-01T09:00:00.000Z'), 'MEZ');
  assert(formatBerlinDateShort('2026-10-06T08:00:00.000Z').startsWith('Di'));
});

Deno.test('Feiertage Bayern: Tag der Deutschen Einheit, Allerheiligen, Fronleichnam', () => {
  assert(isBavarianHoliday('2026-10-03'));
  assert(isBavarianHoliday('2026-11-01'));
  assert(isBavarianHoliday('2026-06-04'), 'Fronleichnam 2026');
  assert(!isBavarianHoliday('2026-10-06'));
});

Deno.test('Wochenfenster: Mo–Fr laut Standard, Wochenende leer', () => {
  const w = windowIntervals(DEFAULT_INTERVIEW_HOURS, MON, SAT);
  eq(w.length, 9, 'Mo–Do je 2 Fenster, Fr 1');
  eq(new Date(w[0].start).toISOString(), iso(5, 9));
  eq(new Date(w[0].end).toISOString(), iso(5, 12));
});

Deno.test('Slots: 60 Minuten stündlich, Vorlauf 24 h und Puffer greifen', () => {
  const slots = scheduleSlots({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: NOW, toMs: SAT, nowMs: NOW, participants: [] });
  eq(slots[0].start, iso(5, 9), 'Wochenende übersprungen, Montag 9 Uhr zuerst');
  assert(slots.every((s) => s.status === 'all'));
  assert(!slots.some((s) => s.start === iso(5, 12)), '12 Uhr liegt außerhalb des Fensters');
  assert(slots.some((s) => s.start === iso(5, 16)), '16–17 Uhr passt genau');
});

Deno.test('Slots: Pflicht belegt = belegt, optional belegt = gelb mit Namen, extern = unbekannt', () => {
  const participants = [
    { key: 'me', name: 'Marko B.', required: true, busy: [{ start: at(6, 14), end: at(6, 15) }] },
    { key: 'julia', name: 'Julia S.', required: true, busy: [] },
    { key: 'tom', name: 'Tom K.', required: false, busy: [{ start: at(6, 10), end: at(6, 11) }] },
    { key: 'ext', name: 'Dr. Weiß', required: false, busy: null },
  ];
  const slots = scheduleSlots({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: at(6, 0), toMs: at(7, 0), nowMs: NOW, participants });
  const by = (h: number) => slots.find((s) => s.start === iso(6, h))!;
  eq(by(14).status, 'busy');
  eq(by(10).status, 'required');
  eq(by(10).missing, ['Tom K.']);
  eq(by(9).status, 'all');
  eq(by(9).unknown, ['Dr. Weiß']);
});

Deno.test('Slots: gebuchtes Matchunt-Interview sperrt inklusive Puffer', () => {
  const participants = [{ key: 'me', name: 'Marko B.', required: true, busy: [], booked: [{ start: at(6, 14), end: at(6, 15) }] }];
  const slots = scheduleSlots({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: at(6, 0), toMs: at(7, 0), nowMs: NOW, participants });
  eq(slots.find((s) => s.start === iso(6, 14))!.status, 'booked');
  eq(slots.find((s) => s.start === iso(6, 15))!.status, 'booked', '15 Uhr scheitert am 15-Minuten-Puffer');
  eq(slots.find((s) => s.start === iso(6, 16))!.status, 'all');
});

Deno.test('Alternativen: ohne die schon vorgeschlagenen Zeiten, nur frei', () => {
  const participants = [{ key: 'me', name: 'Marko B.', required: true, busy: [{ start: at(5, 9), end: at(5, 10) }] }];
  const alts = alternativeSlots({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: at(5, 0), toMs: at(6, 0), nowMs: NOW, participants, exclude: [iso(5, 10)] });
  assert(!alts.some((s) => s.start === iso(5, 9)), 'belegt');
  assert(!alts.some((s) => s.start === iso(5, 10)), 'schon vorgeschlagen');
  assert(alts.some((s) => s.start === iso(5, 11)));
  assert(isSlotStillFree({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: 0, toMs: 0, nowMs: NOW, participants }, iso(5, 11)));
  assert(!isSlotStillFree({ rules: DEFAULT_INTERVIEW_HOURS, durationMinutes: 60, fromMs: 0, toMs: 0, nowMs: NOW, participants }, iso(5, 9)));
});

Deno.test('Feiertag und Abwesenheit fallen weg', () => {
  const rules = normalizeRules({ ...DEFAULT_INTERVIEW_HOURS, weekly: { ...DEFAULT_INTERVIEW_HOURS.weekly, '6': [['09:00', '12:00']] }, absences: [{ from: '2026-10-06', to: '2026-10-06' }] });
  const w = windowIntervals(rules, at(3, 0), at(7, 0));
  assert(!w.some((x) => new Date(x.start).toISOString() === iso(3, 9)), 'Samstag 3.10. ist Feiertag');
  assert(!w.some((x) => new Date(x.start).toISOString() === iso(6, 9)), 'Abwesenheit');
  assert(w.some((x) => new Date(x.start).toISOString() === iso(5, 9)));
});

Deno.test('normalizeRules verwirft kaputte Fenster und begrenzt Zahlen', () => {
  const r = normalizeRules({ weekly: { '1': [['10:00', '09:00'], ['08:00', '10:00']], '9': [['x', 'y']] }, bufferMinutes: 999, horizonDays: -3 });
  eq(r.weekly, { '1': [['08:00', '10:00']] });
  eq(r.bufferMinutes, 120);
  eq(r.horizonDays, 1);
  eq(normalizeRules(null).weekly, DEFAULT_INTERVIEW_HOURS.weekly);
});

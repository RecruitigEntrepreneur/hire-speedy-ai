import { describe, expect, it } from 'vitest';
import {
  addDays,
  attendeeIdentity,
  berlinDateKey,
  berlinLocalToIso,
  dayHeaderLabel,
  initialWeekStart,
  joinNames,
  personFor,
  roundTitle,
  sameAttendee,
  slotText,
  weekRangeLabel,
} from './interviewRequestUtils';

describe('berlinLocalToIso', () => {
  it('rechnet Sommerzeit (+2 h) korrekt um', () => {
    expect(berlinLocalToIso('2026-10-06', '10:00')).toBe('2026-10-06T08:00:00.000Z');
  });
  it('rechnet Winterzeit (+1 h) korrekt um', () => {
    expect(berlinLocalToIso('2026-11-02', '10:00')).toBe('2026-11-02T09:00:00.000Z');
  });
  it('stimmt am Tag der Zeitumstellung', () => {
    // 25.10.2026: um 03:00 Sommerzeit wird auf 02:00 Winterzeit zurückgestellt
    expect(berlinLocalToIso('2026-10-25', '10:00')).toBe('2026-10-25T09:00:00.000Z');
    // 29.03.2026: um 02:00 wird auf 03:00 vorgestellt
    expect(berlinLocalToIso('2026-03-29', '10:00')).toBe('2026-03-29T08:00:00.000Z');
  });
  it('lehnt ungültige Eingaben ab', () => {
    expect(berlinLocalToIso('2026-10-06', '25:00')).toBeNull();
    expect(berlinLocalToIso('06.10.2026', '10:00')).toBeNull();
    expect(berlinLocalToIso('2026-10-06', '')).toBeNull();
  });
});

describe('Kalendertage in deutscher Zeit', () => {
  it('ordnet kurz nach Mitternacht dem deutschen Tag zu', () => {
    expect(berlinDateKey('2026-10-05T22:30:00.000Z')).toBe('2026-10-06');
  });
  it('addiert Tage über Monatsgrenzen', () => {
    expect(addDays('2026-09-28', 4)).toBe('2026-10-02');
  });
  it('startet unter der Woche mit dieser, ab Freitag mit der nächsten Woche', () => {
    expect(initialWeekStart('2026-10-01T10:00:00.000Z')).toBe('2026-09-28'); // Donnerstag
    expect(initialWeekStart('2026-10-02T10:00:00.000Z')).toBe('2026-10-05'); // Freitag
    expect(initialWeekStart('2026-10-04T21:00:00.000Z')).toBe('2026-10-05'); // Sonntag
    // Sonntag 23:30 deutscher Zeit ist in UTC noch Sonntag, Montag 00:30 deutscher Zeit schon Montag
    expect(initialWeekStart('2026-10-04T22:30:00.000Z')).toBe('2026-10-05');
  });
});

describe('Beschriftungen', () => {
  it('Wochenbereich', () => {
    expect(weekRangeLabel('2026-10-05', '2026-10-09')).toBe('5.–9. Oktober');
    expect(weekRangeLabel('2026-09-28', '2026-10-02')).toBe('28. September – 2. Oktober');
  });
  it('Spaltenkopf', () => {
    expect(dayHeaderLabel('2026-10-06')).toBe('Di 6.10.');
  });
  it('Slot-Kacheln', () => {
    const start = '2026-10-06T08:00:00.000Z';
    expect(slotText({ start, status: 'all', missing: [], unknown: [] }, 2)).toBe('10:00 · alle');
    expect(slotText({ start, status: 'all', missing: [], unknown: [] }, 1)).toBe('10:00');
    expect(slotText({ start, status: 'required', missing: ['Tom Berger'], unknown: [] }, 3)).toBe('10:00 · ohne Tom');
    expect(slotText({ start, status: 'busy', missing: [], unknown: [] }, 2)).toBe('10:00 · belegt');
    expect(slotText({ start, status: 'booked', missing: [], unknown: [] }, 2)).toBe('10:00 · Interview');
  });
  it('Rundentitel', () => {
    expect(roundTitle(1)).toBe('Interview anfragen');
    expect(roundTitle(2)).toBe('Zweites Interview anfragen');
    expect(roundTitle(3)).toBe('Drittes Interview anfragen');
  });
  it('Namensliste', () => {
    expect(joinNames(['Sie'])).toBe('Sie');
    expect(joinNames(['Sie', 'Tom'])).toBe('Sie und Tom');
    expect(joinNames(['Sie', 'Tom', 'Anna'])).toBe('Sie, Tom und Anna');
  });
});

describe('Teilnehmer', () => {
  const tom = { userId: 'u-tom', email: 'Tom@Firma.de', name: 'Tom Berger', required: true, kind: 'client_user' as const };
  const ext = { userId: null, email: 'anna@extern.de', name: 'Anna Extern', required: false, kind: 'external' as const };

  it('erkennt gleiche Personen über ID oder E-Mail', () => {
    expect(attendeeIdentity(tom)).toBe('u-tom');
    expect(attendeeIdentity(ext)).toBe('anna@extern.de');
    expect(sameAttendee(ext, { email: ' ANNA@extern.de ' })).toBe(true);
    expect(sameAttendee(tom, { userId: 'u-other', email: 'tom@firma.de' })).toBe(false);
  });

  it('findet die Person im Verfügbarkeits-Ergebnis', () => {
    const people = [
      { key: 'u-tom', name: 'Tom Berger', required: true, visible: true },
      { key: 'anna@extern.de', name: 'Anna Extern', required: false, visible: false },
    ];
    expect(personFor(people, tom)?.visible).toBe(true);
    expect(personFor(people, ext)?.visible).toBe(false);
    expect(personFor([], tom)).toBeNull();
  });
});

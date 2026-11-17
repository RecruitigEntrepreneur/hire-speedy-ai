import { describe, expect, it } from 'vitest';
import { buendeln, headhunterAus, stelleAus } from './hinweisBuendel';

const h = (id: string, type: string, message = '', is_read = true) => ({ id, type, message, is_read });

describe('buendeln', () => {
  it('fasst direkt aufeinanderfolgende Suchstarts zusammen', () => {
    const r = buendeln([h('1', 'search_started'), h('2', 'search_started'), h('3', 'search_started'), h('4', 'recruiter_nudge')]);
    expect(r.map((e) => e.art)).toEqual(['buendel', 'einzeln']);
    expect(r[0].art === 'buendel' && r[0].hinweise.map((x) => x.id)).toEqual(['1', '2', '3']);
  });

  it('lässt eine einzelne Meldung einzeln', () => {
    const r = buendeln([h('1', 'search_started'), h('2', 'pause_ended'), h('3', 'search_started')]);
    expect(r.map((e) => e.art)).toEqual(['einzeln', 'einzeln', 'einzeln']);
  });

  it('bündelt keine Meldungen, bei denen jemand etwas tun muss', () => {
    const r = buendeln([h('1', 'recruiter_nudge'), h('2', 'recruiter_nudge'), h('3', 'offer_answer'), h('4', 'offer_answer')]);
    expect(r.every((e) => e.art === 'einzeln')).toBe(true);
  });

  it('hält die Reihenfolge und trennt nicht benachbarte Gruppen', () => {
    const r = buendeln([h('1', 'pause_ended'), h('2', 'pause_ended'), h('3', 'offer_answer'), h('4', 'pause_ended'), h('5', 'pause_ended')]);
    expect(r.map((e) => e.key)).toEqual(['b-1', '3', 'b-4']);
  });
});

describe('Text lesen', () => {
  it('findet Headhunter und Stelle im Suchstart-Text', () => {
    const m = 'Julia Hartmann (Julia Hartmann Recruiting (Test)) sucht jetzt für „Lohnbuchhalter (m/w/d)“.';
    expect(headhunterAus(m)).toBe('Julia Hartmann');
    expect(stelleAus(m)).toBe('Lohnbuchhalter');
  });

  it('kommt ohne Firma und ohne Stelle aus', () => {
    expect(headhunterAus('Anna Weber sucht jetzt für „CFO“.')).toBe('Anna Weber');
    expect(stelleAus('„TEST Contracting live (m/w/d)“ ist wieder aktiv.')).toBe('TEST Contracting live');
    expect(stelleAus('ohne Anführungszeichen')).toBeNull();
    expect(headhunterAus(null)).toBeNull();
  });
});

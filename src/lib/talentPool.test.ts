import { describe, expect, it } from 'vitest';
import { POOL_AUFGABEN_PRO_TAG, naechsterEintrag, aufWerktag, istFaellig, naechsterKontakt, plusMonate, poolAufgabenHeute, tageFaellig } from './talentPool';

const e = (id: string, next: string | null, extra: Partial<{ is_active: boolean; opted_out_at: string | null }> = {}) =>
  ({ candidate_id: id, next_contact_at: next, is_active: true, opted_out_at: null, ...extra });

describe('talentPool', () => {
  it('plusMonate hält das Monatsende', () => {
    expect(plusMonate(new Date(2027, 0, 31), 1).getDate()).toBe(28);
    expect(plusMonate(new Date(2026, 10, 25), 3).toDateString()).toBe(new Date(2027, 1, 25).toDateString());
  });

  it('Wochenende rutscht auf Montag', () => {
    expect(aufWerktag(new Date(2026, 10, 28)).getDay()).toBe(1); // Samstag
    expect(aufWerktag(new Date(2026, 10, 29)).getDay()).toBe(1); // Sonntag
    expect(aufWerktag(new Date(2026, 10, 25)).getDate()).toBe(25);
  });

  it('nächster Kontakt nach Rhythmus, „nur einmal“ endet', () => {
    const von = new Date(2026, 10, 25);
    expect(naechsterKontakt('quarterly', von)!.getMonth()).toBe(1);
    expect(naechsterKontakt('halfyearly', von)!.getMonth()).toBe(4);
    expect(naechsterKontakt('once', von)).toBeNull();
  });

  it('fällig nur, wenn aktiv, nicht abgemeldet und Termin erreicht', () => {
    const jetzt = new Date('2026-11-25T10:00:00Z');
    expect(istFaellig(e('a', '2026-11-22T08:00:00Z'), jetzt)).toBe(true);
    expect(tageFaellig(e('a', '2026-11-22T08:00:00Z'), jetzt)).toBe(3);
    expect(istFaellig(e('a', '2026-12-01T08:00:00Z'), jetzt)).toBe(false);
    expect(istFaellig(e('a', '2026-11-22T08:00:00Z', { is_active: false }), jetzt)).toBe(false);
    expect(istFaellig(e('a', '2026-11-22T08:00:00Z', { opted_out_at: '2026-11-01' }), jetzt)).toBe(false);
    expect(istFaellig(e('a', null), jetzt)).toBe(false);
  });

  it('höchstens fünf Aufgaben pro Tag, älteste zuerst, wer im Prozess ist pausiert', () => {
    const jetzt = new Date('2026-11-25T10:00:00Z');
    const viele = Array.from({ length: 8 }, (_, i) => e(`k${i}`, `2026-11-${10 + i}T08:00:00Z`));
    const heute = poolAufgabenHeute(viele, new Set(['k0']), jetzt);
    expect(heute).toHaveLength(POOL_AUFGABEN_PRO_TAG);
    expect(heute[0].candidate_id).toBe('k1');
    expect(heute.some((x) => x.candidate_id === 'k0')).toBe(false);
  });

  it('in zwei Pools fällig: nur eine Aufgabe; nächster Eintrag ist der früheste', () => {
    const jetzt = new Date('2026-11-25T10:00:00Z');
    const doppelt = [e('a', '2026-11-20T08:00:00Z'), e('a', '2026-11-12T08:00:00Z'), e('b', '2026-11-15T08:00:00Z')];
    const heute = poolAufgabenHeute(doppelt, new Set(), jetzt);
    expect(heute.map((x) => x.candidate_id)).toEqual(['a', 'b']);
    expect(heute[0].next_contact_at).toBe('2026-11-12T08:00:00Z');
    expect(naechsterEintrag([e('a', null), e('a', '2027-01-01T08:00:00Z')])!.next_contact_at).toBe('2027-01-01T08:00:00Z');
    expect(naechsterEintrag([])).toBeNull();
  });
});

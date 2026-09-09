import { describe, expect, it } from 'vitest';
import { ALL_SLOTS, bedingungGilt, type Known } from '@/lib/briefCatalog';

const slot = (key: string) => ALL_SLOTS.find((s) => s.key === key)!;

describe('bedingungGilt', () => {
  /* Die Frage "Existiert ein Betriebsrat? (Falls ja, wann tagt dieser?)" liess
     sich zur Haelfte nicht beantworten: "Ja" wird als Boolean true abgelegt,
     die Bedingung verglich gegen den Text 'Ja'. */
  it('zeigt die Folgezeile, wenn der Chip Ja einen Boolean speichert', () => {
    const nein: Known = { works_council: { value: false, from: 'answer' } };
    const ja: Known = { works_council: { value: true, from: 'answer' } };
    const folge = slot('works_council_meeting_schedule');
    expect(bedingungGilt({}, folge)).toBe(false);
    expect(bedingungGilt(nein, folge)).toBe(false);
    expect(bedingungGilt(ja, folge)).toBe(true);
  });

  it('haelt die Bonus-Folgezeile bei Nein zurueck', () => {
    const folge = slot('bonus_basis');
    expect(bedingungGilt({}, folge)).toBe(false);
    expect(bedingungGilt({ bonus_structure: { value: 'Nein', from: 'answer' } }, folge)).toBe(false);
    expect(bedingungGilt({ bonus_structure: { value: 'bis 20 %', from: 'answer' } }, folge)).toBe(true);
  });

  it('laesst unbedingte Zeilen unberuehrt', () => {
    expect(bedingungGilt({}, slot('works_council'))).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { ALL_SLOTS } from './briefCatalog';
import {
  BRIEF_COLUMNS, OHNE_SPALTE, catalogToJobRow,
} from '../../supabase/functions/_shared/brief-columns';
import { splitCompoundSkill } from '../../supabase/functions/_shared/skills';

/**
 * Der Katalog steht in src/, die Abbildung in supabase/functions/_shared/ --
 * Deno kann nicht aus src/ importieren, also gibt es die Liste zweimal. Dieser
 * Test ist der Grund, warum das trotzdem sicher ist: laufen die beiden
 * auseinander, wird es rot, statt still Daten zu verlieren.
 */
describe('Katalog und Spaltentabelle bleiben deckungsgleich', () => {
  const katalog = ALL_SLOTS.filter((s) => s.column !== null);

  it('kennt jede Katalogzeile, die eine Spalte hat', () => {
    const inTabelle = new Set(BRIEF_COLUMNS.map((c) => c.key));
    const fehlend = katalog
      .map((s) => s.key)
      .filter((k) => !inTabelle.has(k) && !OHNE_SPALTE.includes(k));
    expect(fehlend).toEqual([]);
  });

  it('erfindet keine Zeile, die es im Katalog nicht gibt', () => {
    const imKatalog = new Set(ALL_SLOTS.map((s) => s.key));
    expect(BRIEF_COLUMNS.filter((c) => !imKatalog.has(c.key)).map((c) => c.key)).toEqual([]);
  });

  it('trifft Spalte, Speicherform und Vertragsart genau', () => {
    for (const c of BRIEF_COLUMNS) {
      const slot = katalog.find((s) => s.key === c.key)!;
      expect(`${c.key}:${c.column}`).toBe(`${c.key}:${slot.column}`);
      expect(`${c.key}:${c.store}`).toBe(`${c.key}:${slot.store}`);
      expect(`${c.key}:${c.only ?? '-'}`).toBe(`${c.key}:${slot.only ?? '-'}`);
    }
  });

  it('schreibt keine Spalte zweimal', () => {
    const spalten = BRIEF_COLUMNS.map((c) => c.column);
    expect(spalten.length).toBe(new Set(spalten).size);
  });
});

describe('catalogToJobRow', () => {
  const known = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));

  it('übernimmt Text, Zahl, Liste und Wahrheitswert', () => {
    const r = catalogToJobRow(known({
      daily_routine: 'Betrieb der Anlagen',
      team_size: 10,
      must_have_criteria: ['SPS', 'Siemens S7'],
      works_council: true,
    }), 'full-time');
    expect(r.daily_routine).toBe('Betrieb der Anlagen');
    expect(r.team_size).toBe(10);
    expect(r.must_have_criteria).toEqual(['SPS', 'Siemens S7']);
    expect(r.works_council).toBe(true);
  });

  it('rechnet Homeoffice-Tage in Tage vor Ort um', () => {
    // Der Chip fragt Homeoffice, die Spalte speichert Anwesenheit.
    expect(catalogToJobRow(known({ remote_days: 2 }), 'full-time').onsite_days_required).toBe(3);
    expect(catalogToJobRow(known({ remote_days: 0 }), 'full-time').onsite_days_required).toBe(5);
    expect(catalogToJobRow(known({ remote_days: 5 }), 'full-time').onsite_days_required).toBe(0);
  });

  it('übersetzt die Frist in die drei erlaubten Dringlichkeiten', () => {
    // jobs_hiring_urgency_check erlaubt nur standard | urgent | hot.
    const u = (v: string) => catalogToJobRow(known({ hiring_deadline: v }), 'full-time').hiring_urgency;
    expect(u('So schnell wie möglich')).toBe('hot');
    expect(u('In 1–3 Monaten')).toBe('urgent');
    expect(u('Zeitlich flexibel')).toBe('standard');
    expect(u('Irgendwann')).toBeUndefined();
  });

  it('rundet halbe Monatsgehälter nicht weg', () => {
    // Der Chip "12 + Urlaubsgeld" traegt 12,5; salary_months ist numeric.
    expect(catalogToJobRow(known({ salary_months: 12.5 }), 'full-time').salary_months).toBe(12.5);
  });

  it('achtet auf die Vertragsart', () => {
    const werte = known({ salary_months: 13, bonus_structure: 'bis 20 %' });
    expect(catalogToJobRow(werte, 'full-time').salary_months).toBe(13);
    expect(catalogToJobRow(werte, 'freelance').salary_months).toBeUndefined();
    expect(catalogToJobRow(werte, 'freelance').bonus_structure).toBeUndefined();
  });

  it('lässt Geldfelder in Ruhe — die kommen aus dem Formular', () => {
    const r = catalogToJobRow(known({
      salary_range: { min: 80000, max: 95000 },
      day_rate_range: { min: 700, max: 850 },
    }), 'freelance');
    expect(r.salary_min).toBeUndefined();
    expect(r.day_rate_min).toBeUndefined();
  });

  it('überspringt Leeres, statt leere Spalten zu schreiben', () => {
    expect(catalogToJobRow(known({
      daily_routine: '   ', must_have_criteria: [], company_culture: null,
    }), 'full-time')).toEqual({});
    expect(catalogToJobRow(null, 'full-time')).toEqual({});
  });
});

/**
 * Deutsche Auslassungen in Anforderungslisten.
 *
 * BEFUND (09.09.2026): "Mindestens drei Jahre in der Personalvermittlung oder
 * Personalberatung" wurde zu zwei Kriterien -- eines davon hiess "-beratung"
 * und stand so in der Muss-Liste, die der Kunde einstufen sollte.
 */
describe('splitCompoundSkill', () => {
  it('trennt nicht an einer Auslassung', () => {
    expect(splitCompoundSkill('Personalvermittlung oder -beratung'))
      .toEqual(['Personalvermittlung oder -beratung']);
    expect(splitCompoundSkill('Fach- und Führungskräfte'))
      .toEqual(['Fach- und Führungskräfte']);
  });

  it('trennt weiterhin, wo zwei eigenständige Begriffe stehen', () => {
    expect(splitCompoundSkill('Java und Kotlin')).toEqual(['Java', 'Kotlin']);
    expect(splitCompoundSkill('Azure oder AWS')).toEqual(['Azure', 'AWS']);
  });
});

import { describe, it, expect } from 'vitest';
import { alsText, teileAuf } from '@/components/admin/IntakeAnswers';
import type { Known } from './briefCatalog';

/**
 * Gemessen an MV-2026-001005 (Finance Manager, Bluewater & Bridge GmbH) am
 * 09.09.2026 -- die Aufnahme, an der aufgefallen ist, dass der Admin 29
 * Kundenantworten nicht sehen konnte. Die Werte stehen hier in genau den
 * Formen, in denen sie im Entwurf lagen.
 */
const KNOWN: Known = {
  daily_routine: { from: 'answer', value: 'Der Monatsanfang gehört dem Abschluss.' },
  must_have_criteria: { from: 'answer', value: ['HGB', 'Monats-/Jahresabschluss', 'Excel'] },
  salary_range: { from: 'answer', value: { min: 70000, max: 85000 } },
  task_breakdown: { from: 'answer', value: { 'Abschluss und Buchhaltung': 40, 'Controlling und Reporting': 30 } },
  works_council: { from: 'answer', value: false },
  team_size: { from: 'answer', value: 3 },
  candidates_in_pipeline: { from: 'ad', value: 2 },
  // Beantwortet, aber im Katalog bewusst ohne eigene Frage.
  nice_to_have_criteria: { from: 'answer', value: ['Bilanzbuchhalter IHK', 'Erfahrung IFRS'] },
  // Leer: darf weder gezaehlt noch gezeigt werden.
  reports_to: { from: 'answer', value: '' },
};

describe('alsText', () => {
  it('macht aus einer Spanne einen Bereich statt [object Object]', () => {
    expect(alsText({ min: 70000, max: 85000 })).toBe('70.000–85.000');
  });

  it('schreibt die Aufgabenverteilung in Prozent aus', () => {
    expect(alsText({ 'Abschluss und Buchhaltung': 40, 'Controlling und Reporting': 30 }))
      .toBe('Abschluss und Buchhaltung 40 % · Controlling und Reporting 30 %');
  });

  it('unterscheidet "Nein" von "keine Angabe"', () => {
    // Der Fehler, der den Betriebsrat auf jeder Stelle mit "Nein" gefuellt
    // haette: false ist eine Antwort, leer ist keine.
    expect(alsText(false)).toBe('Nein');
    expect(alsText('')).toBeNull();
    expect(alsText(undefined)).toBeNull();
  });

  it('reiht Listen auf', () => {
    expect(alsText(['HGB', 'Excel'])).toBe('HGB · Excel');
  });
});

describe('teileAuf', () => {
  it('verliert keinen einzigen beantworteten Schluessel', () => {
    const { gruppen, ohneSlot } = teileAuf(KNOWN, 'full-time');
    const inSlots = new Set(gruppen.flatMap((g) => g.slots.map((s) => s.key)));

    const belegt = Object.keys(KNOWN).filter((k) => alsText(KNOWN[k]?.value) !== null);
    const verloren = belegt.filter((k) => !inSlots.has(k) && !ohneSlot.includes(k));

    expect(verloren).toEqual([]);
  });

  it('führt nice_to_have_criteria getrennt, weil es keine eigene Frage hat', () => {
    const { ohneSlot } = teileAuf(KNOWN, 'full-time');
    expect(ohneSlot).toContain('nice_to_have_criteria');
  });

  it('nimmt leere Werte nicht in die Restliste auf', () => {
    const { ohneSlot } = teileAuf({ irgendwas_ohne_slot: { from: 'answer', value: '' } }, 'full-time');
    expect(ohneSlot).toEqual([]);
  });

  it('meldet einen künftigen Schlüssel, den der Katalog noch nicht kennt', () => {
    const { ohneSlot } = teileAuf(
      { neue_frage_von_morgen: { from: 'answer', value: 'etwas' } }, 'full-time');
    expect(ohneSlot).toEqual(['neue_frage_von_morgen']);
  });
});

import { describe, expect, it } from 'vitest';
import {
  ANTEIL_MATCHUNT, ANTEIL_SPEZIALIST, CONTRACTING_BUDGET_HINWEIS, CONTRACTING_EINLEITUNG, CONTRACTING_PUNKTE,
  CONTRACTING_SCHLUSS, CONTRACTING_ZUSTIMMUNG, anteilSpezialist, budgetZeile, innenRechnung,
} from '../../supabase/functions/_shared/contracting-konditionen';

describe('Konditionen Contracting', () => {
  it('teilt den Tagessatz intern vollständig auf', () => {
    expect(ANTEIL_SPEZIALIST + ANTEIL_MATCHUNT).toBe(100);
    expect(anteilSpezialist(1000)).toBe(780);
    expect(anteilSpezialist(1400)).toBe(1092);
  });

  it('zeigt dem Kunden das Budget als All-in-Satz', () => {
    expect(budgetZeile(900, 1100)).toBe('Ihr Budget: 900–1.100 € je Tag, alles inklusive');
    expect(budgetZeile(1000, null)).toBe('Ihr Budget: 1.000 € je Tag, alles inklusive');
    expect(budgetZeile(1100, 900)).toBe('Ihr Budget: 900–1.100 € je Tag, alles inklusive');
  });

  it('erfindet ohne Budget keine Zahl', () => {
    expect(budgetZeile(null, null)).toBeNull();
    expect(budgetZeile(0, '')).toBeNull();
    expect(innenRechnung(null, undefined)).toBeNull();
  });

  it('rechnet für Admin und Recruiter die Innenseite', () => {
    expect(innenRechnung(900, 1100))
      .toBe('Budget 900–1.100 € je Tag (all-in) → Spezialist bis 702–858 € (78 %), Matchunt 22 %.');
  });

  it('verrät dem Kunden die Aufteilung nirgends', () => {
    // Entscheidung 25.09.2026: Marge ist Innenseite. Jeder Text, der beim
    // Kunden landet (Seite, Mail, Nachweis), darf die Anteile nicht nennen.
    const kundentexte = [
      CONTRACTING_EINLEITUNG, CONTRACTING_BUDGET_HINWEIS, CONTRACTING_SCHLUSS, CONTRACTING_ZUSTIMMUNG,
      ...CONTRACTING_PUNKTE.map((p) => p.text), budgetZeile(900, 1100)!,
    ].join(' ');
    expect(kundentexte).not.toMatch(new RegExp(`\\b(${ANTEIL_SPEZIALIST}|${ANTEIL_MATCHUNT}) ?%`));
    expect(kundentexte).not.toMatch(/Marge/);
  });
});

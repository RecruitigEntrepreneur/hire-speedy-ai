import { describe, expect, it } from 'vitest';
import de from '@/i18n/locales/intakeCatalog/de';
import en from '@/i18n/locales/intakeCatalog/en';
import i18n from '@/i18n';
import { BRIEF_QUESTIONS, DASHBOARD_FRAGEN, frageKurz, frageText, slotChips, slotLabel } from '@/lib/briefCatalog';
import {
  chipLabelT, frageKurzT, frageTextT, frageWhyT, slotLabelT, slotPlaceholderT, wertAnzeigeT,
} from '@/lib/briefCatalogText';
import { BENEFIT_GRUPPEN, CONTRACTING_GRUPPEN, benefitAnzeige, benefitGruppeAnzeige } from '@/components/intake/guest/BenefitsBlock';

/*
 * Der deutsche Wortlaut des Katalogs ist zugleich Speicherwert. Die Sprachdatei
 * `intakeCatalog/de.ts` darf deshalb nie davon abweichen: auf Deutsch muss die
 * Anzeige genau das zeigen, was im Katalog steht. Wer im Katalog eine Frage,
 * eine Zeile oder einen Chip ändert, ergänzt die vier Sprachdateien.
 */
const FRAGEN = [...BRIEF_QUESTIONS, ...DASHBOARD_FRAGEN];
const VERTRAEGE = ['full-time', 'freelance'] as const;

describe('Fragenkatalog: Anzeige auf Deutsch ist der Katalog selbst', () => {
  it('Fragen, Kurzfassungen und Begründungen', () => {
    for (const q of FRAGEN) {
      for (const c of VERTRAEGE) {
        expect(frageTextT(q, c)).toBe(frageText(q, c));
        expect(frageKurzT(q, c) ?? undefined).toBe(frageKurz(q, c) || undefined);
      }
      expect(frageWhyT(q)).toBe(q.why);
      expect((de.q as Record<string, { text: string }>)[q.key]?.text, q.key).toBe(q.text);
    }
  });

  it('Zeilen, Platzhalter und Chips', () => {
    for (const s of FRAGEN.flatMap((q) => q.slots)) {
      for (const c of VERTRAEGE) {
        expect(slotLabelT(s, c)).toBe(slotLabel(s, c));
        for (const chip of slotChips(s, c) ?? []) expect(chipLabelT(s, c, chip)).toBe(chip);
      }
      expect(slotPlaceholderT(s)).toBe(s.placeholder);
      const chips = (de.chips as Record<string, Record<string, string>>)[s.key];
      expect(Object.values(chips ?? {}), s.key).toEqual(s.chips ?? []);
      const frei = (de.chipsFreelance as Record<string, Record<string, string>>)[s.key];
      expect(Object.values(frei ?? {}), s.key).toEqual(s.chipsFreelance ?? []);
    }
  });

  it('Benefits und ihre Gruppen', () => {
    expect(Object.values(de.benefits)).toEqual(BENEFIT_GRUPPEN.flatMap((g) => g.items));
    expect(Object.values(de.benefitsContracting)).toEqual(CONTRACTING_GRUPPEN.flatMap((g) => g.items));
    expect(Object.values(de.benefitGroups)).toEqual(BENEFIT_GRUPPEN.map((g) => g.titel));
    expect(Object.values(de.benefitGroupsContracting)).toEqual(CONTRACTING_GRUPPEN.map((g) => g.titel));
    for (const g of BENEFIT_GRUPPEN) {
      expect(benefitGruppeAnzeige(g.titel, 'full-time')).toBe(g.titel);
      for (const b of g.items) expect(benefitAnzeige(b)).toBe(b);
    }
    expect(benefitAnzeige('Eigener Obstgarten')).toBe('Eigener Obstgarten');
  });

  it('zeigt gespeicherte Werte lesbar, ohne sie zu ändern', () => {
    expect(wertAnzeigeT('works_council', true, 'full-time')).toBe('Ja');
    expect(wertAnzeigeT('contract_limitation', 'befristet', 'full-time')).toBe('Befristet');
    expect(wertAnzeigeT('decision_makers', ['HR', 'Aufsichtsrat'], 'full-time')).toBe('HR · Aufsichtsrat');
    expect(wertAnzeigeT('salary_range', { min: 60000, max: 80000 }, 'full-time')).toBe('60.000 – 80.000');
    expect(wertAnzeigeT('daily_routine', 'Termine außer Haus · und viel Telefon', 'full-time')).toBe('Termine außer Haus · und viel Telefon');
  });
});

describe('Fragenkatalog: andere Sprache', () => {
  it('übersetzt nur die Anzeige, eigene Einträge bleiben', async () => {
    i18n.addResourceBundle('en', 'intakeCatalog', en, true, true);
    await i18n.changeLanguage('en');
    try {
      const slot = FRAGEN.flatMap((q) => q.slots).find((s) => s.key === 'works_council')!;
      expect(chipLabelT(slot, 'full-time', 'Ja')).toBe('Yes');
      expect(chipLabelT(slot, 'full-time', 'Vielleicht')).toBe('Vielleicht');
      expect(wertAnzeigeT('decision_makers', ['Das Team', 'Aufsichtsrat'], 'full-time')).toBe('The team · Aufsichtsrat');
      expect(wertAnzeigeT('salary_range', { min: 60000, max: 80000 }, 'full-time')).toBe('60,000 – 80,000');
      expect(benefitAnzeige('Firmenwagen')).toBe('Company car');
    } finally {
      await i18n.changeLanguage('de');
    }
  });
});

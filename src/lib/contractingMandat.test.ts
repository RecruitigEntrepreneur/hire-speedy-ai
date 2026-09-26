import { describe, expect, it } from 'vitest';
import {
  CONTRACTING_AUFTRAG, auftragsvorlageFassung, contractingPosition, contractingPreisSnapshot,
  rahmenSchritt, unterRahmenvertrag,
} from '../../supabase/functions/_shared/contracting-mandat';

const rv = (status: string, template_version: number, extra: Record<string, unknown> = {}) =>
  ({ status, template_version, ...extra });

describe('Contracting-Auftrag', () => {
  it('rechnet intern 22 % Marge, davon die Hälfte an den Recruiter, 14 Tage Zahlungsziel', () => {
    expect(CONTRACTING_AUFTRAG).toEqual({
      fee_basis: 'day_rate_all_in', fee_percentage: 22, recruiter_fee_percentage: 11, payment_terms_days: 14,
    });
  });

  it('friert Budget und Fassung im Preis-Snapshot ein', () => {
    const snap = contractingPreisSnapshot({ dayRateMin: 400, dayRateMax: 1000 }, '2026-09-26T10:00:00Z');
    expect(snap).toMatchObject({
      model: 'contracting', marginPct: 22, specialistPct: 78, recruiterShareOfMarginPct: 50,
      dayRateMin: 400, dayRateMax: 1000, paymentTermsDays: 14,
    });
    expect(contractingPreisSnapshot(null, 'x')).toMatchObject({ dayRateMin: null, dayRateMax: null });
  });

  it('übernimmt die Position aus der Aufnahme', () => {
    const p = contractingPosition({
      built: { title: 'Arzt / Ärztin', location: 'München', experience_level: 'mid' },
      freelance: { dayRateMin: 400, dayRateMax: 1000, durationMonths: 12, utilizationDaysPerWeek: 3, extensionPossible: true },
    });
    expect(p).toMatchObject({
      title: 'Arzt / Ärztin', employment_type: 'freelance', day_rate_min: 400, day_rate_max: 1000,
      duration_months: 12, days_per_week: 3, extension_possible: true,
    });
  });
});

describe('Läuft die Position unter dem Rahmenvertrag (ohne neue Unterschrift)?', () => {
  it('Fassung 2 wirksam: ja, für beide Vertragsarten – auch ohne Paket (Wahl bei erster Festanstellung)', () => {
    expect(unterRahmenvertrag(rv('active', 2), 'freelance')).toBe(true);
    expect(unterRahmenvertrag(rv('active', 2), 'full-time')).toBe(true);
  });

  it('Fassung 1 wirksam: Festanstellung nur mit Kondition, Contracting nie', () => {
    expect(unterRahmenvertrag(rv('active', 1, { package_key: 'core', pricing_snapshot: {} }), 'full-time')).toBe(true);
    expect(unterRahmenvertrag(rv('active', 1), 'full-time')).toBe(false);
    expect(unterRahmenvertrag(rv('active', 1, { package_key: 'core', pricing_snapshot: {} }), 'freelance')).toBe(false);
  });

  it('kein wirksamer Vertrag: nein', () => {
    expect(unterRahmenvertrag(null, 'freelance')).toBe(false);
    expect(unterRahmenvertrag(rv('sent', 2), 'full-time')).toBe(false);
  });
});

describe('Welche Auftragsvorlage passt?', () => {
  it('Einzelauftrag v1 nur für Festanstellung unter wirksamer Fassung 1', () => {
    expect(auftragsvorlageFassung(rv('active', 1), 'full-time')).toBe(1);
    expect(auftragsvorlageFassung(rv('active', 1), 'freelance')).toBe(2);
    expect(auftragsvorlageFassung(rv('active', 2), 'full-time')).toBe(2);
    expect(auftragsvorlageFassung(null, 'full-time')).toBe(2);
  });
});

describe('Was docusign-send mit dem gefundenen Rahmenvertrag tut', () => {
  it('legt ohne Vertrag einen neuen an', () => {
    expect(rahmenSchritt(null, 'freelance')).toEqual({ art: 'neu' });
  });

  it('verwendet Fassung 2 immer', () => {
    for (const status of ['draft', 'sent', 'customer_signed', 'active']) {
      expect(rahmenSchritt(rv(status, 2), 'freelance')).toEqual({ art: 'verwenden' });
    }
  });

  it('löst eine wirksame Fassung 1 bei Contracting ab, lässt sie bei Festanstellung stehen', () => {
    expect(rahmenSchritt(rv('active', 1), 'freelance')).toEqual({ art: 'abloesen' });
    expect(rahmenSchritt(rv('active', 1), 'full-time')).toEqual({ art: 'verwenden' });
  });

  it('ersetzt eine noch nicht versandte Fassung 1 – Neukunden bekommen nur noch v4', () => {
    expect(rahmenSchritt(rv('draft', 1), 'full-time')).toEqual({ art: 'verwerfen_und_neu' });
    expect(rahmenSchritt(rv('pending_release', 1), 'freelance')).toEqual({ art: 'verwerfen_und_neu' });
  });

  it('meldet einen Konflikt, wenn Fassung 1 gerade zur Unterschrift liegt und Contracting kommt', () => {
    expect(rahmenSchritt(rv('sent', 1), 'freelance').art).toBe('konflikt');
    expect(rahmenSchritt(rv('customer_signed', 1), 'full-time')).toEqual({ art: 'verwenden' });
  });
});

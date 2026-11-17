import { describe, expect, it } from 'vitest';
import {
  bandOf, buildTourData, criteriaOf, isContracting, nextWorkday, offerOf, regionOf, remoteOf, roleOf, startDateOf,
  stateOf, wishOf, yearsOf, type TourFallback, type TourJobSource,
} from './clientDemo';

const FALLBACK: TourFallback = {
  title: 'Senior Controller (m/w/d)', location: 'München', band: { min: 75_000, max: 90_000 },
  level: 'senior', remote: 'hybrid', criteria: ['Konzernabschluss nach HGB und IFRS', 'SAP S/4HANA'],
};
const JOB: TourJobSource = {
  id: 'j1', title: 'Servicetechniker Medizintechnik (m/w/d)', status: 'pending_approval', location: 'Tuttlingen',
  salary_min: 48_000, salary_max: 56_000, employment_type: 'full-time', experience_level: 'junior',
  remote_type: 'onsite', must_haves: ['Medizingeräte'],
};
const MONTAG = new Date(2026, 10, 16, 9, 0);

describe('Beispielkandidat aus der eigenen Stelle', () => {
  it('nennt den Kandidaten wie die Stelle, ohne Geschlechtszusatz', () => {
    expect(roleOf('Servicetechniker Medizintechnik (m/w/d)')).toBe('Servicetechniker Medizintechnik');
    expect(roleOf('Senior Vehicle AI Architect (f/m/x)')).toBe('Senior Vehicle AI Architect');
    expect(roleOf('Head of Sales DACH (w/m/d)')).toBe('Head of Sales DACH');
    expect(roleOf('Data Scientist')).toBe('Data Scientist');
  });

  it('macht aus der Erfahrungsstufe Jahre', () => {
    expect(yearsOf('junior')).toBe('1–3');
    expect(yearsOf('senior')).toBe('5–10');
    expect(yearsOf('lead')).toBe('10+');
    expect(yearsOf(null)).toBe('3–5');
  });

  it('nimmt den Ort nur, wenn er kurz und nicht remote ist', () => {
    expect(regionOf('Stuttgart-Feuerbach, BW')).toBe('Stuttgart-Feuerbach');
    expect(regionOf('Remote')).toBeNull();
    expect(regionOf('Region Süd (Bayern, Baden-Württemberg) – Home-Office-basiert, Wohnort idealerweise Raum München')).toBeNull();
    expect(remoteOf('onsite')).toBe('onsite');
    expect(remoteOf('irgendwas')).toBeNull();
  });

  it('legt Wunsch und Angebot mitten ins Gehaltsband', () => {
    const band = bandOf(48_000, 56_000)!;
    expect(wishOf(band)).toEqual({ min: 50_000, max: 54_000 });
    expect(offerOf(band)).toBe(52_000);
    expect(bandOf(null, 80_000)).toEqual({ min: 68_000, max: 80_000 });
    expect(bandOf(null, null)).toBeNull();
  });

  it('bezieht sich auf höchstens zwei Muss-Kriterien und kürzt lange Sätze', () => {
    expect(criteriaOf([' A ', '', 'B', 'C'])).toEqual(['A', 'B']);
    expect(criteriaOf(['x'.repeat(80)])[0]).toHaveLength(59);
    expect(criteriaOf(null)).toEqual([]);
  });

  it('legt Interview und Start in die Zukunft', () => {
    const freitag = new Date(2026, 10, 20, 9, 0);
    const iv = nextWorkday(freitag, 14);
    expect(iv.getDay()).toBe(1);
    expect(iv.getHours()).toBe(14);
    expect(startDateOf(MONTAG)).toEqual(new Date(2027, 2, 1));
    expect(startDateOf(new Date(2026, 0, 1))).toEqual(new Date(2026, 3, 1));
  });

  it('erkennt Contracting und den Stand der Stelle', () => {
    expect(isContracting('freelance')).toBe(true);
    expect(isContracting('full-time')).toBe(false);
    expect(stateOf('published')).toBe('live');
    expect(stateOf('pending_approval')).toBe('review');
    expect(stateOf('draft')).toBe('none');
  });
});

describe('Bühnendaten', () => {
  it('nimmt alles aus der eigenen Stelle', () => {
    const data = buildTourData(JOB, FALLBACK, { now: MONTAG });
    expect(data).toMatchObject({
      jobId: 'j1', state: 'review', example: false, role: 'Servicetechniker Medizintechnik', region: 'Tuttlingen',
      remote: 'onsite', contracting: false, years: '1–3', criteria: ['Medizingeräte'], offer: 52_000,
      wish: { min: 50_000, max: 54_000 },
    });
  });

  it('zeigt bei Contracting kein Gehalt', () => {
    const data = buildTourData({ ...JOB, employment_type: 'freelance' }, FALLBACK, { now: MONTAG });
    expect(data.contracting).toBe(true);
    expect(data.band).toBeNull();
    expect(data.wish).toBeNull();
    expect(data.offer).toBeNull();
  });

  it('läuft ohne Stelle am Beispiel, mit dem Titel aus der Aufnahme, wenn es ihn gibt', () => {
    const plain = buildTourData(null, FALLBACK, { now: MONTAG });
    expect(plain).toMatchObject({ jobId: null, state: 'none', example: true, title: 'Senior Controller (m/w/d)', criteria: FALLBACK.criteria });
    const waiting = buildTourData(null, FALLBACK, { now: MONTAG, waitingTitle: 'Lagerleiter (m/w/d)' });
    expect(waiting.title).toBe('Lagerleiter (m/w/d)');
    expect(waiting.role).toBe('Lagerleiter');
  });
});

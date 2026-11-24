import { describe, expect, it } from 'vitest';
import { offeneStellenAbgleichen, passtZurRolle, stelleAbgleichen, stelleMeta, type KandidatAngaben, type StelleInfo } from './offeneStellen';

const sophie: KandidatAngaben = {
  vorname: 'Sophie',
  job_title: 'Senior Key Account Managerin Medizintechnik',
  target_roles: ['Vertriebsleitung', 'Head of Sales DACH'],
  city: 'München',
  remote_preference: 'hybrid',
  expected_salary: 95000,
  salary_minimum: 90000,
  relocation_willing: null,
  languages: [{ language: 'Deutsch' }, { language: 'Englisch' }],
};

let n = 0;
const stelle = (s: Partial<StelleInfo>): StelleInfo => ({
  id: `s${++n}`,
  title: 'Stelle',
  location: 'München',
  remote_type: 'hybrid',
  onsite_days_required: null,
  salary_min: null,
  salary_max: null,
  required_languages: null,
  created_at: '2026-11-01T00:00:00Z',
  ...s,
});

describe('Rolle nach Wortliste', () => {
  const rollen = ['Vertriebsleitung', 'Head of Sales DACH'];
  it('erkennt Leitung im Vertrieb, auch zusammengesetzt oder englisch', () => {
    expect(passtZurRolle('Head of Sales DACH (m/w/d)', rollen)).toBe(true);
    expect(passtZurRolle('Vertriebsleiter Süd (m/w/d)', rollen)).toBe(true);
    expect(passtZurRolle('Sales Director DACH', rollen)).toBe(true);
    expect(passtZurRolle('Teamleitung Key Account (m/w/d)', rollen)).toBe(true);
  });
  it('gleiche Ebene in anderem Fach passt nicht, gleiches Fach ohne Leitung auch nicht', () => {
    expect(passtZurRolle('Teamleiter Service (m/w/d)', rollen)).toBe(false);
    expect(passtZurRolle('Key Account Manager Klinik (m/w/d)', rollen)).toBe(false);
    expect(passtZurRolle('HR Business Partner (m/w/d)', rollen)).toBe(false);
    expect(passtZurRolle('Brandschutzbeauftragter', ['Marketing Manager'])).toBe(false);
  });
  it('Rolle ohne Ebene passt zu jeder Stelle im Fach', () => {
    expect(passtZurRolle('Head of Sales DACH', ['Key Account Managerin'])).toBe(true);
    expect(passtZurRolle('Lohnbuchhalter (m/w/d)', ['Buchhaltung'])).toBe(true);
  });
  it('Rolle ohne Wort aus der Liste vergleicht die Wörter', () => {
    expect(passtZurRolle('Zahnmedizinische Fachangestellte', ['Zahnmedizinische Fachangestellte'])).toBe(true);
    expect(passtZurRolle('Lohnbuchhalter', ['Zahnmedizinische Fachangestellte'])).toBe(false);
  });
});

describe('Fakten je Stelle', () => {
  it('stellt die Angaben neben die Stelle', () => {
    const a = stelleAbgleichen(sophie, stelle({ title: 'Head of Sales DACH', salary_min: 130000, salary_max: 160000 }), sophie.target_roles);
    expect(a.rolle).toBe(true);
    expect(a.fakten).toEqual(['Ort wie Sophie', 'hybrid wie gewünscht', 'Wunsch 95.000 € unter dem Budget']);
    expect(a.ausschluss).toBeNull();
  });
  it('anderer Ort, Umzug offen, kein Budget', () => {
    const a = stelleAbgleichen(sophie, stelle({ location: 'Stuttgart' }), []);
    expect(a.fakten).toEqual(['Sophie wohnt in München, Umzug nicht geklärt', 'hybrid wie gewünscht', 'kein Budget angegeben']);
    expect(a.gleicherOrt).toBe(false);
  });
  it('Arbeitsmodell weicht ab, Sprache verlangt', () => {
    const a = stelleAbgleichen(sophie, stelle({ remote_type: 'onsite', salary_max: 100000, required_languages: ['Englisch'] }), []);
    expect(a.fakten).toEqual(['Ort wie Sophie', 'vor Ort, gewünscht hybrid', 'Wunsch 95.000 € im Budget', 'Englisch verlangt, eingetragen']);
  });
  it('Pflichtsprache als Kürzel aus der Aufnahme', () => {
    const a = stelleAbgleichen(sophie, stelle({ required_languages: [{ code: 'de', minLevel: 'C1' }] }), []);
    expect(a.fakten[3]).toBe('Deutsch C1 verlangt, eingetragen');
    const b = stelleAbgleichen(sophie, stelle({ required_languages: [{ code: 'pl', minLevel: 'B2' }] }), []);
    expect(b.ausschluss).toBe('Verlangt Polnisch, nicht eingetragen');
  });
  it('hybrid mit 5 Präsenztagen heißt so', () => {
    const a = stelleAbgleichen(sophie, stelle({ remote_type: 'hybrid', onsite_days_required: 5 }), []);
    expect(a.fakten[1]).toBe('5 Tage vor Ort, gewünscht hybrid');
  });
  it('Remote-Stelle braucht keinen Ort', () => {
    const a = stelleAbgleichen(sophie, stelle({ location: 'Berlin', remote_type: 'remote' }), []);
    expect(a.fakten[0]).toBe('remote');
    expect(a.gleicherOrt).toBe(true);
  });
  it('Meta-Zeile wie in der Jobliste', () => {
    expect(stelleMeta(stelle({ salary_min: 65000, salary_max: 80000 }))).toBe('München · hybrid · 65.000–80.000 €');
  });
});

describe('Feste Ausschlüsse', () => {
  it('Budget unter dem Mindestgehalt', () => {
    expect(stelleAbgleichen(sophie, stelle({ salary_max: 85000 }), []).ausschluss).toBe('Budget unter Sophies Mindestgehalt (90.000 €)');
  });
  it('nur vor Ort gegen nur remote', () => {
    expect(stelleAbgleichen({ ...sophie, remote_preference: 'remote' }, stelle({ remote_type: 'onsite' }), []).ausschluss).toBe('Nur vor Ort, Sophie will nur remote');
  });
  it('anderer Ort schließt nicht aus, auch ohne Umzug (Nachbarort)', () => {
    const a = stelleAbgleichen({ ...sophie, city: 'Esslingen', relocation_willing: false }, stelle({ location: 'Stuttgart', remote_type: 'onsite' }), []);
    expect(a.ausschluss).toBeNull();
    expect(a.fakten[0]).toBe('Sophie wohnt in Esslingen, kein Umzug');
  });
  it('fehlende Sprache schließt nur aus, wenn Sprachen eingetragen sind', () => {
    const s = stelle({ required_languages: [{ language: 'Polnisch' }] });
    expect(stelleAbgleichen(sophie, s, []).ausschluss).toBe('Verlangt Polnisch, nicht eingetragen');
    expect(stelleAbgleichen({ ...sophie, languages: [] }, s, []).ausschluss).toBeNull();
  });
  it('ohne Angaben schließt nichts aus', () => {
    const leer: KandidatAngaben = { vorname: 'Ben', job_title: '', target_roles: [], city: '', remote_preference: null, expected_salary: null, salary_minimum: null, relocation_willing: null, languages: [] };
    const a = stelleAbgleichen(leer, stelle({ remote_type: 'onsite', salary_max: 50000, required_languages: ['Englisch'] }), []);
    expect(a.ausschluss).toBeNull();
    expect(a.fakten).toEqual(['Wohnort nicht eingetragen', 'vor Ort', 'Wunschgehalt nicht eingetragen', 'Englisch verlangt, nicht eingetragen']);
  });
});

describe('Liste für den Kandidaten', () => {
  it('Rolle zuerst, dann gleicher Ort, dann die neuesten; Ausschlüsse getrennt', () => {
    const r = offeneStellenAbgleichen(sophie, [
      stelle({ id: 'contracting', title: 'TEST Contracting live', location: 'Stuttgart', created_at: '2026-11-10T00:00:00Z' }),
      stelle({ id: 'service', title: 'Teamleiter Service', salary_min: 65000, salary_max: 80000, created_at: '2026-10-01T00:00:00Z' }),
      stelle({ id: 'hos', title: 'Head of Sales DACH', salary_min: 130000, salary_max: 160000, created_at: '2026-09-01T00:00:00Z' }),
      stelle({ id: 'hr', title: 'HR Business Partner', location: 'Stuttgart', salary_max: 95000, created_at: '2026-11-05T00:00:00Z' }),
    ]);
    expect(r.rollenQuelle).toBe('wunsch');
    expect(r.zurRolle.map((a) => a.stelle.id)).toEqual(['hos']);
    expect(r.weitere.map((a) => a.stelle.id)).toEqual(['contracting', 'hr']);
    expect(r.ausgeschlossen.map((a) => a.stelle.id)).toEqual(['service']);
  });
  it('ohne Wunschrollen zählt die heutige Rolle', () => {
    const r = offeneStellenAbgleichen({ ...sophie, target_roles: [] }, [stelle({ id: 'kam', title: 'Key Account Manager Klinik' })]);
    expect(r.rollenQuelle).toBe('heute');
    expect(r.zurRolle.map((a) => a.stelle.id)).toEqual(['kam']);
  });
});

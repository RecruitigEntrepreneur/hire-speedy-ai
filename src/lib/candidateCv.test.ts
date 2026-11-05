import { describe, expect, it } from 'vitest';
import {
  compareCvWithDossier,
  cvAgeLabel,
  cvAgeMonths,
  cvFileProblem,
  cvStoragePath,
  evidenceFromCv,
  isCvFileName,
  isCvStale,
  parseSnapshot,
  redactCompanies,
  snapshotFromCv,
  submissionErrorText,
} from './candidateCv';
import type { CvExtraction } from './cvImport';

const today = new Date('2026-10-14T10:00:00Z');

describe('Was als Lebenslauf zählt', () => {
  it('nur PDF und Word', () => {
    expect(isCvFileName('Lena_CV.pdf')).toBe(true);
    expect(isCvFileName('lebenslauf.DOCX')).toBe(true);
    expect(isCvFileName('alt.doc')).toBe(true);
    expect(isCvFileName('profil.txt')).toBe(false);
    expect(isCvFileName('https://linkedin.com/in/lena')).toBe(false);
    expect(isCvFileName('')).toBe(false);
  });

  it('meldet falsches Format und zu große Datei', () => {
    expect(cvFileProblem({ name: 'foto.jpg', size: 1000 })).toMatch(/PDF- oder Word/);
    expect(cvFileProblem({ name: 'cv.pdf', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(cvFileProblem({ name: 'cv.pdf', size: 1000 })).toBeNull();
  });
});

describe('Aktualität', () => {
  it('fragt ab 6 Monaten nach', () => {
    expect(isCvStale({ created_at: '2026-04-14T09:00:00Z', confirmed_current_at: null }, today)).toBe(true);
    expect(isCvStale({ created_at: '2026-04-20T09:00:00Z', confirmed_current_at: null }, today)).toBe(false);
  });

  it('zählt ab der letzten Bestätigung „noch aktuell“', () => {
    const cv = { created_at: '2026-02-14T09:00:00Z', confirmed_current_at: '2026-09-01T09:00:00Z' };
    expect(cvAgeMonths(cv, today)).toBe(1);
    expect(isCvStale(cv, today)).toBe(false);
  });

  it('beschriftet das Alter', () => {
    expect(cvAgeLabel(0)).toBe('weniger als einen Monat alt');
    expect(cvAgeLabel(1)).toBe('1 Monat alt');
    expect(cvAgeLabel(8)).toBe('8 Monate alt');
  });
});

describe('Abdruck des Lebenslaufs', () => {
  const cv: CvExtraction = {
    version: 'v1',
    contact: { full_name: 'Lena Maier', email: '', phone: '', city: '', linkedin_url: '', github_url: '', portfolio_url: '', website_url: '' },
    removed_sensitive: [],
    fields: { experience_years: { value: 8, source: 'cv', quote: '8 Jahre' } },
    stations: [{ job_title: 'Senior Sales Manager', company_name: 'Trumpf GmbH', location: '', industry: '', start: '2020-01', end: null, is_current: true, description: '' }],
    educations: [{ institution: 'HS Esslingen', degree: 'Bachelor', field_of_study: 'BWL', graduation_year: 2014, grade: '' }],
    skills: [], languages: [], suggestions: { summary: '', highlights: [], career_directions: [] }, rejected_quotes: 0, raw_text: '',
  };

  it('nimmt Position, Arbeitgeber, Jahre und Abschlüsse', () => {
    expect(snapshotFromCv(cv)).toEqual({ job_title: 'Senior Sales Manager', company: 'Trumpf GmbH', experience_years: 8, degrees: ['Bachelor'] });
  });

  it('liest gespeicherte Abdrücke robust', () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot({ job_title: ' ', degrees: ['Master', 3] })).toEqual({ job_title: null, company: null, experience_years: null, degrees: ['Master'] });
  });
});

describe('Stimmigkeit Akte ↔ Lebenslauf', () => {
  const snap = { job_title: 'Senior Sales Manager', company: 'Trumpf GmbH', experience_years: 8, degrees: ['Bachelor BWL'] };
  const cvDate = new Date('2026-03-01T00:00:00Z');

  it('ist still, wenn alles passt (Rechtsform, Zusätze, Jahre seit dem Lebenslauf)', () => {
    const f = { job_title: 'Sales Manager', company: 'TRUMPF', experience_years: 9 };
    expect(compareCvWithDossier(snap, f, ['Bachelor BWL'], cvDate, today)).toEqual([]);
  });

  it('meldet abweichende Position, Arbeitgeber, Jahre und Abschluss', () => {
    const f = { job_title: 'Teamleiter Vertrieb', company: 'Festo SE', experience_years: 14 };
    const m = compareCvWithDossier(snap, f, ['Master Maschinenbau'], cvDate, today);
    expect(m.map((x) => x.key)).toEqual(['position', 'arbeitgeber', 'jahre', 'abschluss']);
    expect(m[0]).toMatchObject({ akte: 'Teamleiter Vertrieb', cv: 'Senior Sales Manager' });
  });

  it('fehlende Angaben sind kein Widerspruch', () => {
    expect(compareCvWithDossier(snap, { job_title: '', company: '', experience_years: null }, [], cvDate, today)).toEqual([]);
    expect(compareCvWithDossier(null, { job_title: 'X', company: 'Y', experience_years: 3 }, [], cvDate, today)).toEqual([]);
  });
});

describe('Belege aus dem Lebenslauf', () => {
  const raw = [
    'Lena Maier · lena@example.com · +49 171 1234567',
    'Senior Sales Manager, Trumpf GmbH (2020 – heute)',
    '• Aufbau des B2B-Vertriebs für Laserschneidanlagen im Maschinenbau, 6 Jahre Neukundengewinnung',
    '• SAP SD und Salesforce im Tagesgeschäft',
  ].join('\n');

  it('findet die passende Zeile und verdeckt den Arbeitgeber', () => {
    expect(evidenceFromCv('Mind. 5 Jahre Erfahrung im B2B-Vertrieb Maschinenbau', raw, ['Trumpf GmbH']))
      .toBe('Aufbau des B2B-Vertriebs für Laserschneidanlagen im Maschinenbau, 6 Jahre Neukundengewinnung');
    expect(evidenceFromCv('Sichere Kenntnisse in SAP SD', raw)).toBe('SAP SD und Salesforce im Tagesgeschäft');
  });

  it('schlägt nichts vor, wenn nichts passt oder kein Text da ist', () => {
    expect(evidenceFromCv('Führerschein Klasse C', raw)).toBeNull();
    expect(evidenceFromCv('B2B-Vertrieb', '')).toBeNull();
  });

  it('nimmt nie Zeilen mit Kontaktdaten', () => {
    expect(evidenceFromCv('Lena Maier example', raw)).toBeNull();
  });

  it('verdeckt Arbeitgeber, auch klein geschrieben', () => {
    expect(redactCompanies('Vertrieb bei trumpf gmbh und Festo', ['Trumpf GmbH', 'Festo'])).toBe('Vertrieb bei früherer Arbeitgeber und früherer Arbeitgeber');
  });
});

describe('Sonstiges', () => {
  it('liest den Speicherpfad aus der Adresse', () => {
    expect(cvStoragePath('https://x.supabase.co/storage/v1/object/public/cv-documents/abc/1-Lena_CV.pdf')).toBe('abc/1-Lena_CV.pdf');
    expect(cvStoragePath('https://linkedin.com/in/lena')).toBeNull();
  });

  it('übersetzt die Datenbank-Regel in eine klare Meldung', () => {
    expect(submissionErrorText({ code: 'P0001', hint: 'cv_missing', message: 'x' })).toBe('Ohne Lebenslauf kann der Kandidat nicht eingereicht werden.');
    expect(submissionErrorText({ code: 'P0001', message: 'Einreichen geht nur auf aktivierte Stellen.' })).toBe('Einreichen geht nur auf aktivierte Stellen.');
    expect(submissionErrorText({ code: '23505', message: 'duplicate key' })).toBe('Fehler beim Einreichen');
  });
});

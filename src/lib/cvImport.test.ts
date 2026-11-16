import { describe, expect, it } from 'vitest';
import { dossierFromCv, emptyDossier, interviewGaps, liveOrigins, mergeCvIntoDossier, newStations, originsToStore, sameDossierValue, type CvExtraction } from './cvImport';

const cv: CvExtraction = {
  version: 'cv-v1',
  contact: { full_name: 'Katharina Brenner', email: '', phone: '+49 170 1234567', city: 'München', linkedin_url: '', github_url: 'github.com/kb', portfolio_url: '', website_url: '' },
  removed_sensitive: ['Geburtsdatum'],
  fields: {
    company: { value: 'Isar Maschinenbau AG', source: 'cv', quote: 'Isar Maschinenbau AG' },
    seniority: { value: 'senior', source: 'suggestion', quote: '' },
    expected_salary: { value: 85000, source: 'cv', quote: '85.000 €' },
    notice_period: { value: '3_months_eoq', source: 'cv', quote: '3 Monate zum Quartalsende' },
    blocked_companies: { value: ['Baltic Freight AG'], source: 'cv', quote: 'Baltic Freight AG' },
  },
  stations: [{ job_title: 'Teamleiterin', company_name: 'Isar Maschinenbau AG', location: 'München', industry: '', start: '2021-04', end: null, is_current: true, description: '' }],
  educations: [],
  skills: [{ name: 'SAP FI/CO', years: 9, quote: 'SAP FI/CO (9 Jahre)' }],
  languages: [{ language: 'Englisch', level: 'C1', quote: 'Englisch C1' }],
  suggestions: { summary: 'Finance Managerin mit 10 Jahren Erfahrung.', highlights: ['Team von 4 geführt'], career_directions: [] },
  rejected_quotes: 0,
  raw_text: '…',
};

describe('Lebenslauf → Akte', () => {
  const { form, origins } = dossierFromCv(cv);

  it('übernimmt Belegtes, erfindet nichts', () => {
    expect(form.email).toBe(''); // keine Platzhalter-Adresse
    expect(form.relocation_willing).toBeNull(); // kein „Umzug: Nein" ohne Angabe
    expect(form.internal_note).toBe(''); // Zusammenfassung landet nicht in der internen Notiz
    expect(form.expected_salary).toBe(85000);
    expect(form.notice_period).toBe('3_months_eoq');
    expect(form.job_title).toBe('Teamleiterin');
    expect(form.languages).toEqual([{ language: 'Englisch', proficiency: 'C1' }]);
    expect(form.expose_summary).toBe('Finance Managerin mit 10 Jahren Erfahrung.');
    expect(origins.seniority?.source).toBe('suggestion');
    expect(origins.job_title?.source).toBe('derived');
  });

  it('aktueller Arbeitgeber steht automatisch auf der Sperrliste', () => {
    expect(form.blocked_companies).toEqual(['Isar Maschinenbau AG', 'Baltic Freight AG']);
  });

  it('Lücken fürs Interview', () => {
    expect(interviewGaps(form)).toEqual(expect.arrayContaining(['Wechselmotivation', 'Arbeitsmodell und Pendelzeit', 'Umzugsbereitschaft']));
    expect(interviewGaps(form)).not.toContain('Kündigungsfrist');
  });
});

describe('Neuer Lebenslauf für bestehenden Kandidaten', () => {
  const { form: incoming, origins } = dossierFromCv(cv);
  const current = { ...emptyDossier(), full_name: 'Katharina Brenner', company: 'Alte Firma GmbH', expected_salary: 90000, skills: ['Excel'], recommendation: 'yes' as const };

  it('füllt nur leere Felder, Abweichungen werden gemeldet statt überschrieben', () => {
    const { merged, changes } = mergeCvIntoDossier(current, incoming, origins);
    expect(merged.expected_salary).toBe(90000); // Interviewwert bleibt
    expect(merged.company).toBe('Alte Firma GmbH');
    expect(merged.notice_period).toBe('3_months_eoq'); // war leer → neu
    expect(merged.skills).toEqual(['Excel', 'SAP FI/CO']); // ergänzt, nichts entfernt
    expect(merged.recommendation).toBe('yes');
    expect(changes.find((c) => c.key === 'expected_salary')).toMatchObject({ kind: 'conflict', current: 90000, incoming: 85000 });
    expect(changes.find((c) => c.key === 'notice_period')?.kind).toBe('new');
  });

  it('erkennt schon vorhandene Stationen', () => {
    expect(newStations([{ company_name: 'Isar Maschinenbau AG', start_date: '2021-04-01' }], cv.stations)).toEqual([]);
    expect(newStations([], cv.stations)).toHaveLength(1);
  });
});

describe('Herkunft aus dem Lebenslauf im Interview', () => {
  const { form } = dossierFromCv(cv);
  it('merkt nur Lebenslauf-Werte, keine Vorschläge und keine Sperrliste', () => {
    const stored = originsToStore(cv, form);
    expect(stored.expected_salary).toEqual({ source: 'cv', quote: '85.000 €', value: 85000 });
    expect(stored.job_title?.source).toBe('derived');
    expect(stored.seniority).toBeUndefined();
    expect(stored.blocked_companies).toBeUndefined();
    expect(stored.expose_summary).toBeUndefined();
  });
  it('merkt nichts, was der Headhunter vor dem Anlegen geändert hat', () => {
    const stored = originsToStore(cv, { ...form, expected_salary: 90000 });
    expect(stored.expected_salary).toBeUndefined();
    expect(stored.notice_period).toBeDefined();
  });
  it('zeigt den Vermerk nur, solange der Wert noch stimmt', () => {
    const stored = originsToStore(cv, form);
    expect(liveOrigins(stored, form).expected_salary?.quote).toBe('85.000 €');
    expect(liveOrigins(stored, { ...form, expected_salary: 95000 }).expected_salary).toBeUndefined();
    expect(liveOrigins(null, form)).toEqual({});
  });
  it('vergleicht Listen ohne Reihenfolge und Texte ohne Groß/klein', () => {
    expect(sameDossierValue([{ language: 'Englisch', proficiency: 'C1' }, { language: 'Deutsch', proficiency: '' }], [{ language: 'deutsch' }, { language: 'Englisch', proficiency: 'C1' }])).toBe(true);
    expect(sameDossierValue(' München ', 'münchen')).toBe(true);
    expect(sameDossierValue(85000, 80000)).toBe(false);
    expect(sameDossierValue(null, '')).toBe(true);
  });
});

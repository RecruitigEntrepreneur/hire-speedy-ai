/**
 * Lebenslauf-Import: Schwärzen, Kontakt lesen, Zitate prüfen (cv-extraction.ts).
 * Grundlage ist Katharinas Test-Lebenslauf aus dem Live-Test vom 01.10.2026.
 */

import { describe, expect, it } from 'vitest';
import { experienceYearsFrom, prepareCvText, quoteFound, validateCv } from '../../supabase/functions/_shared/cv-extraction';

const CV = `Katharina Brenner
Finance Managerin · Rechnungswesen und Controlling · HGB, IFRS, SAP
Adresse: Schwanthalerstraße 41, 80336 München
E-Mail: marko.benko@bluewater-bridge.de
Telefon: +49 170 1234567
LinkedIn: linkedin.com/in/katharina-brenner-finance
GitHub: github.com/kbrenner-bi
Website: www.kbrenner-finance.de
Geburtsdatum: 14.05.1987 in Lübeck
Familienstand: verheiratet, 2 Kinder
Staatsangehörigkeit: deutsch
PROFIL
Finance Managerin mit über 10 Jahren Erfahrung in Rechnungswesen und Controlling. Disziplinarische Führung eines Teams von 4 Mitarbeitenden.
WECHSELWUNSCH
Wunschposition: Finance Manager, Leitung Rechnungswesen und Controlling oder Head of Accounting
Zielbranchen: Personaldienstleistung, Beratung, Industrie
Gehaltsvorstellung: 85.000 € brutto p. a. (Untergrenze 80.000 €), aktuell 76.000 €
Kündigungsfrist: 3 Monate zum Quartalsende, verfügbar ab 01.04.2027
Arbeitsmodell: Hybrid (2–3 Tage Büro), maximal 45 Minuten Pendelzeit
Umzug: Nicht geplant, lebe in München
Arbeitserlaubnis: EU-Bürgerin, keine Arbeitserlaubnis nötig
Motivation: Nach der Übernahme durch einen Finanzinvestor fehlt mir die Entwicklungsperspektive.
Karriereziel: In 3–5 Jahren kaufmännische Leitung in einem mittelständischen Unternehmen.
Bitte nicht bei: Baltic Freight AG (direkter Wettbewerber meines Arbeitgebers)
BERUFSERFAHRUNG
04/2021 – heute · Teamleiterin Rechnungswesen und Controlling
Isar Maschinenbau AG, München
• Eigenständige Erstellung der Monats-, Quartals- und Jahresabschlüsse nach HGB
09/2017 – 03/2021 · Controllerin
PersonalPlus Zeitarbeit GmbH, München
08/2014 – 08/2017 · Junior Controllerin
Elbtal Handel GmbH, Hamburg
ZERTIFIKATE
Geprüfte Bilanzbuchhalterin (IHK), 2019
KENNTNISSE
Systeme: SAP FI/CO (9 Jahre), DATEV Unternehmen online
Sprachen: Deutsch Muttersprache · Englisch verhandlungssicher (C1)`;

describe('Lebenslauf vorbereiten', () => {
  const p = prepareCvText(CV);

  it('liest Kontakt selbst aus', () => {
    expect(p.contact).toMatchObject({
      full_name: 'Katharina Brenner',
      email: 'marko.benko@bluewater-bridge.de',
      phone: '+49 170 1234567',
      city: 'München',
      linkedin_url: 'linkedin.com/in/katharina-brenner-finance',
      github_url: 'github.com/kbrenner-bi',
      website_url: 'www.kbrenner-finance.de',
    });
  });

  it('die KI sieht weder Name noch Kontakt noch geschützte Angaben', () => {
    for (const s of ['Katharina', 'Brenner', 'marko.benko', '1234567', 'Schwanthaler', '1987', 'Lübeck', 'verheiratet', 'Kinder', 'deutsch\n', 'linkedin.com', 'github.com', 'kbrenner']) {
      expect(p.redacted, s).not.toContain(s);
    }
    expect(p.removed).toEqual(expect.arrayContaining(['Geburtsdatum', 'Familienstand', 'Staatsangehörigkeit']));
  });

  it('lässt Fachliches und die Arbeitserlaubnis stehen', () => {
    for (const s of ['Arbeitserlaubnis: EU-Bürgerin', 'Isar Maschinenbau AG', 'SAP FI/CO (9 Jahre)', 'Baltic Freight AG', '85.000 €']) expect(p.redacted).toContain(s);
  });

  it('Label allein in einer Zeile: auch der Wert darunter fällt weg', () => {
    const q = prepareCvText('Max Muster\nGeburtsdatum\n01.02.1990\nKenntnisse: Excel');
    expect(q.redacted).not.toContain('1990');
    expect(q.redacted).toContain('Kenntnisse: Excel');
  });

  it('Fachbegriffe mit „Kinder"/„Religion" bleiben (Kinder- und Jugendhilfe, Lehramt Religion)', () => {
    const q = prepareCvText('Anna Beispiel\nSozialpädagogin in der Kinder- und Jugendhilfe\nLehramt Religion und Deutsch');
    expect(q.redacted).toContain('Kinder- und Jugendhilfe');
    expect(q.redacted).toContain('Lehramt Religion');
  });
});

describe('Zitatprüfung', () => {
  it('eine Zahl allein ist kein Beleg', () => {
    expect(quoteFound('10', 'Berufsjahre: 10')).toBe(false);
    expect(quoteFound('Berufsjahre: 10', 'Berufsjahre: 10')).toBe(true);
  });
});

describe('Antwort der KI prüfen', () => {
  const p = prepareCvText(CV);
  const ai = {
    job_title: { value: 'Teamleiterin Rechnungswesen und Controlling', quote: 'Teamleiterin Rechnungswesen und Controlling' },
    company: { value: 'Isar Maschinenbau AG', quote: 'Isar Maschinenbau AG' },
    seniority: { value: 'senior', quote: '' },
    leadership_scope: { value: 'disciplinary', quote: 'Disziplinarische Führung eines Teams von 4 Mitarbeitenden' },
    leadership_team_size: { value: 4, quote: 'Teams von 4 Mitarbeitenden' },
    stations: [
      { job_title: 'Teamleiterin Rechnungswesen und Controlling', company_name: 'Isar Maschinenbau AG', location: 'München', industry: '', start: '2021-04', end: '', is_current: true, description: 'Abschlüsse nach HGB' },
      { job_title: 'Controllerin', company_name: 'PersonalPlus Zeitarbeit GmbH', location: 'München', industry: 'Personaldienstleistung', start: '2017-09', end: '2021-03', is_current: false, description: '' },
      { job_title: 'Junior Controllerin', company_name: 'Elbtal Handel GmbH', location: 'Hamburg', industry: '', start: '08/2014', end: '08/2017', is_current: false, description: '' },
      { job_title: 'CFO', company_name: 'Erfundene AG', location: '', industry: '', start: '2010-01', end: '2012-01', is_current: false, description: '' },
    ],
    educations: [],
    skills: [{ name: 'SAP FI/CO', years: 9, quote: 'SAP FI/CO (9 Jahre)' }, { name: 'Python', years: 0, quote: 'Python' }],
    certificates: [{ name: 'Bilanzbuchhalterin (IHK)', quote: 'Geprüfte Bilanzbuchhalterin (IHK), 2019' }],
    industries: [{ name: 'Personaldienstleistung', quote: 'Personaldienstleistung' }],
    languages: [{ language: 'Deutsch', level: 'native', quote: 'Deutsch Muttersprache' }, { language: 'Englisch', level: 'C1', quote: 'Englisch verhandlungssicher (C1)' }],
    expected_salary: { value: 85000, quote: '85.000 € brutto p. a.' },
    salary_minimum: { value: 80000, quote: 'Untergrenze 80.000 €' },
    current_salary: { value: 90000, quote: 'aktuell 76.000 €' },
    notice: { duration: '3_months', anchor: 'eoq', quote: '3 Monate zum Quartalsende' },
    availability_date: { value: '2027-04-01', quote: 'verfügbar ab 01.04.2027' },
    remote_preference: { value: 'hybrid', quote: 'Hybrid (2–3 Tage Büro)' },
    max_commute_minutes: { value: 45, quote: 'maximal 45 Minuten Pendelzeit' },
    employment_type: { value: 'unknown', quote: '' },
    relocation: { value: 'no', quote: 'Nicht geplant, lebe in München' },
    work_permit: { value: 'citizen', quote: 'EU-Bürgerin, keine Arbeitserlaubnis nötig' },
    target_roles: [{ name: 'Finance Manager', quote: 'Finance Manager' }, { name: 'Head of Accounting', quote: 'Head of Accounting' }],
    target_industries: [{ name: 'Personaldienstleistung', quote: 'Personaldienstleistung' }],
    target_locations: [],
    blocked_companies: [{ name: 'Baltic Freight AG', quote: 'Baltic Freight AG' }],
    change_motivation: { value: 'Nach der Übernahme fehlt die Entwicklungsperspektive', quote: 'fehlt mir die Entwicklungsperspektive' },
    career_goal: { value: 'In 3–5 Jahren kaufmännische Leitung', quote: 'In 3–5 Jahren kaufmännische Leitung' },
    summary: 'Finance Managerin bei Isar Maschinenbau AG mit 10 Jahren Erfahrung. Sie ist verheiratet und hat zwei Kinder. Stark in HGB-Abschlüssen.',
    highlights: ['Abschlussdauer verkürzt', 'Team von 4 geführt', 'Bilanzbuchhalterin IHK', 'viertes'],
    career_directions: ['Kaufmännische Leitung', 'Head of Finance'],
  };
  const r = validateCv(ai, p, 'Notiz: Möchte ungern pendeln, Wunsch 85k', '2026-10');

  it('übernimmt belegte Werte mit Quelle', () => {
    expect(r.fields.job_title).toMatchObject({ value: 'Teamleiterin Rechnungswesen und Controlling', source: 'cv' });
    expect(r.fields.expected_salary?.value).toBe(85000);
    expect(r.fields.salary_minimum?.value).toBe(80000);
    expect(r.fields.notice_period?.value).toBe('3_months_eoq');
    expect(r.fields.availability_date?.value).toBe('2027-04-01');
    expect(r.fields.max_commute_minutes?.value).toBe(45);
    expect(r.fields.relocation_willing?.value).toBe(false);
    expect(r.fields.work_permit?.value).toBe('citizen');
    expect(r.fields.blocked_companies?.value).toEqual(['Baltic Freight AG']);
    expect(r.fields.certificates?.value).toEqual(['Bilanzbuchhalterin (IHK)']);
    expect(r.fields.career_3_5_year_plan?.value).toBe('In 3–5 Jahren kaufmännische Leitung');
    expect(r.languages).toEqual([
      { language: 'Deutsch', level: 'Muttersprache', quote: 'Deutsch Muttersprache' },
      { language: 'Englisch', level: 'C1', quote: 'Englisch verhandlungssicher (C1)' },
    ]);
  });

  it('verwirft Erfundenes: falsches Gehalt, Station und Skill ohne Beleg', () => {
    expect(r.fields.current_salary).toBeUndefined(); // 90.000 steht nicht im Zitat
    expect(r.stations.map((s) => s.company_name)).toEqual(['Isar Maschinenbau AG', 'PersonalPlus Zeitarbeit GmbH', 'Elbtal Handel GmbH']);
    expect(r.skills.map((s) => s.name)).toEqual(['SAP FI/CO']);
    expect(r.skills[0].years).toBe(9);
    expect(r.rejected_quotes).toBeGreaterThanOrEqual(3);
  });

  it('Seniorität ohne Zitat bleibt als Vorschlag, Berufsjahre werden berechnet', () => {
    expect(r.fields.seniority).toEqual({ value: 'senior', source: 'suggestion', quote: '' });
    expect(r.fields.experience_years).toMatchObject({ value: 12, source: 'derived' });
    expect(r.stations[2]).toMatchObject({ start: '2014-08', end: '2017-08' });
  });

  it('Vorschläge ohne Namen und ohne geschützte Angaben', () => {
    expect(r.suggestions.summary).not.toMatch(/Isar Maschinenbau|verheiratet|Kinder/);
    expect(r.suggestions.summary).toContain('ein Unternehmen');
    expect(r.suggestions.highlights).toHaveLength(3);
    expect(r.suggestions.career_directions).toEqual(['Kaufmännische Leitung', 'Head of Finance']);
  });

  it('kaputte KI-Antwort führt zu leerem, aber gültigem Ergebnis', () => {
    const e = validateCv('Unsinn', p, '', '2026-10');
    expect(e.fields).toEqual({});
    expect(e.contact.full_name).toBe('Katharina Brenner');
  });
});

describe('Berufsjahre', () => {
  it('überlappende Stationen zählen einmal', () => {
    expect(experienceYearsFrom([
      { job_title: 'a', company_name: '', location: '', industry: '', start: '2018-01', end: '2020-12', is_current: false, description: '' },
      { job_title: 'b', company_name: '', location: '', industry: '', start: '2020-01', end: '2021-12', is_current: false, description: '' },
    ], '2026-10')).toBe(4);
  });
});

/**
 * V4.1 – Befunde aus dem Live-Test vom 01.10.2026 (Jonas Kreuzer, Senior Data Scientist,
 * gegen 31 Live-Stellen). Jeder Test hält einen Fehler fest, der live auftrat.
 */

import { describe, expect, it } from 'vitest';
import { assembleCandidateProfile, assembleJobProfile } from '../../supabase/functions/_shared/match-v41/understand';
import { buildCandidateSection, quoteInSource, verifyJudgement } from '../../supabase/functions/_shared/match-v41/judge';
import { evaluateFrame } from '../../supabase/functions/_shared/match-v41/frame';
import { decideTier } from '../../supabase/functions/_shared/match-v41/policy';
import { cityCoords, distanceKm } from '../../supabase/functions/_shared/match-v41/geo';
import { companyMaskTokens, maskCompany } from '../../supabase/functions/_shared/match-v41/db-inputs';

const NOW = Date.UTC(2026, 9, 1);
const priv = { candidate_blocked_companies: [], job_company_name: null };

const jonas = assembleCandidateProfile({
  job_title: 'Senior Data Scientist', experience_years: 6, seniority: 'senior',
  skills: ['Python', 'Machine Learning', 'SQL', 'Statistik', 'TensorFlow', 'Pandas', 'scikit-learn', 'Spark'],
  languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }, { language: 'Englisch', proficiency: 'C1' }],
  city: 'Berlin', remote_preference: 'onsite', max_commute_minutes: 30, expected_salary: 95000, salary_minimum: 90000,
  notice_period: '3_months_eoq', employment_type: 'fulltime',
}, { families: ['data_analytics'] });
const section = buildCandidateSection(jonas, '');

describe('Live-Befund 1: Aufzählung als Beleg', () => {
  it('„Python, Machine Learning, scikit-learn" gilt, wenn jedes Element in der Akte steht', () => {
    expect(quoteInSource('Python, Machine Learning, scikit-learn', section)).toBe(true);
    expect(quoteInSource('Python und Machine Learning', section)).toBe(true);
  });
  it('erfundene Elemente in der Aufzählung fallen weiter durch', () => {
    expect(quoteInSource('Python, Kubernetes', section)).toBe(false);
    expect(quoteInSource('Python, Machine Learning in Produktion', section)).toBe(false);
  });

  it('Jonas × Data Scientist (Berlin): Sehr passend statt Prüfen', () => {
    const job = assembleJobProfile(
      { title: 'Data Scientist', client_must: ['Berufserfahrung in Python und Machine Learning (inkl. ML-Frameworks)', 'Kenntnisse in SQL', 'Kenntnisse und Hintergrund in Statistik'], location: 'Berlin', remote_type: 'hybrid', onsite_days_required: 2, salary_min: 85000, salary_max: 110000, experience_level: 'senior' },
      { families: ['data_analytics'], seniority: 'senior' },
    );
    const judged = verifyJudgement({
      requirements: [
        { id: 'r1', status: 'met', evidence: 'Python, Machine Learning, scikit-learn, TensorFlow', note: '' },
        { id: 'r2', status: 'met', evidence: 'SQL', note: '' },
        { id: 'r3', status: 'met', evidence: 'Statistik', note: '' },
      ],
      role_fit: 'same', seniority_fit: 'fits',
    }, job, section);
    expect(judged.rejected_quotes).toBe(0);
    const res = decideTier(job, jonas, evaluateFrame(job, jonas, priv, NOW), judged);
    expect(res.tier).toBe('sehr_passend');
  });
});

describe('Live-Befund 2: Nachbar-Berufsfeld ohne Beleg wird nicht vorgeschlagen', () => {
  const devops = assembleJobProfile(
    { title: 'DevOps Engineer', client_must: ['Erfahrung mit Kubernetes', 'Infrastructure as Code', 'AWS oder GCP'], location: 'Berlin', remote_type: 'hybrid', onsite_days_required: 2 },
    { families: ['software_dev'] },
  );
  const frame = evaluateFrame(devops, jonas, priv, NOW);

  it('KI sagt „Nachbarfeld", kein Muss-Kriterium belegt → Ausgeschlossen mit Grund', () => {
    const judged = verifyJudgement({ requirements: [], role_fit: 'adjacent', seniority_fit: 'fits' }, devops, section);
    const res = decideTier(devops, jonas, frame, judged);
    expect(res.tier).toBe('ausgeschlossen');
    expect(res.exclusion).toEqual({ code: 'family_no_evidence', text: 'Nachbar-Berufsfeld, kein Muss-Kriterium belegt', overridable: true });
  });

  it('Stelle ohne Kriterien im Nachbarfeld → ebenfalls ausgeschlossen', () => {
    const empty = assembleJobProfile({ title: 'Senior DevOps Engineer', location: 'München' }, { families: ['software_dev'] });
    const res = decideTier(empty, jonas, evaluateFrame(empty, jonas, priv, NOW), verifyJudgement({ role_fit: 'adjacent' }, empty, section));
    expect(res.exclusion?.text).toBe('Nachbar-Berufsfeld, Stelle ohne prüfbare Kriterien');
  });

  it('mit einem belegten Muss-Kriterium bleibt es ein Prüf-Fall', () => {
    const judged = verifyJudgement({ requirements: [{ id: 'r3', status: 'met', evidence: 'Python', note: '' }], role_fit: 'adjacent' }, devops, section);
    expect(decideTier(devops, jonas, frame, judged).tier).toBe('pruefen');
  });

  it('bei KI-Ausfall wird darüber nie ausgeschlossen', () => {
    expect(decideTier(devops, jonas, frame, verifyJudgement(null, devops, section)).tier).toBe('pruefen');
  });
});

describe('Live-Befund 3: Entfernung statt „Pendelweg klären"', () => {
  it('Städtetabelle und Luftlinie', () => {
    expect(cityCoords('80331 München')).toEqual([48.137, 11.575]);
    expect(cityCoords('Frankfurt am Main, Hessen')).toEqual([50.11, 8.682]);
    expect(cityCoords('NRW (Gebiet)')).toBeNull();
    expect(distanceKm({ lat: null, lng: null, city: 'Berlin' }, { lat: null, lng: null, city: 'München' })).toBeGreaterThan(480);
    expect(distanceKm({ lat: null, lng: null, city: 'Frankfurt am Main' }, { lat: null, lng: null, city: 'Schwalbach am Taunus' })).toBeLessThan(20);
  });

  const job = (city: string, onsite: number) => assembleJobProfile({ title: 'Data Scientist', location: city, remote_type: 'hybrid', onsite_days_required: onsite }, {});
  const loc = (cand: typeof jonas, city: string, onsite = 2) => evaluateFrame(job(city, onsite), cand, priv, NOW).items.find((i) => i.key === 'location')!;

  it('Berlin → München ohne Umzugsangabe: Umzug klären', () => {
    expect(loc(jonas, 'München')).toMatchObject({ status: 'check' });
    expect(loc(jonas, 'München').text).toMatch(/ca\. \d+ km – Umzug klären/);
  });
  it('Berlin → München, kein Umzug, 3 Präsenztage: Ausschluss mit Beleg', () => {
    const noMove = { ...jonas, logistics: { ...jonas.logistics, relocation: false } };
    expect(loc(noMove, 'München', 3).status).toBe('exclude');
    expect(loc(noMove, 'München', 1).status).toBe('check');
  });
  it('Berlin → Potsdam passt, Koordinaten aus der Datenbank haben Vorrang', () => {
    expect(loc(jonas, 'Potsdam').status).toBe('ok');
    const far = { ...jonas, logistics: { ...jonas.logistics, lat: 48.137, lng: 11.575 } };
    expect(loc(far, 'Potsdam').status).toBe('check');
  });
  it('unbekannter Ort bleibt offen', () => {
    expect(loc(jonas, 'Hintertupfingen').status).toBe('unknown');
  });
});

describe('Live-Befund 4: Maskierung trifft keine Fachbegriffe', () => {
  it('„MS Project" bleibt, auch wenn die Firma „Project" im Namen trägt', () => {
    const t = companyMaskTokens('Infra Project Partner GmbH');
    expect(maskCompany('Kenntnisse in MS Project', t)).toBe('Kenntnisse in MS Project');
    expect(maskCompany('Die Infra Project Partner GmbH sucht', t)).toBe('Die [Kunde] sucht');
    expect(maskCompany('Infra wächst', t)).toBe('[Kunde] wächst');
  });
});

describe('Live-Befund 5 (Katharina, 01.10.2026): Nachbarberuf ohne Rollenerfahrung, Zahl als Beleg', () => {
  const katharina = assembleCandidateProfile({
    job_title: 'Teamleiterin Rechnungswesen und Controlling', experience_years: 10, seniority: 'senior',
    skills: ['HGB', 'SAP FI/CO', 'DATEV Unternehmen online', 'Excel'], city: 'München',
  }, { families: ['finance_accounting', 'controlling'] });
  const kSection = buildCandidateSection(katharina, '');

  it('Lohnbuchhalter: nur DATEV belegt, Lohnbuchhaltung offen → Ausgeschlossen', () => {
    const job = assembleJobProfile({ title: 'Lohnbuchhalter (m/w/d)' }, {
      families: ['finance_accounting'],
      requirements: [
        { text: 'Erfahrung in der Lohnbuchhaltung', kind: 'experience', class: 'must', evidence: [] },
        { text: 'DATEV-Kenntnisse', kind: 'competence', class: 'must', evidence: [] },
      ],
    });
    const judged = verifyJudgement({ requirements: [{ id: 'r1', status: 'unknown', evidence: '' }, { id: 'r2', status: 'met', evidence: 'DATEV Unternehmen online' }], role_fit: 'adjacent' }, job, kSection);
    const res = decideTier(job, katharina, evaluateFrame(job, katharina, priv, NOW), judged);
    expect(res.tier).toBe('ausgeschlossen');
    expect(res.exclusion?.code).toBe('family_no_role_experience');
  });

  it('„10" allein belegt keine Erfahrung', () => {
    expect(quoteInSource('10', kSection)).toBe(false);
    expect(quoteInSource('Berufsjahre: 10', kSection)).toBe(true);
  });
});

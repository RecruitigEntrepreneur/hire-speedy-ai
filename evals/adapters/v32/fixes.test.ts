import { describe, expect, it } from 'vitest';
import {
  classifyJobFamilies,
  collectCandidateCertifications,
  collectCandidateLanguages,
  computeConfidence,
  deriveTitleEvidence,
  evaluateCertRequirement,
  evaluateLanguageRequirement,
  evaluateVisa,
  extractLanguageRequirementsFromText,
  familiesCoherent,
  hasSubstantiveOverlap,
  isLanguageContinuationFragment,
  noticePeriodToDays,
  normalizeLanguageCode,
  normalizeLanguageLevel,
  resolveStartDays,
  salarySignal,
  softStartDate,
  termMatches,
} from '../../../supabase/functions/_shared/match-v41/rules';

const NOW = Date.parse('2026-07-18T12:00:00.000Z');

describe('F1 Sprachen', () => {
  it('normalisiert Sprachnamen auf ISO 639-1', () => {
    expect(normalizeLanguageCode('Deutsch')).toBe('de');
    expect(normalizeLanguageCode('Englisch (fließend)')).toBe('en');
    expect(normalizeLanguageCode('Niederländisch')).toBe('nl');
    expect(normalizeLanguageCode('tr')).toBe('tr');
    expect(normalizeLanguageCode('Klingonisch')).toBeNull();
  });

  it('normalisiert Niveaus: Muttersprache über C2, verhandlungssicher/fluent = C1, gut = B2, Grundkenntnisse = A2', () => {
    expect(normalizeLanguageLevel('Muttersprache')).toBe(7);
    expect(normalizeLanguageLevel('native')).toBe(7);
    expect(normalizeLanguageLevel('C2')).toBe(6);
    expect(normalizeLanguageLevel('verhandlungssicher')).toBe(5);
    expect(normalizeLanguageLevel('fluent')).toBe(5);
    expect(normalizeLanguageLevel('fließend')).toBe(5);
    expect(normalizeLanguageLevel('gut')).toBe(4);
    expect(normalizeLanguageLevel('Grundkenntnisse')).toBe(2);
    expect(normalizeLanguageLevel(null)).toBeNull(); // v3.1 nahm hier A1 an
  });

  it('liest candidate_languages UND language_skills; keine Daten = null (unbekannt)', () => {
    const langs = collectCandidateLanguages({
      candidate_languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }],
      language_skills: [{ code: 'en', level: 'b2' }, { language: 'Deutsch', level: 'c1' }],
    });
    expect(langs).toEqual(expect.arrayContaining([{ code: 'de', rank: 7 }, { code: 'en', rank: 4 }]));
    expect(collectCandidateLanguages({ candidate_languages: [], language_skills: [] })).toBeNull();
  });

  it('fehlende Sprachdaten → kein Kill, keine Strafe, nur Prüfhinweis', () => {
    const c = evaluateLanguageRequirement({ code: 'de', minRank: 5 }, null);
    expect(c).toMatchObject({ status: 'unknown_no_data', kill: false, multiplier: 1 });
    expect(c.risk).toMatch(/nicht erfasst/);
  });

  it('Kill nur bei belegt ≥ 2 Stufen zu niedrig; 1 Stufe = Strafe; fehlend-trotz-Liste = Strafe + Cap', () => {
    expect(evaluateLanguageRequirement({ code: 'de', minRank: 5 }, [{ code: 'de', rank: 3 }]).kill).toBe(true);
    expect(evaluateLanguageRequirement({ code: 'de', minRank: 5 }, [{ code: 'de', rank: 4 }])).toMatchObject({ kill: false, multiplier: 0.8 });
    expect(evaluateLanguageRequirement({ code: 'de', minRank: 5 }, [{ code: 'en', rank: 7 }])).toMatchObject({
      status: 'absent_listed', kill: false, multiplier: 0.5, capMaybe: true,
    });
    expect(evaluateLanguageRequirement({ code: 'de', minRank: 5 }, [{ code: 'de', rank: 7 }]).status).toBe('met');
  });

  it('Freitext-Anforderungen (soft) töten nie und ändern den Score nicht', () => {
    const c = evaluateLanguageRequirement({ code: 'nl', minRank: 5, soft: true }, [{ code: 'de', rank: 7 }]);
    expect(c).toMatchObject({ kill: false, multiplier: 1 });
    expect(evaluateLanguageRequirement({ code: 'en', minRank: 5, soft: true }, [{ code: 'en', rank: 2 }])).toMatchObject({ kill: false, multiplier: 1, capMaybe: true });
  });
});

describe('F1b Sprach-Must-haves im Freitext', () => {
  it('erkennt Elision und Niveau', () => {
    expect(extractLanguageRequirementsFromText('Gute Deutsch- und Englischkenntnisse')).toEqual([
      { code: 'de', minRank: 4, soft: true },
      { code: 'en', minRank: 4, soft: true },
    ]);
    expect(extractLanguageRequirementsFromText('Sehr gute Deutschkenntnisse (mind. C1)')).toEqual([{ code: 'de', minRank: 5, soft: true }]);
    expect(extractLanguageRequirementsFromText('Excellent communication skills in Dutch and English').map((r) => r.code)).toEqual(['en', 'nl']);
  });

  it('ignoriert das Adjektiv „deutsch" und Nicht-Sprach-Anforderungen', () => {
    expect(extractLanguageRequirementsFromText('Erfahrung im deutschen Steuerrecht')).toEqual([]);
    expect(extractLanguageRequirementsFromText('Erfahrung mit Datev')).toEqual([]);
  });

  it('erkennt Komma-Split-Reste als Fortsetzung', () => {
    expect(isLanguageContinuationFragment('C2-Level und besser')).toBe(true);
    expect(isLanguageContinuationFragment('in Wort und Schrift')).toBe(true);
    expect(isLanguageContinuationFragment('Teamfähigkeit')).toBe(false);
  });
});

describe('F2 Zertifikate', () => {
  it('vereint certifications ∪ certificates (String oder {name})', () => {
    expect(collectCandidateCertifications({ certifications: ['CISSP'], certificates: [{ name: 'PMP', url: 'x' }, 'CISSP'] })).toEqual(['CISSP', 'PMP']);
  });

  it('keine Zertifikatsdaten = unbekannt; gelistet ohne Treffer = fehlt', () => {
    expect(evaluateCertRequirement('CISSP', [], termMatches)).toBe('unknown_no_data');
    expect(evaluateCertRequirement('CISSP', ['PMP'], termMatches)).toBe('missing_listed');
    expect(evaluateCertRequirement('CISSP', ['CISSP (ISC²)'], termMatches)).toBe('met');
  });
});

describe('F3 Visa', () => {
  it('Kill nur bei visa_sponsorship === false', () => {
    expect(evaluateVisa({ visa_required: true }, {})).toBe('unknown');
    expect(evaluateVisa({ visa_required: true }, { visa_sponsorship: null })).toBe('unknown');
    expect(evaluateVisa({ visa_required: true }, { visa_sponsorship: false })).toBe('kill');
    expect(evaluateVisa({ visa_required: true }, { visa_sponsorship: true })).toBe('ok');
    expect(evaluateVisa({ visa_required: false }, { visa_sponsorship: false })).toBe('ok');
  });
});

describe('F4 Token-Matching', () => {
  it('kurze Terme matchen nicht mehr als Teilstring', () => {
    expect(termMatches('ts', 'Qualitätsprüfung')).toBe(false); // Synonym von TypeScript
    expect(termMatches('c', 'Key Account')).toBe(false);
    expect(termMatches('go', 'Google Cloud')).toBe(false);
    expect(termMatches('java', 'JavaScript')).toBe(false);
    expect(termMatches('ai', 'Maintenance')).toBe(false);
  });

  it('behält legitime Treffer: Komposita, Tech-Schreibweisen, Sätze, SQL-Dialekte', () => {
    expect(termMatches('Buchhaltung', 'Finanzbuchhaltung')).toBe(true);
    expect(termMatches('Tailwind CSS', 'TailwindCSS')).toBe(true);
    expect(termMatches('vue', 'Vue.js')).toBe(true);
    expect(termMatches('C#', 'csharp')).toBe(true);
    expect(termMatches('Sehr gute Excel-Kenntnisse', 'MS Excel')).toBe(true);
    expect(termMatches('Gute Kenntnisse in Python', 'Python')).toBe(true);
    expect(termMatches('SQL', 'PostgreSQL')).toBe(true);
    expect(termMatches('Microservices', 'Microservice')).toBe(true);
  });

  it('Mehrwort-Terme brauchen alle Inhalts-Tokens; Dachmarke allein reicht nicht', () => {
    expect(termMatches('SAP FI', 'SAP SD')).toBe(false);
    expect(termMatches('SAP FI/CO Kenntnisse', 'SAP')).toBe(false);
    expect(termMatches('SAP FI/CO Kenntnisse', 'SAP FI')).toBe(true);
  });

  it('Jobtitel als Evidenz für Rollen-Anforderungen', () => {
    expect(deriveTitleEvidence('Data Scientist')).toContain('data science');
    expect(deriveTitleEvidence('Controllerin')).toContain('controlling');
    expect(deriveTitleEvidence('Senior Finanzbuchhalter (m/w/d)')).toContain('finanzbuchhaltung');
    expect(termMatches('data science', deriveTitleEvidence('Data Scientist')[1])).toBe(true);
  });
});

describe('F6 Gehalt', () => {
  it('fehlende Seite = unbekannt; deutlich unter salary_min = Risiko', () => {
    expect(salarySignal({ expected_salary: null }, { salary_min: 50000, salary_max: 70000 }).known).toBe(false);
    expect(salarySignal({ expected_salary: 60000 }, { salary_min: null, salary_max: null }).known).toBe(false);
    expect(salarySignal({ expected_salary: 38000 }, { salary_min: 50000, salary_max: 70000 })).toMatchObject({ known: true, underBudgetRisk: true });
    expect(salarySignal({ expected_salary: 45000 }, { salary_min: 50000, salary_max: 70000 }).underBudgetRisk).toBe(false);
  });
});

describe('F7 Kündigungsfrist', () => {
  it('übersetzt Enum- und Freitext-Werte in Tage', () => {
    expect(noticePeriodToDays('immediate', NOW)).toBe(0);
    expect(noticePeriodToDays('2_weeks', NOW)).toBe(14);
    expect(noticePeriodToDays('6_weeks', NOW)).toBe(42);
    expect(noticePeriodToDays('3_months', NOW)).toBe(92); // 18.07. → 18.10.
    expect(noticePeriodToDays('6 Wochen', NOW)).toBe(42);
    expect(noticePeriodToDays('3 Monate', NOW)).toBe(92);
    expect(noticePeriodToDays('unklar', NOW)).toBeNull();
  });

  it('3_months_eoq = 3 Monate, dann zum Quartalsende', () => {
    // 18.07. + 3 Monate = 18.10. → Quartalsende 31.12.2026
    expect(noticePeriodToDays('3_months_eoq', NOW)).toBe(166);
    expect(noticePeriodToDays('3 Monate zum Quartalsende', NOW)).toBe(166);
  });

  it('availability_date hat Vorrang vor notice_period', () => {
    expect(resolveStartDays({ availability_date: '2026-07-28', notice_period: '3_months' }, NOW, true)).toEqual({ days: 10, source: 'availability_date' });
    expect(resolveStartDays({ notice_period: '1_month' }, NOW, true)).toEqual({ days: 30, source: 'notice_period' });
    expect(resolveStartDays({ notice_period: '1_month' }, NOW, false).source).toBe('unknown');
  });

  it('3 Monate Frist ist normal: milde Strafe statt ×0.4; Ziel-Datum zählt die Verspätung', () => {
    expect(softStartDate(92, null).multiplier).toBeGreaterThanOrEqual(0.9);
    expect(softStartDate(92, 120).multiplier).toBe(1);
    expect(softStartDate(92, 50).multiplier).toBe(0.9); // 42 Tage zu spät
  });
});

describe('F8 Berufsfeld-Kohärenz', () => {
  it('klassifiziert Titel in Familien, Generalisten-Rollen bleiben neutral', () => {
    expect(classifyJobFamilies('Kesselwärter / Objekt Betreuer').families).toEqual(['technical_trades']);
    expect(classifyJobFamilies('Senior Controller (m/w/d)').families).toEqual(['controlling']);
    expect(classifyJobFamilies('Frontend Developer (React/Vue)').families).toContain('software_dev');
    expect(classifyJobFamilies('Referent Bereichsleitung IT (m/w/d)').kind).toBe('general');
    expect(classifyJobFamilies('Geschäftsführer & CEO').kind).toBe('general');
    expect(classifyJobFamilies('Group-Director Finance and Accounting').families).toEqual(['finance_accounting']);
    expect(classifyJobFamilies(null).kind).toBe('unknown');
  });

  it('Kohärenz: gleich/angrenzend ja, fachfremd nein, unbekannt/Generalist immer ja', () => {
    const fin = classifyJobFamilies('Finanzbuchhalter');
    expect(familiesCoherent(fin, classifyJobFamilies('Controller'))).toBe(true);
    expect(familiesCoherent(classifyJobFamilies('Sales Manager'), classifyJobFamilies('HR Business Partner'))).toBe(false);
    expect(familiesCoherent(classifyJobFamilies('Kesselwärter'), classifyJobFamilies('Frontend Developer'))).toBe(false);
    expect(familiesCoherent(classifyJobFamilies('Projektmanager'), classifyJobFamilies('Frontend Developer'))).toBe(true);
  });

  it('Querschnitts-Skills zählen nicht als fachliche Überschneidung', () => {
    expect(hasSubstantiveOverlap(['sehr gute excel-kenntnisse', 'sap'])).toBe(false);
    expect(hasSubstantiveOverlap(['datev'])).toBe(true);
  });
});

describe('F5 Confidence', () => {
  it('vollständige Daten = 1, Lücken und unbekannte Pflicht-Prüfungen senken', () => {
    const full = { hasSkills: true, hasTitle: true, hasExperience: true, hasSeniority: true, salaryKnown: true, startKnown: true, jobHasMustHaves: true, unknownChecks: 0 };
    expect(computeConfidence(full)).toBe(1);
    expect(computeConfidence({ ...full, salaryKnown: false, startKnown: false })).toBe(0.75);
    expect(computeConfidence({ ...full, jobHasMustHaves: false, unknownChecks: 1 })).toBe(0.65);
  });
});

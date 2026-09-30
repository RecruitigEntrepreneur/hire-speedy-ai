/**
 * V4.1 – Einzelbausteine: Stellenprofil/Kandidatenprofil aus KI-Antwort bauen,
 * Zitatprüfung, Schutz vor verbotenen Merkmalen.
 */

import { describe, expect, it } from 'vitest';
import { assembleCandidateProfile, assembleJobProfile, type JobInput } from '../../supabase/functions/_shared/match-v41/understand';
import { buildCandidateSection, quoteInSource, scrubProtected, verifyJudgement } from '../../supabase/functions/_shared/match-v41/judge';

const baseJob: JobInput = { title: 'Buchhalter (m/w/d)' };

describe('Stellenprofil', () => {
  it('Einstufung des Kunden gewinnt gegen den Vorschlag der KI', () => {
    const job = assembleJobProfile(
      { ...baseJob, client_must: ['DATEV'], client_nice: ['Englisch B2'] },
      { families: ['finance_accounting'], requirements: [{ text: 'DATEV', kind: 'competence', class: 'nice', evidence: ['DATEV'] }] },
    );
    const datev = job.requirements.find((r) => r.text === 'DATEV')!;
    expect(datev.class).toBe('must');
    expect(datev.class_confirmed).toBe(true);
  });

  it('von der KI übersehene Kunden-Kriterien gehen nicht verloren', () => {
    const job = assembleJobProfile({ ...baseJob, client_must: ['DATEV', 'Monatsabschluss nach HGB'] }, { requirements: [] });
    expect(job.requirements.map((r) => [r.text, r.class, r.class_confirmed])).toEqual([
      ['DATEV', 'must', true],
      ['Monatsabschluss nach HGB', 'must', true],
    ]);
  });

  it('zusammengefügte Kriterien übernehmen die Kunden-Einstufung über den Beleg', () => {
    const job = assembleJobProfile(
      { ...baseJob, client_must: ['Creo oder SolidWorks'] },
      { requirements: [{ text: 'CAD-Konstruktion (Creo oder SolidWorks)', kind: 'competence', class: 'nice', alternatives: ['Creo', 'SolidWorks'], evidence: ['Creo oder SolidWorks'] }] },
    );
    expect(job.requirements).toHaveLength(1);
    expect(job.requirements[0].class).toBe('must');
    expect(job.requirements[0].alternatives).toEqual(['Creo', 'SolidWorks']);
  });

  it('erfundene Belege der KI werden verworfen, Satzstücke landen in dropped', () => {
    const job = assembleJobProfile(
      { ...baseJob, must_haves: ['mehrjährige Berufserfahrung im Bereich Buchhaltung'], nice_to_haves: ['Fähigkeit', 'sich in komplexe Fragestellungen reinzudenken'] },
      {
        requirements: [{ text: 'Buchhaltung, mind. 2 Jahre', kind: 'experience', class: 'must', min_years: 2, evidence: ['mehrjährige Berufserfahrung im Bereich Buchhaltung', 'zehn Jahre Konzernerfahrung'] }],
        dropped: ['Fähigkeit, sich in komplexe Fragestellungen reinzudenken'],
      },
    );
    expect(job.requirements[0].evidence).toEqual(['mehrjährige Berufserfahrung im Bereich Buchhaltung']);
    expect(job.requirements[0].class_confirmed).toBe(false);
    expect(job.requirements[0].min_years).toBe(2);
    expect(job.dropped).toHaveLength(1);
  });

  it('Sprachvorgaben vom Anzeigen-Parser gelten nicht als bestätigt', () => {
    const job = assembleJobProfile(
      { ...baseJob, required_languages: [{ language: 'Deutsch', min_level: 'C1', source: 'parser_default' }, { language: 'Englisch', min_level: 'C1', source: 'client' }] },
      { languages: [{ language: 'Englisch', min_level: 'c1', customer_facing: true }] },
    );
    expect(job.languages).toEqual([
      { code: 'de', min_level: 'c1', confirmed: false, customer_facing: false },
      { code: 'en', min_level: 'c1', confirmed: true, customer_facing: true },
    ]);
  });

  it('kaputte KI-Antwort: Profil entsteht trotzdem aus den strukturierten Daten', () => {
    const job = assembleJobProfile({ ...baseJob, salary_min: 50000, salary_max: 60000, location: 'Köln', remote_type: 'hybrid', onsite_days_required: 2 }, 'kein JSON');
    expect(job.families).toEqual([]);
    expect(job.salary).toEqual({ min: 50000, max: 60000, basis: null });
    expect(job.location).toEqual({ city: 'Köln', remote: 'hybrid', onsite_days: 2 });
  });

  it('unbekannte Berufsfamilien und Seniorität werden ignoriert', () => {
    const job = assembleJobProfile(baseJob, { families: ['finance_accounting', 'astronaut'], seniority: 'god_mode' });
    expect(job.families).toEqual(['finance_accounting']);
    expect(job.seniority).toBeNull();
  });
});

describe('Kandidatenprofil', () => {
  it('Kompetenzen der KI nur mit wörtlichem Beleg; Skills der Akte zählen immer', () => {
    const cand = assembleCandidateProfile(
      { job_title: 'Controller', skills: ['SAP CO-OM'], redacted_text: 'Aufbau der Kostenträgerrechnung im Werk.' },
      {
        families: ['controlling'],
        competencies: [
          { name: 'Kostenträgerrechnung', evidence: 'Aufbau der Kostenträgerrechnung im Werk' },
          { name: 'IFRS', evidence: 'IFRS-Konzernabschluss' },
        ],
        qualifications: [],
      },
    );
    expect(cand.competencies.map((c) => c.name)).toEqual(['Kostenträgerrechnung', 'SAP CO-OM']);
  });

  it('Muttersprache wird native, Niveaus werden GER', () => {
    const cand = assembleCandidateProfile({ languages: [{ language: 'Deutsch', proficiency: 'Muttersprache' }, { language: 'Englisch', proficiency: 'fließend' }] }, null);
    expect(cand.languages).toEqual([{ code: 'de', level: 'native' }, { code: 'en', level: 'c1' }]);
  });
});

describe('Zitatprüfung', () => {
  const src = 'Titel: Frontend Developer\nKompetenzen: JavaScript, TypeScript, SQL, Go, Stammdatenpflege, Datenschutz im Gesundheitswesen (DSGVO)';

  it('findet wörtliche Zitate, auch mit Auslassung', () => {
    expect(quoteInSource('Datenschutz im Gesundheitswesen', src)).toBe(true);
    expect(quoteInSource('„Frontend Developer"', src)).toBe(true);
    expect(quoteInSource('JavaScript … Stammdatenpflege', src)).toBe(true);
  });

  it('kurze Fachbegriffe nur als ganzes Wort', () => {
    expect(quoteInSource('SQL', src)).toBe(true);
    expect(quoteInSource('Go', src)).toBe(true);
    expect(quoteInSource('Ty', src)).toBe(false);
  });

  it('Wortteile sind kein Beleg', () => {
    expect(quoteInSource('Java', src)).toBe(false);
    expect(quoteInSource('Pflege', src)).toBe(false);
    expect(quoteInSource('Script', src)).toBe(false);
  });

  it('erfundene Zitate fallen durch', () => {
    expect(quoteInSource('10 Jahre Java-Backend', src)).toBe(false);
    expect(quoteInSource('', src)).toBe(false);
  });
});

describe('verbotene Merkmale', () => {
  it('entfernt Sätze mit Alter, Familie, Herkunft, Überqualifikation', () => {
    for (const bad of ['Sie ist 52 Jahre alt.', 'Hat zwei Kinder.', 'Wirkt überqualifiziert.', 'Staatsangehörigkeit ist unklar.', 'Elternzeit bis März.']) {
      expect(scrubProtected(`Starke Buchhalterin. ${bad} Gute DATEV-Kenntnisse.`)).toEqual({ text: 'Starke Buchhalterin. Gute DATEV-Kenntnisse.', removed: true });
    }
  });

  it('lässt Fachbegriffe stehen', () => {
    for (const ok of ['Datenschutz im Gesundheitswesen belegt.', 'Kinderkrankenpflege als Schwerpunkt.', 'Alternativ SolidWorks.', 'Lediglich SAP fehlt.', 'Datenmigration in S/4HANA.', 'Examen Gesundheits- und Krankenpflege.']) {
      expect(scrubProtected(ok)).toEqual({ text: ok, removed: false });
    }
  });
});

describe('Urteil prüfen', () => {
  const job = assembleJobProfile({ title: 'Pflegefachkraft', client_must: ['Examen Pflegefachkraft', 'Schichtdienst'] }, { families: ['healthcare_nursing'] });
  const cand = assembleCandidateProfile({ job_title: 'Stammdatenmanagerin', skills: ['Stammdatenpflege', 'SAP MDG'] }, { families: ['healthcare_nursing'] });
  const section = buildCandidateSection(cand, '');

  it('Zitate aus der abgeleiteten Einordnung zählen nicht als Beleg', () => {
    const v = verifyJudgement({ requirements: [{ id: 'r1', status: 'met', evidence: 'Berufsfamilie Pflege', note: '' }] }, job, section);
    expect(v.requirements[0].status).toBe('unknown');
    expect(v.rejected_quotes).toBe(1);
  });

  it('fehlende oder fremde IDs: ergänzt als unbekannt, fremde ignoriert', () => {
    const v = verifyJudgement({ requirements: [{ id: 'r99', status: 'met', evidence: 'SAP MDG' }], role_fit: 'bestens' }, job, section);
    expect(v.requirements.map((r) => r.status)).toEqual(['unknown', 'unknown']);
    expect(v.missing_ids).toEqual(['r1', 'r2']);
    expect(v.role_fit).toBe('unknown');
  });

  it('not_met braucht kein Zitat, Notizen werden bereinigt', () => {
    const v = verifyJudgement({ requirements: [{ id: 'r1', status: 'not_met', evidence: 'x', note: 'Kein Examen. Sie ist 50 Jahre alt.' }] }, job, section);
    expect(v.requirements[0]).toEqual({ id: 'r1', status: 'not_met', evidence: '', note: 'Kein Examen.' });
    expect(v.scrubbed).toBe(1);
  });

  it('Listen werden auf 3 Punkte begrenzt', () => {
    const v = verifyJudgement({ strengths: ['a', 'b', 'c', 'd', 'e'] }, job, section);
    expect(v.strengths).toEqual(['a', 'b', 'c']);
  });
});

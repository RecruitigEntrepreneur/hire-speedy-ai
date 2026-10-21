import { describe, it, expect } from 'vitest';
import { BRIEF_COLUMNS } from '../../supabase/functions/_shared/brief-columns';
import { buildBriefingSections, briefingText, getRecruiterCriteria, INTAKE_FIELD_KEYS, type BriefingJob } from './recruiterBriefing';
import { recruiterFeeRange } from './recruiterFee';

const rows = (job: BriefingJob) => buildBriefingSections(job).flatMap(section => section.rows);

describe('Recruiter briefing: retaining intake answers', () => {
  it('covers every persisted question-catalog column, catching future mapping gaps', () => {
    for (const field of BRIEF_COLUMNS) expect(INTAKE_FIELD_KEYS, field.column).toContain(field.column);
    expect(new Set(INTAKE_FIELD_KEYS).size).toBe(INTAKE_FIELD_KEYS.length);
  });
  it('renders every meaningful mapped answer for its contract type', () => {
    const job = Object.fromEntries(INTAKE_FIELD_KEYS.map(key => [key, 'Kundenantwort']));
    Object.assign(job, { task_breakdown: { Controlling: 35 }, works_council: true });
    const displayed = new Set([...rows({ ...job, employment_type: 'full-time' }), ...rows({ ...job, employment_type: 'freelance' })].map(row => row.id));
    expect(displayed).toEqual(new Set(INTAKE_FIELD_KEYS));
  });
  it('preserves false and zero while suppressing unknown defaults and sentinels', () => {
    const actual = rows({ employment_type: 'freelance', extension_possible: false, contract_sent_digitally: false, contract_creation_days: 0, onsite_days_required: 0, candidates_in_pipeline: 0, team_size: -1, reports_to: 'Unbekannt' });
    expect(actual.find(row => row.id === 'extension_possible')?.value).toBe('Nein');
    expect(actual.find(row => row.id === 'contract_sent_digitally')?.value).toBe('Nein');
    expect(actual.find(row => row.id === 'contract_creation_days')?.value).toBe('0 Tage');
    expect(actual.find(row => row.id === 'onsite_days_required')?.value).toContain('remote');
    expect(actual.find(row => row.id === 'candidates_in_pipeline')?.value).toBe('0');
    expect(actual.some(row => ['team_size', 'reports_to'].includes(row.id))).toBe(false);
    expect(rows({ works_council: false })).toHaveLength(0);
  });
  it('never invents locked, confirmed or missing answers from null values', () => {
    expect(rows({ daily_routine: null, company_headcount: null, company_culture: null })).toEqual([]);
    expect(briefingText({ arbitrary: 'object' })).toBe('');
  });
  it('keeps contracting amounts precise and employee-only benefits out of contracting', () => {
    const actual = rows({ employment_type: 'freelance', day_rate_min: 750, day_rate_max: 1200, salary_months: 13, bonus_structure: '10 %', career_path: 'Leitung' });
    expect(actual.find(row => row.id === 'day_rate_min')?.value).toBe('750 € pro Tag');
    expect(actual.find(row => row.id === 'day_rate_max')?.value).toBe('1.200 € pro Tag');
    expect(actual.some(row => ['salary_months', 'bonus_structure', 'career_path'].includes(row.id))).toBe(false);
  });
  it('normalizes languages and keeps complete customer wording', () => {
    const actual = rows({ required_languages: [{ code: 'de', minLevel: 'C1' }, 'Englisch B2'], daily_routine: 'Monatsabschluss.\nDanach die Budgetplanung.' });
    expect(actual.find(row => row.id === 'required_languages')?.value).toBe('Deutsch C1 · Englisch B2');
    expect(actual.find(row => row.id === 'daily_routine')?.value).toContain('\nDanach');
  });
  it('uses the actual 90-day and interview answers instead of unrelated proxies', () => {
    const actual = rows({ daily_routine: 'Monatsabschluss', decision_makers: ['GF'], recruiter_briefing_answers: { deliverable_90d: { value: 'Forecast-Prozess eingeführt' }, interview_process: { value: ['Fachgespräch', 'Geschäftsführung'] } } });
    expect(actual.find(row => row.id === 'deliverable_90d')?.value).toBe('Forecast-Prozess eingeführt');
    expect(actual.find(row => row.id === 'interview_process')?.value).toBe('Fachgespräch · Geschäftsführung');
    expect(rows({ daily_routine: 'Monatsabschluss', decision_makers: ['GF'] }).some(row => ['deliverable_90d', 'interview_process'].includes(row.id))).toBe(false);
  });
  it('does not expose private payload keys or unknown narrative answers', () => {
    const actual = rows({ recruiter_briefing_answers: { deliverable_90d: { unknown: true, value: 'Veraltete Vorbelegung' }, private_contact: { value: 'PRIVATE' } } });
    expect(actual).toEqual([]);
  });
});

describe('Canonical priorities used in both briefing and submission', () => {
  it('does not turn erlernbare skills into mandatory requirements through legacy data', () => {
    const criteria = getRecruiterCriteria({ must_haves: ['HGB', 'DATEV', 'IFRS'], trainable_skills: ['DATEV'], nice_to_have_criteria: ['IFRS'] });
    expect(criteria.required).toEqual(['HGB']);
    expect(criteria.trainable).toEqual(['DATEV']);
    expect(criteria.negotiable).toEqual(['IFRS']);
    expect(criteria.sources.required).toBe('listing');
    expect(criteria.sources.negotiable).toBe('intake');
  });
  it('prefers canonical requirements and removes duplicates and placeholders', () => {
    const criteria = getRecruiterCriteria({ must_have_criteria: [' HGB ', 'hgb', 'Unbekannt'], must_haves: ['Power BI'], nice_to_haves: ['HGB', 'Excel'] });
    expect(criteria.required).toEqual(['HGB']);
    expect(criteria.negotiable).toEqual(['Excel']);
    expect(criteria.sources.required).toBe('intake');
  });
});

describe('Honest fee projection', () => {
  it('shows the range instead of an invented average payout', () => expect(recruiterFeeRange(15, 70000, 85000)).toEqual({ fee: 15, min: 10500, max: 12750 }));
  it('never defaults a missing or zero fee to 15 percent', () => {
    expect(recruiterFeeRange(null, 70000, 85000)).toBeNull();
    expect(recruiterFeeRange(0, 70000, 85000)).toEqual({ fee: 0, min: 0, max: 0 });
  });
  it('handles one-sided ranges and rejects invalid inputs', () => {
    expect(recruiterFeeRange(15, null, 85000)).toEqual({ fee: 15, min: null, max: 12750 });
    expect(recruiterFeeRange(15, 85000, 70000)).toBeNull();
    expect(recruiterFeeRange(15, null, null)).toBeNull();
    expect(recruiterFeeRange(NaN, 70000, 85000)).toBeNull();
  });
});

describe('Der Kandidatenstand steht vorn, nicht hinter dem Aufklappen', () => {
  /**
   * BEFUND (10.09.2026): "2 Kandidaten bereits beim Kunden" und der
   * Absprunggrund standen eingeklappt im letzten Abschnitt. Fuer einen
   * Headhunter ist beides ein Abbruchkriterium, kein Detail.
   */
  const job = {
    employment_type: 'full-time',
    decision_makers: ['Geschäftsführung'],
    contract_creation_days: 2,
    contract_sent_digitally: true,
    hiring_urgency: 'hot',
    candidates_in_pipeline: 2,
    candidates_dropped_reason: 'Eine Kandidatin ist wegen eines Gegenangebots abgesprungen.',
  } as unknown as BriefingJob;

  it('setzt Pipeline und Absprunggrund an den Anfang des Prozessabschnitts', () => {
    const prozess = buildBriefingSections(job).find(s => s.id === 'prozess')!;
    expect(prozess.rows.slice(0, 2).map(r => r.id))
      .toEqual(['candidates_in_pipeline', 'candidates_dropped_reason']);
  });

  it('laesst den Interviewablauf davor, wenn er vorliegt', () => {
    const mitAblauf = { ...job,
      recruiter_briefing_answers: { interview_process: { value: '2 Runden' } } } as unknown as BriefingJob;
    const prozess = buildBriefingSections(mitAblauf).find(s => s.id === 'prozess')!;
    expect(prozess.rows.slice(0, 3).map(r => r.id))
      .toEqual(['interview_process', 'candidates_in_pipeline', 'candidates_dropped_reason']);
  });

  it('bleibt still, wenn nichts davon vorliegt', () => {
    const ohne = { employment_type: 'full-time', decision_makers: ['Geschäftsführung'] } as unknown as BriefingJob;
    const prozess = buildBriefingSections(ohne).find(s => s.id === 'prozess')!;
    expect(prozess.rows.map(r => r.id)).toEqual(['decision_makers']);
  });
});

describe('Recruiter briefing: Muss-Fragen der Aufnahme (20.10.2026)', () => {
  const job = {
    employment_type: 'full-time',
    salary_flex: 'bis 10 % darüber',
    max_notice_period: '3 Monate',
    visa_sponsorship: false,
    interview_process: 'Erstgespräch HR, dann Geschäftsführung',
    recruiter_briefing_answers: { interview_process: { value: 'alter Text aus der alten Aufnahme' } },
    target_companies: ['Beratungen', 'Beispiel GmbH'],
    nogo_companies: ['Unsere Kunden'],
    candidate_concerns: ['Präsenzpflicht'],
    candidate_concerns_answer: 'Gleitzeit gleicht das aus',
  } as unknown as BriefingJob;

  it('zeigt Arbeitserlaubnis als Satz statt Ja/Nein', () => {
    expect(rows(job).find(r => r.id === 'visa_sponsorship')?.value).toBe('Arbeitserlaubnis für Deutschland nötig');
    expect(rows({ ...job, visa_sponsorship: true }).find(r => r.id === 'visa_sponsorship')?.value).toBe('Visum unterstützt der Kunde');
  });

  it('nimmt den Auswahlprozess aus der neuen Spalte und zeigt ihn nur einmal', () => {
    const prozess = rows(job).filter(r => r.id === 'interview_process');
    expect(prozess).toHaveLength(1);
    expect(prozess[0].value).toBe('Erstgespräch HR, dann Geschäftsführung');
  });

  it('stellt Kündigungsfrist und Arbeitserlaubnis im Profil nach vorn', () => {
    const profil = buildBriefingSections(job).find(s => s.id === 'profil')!;
    expect(profil.rows.slice(0, 2).map(r => r.id)).toEqual(['max_notice_period', 'visa_sponsorship']);
  });

  it('lässt verdeckte Felder weg, solange die Sicht sie nicht liefert', () => {
    const vorReveal = { ...job, target_companies: null, nogo_companies: null, candidate_concerns: null, candidate_concerns_answer: null } as BriefingJob;
    const ids = rows(vorReveal).map(r => r.id);
    expect(ids).not.toContain('target_companies');
    expect(ids).not.toContain('candidate_concerns');
    expect(ids).toContain('salary_flex');
  });
});

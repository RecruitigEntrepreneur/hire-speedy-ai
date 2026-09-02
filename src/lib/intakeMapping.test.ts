import { describe, expect, it } from 'vitest';
import {
  EMPTY_BUILT, fromParsedJobData, fromParsedJobProfile, toBriefBuilt,
  buildAiJobDraft, buildIntakePayload, intakeCompleteness,
} from './intakeMapping';
// Das serverseitige Gegenstück. Beide Dateien müssen dieselbe Abbildung
// liefern; Deno kann nicht aus src/ importieren, deshalb die Doppelung — und
// deshalb dieser Test, der beide zusammen prüft.
import { draftToJobRow, draftSummary } from '../../supabase/functions/_shared/intake-mapping';

const parsed = {
  title: 'Senior Cloud Architect',
  company_name: 'Acme GmbH',
  location: 'Frankfurt',
  remote_type: 'hybrid',
  experience_level: 'senior',
  salary_min: 90000,
  salary_max: 110000,
  skills: ['AWS', 'Kubernetes'],
  must_haves: ['AWS'],
  nice_to_haves: ['Terraform'],
  industry: 'IT',
  description: 'Beschreibung',
  requirements: 'Anforderungen',
  vacancy_reason: 'Wachstum',
  reports_to: 'CTO',
  hiring_urgency: 'hoch',
  remote_days: 3,
  unique_selling_points: ['Team'],
} as any;

describe('fromParsedJobData', () => {
  it('übernimmt alle Felder aus dem Parser-Ergebnis', () => {
    const built = fromParsedJobData(parsed);
    expect(built.title).toBe('Senior Cloud Architect');
    expect(built.must_haves).toEqual(['AWS']);
    expect(built.remoteDays).toBe(3);
    expect(built.usps).toEqual(['Team']);
  });

  it('füllt fehlende Felder mit brauchbaren Vorgaben statt undefined', () => {
    const built = fromParsedJobData({} as any);
    expect(built.remote_type).toBe('hybrid');
    expect(built.experience_level).toBe('mid');
    expect(built.skills).toEqual([]);
    expect(built.title).toBe('');
  });
});

describe('fromParsedJobProfile', () => {
  it('bildet die Seniorität des PDF-Parsers auf das eigene Vokabular ab', () => {
    expect(fromParsedJobProfile({ seniority_level: 'principal' } as any).experience_level).toBe('lead');
    expect(fromParsedJobProfile({ seniority_level: 'director' } as any).experience_level).toBe('lead');
    expect(fromParsedJobProfile({ seniority_level: 'unbekannt' } as any).experience_level).toBe('mid');
  });

  it('bildet remote_policy auf remote_type ab', () => {
    expect(fromParsedJobProfile({ remote_policy: 'onsite' } as any).remote_type).toBe('onsite');
    expect(fromParsedJobProfile({ remote_policy: 'remote' } as any).remote_type).toBe('remote');
    expect(fromParsedJobProfile({ remote_policy: 'sonstiges' } as any).remote_type).toBe('hybrid');
  });
});

describe('buildAiJobDraft', () => {
  const base = {
    type: 'full-time' as const,
    built: { ...EMPTY_BUILT, title: 'X', skills: Array.from({ length: 30 }, (_, i) => `s${i}`) },
    freelance: { dayRateMin: null, dayRateMax: null, durationMonths: null, utilizationDaysPerWeek: null, extensionPossible: true },
    flexibility: {},
  };

  it('deckelt die Skill-Liste — sonst wächst der Prompt unbegrenzt', () => {
    expect((buildAiJobDraft(base).skills as string[]).length).toBe(15);
  });

  it('sendet den Tagessatz nur im Contracting-Zweig', () => {
    expect(buildAiJobDraft(base).day_rate).toBeUndefined();
    const freelance = buildAiJobDraft({
      ...base, type: 'freelance',
      freelance: { ...base.freelance, dayRateMin: 800, dayRateMax: 950 },
    });
    expect(freelance.day_rate).toEqual({ min: 800, max: 950 });
  });

  it('reicht company_defaults durch — die KI darf Bekanntes nicht erneut fragen', () => {
    const draft = buildAiJobDraft({ ...base, companyDefaults: { industry: 'IT', size: '200' } });
    expect(draft.company_defaults).toEqual({ industry: 'IT', size: '200' });
  });
});

describe('buildIntakePayload', () => {
  const state = {
    type: 'freelance' as const,
    built: { ...EMPTY_BUILT, title: 'X', usps: ['A'] },
    answers: { q1: { value: 'ja' } },
    freelance: { dayRateMin: 800, dayRateMax: 900, durationMonths: 6, utilizationDaysPerWeek: 4, extensionPossible: true },
    flexibility: { AWS: 'fix' as const },
    revealSetup: { descriptor: 'IT, Rhein-Main', trigger: 'after_first_interview' as const },
    dyn: {
      available: true, answers: [], askedIds: [], completeness: 80, chapterProgress: [],
      typedFields: { required_languages: [{ code: 'de', minLevel: 'C1' }] },
      skillRequirements: [{ skill: 'AWS', kind: 'must' as const }], skillSuggestions: [],
      payloadPatch: { note: 'x' }, envelopePatch: {}, tensionFlags: [], done: false,
    },
  };

  it('enthält kein draft_state — der gehört in intake_drafts, nicht in jobs', () => {
    const payload = buildIntakePayload({ source: 'guest_intake', state, briefingText: 'Text' });
    expect(payload).not.toHaveProperty('draft_state');
  });

  it('legt die Contracting-Konditionen ab und markiert die Herkunft', () => {
    const payload = buildIntakePayload({ source: 'guest_intake', state, briefingText: null });
    expect((payload.contracting as any).dayRateMin).toBe(800);
    expect(payload.source).toBe('guest_intake');
    expect(payload.briefing_text).toBeNull();
  });

  it('lässt bei Festanstellung kein Contracting-Objekt zurück', () => {
    const payload = buildIntakePayload({
      source: 'studio', state: { ...state, type: 'full-time' }, briefingText: null,
    });
    expect(payload.contracting).toBeNull();
  });
});

describe('intakeCompleteness', () => {
  it('nimmt die KI-Bewertung, wenn die KI erreichbar war', () => {
    expect(intakeCompleteness({ available: true, completeness: 82 } as any, 40)).toBe(82);
  });
  it('fällt sonst auf den gezählten Fortschritt zurück', () => {
    expect(intakeCompleteness({ available: false, completeness: 82 } as any, 40)).toBe(40);
    expect(intakeCompleteness({ available: null, completeness: 82 } as any, 40)).toBe(40);
  });
});

/**
 * Die serverseitige Abbildung. Sie entscheidet, ob eine Angabe des Kunden in
 * der jobs-Zeile ankommt — oder still verschwindet.
 */
describe('draftToJobRow (Server)', () => {
  const draft = {
    contract_type: 'full-time',
    completeness: 78,
    company_name: 'Acme',
    company_legal_name: 'Acme GmbH',
    built: {
      title: 'Senior Cloud Architect', location: 'Frankfurt', remote_type: 'hybrid',
      experience_level: 'senior', salary_min: 90000, salary_max: 110000,
      skills: ['AWS', ' ', 'K8s'], must_haves: ['AWS'], nice_to_haves: [],
      description: 'D', requirements: 'R', vacancyReason: 'Wachstum',
      reportsTo: 'CTO', hiringUrgency: 'hoch', remoteDays: 3,
    },
    dyn: {
      typedFields: { visa_sponsorship: true, experience_min: 5, search_difficulty: 'high', target_companies: ['X'] },
      envelopePatch: { green_list: ['Branche'] },
    },
    reveal_setup: { descriptor: 'IT, Rhein-Main', trigger: 'offer' },
    intake_payload: { briefing_text: 'Briefing' },
    skill_requirements: [{ skill: 'AWS', kind: 'must' }],
  };

  it('nimmt die vollständige Firmierung, nicht den Alltagsnamen', () => {
    expect(draftToJobRow(draft).company_name).toBe('Acme GmbH');
  });

  it('setzt niemals den Platzhalter des Dashboard-Studios', () => {
    // JobIntakeStudio.tsx:342 setzt bei leerem Feld "Mein Unternehmen" — hier
    // ist der Firmenname erhoben und geprüft, ein Platzhalter wäre ein Fehler.
    const row = draftToJobRow({ ...draft, company_name: null, company_legal_name: null, built: { title: 'X' } });
    expect(row.company_name).toBeUndefined();
  });

  it('rechnet Homeoffice-Tage in Bürotage um', () => {
    expect(draftToJobRow(draft).onsite_days_required).toBe(2);
  });

  it('lässt onsite_days_required bei reinem Remote weg', () => {
    const row = draftToJobRow({ ...draft, built: { ...draft.built, remote_type: 'remote' } });
    expect(row.onsite_days_required).toBeUndefined();
  });

  it('übernimmt die typisierten Matching-Felder aus der KI-Normalisierung', () => {
    const row = draftToJobRow(draft);
    expect(row.visa_sponsorship).toBe(true);
    expect(row.experience_min).toBe(5);
    expect(row.search_difficulty).toBe('high');
    expect(row.target_companies).toEqual(['X']);
  });

  it('wirft leere Skill-Einträge weg statt sie zu speichern', () => {
    expect(draftToJobRow(draft).skills).toEqual(['AWS', 'K8s']);
  });

  it('schreibt Contracting-Konditionen in typisierte Spalten, nicht nur nach JSON', () => {
    // Ohne das ginge eine Freelance-Stelle ganz ohne Vergütungsangabe an die
    // Recruiter — genau der Befund aus 20260829120000.
    const row = draftToJobRow({
      ...draft, contract_type: 'freelance',
      freelance: { dayRateMin: 800, dayRateMax: 950, durationMonths: 6, utilizationDaysPerWeek: 4, extensionPossible: true },
    });
    expect(row.day_rate_min).toBe(800);
    expect(row.day_rate_max).toBe(950);
    expect(row.contract_duration_months).toBe(6);
    expect(row.utilization_days_per_week).toBe(4);
    expect(row.extension_possible).toBe(true);
    // und kein Gehalt
    expect(row.salary_min).toBeUndefined();
    expect(row.salary_max).toBeUndefined();
  });

  it('setzt niemals client_id — die entsteht ausschließlich im INSERT-Pfad', () => {
    expect(draftToJobRow(draft)).not.toHaveProperty('client_id');
    expect(draftToJobRow(draft)).not.toHaveProperty('organization_id');
    expect(draftToJobRow(draft)).not.toHaveProperty('status');
  });

  it('trägt den Reveal-Descriptor in die Hülle', () => {
    const row = draftToJobRow(draft) as any;
    expect(row.reveal_trigger).toBe('offer');
    expect(row.reveal_envelope.descriptor).toBe('IT, Rhein-Main');
    expect(row.reveal_envelope.green_list).toEqual(['Branche']);
  });

  it('nimmt den Entwurfszustand nicht mit nach jobs', () => {
    expect((draftToJobRow(draft).intake_payload as any).draft_state).toBeNull();
  });
});

describe('draftSummary', () => {
  it('formatiert Gehalt und Tagessatz unterschiedlich', () => {
    const fest = draftSummary({ contract_type: 'full-time', built: { title: 'X', salary_min: 90000, salary_max: 110000 }, company_name: 'A' });
    expect(fest.compensation).toContain('€ p. a.');
    const frei = draftSummary({ contract_type: 'freelance', freelance: { dayRateMin: 800, dayRateMax: 950 }, built: { title: 'X' }, company_name: 'A' });
    expect(frei.compensation).toContain('€ / Tag');
  });

  it('gibt null zurück, wenn nichts angegeben ist — statt "0 €"', () => {
    expect(draftSummary({ contract_type: 'full-time', built: {}, company_name: 'A' }).compensation).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { BRIEF_QUESTIONS } from './briefCatalog';
import {
  EMPTY_BUILT, catalogFromParsed, flexibilityFromParsed, freelanceFromParsed,
  fromParsedJobData, fromParsedJobProfile,
  toBriefBuilt,
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

describe('catalogFromParsed', () => {
  /* Neun Felder las der Parser und niemand packte sie aus, weil BuiltJob
     keine Spalte dafuer hat. Sichtbar war das an der Frage nach dem
     Arbeitsalltag: leeres Feld, obwohl die Anzeige die Aufgaben trug. */
  it('reicht die Briefing-Felder an den Katalog weiter', () => {
    const k = catalogFromParsed({
      ...parsed,
      daily_routine: 'Betrieb der Cloud-Plattform',
      core_hours: 'Kernarbeitszeit 9 bis 15 Uhr',
      company_culture: 'Du-Kultur',
      career_path: 'Lead Architect',
      team_size: 8,
    } as any);
    expect(k.daily_routine.value).toBe('Betrieb der Cloud-Plattform');
    expect(k.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(k.career_path.value).toBe('Lead Architect');
    // Alles aus der Anzeige gilt als Vorschlag, nicht als Antwort.
    expect(k.daily_routine.from).toBe('ad');
  });

  it('verwirft, was kein Chip trifft, statt es unsichtbar zu speichern', () => {
    // Gemessen am 07.09.2026: ueber fuenf unmarkierten Chips stand "aus der
    // Anzeige gelesen -- bitte pruefen".
    const k = catalogFromParsed({
      vacancy_reason: 'Wir suchen jemanden',      // trifft nichts -> weg
      core_hours: 'irgendwie halt',               // trifft nichts -> weg
      company_culture: 'Wir duzen uns',           // Textfeld -> bleibt
    } as any);
    expect(k.vacancy_reason).toBeUndefined();
    expect(k.core_hours).toBeUndefined();
    expect(k.company_culture.value).toBe('Wir duzen uns');
  });

  it('trifft die Chips ueber Schlagworte, wo die Anzeige einen Satz schreibt', () => {
    const k = catalogFromParsed({
      vacancy_reason: 'Nachfolge für unseren Konstruktionsleiter, der in den Ruhestand geht',
      core_hours: '9 bis 15 Uhr',   // so gibt der Parser es zurueck, ohne das Wort
      overtime_policy: 'Gleitzeitkonto mit vollem Überstundenausgleich',
    } as any);
    expect(k.vacancy_reason.value).toBe('Nachfolge / Ruhestand');
    expect(k.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(k.overtime_policy.value).toBe('ausgeglichen (Freizeit)');
  });

  /* Der Chip beantwortet die Kategorie, nicht die Frage des Kandidaten.
     Vor dieser Zeile las die Aufnahme "Kernarbeitszeit 9 bis 15 Uhr" und
     behielt davon "Gleitzeit mit Kernzeit" -- die Uhrzeit war weg, und der
     Recruiter konnte sie niemandem nennen. */
  it('hebt die Uhrzeit aus dem Chiptext in die Folgezeile', () => {
    const k = catalogFromParsed({ core_hours: 'Kernarbeitszeit 9 bis 15 Uhr' } as any);
    expect(k.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(k.core_hours_detail.value).toBe('9 bis 15 Uhr');
    expect(k.core_hours_detail.from).toBe('ad');
  });

  it('erfindet keine Uhrzeit, wo die Anzeige keine nennt', () => {
    // "Gleitzeit mit Kernzeit" ohne Zahl darf die Folgezeile nicht vorbelegen.
    const ohne = catalogFromParsed({ core_hours: 'Gleitzeit mit Kernzeit' } as any);
    expect(ohne.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(ohne.core_hours_detail).toBeUndefined();

    // Und was keinen Chip trifft, belegt auch die Folgezeile nicht.
    const wirr = catalogFromParsed({ core_hours: 'irgendwie halt' } as any);
    expect(wirr.core_hours_detail).toBeUndefined();
  });

  it('haelt die Schichten zusammen, statt sie neu zu setzen', () => {
    const k = catalogFromParsed({ core_hours: 'Schichtbetrieb 6-14 / 14-22 Uhr' } as any);
    expect(k.core_hours.value).toBe('Schichtbetrieb');
    expect(k.core_hours_detail.value).toBe('6-14 / 14-22 Uhr');
  });

  it('haelt Wochenstunden nicht fuer eine Uhrzeit', () => {
    // "40 bis 45 Stunden" waere sonst als Kernzeit von 40 bis 45 Uhr gelandet.
    const k = catalogFromParsed({ core_hours: 'Vertrauensarbeitszeit, 40 bis 45 Stunden' } as any);
    expect(k.core_hours_detail).toBeUndefined();
  });

  it('behaelt die ganze Zeitangabe, wenn der Parser die Kategorie weglaesst', () => {
    // "9 bis 15 Uhr" trifft den Chip ueber ein Schlagwort, nicht woertlich --
    // dann darf nichts abgeschnitten werden.
    const k = catalogFromParsed({ core_hours: '9 bis 15 Uhr' } as any);
    expect(k.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(k.core_hours_detail.value).toBe('9 bis 15 Uhr');
  });

  /* "rund 340 Mitarbeitende" wurde zu "250-1.000", und die 340 war weg --
     eine Spanne mit Faktor vier, die der Kunde dann auch noch bestaetigte. */
  it('behaelt die Mitarbeiterzahl neben ihrer Klasse', () => {
    const k = catalogFromParsed({ company_size_estimate: 'rund 340 Mitarbeitende' } as any);
    expect(k.company_headcount.value).toBe(340);
    expect(k.company_size_band.value).toBe('250\u20131.000');
  });

  it('erfindet keine Zahl, wo die Anzeige eine Spanne nennt', () => {
    // Aus "200 bis 400" eine gemittelte 300 zu machen waere eine Genauigkeit,
    // die niemand behauptet hat. Das Band traegt dann die Auskunft allein.
    const spanne = catalogFromParsed({ company_size_estimate: '200 bis 400 Mitarbeitende' } as any);
    expect(spanne.company_headcount).toBeUndefined();
    expect(spanne.company_size_band.value).toBe('250\u20131.000');

    const offen = catalogFromParsed({ company_size_estimate: 'ueber 5.000' } as any);
    expect(offen.company_headcount).toBeUndefined();

    const wort = catalogFromParsed({ company_size_estimate: 'Konzern' } as any);
    expect(wort.company_headcount).toBeUndefined();
    expect(wort.company_size_band.value).toBe('mehr als 5.000');
  });

  /**
   * Der Kern der Erweiterung vom 09.09.2026: die Anzeige muss den Chip nicht
   * woertlich treffen. Gemessen wurde vorher, dass 22 von 39 Feldern leer
   * blieben, obwohl die Anzeige zu jedem etwas sagte.
   */
  it('trifft die Befristung, egal wie sie formuliert ist', () => {
    const b = (t: string) => catalogFromParsed({ contract_limitation: t } as any).contract_limitation?.value;
    expect(b('unbefristet')).toBe('unbefristet');
    expect(b('Eine dauerhafte Festanstellung')).toBe('unbefristet');
    // "mit Aussicht" muss vor dem blossen "befristet" greifen.
    expect(b('zunächst befristet, mit Aussicht auf Übernahme')).toBe('befristet_mit_aussicht');
    expect(b('auf 2 Jahre befristet')).toBe('befristet');
    expect(b('Projektvertrag für die Dauer des Projekts')).toBe('projekt');
    expect(b('Wir freuen uns auf Sie')).toBeUndefined();
  });

  it('trifft Zeiterfassung und Betriebsrat aus freier Formulierung', () => {
    const k = catalogFromParsed({
      time_tracking_method: 'Erfassung über unser digitales Zeitwirtschaftssystem',
      works_council: true,
      works_council_meeting_schedule: 'Das Gremium kommt einmal im Monat zusammen',
    } as any);
    expect(k.time_tracking_method.value).toBe('digital');
    expect(k.works_council.value).toBe(true);
    expect(k.works_council_meeting_schedule.value).toBe('Monatlich');
  });

  it('ordnet jeden Entscheider einzeln zu, nicht die Liste als Ganzes', () => {
    // Vorher lief die Liste durch String(roh): aus zwei Entscheidern wurde ein
    // Text, und der erste passende Ausdruck gewann fuer beide.
    const k = catalogFromParsed({
      decision_makers: ['Bereichsleitung', 'Personalabteilung'],
    } as any);
    expect(k.decision_makers.value).toEqual(['Fachbereich', 'HR']);
  });

  it('erkennt sensible Vertragsthemen im Fliesstext', () => {
    const k = catalogFromParsed({
      contract_sensitive_topics: [
        'nachvertragliches Wettbewerbsverbot von zwölf Monaten',
        'Rückzahlung der Weiterbildungskosten bei Eigenkündigung',
      ],
    } as any);
    expect(k.contract_sensitive_topics.value)
      .toEqual(['Wettbewerbsverbot', 'Rückzahlungsklausel (Weiterbildung)']);
  });

  it('rundet den Bonus auf die Stufe, die dem Kandidaten nichts wegnimmt', () => {
    const b = (p: number) => catalogFromParsed({ bonus_percent: p } as any).bonus_structure?.value;
    expect(b(0)).toBe('Nein');
    expect(b(8)).toBe('bis 10 %');    // nicht "Nein"
    expect(b(15)).toBe('bis 20 %');   // nicht "bis 10 %"
    expect(b(30)).toBe('mehr als 20 %');
  });

  it('nimmt Monatsgehälter und Vertragstempo als Zahl', () => {
    const k = catalogFromParsed({ salary_months: 13.5, contract_creation_days: 3 } as any);
    expect(k.salary_months.value).toBe(13.5);
    expect(k.contract_creation_days.value).toBe(3);
  });

  it('macht aus der Aufgabenliste ein Objekt für die Spalte', () => {
    // Der Parser liefert eine Liste, damit er die Form ueberhaupt fuellen
    // kann; die Karte des Recruiters liest {Bereich: Anteil}.
    const k = catalogFromParsed({
      task_breakdown: [
        { bereich: 'Führung', anteil: 60 },
        { bereich: 'Projektarbeit', anteil: 30 },
        { bereich: 'Betrieb', anteil: 10 },
      ],
    } as any);
    expect(k.task_breakdown.value).toEqual({ 'Führung': 60, Projektarbeit: 30, Betrieb: 10 });
  });

  it('schreibt keine leere Gewichtung', () => {
    expect(catalogFromParsed({ task_breakdown: [] } as any).task_breakdown).toBeUndefined();
    expect(catalogFromParsed({ task_breakdown: [{ bereich: '', anteil: 5 }] } as any).task_breakdown)
      .toBeUndefined();
  });

  it('holt Branchenchancen UND -herausforderungen, nicht nur das Positive', () => {
    const k = catalogFromParsed({
      industry_opportunities: 'Auftragsbücher bis 2028 gefüllt',
      industry_challenges: 'Lieferzeiten über 30 Wochen',
    } as any);
    expect(k.industry_opportunities.value).toBe('Auftragsbücher bis 2028 gefüllt');
    expect(k.industry_challenges.value).toBe('Lieferzeiten über 30 Wochen');
  });

  it('ordnet die Berichtslinie zu, ohne ein zweites Modell zu brauchen', () => {
    const an = (v: string) => catalogFromParsed({ reports_to: v } as any).reports_to?.value;
    expect(an('Technischen Geschäftsführer')).toBe('Geschäftsführung');
    expect(an('Head of Engineering')).toBe('Bereichsleitung');
    expect(an('Teamleiter Konstruktion')).toBe('Teamleitung');
    expect(an('an das Kollegium')).toBeUndefined();
  });

  it('reicht Rohzahlen durch, statt sie auf Stufen zu runden', () => {
    /* Vorher landeten acht Personen auf 10, weil der Chip "6-15" hiess und
       10 speicherte. Der Recruiter las eine Zahl, die niemand gesagt hatte.
       Seit die Zeile ein Zahlenfeld ist, gibt es nichts zu runden. */
    expect(catalogFromParsed({ team_size: 8 } as any).team_size.value).toBe(8);
    expect(catalogFromParsed({ team_size: 1 } as any).team_size.value).toBe(1);
    expect(catalogFromParsed({ team_size: 42 } as any).team_size.value).toBe(42);
    expect(catalogFromParsed({ team_size: 0 } as any).team_size).toBeUndefined();

    // Der Chip fragt "Homeoffice-Tage pro Woche" und traegt genau die Zahl.
    // Vorher stand bei zwei Homeoffice-Tagen der Chip 3 markiert.
    expect(catalogFromParsed({ remote_days: 2 } as any).remote_days.value).toBe(2);
    // Fuenf Tage haben seit heute einen eigenen Chip -- vorher endete die
    // Reihe bei 3 und eine Vollremote-Stelle hatte gar keinen.
    expect(catalogFromParsed({ remote_days: 5 } as any).remote_days.value).toBe(5);

    expect(catalogFromParsed({ hiring_deadline_weeks: 2 } as any).hiring_deadline.value)
      .toBe('So schnell wie möglich');
  });

  it('uebersetzt jedes Groessensignal in eine Chip-Bande', () => {
    const band = (v: unknown) =>
      catalogFromParsed({ company_size_estimate: v } as any).company_size_band?.value;
    expect(band('340')).toBe('250–1.000');
    expect(band('51-200')).toBe('50–250');   // Spanne ueber die Mitte
    expect(band('1000+')).toBe('1.000–5.000'); // offenes Ende, nicht auf der Grenze
    expect(band('Konzern')).toBe('mehr als 5.000');
    expect(band('irgendwas')).toBeUndefined(); // lieber nichts als falsch
    // "Mittelstand" reicht von 50 bis ueber 3.000 -- das ist keine Bande.
    expect(band('Mittelstand')).toBeUndefined();
  });

  it('nimmt nur einen Schwerpunkt, der einen Chip trifft', () => {
    const fokus = (v: string) => catalogFromParsed({ task_focus: v } as any).task_focus?.value;
    expect(fokus('Operativ / hands-on')).toBe('Operativ / hands-on');
    expect(fokus('operativ')).toBeUndefined();
  });

  it('laesst Geldfelder im Formular, nicht im Katalog', () => {
    // Beide sind blocksSubmit und stehen links als Eingabe. Im Katalog wuerden
    // sie die Formularspiegelung ueberschreiben und die Freigabe entsperren,
    // ohne dass der Kunde die Zahl je gesehen hat.
    const k = catalogFromParsed({ salary_min: 90000, day_rate_min: 700 } as any);
    expect(k.salary_range).toBeUndefined();
    expect(k.day_rate_range).toBeUndefined();
  });

  it('reicht den Tagessatz an das Contracting-Formular durch', () => {
    expect(freelanceFromParsed({ day_rate_min: 700, day_rate_max: 900 } as any))
      .toEqual({ dayRateMin: 700, dayRateMax: 900 });
    expect(freelanceFromParsed({ salary_min: 90000 } as any)).toBeNull();
  });

  it('prüft im Contracting gegen die Contracting-Chips', () => {
    // Dieselbe Anzeige, zwei Vertragsarten, zwei Vokabulare. Ohne die
    // Vertragsart pruefte der Filter gegen die Festanstellungs-Chips, und
    // der Wert fiele im Contracting unsichtbar durch.
    const fest = catalogFromParsed({ core_hours: 'Kernarbeitszeit 9 bis 15 Uhr' } as any, 'full-time');
    const frei = catalogFromParsed({ core_hours: 'Kernarbeitszeit 9 bis 15 Uhr' } as any, 'freelance');
    expect(fest.core_hours.value).toBe('Gleitzeit mit Kernzeit');
    expect(frei.core_hours.value).toBe('Kernzeiten einzuhalten');

    // Und ein Vakanzgrund, den es nur in der Festanstellung gibt.
    const ruhe = { vacancy_reason: 'Nachfolge für den Kollegen, der in Ruhestand geht' } as any;
    expect(catalogFromParsed(ruhe, 'full-time').vacancy_reason.value).toBe('Nachfolge / Ruhestand');
    expect(catalogFromParsed(ruhe, 'freelance').vacancy_reason).toBeUndefined();
  });

  it('schreibt nichts fuer Zeilen, die es in dieser Vertragsart nicht gibt', () => {
    // career_path gehoert zur Foerderungsfrage -- die entfaellt im Contracting.
    const d = { career_path: 'Perspektivisch Teamleitung' } as any;
    expect(catalogFromParsed(d, 'full-time').career_path.value).toBe('Perspektivisch Teamleitung');
    expect(catalogFromParsed(d, 'freelance').career_path).toBeUndefined();
  });

  it('nimmt jeden Chip an, den der Katalog fuer den Schwerpunkt fuehrt', () => {
    // Driftschutz: weichen Parser-Enum und Katalog-Chips auseinander, faellt
    // der Wert stumm auf den Boden.
    const chips = BRIEF_QUESTIONS.flatMap((q) => q.slots)
      .find((s) => s.key === 'task_focus')?.chips ?? [];
    expect(chips.length).toBe(4);
    for (const c of chips) {
      expect(catalogFromParsed({ task_focus: c } as any).task_focus?.value).toBe(c);
    }
  });

  it('laesst Leeres weg, statt leere Werte einzutragen', () => {
    const k = catalogFromParsed({ daily_routine: '  ', unique_selling_points: [] } as any);
    expect(Object.keys(k)).toEqual([]);
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

/**
 * Die Einstufung der Kriterien war der teuerste stille Verlust: der Kunde
 * klickt 13-mal, und in der Stelle stand davon nichts.
 */
/* "frei waehlbar" legte fuenf Homeoffice-Tage ab, daraus wurde
   onsite_days_required = 0, und der Recruiter las eine Vollremote-Stelle. */
describe('flexibilityFromParsed', () => {
  const built = { must_haves: ['SAP ERP', 'Führungserfahrung'], nice_to_haves: ['ITIL'] };

  it('macht aus der Klassifizierung der Anzeige eine Einstufung', () => {
    const f = flexibilityFromParsed({
      requirements_classified: [
        { text: 'Erfahrung im Betrieb von SAP ERP', skill: 'SAP ERP', kind: 'technology', required: true },
        { text: 'Führungserfahrung mit mindestens fünf Mitarbeitenden', skill: 'Führungserfahrung', kind: 'experience', required: true },
        { text: 'ITIL von Vorteil', skill: 'ITIL', kind: 'method', required: false },
      ],
    } as any, built);
    expect(f).toEqual({ 'SAP ERP': 'fix', 'Führungserfahrung': 'fix', ITIL: 'negotiable' });
  });

  it('lässt Kriterien weg, die gar nicht in der Liste stehen', () => {
    // Eine Einstufung fuer etwas, das nicht angezeigt wird, waere unsichtbar.
    const f = flexibilityFromParsed({
      requirements_classified: [{ text: 'Kubernetes', skill: 'Kubernetes', kind: 'technology', required: true }],
    } as any, built);
    expect(f).toEqual({});
  });

  it('lässt eine Pflicht nicht von einem späteren "verhandelbar" überschreiben', () => {
    const f = flexibilityFromParsed({
      requirements_classified: [
        { text: 'SAP ERP', skill: 'SAP ERP', kind: 'technology', required: true },
        { text: 'SAP ERP Kenntnisse von Vorteil', skill: 'SAP ERP', kind: 'technology', required: false },
      ],
    } as any, built);
    expect(f['SAP ERP']).toBe('fix');
  });

  it('macht aus dem Lernversprechen der Anzeige "lernbar"', () => {
    /* Gemessen am 09.09.2026: eine Anzeige mit dem Abschnitt "Nachschulbar
       bei uns" stufte alle drei Punkte als verhandelbar ein -- "nicht
       erforderlich" und "bringen wir dir bei" sind fuer das Modell dasselbe,
       fuer den Headhunter nicht. */
    const f = flexibilityFromParsed({
      requirements_classified: [
        { text: 'ITIL von Vorteil', skill: 'ITIL', kind: 'method', required: false },
      ],
      trainable_skills: ['ITIL'],
    } as any, built);
    expect(f.ITIL).toBe('flexible');
  });

  it('lässt eine Pflicht auch vom Lernversprechen nicht überschreiben', () => {
    const f = flexibilityFromParsed({
      requirements_classified: [
        { text: 'SAP ERP', skill: 'SAP ERP', kind: 'technology', required: true },
      ],
      trainable_skills: ['SAP ERP'],
    } as any, built);
    expect(f['SAP ERP']).toBe('fix');
  });

  it('kommt ohne das Feld aus', () => {
    expect(flexibilityFromParsed({} as any, built)).toEqual({});
  });
});

describe('draftToJobRow: frei waehlbare Homeoffice-Tage', () => {
  const mitRemote = (wert: unknown) =>
    draftToJobRow({
      contract_type: 'full-time', built: { title: 'T' },
      dyn: { catalog: { known: { remote_days: { value: wert, from: 'answer' } } } },
    } as any);

  it('meldet die freie Wahl und schreibt keine Praesenztage', () => {
    const row = mitRemote('frei wählbar');
    expect(row.remote_days_flexible).toBe(true);
    expect(row.onsite_days_required).toBeUndefined();
  });

  it('haelt eine feste Zahl davon getrennt', () => {
    const row = mitRemote(5);
    expect(row.remote_days_flexible).toBeUndefined();
    expect(row.onsite_days_required).toBe(0);   // fuenf Tage Homeoffice
    expect(mitRemote(2).onsite_days_required).toBe(3);
  });
});

describe('draftToJobRow: Einstufung der Kriterien', () => {
  const mitFlex = (flexibility: Record<string, string>) =>
    draftToJobRow({
      contract_type: 'full-time',
      built: { title: 'T' },
      flexibility,
    } as any);

  it('macht aus der Einstufung Muss-Kriterien und Nachschulbares', () => {
    const row = mitFlex({
      Kubernetes: 'fix', Terraform: 'fix',
      Azure: 'negotiable', AWS: 'flexible', Go: 'flexible',
    });
    expect(row.must_have_criteria).toEqual(['Kubernetes', 'Terraform']);
    expect(row.trainable_skills).toEqual(['AWS', 'Go']);
    expect(row.nice_to_have_criteria).toEqual(['Azure']);
  });

  it('trennt die drei Stufen sauber, ohne Ueberschneidung', () => {
    const row = mitFlex({ A: 'fix', B: 'negotiable', C: 'flexible' });
    expect(row.must_have_criteria).toEqual(['A']);
    expect(row.nice_to_have_criteria).toEqual(['B']);
    expect(row.trainable_skills).toEqual(['C']);
  });

  it('schreibt keine leeren Listen, wo nichts eingestuft ist', () => {
    const row = mitFlex({ Azure: 'negotiable' });
    expect(row.must_have_criteria).toBeUndefined();
    expect(row.trainable_skills).toBeUndefined();
    expect(row.nice_to_have_criteria).toEqual(['Azure']);
  });

  it('kommt ohne flexibility aus', () => {
    const row = draftToJobRow({ contract_type: 'full-time', built: { title: 'T' } } as any);
    expect(row.must_have_criteria).toBeUndefined();
  });

  it('laesst den Katalog gewinnen, wo er die Liste selbst traegt', () => {
    // Sonst wuerde eine spaetere Katalogantwort von der Einstufung
    // ueberschrieben -- die Rangfolge ist dieselbe wie bei vacancy_reason.
    const row = draftToJobRow({
      contract_type: 'full-time',
      built: { title: 'T' },
      flexibility: { Kubernetes: 'fix' },
      dyn: { catalog: { known: { must_have_criteria: { value: ['SPS'], from: 'answer' } } } },
    } as any);
    expect(row.must_have_criteria).toEqual(['SPS']);
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

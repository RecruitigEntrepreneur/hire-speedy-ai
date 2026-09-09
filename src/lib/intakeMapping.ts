/**
 * Reine Abbildungen der Jobaufnahme — ohne React, ohne Supabase, ohne Auth.
 *
 * Herausgezogen aus src/components/dashboard/JobIntakeStudio.tsx, damit der
 * Dashboard-Weg und die login-freie Aufnahme über /start/:token dieselbe
 * Abbildung benutzen. Ein zweiter Mapper wäre der dritte parallele Intake-Pfad
 * gewesen — das Repo trägt schon zwei (Studio und CreateJob), die
 * unterschiedliche Feldsets in dieselbe jobs-Tabelle schreiben.
 *
 * Serverseitiges Gegenstück: supabase/functions/_shared/intake-mapping.ts.
 * Es bildet denselben Entwurf auf die jobs-Zeile ab; Deno kann nicht aus src/
 * importieren. Wer hier etwas ändert, ändert es dort mit.
 */
import { chipTreffer, sizeBand } from './briefCatalog';
import type { ParsedJobData } from '@/hooks/useJobParsing';
import type { ParsedJobProfile } from '@/hooks/useJobPdfParsing';
import type { BuiltJob, FreelanceTerms, RevealSetup } from '@/components/dashboard/intake/types';
import type { Answers, BriefBuilt } from '@/components/dashboard/IntakeBriefing';
import type { DynState } from '@/components/dashboard/intake/DynamicBriefing';
import type { FlexibilityMap } from '@/components/dashboard/intake/ProfileSections';

/**
 * Leerer Entwurf für den manuellen Einstieg ("Ohne Vorlage starten").
 *
 * M1 aus INTAKE_UMSETZUNG_WELLE_A.md:52-79. Für die login-freie Aufnahme ist
 * das keine Bequemlichkeit, sondern die Rückfallebene: sind parse-job-url oder
 * intake-questions nicht erreichbar, hat ein Gast kein Dashboard, in das er
 * ausweichen könnte. Ohne manuellen Weg wäre die Aufnahme dann ein Totalausfall.
 */
export const EMPTY_BUILT: BuiltJob = {
  title: '',
  company_name: '',
  location: '',
  remote_type: 'hybrid',
  experience_level: 'mid',
  salary_min: null,
  salary_max: null,
  skills: [],
  must_haves: [],
  nice_to_haves: [],
  industry: '',
  description: '',
  requirements: '',
  vacancyReason: null,
  reportsTo: null,
  hiringUrgency: null,
  remoteDays: null,
  usps: [],
  benefits: [],
};

/** Ergebnis von parse-job-url (Text oder Link) in den Studio-Zustand. */
/**
 * Platzhalter des Modells, die wie eine Antwort aussehen.
 *
 * BEFUND (08.09.2026, Durchklick als Fachbereichsleiter): Wer die Rolle in
 * eigenen Worten beschreibt, nennt seine Firma oft nicht -- er weiss ja, wo er
 * arbeitet. Der Parser-Prompt verlangt aber einen Firmennamen und schreibt
 * sonst "Unbekannt" hinein. Genau dieser String landete im PFLICHTFELD
 * Firmenname, die Pruefung war zufrieden, und auf der Vereinbarung haette
 * "Unbekannt" gestanden. Schlimmer noch: ein gefuelltes Feld korrigiert
 * niemand.
 *
 * Ein Platzhalter ist keine Antwort. Er wird hier zu leer -- dann greift die
 * Pflichtpruefung, und der Kunde wird gefragt.
 */
const PLATZHALTER = /^(unbekannt|unknown|n\/?a|keine angabe|nicht angegeben|-{1,3})$/i;
const echt = (v: string | null | undefined) => {
  const t = String(v ?? '').trim();
  return t && !PLATZHALTER.test(t) ? t : '';
};

export function fromParsedJobData(d: ParsedJobData): BuiltJob {
  return {
    title: echt(d.title),
    company_name: echt(d.company_name),
    location: echt(d.location),
    remote_type: d.remote_type || 'hybrid',
    experience_level: d.experience_level || 'mid',
    salary_min: d.salary_min,
    salary_max: d.salary_max,
    skills: d.skills || [],
    must_haves: d.must_haves || [],
    nice_to_haves: d.nice_to_haves || [],
    industry: echt(d.industry),
    description: d.description || '',
    requirements: d.requirements || '',
    vacancyReason: d.vacancy_reason ?? null,
    reportsTo: d.reports_to ?? null,
    hiringUrgency: d.hiring_urgency ?? null,
    remoteDays: d.remote_days ?? null,
    usps: d.unique_selling_points || [],
    // Der Parser liest Benefits nicht zuverlaessig -- in Anzeigen stehen sie
    // als Prosa. Sie werden im Formular aus einem festen Katalog angeklickt.
    benefits: Array.isArray((d as unknown as Record<string, unknown>).benefits_extracted)
      ? ((d as unknown as Record<string, unknown>).benefits_extracted as unknown[])
          .filter((x): x is string => typeof x === 'string')
      : [],
  };
}

/** Ergebnis von parse-job-pdf in den Studio-Zustand. */
export function fromParsedJobProfile(p: ParsedJobProfile): BuiltJob {
  const level: Record<string, string> = {
    junior: 'junior', mid: 'mid', senior: 'senior',
    lead: 'lead', principal: 'lead', director: 'lead',
  };
  return {
    title: p.title || '',
    company_name: p.company || '',
    location: p.location || '',
    remote_type: p.remote_policy === 'remote' ? 'remote' : p.remote_policy === 'onsite' ? 'onsite' : 'hybrid',
    experience_level: level[p.seniority_level] || 'mid',
    salary_min: p.salary_min,
    salary_max: p.salary_max,
    skills: p.technical_skills || [],
    must_haves: p.requirements || [],
    nice_to_haves: p.nice_to_have || [],
    industry: p.industry || '',
    description: p.description || '',
    requirements: (p.requirements || []).join('\n'),
    vacancyReason: null,
    reportsTo: null,
    hiringUrgency: null,
    remoteDays: null,
    usps: [],
  benefits: [],
  };
}

/**
 * Die typisierten Felder, die der Parser bereits eingeordnet hat.
 *
 * Sie gehören nicht in BuiltJob — das ist der Formularzustand — sondern in
 * dyn.typedFields, wo sie mit dem verschmelzen, was die KI im Briefing
 * normalisiert. draftToJobRow und buildRecord lesen genau von dort.
 *
 * Ohne diesen Weg landeten Sprachanforderungen und Erfahrungsjahre wieder als
 * unerfüllbare Einträge in der Muss-Liste — der Matcher hält jeden davon für
 * einen Skillnamen (calculate-match-v3-1:1174).
 */
export function typedFieldsFromParsed(d: ParsedJobData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.required_languages?.length) out.required_languages = d.required_languages;
  if (d.required_certifications?.length) out.required_certifications = d.required_certifications;
  if (d.experience_min != null) out.experience_min = d.experience_min;
  return out;
}

/**
 * Was der Parser fuer den FRAGENKATALOG liefert.
 *
 * BEFUND (05.09.2026): parse-job-url gibt 28 Felder aus, fromParsedJobData
 * uebernimmt davon 19 -- und die neun, die fallen, sind ausgerechnet die
 * Briefing-Felder: daily_routine, department_structure, team_size, core_hours,
 * overtime_policy, career_path, company_culture, hiring_deadline_weeks,
 * company_size_estimate. Sie fallen, weil BuiltJob (der Formularzustand) fuer
 * sie kein Feld hat -- das Modell liest sie, und niemand packt sie aus.
 *
 * Sichtbar war das an der Frage "Koennen Sie mir ein Bild des Arbeitsalltags
 * malen?": leeres Feld, obwohl die Anzeige eine vollstaendige Aufgabenliste
 * trug. Und `sources: ['ad']` im Katalog war damit ein Versprechen ohne Weg.
 *
 * Diese Funktion schreibt sie in den Katalogzustand statt in BuiltJob --
 * dasselbe Muster wie typedFieldsFromParsed fuer die Matching-Felder.
 *
 * WICHTIG: `from: 'ad'` heisst "aus der Anzeige gelesen, bitte pruefen" --
 * NICHT "beantwortet". Der Katalog stellt die Frage trotzdem und zeigt den
 * Wert als Vorschlag. Eine Anzeige ist Marketingtext; sie als Kundenaussage
 * durchzuwinken war genau der Fehler, den der Katalog beheben soll.
 */
/**
 * Der Tagessatz aus der Anzeige -- fuer den Contracting-Zweig.
 *
 * BEFUND (07.09.2026): Der Parser-Prompt kannte nur ein Jahresgehalt
 * ("salary_min: ... jaehrlich"). Eine Anzeige mit "Tagessatz 850 EUR" wurde
 * entweder verworfen oder als Jahresgehalt von 850 EUR gelesen. Der Slot
 * `day_rate_range` ist `blocksSubmit` -- die eine Zahl, ohne die eine
 * Contracting-Stelle nicht rausgeht, war die einzige, die der Parser nicht
 * lesen konnte.
 */
export function freelanceFromParsed(d: ParsedJobData): Partial<FreelanceTerms> | null {
  if (!d.day_rate_min && !d.day_rate_max) return null;
  return {
    dayRateMin: d.day_rate_min ?? null,
    dayRateMax: d.day_rate_max ?? null,
  };
}

/**
 * Die Uhrzeitspanne aus einem Freitext -- oder nichts.
 *
 * Der Chip beantwortet die Kategorie ("Gleitzeit mit Kernzeit"), der Kandidat
 * fragt nach der Uhrzeit. Der Parser liefert beides in einem Satz; hier wird
 * der Teil herausgeschnitten, der Zeiten nennt.
 *
 * Geschnitten wird von der ersten bis zur letzten Spanne, nicht Spanne fuer
 * Spanne: bei "Schicht 6-14 / 14-22" bleibt der Schraegstrich dazwischen
 * stehen, und der Kunde liest seinen eigenen Satz statt einer von uns
 * zusammengesetzten Fassung.
 *
 * Gefunden wird nur, was nach einer UHRZEIT aussieht -- beide Zahlen bis 24
 * oder mit Doppelpunkt. Sonst haette "Vertrauensarbeitszeit, 40 bis 45
 * Stunden" eine Kernzeit von 40 bis 45 Uhr ergeben.
 */
const SPANNE = /(\d{1,2})(:\d{2})?\s*(?:Uhr)?\s*(?:bis|–|—|-)\s*(\d{1,2})(:\d{2})?\s*(?:Uhr)?/gi;

function zeitspanne(roh: unknown): string | undefined {
  const text = String(roh ?? '').trim();
  if (!text) return undefined;

  SPANNE.lastIndex = 0;
  let von = -1, bis = -1, treffer: RegExpExecArray | null;
  while ((treffer = SPANNE.exec(text))) {
    const [, a, aMin, b, bMin] = treffer;
    const istUhrzeit =
      (aMin || bMin || /uhr/i.test(treffer[0])) ||
      (Number(a) <= 24 && Number(b) <= 24);
    if (!istUhrzeit) continue;
    if (von < 0) von = treffer.index;
    bis = treffer.index + treffer[0].length;
  }
  if (von < 0) return undefined;

  return text.slice(von, bis).replace(/\s{2,}/g, ' ').trim() || undefined;
}

export function catalogFromParsed(
  d: ParsedJobData,
  contract: 'full-time' | 'freelance' = 'full-time',
): Record<string, { value: unknown; from: 'ad' }> {
  const out: Record<string, { value: unknown; from: 'ad' }> = {};
  const setz = (key: string, roh: unknown) => {
    if (roh === null || roh === undefined) return;
    // Chip-Slots nehmen nur, was einen Chip trifft -- und zwar einen Chip
    // DIESER Vertragsart. Sonst stuende ueber einer unmarkierten Reihe
    // "bitte pruefen", und die Zeile zaehlte trotzdem als gefuellt.
    const value = chipTreffer(key, roh, contract);
    if (value === null || value === undefined) return;
    if (typeof value === 'string' && !value.trim()) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = { value, from: 'ad' };
  };

  // Rolle
  setz('daily_routine', d.daily_routine);
  setz('task_focus', d.task_focus);
  /* `department_structure` liest der Parser ebenfalls, und jobs hat die Spalte
     seit Januar -- aber der Katalog hat keinen Slot dafuer. Sie hier zu setzen
     hiesse nur, den Wert eine Ebene spaeter fallen zu lassen. Offen. */

  // Team -- die Chip-Stufen des Katalogs, nicht die Rohzahl.
  if (d.team_size != null) {
    const n = Number(d.team_size);
    setz('team_size', n <= 1 ? 1 : n <= 5 ? 4 : n <= 15 ? 10 : 20);
  }
  setz('reports_to', d.reports_to);

  // Arbeitsweise
  setz('core_hours', d.core_hours);
  /* Die Uhrzeit, die der Chip wegwirft.
     Der Parser liefert "Gleitzeit mit Kernzeit 9 bis 15 Uhr"; `chipTreffer`
     macht daraus die Kategorie und verliert die Zahlen. Genau danach fragt
     aber jeder Kandidat. Was nach dem erkannten Chip uebrig bleibt, geht in
     die Folgezeile -- im Wortlaut der Anzeige, ohne eigene Formatierung: eine
     erfundene Schreibweise waere schlechter als die des Kunden. */
  setz('core_hours_detail', zeitspanne(d.core_hours));
  setz('overtime_policy', d.overtime_policy);
  /* Der Chip fragt "Homeoffice-Tage pro Woche" und traegt genau diese Zahl.
     Die Umrechnung auf onsite_days_required (5 minus Homeoffice) gehoert an
     die Stelle, die in die Spalte schreibt -- nicht hierher. Vorher stand bei
     "Zwei Tage Homeoffice" der Chip 3 markiert. */
  if (d.remote_days != null) setz('remote_days', Math.max(0, Number(d.remote_days)));

  // Kultur und Verkauf
  setz('company_culture', d.company_culture);
  setz('career_path', d.career_path);
  setz('unique_selling_points', d.unique_selling_points);

  // Dringlichkeit
  setz('vacancy_reason', d.vacancy_reason);
  if (d.hiring_deadline_weeks != null) {
    const w = Number(d.hiring_deadline_weeks);
    setz('hiring_deadline', w <= 4 ? 'So schnell wie möglich' : w <= 12 ? 'In 1–3 Monaten' : 'In 3–6 Monaten');
  } else if (d.hiring_urgency === 'hot' || d.hiring_urgency === 'urgent') {
    setz('hiring_deadline', 'So schnell wie möglich');
  }

  /*
    Gehalt und Tagessatz stehen hier BEWUSST nicht.

    Beide sind Formularfelder links, und knownFromForm spiegelt sie in den
    Katalog. Wuerde catalogFromParsed sie zusaetzlich setzen, gaebe es zwei
    Wahrheiten: `dyn.catalog.known` gewinnt ueber die Spiegelung, also haette
    der Kunde ein leeres Gehaltsfeld vor sich, waehrend der Katalog den Wert
    aus der Anzeige fuehrt -- und beide sind `blocksSubmit`. Die Aufnahme waere
    freigegeben mit einer Zahl, die niemand gesehen hat.

    Der Weg fuehrt stattdessen ins Formular: das Jahresgehalt ueber
    fromParsedJobData nach built.salary_min/max, der Tagessatz ueber
    freelanceFromParsed nach state.freelance. Dort sieht der Kunde ihn.
  */

  // Firma
  // Der Parser gibt Freitext ("Startup", "51-200", "Konzern"), der Katalog
  // will eine von fuenf Banden. sizeBand ist die eine Uebersetzung -- dieselbe
  // gilt fuer das Impressum und fuer die Vorbelegung aus dem Link.
  setz('company_size_band', sizeBand(d.company_size_estimate));
  return out;
}

/** Der Ausschnitt, den das statische Briefing zum Vorbefüllen braucht. */
export const toBriefBuilt = (j: BuiltJob): BriefBuilt => ({
  remote_type: j.remote_type,
  must_haves: j.must_haves,
  vacancyReason: j.vacancyReason,
  reportsTo: j.reportsTo,
  hiringUrgency: j.hiringUrgency,
  remoteDays: j.remoteDays,
  usps: j.usps,
});

export const remoteLabel = (r: string) => (r === 'remote' ? 'Remote' : r === 'onsite' ? 'Vor Ort' : 'Hybrid');
export const levelLabel = (l: string) =>
  l === 'junior' ? 'Junior' : l === 'senior' ? 'Senior' : l === 'lead' ? 'Lead' : 'Mid-Level';

/** Der vollständige, serialisierbare Zustand einer Aufnahme. */
export interface IntakeDraftState {
  type: 'full-time' | 'freelance';
  built: BuiltJob;
  answers: Answers;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  revealSetup: RevealSetup;
  dyn: DynState;
}

/**
 * Der Job-Entwurf, den intake-questions als Kontext bekommt.
 *
 * Identisch für beide Wege — auch die Vorbelegung: Regel 8 des Systemprompts
 * behandelt alles in company_defaults als beantwortet und fragt es nie erneut.
 * Beim Dashboard kommt sie aus company_profiles, bei der login-freien Aufnahme
 * aus der Vorbelegung des Links.
 */
export function buildAiJobDraft(args: {
  type: 'full-time' | 'freelance';
  built: BuiltJob;
  freelance: FreelanceTerms;
  flexibility: FlexibilityMap;
  companyDefaults?: {
    industry?: string | null;
    size?: string | null;
    remote_policy?: string | null;
    excluded_companies?: string[] | null;
  } | null;
}): Record<string, unknown> {
  const { type, built, freelance, flexibility, companyDefaults } = args;
  const isFreelance = type === 'freelance';
  return {
    contract_type: type,
    title: built.title,
    location: built.location,
    remote_type: built.remote_type,
    experience_level: built.experience_level,
    salary_min: built.salary_min,
    salary_max: built.salary_max,
    day_rate: isFreelance ? { min: freelance.dayRateMin, max: freelance.dayRateMax } : undefined,
    // Die Listen kommen aus einem Entwurf, der noch nicht vollstaendig sein
    // muss -- waehrend des Bauens ist er es nie. Ein ungeschuetztes
    // built.skills.slice() liess die gesamte Aufnahme mit weisser Seite
    // abstuerzen, genau in dem Moment, in dem das Profil entstand.
    must_haves: built.must_haves ?? [],
    nice_to_haves: built.nice_to_haves ?? [],
    skills: (built.skills ?? []).slice(0, 15),
    industry: built.industry,
    vacancy_reason: built.vacancyReason,
    reports_to: built.reportsTo,
    usps: built.usps ?? [],
    flexibility,
    company_defaults: companyDefaults ?? undefined,
  };
}

/**
 * Das narrative Briefing für intake_payload — der Teil, der nicht in typisierte
 * Spalten passt. Ohne draft_state: der gehört bei der login-freien Aufnahme in
 * intake_drafts und wäre in jobs eine zweite Wahrheit.
 */
export function buildIntakePayload(args: {
  source: 'studio' | 'guest_intake';
  state: IntakeDraftState;
  briefingText: string | null;
  profileFacts?: string[];
}): Record<string, unknown> {
  const { source, state, briefingText, profileFacts } = args;
  const { type, built, answers, freelance, flexibility, dyn } = state;
  const typed = dyn.typedFields as Record<string, unknown>;

  return {
    source,
    captured_at: new Date().toISOString(),
    contract_type: type,
    briefing_answers: answers,
    briefing_text: briefingText || null,
    briefing_dynamic: dyn.answers.length ? dyn.answers : null,
    dynamic_payload: Object.keys(dyn.payloadPatch).length ? dyn.payloadPatch : null,
    typed_extras: {
      required_languages: typed.required_languages ?? null,
      required_certifications: typed.required_certifications ?? null,
      onsite_required: typed.onsite_required ?? null,
    },
    skill_requirements: dyn.skillRequirements.length ? dyn.skillRequirements : null,
    contracting: type === 'freelance' ? freelance : null,
    flexibility: Object.keys(flexibility).length ? flexibility : null,
    profile_prefill: profileFacts?.length ? profileFacts : null,
    usps: built.usps.length ? built.usps : null,
    vacancy_reason: built.vacancyReason,
    reports_to: built.reportsTo,
    hiring_urgency: built.hiringUrgency,
    remote_days: built.remoteDays,
  };
}

/**
 * Wie vollständig die Aufnahme ist — eine Zahl, ein Rechenweg.
 *
 * Vorher standen zwei Wege nebeneinander (Kopfzeile 42 %, Briefing-Reife
 * 65/100 auf demselben Bildschirm). Ist die KI erreichbar, gilt ihre gewichtete
 * Bewertung; sonst der Anteil beantworteter Pflichtfragen.
 */
export function intakeCompleteness(dyn: DynState, staticPct: number): number {
  return dyn.available ? dyn.completeness : staticPct;
}

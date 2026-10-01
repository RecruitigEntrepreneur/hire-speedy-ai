// Vorschläge fürs Interview: antippen statt tippen. Alles wird aus der Akte abgeleitet
// (Lebenslauf, bisherige Antworten) – keine KI, keine Bewertung der Person.

import { DossierForm } from '@/lib/candidateDossier';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();
const uniq = (list: string[]) => {
  const seen = new Set<string>();
  return list.filter((x) => {
    const k = norm(x);
    if (!x.trim() || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ---------------------------------------------------------------------------
// Phrasen in Freitextfeldern (Chips schreiben in dasselbe Feld)
// ---------------------------------------------------------------------------

/** Einträge eines Freitextfelds, getrennt nach Komma, Semikolon, Mittelpunkt oder Zeile. */
export function phrasesOf(text: string): string[] {
  return text.split(/\s*[,;·\n]\s*/).map((p) => p.trim()).filter(Boolean);
}

export function hasPhrase(text: string, phrase: string): boolean {
  return phrasesOf(text).some((p) => norm(p) === norm(phrase));
}

/** Chip an/aus: fügt die Phrase hinzu oder nimmt sie heraus, der Rest des Texts bleibt. */
export function togglePhrase(text: string, phrase: string): string {
  const parts = phrasesOf(text);
  const next = hasPhrase(text, phrase) ? parts.filter((p) => norm(p) !== norm(phrase)) : [...parts, phrase];
  return next.join(', ');
}

// ---------------------------------------------------------------------------
// Situation
// ---------------------------------------------------------------------------

export const POSITIVE_OPTIONS = ['Team', 'Aufgaben', 'Führungskraft', 'Flexibilität', 'Gehalt', 'Arbeitsweg', 'Stabilität', 'Weiterbildung'];
export const NEGATIVE_OPTIONS = [
  'Keine Entwicklung', 'Wenig Gestaltungsspielraum', 'Führungskraft', 'Arbeitslast', 'Gehalt', 'Übernahme oder Umstrukturierung',
  'Arbeitsweg', 'Unternehmenskultur', 'Kaum Wertschätzung',
];

// ---------------------------------------------------------------------------
// Ziele
// ---------------------------------------------------------------------------

const NEXT_STEP: Record<string, string[]> = {
  junior: ['Fachlich vertiefen', 'Mehr Verantwortung', 'Senior-Rolle'],
  mid: ['Senior-Rolle', 'Projektverantwortung', 'Erste Führungsrolle'],
  senior: ['Teamleitung', 'Fachkarriere als Expertin oder Experte', 'Größerer Verantwortungsbereich'],
  lead: ['Abteilungsleitung', 'Größeres Team', 'Fachkarriere statt Führung'],
  director: ['Bereichsleitung', 'Geschäftsführung', 'Größere Organisation'],
};

const AREA: [RegExp, string][] = [
  [/controll/i, 'Controlling'], [/buchhalt|rechnungswesen|accounting/i, 'Rechnungswesen'], [/finance|finanz/i, 'Finance'],
  [/vertrieb|sales|account/i, 'Vertrieb'], [/personal|hr\b|recruit/i, 'Personal'], [/marketing/i, 'Marketing'],
  [/entwickl|developer|engineer/i, 'Entwicklung'], [/data|daten/i, 'Data'], [/projekt/i, 'Projekte'], [/einkauf|procure/i, 'Einkauf'],
  [/logistik|supply/i, 'Logistik'], [/pflege/i, 'Pflege'], [/qualit/i, 'Qualität'],
];

/** Richtungen für „Wohin will sie oder er?": Lebenslauf-Ziel zuerst, dann übliche nächste Schritte. */
export function careerDirections(f: DossierForm): string[] {
  const area = AREA.find(([re]) => re.test(f.job_title))?.[1];
  const level = f.seniority ?? (f.leadership_scope === 'disciplinary' ? 'lead' : (f.experience_years ?? 0) >= 6 ? 'senior' : 'mid');
  const steps = NEXT_STEP[level] ?? NEXT_STEP.mid;
  const lead = area && (level === 'senior' || level === 'lead') ? [`Leitung ${area}`] : [];
  const fromCv = f.target_roles.slice(0, 3);
  return uniq([...fromCv, ...lead, ...steps, 'Wechsel in den Mittelstand', 'Wechsel in den Konzern', 'Internationale Aufgaben']).slice(0, 8);
}

export const TIMEFRAME_OPTIONS = ['sofort', 'in 1–2 Jahren', 'in 3–5 Jahren'];

/** „Schon getan dafür": Belege aus der Akte (Weiterbildungen, Führung) plus Übliches. */
export function actionsTaken(f: DossierForm): string[] {
  const certs = f.certificates.slice(0, 2).map((c) => `Weiterbildung: ${c}`);
  const lead = f.leadership_team_size ? [`Team von ${f.leadership_team_size} geführt`] : f.leadership_scope && f.leadership_scope !== 'none' ? ['Führungsaufgabe übernommen'] : [];
  return uniq([...certs, ...lead, 'Intern beworben', 'Mehr Verantwortung übernommen', 'Mit Vorgesetzten gesprochen', 'Weiterbildung begonnen']);
}

export const WORKED_OPTIONS = ['Weiterbildung', 'Projekte übernommen', 'Unterstützung durch Vorgesetzte', 'Netzwerk', 'Stellenwechsel'];
export const DIDNT_WORK_OPTIONS = ['Keine Stelle frei', 'Übernahme oder Umstrukturierung', 'Budget fehlte', 'Kein Rückhalt', 'Beförderung abgelehnt'];

export function roleSuggestions(f: DossierForm): string[] {
  return uniq([...careerDirections(f).filter((d) => /leitung|head|lead|manager|senior/i.test(d)), f.job_title]).filter((r) => !f.target_roles.some((t) => norm(t) === norm(r))).slice(0, 4);
}

export function industrySuggestions(f: DossierForm): string[] {
  return f.industries.filter((i) => !f.target_industries.some((t) => norm(t) === norm(i))).slice(0, 4);
}

export function locationSuggestions(f: DossierForm): string[] {
  return [f.city, 'Remote'].filter((c) => c && !f.target_locations.some((t) => norm(t) === norm(c)));
}

// ---------------------------------------------------------------------------
// Rahmen und Markt
// ---------------------------------------------------------------------------

const OFFER_HINTS: [RegExp, string][] = [
  [/gestalt/i, 'Gestaltungsspielraum'],
  [/führung|fuehrung|verantwortung|team (leiten|führen)/i, 'Führungsverantwortung'],
  [/entwicklung|perspektive|karriere|aufstieg|weiterkommen/i, 'Entwicklungsperspektive'],
  [/remote|home\s?office|hybrid/i, 'Remote oder hybrid'],
  [/flexib|arbeitszeit/i, 'Flexible Zeiten'],
  [/pendel|arbeitsweg|anfahrt|fahrzeit/i, 'Kurzer Arbeitsweg'],
  [/gehalt|vergütung|bezahlung|verdienen/i, 'Gehaltssprung'],
  [/sicherheit|stabil|übernahme|uebernahme|insolvenz|umstrukturierung|investor/i, 'Stabiles Unternehmen'],
  [/weiterbildung|lernen|fortbildung/i, 'Weiterbildung'],
  [/kultur|klima|wertschätzung/i, 'Unternehmenskultur'],
  [/herausforderung|anspruchsvoll|langweilig|unterfordert/i, 'Fachliche Herausforderung'],
];

const TAG_TO_OFFER: Record<string, string> = {
  Gehalt: 'Gehaltssprung', 'Work-Life-Balance': 'Flexible Zeiten', Arbeitszeiten: 'Flexible Zeiten', Karriere: 'Entwicklungsperspektive',
  Verantwortung: 'Führungsverantwortung', Führung: 'Führungsverantwortung', Team: 'Gutes Team', Unternehmenskultur: 'Unternehmenskultur',
  Standort: 'Kurzer Arbeitsweg', Remote: 'Remote oder hybrid', Projekte: 'Fachliche Herausforderung', Technologie: 'Moderne Arbeitsmittel',
  Sicherheit: 'Stabiles Unternehmen',
};

/** Top-3-Vorschläge fürs Angebot aus Motivation, Stör-Punkten und Zielen; schon Gewähltes fällt raus. */
export function offerSuggestions(f: DossierForm): string[] {
  const text = [f.change_motivation, f.current_negative, f.why_now, f.career_ultimate_goal, f.career_3_5_year_plan].join(' ');
  const fromText = OFFER_HINTS.filter(([re]) => re.test(text)).map(([, o]) => o);
  const fromTags = f.change_motivation_tags.map((t) => TAG_TO_OFFER[t]).filter(Boolean);
  return uniq([...fromText, ...fromTags]).filter((o) => !f.offer_requirements.some((x) => norm(x) === norm(o))).slice(0, 3);
}

export const PROCESS_ISSUE_OPTIONS = ['Kein Feedback', 'Zu lange Prozesse', 'Gehalt zu niedrig', 'Stelle anders als beschrieben', 'Zu viele Runden', 'Absage ohne Grund'];

/** Sperrliste: aktueller Arbeitgeber zuerst, dann frühere – nur was noch nicht drinsteht. */
export function blockedSuggestions(f: DossierForm, formerEmployers: string[]): { name: string; hint: string }[] {
  const has = (n: string) => f.blocked_companies.some((b) => norm(b) === norm(n));
  const out: { name: string; hint: string }[] = [];
  if (f.company.trim() && !has(f.company)) out.push({ name: f.company.trim(), hint: 'aktueller Arbeitgeber' });
  for (const e of uniq(formerEmployers)) if (e.trim() && !has(e) && norm(e) !== norm(f.company)) out.push({ name: e.trim(), hint: 'früherer Arbeitgeber' });
  return out.slice(0, 4);
}

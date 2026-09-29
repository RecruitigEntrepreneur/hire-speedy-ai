// Prüf-Screen "in 60 Sekunden": führt Vorschläge aus KI-Auswertung und
// Schnellerkennung zusammen, vergleicht sie mit der Akte und entscheidet,
// was eingeklappt (sicher), als Karte (unsicher, Widerspruch, sensibel) oder
// gar nicht (steht schon so in der Akte) gezeigt wird. Übernommen wird nur,
// was der Headhunter bestätigt; Widersprüche behalten standardmäßig die Akte.

import {
  DISCUSSED_OPTIONS,
  DossierForm,
  DossierLanguage,
  EMPLOYMENT_OPTIONS,
  FREQUENCY_OPTIONS,
  LEADERSHIP_OPTIONS,
  NOTICE_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  Option,
  PERMIT_OPTIONS,
  WORK_MODEL_OPTIONS,
  WOULD_STAY_OPTIONS,
  formatEuro,
  optionLabel,
} from './candidateDossier';
import type { CaptureSuggestion } from './quickExtract';

export type CapturePhase = 'situation' | 'ziele' | 'rahmen' | 'markt' | 'kundenprofil';

export const CAPTURE_PHASES: Array<{ key: CapturePhase; label: string }> = [
  { key: 'situation', label: 'Situation und Motivation' },
  { key: 'ziele', label: 'Ziele' },
  { key: 'rahmen', label: 'Rahmen' },
  { key: 'markt', label: 'Markt und Einschätzung' },
  { key: 'kundenprofil', label: 'Kundenprofil' },
];

interface KeyMeta {
  label: string;
  phase: CapturePhase;
  kind: 'money' | 'enum' | 'text' | 'list' | 'languages' | 'bool' | 'int' | 'date';
  options?: Option[];
}

export const KEY_META: Partial<Record<keyof DossierForm, KeyMeta>> = {
  job_title: { label: 'Aktuelle Rolle', phase: 'situation', kind: 'text' },
  experience_years: { label: 'Berufserfahrung (Jahre)', phase: 'situation', kind: 'int' },
  skills: { label: 'Skills', phase: 'situation', kind: 'list' },
  industries: { label: 'Branchenerfahrung', phase: 'situation', kind: 'list' },
  leadership_scope: { label: 'Führungsverantwortung', phase: 'situation', kind: 'enum', options: LEADERSHIP_OPTIONS },
  leadership_team_size: { label: 'Teamgröße', phase: 'situation', kind: 'int' },
  current_positive: { label: 'Was gefällt heute', phase: 'situation', kind: 'text' },
  current_negative: { label: 'Was stört', phase: 'situation', kind: 'text' },
  change_motivation: { label: 'Wechselmotivation', phase: 'situation', kind: 'text' },
  change_motivation_tags: { label: 'Motivations-Stichworte', phase: 'situation', kind: 'list' },
  specific_incident: { label: 'Auslöser', phase: 'situation', kind: 'text' },
  frequency_of_issues: { label: 'Wie oft', phase: 'situation', kind: 'enum', options: FREQUENCY_OPTIONS },
  why_now: { label: 'Warum jetzt', phase: 'situation', kind: 'text' },
  discussed_internally: { label: 'Intern angesprochen', phase: 'situation', kind: 'enum', options: DISCUSSED_OPTIONS },
  would_stay: { label: 'Bleibt bei Nachbesserung', phase: 'situation', kind: 'enum', options: WOULD_STAY_OPTIONS },
  career_ultimate_goal: { label: 'Langfristiges Ziel', phase: 'ziele', kind: 'text' },
  career_3_5_year_plan: { label: 'Ziel in 3–5 Jahren', phase: 'ziele', kind: 'text' },
  career_actions_taken: { label: 'Bisherige Schritte', phase: 'ziele', kind: 'text' },
  career_what_worked: { label: 'Was gut lief', phase: 'ziele', kind: 'text' },
  career_what_didnt_work: { label: 'Was weniger gut lief', phase: 'ziele', kind: 'text' },
  target_roles: { label: 'Wunschrollen', phase: 'ziele', kind: 'list' },
  target_industries: { label: 'Zielbranchen', phase: 'ziele', kind: 'list' },
  target_locations: { label: 'Zielorte', phase: 'ziele', kind: 'list' },
  current_salary: { label: 'Aktuelles Gehalt', phase: 'rahmen', kind: 'money' },
  expected_salary: { label: 'Wunschgehalt', phase: 'rahmen', kind: 'money' },
  salary_minimum: { label: 'Schmerzgrenze', phase: 'rahmen', kind: 'money' },
  offer_requirements: { label: 'Angebot muss bieten', phase: 'rahmen', kind: 'list' },
  notice_period: { label: 'Kündigungsfrist', phase: 'rahmen', kind: 'enum', options: NOTICE_OPTIONS },
  availability_date: { label: 'Verfügbar ab', phase: 'rahmen', kind: 'date' },
  remote_preference: { label: 'Arbeitsmodell', phase: 'rahmen', kind: 'enum', options: WORK_MODEL_OPTIONS },
  max_commute_minutes: { label: 'Max. Pendelzeit (Min.)', phase: 'rahmen', kind: 'int' },
  employment_type: { label: 'Beschäftigungsart', phase: 'rahmen', kind: 'enum', options: EMPLOYMENT_OPTIONS },
  relocation_willing: { label: 'Umzugsbereit', phase: 'rahmen', kind: 'bool' },
  languages: { label: 'Sprachen', phase: 'rahmen', kind: 'languages' },
  work_permit: { label: 'Arbeitserlaubnis', phase: 'rahmen', kind: 'enum', options: PERMIT_OPTIONS },
  other_applications: { label: 'Andere Bewerbungen', phase: 'markt', kind: 'enum', options: OTHER_APPLICATIONS_OPTIONS },
  other_applications_notes: { label: 'Stand anderer Bewerbungen', phase: 'markt', kind: 'text' },
  blocked_companies: { label: 'Sperrliste', phase: 'markt', kind: 'list' },
  previous_process_issues: { label: 'Frühere Prozessprobleme', phase: 'markt', kind: 'text' },
  presentation_consent: { label: 'Einverständnis zur anonymen Vorstellung', phase: 'markt', kind: 'bool' },
  expose_summary: { label: 'Kurzprofil für den Kunden', phase: 'kundenprofil', kind: 'text' },
  summary_cultural_fit: { label: 'Cultural Fit', phase: 'kundenprofil', kind: 'text' },
};

/** Felder, die nie still übernommen werden (immer als Karte, einzeln bestätigen). */
export const SENSITIVE_CAPTURE_KEYS: Array<keyof DossierForm> = [
  'blocked_companies', 'presentation_consent', 'other_applications', 'other_applications_notes', 'salary_minimum',
];

export function formatValue(key: keyof DossierForm, value: unknown): string {
  const meta = KEY_META[key];
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '–';
  switch (meta?.kind) {
    case 'money': return typeof value === 'number' ? formatEuro(value) : String(value);
    case 'enum': return optionLabel(meta.options ?? [], String(value)) ?? String(value);
    case 'bool': return value ? 'Ja' : 'Nein';
    case 'languages': return (value as DossierLanguage[]).map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(', ');
    case 'list': return (value as string[]).join(', ');
    case 'date': return new Date(String(value)).toLocaleDateString('de-DE');
    default: return String(value);
  }
}

/** KI-Felder (Server) in Vorschläge wandeln; unbekannte Felder werden ignoriert. */
export function fromAiFields(
  fields: Array<{ key: string; value: unknown; quote: string; confidence: number }>,
  sourceLabel?: string,
): CaptureSuggestion[] {
  return fields
    .filter((f) => f.key in KEY_META)
    .map((f) => {
      const key = f.key as keyof DossierForm;
      const conf = (f.confidence === 3 || f.confidence === 2 ? f.confidence : 1) as 1 | 2 | 3;
      return { key, value: f.value as DossierForm[keyof DossierForm], display: `${KEY_META[key]!.label}: ${formatValue(key, f.value)}`, quote: f.quote, sourceLabel, confidence: conf, origin: 'ai' as const };
    });
}

/** KI schlägt Schnellerkennung, außer die Schnellerkennung ist sicherer. */
export function mergeSuggestions(ai: CaptureSuggestion[], quick: CaptureSuggestion[]): CaptureSuggestion[] {
  const byKey = new Map<string, CaptureSuggestion>();
  for (const s of quick) byKey.set(String(s.key), s);
  for (const s of ai) {
    const prev = byKey.get(String(s.key));
    if (!prev || prev.origin === 'ai' || s.confidence >= prev.confidence) byKey.set(String(s.key), s);
  }
  return [...byKey.values()];
}

export type ReviewStatus = 'safe' | 'uncertain' | 'conflict' | 'sensitive' | 'same';

export interface ReviewItem {
  id: string;
  key: keyof DossierForm;
  label: string;
  phase: CapturePhase;
  status: ReviewStatus;
  value: DossierForm[keyof DossierForm];
  display: string;
  currentDisplay: string;
  quote: string;
  sourceLabel?: string;
  confidence: 1 | 2 | 3;
  origin: 'quick' | 'ai';
}

const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function mergeArray(key: keyof DossierForm, current: unknown, incoming: unknown): unknown[] | null {
  if (key === 'languages') {
    const cur = (current as DossierLanguage[]) ?? [];
    const inc = (incoming as DossierLanguage[]) ?? [];
    const merged = [...cur];
    let changed = false;
    for (const l of inc) {
      const i = merged.findIndex((m) => m.language.toLowerCase() === l.language.toLowerCase());
      if (i === -1) { merged.push(l); changed = true; }
      else if (!merged[i].proficiency && l.proficiency) { merged[i] = { ...merged[i], proficiency: l.proficiency }; changed = true; }
    }
    return changed ? merged : null;
  }
  const cur = ((current as string[]) ?? []).map(String);
  const additions = ((incoming as string[]) ?? []).map(String).filter((x) => !cur.some((c) => c.toLowerCase() === x.toLowerCase()));
  if (!additions.length) return null;
  const merged = [...cur, ...additions];
  return key === 'offer_requirements' ? merged.slice(0, 3) : merged;
}

export function buildReview(form: DossierForm, suggestions: CaptureSuggestion[]): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const s of suggestions) {
    const meta = KEY_META[s.key];
    if (!meta) continue;
    const current = form[s.key];
    let value = s.value;
    let status: ReviewStatus;
    if (Array.isArray(value) && (meta.kind === 'list' || meta.kind === 'languages')) {
      const merged = mergeArray(s.key, current, value);
      if (!merged) status = 'same';
      else {
        value = merged as DossierForm[keyof DossierForm];
        status = SENSITIVE_CAPTURE_KEYS.includes(s.key) ? 'sensitive' : s.confidence >= 2 ? 'safe' : 'uncertain';
      }
    } else if (same(current, value)) {
      status = 'same';
    } else if (SENSITIVE_CAPTURE_KEYS.includes(s.key)) {
      status = 'sensitive';
    } else if (!isEmpty(current)) {
      status = 'conflict';
    } else {
      status = s.confidence >= 2 ? 'safe' : 'uncertain';
    }
    items.push({
      id: String(s.key),
      key: s.key,
      label: meta.label,
      phase: meta.phase,
      status,
      value,
      display: formatValue(s.key, value),
      currentDisplay: formatValue(s.key, current),
      quote: s.quote,
      sourceLabel: s.sourceLabel,
      confidence: s.confidence,
      origin: s.origin,
    });
  }
  const order = CAPTURE_PHASES.map((p) => p.key);
  return items.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
}

export type Decision = 'accept' | 'reject';

/** Vorbelegung: sicher und unsicher übernehmen, Widerspruch und sensibel erst nach Klick. */
export function defaultDecisions(items: ReviewItem[]): Record<string, Decision> {
  const d: Record<string, Decision> = {};
  for (const i of items) {
    if (i.status === 'safe' || i.status === 'uncertain') d[i.id] = 'accept';
    if (i.status === 'conflict' || i.status === 'sensitive') d[i.id] = 'reject';
  }
  return d;
}

export function applyReview(form: DossierForm, items: ReviewItem[], decisions: Record<string, Decision>): DossierForm {
  const next: DossierForm = { ...form };
  for (const i of items) {
    if (i.status === 'same' || decisions[i.id] !== 'accept') continue;
    (next as unknown as Record<string, unknown>)[i.key] = i.value;
    if (i.key === 'presentation_consent' && i.value === true && !next.presentation_consent_at) next.presentation_consent_at = new Date().toISOString();
  }
  return next;
}

export function reviewCounts(items: ReviewItem[]) {
  const c = { total: items.length, safe: 0, uncertain: 0, conflict: 0, sensitive: 0, same: 0 };
  for (const i of items) c[i.status]++;
  return c;
}

/**
 * Nur der Teil der Notiz, der seit dem Öffnen dazugekommen ist. Alte
 * Mitschriften sind schon verarbeitet und würden sonst neuere Angaben der
 * Akte wieder zurückdrehen wollen.
 */
export function freshText(current: string, baseline: string): string {
  if (!baseline.trim()) return current;
  if (current.startsWith(baseline)) return current.slice(baseline.length);
  const old = new Set(baseline.split('\n').map((l) => l.trim()).filter(Boolean));
  return current.split('\n').filter((l) => l.trim() && !old.has(l.trim())).join('\n');
}

/** Erkennt Aufzeichnungs-Transkripte (Teams/Zoom/Otter): Zeitmarken oder Sprecherzeilen. */
export function looksLikeTranscript(text: string): boolean {
  if (/^WEBVTT/m.test(text)) return true;
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return false;
  const stamped = lines.filter((l) => /^\s*\[?\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\]?/.test(l) || /-->/.test(l)).length;
  const speakers = lines.filter((l) => /^[A-ZÄÖÜ][\wäöüß.-]*(\s+[A-ZÄÖÜ][\wäöüß.-]*){0,2}:\s+\S/.test(l)).length;
  return stamped / lines.length > 0.3 || speakers / lines.length > 0.5;
}

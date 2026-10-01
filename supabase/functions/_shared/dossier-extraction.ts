/**
 * Kandidatenakte aus Interview-Quellen füllen (Notizen, Transkripte, Mails).
 *
 * Reine Logik ohne Deno-/Netzwerk-Abhängigkeit, damit sie in Deno UND im
 * Frontend-Test (Vitest) prüfbar ist. Leitplanken:
 *  - Die KI schlägt nur vor. Jeder Wert braucht ein wörtliches Zitat aus der
 *    Quelle; steht das Zitat nicht im (geschwärzten) Text, wird der Wert
 *    verworfen. Was nicht gesagt wurde, bleibt leer.
 *  - Keine Bewertung der Person: Empfehlung, Wechselbereitschaft, Passung
 *    setzt der Headhunter (DSGVO Art. 22, KI-VO Anhang III).
 *  - Geschützte Angaben (Art. 9 DSGVO, AGG) werden nie als Feld übernommen,
 *    nur als Kategorie gemeldet ("nicht übernommen").
 *
 * Enum-Werte müssen mit src/lib/candidateDossier.ts übereinstimmen; ein
 * Vitest (src/lib/captureReview.test.ts) prüft das.
 */

export type FieldType = 'money' | 'enum' | 'text' | 'list' | 'enumList' | 'languages' | 'bool' | 'int' | 'date';

export interface FieldSpec {
  key: string;
  type: FieldType;
  question: string;
  values?: string[];
  max?: number;
}

// Kündigungsfrist = Dauer + Stichtag (gleiche Liste wie NOTICE_OPTIONS in src/lib/candidateDossier.ts).
const NOTICE_DURATION_VALUES = ['2_weeks', '4_weeks', '1_month', '6_weeks', '2_months', '3_months', '6_months', '12_months'];
const NOTICE_ANCHOR_VALUES = ['15_eom', 'eom', 'eoq', 'eoy'];
export const NOTICE_VALUES = ['immediate', ...NOTICE_DURATION_VALUES.flatMap((d) => [d, ...NOTICE_ANCHOR_VALUES.map((a) => `${d}_${a}`)])];
export const WORK_MODEL_VALUES = ['onsite', 'hybrid', 'remote', 'flexible'];
export const EMPLOYMENT_VALUES = ['fulltime', 'parttime', 'freelance', 'contract'];
export const PERMIT_VALUES = ['citizen', 'permit', 'needs_visa', 'pending'];
export const FREQUENCY_VALUES = ['Einmalig', 'Gelegentlich', 'Regelmäßig', 'Dauerhaft'];
export const DISCUSSED_VALUES = ['Nein', 'Ja, ohne Ergebnis', 'Ja, Lösung in Aussicht'];
export const WOULD_STAY_VALUES = ['yes', 'maybe', 'no'];
export const OTHER_APPLICATIONS_VALUES = ['none', 'early', 'advanced', 'offer'];
export const LEADERSHIP_VALUES = ['none', 'functional', 'disciplinary'];
export const MOTIVATION_TAG_VALUES = [
  'Gehalt', 'Arbeitszeiten', 'Work-Life-Balance', 'Karriere', 'Verantwortung', 'Führung',
  'Team', 'Unternehmenskultur', 'Standort', 'Remote', 'Projekte', 'Technologie', 'Sicherheit',
];
// Gleiche Liste wie OFFER_GROUPS in src/lib/candidateDossier.ts (ohne „Mindestgehalt", seit 01.10.2026).
export const OFFER_VALUES = [
  'Führungsverantwortung', 'Gestaltungsspielraum', 'Entwicklungsperspektive', 'Fachliche Herausforderung', 'Weiterbildung',
  'Remote oder hybrid', 'Flexible Zeiten', '4-Tage-Woche', 'Teilzeit möglich', 'Wenig Reisen',
  'Gutes Team', 'Unternehmenskultur', 'Flache Hierarchien', 'Stabiles Unternehmen', 'Moderne Arbeitsmittel',
  'Gehaltssprung', 'Bonus', 'Firmenwagen', 'Altersvorsorge', 'Mehr Urlaub',
  'Kurzer Arbeitsweg',
];
export const LANGUAGE_LEVEL_VALUES = ['Muttersprache', 'C2', 'C1', 'B2', 'B1', 'A2', 'A1'];
export const PROTECTED_CATEGORIES = ['Gesundheit', 'Religion', 'Gewerkschaft', 'Sexuelle Orientierung', 'Herkunft', 'Familie', 'Alter'];

export const FIELD_SPECS: FieldSpec[] = [
  { key: 'job_title', type: 'text', question: 'Aktuelle Rolle / Jobtitel' },
  { key: 'experience_years', type: 'int', question: 'Berufserfahrung in Jahren' },
  { key: 'skills', type: 'list', question: 'Fachliche Skills und Tools' },
  { key: 'industries', type: 'list', question: 'Branchenerfahrung' },
  { key: 'current_salary', type: 'money', question: 'Aktuelles Jahresgehalt brutto in Euro' },
  { key: 'expected_salary', type: 'money', question: 'Wunschgehalt pro Jahr brutto in Euro' },
  { key: 'salary_minimum', type: 'money', question: 'Schmerzgrenze / Untergrenze Gehalt pro Jahr in Euro' },
  { key: 'notice_period', type: 'enum', question: 'Kündigungsfrist', values: NOTICE_VALUES },
  { key: 'availability_date', type: 'date', question: 'Frühester Starttermin als JJJJ-MM-TT' },
  { key: 'remote_preference', type: 'enum', question: 'Gewünschtes Arbeitsmodell', values: WORK_MODEL_VALUES },
  { key: 'max_commute_minutes', type: 'int', question: 'Maximale Pendelzeit in Minuten' },
  { key: 'employment_type', type: 'enum', question: 'Beschäftigungsart', values: EMPLOYMENT_VALUES },
  { key: 'relocation_willing', type: 'bool', question: 'Umzugsbereit (true/false)' },
  { key: 'target_roles', type: 'list', question: 'Wunschrollen' },
  { key: 'target_industries', type: 'list', question: 'Zielbranchen' },
  { key: 'target_locations', type: 'list', question: 'Zielorte' },
  { key: 'work_permit', type: 'enum', question: 'Arbeitserlaubnis', values: PERMIT_VALUES },
  { key: 'languages', type: 'languages', question: 'Sprachen mit Niveau, Format "Deutsch: Muttersprache | Englisch: B2"' },
  { key: 'change_motivation', type: 'text', question: 'Wechselmotivation in einem Satz, in den Worten der Person' },
  { key: 'change_motivation_tags', type: 'enumList', question: 'Motivations-Stichworte', values: MOTIVATION_TAG_VALUES },
  { key: 'current_positive', type: 'text', question: 'Was gefällt an der aktuellen Situation' },
  { key: 'current_negative', type: 'text', question: 'Was stört an der aktuellen Situation' },
  { key: 'specific_incident', type: 'text', question: 'Konkreter Auslöser für den Wechselwunsch' },
  { key: 'frequency_of_issues', type: 'enum', question: 'Wie oft kommt das Problem vor', values: FREQUENCY_VALUES },
  { key: 'why_now', type: 'text', question: 'Warum gerade jetzt' },
  { key: 'discussed_internally', type: 'enum', question: 'Intern angesprochen', values: DISCUSSED_VALUES },
  { key: 'would_stay', type: 'enum', question: 'Würde bei Nachbesserung durch den Arbeitgeber bleiben', values: WOULD_STAY_VALUES },
  { key: 'career_ultimate_goal', type: 'text', question: 'Langfristiges berufliches Ziel' },
  { key: 'career_3_5_year_plan', type: 'text', question: 'Ziel für die nächsten 3–5 Jahre' },
  { key: 'career_actions_taken', type: 'text', question: 'Bisherige Schritte zum Ziel' },
  { key: 'career_what_worked', type: 'text', question: 'Was hat gut funktioniert' },
  { key: 'career_what_didnt_work', type: 'text', question: 'Was hat weniger gut funktioniert' },
  { key: 'offer_requirements', type: 'enumList', question: 'Was ein Angebot erfüllen muss (max. 3)', values: OFFER_VALUES, max: 3 },
  { key: 'leadership_scope', type: 'enum', question: 'Führungsverantwortung', values: LEADERSHIP_VALUES },
  { key: 'leadership_team_size', type: 'int', question: 'Größe des geführten Teams' },
  { key: 'other_applications', type: 'enum', question: 'Andere laufende Bewerbungen', values: OTHER_APPLICATIONS_VALUES },
  { key: 'other_applications_notes', type: 'text', question: 'Stand der anderen Bewerbungen (ohne Firmennamen)' },
  { key: 'blocked_companies', type: 'list', question: 'Firmen, bei denen die Person NICHT vorgestellt werden will' },
  { key: 'previous_process_issues', type: 'text', question: 'Was lief in früheren Bewerbungsprozessen schlecht' },
  { key: 'presentation_consent', type: 'bool', question: 'Hat die Person der anonymen Vorstellung zugestimmt (true/false)' },
];

/** Felder, die die KI nur vorschlagen darf und die immer einzeln bestätigt werden. */
export const SENSITIVE_KEYS = ['blocked_companies', 'presentation_consent', 'other_applications', 'other_applications_notes', 'salary_minimum'];

export function buildSystemPrompt(): string {
  const fieldLines = FIELD_SPECS.map((f) => {
    const vals = f.values ? ` · erlaubt: ${f.values.join(' / ')}` : '';
    return `- ${f.key} (${f.type}): ${f.question}${vals}`;
  }).join('\n');
  return [
    'Du wertest Notizen oder Transkripte eines Kandidateninterviews für eine Personalberatung aus.',
    'Fülle NUR Felder, die im Text ausdrücklich stehen. Erfinde nichts, schätze nichts, rechne nichts hoch.',
    'Gib zu JEDEM Feld ein wörtliches Zitat (quote) aus dem Text an, 3 bis 160 Zeichen, exakt so geschrieben wie im Text.',
    'confidence: 3 = eindeutig gesagt, 2 = wahrscheinlich, 1 = unsicher oder mehrdeutig.',
    'Gehälter: Jahresbrutto in Euro als Zahl ("45k" = 45000). Monatsangaben nur mit Hinweis "monatlich" im Zitat, dann x12.',
    'Werte bei enum-Feldern exakt aus der erlaubten Liste. Listen mit " | " trennen.',
    'Bewerte die Person NICHT: keine Empfehlung, keine Einschätzung der Wechselbereitschaft, keine Passung.',
    'Übernimm NIE Angaben zu Gesundheit, Religion, Gewerkschaft, sexueller Orientierung, Herkunft/Nationalität, Familie (Kinder, Ehe, Schwangerschaft) oder Alter.',
    'Wenn solche Angaben vorkommen, nenne nur die Kategorie in protected_mentions.',
    'Platzhalter wie [Kandidat:in] oder [Arbeitgeber] sind geschwärzte Namen; übernimm sie nicht als Werte.',
    '',
    'Felder:',
    fieldLines,
  ].join('\n');
}

export function buildTool() {
  return {
    name: 'akte_befuellen',
    description: 'Gefundene Felder der Kandidatenakte mit Zitat-Beleg',
    parameters: {
      type: 'object',
      properties: {
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', enum: FIELD_SPECS.map((f) => f.key) },
              value: { type: 'string', description: 'Wert als Text' },
              quote: { type: 'string', description: 'Wörtliches Zitat aus dem Text' },
              confidence: { type: 'integer', enum: [1, 2, 3] },
            },
            required: ['key', 'value', 'quote', 'confidence'],
          },
        },
        protected_mentions: { type: 'array', items: { type: 'string', enum: PROTECTED_CATEGORIES } },
      },
      required: ['fields'],
    },
  };
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[„“"'’`´]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function quoteInSource(quote: string, source: string): boolean {
  const q = normalizeForMatch(quote);
  if (q.length < 3) return false;
  return normalizeForMatch(source).includes(q);
}

function parseMoneyText(v: string): number | null {
  const s = v.toLowerCase().replace(/€|eur(o)?/g, '').trim();
  const k = s.match(/^(\d+(?:[.,]\d+)?)\s*(k|t|tsd)/);
  let n: number;
  if (k) n = parseFloat(k[1].replace(',', '.')) * 1000;
  else if (/^\d{1,3}([.\s]\d{3})+$/.test(s)) n = parseInt(s.replace(/[.\s]/g, ''), 10);
  else n = parseFloat(s.replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n < 300) n *= 1000;
  return n >= 10000 && n <= 600000 ? Math.round(n) : null;
}

function matchEnum(v: string, values: string[]): string | null {
  const t = v.trim();
  return values.find((x) => x === t) ?? values.find((x) => x.toLowerCase() === t.toLowerCase()) ?? null;
}

const splitList = (v: string) => v.split(/\s*[|;]\s*|\s*,\s*/).map((x) => x.trim()).filter(Boolean);

export type ParsedValue = string | number | boolean | string[] | Array<{ language: string; proficiency: string }>;

export function parseFieldValue(spec: FieldSpec, raw: unknown): ParsedValue | null {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v || /^(null|none|unbekannt|keine angabe|n\/a)$/i.test(v)) return null;
  if (/\[(kandidat|arbeitgeber)/i.test(v)) return null;
  switch (spec.type) {
    case 'money': return parseMoneyText(v);
    case 'int': {
      const n = parseInt(v.replace(/[^\d]/g, ''), 10);
      return Number.isFinite(n) && n > 0 && n < 1000 ? n : null;
    }
    case 'bool': return /^(true|ja|yes)$/i.test(v) ? true : /^(false|nein|no)$/i.test(v) ? false : null;
    case 'enum': return matchEnum(v, spec.values ?? []);
    case 'enumList': {
      const items = splitList(v).map((x) => matchEnum(x, spec.values ?? [])).filter((x): x is string => !!x);
      const unique = [...new Set(items)].slice(0, spec.max ?? 20);
      return unique.length ? unique : null;
    }
    case 'list': {
      const items = [...new Set(splitList(v))].filter((x) => x.length <= 80);
      return items.length ? items.slice(0, 20) : null;
    }
    case 'languages': {
      const out = v.split(/\s*[|;]\s*/).map((part) => {
        const [lang, level] = part.split(/\s*[:–-]\s*/);
        const proficiency = matchEnum(level ?? '', LANGUAGE_LEVEL_VALUES) ?? '';
        return { language: (lang ?? '').trim(), proficiency };
      }).filter((l) => l.language && l.language.length <= 30);
      return out.length ? out : null;
    }
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    case 'text': return v.length <= 500 ? v : v.slice(0, 500);
    default: return null;
  }
}

export interface ExtractedField {
  key: string;
  value: ParsedValue;
  quote: string;
  confidence: 1 | 2 | 3;
  sensitive: boolean;
}

export interface ValidationResult {
  fields: ExtractedField[];
  dropped: Array<{ key: string; reason: 'quote' | 'value' | 'unknown' }>;
  protectedMentions: string[];
}

/** Prüft die KI-Antwort gegen die Quelle: Zitat muss stehen, Wert muss passen. */
export function validateExtraction(args: Record<string, unknown> | null, redactedSource: string): ValidationResult {
  const result: ValidationResult = { fields: [], dropped: [], protectedMentions: [] };
  if (!args) return result;
  const raw = Array.isArray(args.fields) ? args.fields : [];
  const byKey = new Map<string, ExtractedField>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { key, value, quote, confidence } = item as Record<string, unknown>;
    const spec = FIELD_SPECS.find((f) => f.key === key);
    if (!spec) { result.dropped.push({ key: String(key), reason: 'unknown' }); continue; }
    const q = typeof quote === 'string' ? quote.trim() : '';
    if (!quoteInSource(q, redactedSource)) { result.dropped.push({ key: spec.key, reason: 'quote' }); continue; }
    const parsed = parseFieldValue(spec, value);
    if (parsed == null) { result.dropped.push({ key: spec.key, reason: 'value' }); continue; }
    const conf = confidence === 3 || confidence === 2 ? confidence : 1;
    const field: ExtractedField = { key: spec.key, value: parsed, quote: q.slice(0, 200), confidence: conf, sensitive: SENSITIVE_KEYS.includes(spec.key) };
    const prev = byKey.get(spec.key);
    if (!prev || field.confidence > prev.confidence) byKey.set(spec.key, field);
  }
  result.fields = [...byKey.values()];
  const pm = Array.isArray(args.protected_mentions) ? args.protected_mentions : [];
  result.protectedMentions = [...new Set(pm.filter((p): p is string => typeof p === 'string' && PROTECTED_CATEGORIES.includes(p)))];
  return result;
}

/** Quellen zu einem Prompt-Text zusammenfügen (mit Kopfzeile je Quelle, gekürzt). */
export function joinSources(sources: Array<{ label?: string; text: string }>, maxChars = 60000): string {
  const parts = sources
    .filter((s) => s.text && s.text.trim())
    .map((s, i) => `### Quelle ${i + 1}${s.label ? `: ${s.label}` : ''}\n${s.text.trim()}`);
  const joined = parts.join('\n\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

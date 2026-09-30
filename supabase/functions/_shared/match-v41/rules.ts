/**
 * Match V4.1 – Regeln (F1–F8), pure Funktionen ohne I/O, einzeln testbar und
 * einzeln schaltbar. Geteilt von Edge Functions und Eval-Harness (evals/).
 * Entstanden als V3.2-Prototyp; die eingefrorene V3.1-Replika
 * (evals/adapters/v31-baseline) bleibt als Vergleich unangetastet.
 *
 * Grundsatz aller Fixes: FEHLENDE Daten sind UNBEKANNT, nicht NEGATIV und nicht
 * POSITIV. Unbekanntes verändert den Score nicht, senkt aber `confidence` und
 * erzeugt einen Prüfhinweis (Risk) für den Headhunter.
 */

// ============================================================================
// FLAGS
// ============================================================================

export interface V32Flags {
  /** F1: Sprachen aus candidate_languages (+ language_skills), ISO-/CEFR-Normalisierung, Kill nur bei Beweis. */
  F1: boolean;
  /** F1b: Sprach-Must-haves aus Freitext („Gute Deutschkenntnisse") raus aus der Skill-Coverage → nur Prüfhinweis, keine Score-Wirkung. */
  F1b: boolean;
  /** F2: Zertifikate aus certifications ∪ certificates (String oder {name}). */
  F2: boolean;
  /** F3: Visa-Kill nur bei job.visa_sponsorship === false. */
  F3: boolean;
  /** F4: Token-/Wortgrenzen-Matching statt bidirektionalem Substring; Jobtitel als Evidenz. */
  F4: boolean;
  /** F4domain: auch die Tech-Domain-Erkennung (TECH_DOMAINS, Titel-Keywords) tokenbasiert. Folgt F4, wenn nicht gesetzt. */
  F4domain: boolean;
  /** F5: keine Must-haves → Coverage unbekannt (statt 1.0), Tier-Cap 'maybe', `confidence` 0–1. */
  F5: boolean;
  /** F6: fehlende Gehalts-/Startdaten → neutral (75) ohne Positiv-Text; Unter-Budget-Risiko. */
  F6: boolean;
  /** F7: Startdatum aus notice_period, Vergleich mit Ziel-Datum der Stelle, weichere Strafe. */
  F7: boolean;
  /** F8: Berufsfeld-Kohärenz (Job-Familien aus Titeln) — fachfremd ohne Skill-Überschneidung → hidden. */
  F8: boolean;
}

export const NO_FIXES: V32Flags = {
  F1: false, F1b: false, F2: false, F3: false, F4: false, F4domain: false, F5: false, F6: false, F7: false, F8: false,
};

export const ALL_FIXES: V32Flags = {
  F1: true, F1b: true, F2: true, F3: true, F4: true, F4domain: true, F5: true, F6: true, F7: true, F8: true,
};

/** Neutralwert für unbekannte Teil-Scores — gleiche Konvention wie die Replika (Seniority/Industry unbekannt → 75). */
export const NEUTRAL_SCORE = 75;

// ============================================================================
// F4: TEXT-NORMALISIERUNG + TOKEN-MATCHING
// ============================================================================

/** Tech-Schreibweisen, die sonst von der Satzzeichen-Tokenisierung zerstört würden. */
const SPECIAL_TERMS: [RegExp, string][] = [
  [/c\+\+/g, ' cpp '],
  [/c#/g, ' csharp '],
  [/f#/g, ' fsharp '],
  [/(^|[^a-z0-9])\.net\b/g, '$1 dotnet '],
  [/\bci\s*\/\s*cd\b/g, ' cicd '],
  [/\bs\/4\s*hana\b/g, ' s4hana '],
  [/\bpl\/sql\b/g, ' plsql '],
  [/\ba\/b[- ]test/g, ' abtest'],
  [/\b([a-z0-9]+)\.js\b/g, ' $1js '], // node.js → nodejs, vue.js → vuejs
];

/** Kleinbuchstaben, Diakritika weg (ä→a, ß→ss), Tech-Sonderfälle geschützt. */
export function normalizeText(s: string | null | undefined): string {
  let t = String(s ?? '').toLowerCase().replace(/ß/g, 'ss');
  t = t.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  for (const [re, rep] of SPECIAL_TERMS) t = t.replace(re, rep);
  return t;
}

/** Deutsche Gender-Endung: Controllerin → controller, Referentin → referent, Analystin → analyst. */
function stripGender(tok: string): string {
  return tok.length >= 7 && /(erin|entin|istin|eurin)$/.test(tok) ? tok.slice(0, -2) : tok;
}

/** Leichtes Stemming, beidseitig identisch angewandt: Gender-Endung + Plural-s (microservices → microservice; nicht: business, vuejs). */
function stem(tok: string): string {
  const t = stripGender(tok);
  return t.length >= 5 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('js') ? t.slice(0, -1) : t;
}

/** Tokens ohne Plural-Stemming (für Titel-Klassifikation per Regex). */
export function rawTokens(s: string | null | undefined): string[] {
  return normalizeText(s).split(/[^a-z0-9]+/).filter(Boolean).map(stripGender);
}

export function tokenize(s: string | null | undefined): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem);
}

/**
 * Füllwörter aus Anforderungs-Sätzen. Nur echte Funktions-/Floskelwörter —
 * fachliche Wörter (auch „Ausbildung", „Studium") bleiben erhalten.
 */
const STOPWORDS = new Set([
  // de
  'und', 'oder', 'in', 'im', 'der', 'die', 'das', 'den', 'dem', 'de', 'des', 'mit', 'von', 'vom', 'zu', 'zur', 'zum',
  'fur', 'auf', 'an', 'am', 'al', 'als', 'bei', 'ein', 'eine', 'einer', 'eines', 'einem', 'sowie', 'bzw', 'ggf', 'etc',
  'mind', 'mindesten', 'mindestens', 'sehr', 'gute', 'guter', 'gutes', 'gut', 'fundierte', 'fundiert', 'umfangreiche',
  'sichere', 'sicherer', 'sichere', 'erste', 'ersten', 'mehrjahrige', 'mehrjahriger', 'langjahrige', 'kenntnisse',
  'kenntnissen', 'kenntnis', 'kenntni', 'erfahrung', 'erfahrungen', 'berufserfahrung', 'bereich', 'umgang', 'wort', 'schrift',
  'jahre', 'jahren', 'vergleichbar', 'vergleichbare', 'vergleichbaren', 'idealerweise', 'wunschenswert', 'ihre', 'ihr',
  'du', 'dein', 'deine', 'sie', 'wir', 'ist', 'sind', 'hast', 'haben', 'hohe', 'hoher', 'stark', 'starke', 'plu',
  // en
  'and', 'or', 'the', 'of', 'with', 'for', 'to', 'a', 'an', 'on', 'at', 'by', 'experience', 'experienced', 'knowledge',
  'skill', 'skills', 'strong', 'good', 'very', 'excellent', 'proven', 'year', 'years', 'solid', 'deep', 'working',
  'hand', 'hands', 'plus', 'is', 'are', 'be', 'your', 'you', 'our', 'we', 'it',
  // Hersteller-Präfixe, die nichts unterscheiden (MS Excel ≙ Excel)
  'ms', 'microsoft',
]);

/** Inhalts-Tokens: ohne Füllwörter und ohne reine ein-/zweistellige Zahlen. */
export function contentTokens(tokens: string[]): string[] {
  return tokens.filter((t) => !STOPWORDS.has(t) && !/^\d{1,2}$/.test(t));
}

/**
 * Spezialisierung ⇒ Oberbegriff, wo die Kurzform (< 6 Zeichen) sonst nur noch
 * exakt matcht: v3.1 fand „SQL" per Substring in „MySQL"/„PostgreSQL" — das
 * war richtig und bleibt erhalten (NoSQL bewusst NICHT).
 */
const IMPLIES: Record<string, string[]> = {
  mysql: ['sql'], postgresql: ['sql'], postgre: ['sql'], postgres: ['sql'], mssql: ['sql'], plsql: ['sql'],
  tsql: ['sql'], sqlite: ['sql'], mariadb: ['sql'],
};

/**
 * Token-Gleichheit. `needle` erfüllt `hay`, wenn
 * - identisch,
 * - JS-Suffix-Variante (react ≙ reactjs),
 * - deutsches Kompositum: hay endet auf needle und needle hat ≥ 6 Zeichen
 *   (Finanzbuchhaltung ⊇ Buchhaltung — das Grundwort steht im Deutschen hinten).
 * Kurze Tokens (< 6) matchen NUR exakt — „ts", „go", „ai" nie mehr als Teilstring.
 */
export function tokenEq(needle: string, hay: string): boolean {
  if (needle === hay) return true;
  if (needle + 'js' === hay || hay + 'js' === needle) return true;
  if (IMPLIES[hay]?.includes(needle)) return true;
  return needle.length >= 6 && hay.length > needle.length && hay.endsWith(needle);
}

interface PreparedTerm {
  tokens: string[];
  joined: string;
  /** Inhalts-Tokens; reine Füllwort-Terme zählen als Ganzes. */
  content: string[];
}

// Reiner Performance-Cache (Terme wiederholen sich in den Schleifen über Taxonomie/Domains massiv).
const PREP_CACHE = new Map<string, PreparedTerm>();
function prep(s: string): PreparedTerm {
  let p = PREP_CACHE.get(s);
  if (!p) {
    const tokens = tokenize(s);
    const content = contentTokens(tokens);
    p = { tokens, joined: tokens.join(''), content: content.length > 0 ? content : tokens };
    if (PREP_CACHE.size > 50_000) PREP_CACHE.clear();
    PREP_CACHE.set(s, p);
  }
  return p;
}

/** Einseitig: alle Inhalts-Tokens von `needle` kommen in `hay` vor (beliebige Reihenfolge). */
export function termContainedIn(needle: string, hay: string): boolean {
  const n = prep(needle);
  const h = prep(hay);
  if (n.tokens.length === 0 || h.tokens.length === 0) return false;
  if (n.joined === h.joined) return true; // TailwindCSS ≙ Tailwind CSS, PowerBI ≙ Power BI
  return n.content.every((t) => h.tokens.some((ht) => tokenEq(t, ht)));
}

/** Dachmarken: allein belegen sie keinen spezifischeren Mehrwort-Term („SAP" ⇏ „SAP FI/CO"). */
const UMBRELLA_TOKENS = new Set(['sap', 'oracle', 'adobe', 'google', 'ibm', 'apple', 'office']);

function umbrellaOnly(needle: string, hay: string): boolean {
  const n = prep(needle);
  return n.content.length === 1 && UMBRELLA_TOKENS.has(n.content[0]) && prep(hay).content.length > 1;
}

/**
 * F4-Ersatz für `a.includes(b) || b.includes(a)`: symmetrisch wie das Original,
 * aber auf Token-/Wortgrenzen-Ebene. Mehrwort-Terme matchen nur, wenn ALLE
 * ihre Inhalts-Tokens auf der anderen Seite vorkommen.
 */
export function termMatches(a: string, b: string): boolean {
  return (termContainedIn(a, b) && !umbrellaOnly(a, b)) || (termContainedIn(b, a) && !umbrellaOnly(b, a));
}

/** Legacy-Verhalten der Replika (bidirektionaler Substring) — für F4=aus. */
export function legacySubstringMatch(a: string, b: string): boolean {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.includes(y) || y.includes(x);
}

// Rollen-Nomen → Tätigkeits-Nomen: „Data Scientist" belegt „Data Science".
const TITLE_ROLE_SUFFIXES: [RegExp, string][] = [
  [/scientist$/, 'science'],
  [/controller$/, 'controlling'],
  [/buchhalter$/, 'buchhaltung'],
  [/entwickler$/, 'entwicklung'],
  [/developer$/, 'development'],
  [/engineer$/, 'engineering'],
  [/designer$/, 'design'],
  [/manager$/, 'management'],
  [/recruiter$/, 'recruiting'],
  [/berater$/, 'beratung'],
  [/consultant$/, 'consulting'],
  [/analyst$/, 'analytics'],
  [/architect$/, 'architecture'],
  [/administrator$/, 'administration'],
  [/programmierer$/, 'programmierung'],
  [/tester$/, 'testing'],
];
const TITLE_NOISE = new Set(['senior', 'junior', 'sr', 'jr', 'lead', 'head', 'principal', 'staff', 'm', 'w', 'd', 'f', 'x', 'div']);

/** Gender-Marker „(m/w/d)", „:in", „*in" aus Titeln entfernen. */
export function cleanTitle(title: string | null | undefined): string {
  return String(title ?? '')
    .replace(/\(\s*[mwdfx](\s*[/|,]\s*[mwdfx])+\s*\)/gi, ' ')
    .replace(/[:*_]in\b/gi, '');
}

/**
 * F4: Jobtitel des Kandidaten als Evidenz für Rollen-Anforderungen.
 * Liefert den bereinigten Titel plus Nominalisierungen
 * („Data Scientist" → „data science", „Controllerin" → „controlling").
 */
export function deriveTitleEvidence(title: string | null | undefined): string[] {
  const cleaned = cleanTitle(title);
  const parts = cleaned.split(/\s*(?:\/|&|\|| und | and |,)\s*/i).filter((p) => p.trim().length > 0);
  const out = new Set<string>();
  for (const part of parts) {
    const toks = tokenize(part).filter((t) => !TITLE_NOISE.has(t));
    if (toks.length === 0) continue;
    out.add(toks.join(' '));
    const derived = toks.map((t) => {
      for (const [re, rep] of TITLE_ROLE_SUFFIXES) if (re.test(t)) return t.replace(re, rep);
      return t;
    });
    if (derived.join(' ') !== toks.join(' ')) out.add(derived.join(' '));
  }
  return [...out];
}

// ============================================================================
// F1: SPRACHEN
// ============================================================================

const LANGUAGE_NAMES: Record<string, string[]> = {
  de: ['deutsch', 'german', 'de', 'ger', 'deu'],
  en: ['englisch', 'english', 'en', 'eng'],
  fr: ['franzosisch', 'french', 'francais', 'fr'],
  es: ['spanisch', 'spanish', 'espanol', 'es'],
  it: ['italienisch', 'italian', 'italiano', 'it'],
  nl: ['niederlandisch', 'hollandisch', 'dutch', 'nederlands', 'flamisch', 'nl'],
  pl: ['polnisch', 'polish', 'polski', 'pl'],
  tr: ['turkisch', 'turkish', 'turkce', 'tr'],
  ru: ['russisch', 'russian', 'ru'],
  ar: ['arabisch', 'arabic', 'ar'],
  pt: ['portugiesisch', 'portuguese', 'pt'],
  hr: ['kroatisch', 'croatian', 'hr'],
  sr: ['serbisch', 'serbian', 'sr'],
  bs: ['bosnisch', 'bosnian', 'bs'],
  bg: ['bulgarisch', 'bulgarian', 'bg'],
  hu: ['ungarisch', 'hungarian', 'hu'],
  ro: ['rumanisch', 'romanian', 'ro'],
  cs: ['tschechisch', 'czech', 'cs'],
  sk: ['slowakisch', 'slovak', 'sk'],
  el: ['griechisch', 'greek', 'el'],
  uk: ['ukrainisch', 'ukrainian', 'uk'],
  zh: ['chinesisch', 'chinese', 'mandarin', 'zh'],
  ja: ['japanisch', 'japanese', 'ja'],
  ko: ['koreanisch', 'korean', 'ko'],
  sv: ['schwedisch', 'swedish', 'sv'],
  da: ['danisch', 'danish', 'da'],
  no: ['norwegisch', 'norwegian', 'no'],
  fi: ['finnisch', 'finnish', 'fi'],
  fa: ['persisch', 'farsi', 'persian', 'fa'],
  hi: ['hindi', 'hi'],
  sq: ['albanisch', 'albanian', 'sq'],
};
const LANGUAGE_LOOKUP = new Map<string, string>();
for (const [code, names] of Object.entries(LANGUAGE_NAMES)) for (const n of names) LANGUAGE_LOOKUP.set(n, code);

/** Sprachname/-code → ISO 639-1 („Deutsch" → de, „Englisch" → en, „nl" → nl). */
export function normalizeLanguageCode(name: string | null | undefined): string | null {
  const t = normalizeText(name).trim().replace(/\s+/g, ' ');
  if (!t) return null;
  if (LANGUAGE_LOOKUP.has(t)) return LANGUAGE_LOOKUP.get(t)!;
  const first = t.split(/[^a-z]+/).find(Boolean);
  return first && first.length > 2 && LANGUAGE_LOOKUP.has(first) ? LANGUAGE_LOOKUP.get(first)! : null;
}

/** CEFR-Rang: A1=1 … C2=6, Muttersprache=7 (über C2). */
export const LEVEL_RANK = { a1: 1, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6, native: 7 } as const;

/**
 * Niveau → Rang. Muttersprache/native → 7; verhandlungssicher/fließend/fluent/
 * sehr gut → C1; gut → B2; conversational/intermediate → B1;
 * Grundkenntnisse/basic → A2. Unbekannt → null (NICHT A1 wie in v3.1).
 */
export function normalizeLanguageLevel(level: string | null | undefined): number | null {
  const t = normalizeText(level).trim();
  if (!t) return null;
  const cefr = t.match(/\b([abc])\s*([12])\b/);
  if (cefr) return LEVEL_RANK[`${cefr[1]}${cefr[2]}` as keyof typeof LEVEL_RANK];
  if (/mutter|native|erstsprache|mother tongue|bilingual|zweisprachig/.test(t)) return 7;
  if (/verhandlungssicher|fliessend|fluent|sehr gut|excellent|exzellent|hervorragend|proficient|business/.test(t)) return 5;
  if (/upper intermediate|advanced|fortgeschritten|gut|good/.test(t)) return 4;
  if (/intermediate|conversational|konversation|mittel|befriedigend/.test(t)) return 3;
  if (/grundkenntnis|basic|elementary|beginner|anfanger|grundlegend|schul/.test(t)) return 2;
  return null;
}

export interface CandidateLanguage {
  code: string;
  rank: number | null;
}

/**
 * F1: Kandidatensprachen aus candidate_languages ({language, proficiency})
 * UND language_skills ({language|code, level}). Gibt null zurück, wenn gar
 * keine Sprachdaten vorliegen (= unbekannt, nicht „spricht nichts").
 * Bei Duplikaten gewinnt das höhere belegte Niveau.
 */
export function collectCandidateLanguages(candidate: {
  candidate_languages?: unknown;
  language_skills?: unknown;
}): CandidateLanguage[] | null {
  const raw: { name: unknown; level: unknown }[] = [];
  for (const l of asArray(candidate.candidate_languages)) {
    raw.push({ name: l?.language ?? l?.code, level: l?.proficiency ?? l?.level });
  }
  for (const l of asArray(candidate.language_skills)) {
    raw.push({ name: l?.language ?? l?.code, level: l?.level ?? l?.proficiency });
  }
  const byCode = new Map<string, CandidateLanguage>();
  for (const r of raw) {
    const code = normalizeLanguageCode(typeof r.name === 'string' ? r.name : null);
    if (!code) continue;
    const rank = normalizeLanguageLevel(typeof r.level === 'string' ? r.level : null);
    const prev = byCode.get(code);
    if (!prev || (rank ?? -1) > (prev.rank ?? -1)) byCode.set(code, { code, rank });
  }
  return byCode.size > 0 ? [...byCode.values()] : null;
}

export type LanguageStatus =
  | 'met'
  | 'unknown_no_data' // Kandidat hat gar keine Sprachdaten
  | 'unknown_level' // Sprache vorhanden, Niveau unbekannt
  | 'below_1' // eine CEFR-Stufe unter Anforderung
  | 'below_2plus' // zwei+ Stufen darunter = belegt zu niedrig
  | 'absent_listed'; // andere Sprachen gelistet, geforderte nicht

export interface LanguageRequirement {
  code: string;
  /** Rang wie LEVEL_RANK; null = kein Mindestniveau. */
  minRank: number | null;
  /** true = aus Freitext abgeleitet (F1b) → nie Kill. */
  soft?: boolean;
}

export interface LanguageCheck {
  requirement: LanguageRequirement;
  status: LanguageStatus;
  kill: boolean;
  /** Score-Multiplikator (1 = keine Strafe). */
  multiplier: number;
  /** Tier-Obergrenze 'maybe' (Headhunter muss prüfen). */
  capMaybe: boolean;
  risk?: string;
}

/**
 * F1-Entscheidungsregel (bewusst konservativ):
 * - KEINE Sprachdaten → unbekannt: kein Kill, keine Strafe, nur Prüfhinweis.
 * - Sprache da, Niveau unbekannt → kein Kill, Prüfhinweis.
 * - Niveau belegt ≥ 2 Stufen zu niedrig (z. B. B1 bei C1-Pflicht) → Kill
 *   (nur bei strukturierter Anforderung; Freitext-Anforderungen → Strafe 0.6).
 * - Niveau 1 Stufe zu niedrig (B2 statt C1) → kein Kill, Strafe 0.8:
 *   Selbsteinschätzungen und „fluent"→C1-Mapping sind ±1 Stufe unscharf.
 * - Sprache fehlt, obwohl andere gelistet sind → KEIN Kill, Strafe 0.5 +
 *   Tier-Cap: deutsche Lebensläufe lassen die Muttersprache oft weg, und der
 *   CV-Parser extrahiert nicht immer vollständig — Abwesenheit ist ein starkes
 *   Indiz, aber kein Beweis.
 * - Freitext-Anforderungen (F1b, `soft`) verändern den Score NIE, sondern
 *   erzeugen nur Prüfhinweise (+ Tier-Cap bei belegt ≥ 2 Stufen zu niedrig).
 *   Gemessen auf real-v1: eine weiche Strafe (0.85/0.7/0.6) kostete −0.033
 *   nDCG@10 — beide interviewten Kandidaten der Java-Stelle erfüllen
 *   „Excellent communication skills in Dutch" nicht. Freitext ist Wunschliste.
 */
export function evaluateLanguageRequirement(req: LanguageRequirement, langs: CandidateLanguage[] | null): LanguageCheck {
  const label = `${req.code.toUpperCase()}${req.minRank ? ` ${rankLabel(req.minRank)}` : ''}`;
  if (langs === null) {
    return { requirement: req, status: 'unknown_no_data', kill: false, multiplier: 1, capMaybe: false, risk: `Sprachkenntnisse nicht erfasst (${label} gefordert) – prüfen` };
  }
  const have = langs.find((l) => l.code === req.code);
  if (!have) {
    return {
      requirement: req, status: 'absent_listed', kill: false, multiplier: req.soft ? 1 : 0.5, capMaybe: !req.soft,
      risk: `${label} gefordert, im Profil nicht angegeben – prüfen`,
    };
  }
  if (req.minRank === null) return { requirement: req, status: 'met', kill: false, multiplier: 1, capMaybe: false };
  if (have.rank === null) {
    return { requirement: req, status: 'unknown_level', kill: false, multiplier: 1, capMaybe: false, risk: `${label} gefordert, Niveau unbekannt – prüfen` };
  }
  const gap = req.minRank - have.rank;
  if (gap <= 0) return { requirement: req, status: 'met', kill: false, multiplier: 1, capMaybe: false };
  if (gap === 1) {
    return {
      requirement: req, status: 'below_1', kill: false, multiplier: req.soft ? 1 : 0.8, capMaybe: false,
      risk: `${label} gefordert, Profil: ${rankLabel(have.rank)} – Niveau prüfen`,
    };
  }
  return {
    requirement: req, status: 'below_2plus', kill: !req.soft, multiplier: req.soft ? 1 : 0, capMaybe: true,
    risk: `${label} gefordert, Profil nur ${rankLabel(have.rank)}`,
  };
}

function rankLabel(rank: number): string {
  return ['?', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Muttersprache'][rank] ?? '?';
}

/** Anforderung aus job.required_languages ({code, minLevel}) → LanguageRequirement. */
export function toLanguageRequirement(r: { code?: string; minLevel?: string } | null | undefined): LanguageRequirement | null {
  const code = normalizeLanguageCode(r?.code ?? null);
  if (!code) return null;
  return { code, minRank: r?.minLevel ? normalizeLanguageLevel(r.minLevel) : null };
}

/**
 * Sprachnennung im Anforderungs-Freitext (F1b): „Deutsch", „Deutschkenntnisse",
 * „Deutsch-" (Elision), „deutsche Sprache", „German" — aber NICHT das Adjektiv
 * („im deutschen Steuerrecht").
 */
function languageWord(deStem: string, enNames: string): RegExp {
  return new RegExp(`\\b${deStem}(kenntnis\\w*|sprach\\w*)?\\b|\\b${deStem}e[nrs]? sprache|\\b(${enNames})\\b`);
}
const TEXT_LANGUAGE_STEMS: [RegExp, string][] = [
  [languageWord('deutsch', 'german'), 'de'],
  [languageWord('englisch', 'english'), 'en'],
  [languageWord('franzosisch', 'french'), 'fr'],
  [languageWord('spanisch', 'spanish'), 'es'],
  [languageWord('italienisch', 'italian'), 'it'],
  [languageWord('(?:niederlandisch|hollandisch)', 'dutch'), 'nl'],
  [languageWord('polnisch', 'polish'), 'pl'],
  [languageWord('turkisch', 'turkish'), 'tr'],
  [languageWord('russisch', 'russian'), 'ru'],
  [languageWord('arabisch', 'arabic'), 'ar'],
];
const LANGUAGE_CONTEXT = /kenntnis|sprach|skill|communication|kommunikation|wort|schrift|niveau|level|\b[abc][12]\b|mutter|native|fliessend|fluent|verhandlungssicher|sehr gut|gutes|gute|excellent|business/;

/** F1b: Mindestniveau aus Freitext; Standard B2, wenn nur „Kenntnisse" genannt sind. */
export function levelFromText(text: string): number {
  const t = normalizeText(text);
  const explicit = [...t.matchAll(/\b([abc])\s*([12])\b/g)].map((m) => LEVEL_RANK[`${m[1]}${m[2]}` as keyof typeof LEVEL_RANK]);
  if (explicit.length > 0) return Math.max(...explicit);
  if (/mutter|native/.test(t)) return 7;
  if (/verhandlungssicher|fliessend|fluent|excellent|exzellent|hervorragend|sehr gut|business/.test(t)) return 5;
  if (/grundkenntnis|basic|erste/.test(t)) return 2;
  return 4;
}

/**
 * F1b: Erkennt Sprach-Must-haves im Freitext („Gute Deutsch- und
 * Englischkenntnisse", „Excellent communication skills in Dutch and English").
 * Gibt [] zurück, wenn der Text keine Sprachanforderung ist.
 */
export function extractLanguageRequirementsFromText(text: string): LanguageRequirement[] {
  const t = normalizeText(text);
  if (!LANGUAGE_CONTEXT.test(t) && tokenize(t).length > 2) return [];
  const codes = TEXT_LANGUAGE_STEMS.filter(([re]) => re.test(t)).map(([, code]) => code);
  if (codes.length === 0) return [];
  const minRank = levelFromText(t);
  return [...new Set(codes)].map((code) => ({ code, minRank, soft: true }));
}

/** Fragment ohne Sprache, das nur ein Niveau/Anhang ist („C2-Level und besser", „in Wort und Schrift"). */
export function isLanguageContinuationFragment(text: string): boolean {
  const t = normalizeText(text).trim();
  if (TEXT_LANGUAGE_STEMS.some(([re]) => re.test(t))) return false;
  return /^(mind\.?\s*)?[abc][12]\b|^(in )?wort (und|&) schrift|^level\b/.test(t);
}

// ============================================================================
// F2: ZERTIFIKATE
// ============================================================================

/** F2: certifications ∪ certificates; Einträge als String oder {name, url}. */
export function collectCandidateCertifications(candidate: { certifications?: unknown; certificates?: unknown }): string[] {
  const out: string[] = [];
  for (const c of [...asArray(candidate.certifications), ...asArray(candidate.certificates)]) {
    const name = typeof c === 'string' ? c : typeof c?.name === 'string' ? c.name : null;
    if (name && name.trim()) out.push(name.trim());
  }
  return [...new Set(out)];
}

export type CertStatus = 'met' | 'missing_listed' | 'unknown_no_data';

/**
 * F2: fehlen JEGLICHE Zertifikatsdaten → unbekannt (kein Kill, Prüfhinweis).
 * Sind Zertifikate gelistet, aber nicht das geforderte → Kill wie v3.1
 * (Zertifikate werden im CV im Gegensatz zur Muttersprache nicht implizit weggelassen).
 */
export function evaluateCertRequirement(
  required: string,
  certs: string[],
  match: (a: string, b: string) => boolean,
): CertStatus {
  if (certs.length === 0) return 'unknown_no_data';
  return certs.some((c) => match(required, c)) ? 'met' : 'missing_listed';
}

// ============================================================================
// F3: VISA
// ============================================================================

export type VisaStatus = 'ok' | 'kill' | 'unknown';

/** F3: Kill NUR, wenn die Stelle Sponsoring ausdrücklich verneint; null/undefined = unbekannt. */
export function evaluateVisa(candidate: { visa_required?: unknown }, job: { visa_sponsorship?: unknown }): VisaStatus {
  if (!candidate.visa_required) return 'ok';
  if (job.visa_sponsorship === false) return 'kill';
  if (job.visa_sponsorship === true) return 'ok';
  return 'unknown';
}

// ============================================================================
// F6: GEHALT
// ============================================================================

export interface SalarySignal {
  known: boolean;
  candidateSalary: number;
  /** Erwartung < 0.8 × salary_min → Seniorität prüfen (KEIN Bonus). */
  underBudgetRisk: boolean;
}

export function salarySignal(
  candidate: { expected_salary?: unknown; salary_expectation_min?: unknown },
  job: { salary_min?: unknown; salary_max?: unknown },
): SalarySignal {
  const candidateSalary = Number(candidate.expected_salary || candidate.salary_expectation_min || 0) || 0;
  const max = Number(job.salary_max || 0) || 0;
  const min = Number(job.salary_min || 0) || 0;
  return {
    known: candidateSalary > 0 && max > 0,
    candidateSalary,
    underBudgetRisk: candidateSalary > 0 && min > 0 && candidateSalary < 0.8 * min,
  };
}

// ============================================================================
// F7: STARTDATUM / KÜNDIGUNGSFRIST
// ============================================================================

const DAY_MS = 86_400_000;

function addMonths(ms: number, months: number): Date {
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
}

function daysBetween(fromMs: number, toMs: number): number {
  return Math.ceil((toMs - fromMs) / DAY_MS);
}

/**
 * F7: notice_period → Tage bis frühestmöglichem Start (Kündigung heute).
 * Enum-Werte des Formulars + deutscher/englischer Freitext („3 Monate").
 * 3_months_eoq = 3 Monate zum Quartalsende: erst +3 Monate, dann Ende des
 * Quartals, in dem dieses Datum liegt.
 */
export function noticePeriodToDays(value: string | null | undefined, nowMs: number): number | null {
  const t = normalizeText(value).trim();
  if (!t) return null;
  const fixed: Record<string, number> = { immediate: 0, '2_weeks': 14, '1_month': 30, '6_weeks': 42 };
  if (t in fixed) return fixed[t];
  const monthsEnum: Record<string, number> = { '2_months': 2, '3_months': 3, '6_months': 6 };
  if (t in monthsEnum) return daysBetween(nowMs, addMonths(nowMs, monthsEnum[t]).getTime());
  const eoq = t === '3_months_eoq' || /quartal|quarter|eoq/.test(t);
  if (/sofort|immediate|keine|none|verfugbar/.test(t) && !/\d/.test(t)) return 0;
  const m = t.match(/(\d+)\s*(woche|week|wo\b|monat|month|mo\b|tag|day)/);
  let days: number | null = null;
  let afterMonths: Date | null = null;
  if (t === '3_months_eoq') afterMonths = addMonths(nowMs, 3);
  else if (m) {
    const n = Number(m[1]);
    if (/woche|week|wo/.test(m[2])) days = n * 7;
    else if (/tag|day/.test(m[2])) days = n;
    else afterMonths = addMonths(nowMs, n);
  }
  if (afterMonths) {
    if (eoq) {
      const q = Math.floor(afterMonths.getUTCMonth() / 3);
      const endOfQuarter = Date.UTC(afterMonths.getUTCFullYear(), q * 3 + 3, 0); // letzter Tag des Quartals
      return daysBetween(nowMs, endOfQuarter);
    }
    return daysBetween(nowMs, afterMonths.getTime());
  }
  return days;
}

export interface StartInfo {
  days: number | null;
  source: 'availability_date' | 'notice_period' | 'unknown';
}

/** F7: availability_date hat Vorrang; sonst notice_period; sonst unbekannt. */
export function resolveStartDays(
  candidate: { availability_date?: unknown; notice_period?: unknown },
  nowMs: number,
  useNotice: boolean,
): StartInfo {
  if (candidate.availability_date) {
    const ms = new Date(String(candidate.availability_date)).getTime();
    if (!Number.isNaN(ms)) return { days: Math.ceil((ms - nowMs) / DAY_MS), source: 'availability_date' };
  }
  if (useNotice && typeof candidate.notice_period === 'string') {
    const d = noticePeriodToDays(candidate.notice_period, nowMs);
    if (d !== null) return { days: d, source: 'notice_period' };
  }
  return { days: null, source: 'unknown' };
}

/** Ziel-/Besetzungsdatum der Stelle, falls vorhanden (Tage ab jetzt). */
export function resolveJobTargetDays(
  job: { start_date?: unknown; desired_start_date?: unknown; fill_by?: unknown; hiring_deadline?: unknown },
  nowMs: number,
): number | null {
  const raw = job.start_date ?? job.desired_start_date ?? job.fill_by ?? job.hiring_deadline;
  if (!raw) return null;
  const ms = new Date(String(raw)).getTime();
  return Number.isNaN(ms) ? null : Math.ceil((ms - nowMs) / DAY_MS);
}

/**
 * F7: weichere Startdatum-Strafe. 3 Monate Kündigungsfrist sind in
 * Deutschland Normalfall — v3.1 multiplizierte ab 90 Tagen mit 0.4.
 * Mit Ziel-Datum zählt die Verspätung dagegen, sonst die absolute Frist.
 */
export function softStartDate(startDays: number, targetDays: number | null): { multiplier: number; score: number } {
  if (targetDays !== null) {
    const late = startDays - targetDays;
    if (late <= 0) return { multiplier: 1, score: 100 };
    if (late <= 30) return { multiplier: 0.95, score: 85 };
    if (late <= 60) return { multiplier: 0.9, score: 70 };
    if (late <= 90) return { multiplier: 0.85, score: 60 };
    return { multiplier: 0.75, score: 45 };
  }
  if (startDays <= 30) return { multiplier: 1, score: 100 };
  if (startDays <= 60) return { multiplier: 0.97, score: 90 };
  if (startDays <= 100) return { multiplier: 0.93, score: 80 }; // 3 Monate = normal
  if (startDays <= 190) return { multiplier: 0.85, score: 65 };
  return { multiplier: 0.75, score: 50 };
}

// ============================================================================
// F8: BERUFSFELD-KOHÄRENZ
// ============================================================================

export type JobFamily =
  | 'software_dev' | 'data_analytics' | 'finance_accounting' | 'controlling' | 'sap_erp' | 'hr' | 'sales'
  | 'marketing' | 'customer_service' | 'healthcare' | 'electronics_embedded' | 'engineering' | 'technical_trades'
  | 'logistics' | 'product' | 'design'
  | 'legal' | 'education' | 'hospitality' | 'construction';

/** Fach-Signale im Titel (auf normalisiertem Text, Diakritika entfernt). Reihenfolge egal — Mehrfachtreffer erlaubt. */
const FAMILY_PATTERNS: [JobFamily, RegExp][] = [
  ['controlling', /controll(er|ing)/],
  ['finance_accounting', /buchhalt|buchfuhr|accountant|accounting|bilanz|finanz(?!ierung)|financ(e|ial)\b|steuerfach|steuerberat|\btax\b|treasury|rechnungswesen|kreditor|debitor|payroll|wirtschaftsprufer|\baudit/],
  ['sap_erp', /\bsap\b|\babap\b|\berp\b/],
  ['hr', /\bhr\b|human resources|personalreferent|personalsachbearbeit|personalleit|personalentwickl|personalwesen|recruit|talent acquisition|people (partner|manager)|personaler/],
  ['data_analytics', /\bdata\b|datenanaly|analytics|\bbi\b|business intelligence|machine learning|\bml\b|\bai\b|\bki\b|scientist|statistik|dashboard/],
  ['software_dev', /entwickler|developer|software|programmier|frontend|backend|full ?stack|devops|devsecops|\bsre\b|\bengineer\b|engineering manager|\bit[- ]?architekt|software ?archite|cloud|\bweb\b|\bmobile\b|\bios\b|android|tester|\bqa\b|systemadmin|administrator|security|\bsoc\b|informatik/],
  // Hardware-nahe Entwicklung (grenzt an Software) vs. Ingenieurwesen vs. technisches Handwerk/Betrieb (grenzt NICHT an Software).
  ['electronics_embedded', /hardware|elektronik|embedded|fpga|firmware|\bsps\b|\bplc\b|automatisierung/],
  ['engineering', /ingenieur|maschinenbau|konstrukt|verfahrenstech|elektrotechn/],
  ['technical_trades', /mechatron|mechaniker|\bkfz\b|techniker|kesselwart|haustechn|facility|betriebstechn|instandhalt|fertigung|produktionsleit|elektriker|monteur|schlosser/],
  ['product', /product (owner|manager|management|lead)|produktmanag|produkt ?owner|produktverantwort/],
  ['design', /designer|\bdesign\b|\bux\b|\bui\b|grafik|mediengestalt/],
  ['sales', /\bsales\b|salesperson|vertrieb|account manag|key account|business development|verkauf|kundenberater|akquise/],
  ['marketing', /marketing|\bseo\b|social media|brand manag|content manag|werbung|kommunikationsmanag|\bpr\b/],
  ['customer_service', /kundenservice|customer (service|support|success)|\bsupport\b|call ?center|servicecenter|patientenservice|empfang|rezeption/],
  ['healthcare', /pflege|\barzt|arztin|medizin|kranken|therapeut|\bmfa\b|apothek|gesundheits|hebamme/],
  ['logistics', /logistik|lagerist|\blager|versand|spedition|disponent|supply chain|einkauf|procurement|berufskraftfahrer|kommissionier/],
  ['legal', /anwalt|anwaltin|jurist|\blegal\b|kanzlei|notar|syndikus/],
  ['education', /lehrer|lehrkraft|dozent|erzieher|padagog|teacher/],
  ['hospitality', /\bkoch\b|kochin|kuchen(chef|leit)|barkeeper|kellner|gastro|hotel|restaurant|friseur/],
  ['construction', /bauleit|bauingenieur|hochbau|tiefbau|polier|maurer|zimmerer|bauwesen/],
];

/**
 * Generalisten-Rollen: das Rollen-Nomen verlangt kein Fach-Handwerk; ein
 * Abteilungs-Zusatz („Referent Bereichsleitung IT", „Business Specialist CRM")
 * macht daraus keine Fachfamilie. Solche Titel lösen F8 NIE aus.
 */
const GENERALIST_ROLE = /referent|assistenz|assistant|sachbearbeit|specialist|spezialist|projektmanag|project manag|projektleit|program(m)? manag|scrum master|agile coach|geschaftsfuhr|\bceo\b|\bcoo\b|managing director|general manager|direktor|director|head of|\bleiter\b|\bleitung\b|prokurist|branch manager|consultant|berater|officer|koordinator|coordinator|\bmanager\b|\bmitarbeiter\b|kaufm/;

/** Fach-Familien, die sich ohne expliziten Titel-Beleg trotz Generalisten-Rolle behaupten (Fach-Führung). */
const CRAFT_OVERRIDES_GENERALIST = new Set<JobFamily>([
  'finance_accounting', 'controlling', 'hr', 'software_dev', 'data_analytics', 'sales', 'marketing', 'product',
  'design', 'electronics_embedded', 'engineering', 'technical_trades', 'healthcare', 'construction', 'legal', 'sap_erp',
  'logistics',
]);

export interface FamilyResult {
  families: JobFamily[];
  /** 'general' = Generalisten-Rolle; 'unknown' = kein Signal. Beides löst F8 nie aus. */
  kind: 'classified' | 'general' | 'unknown';
}

export function classifyJobFamilies(title: string | null | undefined): FamilyResult {
  const t = ` ${rawTokens(cleanTitle(title)).join(' ')} `;
  if (!t.trim()) return { families: [], kind: 'unknown' };
  const families = FAMILY_PATTERNS.filter(([, re]) => re.test(t)).map(([f]) => f);
  const generalist = GENERALIST_ROLE.test(t);
  // „Projektmanager Hochbau" → construction; „Referent Bereichsleitung IT" → general
  // (IT ist dort Abteilung, kein Handwerk: das Muster \bit\b steht bewusst nicht in software_dev).
  const craft = families.filter((f) => CRAFT_OVERRIDES_GENERALIST.has(f));
  if (generalist && craft.length === 0) return { families: [], kind: 'general' };
  if (families.length === 0) return { families: [], kind: generalist ? 'general' : 'unknown' };
  return { families, kind: 'classified' };
}

/**
 * Angrenzende Familien (Wechsel üblich, Vokabular unterschiedlich). Bewusst
 * eng: fachliche Nähe darüber hinaus fängt die Skill-Überschneidung ab.
 */
const ADJACENT: [JobFamily, JobFamily][] = [
  ['finance_accounting', 'controlling'],
  ['finance_accounting', 'sap_erp'],
  ['controlling', 'sap_erp'],
  ['controlling', 'data_analytics'],
  ['software_dev', 'data_analytics'],
  ['software_dev', 'electronics_embedded'], // Embedded/Firmware
  ['electronics_embedded', 'engineering'],
  ['engineering', 'technical_trades'],
  ['product', 'design'],
  ['product', 'software_dev'],
  ['product', 'data_analytics'],
  ['sales', 'customer_service'],
  ['customer_service', 'healthcare'], // Patientenservice
  ['customer_service', 'hospitality'],
  ['engineering', 'construction'],
  ['design', 'marketing'],
];

export function familiesCoherent(a: FamilyResult, b: FamilyResult): boolean {
  if (a.kind !== 'classified' || b.kind !== 'classified') return true; // unbekannt/Generalist → nie inkohärent
  for (const x of a.families) {
    for (const y of b.families) {
      if (x === y) return true;
      if (ADJACENT.some(([p, q]) => (p === x && q === y) || (p === y && q === x))) return true;
    }
  }
  return false;
}

/** Querschnitts-Skills, die keine fachliche Überschneidung belegen. */
const GENERIC_TOKENS = new Set([
  'excel', 'office', 'word', 'outlook', 'powerpoint', 'sap', 'jira', 'confluence', 'window', 'windows', 'deutsch',
  'englisch', 'german', 'english', 'deutschkenntnisse', 'englischkenntnisse', 'kommunikation', 'communication',
  'kommunikationsfahigkeit', 'teamfahigkeit', 'teamgeist', 'teamplayer', 'eigeninitiative', 'organisation',
  'organisationsgeschick', 'organisationstalent', 'dokumentation', 'fuhrerschein', 'pkw', 'arbeitsweise',
  'selbststandig', 'selbststandige', 'strukturiert', 'strukturierte', 'analytisch', 'analytische', 'flexibel',
  'flexible', 'zuverlassig', 'zuverlassigkeit', 'belastbarkeit', 'lernbereitschaft', 'motivation', 'leadership',
  'fuhrung', 'mentoring', 'agile', 'agil', 'reporting', 'prozessoptimierung', 'digitalisierung',
]);

/** F8: Gibt es mindestens einen fachlichen (nicht-generischen) Skill-Treffer? */
export function hasSubstantiveOverlap(matchedRequirements: string[]): boolean {
  return matchedRequirements.some((m) => contentTokens(tokenize(m)).some((t) => !GENERIC_TOKENS.has(t)));
}

// ============================================================================
// F5: CONFIDENCE
// ============================================================================

export interface ConfidenceInputs {
  hasSkills: boolean;
  hasTitle: boolean;
  hasExperience: boolean;
  hasSeniority: boolean;
  salaryKnown: boolean;
  startKnown: boolean;
  jobHasMustHaves: boolean;
  /** Anzahl unbekannter Pflicht-Prüfungen (Sprache/Zertifikat/Visum ohne Daten). */
  unknownChecks: number;
}

/** F5: Datenvollständigkeit 0–1 (Gewichte summieren auf 1), −0.1 je unbekannter Pflicht-Prüfung. */
export function computeConfidence(i: ConfidenceInputs): number {
  const base =
    (i.hasSkills ? 0.25 : 0) +
    (i.hasTitle ? 0.1 : 0) +
    (i.hasExperience ? 0.1 : 0) +
    (i.hasSeniority ? 0.05 : 0) +
    (i.salaryKnown ? 0.15 : 0) +
    (i.startKnown ? 0.1 : 0) +
    (i.jobHasMustHaves ? 0.25 : 0);
  return Math.round(Math.max(0, Math.min(1, base - 0.1 * i.unknownChecks)) * 100) / 100;
}

// ============================================================================
// HELPERS
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asArray(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

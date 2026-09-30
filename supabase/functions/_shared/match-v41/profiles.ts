/**
 * Match V4.1 – Profile, die die KI aus Stelle und Kandidat baut („Verstehen").
 *
 * V4.1 ist KI-Matching in drei Stufen:
 *   1. Verstehen  (je Stelle / je Kandidat, gespeichert)  → JobProfile, CandidateProfile
 *   2. Vorauswahl (ohne KI je Paar, nur belegte Ausschlüsse) → frame.ts
 *   3. Urteil     (KI je Paar, Kriterium für Kriterium mit Beleg) → judge.ts, policy.ts
 *
 * Pure Typen und Konstanten, kein I/O – geteilt von Edge Functions und evals/.
 */

export const MATCH_V41_VERSION = 'v4.1.0';

// ---------------------------------------------------------------------------
// Berufsfamilien
// ---------------------------------------------------------------------------

/**
 * Berufsfamilien, aus denen die KI wählt. Die Liste ist bewusst grob: sie soll
 * Fehltreffer über Fachgrenzen verhindern (Servicekraft → Softwareentwicklung),
 * nicht Nachbarrollen trennen. Nachbarschaft regelt ADJACENT_FAMILIES.
 */
export const FAMILIES = {
  software_dev: 'Softwareentwicklung, IT-Betrieb, IT-Sicherheit',
  data_analytics: 'Daten, BI, Machine Learning',
  finance_accounting: 'Buchhaltung, Rechnungswesen, Steuern',
  controlling: 'Controlling',
  sap_erp: 'SAP-/ERP-Beratung und -Betreuung',
  hr: 'Personal, Recruiting',
  sales_field: 'Vertrieb Außendienst, Key Account, Business Development',
  sales_inside: 'Vertriebsinnendienst, Auftragsabwicklung',
  marketing: 'Marketing, Kommunikation',
  customer_service: 'Kunden- und Patientenservice, Support',
  healthcare_nursing: 'Pflege',
  healthcare_medical: 'Ärztlicher und medizinisch-therapeutischer Dienst, MFA',
  engineering: 'Ingenieurwesen, Konstruktion, Entwicklung Hardware',
  quality: 'Qualitätsmanagement, Qualitätssicherung',
  technical_trades: 'Technisches Handwerk, Instandhaltung, Produktion',
  logistics_procurement: 'Logistik, Einkauf, Supply Chain',
  product: 'Produktmanagement',
  design: 'Design, UX',
  legal: 'Recht',
  education: 'Bildung, Erziehung',
  hospitality: 'Gastronomie, Hotellerie',
  construction: 'Bau',
  administration: 'Assistenz, Sachbearbeitung, Verwaltung',
  management: 'Geschäftsführung, allgemeine Leitung',
} as const;

export type Family = keyof typeof FAMILIES;
export const FAMILY_KEYS = Object.keys(FAMILIES) as Family[];

/** Nachbarfamilien: Wechsel ist üblich, führt aber höchstens zu „Prüfen", wenn die Belege fehlen. */
export const ADJACENT_FAMILIES: [Family, Family][] = [
  ['finance_accounting', 'controlling'],
  ['finance_accounting', 'sap_erp'],
  ['controlling', 'sap_erp'],
  ['controlling', 'data_analytics'],
  ['software_dev', 'data_analytics'],
  ['software_dev', 'engineering'],
  ['engineering', 'technical_trades'],
  ['engineering', 'quality'],
  ['quality', 'technical_trades'],
  ['product', 'design'],
  ['product', 'software_dev'],
  ['product', 'data_analytics'],
  ['sales_field', 'sales_inside'],
  ['sales_inside', 'customer_service'],
  ['sales_field', 'marketing'],
  ['customer_service', 'healthcare_medical'],
  ['customer_service', 'administration'],
  ['healthcare_nursing', 'healthcare_medical'],
  ['logistics_procurement', 'administration'],
  ['design', 'marketing'],
  ['engineering', 'construction'],
];

export type FamilyRelation = 'same' | 'adjacent' | 'different' | 'unknown';

/**
 * Verwandtschaft zweier Familienlisten. „management" und „administration" sind
 * Querschnitt: sie schließen nie aus (unknown statt different).
 */
export function familyRelation(a: Family[], b: Family[]): FamilyRelation {
  const cross = new Set<Family>(['management', 'administration']);
  const aa = a.filter((f) => !cross.has(f));
  const bb = b.filter((f) => !cross.has(f));
  if (aa.length === 0 || bb.length === 0) return 'unknown';
  if (aa.some((x) => bb.includes(x))) return 'same';
  const adj = aa.some((x) => bb.some((y) => ADJACENT_FAMILIES.some(([p, q]) => (p === x && q === y) || (p === y && q === x))));
  return adj ? 'adjacent' : 'different';
}

// ---------------------------------------------------------------------------
// Seniorität, Sprachen
// ---------------------------------------------------------------------------

export const SENIORITY = ['junior', 'mid', 'senior', 'lead', 'head', 'director', 'c_level'] as const;
export type Seniority = typeof SENIORITY[number];

export function seniorityGap(candidate: Seniority | null, job: Seniority | null): number | null {
  if (!candidate || !job) return null;
  return Math.abs(SENIORITY.indexOf(candidate) - SENIORITY.indexOf(job));
}

export const CEFR = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
export type Cefr = typeof CEFR[number];

// ---------------------------------------------------------------------------
// Stellenprofil
// ---------------------------------------------------------------------------

/** must = unverzichtbar, nice = verhandelbar, trainable = lernbar (Einstufung des Kunden). */
export type ReqClass = 'must' | 'nice' | 'trainable';
export type ReqKind = 'competence' | 'experience' | 'qualification' | 'certification' | 'leadership' | 'domain';

export interface JobRequirement {
  /** Stabile ID innerhalb des Profils (r1, r2 …), das Urteil bezieht sich darauf. */
  id: string;
  /** Sauberes, prüfbares Kriterium, z. B. „Finanzbuchhaltung, mind. 3 Jahre". */
  text: string;
  kind: ReqKind;
  class: ReqClass;
  /** Gleichwertige Alternativen („Creo oder SolidWorks"): eine genügt. */
  alternatives: string[];
  min_years: number | null;
  /** Gesetzlich geregelte Qualifikation (Pflegeexamen, StFA, Bilanzbuchhalter IHK …). */
  regulated: boolean;
  /** Die Einstufung stammt vom Kunden (true) oder wurde von der KI vorgeschlagen (false). */
  class_confirmed: boolean;
  /** Originalformulierung(en) aus Anzeige/Briefing, aus denen das Kriterium entstand. */
  evidence: string[];
}

export interface LanguageNeed {
  code: string;
  min_level: Cefr | null;
  /** Vom Kunden bestätigt; Parser-Standards („Deutsch C1") sind nur Hinweise. */
  confirmed: boolean;
  /** Rolle mit direktem Kunden-/Patientenkontakt in dieser Sprache. */
  customer_facing: boolean;
}

export interface JobProfile {
  version: string;
  families: Family[];
  seniority: Seniority | null;
  requirements: JobRequirement[];
  languages: LanguageNeed[];
  location: { city: string | null; remote: 'onsite' | 'hybrid' | 'remote' | 'field' | null; onsite_days: number | null };
  salary: { min: number | null; max: number | null; basis: 'fixed' | 'ote' | 'daily_rate' | null };
  employment: 'fulltime' | 'parttime' | 'freelance' | null;
  visa_sponsorship: boolean | null;
  /** Tage bis zur gewünschten Besetzung, wenn dringend; sonst null. */
  urgent_within_days: number | null;
  /** Aus der Anzeige verworfene Nicht-Kriterien („Fähigkeit", Floskeln) – zur Prüfung sichtbar. */
  dropped: string[];
}

// ---------------------------------------------------------------------------
// Kandidatenprofil
// ---------------------------------------------------------------------------

export interface Competence {
  name: string;
  /** Wörtliches Zitat aus Akte, Interview oder Lebenslauf. */
  evidence: string;
}

export interface CandidateProfile {
  version: string;
  families: Family[];
  seniority: Seniority | null;
  title: string | null;
  years: number | null;
  competencies: Competence[];
  qualifications: Competence[];
  /** Branchen der bisherigen Stationen („Automobilzulieferer", „B2B SaaS"). */
  industries: string[];
  languages: { code: string; level: Cefr | 'native' | null }[];
  logistics: {
    city: string | null;
    remote_pref: 'onsite' | 'hybrid' | 'remote' | 'flexible' | null;
    max_commute_min: number | null;
    relocation: boolean | null;
    target_locations: string[];
  };
  /** Wunsch und Untergrenze – gehen nie an den Kunden. */
  salary: { wish: number | null; minimum: number | null; basis: 'fixed' | 'ote' | 'daily_rate' | null };
  notice: string | null;
  employment: 'fulltime' | 'parttime' | 'freelance' | null;
  needs_visa: boolean | null;
}

/**
 * Daten, die nie an die KI gehen, aber in der Vorauswahl zählen (Sperrliste
 * des Kandidaten, Firmenname der Stelle – Triple-Blind).
 */
export interface PrivateMatchContext {
  candidate_blocked_companies: string[];
  job_company_name: string | null;
  /** No-Go-Firmen des Kunden (jobs.nogo_companies): Kandidaten von dort nicht vorschlagen. */
  job_nogo_companies?: string[];
  /** Aktueller und frühere Arbeitgeber des Kandidaten (nur für die No-Go-Prüfung). */
  candidate_employers?: string[];
}

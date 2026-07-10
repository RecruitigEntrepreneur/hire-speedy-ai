import { QUALITY_WEIGHTS } from './companyProfileOptions';

/**
 * Gewichteter Profilqualität-Score (Masterprompt §13).
 * Eine Quelle der Wahrheit: Banner, Wizard-Abschluss und Recruiter-Priorisierung
 * lesen denselben Wert. Persistiert in company_profiles.quality_score/_breakdown.
 */

export interface QualityInput {
  company_name?: string | null;
  website?: string | null;
  industry?: string | null;
  description?: string | null;
  office_locations?: unknown;
  benefits?: unknown;
  employer_selling_points?: unknown;
  culture_values?: unknown;
  personality_fit?: unknown;
  contacts?: unknown;
  target_companies?: string[] | null;
  excluded_companies?: string[] | null;
}

const arr = (v: unknown) => Array.isArray(v) && v.length > 0;
const str = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

const LABELS: Record<keyof typeof QUALITY_WEIGHTS, string> = {
  identification: 'Firma identifizieren (Name + Website/Branche)',
  description: 'Unternehmensbeschreibung',
  industry_locations: 'Branche + Standorte',
  benefits: 'Benefits',
  selling_points: 'Arbeitgeberargumente priorisieren',
  culture_fit: 'Kultur & passende Persönlichkeiten',
  contacts: 'Ansprechpartner',
  market: 'Ziel- / No-Go-Unternehmen',
};

export function computeProfileQuality(p: QualityInput) {
  const checks: Record<keyof typeof QUALITY_WEIGHTS, boolean> = {
    identification: str(p.company_name) && (str(p.website) || str(p.industry)),
    description: str(p.description),
    industry_locations: str(p.industry) && arr(p.office_locations),
    benefits: arr(p.benefits),
    selling_points: arr(p.employer_selling_points),
    culture_fit: arr(p.culture_values) || arr(p.personality_fit),
    contacts: arr(p.contacts),
    market: arr(p.target_companies) || arr(p.excluded_companies),
  };

  const breakdown: Record<string, number> = {};
  let score = 0;
  (Object.keys(QUALITY_WEIGHTS) as (keyof typeof QUALITY_WEIGHTS)[]).forEach((k) => {
    const pts = checks[k] ? QUALITY_WEIGHTS[k] : 0;
    breakdown[k] = pts;
    score += pts;
  });

  const missing = (Object.keys(checks) as (keyof typeof QUALITY_WEIGHTS)[])
    .filter((k) => !checks[k])
    .map((k) => LABELS[k]);

  return { score, breakdown, checks, missing };
}

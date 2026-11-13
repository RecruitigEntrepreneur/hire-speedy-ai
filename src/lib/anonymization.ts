// Triple-Blind Mode: Anonymization helpers
import i18n from '@/i18n';

// Anzeige-Texte beim Aufruf gelesen (Namespace jobBriefing, anon.* und missing.*).
const ta = (key: string, options?: Record<string, unknown>): string => i18n.t(`jobBriefing:${key}`, options) as string;

export function generateAnonymousId(id: string): string {
  return ta('anon.candidateId', { id: id.slice(0, 8).toUpperCase() });
}

// DER eine Anonym-Code der Client-Seiten (Inbox, Cockpit, Jobseite, Agenda):
// stabil pro Kandidat (candidate_id), nicht pro Bewerbung — derselbe Mensch
// trägt überall dieselbe Kennung.
export function candidateAnonCode(candidateId: string | null | undefined): string {
  return `PR-${String(candidateId ?? '').slice(0, 6).toUpperCase()}`;
}

// Grobe Region statt spezifischer Stadt
export function anonymizeRegionBroad(city: string | null): string {
  if (!city) return 'DACH';
  
  const lower = city.toLowerCase();
  
  // Deutschland - Regionen
  if (lower.includes('münchen') || lower.includes('munich') || lower.includes('augsburg') || 
      lower.includes('nürnberg') || lower.includes('regensburg') || lower.includes('stuttgart') ||
      lower.includes('ulm') || lower.includes('freiburg') || lower.includes('karlsruhe')) {
    return 'Süddeutschland';
  }
  if (lower.includes('berlin') || lower.includes('hamburg') || lower.includes('bremen') || 
      lower.includes('hannover') || lower.includes('kiel') || lower.includes('rostock') ||
      lower.includes('lübeck') || lower.includes('schwerin')) {
    return 'Norddeutschland';
  }
  if (lower.includes('köln') || lower.includes('düsseldorf') || lower.includes('dortmund') || 
      lower.includes('essen') || lower.includes('frankfurt') || lower.includes('bonn') ||
      lower.includes('aachen') || lower.includes('wiesbaden') || lower.includes('mainz')) {
    return 'Westdeutschland';
  }
  if (lower.includes('dresden') || lower.includes('leipzig') || lower.includes('chemnitz') ||
      lower.includes('erfurt') || lower.includes('magdeburg') || lower.includes('potsdam')) {
    return 'Ostdeutschland';
  }
  
  // Österreich
  if (lower.includes('wien') || lower.includes('vienna') || lower.includes('graz') || 
      lower.includes('linz') || lower.includes('salzburg') || lower.includes('innsbruck') ||
      lower.includes('klagenfurt') || lower.includes('österreich') || lower.includes('austria')) {
    return 'Österreich';
  }
  
  // Schweiz
  if (lower.includes('zürich') || lower.includes('zurich') || lower.includes('basel') || 
      lower.includes('bern') || lower.includes('genf') || lower.includes('geneva') ||
      lower.includes('lausanne') || lower.includes('schweiz') || lower.includes('switzerland')) {
    return 'Schweiz';
  }
  
  // EU-Länder
  if (lower.includes('amsterdam') || lower.includes('netherlands') || lower.includes('niederlande')) {
    return 'EU - Benelux';
  }
  if (lower.includes('paris') || lower.includes('france') || lower.includes('frankreich')) {
    return ta('anon.euFrance');
  }
  if (lower.includes('london') || lower.includes('uk') || lower.includes('england')) {
    return 'UK';
  }
  if (lower.includes('spain') || lower.includes('spanien') || lower.includes('madrid') || lower.includes('barcelona')) {
    return ta('anon.euSouth');
  }
  if (lower.includes('poland') || lower.includes('polen') || lower.includes('warsaw') || lower.includes('krakow')) {
    return ta('anon.euEast');
  }
  
  // Default für Deutschland
  if (lower.includes('germany') || lower.includes('deutschland')) {
    return ta('anon.germany');
  }
  
  return 'DACH';
}

// Legacy function for backward compatibility
export function anonymizeRegion(location: string | null): string {
  return anonymizeRegionBroad(location);
}

export function anonymizeExperience(years: number | null): string {
  if (!years && years !== 0) return ta('anon.notSpecified');
  if (years < 2) return ta('anon.years', { range: '0-2' });
  if (years < 5) return ta('anon.years', { range: '3-5' });
  if (years < 10) return ta('anon.years', { range: '6-10' });
  if (years < 15) return ta('anon.years', { range: '10-15' });
  return ta('anon.years', { range: '15+' });
}

export function anonymizeSalary(salary: number | null): string {
  if (!salary) return ta('anon.notReleased');
  // Round to nearest 10k range
  const lower = Math.floor(salary / 10000) * 10000;
  const upper = lower + 10000;
  return `€${(lower / 1000).toFixed(0)}k - €${(upper / 1000).toFixed(0)}k`;
}

export function anonymizeCompanyName(industry: string | null): string {
  if (!industry) return ta('anon.company');
  return ta('anon.industryCompany', { industry });
}

// Semantische Erklärungen für fehlende Felder mit professionellem Kontext
export function explainMissingField(fieldType: string, hasInterview: boolean): string {
  const known = ['motivation', 'salary', 'availability', 'skills', 'risks', 'strengths', 'career_goals', 'region', 'experience', 'seniority', 'work_model'];
  if (!known.includes(fieldType)) return ta('anon.noInfo');
  return ta(`missing.${fieldType}.${hasInterview ? 'post' : 'pre'}`);
}

// Fit-Label mit Farbe basierend auf Score
export interface FitLabel {
  label: string;
  color: 'green' | 'amber' | 'red' | 'gray';
  bgClass: string;
  textClass: string;
}

export function getFitLabel(score: number | null, fitAssessment?: string | null): FitLabel {
  // If explicit fit_assessment is provided, use it
  if (fitAssessment) {
    switch (fitAssessment) {
      case 'geeignet':
        return { 
          label: 'Geeignet', 
          color: 'green',
          bgClass: 'bg-green-100 dark:bg-green-900/30',
          textClass: 'text-green-700 dark:text-green-400'
        };
      case 'grenzwertig':
        return { 
          label: 'Grenzwertig', 
          color: 'amber',
          bgClass: 'bg-amber-100 dark:bg-amber-900/30',
          textClass: 'text-amber-700 dark:text-amber-400'
        };
      case 'nicht_geeignet':
        return { 
          label: 'Nicht geeignet', 
          color: 'red',
          bgClass: 'bg-red-100 dark:bg-red-900/30',
          textClass: 'text-red-700 dark:text-red-400'
        };
    }
  }
  
  // Fallback to score-based
  if (!score && score !== 0) {
    return { 
      label: 'Nicht bewertet', 
      color: 'gray',
      bgClass: 'bg-muted',
      textClass: 'text-muted-foreground'
    };
  }
  
  if (score >= 75) {
    return { 
      label: 'Geeignet', 
      color: 'green',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      textClass: 'text-green-700 dark:text-green-400'
    };
  }
  if (score >= 50) {
    return { 
      label: 'Grenzwertig', 
      color: 'amber',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      textClass: 'text-amber-700 dark:text-amber-400'
    };
  }
  return { 
    label: 'Nicht geeignet', 
    color: 'red',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-400'
  };
}

// Motivation Status Badge
export interface MotivationStatus {
  label: string;
  color: 'green' | 'amber' | 'red' | 'gray';
  bgClass: string;
  textClass: string;
}

export function getMotivationStatus(status: string | null): MotivationStatus {
  switch (status) {
    case 'hoch':
      return {
        label: 'Hoch',
        color: 'green',
        bgClass: 'bg-green-100 dark:bg-green-900/30',
        textClass: 'text-green-700 dark:text-green-400'
      };
    case 'mittel':
      return {
        label: 'Mittel',
        color: 'amber',
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
        textClass: 'text-amber-700 dark:text-amber-400'
      };
    case 'gering':
      return {
        label: 'Gering',
        color: 'red',
        bgClass: 'bg-red-100 dark:bg-red-900/30',
        textClass: 'text-red-700 dark:text-red-400'
      };
    case 'unbekannt':
    default:
      return {
        label: 'Unbekannt',
        color: 'gray',
        bgClass: 'bg-muted',
        textClass: 'text-muted-foreground'
      };
  }
}

export interface AnonymizedCandidate {
  anonymousId: string;
  skills: string[];
  experienceRange: string;
  salaryExpectation: string;
  region: string;
  availability: string | null;
  matchScore: number | null;
  summary: string | null;
}

export function anonymizeCandidate(candidate: {
  id?: string;
  full_name?: string;
  skills?: string[] | null;
  experience_years?: number | null;
  expected_salary?: number | null;
  availability_date?: string | null;
  notice_period?: string | null;
}, submissionId: string, matchScore?: number | null, location?: string | null): AnonymizedCandidate {
  return {
    anonymousId: generateAnonymousId(submissionId),
    skills: candidate.skills || [],
    experienceRange: anonymizeExperience(candidate.experience_years || null),
    salaryExpectation: anonymizeSalary(candidate.expected_salary || null),
    region: anonymizeRegionBroad(location || null),
    availability: candidate.availability_date || candidate.notice_period || null,
    matchScore: matchScore || null,
    summary: null, // Summary should be AI-generated, not personal
  };
}

/** Platzhalter für verborgene Felder; beim Zugriff übersetzt. */
export const hiddenFieldPlaceholder = () => ta('anon.hidden');
/** @deprecated Deutsch; für die Anzeige hiddenFieldPlaceholder() nutzen. */
export const HIDDEN_FIELD_PLACEHOLDER = '🔒 Verborgen bis Opt-In';

// Triple-Blind Mode: Anonymization helpers

export function generateAnonymousId(id: string): string {
  return `Kandidat #${id.slice(0, 8).toUpperCase()}`;
}

export function anonymizeRegion(location: string | null): string {
  if (!location) return 'Nicht angegeben';
  // Extract general region (city → "Area")
  const city = location.split(',')[0].trim();
  return `${city} Area`;
}

export function anonymizeExperience(years: number | null): string {
  if (!years) return 'Nicht angegeben';
  if (years < 2) return '0-2 Jahre';
  if (years < 5) return '3-5 Jahre';
  if (years < 10) return '5-10 Jahre';
  return '10+ Jahre';
}

export function anonymizeSalary(salary: number | null): string {
  if (!salary) return 'Nicht angegeben';
  // Round to nearest 10k range
  const lower = Math.floor(salary / 10000) * 10000;
  const upper = lower + 10000;
  return `€${lower.toLocaleString()} - €${upper.toLocaleString()}`;
}

export function anonymizeCompanyName(industry: string | null): string {
  if (!industry) return 'Unternehmen';
  return `[${industry}] Unternehmen`;
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
    region: anonymizeRegion(location || null),
    availability: candidate.availability_date || candidate.notice_period || null,
    matchScore: matchScore || null,
    summary: null, // Summary should be AI-generated, not personal
  };
}

export const HIDDEN_FIELD_PLACEHOLDER = '🔒 Verborgen bis Opt-In';

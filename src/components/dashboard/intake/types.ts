export type JobType = 'full-time' | 'freelance';

export interface BuiltJob {
  title: string;
  company_name: string;
  location: string;
  remote_type: string;
  experience_level: string;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
  industry: string;
  description: string;
  requirements: string;
  // bereits extrahierte Briefing-relevante Felder (zum Vorbefüllen)
  vacancyReason: string | null;
  reportsTo: string | null;
  hiringUrgency: string | null;
  remoteDays: number | null;
  usps: string[];
}

/** Contracting-Fork: Tagessatz statt Gehalt (landet in intake_payload.contracting). */
export interface FreelanceTerms {
  dayRateMin: number | null;
  dayRateMax: number | null;
  durationMonths: number | null;
  utilizationDaysPerWeek: number | null;
  extensionPossible: boolean;
}

export const EMPTY_FREELANCE: FreelanceTerms = {
  dayRateMin: null,
  dayRateMax: null,
  durationMonths: null,
  utilizationDaysPerWeek: null,
  extensionPossible: true,
};

/** Triple-Blind-Setup: anonymer Descriptor + Reveal-Zeitpunkt. */
export interface RevealSetup {
  descriptor: string;
  trigger: 'opt_in' | 'after_first_interview' | 'offer';
}

export const REVEAL_TRIGGER_LABELS: Record<RevealSetup['trigger'], string> = {
  opt_in: 'Beim Kandidaten-Opt-In',
  after_first_interview: 'Nach dem 1. Interview',
  offer: 'Erst beim Angebot',
};

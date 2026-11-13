import { verguetung } from './jobPosting';
import { spezialistenGrenze } from './recruiterContracting';
import { briefingText } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';
import { candidateLanguage, fmtNumber, tFor } from './localeFormat';

// Die Faktenzeile steht in der Anzeige und im LinkedIn-Beitrag: Sprache des Headhunters, beim Aufruf gelesen.
const tk = (key: string, options?: Record<string, unknown>): string => tFor(candidateLanguage(), 'jobPosting')(`kopf.${key}`, options) as string;

/**
 * Die Faktenzeile unter dem Titel (Stellenseite als Anzeige, 21.10.2026): was
 * ein Kandidat zuerst wissen will, mit Symbol. Mitarbeitende als Zahl des
 * Kunden; nur ohne Zahl das Größenband („250–1.000“ ist zu ungenau).
 */
export type KopfSymbol = 'geld' | 'ort' | 'zeit' | 'level' | 'vertrag' | 'leute' | 'branche' | 'laufzeit';
export interface KopfFakt { symbol: KopfSymbol; text: string }

const LEVEL: Record<string, string> = { junior: 'Junior', mid: 'Mid-Level', 'mid-level': 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal', executive: 'Executive' };
const EMPLOYMENT: Record<string, string> = { 'full-time': 'fullTime', full_time: 'fullTime', 'part-time': 'partTime', part_time: 'partTime', freelance: 'freelance', contract: 'contract', temporary: 'temporary', internship: 'internship' };
const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const de = (n: number) => fmtNumber(n, candidateLanguage());

/** „900 Mitarbeitende“, sonst „250–1.000 Mitarbeitende“, sonst nichts. */
export function mitarbeitende(job: Pick<WorkspaceJob, 'company_size_band'> & { company_headcount?: unknown }): string | null {
  const n = zahl(job.company_headcount);
  if (n && n > 0) return tk('employees', { n: de(n) });
  const band = briefingText(job.company_size_band);
  return band ? tk('employees', { n: band }) : null;
}

export function kopfFakten(job: WorkspaceJob): KopfFakt[] {
  const out: KopfFakt[] = [];
  const freelance = job.employment_type === 'freelance';
  const geld = verguetung(job);
  const monate = briefingText(job.salary_months);
  // Contracting: die Obergrenze für den Kandidaten statt der Spanne (Etappe 1, 04.11.2026)
  const grenze = freelance ? spezialistenGrenze(job) : null;
  if (geld) out.push({ symbol: 'geld', text: freelance ? tk('perDayVat', { amount: grenze ?? geld }) : `${geld}${monate ? ` × ${monate}` : ''}` });
  if (freelance) {
    const laufzeit = zahl(job.contract_duration_months);
    const umfang = zahl(job.utilization_days_per_week);
    const teile = [laufzeit ? tk('months', { n: laufzeit }) : null, umfang ? tk('daysPerWeek', { n: umfang }) : null].filter(Boolean);
    if (teile.length) out.push({ symbol: 'laufzeit', text: teile.join(', ') });
  }
  const tage = zahl(job.onsite_days_required);
  if (job.remote_type === 'remote' || tage === 0) out.push({ symbol: 'ort', text: tk('remote') });
  else if (tage) out.push({ symbol: 'ort', text: tk('onsite', { count: tage }) });
  else if (job.remote_type === 'hybrid') out.push({ symbol: 'ort', text: tk('hybrid') });
  const art = job.employment_type ? (EMPLOYMENT[job.employment_type] ? tk(`employment.${EMPLOYMENT[job.employment_type]}`) : job.employment_type) : '';
  const kern = briefingText(job.core_hours).split(/\s+(?=ohne|mit)\b/)[0];
  if (art || kern) out.push({ symbol: 'zeit', text: [art, kern].filter(Boolean).join(', ') });
  if (job.experience_level) out.push({ symbol: 'level', text: LEVEL[String(job.experience_level).toLowerCase()] ?? String(job.experience_level) });
  const vertrag = briefingText(job.contract_limitation);
  if (vertrag && !freelance) out.push({ symbol: 'vertrag', text: vertrag.charAt(0).toLowerCase() + vertrag.slice(1) });
  const leute = mitarbeitende(job as never);
  if (leute) out.push({ symbol: 'leute', text: leute });
  const branche = briefingText(job.industry);
  if (branche) out.push({ symbol: 'branche', text: branche });
  return out;
}

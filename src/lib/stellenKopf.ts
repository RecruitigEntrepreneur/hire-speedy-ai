import { verguetung } from './jobPosting';
import { briefingText } from './recruiterBriefing';
import type { WorkspaceJob } from '@/components/recruiter/RecruiterJobWorkspace';

/**
 * Die Faktenzeile unter dem Titel (Stellenseite als Anzeige, 21.10.2026): was
 * ein Kandidat zuerst wissen will, mit Symbol. Mitarbeitende als Zahl des
 * Kunden; nur ohne Zahl das Größenband („250–1.000“ ist zu ungenau).
 */
export type KopfSymbol = 'geld' | 'ort' | 'zeit' | 'level' | 'vertrag' | 'leute' | 'branche' | 'laufzeit';
export interface KopfFakt { symbol: KopfSymbol; text: string }

const LEVEL: Record<string, string> = { junior: 'Junior', mid: 'Mid-Level', 'mid-level': 'Mid-Level', senior: 'Senior', lead: 'Lead', principal: 'Principal', executive: 'Executive' };
const EMPLOYMENT: Record<string, string> = { 'full-time': 'Vollzeit', full_time: 'Vollzeit', 'part-time': 'Teilzeit', part_time: 'Teilzeit', freelance: 'Freelance', contract: 'Projektvertrag', temporary: 'Befristet', internship: 'Praktikum' };
const zahl = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
const de = (n: number) => n.toLocaleString('de-DE');

/** „900 Mitarbeitende“, sonst „250–1.000 Mitarbeitende“, sonst nichts. */
export function mitarbeitende(job: Pick<WorkspaceJob, 'company_size_band'> & { company_headcount?: unknown }): string | null {
  const n = zahl(job.company_headcount);
  if (n && n > 0) return `${de(n)} Mitarbeitende`;
  const band = briefingText(job.company_size_band);
  return band ? `${band} Mitarbeitende` : null;
}

export function kopfFakten(job: WorkspaceJob): KopfFakt[] {
  const out: KopfFakt[] = [];
  const freelance = job.employment_type === 'freelance';
  const geld = verguetung(job);
  const monate = briefingText(job.salary_months);
  if (geld) out.push({ symbol: 'geld', text: freelance ? `${geld}, zzgl. USt` : `${geld}${monate ? ` × ${monate}` : ''}` });
  if (freelance) {
    const laufzeit = zahl(job.contract_duration_months);
    const umfang = zahl(job.utilization_days_per_week);
    const teile = [laufzeit ? `${laufzeit} Monate` : null, umfang ? `${umfang} Tage / Woche` : null].filter(Boolean);
    if (teile.length) out.push({ symbol: 'laufzeit', text: teile.join(', ') });
  }
  const tage = zahl(job.onsite_days_required);
  if (job.remote_type === 'remote' || tage === 0) out.push({ symbol: 'ort', text: 'Remote' });
  else if (tage) out.push({ symbol: 'ort', text: `${tage} ${tage === 1 ? 'Tag' : 'Tage'} vor Ort` });
  else if (job.remote_type === 'hybrid') out.push({ symbol: 'ort', text: 'Hybrid' });
  const art = job.employment_type ? EMPLOYMENT[job.employment_type] ?? job.employment_type : '';
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

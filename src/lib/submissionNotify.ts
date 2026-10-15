// Nach dem Einreichen: Mail „Neuer Kandidat für …“ an den Kunden (Edge Function
// submission-notify) und der Verdienst des Headhunters für den Fensterkopf.

import { supabase } from '@/integrations/supabase/client';

/** Mail an den Kunden. Scheitert still: die Einreichung steht schon. */
export async function notifyClientAboutSubmission(submissionId: string): Promise<void> {
  try {
    await supabase.functions.invoke('submission-notify', { body: { submissionId } });
  } catch {
    /* Mail ist Zusatz, kein Teil der Einreichung */
  }
}

/** Gleiche Rechnung wie im „Ich suche“-Dialog: Mittel des Budgets × Honoraranteil des Headhunters. */
export function earningFor(job: Record<string, unknown> | null | undefined): number | null {
  if (!job) return null;
  const n = (v: unknown) => (typeof v === 'number' ? v : null);
  const min = n(job.salary_min);
  const max = n(job.salary_max);
  const fee = n(job.recruiter_fee_percentage);
  if (!fee || (!min && !max)) return null;
  const avg = min && max ? (min + max) / 2 : min || max;
  return avg ? Math.round(avg * (fee / 100)) : null;
}

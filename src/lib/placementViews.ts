import { supabase } from '@/integrations/supabase/client';

/**
 * Placements lesen Kunden und Headhunter nur noch über abgesicherte Ansichten
 * (Paket 4a, 22.10.2026): der Kunde sein Honorar, der Headhunter seinen Anteil –
 * die interne Aufteilung bleibt bei Matchunt.
 */

export interface ClientPlacementRow {
  id: string;
  submission_id: string;
  start_date: string | null;
  agreed_salary: number | null;
  total_fee: number | null;
  payment_status: string | null;
  placement_state: string | null;
  invoice_state: string | null;
  created_at: string;
  submission: { candidate: { full_name: string | null; email: string | null }; job: { title: string | null; company_name: string | null } };
}

export async function fetchClientPlacements(): Promise<ClientPlacementRow[]> {
  const { data, error } = await (supabase as any).from('client_placements_view').select('*').order('created_at', { ascending: false });
  if (error || !data) return [];
  const rows = data as any[];
  const subIds = rows.map((r) => r.submission_id);
  const jobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))];
  const [{ data: names }, { data: jobs }] = await Promise.all([
    subIds.length ? supabase.from('client_candidate_view').select('submission_id, full_name').in('submission_id', subIds) : Promise.resolve({ data: [] as any[] }),
    jobIds.length ? supabase.from('jobs').select('id, title, company_name').in('id', jobIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const nameBySub = new Map(((names ?? []) as any[]).map((n) => [n.submission_id, n.full_name]));
  const jobById = new Map(((jobs ?? []) as any[]).map((j) => [j.id, j]));
  return rows.map((r) => ({
    id: r.id, submission_id: r.submission_id, start_date: r.first_working_day ?? r.start_date, agreed_salary: r.agreed_salary,
    total_fee: r.client_fee_cents != null ? r.client_fee_cents / 100 : null, payment_status: r.payment_status,
    placement_state: r.placement_state, invoice_state: r.invoice_state, created_at: r.created_at,
    submission: {
      candidate: { full_name: nameBySub.get(r.submission_id) ?? null, email: null },
      job: { title: jobById.get(r.job_id)?.title ?? null, company_name: jobById.get(r.job_id)?.company_name ?? null },
    },
  }));
}

export interface RecruiterPlacementRow {
  id: string; submission_id: string; job_id: string; candidate_id: string;
  start_date: string | null; first_working_day: string | null; agreed_salary: number | null;
  recruiter_initial_cents: number | null; recruiter_retention_cents: number | null; recruiter_payout: number | null;
  placement_state: string | null; continuity_state: string | null; retention_state: string | null; invoice_state: string | null;
  retention_release_date: string | null; payment_status: string | null; created_at: string;
}

/** Eigene Placements des Headhunters (optional nur für bestimmte Einreichungen). */
export async function fetchRecruiterPlacements(submissionIds?: string[]): Promise<RecruiterPlacementRow[]> {
  if (submissionIds && submissionIds.length === 0) return [];
  let q = (supabase as any).from('recruiter_placements_view').select('*');
  if (submissionIds) q = q.in('submission_id', submissionIds);
  const { data, error } = await q;
  return error || !data ? [] : (data as RecruiterPlacementRow[]);
}

import { supabase } from '@/integrations/supabase/client';
import type { RecruiterAccount } from '@/lib/recruiterNetwork';

/**
 * Recruiter-Konten mit Leistungszahlen, für die Personenliste der
 * Recruiterverwaltung. Konten stammen teils aus der Zeit vor dem Rahmenvertrag;
 * die Liste führt sie mit den Onboarding-Vorgängen über die E-Mail zusammen.
 */

/** Einreichungen, die mindestens bis zum Interview gekommen sind. */
const INTERVIEW_STATES = ['interview', 'second_interview', 'offer', 'hired'];

export async function loadRecruiterAccounts(): Promise<RecruiterAccount[]> {
  const { data: roles, error } = await supabase.from('user_roles')
    .select('user_id, verified, status, custom_fee_percentage').eq('role', 'recruiter');
  if (error) throw error;
  const ids = (roles ?? []).map(r => r.user_id);
  if (!ids.length) return [];
  const [profiles, submissions, placements, interviews] = await Promise.all([
    supabase.from('profiles').select('user_id, email, full_name, company_name, created_at, internal_notes').in('user_id', ids),
    supabase.from('submissions').select('recruiter_id, status, submitted_at').in('recruiter_id', ids),
    supabase.from('placements').select('submission:submissions(recruiter_id)'),
    supabase.from('interviews').select('submission:submissions(recruiter_id)'),
  ]);
  if (profiles.error) throw profiles.error;

  const stats = new Map<string, { submissions: number; interviewed: number; last: string | null; placements: number; interviews: number }>();
  const entry = (id: string) => {
    if (!stats.has(id)) stats.set(id, { submissions: 0, interviewed: 0, last: null, placements: 0, interviews: 0 });
    return stats.get(id)!;
  };
  for (const s of submissions.data ?? []) {
    const e = entry(s.recruiter_id);
    e.submissions++;
    if (INTERVIEW_STATES.includes(s.status ?? '')) e.interviewed++;
    if (s.submitted_at && (!e.last || s.submitted_at > e.last)) e.last = s.submitted_at;
  }
  const recruiterOf = (row: unknown) => (row as { submission?: { recruiter_id?: string } | null }).submission?.recruiter_id;
  for (const p of placements.data ?? []) { const id = recruiterOf(p); if (id) entry(id).placements++; }
  for (const i of interviews.data ?? []) { const id = recruiterOf(i); if (id) entry(id).interviews++; }

  const roleOf = new Map((roles ?? []).map(r => [r.user_id, r]));
  return (profiles.data ?? []).map(p => {
    const role = roleOf.get(p.user_id);
    const s = stats.get(p.user_id);
    return {
      userId: p.user_id, email: p.email ?? '', name: p.full_name ?? '', company: p.company_name ?? '', createdAt: p.created_at,
      verified: role?.verified === true, status: role?.status ?? 'active', customFee: role?.custom_fee_percentage ?? null,
      notes: p.internal_notes ?? '', submissions: s?.submissions ?? 0, interviewed: s?.interviewed ?? 0, interviews: s?.interviews ?? 0,
      placements: s?.placements ?? 0, lastSubmissionAt: s?.last ?? null,
    };
  });
}

const fail = (error: { message?: string } | null) => { if (error) throw new Error(error.message || 'Speichern fehlgeschlagen.'); };

export async function setVerified(userId: string, verified: boolean) {
  const { error } = await supabase.from('user_roles').update({ verified }).eq('user_id', userId).eq('role', 'recruiter');
  fail(error);
}

export async function setSuspended(userId: string, suspended: boolean) {
  const { error } = await supabase.from('user_roles')
    .update({ status: suspended ? 'suspended' : 'active', suspended_at: suspended ? new Date().toISOString() : null })
    .eq('user_id', userId).eq('role', 'recruiter');
  fail(error);
}

export async function saveNotes(userId: string, notes: string) {
  const { error } = await supabase.from('profiles').update({ internal_notes: notes }).eq('user_id', userId);
  fail(error);
}

/**
 * Altwerte aus dem früheren Feld „Custom Fee“ löschen. Das Feld wird nirgends
 * gerechnet; maßgeblich ist das Konditionenblatt des Rahmenvertrags.
 */
export async function clearLegacyFees(userIds: string[]) {
  if (!userIds.length) return;
  const { error } = await supabase.from('user_roles').update({ custom_fee_percentage: null }).in('user_id', userIds).eq('role', 'recruiter');
  fail(error);
}

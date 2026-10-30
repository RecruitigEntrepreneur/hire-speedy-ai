import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeState,
  datedState,
  tabOf,
  type BewerberState,
  type BewerberTab,
  type ArchiveKind,
} from '@/hooks/useBewerber';

export interface VerlaufInterview {
  id: string;
  status: string | null;
  scheduledAt: string | null;
  createdAt: string;
  cancelledAt: string | null;
  feedback: string | null;
  /** Wer auf Kundenseite angefragt hat (ältere Anfragen: null). */
  requestedBy: string | null;
  /** Runde des Gesprächs (1, 2, …) */
  round: number;
}

export interface VerlaufRejection {
  createdAt: string;
  rejectedBy: string | null;
  reasonCategory: string | null;
}

export interface VerlaufOffer {
  id: string;
  status: string | null;
  createdAt: string | null;
  sentAt: string | null;
  responseDue: string | null;
}

export interface SubmissionStateResult {
  state: BewerberState;
  tab: BewerberTab;
  archiveKind: ArchiveKind | null;
  interviews: VerlaufInterview[];
  offers: VerlaufOffer[];
  latestInterview: VerlaufInterview | null;
  submittedAt: string | null;
  rejections: VerlaufRejection[];
  /** Seit wann die Stelle besetzt oder geschlossen ist (nur dann gesetzt) */
  jobClosedAt: string | null;
}

// Ein Zustand für die Detailseite — dieselbe Pillen-/Zuständigkeits-Logik wie
// die Bewerber-Inbox (computeState), gespeist aus den echten Interview- und
// Angebots-Zeilen dieser Submission. Liefert zusätzlich den Verlauf.
export function useSubmissionState(
  submissionId: string | undefined,
  stage: string | null,
  status: string | null,
  submittedAt: string | null
) {
  return useQuery<SubmissionStateResult>({
    queryKey: ['submission-state', submissionId, stage, status],
    enabled: !!submissionId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data: v } = await supabase
        .from('client_candidate_view')
        .select('submitted_at, job_id')
        .eq('submission_id', submissionId!)
        .maybeSingle();
      const effectiveSubmittedAt = submittedAt ?? (v as any)?.submitted_at ?? null;
      // Stand der Stelle: besetzt oder geschlossen heißt keine Entscheidung mehr (wie client-tasks)
      const { data: job } = (v as any)?.job_id
        ? await supabase.from('jobs').select('status, closed_at').eq('id', (v as any).job_id).maybeSingle()
        : { data: null };

      const [ivRes, offerRes, rejRes, contractRes] = await Promise.all([
        supabase
          .from('interviews')
          .select('id, status, scheduled_at, created_at, cancelled_at, feedback, requested_by, round')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
        supabase
          .from('offers')
          .select('id, status, created_at, sent_at, response_due')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
        // Absagen des Kunden: wer, wann, welcher Grund (Kunden-Team darf lesen).
        supabase
          .from('rejections')
          .select('created_at, rejected_by, reason_category')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false }),
        // Arbeitsvertrag nach der Zusage (Paket 3)
        (supabase as any)
          .from('employment_contracts')
          .select('status, reported_role, created_at')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      const contract = (((contractRes as any).data || []) as any[])[0] ?? null;

      const interviews: VerlaufInterview[] = ((ivRes.data || []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        scheduledAt: r.scheduled_at,
        createdAt: r.created_at,
        cancelledAt: r.cancelled_at,
        feedback: r.feedback,
        requestedBy: r.requested_by ?? null,
        round: r.round ?? 1,
      }));
      const rejections: VerlaufRejection[] = ((rejRes.data || []) as any[]).map((r) => ({
        createdAt: r.created_at,
        rejectedBy: r.rejected_by ?? null,
        reasonCategory: r.reason_category ?? null,
      }));
      const offers: VerlaufOffer[] = ((offerRes.data || []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        sentAt: r.sent_at,
        responseDue: r.response_due ?? null,
      }));

      const { tab, archiveKind } = tabOf(stage, status, (job as any)?.status ?? null);
      const hours = effectiveSubmittedAt
        ? Math.floor((Date.now() - new Date(effectiveSubmittedAt).getTime()) / (1000 * 60 * 60))
        : 0;
      const latestInterview = interviews[0] || null;
      const rawState = computeState(
        tab,
        archiveKind,
        stage || status || 'submitted',
        hours,
        latestInterview
          ? { status: latestInterview.status, scheduledAt: latestInterview.scheduledAt, feedback: latestInterview.feedback, round: latestInterview.round }
          : null,
        offers[0] ? { status: offers[0].status, responseDue: offers[0].responseDue, contractStatus: contract?.status ?? null, contractReportedRole: contract?.reported_role ?? null } : null
      );
      const state = datedState(rawState, latestInterview, rejections[0] ?? null, archiveKind);

      const jobClosed = archiveKind === 'stelle_besetzt' || archiveKind === 'stelle_geschlossen';
      return { state, tab, archiveKind, interviews, offers, latestInterview, submittedAt: effectiveSubmittedAt, rejections, jobClosedAt: jobClosed ? (job as any)?.closed_at ?? null : null };
    },
  });
}

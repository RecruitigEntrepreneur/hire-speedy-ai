import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  computeState,
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
}

export interface VerlaufOffer {
  id: string;
  status: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface SubmissionStateResult {
  state: BewerberState;
  tab: BewerberTab;
  archiveKind: ArchiveKind | null;
  interviews: VerlaufInterview[];
  offers: VerlaufOffer[];
  latestInterview: VerlaufInterview | null;
  submittedAt: string | null;
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
      let effectiveSubmittedAt = submittedAt;
      if (!effectiveSubmittedAt) {
        const { data: v } = await supabase
          .from('client_candidate_view')
          .select('submitted_at')
          .eq('submission_id', submissionId!)
          .maybeSingle();
        effectiveSubmittedAt = (v as any)?.submitted_at ?? null;
      }

      const [ivRes, offerRes] = await Promise.all([
        supabase
          .from('interviews')
          .select('id, status, scheduled_at, created_at, cancelled_at, feedback')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
        supabase
          .from('offers')
          .select('id, status, created_at, sent_at')
          .eq('submission_id', submissionId!)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false }),
      ]);

      const interviews: VerlaufInterview[] = ((ivRes.data || []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        scheduledAt: r.scheduled_at,
        createdAt: r.created_at,
        cancelledAt: r.cancelled_at,
        feedback: r.feedback,
      }));
      const offers: VerlaufOffer[] = ((offerRes.data || []) as any[]).map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at,
        sentAt: r.sent_at,
      }));

      const { tab, archiveKind } = tabOf(stage, status);
      const hours = effectiveSubmittedAt
        ? Math.floor((Date.now() - new Date(effectiveSubmittedAt).getTime()) / (1000 * 60 * 60))
        : 0;
      const latestInterview = interviews[0] || null;
      const state = computeState(
        tab,
        archiveKind,
        stage || status || 'submitted',
        hours,
        latestInterview
          ? { status: latestInterview.status, scheduledAt: latestInterview.scheduledAt, feedback: latestInterview.feedback }
          : null,
        offers[0] ? { status: offers[0].status } : null
      );

      return { state, tab, archiveKind, interviews, offers, latestInterview, submittedAt: effectiveSubmittedAt };
    },
  });
}

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { normalizeStage, isClosedStage } from '@/lib/submissionStage';

/**
 * Die Pipeline des Recruiters als sechs Stufen: Eingereicht, In Prüfung,
 * 1. Gespräch, 2. Gespräch, Angebot, Platziert. Je Stufe Anzahl und Honorar.
 * Dazu die Stufe je Einreichung, damit Aufgaben einer Stufe zugeordnet werden.
 */
export type PipelineStageKey = 'submitted' | 'in_review' | 'interview_1' | 'interview_2' | 'offer' | 'placed';

export interface PipelineStage {
  key: PipelineStageKey;
  label: string;
  count: number;
  fee: number;
  /** Nächste Frist in dieser Stufe (z. B. Angebot läuft ab, Garantie endet) */
  deadline: string | null;
}

export interface RecruiterPipeline {
  stages: PipelineStage[];
  stageOf: Record<string, PipelineStageKey>;
  rejectedThisMonth: number;
  withdrawnThisMonth: number;
  totalFee: number;
}

export const PIPELINE_LABELS: Record<PipelineStageKey, string> = {
  submitted: 'Eingereicht',
  in_review: 'In Prüfung',
  interview_1: '1. Gespräch',
  interview_2: '2. Gespräch',
  offer: 'Angebot',
  placed: 'Platziert',
};

const calcFee = (job: any): number => {
  if (!job?.recruiter_fee_percentage || (!job.salary_min && !job.salary_max)) return 0;
  const avg = job.salary_min && job.salary_max ? (job.salary_min + job.salary_max) / 2 : job.salary_min || job.salary_max;
  return avg ? Math.round(avg * (job.recruiter_fee_percentage / 100)) : 0;
};

export function useRecruiterPipeline() {
  const { user } = useAuth();
  const [data, setData] = useState<RecruiterPipeline | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [subsRes, ivRes, offersRes, placeRes] = await Promise.all([
        supabase.from('submissions').select('id, stage, status, job_id, updated_at').eq('recruiter_id', user.id),
        supabase.from('interviews').select('submission_id, round, status, submissions!inner(recruiter_id)').eq('submissions.recruiter_id', user.id),
        supabase.from('offers').select('submission_id, status, expires_at'),
        supabase.from('placements').select('submission_id, retention_release_date, start_date'),
      ]);
      if (cancelled) return;

      const subs = (subsRes.data || []) as any[];
      const jobIds = [...new Set(subs.map(s => s.job_id).filter(Boolean))] as string[];
      let jobs: Record<string, any> = {};
      if (jobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('recruiter_jobs_view')
          .select('id, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', jobIds);
        jobs = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }
      if (cancelled) return;

      const roundOf: Record<string, number> = {};
      for (const iv of (ivRes.data || []) as any[]) {
        if (['cancelled', 'declined'].includes(iv.status)) continue;
        roundOf[iv.submission_id] = Math.max(roundOf[iv.submission_id] ?? 0, iv.round ?? 1);
      }
      const offerOf: Record<string, any> = {};
      for (const o of (offersRes.data || []) as any[]) offerOf[o.submission_id] = o;
      const placementOf: Record<string, any> = {};
      for (const p of (placeRes.data || []) as any[]) placementOf[p.submission_id] = p;

      const stages: PipelineStage[] = (Object.keys(PIPELINE_LABELS) as PipelineStageKey[]).map(key => ({
        key, label: PIPELINE_LABELS[key], count: 0, fee: 0, deadline: null,
      }));
      const byKey = Object.fromEntries(stages.map(s => [s.key, s])) as Record<PipelineStageKey, PipelineStage>;
      const stageOf: Record<string, PipelineStageKey> = {};
      let rejected = 0, withdrawn = 0, totalFee = 0;

      for (const s of subs) {
        const canonical = normalizeStage(s.stage, s.status);
        if (isClosedStage(canonical)) {
          if (new Date(s.updated_at).getTime() >= monthStart.getTime()) {
            if (canonical === 'withdrawn') withdrawn++; else rejected++;
          }
          continue;
        }
        let key: PipelineStageKey;
        if (canonical === 'submitted') key = 'submitted';
        else if (canonical === 'in_review') key = 'in_review';
        else if (canonical === 'offer') key = 'offer';
        else if (canonical === 'placed') key = 'placed';
        else key = (roundOf[s.id] ?? 1) >= 2 ? 'interview_2' : 'interview_1';
        stageOf[s.id] = key;
        const fee = calcFee(jobs[s.job_id]);
        byKey[key].count++;
        byKey[key].fee += fee;
        totalFee += fee;

        const deadline = key === 'offer' ? offerOf[s.id]?.expires_at : key === 'placed' ? placementOf[s.id]?.retention_release_date : null;
        if (deadline && (!byKey[key].deadline || deadline < byKey[key].deadline!)) byKey[key].deadline = deadline;
      }

      setData({ stages, stageOf, rejectedThisMonth: rejected, withdrawnThisMonth: withdrawn, totalFee });
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return data;
}

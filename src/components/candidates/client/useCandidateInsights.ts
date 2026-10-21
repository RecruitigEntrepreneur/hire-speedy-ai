import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NOTICE_OPTIONS, optionLabel } from '@/lib/candidateDossier';

export type InterviewInsights = {
  interview_date: string | null;
  interview_type: 'phone' | 'video' | 'onsite' | null;
  change_motivation: string | null;
  change_motivation_tags: string[] | null;
  why_now: string | null;
  offer_requirements: string[] | null;
  notice_period: string | null;
  earliest_start_date: string | null;
  leadership_scope: 'none' | 'functional' | 'disciplinary' | null;
  leadership_team_size: number | null;
  other_applications: 'none' | 'early' | 'advanced' | 'offer' | null;
  salary_wish: string | null;
};

export type EducationEntry = { id: string; degree: string | null; field_of_study: string | null; graduation_year: number | null; institution: string | null };

// Neue Ansichten (Migration 20261009140000), im generierten Supabase-Typ noch nicht enthalten.
type Antwort<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
type Ansicht = {
  select: (c: string) => {
    eq: (k: string, v: string) => {
      maybeSingle: () => Antwort<InterviewInsights>;
      order: (k: string, o: { ascending: boolean }) => Antwort<EducationEntry[]>;
    };
  };
};
const ansicht = (name: string) => (supabase as unknown as { from: (t: string) => Ansicht }).from(name);

/** Angaben aus dem Gespräch mit dem Headhunter und Ausbildung -- beides anonymisiert über die Kunden-Ansichten. */
export function useCandidateInsights(submissionId: string | undefined) {
  return useQuery({
    queryKey: ['client-candidate-insights', submissionId],
    enabled: !!submissionId,
    queryFn: async () => {
      const [iv, edu] = await Promise.all([
        ansicht('client_candidate_interview_view').select('*').eq('submission_id', submissionId!).maybeSingle(),
        ansicht('client_candidate_education_view').select('id, degree, field_of_study, graduation_year, institution').eq('submission_id', submissionId!).order('sort_order', { ascending: true }),
      ]);
      return { interview: iv.data ?? null, education: edu.data ?? [] };
    },
  });
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** „ab 01.01.2027 · 3 Monate zum Quartalsende“ -- oder nur eines davon, oder null. Nie den Rohwert („3_months_eoq“). */
export function verfuegbarAus(i: InterviewInsights | null): string | null {
  if (!i) return null;
  const frist = i.notice_period?.trim() ? optionLabel(NOTICE_OPTIONS, i.notice_period.trim()) : null;
  const parts = [i.earliest_start_date ? `ab ${fmt(i.earliest_start_date)}` : null, frist].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export const GESPRAECH: Record<string, string> = { phone: 'Telefon', video: 'Video', onsite: 'Persönlich' };
export const WEITERE: Record<string, string> = { none: 'keine', early: 'in frühen Gesprächen', advanced: 'in fortgeschrittenen Gesprächen', offer: 'hat ein Angebot' };
export const fuehrung = (i: InterviewInsights) =>
  !i.leadership_scope ? null
    : i.leadership_scope === 'none' ? 'keine'
    : `${i.leadership_scope === 'disciplinary' ? 'disziplinarisch' : 'fachlich'}${i.leadership_team_size ? `, ${i.leadership_team_size} Personen` : ''}`;
export { fmt as fmtDatum };

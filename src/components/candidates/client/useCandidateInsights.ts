import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NOTICE_OPTIONS, optionLabel } from '@/lib/candidateDossier';
import { fuehrungArten, fuehrungText, fuehrungZahl } from '@/lib/fuehrung';
import { isGermanUi, term } from '@/lib/candidateTerms';
import { fmtDate } from '@/lib/localeFormat';
import { availableFromLabel } from '@/lib/clientCandidateLabels';
import i18n from '@/i18n';

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
  /** Migration 20261105110000, fehlt vorher in der Ansicht */
  leadership_also_functional?: boolean | null;
  leadership_functional_size?: number | null;
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

const fmt = (iso: string) => fmtDate(iso);

/** „ab 01.01.2027 · 3 Monate zum Quartalsende“ -- oder nur eines davon, oder null. Nie den Rohwert („3_months_eoq“). */
export function verfuegbarAus(i: InterviewInsights | null): string | null {
  if (!i) return null;
  const frist = i.notice_period?.trim() ? term(optionLabel(NOTICE_OPTIONS, i.notice_period.trim())) : null;
  const parts = [i.earliest_start_date ? availableFromLabel(i.earliest_start_date) : null, frist].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/** Art des Gesprächs mit dem Headhunter: Telefon, Video, Persönlich. */
export const gespraechLabel = (type: string | null | undefined) =>
  type && ['phone', 'video', 'onsite'].includes(type) ? i18n.t(`clientCandidates:insights.talk.${type}`) : '';

/** Führung in der Sprache der Oberfläche; auf Deutsch genau fuehrungText. */
export function fuehrung(i: InterviewInsights): string | null {
  if (isGermanUi()) return fuehrungText(i);
  if (!i.leadership_scope) return null;
  const a = fuehrungArten(i);
  const l = (key: string, options?: Record<string, unknown>) => i18n.t(`clientCandidates:insights.lead.${key}`, options ?? {});
  if (a.keine) return l('none');
  const d = fuehrungZahl(i, 'disciplinary');
  const fz = fuehrungZahl(i, 'functional');
  if (a.disziplinarisch && a.fachlich) {
    return `${l('disciplinary')}${d ? ` ${l('persons', { count: d })}` : ''}, ${l('functional')}${fz ? ` ${l('persons', { count: fz })}` : ''}`;
  }
  const n = a.disziplinarisch ? d : fz;
  return `${a.disziplinarisch ? l('disciplinary') : l('functional')}${n ? `, ${l('persons', { count: n })}` : ''}`;
}
export { fmt as fmtDatum };

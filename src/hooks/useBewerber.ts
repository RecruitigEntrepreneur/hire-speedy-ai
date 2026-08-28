import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { candidateAnonCode } from '@/lib/anonymization';

export type BewerberSortOption = 'match_score' | 'waiting_time' | 'newest';

export type BewerberTab = 'neu' | 'pruefung' | 'interview' | 'angebot' | 'archiv';

export type ArchiveKind = 'abgelehnt' | 'eingestellt' | 'zurueckgezogen' | 'abgelaufen';

export interface CareerEntry {
  jobTitle: string;
  companyAnonymized: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  durationYears: number | null;
}

export type BewerberTone = 'ok' | 'warn' | 'crit' | 'neutral';
export type BewerberTurn = 'me' | 'other' | 'none';

export interface BewerberState {
  key: string; // i18n: bewerber.state.<key>; für Archiv greift bewerber.archive.kind.<archiveKind>
  tone: BewerberTone;
  turn: BewerberTurn;
  params?: Record<string, string | number>;
}

export interface BewerberItem {
  submissionId: string;
  candidateId: string;
  anonymizedName: string;
  fullName: string | null; // serverseitig null bis Opt-In
  identityUnlocked: boolean;
  tab: BewerberTab;
  archiveKind: ArchiveKind | null;
  state: BewerberState;
  jobId: string;
  jobTitle: string;
  matchScore: number | null;
  stage: string;
  status: string;
  submittedAt: string;
  recruiterNotes: string | null;
  currentRole: string | null;
  experienceYears: number | null; // gated: nur nach Opt-In, sonst null
  experienceBand: string;        // immer sichtbar (z.B. "6-10 Jahre")
  city: string | null;           // gated: nur nach Opt-In, sonst null
  region: string;                // immer sichtbar (grobe Region)
  skills: string[] | null;
  salaryBand: string;            // immer sichtbar (z.B. "€60k - €70k")
  remotePreference: string | null;
  availabilityDate: string | null;
  noticePeriod: string | null;
  seniority: string | null;
  aiSummary: string | null;
  hoursWaiting: number;
  urgency: 'critical' | 'warning' | 'normal';
  isMyTurn: boolean;
  career: CareerEntry[];
}

export interface BewerberFilters {
  tab: BewerberTab | null; // null = "Alle" (alle Nicht-Archiv)
  jobId: string | null;
  search: string;
  sort: BewerberSortOption;
}

interface JobOption {
  id: string;
  title: string;
}

const FETCH_LIMIT = 200;

// Status hat Vorrang vor Stage: terminale Bewerbungen gehören ins Archiv,
// egal welcher Stage-Wert noch daran hängt (Zombie-Fix).
const ARCHIVE_STATUS: Record<string, ArchiveKind> = {
  rejected: 'abgelehnt',
  client_rejected: 'abgelehnt',
  withdrawn: 'zurueckgezogen',
  expired: 'abgelaufen',
  hired: 'eingestellt',
  placed: 'eingestellt',
};

const PRUEFUNG_STAGES = new Set(['screening', 'shortlisted', 'in_review', 'qc_review']);
const INTERVIEW_STAGES = new Set([
  'interview_requested',
  'candidate_opted_in',
  'interview',
  'interview_1',
  'interview_2',
  'interview_scheduled',
  'second_interview',
  'interview_counter_proposed',
]);

export function tabOf(stage: string | null, status: string | null): { tab: BewerberTab; archiveKind: ArchiveKind | null } {
  if (status && ARCHIVE_STATUS[status]) {
    return { tab: 'archiv', archiveKind: ARCHIVE_STATUS[status] };
  }
  const s = stage || 'new';
  if (s === 'hired' || s === 'placed') return { tab: 'archiv', archiveKind: 'eingestellt' };
  if (PRUEFUNG_STAGES.has(s)) return { tab: 'pruefung', archiveKind: null };
  if (INTERVIEW_STAGES.has(s)) return { tab: 'interview', archiveKind: null };
  if (s === 'offer') return { tab: 'angebot', archiveKind: null };
  return { tab: 'neu', archiveKind: null }; // new, submitted, unbekannte Werte
}

function computeHoursWaiting(submittedAt: string): number {
  const diff = Date.now() - new Date(submittedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60));
}

export interface InterviewInfo {
  status: string | null;
  scheduledAt: string | null;
  feedback: string | null;
}

export interface OfferInfo {
  status: string | null;
}

function formatTermin(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `${date}, ${time}`;
}

function formatTag(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// Auch fällige Feedbacks eskalieren rot ab 21 Tagen (Referenz: Interviewtermin).
function feedbackTone(scheduledAt: string): BewerberTone {
  const overdueDays = Math.floor((Date.now() - new Date(scheduledAt).getTime()) / 86_400_000);
  return overdueDays >= 21 ? 'crit' : 'warn';
}

// Zustand = Pille (Wort + Farbe) + Zuständigkeit. Eskalationsfarben NUR wenn der
// Kunde am Zug ist (turn === 'me'); Schwellen laut Spec: gelb ab 7 Tagen, rot ab 21.
export function computeState(
  tab: BewerberTab,
  archiveKind: ArchiveKind | null,
  stage: string,
  hoursWaiting: number,
  iv: InterviewInfo | null,
  offer: OfferInfo | null
): BewerberState {
  if (tab === 'archiv') {
    return {
      key: 'archiv',
      tone: archiveKind === 'eingestellt' ? 'ok' : 'neutral',
      turn: 'none',
    };
  }

  if (tab === 'neu') {
    const days = Math.floor(hoursWaiting / 24);
    if (days < 1) return { key: 'wait_today', tone: 'ok', turn: 'me' };
    if (days === 1) return { key: 'wait_yesterday', tone: 'neutral', turn: 'me' };
    if (days < 7) return { key: 'wait_days', tone: 'neutral', turn: 'me', params: { days } };
    if (days < 21) return { key: 'wait_warn', tone: 'warn', turn: 'me', params: { days } };
    return { key: 'wait_crit', tone: 'crit', turn: 'me', params: { days } };
  }

  if (tab === 'pruefung') {
    return { key: 'pruefung', tone: 'neutral', turn: 'other' };
  }

  if (tab === 'interview') {
    if (iv) {
      const s = iv.status || '';
      if (s === 'counter_proposed') return { key: 'terminvorschlag', tone: 'warn', turn: 'me' };
      if (s === 'pending_response') return { key: 'wartet_kandidat', tone: 'neutral', turn: 'other' };
      if (s === 'declined') return { key: 'abgesagt', tone: 'crit', turn: 'me' };
      if (s === 'cancelled') return { key: 'termin_abgesagt', tone: 'warn', turn: 'me' };
      if (s === 'no_show') return { key: 'no_show', tone: 'warn', turn: 'me' };
      if (s === 'scheduled' && iv.scheduledAt) {
        const past = new Date(iv.scheduledAt).getTime() < Date.now();
        if (!past) return { key: 'geplant', tone: 'ok', turn: 'other', params: { date: formatTermin(iv.scheduledAt) } };
        if (!iv.feedback) return { key: 'feedback', tone: feedbackTone(iv.scheduledAt), turn: 'me', params: { date: formatTag(iv.scheduledAt) } };
        return { key: 'interview_phase', tone: 'neutral', turn: 'other' };
      }
      if (s === 'completed') {
        if (!iv.feedback) {
          return iv.scheduledAt
            ? { key: 'feedback', tone: feedbackTone(iv.scheduledAt), turn: 'me', params: { date: formatTag(iv.scheduledAt) } }
            : { key: 'feedback_nodate', tone: 'warn', turn: 'me' };
        }
        return { key: 'interview_phase', tone: 'neutral', turn: 'other' };
      }
    }
    if (stage === 'candidate_opted_in') return { key: 'opted_in', tone: 'ok', turn: 'me' };
    if (stage === 'interview_requested') return { key: 'wartet_kandidat', tone: 'neutral', turn: 'other' };
    return { key: 'interview_phase', tone: 'neutral', turn: 'other' };
  }

  // Angebot
  const os = offer?.status || null;
  if (os === 'sent') return { key: 'offer_sent', tone: 'neutral', turn: 'other' };
  if (os === 'viewed') return { key: 'offer_viewed', tone: 'neutral', turn: 'other' };
  if (os === 'negotiating') return { key: 'offer_negotiating', tone: 'warn', turn: 'me' };
  if (os === 'rejected') return { key: 'offer_rejected', tone: 'crit', turn: 'me' };
  if (os === 'expired') return { key: 'offer_expired', tone: 'warn', turn: 'me' };
  if (os === 'accepted') return { key: 'offer_accepted', tone: 'ok', turn: 'other' };
  return { key: 'offer_prep', tone: 'neutral', turn: 'me' };
}

export function useBewerber(filters: BewerberFilters) {
  const { user } = useAuth();

  const submissionsQuery = useQuery({
    queryKey: ['bewerber', user?.id, filters.jobId, filters.sort],
    queryFn: async () => {
      // Triple-Blind: read EXCLUSIVELY from the reveal-gated view. Identity,
      // exact city/experience and the AI bio are gated server-side; only
      // anonymized bands are returned until the candidate has opted in.
      let query = supabase
        .from('client_candidate_view')
        .select(
          `
          submission_id, candidate_id, job_id, job_title, status, stage,
          match_score, recruiter_notes, submitted_at,
          candidate_role, seniority, skills, remote_preference,
          availability_date, notice_period,
          region_broad, experience_band, salary_band,
          city, experience_years, cv_ai_summary,
          identity_unlocked, full_name
        `,
          { count: 'exact' }
        );

      if (filters.jobId) {
        query = query.eq('job_id', filters.jobId);
      }

      if (filters.sort === 'match_score') {
        query = query.order('match_score', { ascending: false, nullsFirst: false });
      } else {
        query = query.order('submitted_at', { ascending: false });
      }

      query = query.limit(FETCH_LIMIT);

      const { data, error, count } = await query;
      if (error) throw error;

      const rows = (data || []) as any[];

      const submissionIds = rows.map((r) => r.submission_id);

      // Letzter Interview- und Angebots-Stand pro Submission für die Zustands-Pillen
      const ivBySubmission = new Map<string, InterviewInfo>();
      const offerBySubmission = new Map<string, OfferInfo>();
      if (submissionIds.length > 0) {
        const [ivRes, offerRes] = await Promise.all([
          supabase
            .from('interviews')
            .select('id, submission_id, status, scheduled_at, feedback, created_at')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }),
          supabase
            .from('offers')
            .select('id, submission_id, status, created_at')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }),
        ]);
        for (const iv of (ivRes.data || []) as any[]) {
          if (!ivBySubmission.has(iv.submission_id)) {
            ivBySubmission.set(iv.submission_id, {
              status: iv.status,
              scheduledAt: iv.scheduled_at,
              feedback: iv.feedback,
            });
          }
        }
        for (const o of (offerRes.data || []) as any[]) {
          if (!offerBySubmission.has(o.submission_id)) {
            offerBySubmission.set(o.submission_id, { status: o.status });
          }
        }
      }

      // Werdegang aus der gated Experiences-View (Arbeitgeber bis Opt-In maskiert)
      const careerBySubmission = new Map<string, CareerEntry[]>();
      if (submissionIds.length > 0) {
        const { data: expData } = await supabase
          .from('client_candidate_experiences_view')
          .select('submission_id, job_title, company_name, start_date, end_date, is_current, sort_order')
          .in('submission_id', submissionIds);

        for (const exp of (expData || []) as any[]) {
          const start = exp.start_date ? new Date(exp.start_date) : null;
          const end = exp.end_date ? new Date(exp.end_date) : null;
          let durationYears: number | null = null;
          if (start) {
            const endDate = end || new Date();
            durationYears = Math.round((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365));
            if (durationYears < 1) durationYears = 1;
          }
          const entry: CareerEntry = {
            jobTitle: exp.job_title,
            companyAnonymized: exp.company_name || 'Unternehmen', // null bis Opt-In
            startDate: exp.start_date,
            endDate: exp.end_date,
            isCurrent: exp.is_current || false,
            durationYears,
          };
          const list = careerBySubmission.get(exp.submission_id) || [];
          list.push(entry);
          careerBySubmission.set(exp.submission_id, list);
        }
      }

      const items: BewerberItem[] = rows.map((row) => {
        const hours = computeHoursWaiting(row.submitted_at);
        const { tab, archiveKind } = tabOf(row.stage, row.status);
        const state = computeState(
          tab,
          archiveKind,
          row.stage || row.status || 'submitted',
          hours,
          ivBySubmission.get(row.submission_id) || null,
          offerBySubmission.get(row.submission_id) || null
        );
        const isMyTurn = state.turn === 'me';
        const career = (careerBySubmission.get(row.submission_id) || []).slice(0, 5);

        return {
          submissionId: row.submission_id,
          candidateId: row.candidate_id,
          anonymizedName: candidateAnonCode(row.candidate_id),
          fullName: row.identity_unlocked ? row.full_name ?? null : null,
          identityUnlocked: !!row.identity_unlocked,
          tab,
          archiveKind,
          state,
          jobId: row.job_id,
          jobTitle: row.job_title,
          matchScore: row.match_score,
          stage: row.stage || row.status || 'submitted',
          status: row.status || 'submitted',
          submittedAt: row.submitted_at,
          recruiterNotes: row.recruiter_notes,
          currentRole: row.candidate_role,
          experienceYears: row.experience_years ?? null, // gated
          experienceBand: row.experience_band || 'Nicht angegeben',
          city: row.city ?? null, // gated
          region: row.region_broad || 'DACH',
          skills: row.skills,
          // Die View liefert nie NULL, sondern das Literal 'Nicht freigegeben' — leer = UI zeigt „Gehalt nach Zustimmung"
          salaryBand: row.salary_band === 'Nicht freigegeben' ? '' : row.salary_band || '',
          remotePreference: row.remote_preference,
          availabilityDate: row.availability_date,
          noticePeriod: row.notice_period,
          seniority: row.seniority,
          aiSummary: row.cv_ai_summary, // serverseitig gescrubbt bis Opt-In
          hoursWaiting: hours,
          urgency: state.tone === 'crit' ? 'critical' : state.tone === 'warn' ? 'warning' : 'normal',
          isMyTurn,
          career,
        };
      });

      // Client-side sort for waiting_time (computed field)
      if (filters.sort === 'waiting_time') {
        items.sort((a, b) => b.hoursWaiting - a.hoursWaiting);
      }

      return { items, totalCount: count ?? items.length };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const jobsQuery = useQuery({
    queryKey: ['bewerber-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title')
        .eq('client_id', user!.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as JobOption[];
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  const allItems = submissionsQuery.data?.items || [];
  const serverTotal = submissionsQuery.data?.totalCount ?? allItems.length;

  // Tab-Zähler aus ungefilterten Daten — jeder Bewerber zählt in genau einem Tab.
  const tabCounts: Record<BewerberTab, number> = {
    neu: 0,
    pruefung: 0,
    interview: 0,
    angebot: 0,
    archiv: 0,
  };
  for (const item of allItems) {
    tabCounts[item.tab] += 1;
  }
  const activeCount = allItems.length - tabCounts.archiv;
  const myTurnCount = allItems.filter((i) => i.isMyTurn).length;

  // Tab- und Suchfilter clientseitig (Datenmenge ist durch FETCH_LIMIT begrenzt;
  // truncated signalisiert der UI, dass serverseitig mehr existiert).
  const filteredItems = allItems.filter((item) => {
    if (filters.tab === null) {
      if (item.tab === 'archiv') return false; // "Alle" = aktive Pipeline
    } else if (item.tab !== filters.tab) {
      return false;
    }
    if (!filters.search) return true;
    const s = filters.search.toLowerCase();
    return (
      item.anonymizedName.toLowerCase().includes(s) ||
      (item.fullName || '').toLowerCase().includes(s) ||
      (item.currentRole || '').toLowerCase().includes(s) ||
      item.jobTitle.toLowerCase().includes(s) ||
      (item.city || '').toLowerCase().includes(s) ||
      (item.skills || []).some((skill) => skill.toLowerCase().includes(s))
    );
  });

  return {
    items: filteredItems,
    allItems,
    tabCounts,
    activeCount,
    myTurnCount,
    totalCount: serverTotal,
    truncated: serverTotal > allItems.length,
    jobs: jobsQuery.data || [],
    isLoading: submissionsQuery.isLoading,
    error: submissionsQuery.error,
    refetch: submissionsQuery.refetch,
  };
}

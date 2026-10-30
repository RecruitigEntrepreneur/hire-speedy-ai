import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { candidateAnonCode } from '@/lib/anonymization';
import { feedbackWayOf } from '@/lib/interviewScheduling';

export type BewerberSortOption = 'match_score' | 'waiting_time' | 'newest';

export type BewerberTab = 'neu' | 'pruefung' | 'interview' | 'angebot' | 'archiv';

export type ArchiveKind = 'abgelehnt' | 'eingestellt' | 'zurueckgezogen' | 'abgelaufen' | 'stelle_besetzt' | 'stelle_geschlossen';

/**
 * Reiter der Bewerberliste. Feiner als BewerberTab: „Angefragt“ (wartet auf den
 * Kandidaten) steht neben „Interview“, das Archiv teilt sich in „Abgelehnt“ und „Beendet“.
 * BewerberTab bleibt für Jobseite und Cockpit unverändert.
 */
export type BewerberListTab = 'neu' | 'pruefung' | 'angefragt' | 'interview' | 'angebot' | 'abgelehnt' | 'beendet';

export function listTabOf(tab: BewerberTab, archiveKind: ArchiveKind | null, stateKey: string): BewerberListTab {
  if (tab === 'archiv') return archiveKind === 'abgelehnt' ? 'abgelehnt' : 'beendet';
  if (tab === 'interview' && stateKey === 'wartet_kandidat') return 'angefragt';
  return tab;
}

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
  listTab: BewerberListTab;
  /** Letzte Interview-Anfrage: wann und von wem (ältere ohne Person). */
  requestedAt: string | null;
  requestedBy: string | null;
  /** Letzte Absage des Kunden. */
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectReason: string | null;
}

export interface BewerberFilters {
  tab: BewerberTab | null; // null = "Alle" (alle Nicht-Archiv)
  /** Reiter der Bewerberliste; gesetzt, wenn die Liste nach den feinen Reitern filtert. */
  listTab?: BewerberListTab | null;
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
  // nach dem Feedback, bis Angebot oder Absage
  'interview_completed',
]);

// Stelle besetzt oder geschlossen: Der Kunde entscheidet über offene Vorschläge nicht mehr, der
// Headhunter informiert den Kandidaten (wie client-tasks). Ein laufendes Angebot bleibt sichtbar.
const JOB_CLOSED: Record<string, ArchiveKind> = { filled: 'stelle_besetzt', closed: 'stelle_geschlossen' };

export function tabOf(stage: string | null, status: string | null, jobStatus?: string | null): { tab: BewerberTab; archiveKind: ArchiveKind | null } {
  if (status && ARCHIVE_STATUS[status]) {
    return { tab: 'archiv', archiveKind: ARCHIVE_STATUS[status] };
  }
  const s = stage || 'new';
  if (s === 'hired' || s === 'placed') return { tab: 'archiv', archiveKind: 'eingestellt' };
  if (s === 'offer') return { tab: 'angebot', archiveKind: null };
  if (jobStatus && JOB_CLOSED[jobStatus]) return { tab: 'archiv', archiveKind: JOB_CLOSED[jobStatus] };
  if (PRUEFUNG_STAGES.has(s)) return { tab: 'pruefung', archiveKind: null };
  if (INTERVIEW_STAGES.has(s)) return { tab: 'interview', archiveKind: null };
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
  createdAt?: string | null;
  requestedBy?: string | null;
  /** Runde des Gesprächs (1, 2, …) */
  round?: number | null;
}

/** Zustand nach gespeichertem Feedback: der Weg, den der Kunde gewählt hat. */
function afterFeedback(iv: InterviewInfo): BewerberState {
  const next = (iv.round ?? 1) + 1;
  const way = feedbackWayOf(iv.feedback);
  if (way === 'next_round') return { key: 'naechste_runde', tone: 'ok', turn: 'me', params: { round: next } };
  if (way === 'offer') return { key: 'angebot_vorbereiten', tone: 'ok', turn: 'me', params: { round: next } };
  if (way === 'unsure') return { key: 'unsicher', tone: 'neutral', turn: 'other', params: { round: next } };
  return { key: 'interview_phase', tone: 'neutral', turn: 'other' };
}

const ddmm = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));

/** Datum und Grund in die Pille: „Angefragt 12.10. · seit 8 Tagen“, „Abgelehnt 23.07. · Gehaltsvorstellung“. */
export function datedState(
  state: BewerberState,
  iv: { createdAt?: string | null } | null,
  rejection: { createdAt: string; reasonCategory: string | null } | null,
  archiveKind: ArchiveKind | null,
): BewerberState {
  if (state.key === 'wartet_kandidat' && iv?.createdAt) {
    return { ...state, params: { ...state.params, date: ddmm(iv.createdAt), days: daysSince(iv.createdAt) } };
  }
  if (state.key === 'archiv' && archiveKind === 'abgelehnt' && rejection) {
    return { ...state, params: { ...state.params, date: ddmm(rejection.createdAt), grund: rejection.reasonCategory ?? '' } };
  }
  return state;
}

export interface OfferInfo {
  status: string | null;
  /** Antwort bis (Datum); abgelaufen = Kunde ist am Zug */
  responseDue?: string | null;
  /** Arbeitsvertrag nach der Zusage (Paket 3) */
  contractStatus?: string | null;
  contractReportedRole?: string | null;
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
        return afterFeedback(iv);
      }
      if (s === 'completed') {
        if (!iv.feedback) {
          return iv.scheduledAt
            ? { key: 'feedback', tone: feedbackTone(iv.scheduledAt), turn: 'me', params: { date: formatTag(iv.scheduledAt) } }
            : { key: 'feedback_nodate', tone: 'warn', turn: 'me' };
        }
        return afterFeedback(iv);
      }
    }
    if (stage === 'candidate_opted_in') return { key: 'opted_in', tone: 'ok', turn: 'me' };
    if (stage === 'interview_requested') return { key: 'wartet_kandidat', tone: 'neutral', turn: 'other' };
    return { key: 'interview_phase', tone: 'neutral', turn: 'other' };
  }

  // Angebot über den Headhunter (22.10.2026)
  const os = offer?.status || null;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  if (os === 'with_recruiter' || os === 'considering') {
    if (offer?.responseDue && offer.responseDue < today) return { key: 'offer_overdue', tone: 'warn', turn: 'me' };
    return { key: os === 'considering' ? 'offer_considering' : 'offer_with_hh', tone: 'neutral', turn: 'other' };
  }
  if (os === 'accept_reported') return { key: 'offer_accept_reported', tone: 'ok', turn: 'other' };
  if (os === 'countered') return { key: 'offer_negotiating', tone: 'warn', turn: 'me' };
  if (os === 'declined') return { key: 'offer_rejected', tone: 'crit', turn: 'me' };
  if (os === 'withdrawn') return { key: 'offer_withdrawn', tone: 'neutral', turn: 'me' };
  if (os === 'accepted') {
    // Arbeitsvertrag nach der Zusage (Paket 3)
    const cs = offer?.contractStatus || null;
    if (cs === 'sent_self' || cs === 'sent_digital' || cs === 'company_signed') return { key: 'vertrag_unterwegs', tone: 'neutral', turn: 'other' };
    if (cs === 'reported') return { key: 'vertrag_bestaetigen', tone: 'warn', turn: 'me' };
    if (cs === 'signed' || cs === 'final') return { key: 'vertrag_unterschrieben', tone: 'ok', turn: 'none' };
    if (cs === 'declined') return { key: 'vertrag_abgelehnt', tone: 'warn', turn: 'me' };
    if (cs === 'dropped') return { key: 'abgesprungen', tone: 'neutral', turn: 'none' };
    return { key: 'offer_accepted', tone: 'ok', turn: 'me' };
  }
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

      // Stand der Stellen: besetzt oder geschlossen heißt keine Entscheidung mehr (Etikett „Stelle besetzt“)
      const jobStatusById = new Map<string, string>();
      const jobIds = [...new Set(rows.map((r) => r.job_id).filter(Boolean))] as string[];
      if (jobIds.length > 0) {
        const { data: jobRows } = await supabase.from('jobs').select('id, status').in('id', jobIds);
        for (const j of (jobRows || []) as any[]) jobStatusById.set(j.id, j.status);
      }

      // Letzter Interview- und Angebots-Stand pro Submission für die Zustands-Pillen
      const ivBySubmission = new Map<string, InterviewInfo>();
      const offerBySubmission = new Map<string, OfferInfo>();
      const rejBySubmission = new Map<string, { createdAt: string; reasonCategory: string | null; rejectedBy: string | null }>();
      if (submissionIds.length > 0) {
        const [ivRes, offerRes, rejRes, contractRes] = await Promise.all([
          supabase
            .from('interviews')
            .select('id, submission_id, status, scheduled_at, feedback, created_at, requested_by, round')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }),
          supabase
            .from('offers')
            .select('id, submission_id, status, created_at, response_due')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false }),
          // Absagen: wann, von wem, welcher Grund (Kunden-Team darf lesen)
          supabase
            .from('rejections')
            .select('submission_id, created_at, reason_category, rejected_by')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false }),
          // Arbeitsvertrag nach der Zusage (Paket 3); fehlt die Tabelle noch, bleibt es bei „angenommen“
          (supabase as any)
            .from('employment_contracts')
            .select('submission_id, status, reported_role, created_at')
            .in('submission_id', submissionIds)
            .order('created_at', { ascending: false }),
        ]);
        const contractBySubmission = new Map<string, { status: string; reportedRole: string | null }>();
        for (const c of ((contractRes as any).data || []) as any[]) {
          if (!contractBySubmission.has(c.submission_id)) contractBySubmission.set(c.submission_id, { status: c.status, reportedRole: c.reported_role ?? null });
        }
        for (const r of (rejRes.data || []) as any[]) {
          if (!rejBySubmission.has(r.submission_id)) {
            rejBySubmission.set(r.submission_id, { createdAt: r.created_at, reasonCategory: r.reason_category, rejectedBy: r.rejected_by });
          }
        }
        for (const iv of (ivRes.data || []) as any[]) {
          if (!ivBySubmission.has(iv.submission_id)) {
            ivBySubmission.set(iv.submission_id, {
              status: iv.status,
              scheduledAt: iv.scheduled_at,
              feedback: iv.feedback,
              createdAt: iv.created_at,
              requestedBy: iv.requested_by ?? null,
              round: iv.round ?? null,
            });
          }
        }
        for (const o of (offerRes.data || []) as any[]) {
          if (!offerBySubmission.has(o.submission_id)) {
            const c = contractBySubmission.get(o.submission_id);
            offerBySubmission.set(o.submission_id, { status: o.status, responseDue: o.response_due ?? null, contractStatus: c?.status ?? null, contractReportedRole: c?.reportedRole ?? null });
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
        const { tab, archiveKind } = tabOf(row.stage, row.status, jobStatusById.get(row.job_id));
        const iv = ivBySubmission.get(row.submission_id) || null;
        const rej = rejBySubmission.get(row.submission_id) || null;
        const rawState = computeState(
          tab,
          archiveKind,
          row.stage || row.status || 'submitted',
          hours,
          ivBySubmission.get(row.submission_id) || null,
          offerBySubmission.get(row.submission_id) || null
        );
        const state = datedState(rawState, iv, rej, archiveKind);
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
          listTab: listTabOf(tab, archiveKind, state.key),
          requestedAt: iv?.createdAt ?? null,
          requestedBy: iv?.requestedBy ?? null,
          rejectedAt: rej?.createdAt ?? null,
          rejectedBy: rej?.rejectedBy ?? null,
          rejectReason: rej?.reasonCategory ?? null,
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
  const listTabCounts: Record<BewerberListTab, number> = {
    neu: 0, pruefung: 0, angefragt: 0, interview: 0, angebot: 0, abgelehnt: 0, beendet: 0,
  };
  for (const item of allItems) listTabCounts[item.listTab] += 1;
  const myTurnCount = allItems.filter((i) => i.isMyTurn).length;

  // Tab- und Suchfilter clientseitig (Datenmenge ist durch FETCH_LIMIT begrenzt;
  // truncated signalisiert der UI, dass serverseitig mehr existiert).
  const filteredItems = allItems.filter((item) => {
    if (filters.listTab !== undefined) {
      if (filters.listTab === null) {
        if (item.tab === 'archiv') return false;
      } else if (item.listTab !== filters.listTab) {
        return false;
      }
    } else if (filters.tab === null) {
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
    listTabCounts,
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

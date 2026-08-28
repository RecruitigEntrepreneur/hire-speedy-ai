import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { anonymizeCompanyName } from '@/lib/anonymization';

export interface RecruiterAgendaSlot {
  datetime: string;
}

export interface RecruiterInterview {
  id: string;
  submissionId: string;
  candidateId: string | null;
  jobId: string | null;
  scheduledAt: string | null;
  endsAt: number | null;
  durationMinutes: number;
  status: string;
  confirmed: boolean;
  meetingType: string | null;
  joinUrl: string | null;
  onsiteAddress: string | null;
  notes: string | null;
  feedback: string | null;
  createdAt: string;
  waitingHours: number;
  slotsExpired: boolean;
  proposedSlots: RecruiterAgendaSlot[];
  /** Gegenvorschlaege (status counter_proposed) — wer den Termin verschieben will. */
  counterSlots: RecruiterAgendaSlot[];
  candidateMessage: string | null;
  cancellationReason: string | null;
  cancelledBy: string | null;
  noShowBy: string | null;
  candidateName: string;
  candidatePhone: string | null;
  candidateEmail: string | null;
  jobTitle: string;
  // Reveal-gated: echter Firmenname erst nach company_revealed, sonst Branchen-Label
  companyLabel: string;
  companyRevealed: boolean;
  potentialFee: number | null;
}

export interface RecruiterAgendaDay {
  key: string;
  label: string;
  items: RecruiterInterview[];
}

export interface RecruiterInterviewAgenda {
  all: RecruiterInterview[];
  nextUp: RecruiterInterview | null;
  agendaDays: RecruiterAgendaDay[];
  /** Gegenvorschlag liegt vor — eigene Gruppe, sonst als "Slots abgelaufen" getarnt. */
  counterProposals: RecruiterInterview[];
  awaitingScheduling: RecruiterInterview[];
  debriefDue: RecruiterInterview[];
  past: RecruiterInterview[];
  /** Abgesagt bzw. nicht erschienen — Teilmenge von past, getrennt ausgewiesen. */
  cancelled: RecruiterInterview[];
  todayCount: number;
  weekCount: number;
  unconfirmedCount: number;
  /** Wartet auf Terminierung. unconfirmedCount zaehlt nur bereits terminierte
   *  Termine und ist deshalb 0, wenn nichts ansteht — diese Zahl ist die,
   *  bei der der Recruiter handeln muss. */
  awaitingCount: number;
}

const TERMINAL = ['declined', 'cancelled', 'no_show'];

const parseSlots = (raw: unknown): RecruiterAgendaSlot[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({ datetime: typeof s === 'string' ? s : s?.datetime }))
    .filter((s) => !!s.datetime);
};

const calcFee = (
  salaryMin: number | null,
  salaryMax: number | null,
  feePercentage: number | null,
): number | null => {
  if (!feePercentage || (!salaryMin && !salaryMax)) return null;
  const avgSalary = salaryMin && salaryMax ? (salaryMin + salaryMax) / 2 : salaryMin || salaryMax;
  if (!avgSalary) return null;
  return Math.round(avgSalary * (feePercentage / 100));
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function dayLabel(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * Interview-Agenda aus Recruiter-Sicht. Spiegelbild von useClientInterviewAgenda:
 * der Recruiter kennt seinen Kandidaten, aber die FIRMA bleibt bis zum Reveal
 * (submissions.company_revealed) hinter dem Branchen-Label verborgen.
 * Einordnung ist zeit-basiert statt status-gläubig: vergangene Interviews ohne
 * Feedback landen automatisch in "Debrief fällig".
 */
export function useRecruiterInterviewAgenda() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['recruiter-interview-agenda', user?.id],
    queryFn: async (): Promise<RecruiterInterviewAgenda> => {
      const { data, error } = await supabase
        .from('interviews')
        .select(
          `id, submission_id, scheduled_at, duration_minutes, status, meeting_type, meeting_format,
           meeting_link, teams_join_url, google_meet_link, onsite_address, notes, feedback,
           proposed_slots, counter_slots, candidate_message, cancellation_reason, cancelled_by,
           no_show_by, created_at,
           submissions!inner(
             recruiter_id, candidate_id, job_id, company_revealed,
             candidates(full_name, phone, email)
           )`,
        )
        .eq('submissions.recruiter_id', user!.id)
        .order('scheduled_at', { ascending: true, nullsFirst: false });

      if (error) throw error;

      // Job-Infos separat ueber recruiter_jobs_view: Recruiter duerfen
      // public.jobs nicht mehr direkt lesen, ein eingebetteter jobs(...)-Join
      // liefert deshalb nichts mehr. Die View maskiert die Firmenidentitaet
      // und gibt company_name nur nach dem Reveal frei.
      const agendaJobIds = [
        ...new Set((data || []).map((r: any) => r.submissions?.job_id).filter(Boolean)),
      ] as string[];
      let agendaJobsById: Record<string, any> = {};
      if (agendaJobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title, company_name, industry, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', agendaJobIds);
        agendaJobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }
      (data || []).forEach((r: any) => {
        if (r.submissions?.job_id) r.submissions.jobs = agendaJobsById[r.submissions.job_id] ?? null;
      });

      const now = Date.now();

      const all: RecruiterInterview[] = (data || []).map((r: any) => {
        const sub = r.submissions;
        const cand = sub?.candidates;
        const job = sub?.jobs;
        const revealed = sub?.company_revealed === true;
        const duration = r.duration_minutes ?? 60;
        const endsAt = r.scheduled_at ? new Date(r.scheduled_at).getTime() + duration * 60_000 : null;
        const proposedSlots = parseSlots(r.proposed_slots);
        return {
          id: r.id,
          submissionId: r.submission_id,
          candidateId: sub?.candidate_id ?? null,
          jobId: sub?.job_id ?? null,
          scheduledAt: r.scheduled_at,
          endsAt,
          durationMinutes: duration,
          status: r.status || 'pending',
          confirmed: r.status === 'scheduled',
          meetingType: r.meeting_type ?? r.meeting_format ?? null,
          joinUrl: r.teams_join_url ?? r.google_meet_link ?? r.meeting_link ?? null,
          onsiteAddress: r.onsite_address ?? null,
          notes: r.notes ?? null,
          feedback: r.feedback ?? null,
          createdAt: r.created_at,
          waitingHours: Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 3_600_000)),
          slotsExpired:
            proposedSlots.length > 0 && proposedSlots.every((s) => new Date(s.datetime).getTime() < now),
          proposedSlots,
          counterSlots: parseSlots(r.counter_slots),
          candidateMessage: r.candidate_message ?? null,
          cancellationReason: r.cancellation_reason ?? null,
          cancelledBy: r.cancelled_by ?? null,
          noShowBy: r.no_show_by ?? null,
          candidateName: cand?.full_name || 'Kandidat',
          candidatePhone: cand?.phone ?? null,
          candidateEmail: cand?.email ?? null,
          jobTitle: job?.title || 'Position',
          companyLabel: revealed
            ? job?.company_name || 'Unternehmen'
            : anonymizeCompanyName(job?.industry ?? null),
          companyRevealed: revealed,
          potentialFee: calcFee(
            job?.salary_min ?? null,
            job?.salary_max ?? null,
            job?.recruiter_fee_percentage ?? null,
          ),
        };
      });

      const agenda: RecruiterInterview[] = [];
      const counterProposals: RecruiterInterview[] = [];
      const awaitingScheduling: RecruiterInterview[] = [];
      const debriefDue: RecruiterInterview[] = [];
      const cancelled: RecruiterInterview[] = [];
      const past: RecruiterInterview[] = [];

      for (const iv of all) {
        if (TERMINAL.includes(iv.status)) {
          // Abgesagt/No-Show ist eine eigene Geschichte: der Recruiter muss
          // sehen, wo seine Termine sterben, nicht nur dass sie vorbei sind.
          if (iv.status === 'cancelled' || iv.status === 'no_show') cancelled.push(iv);
          else past.push(iv);
        } else if (iv.status === 'counter_proposed') {
          // Vorrang vor allen Zeit-Regeln: ein Gegenvorschlag wartet auf eine
          // Antwort und darf nicht als "Slots abgelaufen" verkleidet werden.
          counterProposals.push(iv);
        } else if (!iv.scheduledAt) {
          awaitingScheduling.push(iv);
        } else if (iv.endsAt !== null && iv.endsAt > now) {
          agenda.push(iv);
        } else if (iv.status === 'pending_response' || iv.status === 'pending') {
          awaitingScheduling.push({ ...iv, slotsExpired: true });
        } else if (!iv.feedback) {
          debriefDue.push(iv);
        } else {
          past.push(iv);
        }
      }

      agenda.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
      counterProposals.sort((a, b) => b.waitingHours - a.waitingHours);
      cancelled.sort((a, b) => (b.endsAt ?? new Date(b.createdAt).getTime()) - (a.endsAt ?? new Date(a.createdAt).getTime()));
      awaitingScheduling.sort((a, b) => b.waitingHours - a.waitingHours);
      debriefDue.sort((a, b) => (b.endsAt ?? 0) - (a.endsAt ?? 0));
      past.sort((a, b) => (b.endsAt ?? new Date(b.createdAt).getTime()) - (a.endsAt ?? new Date(a.createdAt).getTime()));

      const agendaDays: RecruiterAgendaDay[] = [];
      for (const iv of agenda) {
        const d = new Date(iv.scheduledAt!);
        const key = dayKey(d);
        const last = agendaDays[agendaDays.length - 1];
        if (last && last.key === key) last.items.push(iv);
        else agendaDays.push({ key, label: dayLabel(d), items: [iv] });
      }

      const todayKey = dayKey(new Date());
      const weekEnd = now + 7 * 86_400_000;

      return {
        all,
        // agenda ist zeitlich sortiert: [0] IST der naechste Termin. Vorher
        // wurde das erste *bestaetigte* genommen — dann behauptete "Als
        // naechstes" eine Uhrzeit, die nicht die naechste in der Liste war.
        nextUp: agenda[0] ?? null,
        agendaDays,
        counterProposals,
        awaitingScheduling,
        debriefDue,
        cancelled,
        past,
        todayCount: agendaDays.find((d) => d.key === todayKey)?.items.length ?? 0,
        weekCount: agenda.filter((iv) => new Date(iv.scheduledAt!).getTime() < weekEnd).length,
        unconfirmedCount: agenda.filter((iv) => !iv.confirmed).length,
        awaitingCount: awaitingScheduling.length + counterProposals.length,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { candidateAnonCode, generateAnonymousId } from '@/lib/anonymization';

export interface AgendaSlot {
  datetime: string;
}

export interface AgendaInterview {
  id: string;
  submissionId: string;
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
  proposedSlots: AgendaSlot[];
  counterSlots: AgendaSlot[];
  candidateMessage: string | null;
  createdAt: string;
  waitingHours: number;
  slotsExpired: boolean;
  // Kandidat – reveal-gated: Name nur nach Opt-In, sonst anonymer Code
  candidateName: string;
  identityUnlocked: boolean;
  candidateId: string | null;
  candidateRole: string | null;
  jobTitle: string;
  jobId: string | null;
}

export interface AgendaDay {
  key: string;
  label: string;
  items: AgendaInterview[];
}

export interface ClientInterviewAgenda {
  all: AgendaInterview[];
  nextUp: AgendaInterview | null;
  agendaDays: AgendaDay[];
  counterProposals: AgendaInterview[];
  awaitingCandidate: AgendaInterview[];
  feedbackDue: AgendaInterview[];
  past: AgendaInterview[];
}

const TERMINAL = ['declined', 'cancelled', 'no_show'];

const parseSlots = (raw: unknown): AgendaSlot[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: any) => ({ datetime: typeof s === 'string' ? s : s?.datetime }))
    .filter((s) => !!s.datetime);
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
 * Reveal-sichere Datenquelle für die Interview-Agenda des Clients.
 * - `interviews` wird OHNE Kandidaten-Join gelesen (RLS: nur eigene Jobs).
 * - Namen kommen ausschließlich aus der reveal-gated client_candidate_view
 *   (full_name ist NULL bis Opt-In) – vorher zeigen wir den anonymen Code.
 * - Einordnung ist ZEIT-basiert statt status-gläubig: vergangene "scheduled"-
 *   Interviews landen automatisch in "Feedback fällig" statt ewig in "Anstehend".
 */
export function useClientInterviewAgenda() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-interview-agenda', user?.id],
    queryFn: async (): Promise<ClientInterviewAgenda> => {
      const [ivRes, candRes] = await Promise.all([
        supabase
          .from('interviews')
          .select(
            'id, submission_id, scheduled_at, duration_minutes, status, meeting_type, meeting_format, meeting_link, teams_join_url, google_meet_link, onsite_address, notes, feedback, proposed_slots, counter_slots, candidate_message, created_at',
          )
          .order('scheduled_at', { ascending: true }),
        supabase
          .from('client_candidate_view')
          .select('submission_id, candidate_id, full_name, identity_unlocked, candidate_role, job_title, job_id'),
      ]);

      if (ivRes.error) throw ivRes.error;
      // Die View kann bei Fehlern leer bleiben – dann fallen wir auf Anon-Codes zurück.
      const candBySubmission = new Map<string, any>();
      for (const c of candRes.data || []) candBySubmission.set(c.submission_id, c);

      const now = Date.now();

      const all: AgendaInterview[] = (ivRes.data || []).map((r: any) => {
        const cand = candBySubmission.get(r.submission_id);
        const unlocked = cand?.identity_unlocked === true && !!cand?.full_name;
        const duration = r.duration_minutes ?? 60;
        const endsAt = r.scheduled_at ? new Date(r.scheduled_at).getTime() + duration * 60_000 : null;
        const proposedSlots = parseSlots(r.proposed_slots);
        return {
          id: r.id,
          submissionId: r.submission_id,
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
          proposedSlots,
          counterSlots: parseSlots(r.counter_slots),
          candidateMessage: r.candidate_message ?? null,
          createdAt: r.created_at,
          waitingHours: Math.max(0, Math.floor((now - new Date(r.created_at).getTime()) / 3_600_000)),
          slotsExpired:
            proposedSlots.length > 0 && proposedSlots.every((s) => new Date(s.datetime).getTime() < now),
          // Einheitlicher Anonym-Code (PR-…, candidate_id-basiert) wie in Inbox
          // und Cockpit; Fallback nur, wenn die View-Zeile fehlt.
          candidateName: unlocked
            ? cand.full_name
            : cand?.candidate_id
              ? candidateAnonCode(cand.candidate_id)
              : generateAnonymousId(r.submission_id || ''),
          identityUnlocked: unlocked,
          candidateId: cand?.candidate_id ?? null,
          candidateRole: cand?.candidate_role ?? null,
          jobTitle: cand?.job_title || 'Position',
          jobId: cand?.job_id ?? null,
        };
      });

      const counterProposals: AgendaInterview[] = [];
      const awaitingCandidate: AgendaInterview[] = [];
      const agenda: AgendaInterview[] = [];
      const feedbackDue: AgendaInterview[] = [];
      const past: AgendaInterview[] = [];

      for (const iv of all) {
        if (TERMINAL.includes(iv.status)) {
          past.push(iv);
        } else if (iv.status === 'counter_proposed') {
          counterProposals.push(iv);
        } else if (!iv.scheduledAt) {
          awaitingCandidate.push(iv);
        } else if (iv.endsAt !== null && iv.endsAt > now) {
          agenda.push(iv);
        } else if (iv.status === 'pending_response' || iv.status === 'pending') {
          // Termin(e) verstrichen, Kandidat hat nie geantwortet → wartet, mit Hinweis "Slots abgelaufen"
          awaitingCandidate.push({ ...iv, slotsExpired: true });
        } else if (!iv.feedback) {
          feedbackDue.push(iv);
        } else {
          past.push(iv);
        }
      }

      agenda.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
      counterProposals.sort((a, b) => b.waitingHours - a.waitingHours);
      awaitingCandidate.sort((a, b) => b.waitingHours - a.waitingHours);
      feedbackDue.sort((a, b) => (b.endsAt ?? 0) - (a.endsAt ?? 0));
      past.sort((a, b) => (b.endsAt ?? new Date(b.createdAt).getTime()) - (a.endsAt ?? new Date(a.createdAt).getTime()));

      const agendaDays: AgendaDay[] = [];
      for (const iv of agenda) {
        const d = new Date(iv.scheduledAt!);
        const key = dayKey(d);
        const last = agendaDays[agendaDays.length - 1];
        if (last && last.key === key) last.items.push(iv);
        else agendaDays.push({ key, label: dayLabel(d), items: [iv] });
      }

      return {
        all,
        nextUp: agenda.find((iv) => iv.confirmed) ?? agenda[0] ?? null,
        agendaDays,
        counterProposals,
        awaitingCandidate,
        feedbackDue,
        past,
      };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

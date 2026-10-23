import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callFunction } from '@/lib/interviewScheduling';

/**
 * Aufgaben des Kunden (23.10.2026): Die Function client-tasks leitet sie aus dem Stand ab.
 * Eine Aufgabe schließt sich mit der Handlung; hier nur Abruf, Texte und die Antworten,
 * die keine andere Function abdeckt.
 */

export type ClientTaskKind =
  | 'review' | 'alternative' | 'expired_request' | 'feedback' | 'decide_unsure' | 'make_offer'
  | 'counter' | 'offer_overdue' | 'send_contract' | 'contract_signed_check' | 'docusign_sign'
  | 'confirm_signature' | 'recruiter_question' | 'confirm_start' | 'invoice';

export interface ClientTask {
  key: string;
  kind: ClientTaskKind;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  who: string;
  title: string;
  detail: string;
  since: string;
  urgent: boolean;
  waitingWho: string | null;
  ref: { interviewId?: string; offerId?: string; contractId?: string; placementId?: string; invoiceId?: string; notificationId?: string; questions?: string[] };
  note: string | null;
  /** Entscheidungshilfe (Fenster oben, Zeile auf der Seite „Aufgaben“) */
  context: TaskContext | null;
}

export interface TaskChip { text: string; tone: 'good' | 'warn' | 'bad' }
export interface TaskFact { label: string; value: string; chip?: TaskChip | null }
export interface TaskContext {
  ask: string | null;
  facts: TaskFact[];
  line: string[];
  chip: TaskChip | null;
  quote: { by: string; text: string } | null;
  compare: { heads: string[]; rows: { label: string; cells: string[]; changed: boolean }[] } | null;
  timeline: { text: string; state: 'done' | 'now' | 'next' }[] | null;
  why: string | null;
  foot: string | null;
}

export interface ClientWaitingItem {
  key: string;
  submissionId: string | null;
  jobId: string | null;
  jobTitle: string | null;
  who: string;
  by: 'candidate' | 'recruiter' | 'matchunt' | 'date';
  title: string;
  detail: string;
}

export interface ClientDoneItem { key: string; kind: string; submissionId: string | null; jobId: string | null; label: string; answer: string | null; doneAt: string; doneBy: string }

export interface ClientTaskList {
  tasks: ClientTask[];
  waiting: ClientWaitingItem[];
  done: ClientDoneItem[];
  counts: { urgent: number; total: number };
}

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('client-tasks', { action, ...body }, fallback);

export const clientTasksApi = {
  list: (submissionId?: string) => call<ClientTaskList>('list', submissionId ? { submissionId } : {}),
  logDone: (t: Pick<ClientTask, 'key' | 'kind' | 'submissionId' | 'jobId'>, label: string, answer?: string) =>
    call<{ ok: true }>('log_done', { key: t.key, kind: t.kind, submissionId: t.submissionId, jobId: t.jobId, label, answer }),
  answerQuestion: (notificationId: string, answer: string) => call<{ ok: true }>('answer_question', { notificationId, answer }, 'Die Antwort konnte nicht gesendet werden.'),
  forwardQuestion: (notificationId: string, toUserId: string) => call<{ ok: true; to: string }>('forward_question', { notificationId, toUserId }),
  colleagues: (notificationId: string) => call<{ colleagues: { userId: string; name: string }[] }>('question_colleagues', { notificationId }),
  askFollowup: (submissionId: string, reason: string) => call<{ ok: true }>('ask_followup', { submissionId, reason }),
  confirmStart: (input: { placementId: string; way: 'started' | 'later' | 'not_started'; startedOn?: string; reason?: string; note?: string }) =>
    call<{ ok: true; state: string }>('confirm_start', { ...input }, 'Der Antritt konnte nicht gespeichert werden.'),
  invoicePaid: (invoiceId: string, paidOn: string) => call<{ ok: true }>('invoice_paid', { invoiceId, paidOn }),
  invoiceQuestion: (invoiceId: string, question: string) => call<{ ok: true }>('invoice_question', { invoiceId, question }),
};

/** Aufgaben des angemeldeten Kunden; mit submissionId nur die einer Bewerbung. */
export function useClientTasks(submissionId?: string) {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['client-tasks', user?.id, submissionId ?? 'alle'],
    queryFn: () => clientTasksApi.list(submissionId),
    enabled: !!user && role === 'client',
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

/** Knopftext je Aufgabe – derselbe in Liste, Kachel, Profil. */
export const TASK_ACTION: Record<ClientTaskKind, string> = {
  review: 'Prüfen',
  alternative: 'Bestätigen',
  expired_request: 'Entscheiden',
  feedback: 'Feedback geben',
  decide_unsure: 'Entscheiden',
  make_offer: 'Angebot machen',
  counter: 'Beantworten',
  offer_overdue: 'Entscheiden',
  send_contract: 'Vertrag schicken',
  contract_signed_check: 'Melden',
  docusign_sign: 'Unterschreiben',
  confirm_signature: 'Bestätigen',
  recruiter_question: 'Antworten',
  confirm_start: 'Bestätigen',
  invoice: 'Öffnen',
};

/** Kurzes Etikett auf der Karte (wie beim Headhunter). */
export const TASK_CHIP: Record<ClientTaskKind, string> = {
  review: 'Prüfung',
  alternative: 'Termin',
  expired_request: 'Termin',
  feedback: 'Feedback',
  decide_unsure: 'Entscheidung',
  make_offer: 'Angebot',
  counter: 'Angebot',
  offer_overdue: 'Angebot',
  send_contract: 'Vertrag',
  contract_signed_check: 'Vertrag',
  docusign_sign: 'Vertrag',
  confirm_signature: 'Vertrag',
  recruiter_question: 'Frage',
  confirm_start: 'Antritt',
  invoice: 'Rechnung',
};

/** „seit 2 Tagen“, „seit 5 Std.“, „seit heute“ */
export function sinceLabel(iso: string, now = Date.now()): string {
  const h = Math.max(0, Math.floor((now - Date.parse(iso)) / 3600000));
  if (h < 1) return 'seit eben';
  if (h < 24) return `seit ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'seit 1 Tag' : `seit ${d} Tagen`;
}

/** „Tessa wartet · seit 2 Tagen“ */
export function waitingLabel(t: ClientTask, now = Date.now()): string {
  return t.waitingWho ? `${t.waitingWho} ${/ und /.test(t.waitingWho) ? 'warten' : 'wartet'} · ${sinceLabel(t.since, now)}` : sinceLabel(t.since, now);
}

/** Wohin ein Klick führt: Bewerberprofil mit offenem Aufgaben-Fenster, sonst die Aufgaben-Seite. */
export function taskHref(t: Pick<ClientTask, 'key' | 'submissionId'>): string {
  return t.submissionId ? `/dashboard/candidates/${t.submissionId}?aufgabe=${encodeURIComponent(t.key)}` : `/dashboard/aufgaben?aufgabe=${encodeURIComponent(t.key)}`;
}

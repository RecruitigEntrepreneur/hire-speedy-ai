import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import i18n from '@/i18n';
import { callFunction } from '@/lib/interviewScheduling';

/**
 * Aufgaben des Kunden (23.10.2026): Die Function client-tasks leitet sie aus dem Stand ab.
 * Eine Aufgabe schließt sich mit der Handlung; hier nur Abruf, Texte und die Antworten,
 * die keine andere Function abdeckt.
 */

export type ClientTaskKind =
  | 'review' | 'alternative' | 'expired_request' | 'feedback' | 'decide_unsure' | 'make_offer'
  | 'counter' | 'offer_overdue' | 'send_contract' | 'contract_signed_check' | 'docusign_sign'
  | 'confirm_signature' | 'recruiter_question' | 'confirm_start' | 'invoice' | 'purchase_order'
  // Umbau Nachbesetzung 11.11.2026 (K7, K8, J2, F3)
  | 'start_check' | 'end_confirm' | 'research_position' | 'research_offer' | 'job_paused';

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
  ref: { interviewId?: string; offerId?: string; responseDue?: string; contractId?: string; placementId?: string; invoiceId?: string; notificationId?: string; questions?: string[]; signMode?: 'email' | 'embedded'; signerExternal?: boolean; researchOfferId?: string; reportedOn?: string };
  note: string | null;
  /** Entscheidungshilfe (Fenster oben, Zeile auf der Seite „Aufgaben“) */
  context: TaskContext | null;
}

export interface TaskChip { text: string; tone: 'good' | 'warn' | 'bad' }
/** `key` ist in jeder Sprache gleich (z. B. 'meeting'), `label` kommt übersetzt vom Server. */
export interface TaskFact { key?: string; label: string; value: string; chip?: TaskChip | null }
export interface TaskContext {
  ask: string | null;
  facts: TaskFact[];
  line: string[];
  chip: TaskChip | null;
  quote: { by: string; text: string } | null;
  compare: { heads: string[]; rows: { key?: string; label: string; cells: string[]; changed: boolean }[] } | null;
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

/** Meilenstein für die Leiste oben im Dashboard (Zusage, Gegenwunsch, Absage, unterschrieben, erster Tag) */
export interface ClientNewsItem {
  key: string;
  kind: 'accepted' | 'counter' | 'declined' | 'signed' | 'start';
  submissionId: string;
  title: string;
  detail: string;
  hint: string | null;
  cta: string;
  taskKey: string | null;
  at: string;
}

export interface ClientDoneItem { key: string; kind: string; submissionId: string | null; jobId: string | null; label: string; answer: string | null; doneAt: string; doneBy: string }

export interface ClientTaskList {
  tasks: ClientTask[];
  waiting: ClientWaitingItem[];
  done: ClientDoneItem[];
  counts: { urgent: number; total: number };
  news?: ClientNewsItem[];
  /** F3 Stufe 1: Vorstellungen über der Grenze von 5 Werktagen (Sammelzeile) */
  reminder?: { count: number; oldestWorkdays: number; text: string } | null;
  /** HR sieht Rechnungen nur lesend; „Überwiesen melden“ nur mit Verwaltungsrecht */
  billing?: { canManage: boolean; financeOnly: boolean };
}

// Sprache der Oberfläche: Texte und Fehlermeldungen kommen vom Server in dieser Sprache
const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('client-tasks', { action, ...body, lang: i18n.language }, fallback);

export const clientTasksApi = {
  list: (submissionId?: string) => call<ClientTaskList>('list', submissionId ? { submissionId } : {}),
  logDone: (t: Pick<ClientTask, 'key' | 'kind' | 'submissionId' | 'jobId'>, label: string, answer?: string) =>
    call<{ ok: true }>('log_done', { key: t.key, kind: t.kind, submissionId: t.submissionId, jobId: t.jobId, label, answer }),
  answerQuestion: (notificationId: string, answer: string) => call<{ ok: true }>('answer_question', { notificationId, answer }, i18n.t('clientTasks:errors.answer')),
  forwardQuestion: (notificationId: string, toUserId: string) => call<{ ok: true; to: string }>('forward_question', { notificationId, toUserId }),
  colleagues: (notificationId: string) => call<{ colleagues: { userId: string; name: string }[] }>('question_colleagues', { notificationId }),
  askFollowup: (submissionId: string, reason: string) => call<{ ok: true }>('ask_followup', { submissionId, reason }),
  confirmStart: (input: { placementId: string; way: 'started' | 'later' | 'not_started'; startedOn?: string; reason?: string; note?: string }) =>
    call<{ ok: true; state: string }>('confirm_start', { ...input }, i18n.t('clientTasks:errors.confirmStart')),
  invoicePaid: (invoiceId: string, paidOn: string) => call<{ ok: true }>('invoice_paid', { invoiceId, paidOn }),
  invoiceQuestion: (invoiceId: string, question: string) => call<{ ok: true }>('invoice_question', { invoiceId, question }),
};

/** Aufgaben des angemeldeten Kunden; mit submissionId nur die einer Bewerbung. */
export function useClientTasks(submissionId?: string) {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['client-tasks', user?.id, submissionId ?? 'alle', i18n.language],
    queryFn: () => clientTasksApi.list(submissionId),
    enabled: !!user && role === 'client',
    staleTime: 30_000,
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Aufgaben einer Bewerbung aus der Gesamtliste, die die Seitenleiste ohnehin lädt: kein zweiter
 * Abruf (live 2–3 s), das Profil steht auf jedem Weg gleich da (29.10.2026).
 */
export function useClientTasksFor(submissionId?: string) {
  const all = useClientTasks();
  const data = useMemo<ClientTaskList | undefined>(() => {
    if (!all.data) return undefined;
    const mine = <T extends { submissionId: string | null }>(xs: T[]) => xs.filter((x) => x.submissionId === submissionId);
    return { ...all.data, tasks: mine(all.data.tasks), waiting: mine(all.data.waiting), done: mine(all.data.done), news: mine(all.data.news ?? []) };
  }, [all.data, submissionId]);
  return { data, isLoading: all.isLoading, refetch: all.refetch };
}

/** Hauptknopf im Bewerberprofil: der nächste Schritt selbst statt „Prüfen“/„Entscheiden“. */
export const taskMainLabel = (kind: ClientTaskKind): string =>
  kind === 'review' || kind === 'expired_request' || kind === 'send_contract' ? i18n.t(`clientTasks:main.${kind}`)
  : TASK_ACTION[kind];

/** Wie ein Record lesbar, liefert aber bei jedem Zugriff den Text in der Sprache der Oberfläche (README Regel 7). */
const labels = (group: 'action' | 'chip') =>
  new Proxy({} as Record<ClientTaskKind, string>, { get: (_t, kind) => (typeof kind === 'string' ? i18n.t(`clientTasks:${group}.${kind}`) : undefined) });

/** Knopftext je Aufgabe – derselbe in Liste, Kachel, Profil (clientTasks:action.<kind>). */
export const TASK_ACTION: Record<ClientTaskKind, string> = labels('action');

/** Kurzes Etikett auf der Karte (wie beim Headhunter; clientTasks:chip.<kind>). */
export const TASK_CHIP: Record<ClientTaskKind, string> = labels('chip');

/** „seit 2 Tagen“, „seit 5 Std.“, „seit heute“ */
export function sinceLabel(iso: string, now = Date.now()): string {
  const h = Math.max(0, Math.floor((now - Date.parse(iso)) / 3600000));
  if (h < 1) return i18n.t('clientTasks:since.justNow');
  if (h < 24) return i18n.t('clientTasks:since.hours', { count: h });
  return i18n.t('clientTasks:since.days', { count: Math.floor(h / 24) });
}

/** „Tessa wartet · seit 2 Tagen“ */
export function waitingLabel(t: ClientTask, now = Date.now()): string {
  // waitingWho kommt vom Server („Tessa“, „Tessa und Max“)
  return t.waitingWho ? i18n.t(`clientTasks:waits.${/ (und|and|och|og) /.test(t.waitingWho) ? 'many' : 'one'}`, { who: t.waitingWho, since: sinceLabel(t.since, now) }) : sinceLabel(t.since, now);
}

/** Wohin ein Klick führt: Bewerberprofil mit offenem Aufgaben-Fenster, sonst die Aufgaben-Seite. */
export function taskHref(t: Pick<ClientTask, 'key' | 'submissionId'>): string {
  return t.submissionId ? `/dashboard/candidates/${t.submissionId}?aufgabe=${encodeURIComponent(t.key)}` : `/dashboard/aufgaben?aufgabe=${encodeURIComponent(t.key)}`;
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import i18n from '@/i18n';
import { callFunction } from '@/lib/interviewScheduling';
import type {
  BillingView, ConditionsResponse, CreditNotesResponse, JobTerms, OverviewResponse, PlacementWindowView, TaxMode,
} from '../../supabase/functions/_shared/abrechnung-view';

/**
 * Headhunter: Verdienste, Gutschriften, Abrechnungsdaten (Umbau 11.11.2026).
 * Aufrufe der Function `abrechnung`; Ansicht und Texte rechnet der Server mit
 * _shared/abrechnung-view.ts, Beträge mit _shared/konditionen.ts.
 */

// Rückfall-Meldung in der Sprache der Oberfläche, gelesen beim Aufruf (nicht beim Laden des Moduls).
const tx = (key: string): string => i18n.t(`recruiterEarnings:api.${key}`);

// Texte der Ansicht kommen vom Server in der Sprache der Oberfläche (body.lang).
const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) =>
  callFunction<T>('abrechnung', { action, ...body, lang: i18n.language }, fallback);

export interface PlacementResponse { view: PlacementWindowView; taxMode: TaxMode | null }

export const abrechnungApi = {
  overview: () => call<OverviewResponse>('overview', {}, tx('overview')),
  placement: (ref: { placementId?: string; submissionId?: string; taskId?: string }) => call<PlacementResponse>('placement', ref, tx('placement')),
  reportStart: (input: { placementId?: string; taskId?: string; way: 'started' | 'later' | 'not_started'; startedOn?: string; startDate?: string; note?: string }) =>
    call<PlacementResponse & { ok: boolean; state: string }>('report_start', input, tx('reportStart')),
  halfway: (input: { placementId?: string; taskId?: string; status: 'ok' | 'shaky'; note?: string }) =>
    call<PlacementResponse & { ok: boolean }>('halfway', input, tx('halfway')),
  statement: (placementId: string, statement: string) => call<PlacementResponse & { ok: boolean }>('statement', { placementId, statement }, tx('statement')),
  jobTerms: (jobIds: string[]) => call<{ terms: JobTerms[] }>('job_terms', { jobIds }),
  conditions: () => call<ConditionsResponse>('conditions'),
  consent: () => call<ConditionsResponse>('consent', {}, tx('consent')),
  creditNotes: () => call<CreditNotesResponse>('credit_notes', {}, tx('creditNotes')),
  creditNoteFile: (creditNoteId: string) => call<{ url: string; number: string }>('credit_note_file', { creditNoteId }, tx('creditNoteFile')),
  creditNotesExport: (year: string) => call<{ year: string; count: number; csv: string; files: { number: string; url: string }[] }>('credit_notes_export', { year }, tx('export')),
  objection: (creditNoteId: string, topic: string, note: string) => call<{ ok: boolean }>('objection', { creditNoteId, topic, note }, tx('objection')),
  billing: () => call<{ billing: BillingView }>('billing_profile', {}, tx('billing')),
  saveBilling: (billing: { legalName: string; legalForm: string; street: string; postalCode: string; city: string; country: string; taxMode: TaxMode; vatId: string; taxNumber: string }) =>
    call<{ ok: boolean; billing: BillingView }>('billing_profile', { save: true, billing }, tx('saveBilling')),
  accountRequest: (input: { holder: string; iban: string; bic: string }) =>
    call<{ ok: boolean; sent: boolean; sentTo: string; expiresAt: string; firstSetup: boolean }>('account_change_request', input, tx('accountRequest')),
  accountConfirm: (code: string) => call<{ ok: boolean; immediate: boolean; effectiveAt: string; billing: BillingView }>('account_change_confirm', { code }, tx('accountConfirm')),
  accountCancel: () => call<{ ok: boolean; billing: BillingView }>('account_change_cancel', {}, tx('accountCancel')),
  selfBillingObjection: () => call<{ ok: boolean; billing: BillingView }>('self_billing_objection', {}, tx('selfBillingObjection')),
  clientReport: (jobId: string, topic: string, note: string) => call<{ ok: boolean; reportedAt: string }>('client_report', { jobId, topic, note }, tx('clientReport')),
};

// ---------------------------------------------------------------------------
// Konditionen je Stelle: viele Karten, eine Anfrage (gesammelt für 20 ms)
// ---------------------------------------------------------------------------

type Waiter = (t: JobTerms | null) => void;
let queue = new Map<string, Waiter[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  const batch = queue;
  queue = new Map();
  timer = null;
  const ids = [...batch.keys()];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    let terms: JobTerms[] = [];
    try { terms = (await abrechnungApi.jobTerms(chunk)).terms ?? []; } catch { terms = []; }
    for (const id of chunk) {
      const t = terms.find((x) => x.jobId === id) ?? null;
      for (const w of batch.get(id) ?? []) w(t);
    }
  }
}

/** Konditionen einer Stelle; null, wenn unbekannt (dann bleibt die bisherige Anzeige). */
export function loadJobTerms(jobId: string): Promise<JobTerms | null> {
  return new Promise((resolve) => {
    queue.set(jobId, [...(queue.get(jobId) ?? []), resolve]);
    if (!timer) timer = setTimeout(() => { void flush(); }, 20);
  });
}

export function useJobTerms(jobId: string | null | undefined) {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['job-terms', user?.id, jobId],
    queryFn: () => loadJobTerms(jobId!),
    enabled: !!jobId && !!user && role === 'recruiter',
    staleTime: 5 * 60_000,
  });
}

/** Verdienste-Übersicht (auch für die Kachel im Dashboard). */
export function useVerdienste() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['verdienste', user?.id, i18n.language],
    queryFn: abrechnungApi.overview,
    enabled: !!user && role === 'recruiter',
    staleTime: 60_000,
    retry: false,
  });
}

/** H1: Hinweis auf neue Konditionen (nur mit Stichtag und ohne Zustimmung). */
export function useConditionsNotice() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['konditionen-hinweis', user?.id, i18n.language],
    queryFn: abrechnungApi.conditions,
    enabled: !!user && role === 'recruiter',
    staleTime: 10 * 60_000,
    retry: false,
  });
}

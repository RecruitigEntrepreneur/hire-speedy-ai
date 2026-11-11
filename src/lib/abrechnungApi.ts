import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callFunction } from '@/lib/interviewScheduling';
import type {
  BillingView, ConditionsResponse, CreditNotesResponse, JobTerms, OverviewResponse, PlacementWindowView, TaxMode,
} from '../../supabase/functions/_shared/abrechnung-view';

/**
 * Headhunter: Verdienste, Gutschriften, Abrechnungsdaten (Umbau 11.11.2026).
 * Aufrufe der Function `abrechnung`; Ansicht und Texte rechnet der Server mit
 * _shared/abrechnung-view.ts, Beträge mit _shared/konditionen.ts.
 */

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) =>
  callFunction<T>('abrechnung', { action, ...body }, fallback);

export interface PlacementResponse { view: PlacementWindowView; taxMode: TaxMode | null }

export const abrechnungApi = {
  overview: () => call<OverviewResponse>('overview', {}, 'Deine Verdienste konnten nicht geladen werden.'),
  placement: (ref: { placementId?: string; submissionId?: string; taskId?: string }) => call<PlacementResponse>('placement', ref, 'Die Besetzung konnte nicht geladen werden.'),
  reportStart: (input: { placementId?: string; taskId?: string; way: 'started' | 'later' | 'not_started'; startedOn?: string; startDate?: string; note?: string }) =>
    call<PlacementResponse & { ok: boolean; state: string }>('report_start', input, 'Deine Meldung konnte nicht gespeichert werden.'),
  halfway: (input: { placementId?: string; taskId?: string; status: 'ok' | 'shaky'; note?: string }) =>
    call<PlacementResponse & { ok: boolean }>('halfway', input, 'Deine Antwort konnte nicht gespeichert werden.'),
  statement: (placementId: string, statement: string) => call<PlacementResponse & { ok: boolean }>('statement', { placementId, statement }, 'Deine Stellungnahme konnte nicht gespeichert werden.'),
  jobTerms: (jobIds: string[]) => call<{ terms: JobTerms[] }>('job_terms', { jobIds }),
  conditions: () => call<ConditionsResponse>('conditions'),
  consent: () => call<ConditionsResponse>('consent', {}, 'Deine Zustimmung konnte nicht gespeichert werden.'),
  creditNotes: () => call<CreditNotesResponse>('credit_notes', {}, 'Die Gutschriften konnten nicht geladen werden.'),
  creditNoteFile: (creditNoteId: string) => call<{ url: string; number: string }>('credit_note_file', { creditNoteId }, 'Das PDF ist gerade nicht abrufbar.'),
  creditNotesExport: (year: string) => call<{ year: string; count: number; csv: string; files: { number: string; url: string }[] }>('credit_notes_export', { year }, 'Der Export hat nicht geklappt.'),
  objection: (creditNoteId: string, topic: string, note: string) => call<{ ok: boolean }>('objection', { creditNoteId, topic, note }, 'Dein Einwand konnte nicht gesendet werden.'),
  billing: () => call<{ billing: BillingView }>('billing_profile', {}, 'Deine Abrechnungsdaten konnten nicht geladen werden.'),
  saveBilling: (billing: { legalName: string; legalForm: string; street: string; postalCode: string; city: string; country: string; taxMode: TaxMode; vatId: string; taxNumber: string }) =>
    call<{ ok: boolean; billing: BillingView }>('billing_profile', { save: true, billing }, 'Deine Abrechnungsdaten konnten nicht gespeichert werden.'),
  accountRequest: (input: { holder: string; iban: string; bic: string }) =>
    call<{ ok: boolean; sent: boolean; sentTo: string; expiresAt: string; firstSetup: boolean }>('account_change_request', input, 'Der Code konnte nicht verschickt werden.'),
  accountConfirm: (code: string) => call<{ ok: boolean; immediate: boolean; effectiveAt: string; billing: BillingView }>('account_change_confirm', { code }, 'Das Konto konnte nicht bestätigt werden.'),
  accountCancel: () => call<{ ok: boolean; billing: BillingView }>('account_change_cancel', {}, 'Die Änderung konnte nicht abgebrochen werden.'),
  selfBillingObjection: () => call<{ ok: boolean; billing: BillingView }>('self_billing_objection', {}, 'Dein Widerspruch konnte nicht gespeichert werden.'),
  clientReport: (jobId: string, topic: string, note: string) => call<{ ok: boolean; reportedAt: string }>('client_report', { jobId, topic, note }, 'Deine Meldung konnte nicht gesendet werden.'),
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
    queryKey: ['verdienste', user?.id],
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
    queryKey: ['konditionen-hinweis', user?.id],
    queryFn: abrechnungApi.conditions,
    enabled: !!user && role === 'recruiter',
    staleTime: 10 * 60_000,
    retry: false,
  });
}

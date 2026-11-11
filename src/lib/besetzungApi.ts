import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callFunction } from '@/lib/interviewScheduling';

/**
 * Kunden-Seite „Besetzungen“ (Etappe 2, 25.10.2026; Umbau 11.11.2026): Typen und Aufrufe der
 * Function placement (client_overview, Antritt, „Besetzung endet“, Nachbesetzung, Angebot).
 * Daten und Regeln: besetzung-service.ts, Kern der Nachbesetzung: nachbesetzung.ts.
 */

export type BesetzungGroup = 'angebot' | 'start' | 'haus' | 'ab';
export type Dran = 'client' | 'recruiter' | 'candidate' | null;
export type EndOutcome = 'claim' | 'client_sphere' | 'core' | 'outside' | 'late';
export type ResearchState = 'awaiting_position' | 'awaiting_payment' | 'running' | 'paused' | 'succeeded' | 'exhausted' | 'cancelled' | string;

export interface BesetzungPlacement {
  id: string; state: string; startDate: string | null; startConfirmedAt: string | null; startMovedAt: string | null;
  startFixedAt: string | null; startFixedHow: string | null;
  /** Meldung des Headhunters zum Antritt (H7) */
  startReport: { kind: 'started' | 'later' | 'not_started'; on: string | null; at: string | null; byName: string | null; contestedAt: string | null; fixesOn: string | null } | null;
  nonStartReportedAt: string | null; nonStartReason: string | null; nonStartDocument: boolean;
  continuityEnd: string | null; reportUntil: string | null; coreUntil: string | null;
  departure: { category: string; label: string | null; eventOn: string | null; lastDay: string | null; knownOn: string | null } | null;
  /** „Besetzung endet“ (K5), vor oder nach dem Start */
  end: {
    kind: 'non_start' | 'departure'; reason: string | null; label: string; reportedAt: string | null; knownOn: string | null; lastDay: string | null;
    reviewUntil: string | null; outcome: EndOutcome | null; documents: number;
  } | null;
  claim: { status: string; kind: string; deadline: string | null; reportedAt: string | null; decidedAt: string | null; reviewUntil: string | null; clientSphere: boolean; rejectionReason: string | null } | null;
  /** Nachbesetzung (K6) */
  research: {
    state: ResearchState; kind: 'continuity' | 'joker' | null; startedAt: string | null; endedAt: string | null; endReason: string | null; jobId: string;
    days: number | null; recruiters: number; submissions: number; fresh: number; paused: boolean;
    replacement: { submissionId: string; name: string } | null;
  } | null;
  /** Angebot einer Nachbesetzung bei Core (J2/J3) */
  offer: { status: 'open' | 'accepted' | 'declined' | 'expired' | 'none'; priceCents: number | null; validUntil: string | null; decidedAt: string | null; answeredAt: string | null } | null;
  researchInvoice: { id: string; number: string | null; status: string; totalCents: number | null; dueDate: string | null; paidAt: string | null } | null;
  /** Ersatzbesetzung: „Nachbesetzung für …“ */
  replaces: { submissionId: string; name: string } | null;
  jobStatus: string | null;
  jobPaused: boolean;
  purchaseOrder: string | null; costCenter: string | null;
}

export interface BesetzungCan {
  moveStart: boolean;
  /** „Hat … angefangen?“ (Kunde meldet zuerst) */
  startCheck: boolean;
  /** „… Start bestätigen“ (Headhunter hat zuerst gemeldet) */
  answerStart: boolean;
  /** Headhunter meldet: hat vor dem Start abgesagt → K5 mit „Nein“ */
  confirmEnd: boolean;
  endReport: boolean;
  endDocument: boolean;
  purchaseOrder: boolean;
  confirmPosition: boolean;
  endResearch: boolean;
  answerOffer: boolean;
  reopenJob: boolean;
}

export interface BesetzungItem {
  submissionId: string;
  group: BesetzungGroup;
  name: string;
  unlocked: boolean;
  jobId: string;
  jobTitle: string;
  recruiterName: string | null;
  dran: Dran;
  offer: {
    id: string; version: number; status: string; salary: number | null; variable: number | null; startDate: string | null;
    responseDue: string | null; overdue: boolean; probationMonths: number | null;
    wish: { salary?: number | null; startDate?: string | null; other?: string | null } | null;
  } | null;
  contract: { id: string; status: string; way: string | null; signingMode: string; sentAt: string | null; companySignedAt: string | null; signedOn: string | null } | null;
  placement: BesetzungPlacement | null;
  package: { key: string; name: string; pct: number; continuityDays: number | null; replacement?: boolean };
  grossCents: number | null;
  feeCents: number | null;
  invoice: { id: string; number: string | null; status: string; totalCents: number | null; openCents?: number; dueDate: string | null; paidAt: string | null; reportedPaidOn: string | null; overdue: boolean } | null;
  can: BesetzungCan | null;
  events: { at: string; text: string }[];
}

export interface BesetzungOverview {
  items: BesetzungItem[];
  counts: Record<BesetzungGroup, number>;
  kpis: { placedThisYear: number; openInvoiceCents: number; nextStart: { date: string; name: string } | null };
}

export interface ReportEndInput {
  placementId: string;
  /** Antwort auf „Hat … schon angefangen?“ */
  started: boolean;
  reason: string;
  knownOn: string;
  lastDay?: string | null;
  note?: string;
}

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('placement', { action, ...body }, fallback);

export const besetzungApi = {
  overview: () => call<BesetzungOverview>('client_overview'),
  moveStart: (placementId: string, startDate: string, note: string) =>
    call<{ ok: true; startDate: string }>('move_start', { placementId, startDate, note }, 'Der neue Starttermin konnte nicht gespeichert werden.'),
  /** K7: started = „Ja, hat angefangen“, later = „Fängt später an“, agree/disagree = „Stimmt“ / „Stimmt so nicht“ */
  startAnswer: (input: { placementId: string; way: 'started' | 'later' | 'agree' | 'disagree'; startedOn?: string; startDate?: string; note?: string }) =>
    call<{ ok: true; state: string }>('start_answer', input, 'Der Antritt konnte nicht gespeichert werden.'),
  /** K5 „Besetzung endet“ */
  reportEnd: (input: ReportEndInput) =>
    call<{ ok: true; outcome: EndOutcome; kind: 'non_start' | 'departure'; reviewUntil: string | null }>('report_end', { ...input }, 'Die Meldung konnte nicht gespeichert werden.'),
  endDocument: (placementId: string, fileName: string, fileBase64: string) =>
    call<{ ok: true }>('end_document', { placementId, fileName, fileBase64 }, 'Die Datei konnte nicht hochgeladen werden.'),
  confirmPosition: (placementId: string, changed: boolean) =>
    call<{ ok: true; state: string }>('confirm_research_position', { placementId, changed }, 'Die Bestätigung konnte nicht gespeichert werden.'),
  endResearch: (placementId: string, note?: string) =>
    call<{ ok: true }>('end_research', { placementId, note }, 'Die Nachbesetzung konnte nicht beendet werden.'),
  answerOffer: (placementId: string, accept: boolean) =>
    call<{ ok: true; state: string; invoiceId?: string | null; released?: boolean }>('answer_research_offer', { placementId, accept }, 'Die Antwort konnte nicht gespeichert werden.'),
  reopenJob: (placementId: string) =>
    call<{ ok: true; jobId: string; already?: boolean }>('reopen_job', { placementId }, 'Die Stelle konnte nicht geöffnet werden.'),
  setPurchaseOrder: (placementId: string, purchaseOrder: string, costCenter: string) =>
    call<{ ok: true }>('set_purchase_order', { placementId, purchaseOrder, costCenter }, 'Die Bestellnummer konnte nicht gespeichert werden.'),
};

/** Besetzungen des angemeldeten Kunden (ganzes Team, das die Stellen sieht). */
export function useBesetzungen() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['besetzungen', user?.id],
    queryFn: besetzungApi.overview,
    enabled: !!user && role === 'client',
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** Datei als Base64 (ohne „data:…;base64,“). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Die Datei ließ sich nicht lesen.'));
    r.readAsDataURL(file);
  });
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callFunction } from '@/lib/interviewScheduling';

/**
 * Kunden-Seite „Besetzungen“ (Etappe 2, 25.10.2026): Typen und Aufrufe der Function
 * placement (client_overview und Meldungen). Daten und Regeln: besetzung-service.ts.
 */

export type BesetzungGroup = 'angebot' | 'start' | 'haus' | 'ab';
export type Dran = 'client' | 'recruiter' | 'candidate' | null;

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
  placement: {
    id: string; state: string; startDate: string | null; startConfirmedAt: string | null; startMovedAt: string | null;
    nonStartReportedAt: string | null; nonStartReason: string | null; nonStartDocument: boolean;
    continuityEnd: string | null; reportUntil: string | null; coreUntil: string | null;
    departure: { category: string; label: string | null; eventOn: string | null; lastDay: string | null; knownOn: string | null } | null;
    claim: { status: string; deadline: string | null } | null;
    purchaseOrder: string | null; costCenter: string | null;
  } | null;
  package: { key: string; name: string; pct: number; continuityDays: number | null };
  grossCents: number | null;
  feeCents: number | null;
  invoice: { id: string; number: string | null; status: string; totalCents: number | null; dueDate: string | null; paidAt: string | null; reportedPaidOn: string | null; overdue: boolean } | null;
  can: { moveStart: boolean; nonStart: boolean; nonStartDocument: boolean; departure: boolean; purchaseOrder: boolean } | null;
  events: { at: string; text: string }[];
}

export interface BesetzungOverview {
  items: BesetzungItem[];
  counts: Record<BesetzungGroup, number>;
  kpis: { placedThisYear: number; openInvoiceCents: number; nextStart: { date: string; name: string } | null };
}

export type DepartureOutcome = 'claim' | 'no_continuity' | 'excluded' | 'outside' | 'late';

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('placement', { action, ...body }, fallback);

export const besetzungApi = {
  overview: () => call<BesetzungOverview>('client_overview'),
  moveStart: (placementId: string, startDate: string, note: string) =>
    call<{ ok: true; startDate: string }>('move_start', { placementId, startDate, note }, 'Der neue Starttermin konnte nicht gespeichert werden.'),
  nonStartDocument: (placementId: string, fileName: string, fileBase64: string) =>
    call<{ ok: true }>('non_start_document', { placementId, fileName, fileBase64 }, 'Die Erklärung konnte nicht hochgeladen werden.'),
  reportDeparture: (input: { placementId: string; category: string; eventOn: string; lastDay: string; knownOn: string; note: string }) =>
    call<{ ok: true; outcome: DepartureOutcome; deadline: string | null }>('report_departure', input, 'Die Meldung konnte nicht gespeichert werden.'),
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

/** Gründe fürs Ausscheiden (wie DEPARTURE_CATEGORIES im Server), gruppiert fürs Fenster. */
export const DEPARTURE_GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  { title: 'Die Person hat gekündigt', items: [
    { key: 'candidate_resigned', label: 'hat selbst gekündigt' },
    { key: 'candidate_terminated_probation', label: 'hat in der Probezeit gekündigt' },
  ] },
  { title: 'Wir haben gekündigt', items: [
    { key: 'employer_performance', label: 'Leistung' },
    { key: 'employer_fit', label: 'passt nicht ins Team' },
    { key: 'employer_terminated_probation', label: 'in der Probezeit' },
    { key: 'redundancy', label: 'betriebsbedingt' },
  ] },
  { title: 'Aufhebung oder Sonstiges', items: [
    { key: 'mutual_separation_probation', label: 'auf Wunsch der Person (Probezeit)' },
    { key: 'restructuring', label: 'Umstrukturierung' },
    { key: 'position_eliminated', label: 'Stelle fällt weg' },
    { key: 'role_materially_changed', label: 'Stelle wesentlich geändert' },
    { key: 'other', label: 'anderer Grund' },
  ] },
];

/** Datei als Base64 (ohne „data:…;base64,“). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error('Die Datei ließ sich nicht lesen.'));
    r.readAsDataURL(file);
  });
}

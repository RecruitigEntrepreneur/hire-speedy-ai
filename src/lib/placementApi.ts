import { callFunction } from '@/lib/interviewScheduling';

/** Einstellung und Rechnung (Paket 4a, 22.10.2026): Aufrufe der Function placement. */

export interface BesetzungRow {
  placementId: string; submissionId: string; candidateName: string; companyName: string; jobTitle: string;
  recruiterName: string | null; packageKey: string | null; startDate: string | null;
  placementState: string; invoiceState: string;
  clientFeeCents: number | null; recruiterInitialCents: number | null; recruiterRetentionCents: number | null; matchuntCents: number | null;
  invoice: { id: string; number: string | null; status: string; totalCents: number; dueDate: string | null; overdue: boolean } | null;
  next: { key: string; label: string };
}

export interface InvoiceRow {
  id: string; number: string | null; status: string; type: string; issuedAt: string | null; dueDate: string | null;
  totalCents: number; paidCents: number | null; recipient: string | null; email: string | null; sentAt: string | null; hasPdf: boolean; overdue: boolean;
}

export interface AdminOverview {
  rows: BesetzungRow[];
  invoices: InvoiceRow[];
  kpis: { openCents: number; overdueCents: number; drafts: number };
  blockers: string[];
}

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('placement', { action, ...body }, fallback);

export const placementApi = {
  overview: () => call<AdminOverview>('admin_overview'),
  preview: (invoiceId: string) => call<{ pdfBase64: string; blockers: string[] }>('invoice_preview', { invoiceId }),
  release: (invoiceId: string, email: string) => call<{ ok: true; number: string; sent: boolean; mailError: string | null }>('release_invoice', { invoiceId, email }, 'Die Rechnung konnte nicht freigegeben werden.'),
  bookPayment: (invoiceId: string, paidOn: string, amountCents: number, note: string) => call<{ ok: true; status: string }>('book_payment', { invoiceId, paidOn, amountCents, note }),
  file: (invoiceId: string) => call<{ url: string }>('invoice_file', { invoiceId }),
};

export const eurCents = (c: number | null | undefined) => (c == null ? '–' : `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100)} €`);
export const PACKAGE_SHORT: Record<string, string> = { core: 'Core', continuity_90: 'C90', continuity_180: 'C180' };
export const INVOICE_STATUS: Record<string, string> = { draft: 'Entwurf', open: 'offen', partially_paid: 'teilweise bezahlt', paid: 'bezahlt', cancelled: 'storniert', pending: 'offen' };

export function pdfBlobUrl(base64: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { callFunction } from '@/lib/interviewScheduling';

/**
 * Kunden-Bereich „Rechnungen“ (Etappe 3, 25.10.2026; Umbau 11.11.2026 K9–K12): Typen und
 * Aufrufe der Function placement (client_invoices, invoice_files, billing_settings).
 * Regeln: billing-service.ts. Überweisung melden und Frage zur Rechnung laufen über
 * clientTasksApi (Aufgabe 15). Anzeige-Logik: components/rechnungen/invoiceView.ts.
 */

export interface InvoiceLine { title: string; details?: string[]; amountCents?: number; serviceOn?: string | null }

export interface ClientInvoice {
  id: string;
  number: string;
  type: string;
  status: string;
  issuedAt: string | null;
  serviceOn: string | null;
  dueDate: string | null;
  netCents: number;
  vatCents: number;
  totalCents: number;
  vatRate: number | null;
  reverseCharge: boolean;
  /** 'domestic' | 'reverse_charge' | 'not_taxable' */
  taxCase: string | null;
  paidCents: number;
  /** Noch offen (nach Teilzahlungen) */
  restCents: number;
  paidAt: string | null;
  reportedPaidOn: string | null;
  overdue: boolean;
  open: boolean;
  /** Erinnerung 7 Tage nach Fälligkeit (K13) */
  reminderSentAt: string | null;
  dunningLevel: number;
  payments: { date: string | null; amountCents: number; source: string }[];
  purchaseOrder: string | null;
  /** Rechnung mit „Bestellnummer folgt“ gestellt */
  poFollows: boolean;
  costCenter: string | null;
  jobTitle: string | null;
  candidateName: string | null;
  /** null für die Rolle Buchhaltung (sieht keine Bewerberprofile) */
  submissionId: string | null;
  recipient: { name?: string | null; street?: string | null; city?: string | null; vatId?: string | null; email?: string | null } | null;
  sentAt: string | null;
  sentTo: string | null;
  hasPdf: boolean;
  lines: InvoiceLine[];
  correctsInvoiceId: string | null;
  correctsNumber: string | null;
  cancelledAt: string | null;
  cancelledByNumber: string | null;
  /** Verlauf: gestellt, Zahlungen, fällig, Erinnerung, Mahnungen, Storno */
  events: { at: string; text: string }[];
}

export interface BillingSettings {
  name: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  /** Land der Rechnungsanschrift (ISO, z. B. DE); bestimmt die Steuer */
  country: string | null;
  countryName: string | null;
  taxId: string | null;
  billingEmail: string | null;
  ccEmails: string[];
  purchaseOrderRequired: boolean;
  defaultCostCenter: string | null;
  paymentTermsDays: number;
  tax: { taxCase: string; label: string; missing: string | null };
  countries: { code: string; name: string }[];
  format: string;
  /** nur, wenn die Bankverbindung vollständig hinterlegt ist */
  bank: { holder: string; iban: string; bic: string | null; bank: string | null } | null;
}

export interface ClientInvoices {
  canSee: boolean;
  canManage: boolean;
  financeOnly: boolean;
  settings: BillingSettings;
  invoices: ClientInvoice[];
  /** Jede Buchung einzeln, auch Teilzahlungen */
  payments: { date: string; invoiceId: string; number: string; amountCents: number; partial: boolean; key: string }[];
  totals: { openCents: number; overdueCents: number; paidYearCents: number; openCount: number; nextDue: string | null; lastReminderAt: string | null };
}

export type BillingSettingsInput = Partial<Pick<BillingSettings, 'name' | 'street' | 'postalCode' | 'city' | 'country' | 'taxId' | 'billingEmail' | 'ccEmails' | 'purchaseOrderRequired' | 'defaultCostCenter'>>;

const call = <T,>(action: string, body: Record<string, unknown> = {}, fallback?: string) => callFunction<T>('placement', { action, ...body }, fallback);

export const billingApi = {
  list: () => call<ClientInvoices>('client_invoices'),
  files: (invoiceIds: string[]) => call<{ files: { id: string; number: string; url: string }[] }>('invoice_files', { invoiceIds }),
  saveSettings: (input: BillingSettingsInput) => call<{ ok: true; settings: BillingSettings }>('billing_settings', input, 'Die Rechnungsdaten konnten nicht gespeichert werden.'),
};

/** Rechnungen des angemeldeten Kunden; auch für den Menüpunkt (canSee, offene Belege). */
export function useClientInvoices() {
  const { user, role } = useAuth();
  return useQuery({
    queryKey: ['client-invoices', user?.id],
    queryFn: billingApi.list,
    enabled: !!user && role === 'client',
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

const eurFmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eurCents = (c: number | null | undefined) => (c == null ? '–' : `${eurFmt.format(c / 100)} €`);

/** Kennung am Dateianfang, damit Excel die CSV als UTF-8 liest. */
const BOM = String.fromCharCode(0xfeff);

/** CSV für Excel (Semikolon, deutsches Zahlenformat, UTF-8 mit BOM). */
export function invoicesCsv(rows: ClientInvoice[], recipientName: string | null): string {
  const n = (c: number) => eurFmt.format(c / 100);
  const d = (iso: string | null) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');
  const q = (v: unknown) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ['Belegnummer', 'Art', 'Rechnungsdatum', 'Leistungsdatum', 'Empfänger', 'USt-ID', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Noch offen', 'Fällig', 'Bezahlt am', 'Status', 'Bestellnummer', 'Kostenstelle', 'Stelle', 'Kandidat/in', 'Bezug'];
  const art = (t: string) => (t === 'cancellation' ? 'Storno' : t === 'credit_note' ? 'Gutschrift' : 'Rechnung');
  const lines = rows.map((r) => [
    r.number, art(r.type), d(r.issuedAt), d(r.serviceOn), r.recipient?.name ?? recipientName ?? '', r.recipient?.vatId ?? '',
    n(r.netCents), r.reverseCharge || r.taxCase === 'reverse_charge' ? '0 % (Reverse Charge)' : r.taxCase === 'not_taxable' ? '0 % (nicht steuerbar)' : `${r.vatRate ?? 19} %`, n(r.vatCents), n(r.totalCents),
    r.open ? n(r.restCents ?? r.totalCents) : '', d(r.dueDate), d(r.paidAt),
    r.status === 'paid' ? 'bezahlt' : r.status === 'cancelled' ? 'storniert' : r.overdue ? 'überfällig' : r.status === 'partially_paid' ? 'teilweise bezahlt' : r.open ? 'offen' : r.status,
    r.purchaseOrder ?? (r.poFollows ? 'folgt' : ''), r.costCenter ?? '', r.jobTitle ?? '', r.candidateName ?? '', r.correctsNumber ?? r.cancelledByNumber ?? '',
  ].map(q).join(';'));
  return `${BOM}${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

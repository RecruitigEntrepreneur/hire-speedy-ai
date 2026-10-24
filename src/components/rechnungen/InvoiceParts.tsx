import { cn } from '@/lib/utils';
import { eurCents, type ClientInvoice } from '@/lib/billingApi';

/** Bausteine des Bereichs „Rechnungen“ (Etappe 3, 25.10.2026): Status, Zeile, Datum. */

export const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
const dayMonth = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '–');

export function statusText(i: ClientInvoice): { text: string; tone: 'good' | 'warn' | 'bad' | 'neutral' } {
  if (i.status === 'paid') return { text: `bezahlt ${dayMonth(i.paidAt)}`, tone: 'good' };
  if (i.status === 'cancelled') return { text: 'storniert', tone: 'neutral' };
  if (i.reportedPaidOn) return { text: 'Zahlung wird geprüft', tone: 'neutral' };
  if (i.overdue) return { text: `überfällig seit ${dayMonth(i.dueDate)}`, tone: 'bad' };
  if (i.status === 'partially_paid') return { text: 'teilweise bezahlt', tone: 'warn' };
  return { text: `offen bis ${dayMonth(i.dueDate)}`, tone: 'warn' };
}

const TONE = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-destructive/10 text-destructive',
  neutral: 'border border-border bg-muted/40 text-muted-foreground',
};

export function InvoiceStatus({ invoice }: { invoice: ClientInvoice }) {
  const s = statusText(invoice);
  return <span className={cn('inline-flex shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', TONE[s.tone])}>{s.text}</span>;
}

export function InvoiceHeader() {
  return (
    <div className="hidden grid-cols-[110px_minmax(0,1fr)_120px_150px] gap-3 px-3 pb-1 text-xs text-muted-foreground sm:grid">
      <span>Beleg</span><span>Für</span><span className="text-right">Brutto</span><span className="text-right">Status</span>
    </div>
  );
}

export function InvoiceRow({ invoice: i, onOpen }: { invoice: ClientInvoice; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/30 sm:grid-cols-[110px_minmax(0,1fr)_120px_150px] sm:items-center">
      <span><span className="font-medium">{i.number}</span><span className="block text-xs text-muted-foreground">{dateDe(i.issuedAt)}</span></span>
      <span className="col-span-2 min-w-0 sm:col-span-1">
        <span className="block truncate">{[i.candidateName, i.jobTitle].filter(Boolean).join(' · ') || 'Personalvermittlung'}</span>
        <span className="block truncate text-xs text-muted-foreground">Best.-Nr. {i.purchaseOrder ?? '–'}{i.costCenter ? ` · Kostenstelle ${i.costCenter}` : ''}</span>
      </span>
      <span className="tabular-nums sm:text-right">{eurCents(i.totalCents)}<span className="block text-xs text-muted-foreground">{eurCents(i.netCents)} netto</span></span>
      <span className="sm:text-right"><InvoiceStatus invoice={i} /></span>
    </button>
  );
}

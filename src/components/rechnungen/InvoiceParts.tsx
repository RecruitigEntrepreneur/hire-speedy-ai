import { cn } from '@/lib/utils';
import type { ClientInvoice } from '@/lib/billingApi';
import { amountOf, forLine, invoiceState, orderLine } from './invoiceView';

/**
 * Bausteine des Bereichs „Rechnungen“ (Etappe 3, 25.10.2026; ruhiger seit 11.11.2026, K9):
 * keine Farbpillen mehr, nur Überfälliges ist farbig; Teilzahlungen sind sichtbar.
 */

/** Zustand als Text (statt Pille); rot nur bei „überfällig“. */
export function InvoiceStatus({ invoice, className }: { invoice: ClientInvoice; className?: string }) {
  const s = invoiceState(invoice);
  return (
    <span className={cn('text-xs', s.tone === 'bad' ? 'font-medium text-destructive' : s.tone === 'muted' ? 'text-muted-foreground' : 'text-foreground', className)}>
      {s.text}
      {s.sub && <span className="block font-normal text-muted-foreground">{s.sub}</span>}
    </span>
  );
}

export function InvoiceHeader() {
  return (
    <div className="hidden grid-cols-[120px_minmax(0,1fr)_150px_160px] gap-3 px-3 pb-1 text-xs text-muted-foreground sm:grid">
      <span>Beleg</span><span>Für</span><span className="text-right">Betrag</span><span className="text-right">Stand</span>
    </div>
  );
}

export function InvoiceRow({ invoice: i, onOpen }: { invoice: ClientInvoice; onOpen: () => void }) {
  const a = amountOf(i);
  return (
    <button type="button" onClick={onOpen} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/30 sm:grid-cols-[120px_minmax(0,1fr)_150px_160px] sm:items-center">
      <span><span className="font-medium">{i.number}</span><span className="block text-xs text-muted-foreground">{i.issuedAt ? `${i.issuedAt.slice(8, 10)}.${i.issuedAt.slice(5, 7)}.${i.issuedAt.slice(0, 4)}` : '–'}</span></span>
      <span className="col-span-2 min-w-0 sm:col-span-1">
        <span className="block truncate">{forLine(i)}</span>
        <span className="block truncate text-xs text-muted-foreground">{orderLine(i)}</span>
      </span>
      <span className="tabular-nums sm:text-right">{a.main}<span className="block text-xs text-muted-foreground">{a.sub}</span></span>
      <span className="sm:text-right"><InvoiceStatus invoice={i} /></span>
    </button>
  );
}

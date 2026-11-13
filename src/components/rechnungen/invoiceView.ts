import type { ClientInvoice, ClientInvoices } from '@/lib/billingApi';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { isGerman } from '@/lib/localeFormat';

// Texte in der Sprache der Oberfläche (clientInvoices), gelesen beim Aufruf (README Regel 7).
const ti = (key: string, options?: Record<string, unknown>): string => i18n.t(`clientInvoices:${key}`, options);

/**
 * Anzeige im Bereich „Rechnungen“ (Umbau 11.11.2026, K9–K11): ruhig, ohne Farbpillen.
 * Nur Überfälliges ist farbig (tone 'bad'). Teilzahlungen sichtbar („15.581,00 € offen ·
 * von 35.581,00 €“). Reine Funktionen (getestet in src/lib/invoiceView.test.ts).
 */

const fmt = () => new Intl.NumberFormat(intlLocale(i18n.language), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eurC = (c: number | null | undefined) => (c == null ? '–' : `${fmt().format(c / 100)} €`);
const isoDate = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
export const dateDe = (iso: string | null | undefined) => (!iso ? '–' : isGerman() ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
  : isoDate(iso).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }));
export const dayMonth = (iso: string | null | undefined) => (!iso ? '–' : isGerman() ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`
  : isoDate(iso).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', timeZone: 'UTC' }));

export type InvoiceTone = 'bad' | 'muted' | 'default';

/** Zustand in Worten, dazu (bei Überfälligem) die Erinnerung bzw. Mahnung. */
export function invoiceState(i: Pick<ClientInvoice, 'status' | 'paidAt' | 'reportedPaidOn' | 'overdue' | 'dueDate' | 'reminderSentAt' | 'dunningLevel' | 'open' | 'paidCents'>): { text: string; tone: InvoiceTone; sub: string | null } {
  if (i.status === 'paid') return { text: ti('state.paid', { date: dayMonth(i.paidAt) }), tone: 'muted', sub: null };
  if (i.status === 'cancelled') return { text: ti('state.cancelled'), tone: 'muted', sub: null };
  if (i.reportedPaidOn) return { text: ti('state.checking'), tone: 'muted', sub: ti('state.transferred', { date: dayMonth(i.reportedPaidOn) }) };
  if (i.overdue) {
    const sub = i.dunningLevel > 0 ? ti('state.dunning', { level: i.dunningLevel }) : i.reminderSentAt ? ti('state.reminder', { date: dayMonth(i.reminderSentAt) }) : null;
    return { text: ti('state.overdue', { date: dayMonth(i.dueDate) }), tone: 'bad', sub };
  }
  if (i.open && i.paidCents > 0) return { text: ti('state.partial', { date: dayMonth(i.dueDate) }), tone: 'default', sub: null };
  if (i.open) return { text: i.dueDate ? ti('state.due', { date: dayMonth(i.dueDate) }) : ti('state.open'), tone: 'default', sub: null };
  return { text: i.status, tone: 'muted', sub: null };
}

/** Betrag in der Zeile: bei Teilzahlung der Rest, darunter „von …“ */
export function amountOf(i: Pick<ClientInvoice, 'open' | 'paidCents' | 'restCents' | 'totalCents' | 'netCents'>): { main: string; sub: string } {
  if (i.open && i.paidCents > 0) return { main: ti('amount.rest', { amount: eurC(i.restCents) }), sub: ti('amount.of', { amount: eurC(i.totalCents) }) };
  return { main: eurC(i.totalCents), sub: ti('amount.net', { amount: eurC(i.netCents) }) };
}

/** „Best.-Nr. 4500123 · Kostenstelle 410“, „Best.-Nr. folgt“ */
export function orderLine(i: Pick<ClientInvoice, 'purchaseOrder' | 'poFollows' | 'costCenter'>): string {
  return `${ti('order', { label: ti('orderLabel'), value: i.purchaseOrder ?? (i.poFollows ? ti('common.follows') : '–') })}${i.costCenter ? ti('costCenter', { value: i.costCenter }) : ''}`;
}

const CORRECTION = ['credit_note', 'cancellation'];
export const isCorrection = (i: Pick<ClientInvoice, 'type'>) => CORRECTION.includes(i.type);

/** Für wen / wofür: „Tom Neumann · Vertriebsleiter Süd“, bei Korrekturen der Bezug. */
export function forLine(i: Pick<ClientInvoice, 'type' | 'candidateName' | 'jobTitle' | 'correctsNumber'>): string {
  const base = [i.candidateName, i.jobTitle].filter(Boolean).join(' · ') || ti('forDefault');
  if (i.type === 'cancellation') return i.correctsNumber ? ti('cancellationOf', { number: i.correctsNumber, base }) : ti('cancellation', { base });
  if (i.type === 'credit_note') return i.correctsNumber ? ti('correctionOf', { number: i.correctsNumber, base }) : ti('correction', { base });
  return base;
}

/** Zeile Steuer im Beleg-Fenster */
export function taxLine(i: Pick<ClientInvoice, 'taxCase' | 'reverseCharge' | 'vatRate'>): string {
  if (i.taxCase === 'reverse_charge' || i.reverseCharge) return ti('tax.reverseCharge');
  if (i.taxCase === 'not_taxable') return ti('tax.notTaxable');
  return ti('tax.vat', { rate: i.vatRate ?? 19 });
}

/** Unterzeilen der Kennzahlen (K9). */
export function kpiSubs(d: Pick<ClientInvoices, 'totals' | 'payments'>): { open: string; overdue: string | null; paid: string } {
  const t = d.totals;
  const docs = ti('kpi.docs', { count: t.openCount });
  const open = t.openCount
    ? (t.nextDue ? ti('kpi.nextDue', { docs, date: dayMonth(t.nextDue) }) : docs)
    : ti('kpi.nothingOpen');
  const overdue = t.overdueCents > 0 && t.lastReminderAt ? ti('kpi.reminderSent', { date: dayMonth(t.lastReminderAt) }) : null;
  const paid = d.payments.length ? (d.payments.some((p) => p.partial) ? ti('kpi.inclPartial') : ti('kpi.allPayments')) : ti('kpi.noPayment');
  return { open, overdue, paid };
}

/** Steuer-Hinweis unter dem Land (K12), live beim Ändern. */
const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'GR', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
export function taxHint(country: string | null | undefined, vatId: string | null | undefined): string {
  const c = String(country ?? '').trim().toUpperCase();
  const v = String(vatId ?? '').replace(/\s/g, '').toUpperCase();
  if (!c || c === 'DE') return ti('taxHint.de');
  if (EU.includes(c)) {
    return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v) && !v.startsWith('DE') ? ti('taxHint.euReverse') : ti('taxHint.euNeedsId');
  }
  return ti('taxHint.abroad');
}

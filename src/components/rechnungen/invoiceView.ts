import type { ClientInvoice, ClientInvoices } from '@/lib/billingApi';

/**
 * Anzeige im Bereich „Rechnungen“ (Umbau 11.11.2026, K9–K11): ruhig, ohne Farbpillen.
 * Nur Überfälliges ist farbig (tone 'bad'). Teilzahlungen sichtbar („15.581,00 € offen ·
 * von 35.581,00 €“). Reine Funktionen (getestet in src/lib/invoiceView.test.ts).
 */

const fmt = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const eurC = (c: number | null | undefined) => (c == null ? '–' : `${fmt.format(c / 100)} €`);
export const dateDe = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '–');
export const dayMonth = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : '–');

export type InvoiceTone = 'bad' | 'muted' | 'default';

/** Zustand in Worten, dazu (bei Überfälligem) die Erinnerung bzw. Mahnung. */
export function invoiceState(i: Pick<ClientInvoice, 'status' | 'paidAt' | 'reportedPaidOn' | 'overdue' | 'dueDate' | 'reminderSentAt' | 'dunningLevel' | 'open' | 'paidCents'>): { text: string; tone: InvoiceTone; sub: string | null } {
  if (i.status === 'paid') return { text: `bezahlt ${dayMonth(i.paidAt)}`, tone: 'muted', sub: null };
  if (i.status === 'cancelled') return { text: 'storniert', tone: 'muted', sub: null };
  if (i.reportedPaidOn) return { text: 'Zahlung wird geprüft', tone: 'muted', sub: `überwiesen ${dayMonth(i.reportedPaidOn)}` };
  if (i.overdue) {
    const sub = i.dunningLevel > 0 ? `${i.dunningLevel}. Mahnung gesendet` : i.reminderSentAt ? `Erinnerung gesendet ${dayMonth(i.reminderSentAt)}` : null;
    return { text: `überfällig seit ${dayMonth(i.dueDate)}`, tone: 'bad', sub };
  }
  if (i.open && i.paidCents > 0) return { text: `teilweise bezahlt · fällig ${dayMonth(i.dueDate)}`, tone: 'default', sub: null };
  if (i.open) return { text: i.dueDate ? `fällig ${dayMonth(i.dueDate)}` : 'offen', tone: 'default', sub: null };
  return { text: i.status, tone: 'muted', sub: null };
}

/** Betrag in der Zeile: bei Teilzahlung der Rest, darunter „von …“ */
export function amountOf(i: Pick<ClientInvoice, 'open' | 'paidCents' | 'restCents' | 'totalCents' | 'netCents'>): { main: string; sub: string } {
  if (i.open && i.paidCents > 0) return { main: `${eurC(i.restCents)} offen`, sub: `von ${eurC(i.totalCents)}` };
  return { main: eurC(i.totalCents), sub: `${eurC(i.netCents)} netto` };
}

/** „Best.-Nr. 4500123 · Kostenstelle 410“, „Best.-Nr. folgt“ */
export function orderLine(i: Pick<ClientInvoice, 'purchaseOrder' | 'poFollows' | 'costCenter'>): string {
  return `Best.-Nr. ${i.purchaseOrder ?? (i.poFollows ? 'folgt' : '–')}${i.costCenter ? ` · Kostenstelle ${i.costCenter}` : ''}`;
}

const CORRECTION = ['credit_note', 'cancellation'];
export const isCorrection = (i: Pick<ClientInvoice, 'type'>) => CORRECTION.includes(i.type);

/** Für wen / wofür: „Tom Neumann · Vertriebsleiter Süd“, bei Korrekturen der Bezug. */
export function forLine(i: Pick<ClientInvoice, 'type' | 'candidateName' | 'jobTitle' | 'correctsNumber'>): string {
  const base = [i.candidateName, i.jobTitle].filter(Boolean).join(' · ') || 'Personalvermittlung';
  if (i.type === 'cancellation') return `Storno${i.correctsNumber ? ` zu ${i.correctsNumber}` : ''} · ${base}`;
  if (i.type === 'credit_note') return `Korrektur${i.correctsNumber ? ` zu ${i.correctsNumber}` : ''} · ${base}`;
  return base;
}

/** Zeile Steuer im Beleg-Fenster */
export function taxLine(i: Pick<ClientInvoice, 'taxCase' | 'reverseCharge' | 'vatRate'>): string {
  if (i.taxCase === 'reverse_charge' || i.reverseCharge) return 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)';
  if (i.taxCase === 'not_taxable') return 'Nicht im Inland steuerbare Leistung';
  return `zzgl. ${i.vatRate ?? 19} % USt`;
}

/** Unterzeilen der Kennzahlen (K9). */
export function kpiSubs(d: Pick<ClientInvoices, 'totals' | 'payments'>): { open: string; overdue: string | null; paid: string } {
  const t = d.totals;
  const open = t.openCount
    ? `${t.openCount === 1 ? '1 Beleg' : `${t.openCount} Belege`}${t.nextDue ? ` · nächste Fälligkeit ${dayMonth(t.nextDue)}` : ''}`
    : 'nichts offen';
  const overdue = t.overdueCents > 0 && t.lastReminderAt ? `Erinnerung am ${dayMonth(t.lastReminderAt)} gesendet` : null;
  const paid = d.payments.length ? (d.payments.some((p) => p.partial) ? 'inkl. Teilzahlungen' : 'alle Zahlungen dieses Jahres') : 'noch keine Zahlung';
  return { open, overdue, paid };
}

/** Steuer-Hinweis unter dem Land (K12), live beim Ändern. */
const EU = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'GR', 'EL', 'ES', 'FI', 'FR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];
export function taxHint(country: string | null | undefined, vatId: string | null | undefined): string {
  const c = String(country ?? '').trim().toUpperCase();
  const v = String(vatId ?? '').replace(/\s/g, '').toUpperCase();
  if (!c || c === 'DE') return 'Auf Ihren Rechnungen: 19 % USt.';
  if (EU.includes(c)) {
    return /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(v) && !v.startsWith('DE')
      ? 'Auf Ihren Rechnungen: ohne deutsche USt (Reverse Charge, EU).'
      : 'Mit Ihrer USt-IdNr. rechnen wir ohne deutsche USt ab (Reverse Charge). Ohne sie: 19 % USt.';
  }
  return 'Auf Ihren Rechnungen: ohne USt (nicht im Inland steuerbar).';
}

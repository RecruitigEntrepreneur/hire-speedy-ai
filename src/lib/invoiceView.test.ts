import { describe, expect, it } from 'vitest';
import { amountOf, forLine, invoiceState, kpiSubs, orderLine, taxHint, taxLine } from '@/components/rechnungen/invoiceView';

// Rechnungen ruhig (Umbau 11.11.2026, K9–K12): keine Farbpillen, nur Überfälliges farbig,
// Teilzahlung sichtbar, Erinnerung (K13) angezeigt, Land bestimmt die Steuer.

const base = { status: 'open', paidAt: null, reportedPaidOn: null, overdue: false, dueDate: '2026-11-18', reminderSentAt: null, dunningLevel: 0, open: true, paidCents: 0 };

describe('Zustand (K9/K10)', () => {
  it('überfällig mit Erinnerung, als einziges rot', () => {
    expect(invoiceState({ ...base, overdue: true, dueDate: '2026-11-04', reminderSentAt: '2026-11-11T07:00:00Z', paidCents: 2_000_000 }))
      .toEqual({ text: 'überfällig seit 04.11.', tone: 'bad', sub: 'Erinnerung gesendet 11.11.' });
  });
  it('offen und bezahlt ohne Farbe', () => {
    expect(invoiceState(base)).toEqual({ text: 'fällig 18.11.', tone: 'default', sub: null });
    expect(invoiceState({ ...base, status: 'paid', open: false, paidAt: '2026-11-03T12:00:00Z' })).toEqual({ text: 'bezahlt 03.11.', tone: 'muted', sub: null });
    expect(invoiceState({ ...base, status: 'partially_paid', paidCents: 100 }).text).toBe('teilweise bezahlt · fällig 18.11.');
  });
  it('Mahnung geht vor Erinnerung', () => {
    expect(invoiceState({ ...base, overdue: true, reminderSentAt: '2026-11-11', dunningLevel: 1 }).sub).toBe('1. Mahnung gesendet');
  });
});

describe('Betrag und Bezug', () => {
  it('Teilzahlung: Rest offen, darunter der Gesamtbetrag', () => {
    expect(amountOf({ open: true, paidCents: 2_000_000, restCents: 1_558_100, totalCents: 3_558_100, netCents: 2_990_000 }))
      .toEqual({ main: '15.581,00 € offen', sub: 'von 35.581,00 €' });
    expect(amountOf({ open: true, paidCents: 0, restCents: 1_642_200, totalCents: 1_642_200, netCents: 1_380_000 }))
      .toEqual({ main: '16.422,00 €', sub: '13.800,00 € netto' });
  });
  it('Bestellnummer folgt', () => {
    expect(orderLine({ purchaseOrder: null, poFollows: true, costCenter: null })).toBe('Best.-Nr. folgt');
    expect(orderLine({ purchaseOrder: '4500123', poFollows: false, costCenter: '410' })).toBe('Best.-Nr. 4500123 · Kostenstelle 410');
  });
  it('Korrekturen mit Bezug zur Rechnung', () => {
    expect(forLine({ type: 'cancellation', candidateName: 'Tom Neumann', jobTitle: 'Vertriebsleiter Süd', correctsNumber: 'RE-2026-0148' }))
      .toBe('Storno zu RE-2026-0148 · Tom Neumann · Vertriebsleiter Süd');
    expect(forLine({ type: 'placement_fee', candidateName: null, jobTitle: null, correctsNumber: null })).toBe('Personalvermittlung');
  });
});

describe('Steuer (K12)', () => {
  it('Land bestimmt die Steuer', () => {
    expect(taxHint('DE', 'DE123')).toBe('Auf Ihren Rechnungen: 19 % USt.');
    expect(taxHint('AT', 'ATU12345678')).toContain('Reverse Charge');
    expect(taxHint('CH', null)).toContain('nicht im Inland steuerbar');
    expect(taxLine({ taxCase: 'not_taxable', reverseCharge: false, vatRate: 0 })).toBe('Nicht im Inland steuerbare Leistung');
  });
});

describe('Kennzahlen (K9)', () => {
  it('Unterzeilen wie im Wireframe', () => {
    const s = kpiSubs({
      totals: { openCents: 3_200_300, overdueCents: 1_558_100, paidYearCents: 8_842_500, openCount: 2, nextDue: '2026-11-18', lastReminderAt: '2026-11-11T07:00:00Z' },
      payments: [{ date: '2026-10-30', invoiceId: 'a', number: 'RE-2026-0148', amountCents: 2_000_000, partial: true, key: 'a:0' }],
    });
    expect(s).toEqual({ open: '2 Belege · nächste Fälligkeit 18.11.', overdue: 'Erinnerung am 11.11. gesendet', paid: 'inkl. Teilzahlungen' });
  });
});

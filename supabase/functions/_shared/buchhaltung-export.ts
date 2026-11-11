// deno-lint-ignore-file no-explicit-any
// Export für den Steuerberater und Monatsabschluss (A9). Umbau 11.11.2026.
//
// Buchungsstapel als CSV im allgemeinen Format (DATEV-Format nach Rücksprache
// mit dem Steuerberater), Belege als ZIP (die Web-App packt sie mit zipStore),
// Offene Posten als CSV, „Monat festschreiben“ (accounting_periods): danach
// keine Buchung und kein Beleg mit Datum in diesem Monat mehr.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { signedOnOf, todayKey, type PlacementCtx } from './placement-service.ts';
import { CUSTOMER_TYPES, OPEN_STATUSES, namesFor, nowIso, openCentsOf, requireAdminUser, rowsIn } from './buchhaltung-kern.ts';
import { centsDe, csvFile, dateDe, periodEnd, periodLabel, periodOf, periodStart, releaseDeadline, shiftPeriod, TAX_MODE_LABEL, type TaxMode } from './buchhaltung-rechnen.ts';
import { creditFiles } from './buchhaltung-gutschriften.ts';

const TAX_CASE: Record<string, string> = { domestic: '19 % USt', reverse_charge: 'Reverse Charge', not_taxable: 'nicht steuerbar' };
const TYPE: Record<string, string> = { placement_fee: 'Ausgangsrechnung', research_option: 'Ausgangsrechnung (Nachbesetzung)', salary_difference: 'Ausgangsrechnung (Unterschied)', cancellation: 'Stornorechnung' };

function periodOfBody(ctx: PlacementCtx, body: any) {
  const p = typeof body?.period === 'string' && /^\d{4}-\d{2}$/.test(body.period) ? body.period : shiftPeriod(periodOf(todayKey(ctx.now())), -1);
  return { period: p, from: periodStart(p), to: periodEnd(p) };
}

async function monthData(ctx: PlacementCtx, from: string, to: string) {
  const [{ data: invs, error: e1 }, { data: notes }, { data: pays }, { data: paidNotes }] = await Promise.all([
    ctx.db.from('invoices').select('*').neq('status', 'draft').gte('issued_at', from).lte('issued_at', to).order('issued_at'),
    ctx.db.from('recruiter_credit_notes').select('*').gte('issued_on', from).lte('issued_on', to).order('issued_on'),
    ctx.db.from('invoice_payments').select('*').gte('paid_on', from).lte('paid_on', to).order('paid_on'),
    ctx.db.from('recruiter_credit_notes').select('*').eq('status', 'paid').gte('paid_on', from).lte('paid_on', to).order('paid_on'),
  ]);
  dbFail(e1, 'Die Belege');
  return { invoices: ((invs ?? []) as any[]).filter((i) => [...CUSTOMER_TYPES, 'cancellation'].includes(i.invoice_type ?? 'placement_fee')), notes: (notes ?? []) as any[], payments: (pays ?? []) as any[], paidNotes: (paidNotes ?? []) as any[] };
}

export async function exportOverview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const { period, from, to } = periodOfBody(ctx, body);
  const [{ data: lock }, { count: openTx }, { count: anyTx }, { data: drafts }, { data: partial }] = await Promise.all([
    ctx.db.from('accounting_periods').select('*').eq('period', period).maybeSingle(),
    ctx.db.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('status', 'open').gte('booked_on', from).lte('booked_on', to),
    ctx.db.from('bank_transactions').select('id', { count: 'exact', head: true }).gte('booked_on', from).lte('booked_on', to),
    ctx.db.from('invoices').select('id, issued_at, lines').eq('status', 'draft').limit(500),
    ctx.db.from('invoices').select('id').eq('status', 'partially_paid').limit(500),
  ]);
  const stale = ((drafts ?? []) as any[]).filter((d) => { const s = signedOnOf(d); return s && releaseDeadline(s) < today; }).length;
  const m = await monthData(ctx, from, to);
  const checks = [
    (anyTx ?? 0) === 0
      ? { state: 'info', label: 'Für den Monat ist noch kein Kontoauszug hochgeladen' }
      : (openTx ?? 0) === 0 ? { state: 'ok', label: 'Alle Kontobewegungen zugeordnet' } : { state: 'fail', label: `${openTx} ${openTx === 1 ? 'Kontobewegung' : 'Kontobewegungen'} noch nicht zugeordnet` },
    stale === 0 ? { state: 'ok', label: 'Kein Entwurf älter als 10 Werktage' } : { state: 'fail', label: `${stale} ${stale === 1 ? 'Entwurf' : 'Entwürfe'} älter als 10 Werktage` },
    ...((partial ?? []).length ? [{ state: 'info', label: `${(partial ?? []).length} ${(partial ?? []).length === 1 ? 'Rechnung' : 'Rechnungen'} teilweise offen (normal, steht in den offenen Posten)` }] : []),
  ];
  const monthOver = period < periodOf(today);
  const lockWhy = (lock as any) ? `festgeschrieben am ${dateDe(String((lock as any).locked_at).slice(0, 10))}` : !monthOver ? `${periodLabel(period)} ist noch nicht vorbei` : (openTx ?? 0) > 0 ? 'Erst alle Kontobewegungen zuordnen' : null;
  const months = Array.from({ length: 13 }, (_, i) => shiftPeriod(periodOf(today), -i)).map((p) => ({ period: p, label: periodLabel(p) }));
  const invoices = m.invoices.filter((i) => i.invoice_type !== 'cancellation').length;
  const cancellations = m.invoices.filter((i) => i.invoice_type === 'cancellation').length;
  return {
    period, label: periodLabel(period), months, locked: !!lock, lockedAt: (lock as any)?.locked_at ?? null,
    checks,
    counts: {
      bookings: m.invoices.length + m.notes.length + m.payments.length + m.paidNotes.length,
      invoices, cancellations, creditNotes: m.notes.length,
      documents: m.invoices.filter((i) => i.pdf_path).length + m.notes.filter((n) => n.pdf_path).length,
    },
    canLock: !lockWhy, lockWhy,
  };
}

export async function exportBookings(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const { period, from, to } = periodOfBody(ctx, body);
  const m = await monthData(ctx, from, to);
  const numberOf = new Map<string, string>();
  for (const i of await rowsIn(ctx, 'invoices', 'id, invoice_number, recipient', 'id', [...m.invoices.map((i) => i.corrects_invoice_id), ...m.payments.map((p) => p.invoice_id)])) numberOf.set(i.id, i.invoice_number);
  const payInv = await rowsIn(ctx, 'invoices', 'id, invoice_number, recipient', 'id', m.payments.map((p) => p.invoice_id));
  const rows: { date: string; cells: (string | number | null)[] }[] = [];
  for (const i of m.invoices) {
    rows.push({
      date: i.issued_at, cells: [dateDe(i.issued_at), i.invoice_number, TYPE[i.invoice_type ?? 'placement_fee'] ?? i.invoice_type, i.recipient?.name ?? '', i.recipient?.vatId ?? '', i.lines?.[0]?.title ?? '',
        centsDe(Number(i.amount_cents ?? 0)), i.vat_rate != null ? String(i.vat_rate).replace('.', ',') : '', centsDe(Number(i.tax_amount_cents ?? 0)), centsDe(Number(i.total_amount_cents ?? 0)),
        TAX_CASE[i.tax_case ?? (i.reverse_charge ? 'reverse_charge' : 'domestic')] ?? '', i.corrects_invoice_id ? numberOf.get(i.corrects_invoice_id) ?? '' : '', dateDe(signedOnOf(i)), i.cancel_reason ?? ''],
    });
  }
  for (const n of m.notes) {
    rows.push({
      date: n.issued_on, cells: [dateDe(n.issued_on), n.number, 'Gutschrift an Headhunter (Eingangsleistung)', n.recipient?.name ?? '', n.recipient?.vatId ?? n.recipient?.taxNumber ?? '',
        `Vermittlungsanteile ${periodLabel(n.period)}`, centsDe(Number(n.net_cents)), String(n.vat_rate ?? 0).replace('.', ','), centsDe(Number(n.vat_cents)), centsDe(Number(n.total_cents)),
        TAX_MODE_LABEL[n.tax_mode as TaxMode] ?? n.tax_mode, '', periodLabel(n.period), ''],
    });
  }
  for (const p of m.payments) {
    const i = payInv.find((x) => x.id === p.invoice_id);
    rows.push({ date: p.paid_on, cells: [dateDe(p.paid_on), i?.invoice_number ?? '', p.source === 'bank' ? 'Zahlungseingang (Kontoauszug)' : 'Zahlungseingang (von Hand)', i?.recipient?.name ?? '', '', p.note ?? '', '', '', '', centsDe(Number(p.amount_cents)), '', i?.invoice_number ?? '', '', ''] });
  }
  for (const n of m.paidNotes) {
    rows.push({ date: n.paid_on, cells: [dateDe(n.paid_on), n.number, 'Auszahlung Gutschrift', n.recipient?.name ?? '', '', `Gutschrift ${n.number}`, '', '', '', centsDe(-Number(n.total_cents)), '', n.number, '', ''] });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const csv = csvFile(['Datum', 'Belegnummer', 'Art', 'Gegenpartei', 'USt-IdNr./Steuernummer', 'Buchungstext', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Steuerfall', 'Bezug', 'Leistung', 'Grund'], rows.map((r) => r.cells));
  return { fileName: `buchungsstapel-${period}.csv`, csv, rows: rows.length, hint: 'Allgemeines Format. Das DATEV-Format folgt nach Rücksprache mit dem Steuerberater.' };
}

export async function exportDocuments(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const { period, from, to } = periodOfBody(ctx, body);
  const m = await monthData(ctx, from, to);
  const files: { name: string; url: string }[] = [];
  const missing: string[] = [];
  for (const i of m.invoices) {
    if (!i.pdf_path) { missing.push(i.invoice_number); continue; }
    const url = await ctx.invoiceFiles.url(i.pdf_path, 600);
    if (url) files.push({ name: `${i.invoice_type === 'cancellation' ? 'Stornorechnungen' : 'Rechnungen'}/${String(i.invoice_number).replace(/[^\w.-]/g, '_')}.pdf`, url }); else missing.push(i.invoice_number);
  }
  const cf = creditFiles(ctx);
  for (const n of m.notes) {
    if (!n.pdf_path) { missing.push(n.number); continue; }
    const url = await cf.url(n.pdf_path, 600);
    if (url) files.push({ name: `Gutschriften/${String(n.number).replace(/[^\w.-]/g, '_')}.pdf`, url }); else missing.push(n.number);
  }
  return { fileName: `belege-${period}.zip`, files, missing };
}

export async function exportOpenItems(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const { data: invs } = await ctx.db.from('invoices').select('*').in('status', OPEN_STATUSES).in('invoice_type', CUSTOMER_TYPES).order('due_date');
  const { data: notes } = await ctx.db.from('recruiter_credit_notes').select('*').eq('status', 'issued').order('pay_until');
  const pls = await rowsIn(ctx, 'placements', 'id, submission_id', 'id', ((invs ?? []) as any[]).map((i) => i.placement_id));
  const names = await namesFor(ctx, pls);
  const rows: (string | number | null)[][] = [];
  for (const i of (invs ?? []) as any[]) {
    const overdue = i.due_date && i.due_date < today;
    rows.push(['Kunde', i.recipient?.name ?? '', i.invoice_number, dateDe(i.issued_at), dateDe(i.due_date), centsDe(Number(i.total_amount_cents ?? 0)), centsDe(Number(i.paid_amount_cents ?? 0)), centsDe(openCentsOf(i)),
      [names.get(i.placement_id)?.candidateName, overdue ? `überfällig seit ${dateDe(i.due_date)}` : null, Number(i.dunning_level ?? 0) ? `Mahnstufe ${i.dunning_level}` : null, i.po_follows ? 'Bestellnummer folgt' : null].filter(Boolean).join(' · ')]);
  }
  for (const n of (notes ?? []) as any[]) {
    rows.push(['Headhunter', n.recipient?.name ?? '', n.number, dateDe(n.issued_on), dateDe(n.pay_until), centsDe(Number(n.total_cents)), '0,00', centsDe(Number(n.total_cents)), `Gutschrift ${periodLabel(n.period)}`]);
  }
  const csv = csvFile(['Seite', 'Name', 'Beleg', 'Datum', 'fällig', 'Betrag', 'bezahlt', 'offen', 'Hinweis'], rows);
  return { fileName: `offene-posten-${today}.csv`, csv, rows: rows.length };
}

export async function lockPeriod(ctx: PlacementCtx, user: User, body: any) {
  const o = await exportOverview(ctx, user, body);
  must(o.canLock, `${o.label} lässt sich nicht festschreiben: ${o.lockWhy}.`, 'conflict');
  const { error } = await ctx.db.from('accounting_periods').insert({ period: o.period, locked_by: user.id, locked_at: nowIso(ctx) });
  if (error?.code === '23505') must(false, `${o.label} ist schon festgeschrieben.`, 'conflict');
  dbFail(error, 'Der Monatsabschluss');
  return { ok: true, period: o.period };
}

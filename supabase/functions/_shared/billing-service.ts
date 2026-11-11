// deno-lint-ignore-file no-explicit-any
// Kunden-Bereich „Rechnungen“ (Etappe 1, 25.10.2026; Umbau 11.11.2026 K9–K13):
// Belege, Zahlungen (auch Teilzahlungen), Erinnerungen, Export und Rechnungsdaten
// für Inhaber, Admin, HR (nur lesend) und die Rolle Buchhaltung.
// Wer was sieht, regelt billing-access.ts; Entwürfe sieht nur Matchunt.
// Die Erinnerungsmail selbst (K13) verschickt mahnwesen.ts; hier nur die Anzeige.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { billingScope, canSeeInvoice } from './billing-access.ts';
import { BANK, COUNTRY_NAMES, PAYMENT_TERMS_DAYS, taxCaseFor } from './billing-config.ts';
import { todayKey, type PlacementCtx } from './placement-service.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OPEN = ['open', 'pending', 'partially_paid'];
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cents = (i: any, col: string, legacy: string) => (i[col] != null ? Number(i[col]) : Math.round(Number(i[legacy] ?? 0) * 100));
const eur = (c: number) => `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100)} €`;
const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : null);

async function rowsIn(db: any, table: string, cols: string, col: string, ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return [] as any[];
  const { data, error } = await db.from(table).select(cols).in(col, list);
  if (error) throw error;
  return (data ?? []) as any[];
}

/** Steuerfall aus Land und USt-IdNr. in Worten (K12). */
function taxLabel(country: string | null, taxId: string | null) {
  const tc = taxCaseFor(country, taxId);
  const label = tc.taxCase === 'reverse_charge' ? 'Reverse Charge, ohne deutsche USt'
    : tc.taxCase === 'not_taxable' ? 'nicht im Inland steuerbar, ohne USt' : `${tc.vatRate} % USt`;
  return { taxCase: tc.taxCase, label, missing: tc.missing };
}

async function settingsOf(ctx: PlacementCtx, ownerId: string) {
  const { data } = await ctx.db.from('company_profiles').select('company_name, legal_name, street, postal_code, city, tax_id, billing_email, billing_cc_emails, purchase_order_required, default_cost_center, billing_country').eq('user_id', ownerId).maybeSingle();
  const cp = (data ?? {}) as any;
  const country = cp.billing_country ? String(cp.billing_country).toUpperCase() : null;
  return {
    name: cp.legal_name || cp.company_name || null, street: cp.street ?? null, postalCode: cp.postal_code ?? null, city: cp.city ?? null,
    country, countryName: country ? COUNTRY_NAMES[country] ?? country : null,
    taxId: cp.tax_id ?? null, billingEmail: cp.billing_email ?? null, ccEmails: (cp.billing_cc_emails ?? []) as string[],
    purchaseOrderRequired: !!cp.purchase_order_required, defaultCostCenter: cp.default_cost_center ?? null,
    paymentTermsDays: PAYMENT_TERMS_DAYS,
    tax: taxLabel(country, cp.tax_id ?? null),
    countries: Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name })),
    /** Format der Rechnung: E-Rechnung kommt später (Bauplan 1.13) */
    format: 'PDF',
    // Bankverbindung nur, wenn sie vollständig hinterlegt ist (Secrets, fehlen noch)
    bank: BANK.iban && BANK.holder ? { holder: BANK.holder, iban: BANK.iban, bic: BANK.bic || null, bank: BANK.bank || null } : null,
  };
}

/** Alle gestellten Belege, Zahlungen, Summen und Rechnungsdaten des Kunden. */
export async function clientInvoices(ctx: PlacementCtx, user: User) {
  const scope = await billingScope(ctx.db, user.id);
  const settings = await settingsOf(ctx, scope.ownerId);
  // Menüpunkt „Rechnungen“: nur wer Rechnungen sehen darf (nicht Hiring Manager und Viewer)
  const canSee = scope.isAdmin || scope.canManage || scope.jobIds.length > 0;
  const base = { canSee, canManage: scope.canManage, financeOnly: scope.financeOnly, settings };
  const byJob = await rowsIn(ctx.db, 'invoices', '*', 'job_id', scope.jobIds);
  const { data: legacy } = await ctx.db.from('invoices').select('*').eq('client_id', user.id).is('job_id', null);
  const all = [...byJob, ...((legacy ?? []) as any[])].filter((i, n, xs) => i.status !== 'draft' && canSeeInvoice(scope, i) && xs.findIndex((x) => x.id === i.id) === n);
  const today = todayKey(ctx.now());
  const ids = all.map((i) => i.id);
  const [jobs, subs, pays, reminders] = await Promise.all([
    rowsIn(ctx.db, 'jobs', 'id, title', 'id', all.map((i) => i.job_id)),
    rowsIn(ctx.db, 'submissions', 'id, candidate_id, identity_unlocked, identity_revealed', 'id', all.map((i) => i.submission_id)),
    rowsIn(ctx.db, 'invoice_payments', 'id, invoice_id, amount_cents, paid_on, source', 'invoice_id', ids).catch(() => []),
    rowsIn(ctx.db, 'invoice_reminders', 'invoice_id, level, sent_at, sent_to, pay_until', 'invoice_id', ids).catch(() => []),
  ]);
  const cands = await rowsIn(ctx.db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id));
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const nameBySub = new Map(subs.map((s) => [s.id, (s.identity_unlocked || s.identity_revealed) ? cands.find((c) => c.id === s.candidate_id)?.full_name ?? null : null]));
  const numberById = new Map(all.map((i) => [i.id, i.invoice_number as string]));

  const rows = all.map((i) => {
    const open = OPEN.includes(i.status);
    const total = cents(i, 'total_amount_cents', 'total_amount');
    const own = pays.filter((p: any) => p.invoice_id === i.id).sort((a: any, b: any) => String(a.paid_on).localeCompare(String(b.paid_on)));
    const fromRows = own.reduce((a: number, p: any) => a + Number(p.amount_cents ?? 0), 0);
    const paidCents = i.paid_amount_cents != null ? Number(i.paid_amount_cents) : fromRows || (i.status === 'paid' ? total : 0);
    const restCents = open ? Math.max(0, total - paidCents) : 0;
    const overdue = open && !!i.due_date && String(i.due_date) < today;
    const sent = reminders.filter((r: any) => r.invoice_id === i.id && r.sent_at).sort((a: any, b: any) => Number(a.level) - Number(b.level));
    const reminderSentAt = sent.find((r: any) => Number(r.level) === 0)?.sent_at ?? i.reminder_sent_at ?? null;
    const dunning = sent.filter((r: any) => Number(r.level) >= 1 && Number(r.level) <= 2);

    // Verlauf (K10): gestellt, Zahlungen, fällig, Erinnerung, Mahnungen, Storno
    const events: { at: string; text: string }[] = [];
    if (i.issued_at) events.push({ at: day(i.issued_at)!, text: `Gestellt${i.sent_to ? ` und an ${i.sent_to} gesendet` : ''}` });
    for (const p of own) events.push({ at: day(p.paid_on)!, text: `${Number(p.amount_cents) < total ? 'Teilzahlung' : 'Zahlung'} ${eur(Number(p.amount_cents))} eingegangen` });
    if (!own.length && i.paid_at) events.push({ at: day(i.paid_at)!, text: 'Zahlung eingegangen' });
    if (i.due_date && String(i.due_date) < today && (open || (i.paid_at && day(i.paid_at)! > String(i.due_date)))) events.push({ at: day(i.due_date)!, text: 'Fällig geworden' });
    for (const r of sent) {
      const lvl = Number(r.level);
      if (lvl === 0) events.push({ at: day(r.sent_at)!, text: `Erinnerung${r.sent_to ? ` an ${r.sent_to}` : ''} gesendet` });
      else if (lvl <= 2) events.push({ at: day(r.sent_at)!, text: `${lvl}. Mahnung${r.sent_to ? ` an ${r.sent_to}` : ''} gesendet${r.pay_until ? ` · neue Frist ${String(r.pay_until).slice(8, 10)}.${String(r.pay_until).slice(5, 7)}.` : ''}` });
    }
    if (!sent.some((r: any) => Number(r.level) === 0) && i.reminder_sent_at) events.push({ at: day(i.reminder_sent_at)!, text: 'Erinnerung gesendet' });
    if (i.client_paid_reported_on) events.push({ at: day(i.client_paid_reported_on)!, text: 'Überweisung von Ihnen gemeldet, Matchunt prüft' });
    if (i.cancelled_at) events.push({ at: day(i.cancelled_at)!, text: `Storniert${i.cancelled_by_invoice_id && numberById.get(i.cancelled_by_invoice_id) ? ` durch ${numberById.get(i.cancelled_by_invoice_id)}` : ''}` });
    events.sort((a, b) => a.at.localeCompare(b.at));

    return {
      id: i.id, number: i.invoice_number, type: i.invoice_type, status: i.status,
      issuedAt: i.issued_at, serviceOn: i.lines?.[0]?.serviceOn ?? null, dueDate: i.due_date,
      netCents: cents(i, 'amount_cents', 'amount'), vatCents: cents(i, 'tax_amount_cents', 'tax_amount'), totalCents: total,
      vatRate: i.vat_rate ?? null, reverseCharge: !!i.reverse_charge, taxCase: i.tax_case ?? (i.reverse_charge ? 'reverse_charge' : null),
      paidCents, restCents, paidAt: i.paid_at ?? null, reportedPaidOn: i.client_paid_reported_on ?? null,
      overdue, open, reminderSentAt, dunningLevel: dunning.length ? Math.max(...dunning.map((r: any) => Number(r.level))) : 0,
      payments: own.map((p: any) => ({ date: day(p.paid_on), amountCents: Number(p.amount_cents), source: p.source })),
      purchaseOrder: i.purchase_order ?? null, poFollows: !!i.po_follows, costCenter: i.cost_center ?? null,
      jobTitle: jobTitle.get(i.job_id) ?? i.lines?.[0]?.title?.replace('Personalvermittlung: ', '') ?? null,
      candidateName: nameBySub.get(i.submission_id) ?? null,
      // Buchhaltung sieht keine Bewerberprofile
      submissionId: scope.financeOnly ? null : i.submission_id ?? null,
      recipient: i.recipient ?? null, sentAt: i.sent_at ?? null, sentTo: i.sent_to ?? null, hasPdf: !!i.pdf_path,
      lines: i.lines ?? [],
      correctsInvoiceId: i.corrects_invoice_id ?? null, correctsNumber: i.corrects_invoice_id ? numberById.get(i.corrects_invoice_id) ?? null : null,
      cancelledAt: i.cancelled_at ?? null, cancelledByNumber: i.cancelled_by_invoice_id ? numberById.get(i.cancelled_by_invoice_id) ?? null : null,
      events,
    };
  }).sort((a, b) => String(b.issuedAt ?? '').localeCompare(String(a.issuedAt ?? '')));

  // Zahlungen (K11): jede Buchung einzeln, auch Teilzahlungen; ältere Rechnungen ohne Einzelbuchung mit dem Zahltag
  const payments = rows.flatMap((r) => r.payments.length
    ? r.payments.map((p, n) => ({ date: String(p.date), invoiceId: r.id, number: r.number, amountCents: p.amountCents, partial: p.amountCents < r.totalCents, key: `${r.id}:${n}` }))
    : r.paidAt ? [{ date: String(r.paidAt).slice(0, 10), invoiceId: r.id, number: r.number, amountCents: r.paidCents || r.totalCents, partial: false, key: `${r.id}:0` }] : [])
    .sort((a, b) => b.date.localeCompare(a.date));
  const year = today.slice(0, 4);
  const openRows = rows.filter((r) => r.open);
  const overdueRows = rows.filter((r) => r.overdue);
  const upcoming = openRows.filter((r) => r.dueDate && String(r.dueDate) >= today).map((r) => String(r.dueDate)).sort();
  return {
    ...base, invoices: rows, payments,
    totals: {
      openCents: openRows.reduce((a, r) => a + r.restCents, 0),
      overdueCents: overdueRows.reduce((a, r) => a + r.restCents, 0),
      paidYearCents: payments.filter((p) => p.date.slice(0, 4) === year).reduce((a, p) => a + p.amountCents, 0),
      openCount: openRows.length,
      nextDue: upcoming[0] ?? openRows.filter((r) => r.dueDate).map((r) => String(r.dueDate)).sort()[0] ?? null,
      lastReminderAt: overdueRows.map((r) => r.reminderSentAt).filter(Boolean).sort().reverse()[0] ?? null,
    },
  };
}

/** Links zu mehreren PDFs (Export als ZIP im Browser). */
export async function invoiceFiles(ctx: PlacementCtx, user: User, body: any) {
  const ids = Array.isArray(body?.invoiceIds) ? (body.invoiceIds as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  must(ids.length > 0, 'Keine Rechnungen gewählt.');
  const scope = await billingScope(ctx.db, user.id);
  const invs = await rowsIn(ctx.db, 'invoices', 'id, invoice_number, status, pdf_path, client_id, job_id', 'id', ids);
  const out: { id: string; number: string; url: string }[] = [];
  for (const i of invs) {
    if (i.status === 'draft' || !i.pdf_path || !canSeeInvoice(scope, i)) continue;
    const url = await ctx.invoiceFiles.url(i.pdf_path, 300);
    if (url) out.push({ id: i.id, number: i.invoice_number, url });
  }
  return { files: out };
}

/** Rechnungsdaten ändern (Inhaber, Admin, Buchhaltung). Gilt für neue Rechnungen. */
export async function updateBillingSettings(ctx: PlacementCtx, user: User, body: any) {
  const scope = await billingScope(ctx.db, user.id);
  must(scope.canManage, 'Rechnungsdaten ändern dürfen Inhaber, Admins und die Buchhaltung.', 'not_allowed');
  const patch: Record<string, unknown> = {};
  if (body?.name !== undefined) { const v = text(body.name, 200); must(v, 'Bitte den Firmennamen angeben.'); patch.legal_name = v; }
  if (body?.street !== undefined) patch.street = text(body.street, 200) || null;
  if (body?.postalCode !== undefined) patch.postal_code = text(body.postalCode, 20) || null;
  if (body?.city !== undefined) patch.city = text(body.city, 120) || null;
  if (body?.country !== undefined) {
    const v = text(body.country, 2).toUpperCase();
    must(!v || /^[A-Z]{2}$/.test(v), 'Bitte ein Land wählen.');
    patch.billing_country = v || null;
  }
  if (body?.taxId !== undefined) patch.tax_id = text(body.taxId, 40).replace(/\s+/g, '') || null;
  if (body?.billingEmail !== undefined) { const v = text(body.billingEmail, 200); must(!v || EMAIL.test(v), 'Bitte eine gültige E-Mail für Rechnungen angeben.'); patch.billing_email = v || null; }
  if (body?.ccEmails !== undefined) {
    const list = (Array.isArray(body.ccEmails) ? body.ccEmails : []).map((e: unknown) => text(e, 200)).filter(Boolean);
    must(list.length <= 5, 'Höchstens fünf weitere Empfänger.');
    must(list.every((e: string) => EMAIL.test(e)), 'Bitte nur gültige E-Mail-Adressen angeben.');
    patch.billing_cc_emails = [...new Set(list.map((e: string) => e.toLowerCase()))];
  }
  if (body?.purchaseOrderRequired !== undefined) patch.purchase_order_required = !!body.purchaseOrderRequired;
  if (body?.defaultCostCenter !== undefined) patch.default_cost_center = text(body.defaultCostCenter, 80) || null;
  must(Object.keys(patch).length > 0, 'Nichts zu ändern.');
  const { data: existing } = await ctx.db.from('company_profiles').select('id').eq('user_id', scope.ownerId).maybeSingle();
  if (existing) {
    const { error } = await ctx.db.from('company_profiles').update(patch).eq('id', (existing as any).id);
    dbFail(error, 'Die Rechnungsdaten');
  } else {
    const { error } = await ctx.db.from('company_profiles').insert({ user_id: scope.ownerId, company_name: (patch.legal_name as string) ?? 'Firma', ...patch });
    dbFail(error, 'Die Rechnungsdaten');
  }
  return { ok: true, settings: await settingsOf(ctx, scope.ownerId) };
}

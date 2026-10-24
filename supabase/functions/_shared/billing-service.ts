// deno-lint-ignore-file no-explicit-any
// Kunden-Bereich „Rechnungen“ (Etappe 1, 25.10.2026): Belege, Zahlungen,
// Export und Rechnungsdaten für Inhaber, Admin, HR und die Rolle Buchhaltung.
// Wer was sieht, regelt billing-access.ts; Entwürfe sieht nur Matchunt.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { billingScope, canSeeInvoice } from './billing-access.ts';
import { BANK, PAYMENT_TERMS_DAYS } from './billing-config.ts';
import { todayKey, type PlacementCtx } from './placement-service.ts';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const cents = (i: any, col: string, legacy: string) => (i[col] != null ? Number(i[col]) : Math.round(Number(i[legacy] ?? 0) * 100));

async function rowsIn(db: any, table: string, cols: string, col: string, ids: (string | null | undefined)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return [] as any[];
  const { data, error } = await db.from(table).select(cols).in(col, list);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function settingsOf(ctx: PlacementCtx, ownerId: string) {
  const { data } = await ctx.db.from('company_profiles').select('company_name, legal_name, street, postal_code, city, tax_id, billing_email, billing_cc_emails, purchase_order_required, default_cost_center').eq('user_id', ownerId).maybeSingle();
  const cp = (data ?? {}) as any;
  return {
    name: cp.legal_name || cp.company_name || null, street: cp.street ?? null, postalCode: cp.postal_code ?? null, city: cp.city ?? null,
    taxId: cp.tax_id ?? null, billingEmail: cp.billing_email ?? null, ccEmails: (cp.billing_cc_emails ?? []) as string[],
    purchaseOrderRequired: !!cp.purchase_order_required, defaultCostCenter: cp.default_cost_center ?? null,
    paymentTermsDays: PAYMENT_TERMS_DAYS,
    bank: BANK.iban ? { holder: BANK.holder, iban: BANK.iban, bic: BANK.bic || null, bank: BANK.bank || null } : null,
  };
}

/** Alle gestellten Belege, Zahlungen, Summen und Rechnungsdaten des Kunden. */
export async function clientInvoices(ctx: PlacementCtx, user: User) {
  const scope = await billingScope(ctx.db, user.id);
  const settings = await settingsOf(ctx, scope.ownerId);
  const base = { canManage: scope.canManage, financeOnly: scope.financeOnly, settings };
  const byJob = await rowsIn(ctx.db, 'invoices', '*', 'job_id', scope.jobIds);
  const { data: legacy } = await ctx.db.from('invoices').select('*').eq('client_id', user.id).is('job_id', null);
  const all = [...byJob, ...((legacy ?? []) as any[])].filter((i) => i.status !== 'draft' && canSeeInvoice(scope, i));
  const today = todayKey(ctx.now());
  const [jobs, subs] = await Promise.all([
    rowsIn(ctx.db, 'jobs', 'id, title', 'id', all.map((i) => i.job_id)),
    rowsIn(ctx.db, 'submissions', 'id, candidate_id, identity_unlocked, identity_revealed', 'id', all.map((i) => i.submission_id)),
  ]);
  const cands = await rowsIn(ctx.db, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id));
  const jobTitle = new Map(jobs.map((j) => [j.id, j.title]));
  const nameBySub = new Map(subs.map((s) => [s.id, (s.identity_unlocked || s.identity_revealed) ? cands.find((c) => c.id === s.candidate_id)?.full_name ?? null : null]));
  const rows = all.map((i) => {
    const open = ['open', 'pending', 'partially_paid'].includes(i.status);
    return {
      id: i.id, number: i.invoice_number, type: i.invoice_type, status: i.status,
      issuedAt: i.issued_at, serviceOn: i.lines?.[0]?.serviceOn ?? null, dueDate: i.due_date,
      netCents: cents(i, 'amount_cents', 'amount'), vatCents: cents(i, 'tax_amount_cents', 'tax_amount'), totalCents: cents(i, 'total_amount_cents', 'total_amount'),
      vatRate: i.vat_rate ?? null, reverseCharge: !!i.reverse_charge,
      paidCents: Number(i.paid_amount_cents ?? 0), paidAt: i.paid_at ?? null, reportedPaidOn: i.client_paid_reported_on ?? null,
      overdue: open && !!i.due_date && String(i.due_date) < today, open,
      purchaseOrder: i.purchase_order ?? null, costCenter: i.cost_center ?? null,
      jobTitle: jobTitle.get(i.job_id) ?? i.lines?.[0]?.title?.replace('Personalvermittlung: ', '') ?? null,
      candidateName: nameBySub.get(i.submission_id) ?? null,
      // Buchhaltung sieht keine Bewerberprofile
      submissionId: scope.financeOnly ? null : i.submission_id ?? null,
      recipient: i.recipient ?? null, sentAt: i.sent_at ?? null, sentTo: i.sent_to ?? null, hasPdf: !!i.pdf_path,
      lines: i.lines ?? [], correctsInvoiceId: i.corrects_invoice_id ?? null,
    };
  }).sort((a, b) => String(b.issuedAt ?? '').localeCompare(String(a.issuedAt ?? '')));
  const year = today.slice(0, 4);
  const payments = rows.filter((r) => r.paidAt).map((r) => ({ date: String(r.paidAt).slice(0, 10), invoiceId: r.id, number: r.number, amountCents: r.paidCents || r.totalCents }))
    .sort((a, b) => b.date.localeCompare(a.date));
  return {
    ...base, invoices: rows, payments,
    totals: {
      openCents: rows.filter((r) => r.open).reduce((a, r) => a + r.totalCents - r.paidCents, 0),
      overdueCents: rows.filter((r) => r.overdue).reduce((a, r) => a + r.totalCents - r.paidCents, 0),
      paidYearCents: payments.filter((p) => p.date.slice(0, 4) === year).reduce((a, p) => a + p.amountCents, 0),
      openCount: rows.filter((r) => r.open).length,
      nextDue: rows.filter((r) => r.open && r.dueDate).map((r) => String(r.dueDate)).sort()[0] ?? null,
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

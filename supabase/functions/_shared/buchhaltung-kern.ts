// deno-lint-ignore-file no-explicit-any
// Gemeinsame Bausteine der Admin-Buchhaltung (Umbau 11.11.2026): Zugriff,
// Sammelabfragen, Zahlung auf eine Rechnung buchen, Mails an die
// Rechnungs-E-Mail des Kunden, Namen zu Besetzungen.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import {
  assertPeriodOpen, billingCompany, isAdmin, notify, profile, todayKey, type PlacementCtx,
} from './placement-service.ts';
import { onInvoicePaid } from './nachbesetzung.ts';
import { esc, layout } from './intake-mail.ts';
import { m, tx } from './notify-i18n.ts';
import type { Lang } from './i18n.ts';

export const UUID = /^[0-9a-f-]{36}$/i;
export const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const OPEN_STATUSES = ['open', 'partially_paid', 'pending', 'overdue'];
/** Rechnungsarten an Kunden mit Zahlung (ohne Storno) */
export const CUSTOMER_TYPES = ['placement_fee', 'research_option', 'salary_difference'];

export async function requireAdminUser(ctx: PlacementCtx, user: User) {
  must(await isAdmin(ctx.db, user.id), 'Nur für Matchunt.', 'not_allowed');
}

/** Viele Zeilen per id-Liste (in Blöcken, damit die URL kurz bleibt). */
export async function rowsIn(ctx: PlacementCtx, table: string, cols: string, col: string, ids: (string | null | undefined)[]): Promise<any[]> {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  const out: any[] = [];
  for (let i = 0; i < list.length; i += 150) {
    const { data, error } = await ctx.db.from(table).select(cols).in(col, list.slice(i, i + 150));
    if (error) {
      // Tabelle/Spalte fehlt (Migration noch nicht eingespielt): leer statt Absturz
      if (error.code === '42P01' || error.code === '42703') return out;
      dbFail(error, 'Die Daten');
    }
    out.push(...((data ?? []) as any[]));
  }
  return out;
}

export const openCentsOf = (inv: any) => Math.max(0, Number(inv.total_amount_cents ?? Math.round(Number(inv.total_amount ?? 0) * 100)) - Number(inv.paid_amount_cents ?? 0));

// ---------------------------------------------------------------------------
// Zahlung buchen (A6 und Notweg A2): invoice_payments, Rechnung, Besetzung,
// wartende Nachbesetzung starten
// ---------------------------------------------------------------------------

export async function applyInvoicePayment(ctx: PlacementCtx, inv: any, o: {
  amountCents: number; paidOn: string; source: 'bank' | 'manual'; bankTransactionId?: string | null; note?: string | null; actorId: string | null;
}) {
  must(OPEN_STATUSES.includes(inv.status), 'Für diese Rechnung ist keine Zahlung offen.', 'conflict');
  must(CUSTOMER_TYPES.includes(inv.invoice_type ?? 'placement_fee'), 'Auf diesen Beleg wird keine Zahlung gebucht.', 'conflict');
  must(Number.isInteger(o.amountCents) && o.amountCents > 0, 'Bitte den Betrag laut Konto angeben.');
  must(DATE.test(o.paidOn) && o.paidOn <= todayKey(ctx.now()), 'Bitte das Datum des Zahlungseingangs angeben.');
  await assertPeriodOpen(ctx.db, o.paidOn, 'Die Zahlung');
  const { error: pErr } = await ctx.db.from('invoice_payments').insert({
    invoice_id: inv.id, amount_cents: o.amountCents, paid_on: o.paidOn, source: o.source,
    bank_transaction_id: o.bankTransactionId ?? null, note: o.note ?? null, created_by: o.actorId,
  });
  dbFail(pErr, 'Die Zahlung');
  const total = Number(inv.total_amount_cents ?? Math.round(Number(inv.total_amount ?? 0) * 100));
  const paidTotal = Number(inv.paid_amount_cents ?? 0) + o.amountCents;
  const full = paidTotal >= total;
  const paidAt = `${o.paidOn}T12:00:00Z`;
  const patch: Record<string, unknown> = { status: full ? 'paid' : 'partially_paid', paid_amount_cents: paidTotal, paid_at: full ? paidAt : null };
  if (o.note) patch.payment_note = o.note.slice(0, 1000);
  const { error } = await ctx.db.from('invoices').update(patch).eq('id', inv.id);
  dbFail(error, 'Die Rechnung');
  if (full) {
    // Nur die Kundenrechnung der Besetzung (Honorar bzw. Unterschied) setzt die Besetzung auf bezahlt.
    // payment_status = Kunde hat bezahlt – nicht „an den Headhunter ausgezahlt“.
    if (['placement_fee', 'salary_difference'].includes(inv.invoice_type ?? 'placement_fee') && inv.placement_id) {
      await ctx.db.from('placements').update({ invoice_state: 'paid', payment_status: 'paid', paid_at: paidAt }).eq('id', inv.placement_id);
      if ((inv.invoice_type ?? 'placement_fee') === 'placement_fee') {
        const { data: p } = await ctx.db.from('placements').select('submission_id, start_fixed_at, placement_state').eq('id', inv.placement_id).maybeSingle();
        if (p) {
          const { data: s } = await ctx.db.from('submissions').select('recruiter_id').eq('id', (p as any).submission_id).maybeSingle();
          const started = !!(p as any).start_fixed_at || ['started', 'completed'].includes((p as any).placement_state);
          await notify(ctx, (s as any)?.recruiter_id, 'placement_paid', (l) => tx(l, 'Kunde hat bezahlt', 'Client has paid', 'Kunden har betalat', 'Kunden har betalt'),
            (l) => started ? tx(l, m`Rechnung ${inv.invoice_number} ist bezahlt. Dein Anteil kommt mit der nächsten Monats-Gutschrift.`, m`Invoice ${inv.invoice_number} has been paid. Your share comes with the next monthly credit note.`, m`Faktura ${inv.invoice_number} är betald. Din andel kommer med nästa månatliga kreditnota.`, m`Faktura ${inv.invoice_number} er betalt. Andelen din kommer med neste månedlige kreditnota.`)
              : tx(l, m`Rechnung ${inv.invoice_number} ist bezahlt. Dein Anteil kommt mit der Monats-Gutschrift, sobald dein Kandidat angefangen hat.`, m`Invoice ${inv.invoice_number} has been paid. Your share comes with the monthly credit note once your candidate has started.`, m`Faktura ${inv.invoice_number} är betald. Din andel kommer med den månatliga kreditnotan så snart din kandidat har börjat.`, m`Faktura ${inv.invoice_number} er betalt. Andelen din kommer med den månedlige kreditnotaen så snart kandidaten din har begynt.`),
            'placement', inv.placement_id);
        }
      }
    }
    try { await onInvoicePaid(ctx, inv.id); } catch (e) { console.warn('[buchhaltung] Nachbesetzung nicht gestartet', e instanceof Error ? e.message : e); }
  }
  return { status: full ? 'paid' : 'partially_paid', paidTotalCents: paidTotal, full, openCents: Math.max(0, total - paidTotal) };
}

// ---------------------------------------------------------------------------
// Mails an die Rechnungs-E-Mail des Kunden (plus Kopien)
// ---------------------------------------------------------------------------

export async function customerRecipients(ctx: PlacementCtx, inv: any): Promise<{ to: string | null; cc: string[]; company: any }> {
  const cp = await billingCompany(ctx.db, inv);
  const to = (inv.recipient?.email && EMAIL.test(inv.recipient.email) ? inv.recipient.email : null) ?? (cp.billing_email && EMAIL.test(cp.billing_email) ? cp.billing_email : null);
  const cc = ((cp.billing_cc_emails ?? []) as string[]).map((e) => String(e).trim()).filter((e) => EMAIL.test(e) && e.toLowerCase() !== String(to ?? '').toLowerCase());
  return { to, cc: [...new Set(cc)], company: cp };
}

export interface CustomerMail {
  subject: string;
  heading: string;
  paragraphs: string[];
  text: string;
  cta?: { label: string; url: string };
  attachments?: { filename: string; contentBase64: string; contentType: string }[];
  template: string;
  meta: Record<string, unknown>;
  /** Sprache der Mail (lang-Attribut, Fußzeile); ohne Angabe Deutsch */
  lang?: Lang | null;
}

/** An die Rechnungs-E-Mail und alle Kopien. Rückgabe: wer es bekommen hat. */
export async function mailCustomer(ctx: PlacementCtx, inv: any, m: CustomerMail): Promise<{ sentTo: string[]; failed: string[]; to: string | null }> {
  const { to, cc } = await customerRecipients(ctx, inv);
  must(to, 'Die Rechnungs-E-Mail des Kunden fehlt.', 'conflict');
  const html = layout({ ...(m.lang ? { lang: m.lang } : {}), preheader: m.heading, heading: m.heading, body: m.paragraphs.map((p) => `<p style="margin:0 0 12px 0;">${p}</p>`).join(''), cta: m.cta });
  const sentTo: string[] = [];
  const failed: string[] = [];
  for (const addr of [to!, ...cc]) {
    const r = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: addr, replyTo: 'info@bluewater-bridge.de', subject: m.subject, html, text: m.text, attachments: m.attachments }, { template: m.template, meta: m.meta });
    (r.sent ? sentTo : failed).push(addr);
  }
  return { sentTo, failed, to };
}

export { esc };

// ---------------------------------------------------------------------------
// Namen zu Besetzungen (Kandidat, Stelle, Firma, Headhunter)
// ---------------------------------------------------------------------------

export interface PlacementNames {
  candidateName: string;
  firstName: string;
  jobTitle: string;
  companyName: string;
  jobId: string | null;
  clientId: string | null;
  organizationId: string | null;
  recruiterId: string | null;
  recruiterName: string | null;
  recruiterFirst: string | null;
  recruiterEmail: string | null;
}

export async function namesFor(ctx: PlacementCtx, placements: any[]): Promise<Map<string, PlacementNames>> {
  const subs = await rowsIn(ctx, 'submissions', 'id, job_id, candidate_id, recruiter_id', 'id', placements.map((p) => p.submission_id));
  const [jobs, cands, profs] = await Promise.all([
    rowsIn(ctx, 'jobs', 'id, title, company_name, client_id, organization_id', 'id', subs.map((s) => s.job_id)),
    rowsIn(ctx, 'candidates', 'id, full_name', 'id', subs.map((s) => s.candidate_id)),
    rowsIn(ctx, 'profiles', 'user_id, full_name, email', 'user_id', subs.map((s) => s.recruiter_id)),
  ]);
  const subBy = new Map(subs.map((s) => [s.id, s]));
  const jobBy = new Map(jobs.map((j) => [j.id, j]));
  const candBy = new Map(cands.map((c) => [c.id, c]));
  const profBy = new Map(profs.map((p) => [p.user_id, p]));
  const out = new Map<string, PlacementNames>();
  for (const p of placements) {
    const s = subBy.get(p.submission_id);
    const j = s ? jobBy.get(s.job_id) : null;
    const c = s ? candBy.get(s.candidate_id) : null;
    const r = s?.recruiter_id ? profBy.get(s.recruiter_id) : null;
    const name = c?.full_name || 'Kandidat';
    out.set(p.id, {
      candidateName: name, firstName: String(name).split(' ')[0], jobTitle: j?.title ?? '', companyName: j?.company_name ?? '',
      jobId: j?.id ?? null, clientId: j?.client_id ?? null, organizationId: j?.organization_id ?? null,
      recruiterId: s?.recruiter_id ?? null, recruiterName: r?.full_name ?? null, recruiterFirst: r?.full_name ? String(r.full_name).split(' ')[0] : null, recruiterEmail: r?.email ?? null,
    });
  }
  return out;
}

export async function adminName(ctx: PlacementCtx, userId: string | null | undefined) {
  return (await profile(ctx.db, userId))?.name ?? null;
}

export const nowIso = (ctx: PlacementCtx) => new Date(ctx.now()).toISOString();

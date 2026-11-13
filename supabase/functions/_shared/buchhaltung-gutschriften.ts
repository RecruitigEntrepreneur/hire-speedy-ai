// deno-lint-ignore-file no-explicit-any
// Gutschriftlauf (A7, H12). Umbau 11.11.2026.
//
//   1 Prüfen      fällige Anteile je Headhunter: 1. Teil (Kunde hat bezahlt und
//                 Antritt steht fest), 2. Teil (Garantie plus Meldefrist vorbei,
//                 bezahlt), Auslobung (Ersatz hat angefangen, ursprüngliche
//                 Rechnung und ggf. Unterschied bezahlt). Steuer je Headhunter.
//                 Gesperrt: Konto nicht bestätigt, Kontowechsel offen,
//                 Gutschriftverfahren widersprochen, Pflichtangaben fehlen →
//                 „wandert in den nächsten Lauf“.
//   2 Erstellen   recruiter_credit_notes (Nummernkreis 'credit_note'), PDF im
//                 privaten Bucket 'credit-notes' (pdf_path), Mail an den
//                 Headhunter, Anteile → 'approved' + credit_note_id.
//   3 SEPA        pain.001.001.09 zum Hochladen ins Online-Banking.
//   4 Bestätigen  über den Kontoauszug (A6): Abbuchung „GS-…“ → bezahlt.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { dbFail, must } from './interview-service.ts';
import { assertPeriodOpen, bucketFiles, notify, profile, todayKey, type FilePort, type PlacementCtx } from './placement-service.ts';
import { BANK, ISSUER, NUMBERING, formatNumber, releaseBlockers } from './billing-config.ts';
import { eur, renderCreditNotePdf } from './invoice-pdf.ts';
import { esc, layout } from './intake-mail.ts';
import { dateKeyIn, eurCentsIn, m, tx, type Lang } from './notify-i18n.ts';
const eurL = (c: number, l: Lang) => (l === 'de' || l === 'de-AT' || l === 'de-CH' ? eur(c) : eurCentsIn(c, l));
import { notifyLang } from './notify-i18n.ts';
/** Monat nach Sprache (für die Mail; deutsch über monthName) */
const monthIn = (period: string, l: Lang) => new Intl.DateTimeFormat(intlLocale(l), { month: 'long', timeZone: 'UTC' }).format(new Date(`${period}-15T12:00:00Z`));
const periodIn = (period: string, l: Lang) => new Intl.DateTimeFormat(intlLocale(l), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${period}-15T12:00:00Z`));
import { intlLocale } from './i18n.ts';
import { isPackageKey, splitFor, versionOfSnapshot } from './konditionen.ts';
import { UUID, namesFor, nowIso, requireAdminUser, rowsIn, text } from './buchhaltung-kern.ts';
import {
  TAX_MODE_LABEL, creditPayUntil, creditTax, dateDe, dateDeShort, inRun, monthName, pendingRunPeriod, periodEnd, periodLabel, periodOf,
  positionLabel, positionShort, runDeadline, runName, runOpensOn, shiftPeriod, trancheDue, type TaxMode, type TrancheDue, type TrancheType,
} from './buchhaltung-rechnen.ts';
import { buildPain001, ibanValid, maskIban } from './buchhaltung-sepa.ts';

export const creditFiles = (ctx: PlacementCtx): FilePort => bucketFiles(ctx.db, 'credit-notes');

// ---------------------------------------------------------------------------
// Fällige Anteile
// ---------------------------------------------------------------------------

export interface DueItem {
  trancheId: string;
  placementId: string;
  recruiterId: string;
  type: TrancheType;
  status: string;
  amountCents: number;
  due: TrancheDue;
  label: string;
  short: string;
  title: string;
  details: string[];
  candidateName: string;
  companyName: string;
}

const paidOnOf = (p: any, invs: any[], types: string[]) => {
  const inv = invs.find((i) => i.placement_id === p.id && types.includes(i.invoice_type ?? 'placement_fee') && i.status === 'paid');
  if (inv?.paid_at) return String(inv.paid_at).slice(0, 10);
  return null;
};

/** Fakten je Anteil aus Besetzung, Rechnungen und Fällen (für Fahrplan und Lauf). */
export async function trancheContext(ctx: PlacementCtx, tranches: any[], knownPlacements: any[] = []) {
  const byId = new Map(knownPlacements.map((p) => [p.id, p]));
  const missing = tranches.map((t) => t.placement_id).filter((id) => !byId.has(id));
  for (const p of await rowsIn(ctx, 'placements', '*', 'id', missing)) byId.set(p.id, p);
  const origIds = [...byId.values()].map((p) => p.replaces_placement_id).filter((id) => id && !byId.has(id));
  for (const p of await rowsIn(ctx, 'placements', '*', 'id', origIds)) byId.set(p.id, p);
  const pids = [...byId.keys()];
  const [invs, claims] = await Promise.all([
    rowsIn(ctx, 'invoices', 'id, placement_id, invoice_type, status, paid_at, total_amount_cents, amount_cents', 'placement_id', pids),
    rowsIn(ctx, 'continuity_claims', 'id, placement_id, status', 'placement_id', pids),
  ]);
  const openClaim = new Set(claims.filter((c) => ['submitted', 'in_review'].includes(c.status)).map((c) => c.placement_id));
  const due = (t: any): TrancheDue => {
    const p = byId.get(t.placement_id);
    if (!p) return { due: false, since: null, waitingFor: 'Besetzung fehlt' };
    const started = !!p.start_fixed_at || ['started', 'completed', 'ended_early'].includes(p.placement_state);
    const ownPaid = p.invoice_state === 'paid' ? (paidOnOf(p, invs, ['placement_fee', 'salary_difference']) ?? (p.paid_at ? String(p.paid_at).slice(0, 10) : todayKey(ctx.now()))) : null;
    const orig = p.replaces_placement_id ? byId.get(p.replaces_placement_id) : null;
    const diff = invs.filter((i) => i.placement_id === p.id && i.invoice_type === 'salary_difference' && i.status !== 'cancelled' && i.status !== 'draft');
    const diffDraft = invs.some((i) => i.placement_id === p.id && i.invoice_type === 'salary_difference' && i.status === 'draft');
    return trancheDue({
      type: t.tranche_type, status: t.status, creditNoteId: t.credit_note_id ?? null,
      invoicePaidOn: t.tranche_type === 'research_bounty' ? null : ownPaid,
      startFixedOn: p.start_fixed_at ? String(p.start_fixed_at).slice(0, 10) : started ? String(p.first_working_day ?? '').slice(0, 10) || null : null,
      started, placementCancelled: p.placement_state === 'cancelled', retentionState: p.retention_state, retentionReleaseDate: p.retention_release_date,
      clientSphereOn: p.client_sphere_at ? String(p.client_sphere_at).slice(0, 10) : null, openClaim: openClaim.has(p.id),
      originalPaidOn: orig ? (orig.invoice_state === 'paid' ? (paidOnOf(orig, invs, ['placement_fee']) ?? (orig.paid_at ? String(orig.paid_at).slice(0, 10) : todayKey(ctx.now()))) : null) : (t.tranche_type === 'research_bounty' ? null : undefined),
      differenceInvoice: diff.length || diffDraft ? { paidOn: diff.find((i) => i.status === 'paid')?.paid_at ? String(diff.find((i) => i.status === 'paid')!.paid_at).slice(0, 10) : null } : null,
    });
  };
  return { byId, invs, openClaim, due };
}

/** Alle offenen Anteile (noch ohne Gutschrift) mit Fälligkeit und Text für die Gutschrift. */
export async function loadDueItems(ctx: PlacementCtx): Promise<DueItem[]> {
  const { data, error } = await ctx.db.from('recruiter_payout_tranches').select('*').in('status', ['pending', 'due']).is('credit_note_id', null).limit(3000);
  if (error) { if (error.code === '42703' || error.code === '42P01') return []; dbFail(error, 'Die Anteile'); }
  const tranches = (data ?? []) as any[];
  if (!tranches.length) return [];
  const c = await trancheContext(ctx, tranches);
  const names = await namesFor(ctx, [...c.byId.values()]);
  return tranches.map((t) => {
    const p = c.byId.get(t.placement_id) ?? {};
    const n = names.get(t.placement_id);
    const orig = p.replaces_placement_id ? c.byId.get(p.replaces_placement_id) : null;
    const base = orig ?? p;
    const snap = base.pricing_snapshot ?? {};
    const pkg = isPackageKey(base.package_key) ? base.package_key : null;
    const split = pkg ? splitFor(pkg, versionOfSnapshot(snap)) : null;
    const clientPct = Number(snap.clientFeePct ?? split?.clientPct ?? 0) || null;
    const share = t.tranche_type === 'initial' ? Number(snap.recruiterInitialPct ?? split?.initialPct ?? 0)
      : t.tranche_type === 'retention' ? Number(snap.recruiterRetentionPct ?? split?.retentionPct ?? 0)
        : Number(snap.researchBountyPct ?? split?.bountyPct ?? 0);
    const type = t.tranche_type as TrancheType;
    const label = positionLabel(type, pkg, share || null, clientPct);
    const fee = Number(base.client_fee_cents ?? 0);
    const paid = c.invs.find((i) => i.placement_id === base.id && (i.invoice_type ?? 'placement_fee') === 'placement_fee' && i.status === 'paid');
    const due = c.due(t);
    const details: string[] = [];
    if (type === 'research_bounty') {
      const on = names.get(base.id);
      details.push(`Nachbesetzung für ${on?.candidateName ?? 'die erste Besetzung'} · Honorar ${eur(fee)} netto${paid?.paid_at ? `, bezahlt ${dateDeShort(paid.paid_at)}` : ''}`);
      details.push(`Antritt ${dateDeShort(p.first_working_day)} · Anteil ${share ? `${String(share).replace('.', ',')}/${String(clientPct ?? '').replace('.', ',')}` : ''}`.trim());
      const nominal = Math.round(Number(base.gross_annual_target_compensation_cents ?? 0) * share / 100);
      if (nominal && nominal !== Number(t.amount_cents)) details.push(`angepasst auf ${eur(Number(t.amount_cents))} (insgesamt höchstens der normale Anteil bzw. Anteil am Unterschied)`);
    } else {
      details.push(`Honorar ${eur(fee)} netto${paid?.paid_at ? `, bezahlt ${dateDeShort(paid.paid_at)}` : ''} · ${type === 'retention' ? `Garantie bis ${dateDeShort(p.continuity_end_date)}` : `Antritt ${dateDeShort(p.first_working_day)}`} · Anteil ${share ? `${String(share).replace('.', ',')}/${String(clientPct ?? '').replace('.', ',')}` : ''}`.trim());
    }
    return {
      trancheId: t.id, placementId: t.placement_id, recruiterId: t.recruiter_id, type, status: t.status, amountCents: Number(t.amount_cents ?? 0), due,
      label, short: positionShort(type, pkg), title: `${label} · Besetzung ${n?.candidateName ?? 'Kandidat'}, ${n?.companyName ?? ''}`.replace(/, $/, ''),
      details, candidateName: n?.candidateName ?? 'Kandidat', companyName: n?.companyName ?? '',
    };
  });
}

// ---------------------------------------------------------------------------
// Abrechnungsdaten der Headhunter
// ---------------------------------------------------------------------------

export interface PayoutAccount { holder: string | null; iban: string | null; bic: string | null; masked: string | null }

/** Wirksames Konto: bestätigt; ein bestätigter Wechsel gilt nach 48 Stunden (H13). */
export function effectiveAccount(bp: any, now: number): { account: PayoutAccount | null; blocked: string | null } {
  if (!bp) return { account: null, blocked: 'Abrechnungsdaten fehlen' };
  if (bp.self_billing_objected_at) return { account: null, blocked: 'widerspricht dem Gutschriftverfahren (eigene Rechnung nötig)' };
  const pendingDue = bp.pending_iban && bp.pending_confirmed_at && bp.pending_effective_at && Date.parse(bp.pending_effective_at) <= now;
  if (bp.pending_iban && !pendingDue) {
    return { account: null, blocked: bp.pending_effective_at ? `Kontowechsel gilt ab ${dateDe(String(bp.pending_effective_at).slice(0, 10))}` : 'Kontowechsel nicht bestätigt' };
  }
  const iban = pendingDue ? bp.pending_iban : bp.iban;
  const holder = pendingDue ? (bp.pending_account_holder ?? bp.account_holder) : bp.account_holder;
  const bic = pendingDue ? (bp.pending_bic ?? null) : (bp.bic ?? null);
  if (!iban) return { account: null, blocked: 'Konto fehlt' };
  if (!pendingDue && !bp.iban_confirmed_at) return { account: null, blocked: 'Konto nicht bestätigt' };
  if (!ibanValid(iban)) return { account: null, blocked: 'IBAN ungültig' };
  return { account: { holder: holder ?? null, iban: String(iban).replace(/\s+/g, '').toUpperCase(), bic: bic ? String(bic).replace(/\s+/g, '').toUpperCase() : null, masked: maskIban(iban) }, blocked: null };
}

/** Pflichtangaben auf der Gutschrift (§ 14 Abs. 4 UStG): Name, Anschrift, Steuernummer bzw. USt-IdNr. */
export function profileGaps(bp: any): string | null {
  if (!bp) return 'Abrechnungsdaten fehlen';
  if (!bp.legal_name || !bp.street || !bp.city || !bp.postal_code) return 'Anschrift fehlt';
  const mode = (bp.tax_mode ?? 'standard') as TaxMode;
  if (mode === 'foreign' && !bp.vat_id) return 'USt-IdNr. fehlt (Ausland)';
  if (mode !== 'foreign' && !bp.vat_id && !bp.tax_number) return 'Steuernummer fehlt';
  return null;
}

// ---------------------------------------------------------------------------
// 1 Prüfen
// ---------------------------------------------------------------------------

export interface RunGroup {
  recruiterId: string;
  name: string;
  email: string | null;
  taxMode: TaxMode;
  taxLabel: string;
  blocked: string | null;
  items: DueItem[];
  netCents: number;
  vatCents: number;
  totalCents: number;
  ibanMasked: string | null;
}

async function issuedPeriods(ctx: PlacementCtx): Promise<string[]> {
  const { data, error } = await ctx.db.from('credit_note_runs').select('period');
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => r.period);
}

export async function computeRun(ctx: PlacementCtx, period: string) {
  const items = (await loadDueItems(ctx)).filter((i) => i.due.due);
  const inside = items.filter((i) => inRun(i.due, period));
  const later = items.filter((i) => !inRun(i.due, period));
  const recIds = [...new Set(inside.map((i) => i.recruiterId))];
  const [bps, profs] = await Promise.all([
    rowsIn(ctx, 'recruiter_billing_profiles', '*', 'recruiter_id', recIds),
    rowsIn(ctx, 'profiles', 'user_id, full_name, email', 'user_id', recIds),
  ]);
  const bpBy = new Map(bps.map((b) => [b.recruiter_id, b]));
  const profBy = new Map(profs.map((p) => [p.user_id, p]));
  const groups: RunGroup[] = recIds.map((rid) => {
    const bp = bpBy.get(rid);
    const mode = ((bp?.tax_mode ?? 'standard') as TaxMode);
    const acct = effectiveAccount(bp, ctx.now());
    const blocked = acct.blocked ?? profileGaps(bp);
    const its = inside.filter((i) => i.recruiterId === rid);
    const net = its.reduce((a, i) => a + i.amountCents, 0);
    const tax = creditTax(mode, net);
    return {
      recruiterId: rid, name: bp?.legal_name || profBy.get(rid)?.full_name || 'Headhunter', email: profBy.get(rid)?.email ?? null,
      taxMode: mode, taxLabel: TAX_MODE_LABEL[mode], blocked, items: its, netCents: net, vatCents: tax.vatCents, totalCents: tax.totalCents, ibanMasked: acct.account?.masked ?? null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return { groups, later };
}

export async function creditRunOverview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const issued = await issuedPeriods(ctx);
  const period = typeof body?.period === 'string' && /^\d{4}-\d{2}$/.test(body.period) ? body.period : pendingRunPeriod(today, issued);
  const { groups, later } = await computeRun(ctx, period);
  const ok = groups.filter((g) => !g.blocked);
  const sum = (f: (g: RunGroup) => number) => ok.reduce((a, g) => a + f(g), 0);
  const runs = await runList(ctx);
  const { data: obj } = await ctx.db.from('credit_note_objections').select('*').eq('status', 'open').order('created_at', { ascending: true }).limit(100);
  const objNotes = await rowsIn(ctx, 'recruiter_credit_notes', 'id, number, recruiter_id, recipient', 'id', ((obj ?? []) as any[]).map((o) => o.credit_note_id));
  const TOPIC: Record<string, string> = { basis: 'Grundlage (Gehalt)', percentage: 'Prozentsatz', vat: 'Umsatzsteuer', other: 'Etwas anderes' };
  return {
    period, label: periodLabel(period), runName: runName(period), opensOn: runOpensOn(period), deadline: runDeadline(period),
    payUntil: creditPayUntil(today), issued: issued.includes(period), canCreate: today >= runOpensOn(period) && !issued.includes(period),
    blockers: releaseBlockers('credit_note'), groups: groups.map(groupView),
    totals: { netCents: sum((g) => g.netCents), vatCents: sum((g) => g.vatCents), totalCents: sum((g) => g.totalCents), notes: ok.length, items: ok.reduce((a, g) => a + g.items.length, 0) },
    blockedItems: groups.filter((g) => g.blocked).reduce((a, g) => a + g.items.length, 0),
    laterCount: later.length,
    runs,
    objections: ((obj ?? []) as any[]).map((o) => {
      const n = objNotes.find((x) => x.id === o.credit_note_id);
      return { id: o.id, creditNoteId: o.credit_note_id, number: n?.number ?? null, recruiterName: n?.recipient?.name ?? null, topic: TOPIC[o.topic] ?? o.topic, note: o.note, createdAt: o.created_at };
    }),
    sepaReady: !!(BANK.iban && BANK.holder),
  };
}

const groupView = (g: RunGroup) => ({
  recruiterId: g.recruiterId, name: g.name, taxMode: g.taxMode, taxLabel: g.taxLabel, blocked: g.blocked, ibanMasked: g.ibanMasked,
  netCents: g.netCents, vatCents: g.vatCents, totalCents: g.totalCents,
  items: g.items.map((i) => ({ trancheId: i.trancheId, placementId: i.placementId, short: i.short, label: i.label, candidateName: i.candidateName, companyName: i.companyName, amountCents: i.amountCents, dueSince: i.due.since })),
});

/** Kurz für Fahrplan/Kennzahl: wie viele Posten im anstehenden Lauf? */
export async function nextRunSummary(ctx: PlacementCtx) {
  const today = todayKey(ctx.now());
  const issued = await issuedPeriods(ctx);
  const period = pendingRunPeriod(today, issued);
  const { groups } = await computeRun(ctx, period);
  return {
    period, runName: runName(period), deadline: runDeadline(period), opensOn: runOpensOn(period),
    items: groups.filter((g) => !g.blocked).reduce((a, g) => a + g.items.length, 0),
    blockedItems: groups.filter((g) => g.blocked).reduce((a, g) => a + g.items.length, 0),
  };
}

export { pendingRunPeriod, issuedPeriods };

async function runList(ctx: PlacementCtx) {
  const { data: runs, error } = await ctx.db.from('credit_note_runs').select('*').order('period', { ascending: false }).limit(24);
  if (error) return [];
  const notes = await rowsIn(ctx, 'recruiter_credit_notes', 'id, run_id, recruiter_id, number, status, issued_on, period, pay_until, net_cents, vat_cents, total_cents, recipient, iban_masked, pdf_path, sent_at, paid_on, tax_mode', 'run_id', ((runs ?? []) as any[]).map((r) => r.id));
  return ((runs ?? []) as any[]).map((r) => {
    const ns = notes.filter((n) => n.run_id === r.id).sort((a, b) => String(a.number).localeCompare(String(b.number)));
    return {
      id: r.id, period: r.period, label: periodLabel(r.period), runName: runName(r.period), status: r.status, issuedAt: r.issued_at, sepaCreatedAt: r.sepa_created_at,
      totalCents: ns.reduce((a, n) => a + Number(n.total_cents ?? 0), 0), openCents: ns.filter((n) => n.status === 'issued').reduce((a, n) => a + Number(n.total_cents ?? 0), 0),
      notes: ns.map((n) => ({ id: n.id, number: n.number, status: n.status, recruiterName: n.recipient?.name ?? null, netCents: Number(n.net_cents), vatCents: Number(n.vat_cents), totalCents: Number(n.total_cents), payUntil: n.pay_until, paidOn: n.paid_on, sentAt: n.sent_at, hasPdf: !!n.pdf_path, ibanMasked: n.iban_masked })),
    };
  });
}

// ---------------------------------------------------------------------------
// 2 Erstellen
// ---------------------------------------------------------------------------

export async function createCreditRun(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const period = String(body?.period ?? '');
  must(/^\d{4}-\d{2}$/.test(period), 'Bitte den Monat des Laufs angeben.');
  const blockers = releaseBlockers('credit_note');
  must(blockers.length === 0, `Gutschriften sind noch gesperrt. Es fehlt: ${blockers.join(', ')}.`, 'conflict');
  must(today >= runOpensOn(period), `Der Lauf für ${periodLabel(period)} geht ab ${dateDe(runOpensOn(period))}.`, 'conflict');
  await assertPeriodOpen(ctx.db, today, 'Die Gutschrift');
  const issued = await issuedPeriods(ctx);
  must(!issued.includes(period), `Der Lauf für ${periodLabel(period)} ist schon erstellt.`, 'conflict');
  const { groups } = await computeRun(ctx, period);
  const ready = groups.filter((g) => !g.blocked && g.items.length);
  must(ready.length > 0, 'In diesem Lauf ist kein Posten fällig (gesperrte Posten wandern in den nächsten Lauf).', 'conflict');

  const { data: run, error: rErr } = await ctx.db.from('credit_note_runs').insert({ period, issued_by: user.id }).select('*').maybeSingle();
  if (rErr?.code === '23505') must(false, `Der Lauf für ${periodLabel(period)} ist schon erstellt.`, 'conflict');
  dbFail(rErr, 'Der Gutschriftlauf');
  const files = creditFiles(ctx);
  const bps = await rowsIn(ctx, 'recruiter_billing_profiles', '*', 'recruiter_id', ready.map((g) => g.recruiterId));
  const retention = await rowsIn(ctx, 'recruiter_payout_tranches', 'placement_id, tranche_type, amount_cents, status', 'placement_id', ready.flatMap((g) => g.items.map((i) => i.placementId)));
  const out: { number: string; name: string; totalCents: number; mailed: boolean; skipped: number }[] = [];
  const problems: string[] = [];
  for (const g of ready) {
    const bp = bps.find((b) => b.recruiter_id === g.recruiterId);
    const acct = effectiveAccount(bp, ctx.now());
    if (!acct.account) { problems.push(`${g.name}: ${acct.blocked}`); continue; }
    const noteId = crypto.randomUUID();
    const approved: DueItem[] = [];
    for (const it of g.items) {
      const { data: upd, error } = await ctx.db.from('recruiter_payout_tranches')
        .update({ status: 'approved', credit_note_id: noteId, approved_at: nowIso(ctx), approved_by: user.id })
        .eq('id', it.trancheId).in('status', ['pending', 'due']).is('credit_note_id', null).select('id').maybeSingle();
      if (error || !upd) { problems.push(`${g.name}: ${it.short} ${it.candidateName} nicht gutgeschrieben${error ? ` (${error.message})` : ''}`); continue; }
      approved.push(it);
    }
    if (!approved.length) continue;
    let inserted = false;
    const revert = async () => {
      if (inserted) return;
      for (const it of approved) await ctx.db.from('recruiter_payout_tranches').update({ status: it.status, credit_note_id: null, approved_at: null, approved_by: null }).eq('id', it.trancheId);
    };
    try {
      const net = approved.reduce((a, i) => a + i.amountCents, 0);
      const tax = creditTax(g.taxMode, net);
      const year = Number(today.slice(0, 4));
      const { data: n, error: nErr } = await ctx.db.rpc('next_document_number', { _kind: 'credit_note', _year: year, _start: NUMBERING.credit_note.startNext });
      must(!nErr && typeof n === 'number', 'Die Gutschriftnummer konnte nicht vergeben werden.');
      const number = formatNumber(NUMBERING.credit_note.template, year, n as number);
      const payUntil = creditPayUntil(today);
      const recipient = {
        name: bp.legal_name, legalForm: bp.legal_form ?? null, street: bp.street, city: [bp.postal_code, bp.city].filter(Boolean).join(' '),
        country: bp.country ?? 'DE', vatId: bp.vat_id ?? null, taxNumber: bp.tax_number ?? null, email: g.email,
      };
      const lines = approved.map((i) => ({ title: i.title, details: i.details, amountCents: i.amountCents, trancheId: i.trancheId, placementId: i.placementId, type: i.type }));
      const bytes = await renderCreditNotePdf({
        number, issuedOn: today, periodLabel: periodLabel(period), payUntil,
        recipient: { name: recipient.name, street: recipient.street, city: recipient.city, country: recipient.country, vatId: recipient.vatId, taxNumber: recipient.taxNumber },
        taxMode: g.taxMode, lines, netCents: net, vatRate: tax.vatRate, vatCents: tax.vatCents, totalCents: tax.totalCents, ibanMasked: acct.account.masked,
      });
      const path = `${year}/${number.replace(/[^\w.-]/g, '_')}.pdf`;
      await files.put(path, bytes);
      const { error: iErr } = await ctx.db.from('recruiter_credit_notes').insert({
        id: noteId, run_id: (run as any).id, recruiter_id: g.recruiterId, number, status: 'issued', issued_on: today, period, pay_until: payUntil,
        recipient, tax_mode: g.taxMode, vat_rate: tax.vatRate, net_cents: net, vat_cents: tax.vatCents, total_cents: tax.totalCents, lines,
        iban_masked: acct.account.masked, pdf_path: path,
      });
      dbFail(iErr, 'Die Gutschrift');
      inserted = true;
      // Mail H12
      let mailed = false;
      if (g.email) {
        const first = String((await profile(ctx.db, g.recruiterId))?.name || g.name).split(' ')[0];
        const later = approved.filter((i) => i.type === 'initial').map((i) => retention.find((t) => t.placement_id === i.placementId && t.tranche_type === 'retention' && ['pending', 'due'].includes(t.status))).filter(Boolean) as any[];
        const url = `${ctx.appUrl()}/recruiter/earnings?reiter=gutschriften`;
        // Mailtext in der Sprache des Headhunters (Profil); die Gutschrift (PDF) bleibt deutsch
        const l = await notifyLang(ctx.db, g.recruiterId);
        const lde = l === 'de' || l === 'de-AT' || l === 'de-CH';
        let subject: string, p1: string, legal: string, cta: string, heading: string;
        if (lde) {
          const what = approved.length === 1
            ? `für ${approved[0].type === 'initial' ? (approved[0].short === 'Core' ? 'deinen Anteil an' : 'den 1. Teil') : approved[0].type === 'retention' ? 'den 2. Teil' : 'die Auslobung'} der Besetzung von ${approved[0].candidateName}`
            : `für ${approved.length} Posten: ${approved.map((i) => `${i.short} ${i.candidateName}`).join(', ')}`;
          subject = tx(l, `Deine Gutschrift für ${monthName(period)}: ${eur(net)}${g.taxMode === 'standard' ? ' + USt' : ''}`, '', '', '');
          p1 = tx(l, m`Hallo ${first}, im Anhang ist deine Gutschrift ${what}. Wir überweisen ${eur(tax.totalCents)} bis ${dateDeShort(payUntil)} auf ${acct.account.masked}.${later.length === 1 ? ` Der 2. Teil (${eur(Number(later[0].amount_cents))}) folgt nach der Garantie.` : later.length > 1 ? ' Die 2. Teile folgen nach der Garantie.' : ''}`, '', '', '');
          legal = tx(l, 'Gutschrift im Sinne von § 14 Abs. 2 Satz 2 UStG. Einwände binnen 30 Tagen.', '', '', '');
          cta = tx(l, 'Gutschrift ansehen', '', '', '');
          heading = `Gutschrift ${number}`;
        } else {
          const part = (i: any) => i.type === 'initial' ? (i.short === 'Core' ? tx(l, '', 'your share of', 'din andel av', 'din andel av') : tx(l, '', 'the 1st part of', 'första delen av', 'første del av')) : i.type === 'retention' ? tx(l, '', 'the 2nd part of', 'andra delen av', 'andre del av') : tx(l, '', 'the bounty for', 'ersättningen för', 'dusøren for');
          const what = approved.length === 1
            ? tx(l, '', m`for ${part(approved[0])} the placement of ${approved[0].candidateName}`, m`för ${part(approved[0])} placeringen av ${approved[0].candidateName}`, m`for ${part(approved[0])} ansettelsen av ${approved[0].candidateName}`)
            : tx(l, '', m`for ${approved.length} items: ${approved.map((i) => `${i.short} ${i.candidateName}`).join(', ')}`, m`för ${approved.length} poster: ${approved.map((i) => `${i.short} ${i.candidateName}`).join(', ')}`, m`for ${approved.length} poster: ${approved.map((i) => `${i.short} ${i.candidateName}`).join(', ')}`);
          const vat = g.taxMode === 'standard' ? tx(l, '', ' + VAT', ' + moms', ' + MVA') : '';
          const total = eurL(tax.totalCents, l), until = dateKeyIn(payUntil, l), month = monthIn(period, l);
          const rest = later.length === 1 ? tx(l, '', m` The 2nd part (${eurL(Number(later[0].amount_cents), l)}) follows after the guarantee.`, m` Andra delen (${eurL(Number(later[0].amount_cents), l)}) följer efter garantin.`, m` Andre del (${eurL(Number(later[0].amount_cents), l)}) følger etter garantien.`)
            : later.length > 1 ? tx(l, '', ' The 2nd parts follow after the guarantee.', ' De andra delarna följer efter garantin.', ' De andre delene følger etter garantien.') : '';
          subject = tx(l, '', m`Your credit note for ${month}: ${eurL(net, l)}${vat}`, m`Din kreditnota för ${month}: ${eurL(net, l)}${vat}`, m`Kreditnotaen din for ${month}: ${eurL(net, l)}${vat}`);
          p1 = tx(l, '', m`Hi ${first}, attached is your credit note ${what}. We will transfer ${total} by ${until} to ${acct.account.masked}.${rest}`, m`Hej ${first}, bifogat finns din kreditnota ${what}. Vi överför ${total} senast ${until} till ${acct.account.masked}.${rest}`, m`Hei ${first}, vedlagt er kreditnotaen din ${what}. Vi overfører ${total} innen ${until} til ${acct.account.masked}.${rest}`);
          legal = tx(l, '', 'Self-billed credit note under § 14 (2) sentence 2 of the German VAT Act (UStG); the document itself is in German. Objections within 30 days.', 'Självfaktura (Gutschrift) enligt § 14.2 andra meningen i tyska momslagen (UStG); själva dokumentet är på tyska. Invändningar inom 30 dagar.', 'Selvfakturering (Gutschrift) etter § 14 nr. 2 annet punktum i tysk merverdiavgiftslov (UStG); selve dokumentet er på tysk. Innsigelser innen 30 dager.');
          cta = tx(l, '', 'View credit note', 'Visa kreditnotan', 'Se kreditnotaen');
          heading = tx(l, '', m`Credit note ${number}`, m`Kreditnota ${number}`, m`Kreditnota ${number}`);
        }
        const r = await ctx.mail({
          fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: g.email, replyTo: 'info@bluewater-bridge.de', subject,
          html: layout({ ...(lde ? {} : { lang: l }), preheader: subject, heading, body: `<p style="margin:0 0 12px 0;">${esc(p1)}</p><p style="margin:0 0 12px 0;color:#6b7280;font-size:13px;">${legal}</p>`, cta: { label: cta, url } }),
          text: `${p1}\n\n${cta}: ${url}`,
          attachments: [{ filename: `${number.replace(/[^\w.-]/g, '_')}.pdf`, contentBase64: encodeBase64(bytes), contentType: 'application/pdf' }],
        }, { template: 'credit_note_issued', meta: { credit_note_id: noteId } });
        mailed = r.sent;
        if (r.sent) await ctx.db.from('recruiter_credit_notes').update({ sent_at: nowIso(ctx) }).eq('id', noteId);
      }
      await notify(ctx, g.recruiterId, 'credit_note_issued', (l) => tx(l, m`Gutschrift ${number}: ${eurL(tax.totalCents, l)}`, m`Credit note ${number}: ${eurL(tax.totalCents, l)}`, m`Kreditnota ${number}: ${eurL(tax.totalCents, l)}`, m`Kreditnota ${number}: ${eurL(tax.totalCents, l)}`),
        (l) => tx(l, `Für ${periodLabel(period)}. Zahlung bis ${dateDeShort(payUntil)}.`, `For ${periodIn(period, l)}. Payment by ${dateKeyIn(payUntil, l)}.`, `För ${periodIn(period, l)}. Betalning senast ${dateKeyIn(payUntil, l)}.`, `For ${periodIn(period, l)}. Betaling innen ${dateKeyIn(payUntil, l)}.`), 'credit_note', noteId);
      out.push({ number, name: g.name, totalCents: tax.totalCents, mailed, skipped: g.items.length - approved.length });
    } catch (e) {
      await revert();
      problems.push(`${g.name}: ${e instanceof Error ? e.message : 'Gutschrift nicht erstellt'}`);
    }
  }
  if (!out.length) {
    await ctx.db.from('credit_note_runs').delete().eq('id', (run as any).id);
    must(false, `Keine Gutschrift erstellt. ${problems.join(' · ')}`, 'conflict');
  }
  return { ok: true, runId: (run as any).id, period, notes: out, problems };
}

/** Vorschau einer Gutschrift vor dem Erstellen (A7 „Vorschau der Gutschriften“). */
export async function creditNotePreview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const period = String(body?.period ?? '');
  must(/^\d{4}-\d{2}$/.test(period), 'Bitte den Monat des Laufs angeben.');
  const { groups } = await computeRun(ctx, period);
  const g = groups.find((x) => x.recruiterId === body?.recruiterId) ?? groups.find((x) => !x.blocked) ?? groups[0];
  must(g, 'In diesem Lauf ist kein Posten fällig.', 'not_found');
  const [bp] = await rowsIn(ctx, 'recruiter_billing_profiles', '*', 'recruiter_id', [g.recruiterId]);
  const today = todayKey(ctx.now());
  const tax = creditTax(g.taxMode, g.netCents);
  const bytes = await renderCreditNotePdf({
    number: 'VORSCHAU', issuedOn: today, periodLabel: periodLabel(period), payUntil: creditPayUntil(today),
    recipient: { name: bp?.legal_name || g.name, street: bp?.street ?? null, city: [bp?.postal_code, bp?.city].filter(Boolean).join(' ') || null, country: bp?.country ?? 'DE', vatId: bp?.vat_id ?? null, taxNumber: bp?.tax_number ?? null },
    taxMode: g.taxMode, lines: g.items.map((i) => ({ title: i.title, details: i.details, amountCents: i.amountCents })),
    netCents: g.netCents, vatRate: tax.vatRate, vatCents: tax.vatCents, totalCents: tax.totalCents, ibanMasked: g.ibanMasked,
  });
  return { pdfBase64: encodeBase64(bytes), recruiters: groups.map((x) => ({ recruiterId: x.recruiterId, name: x.name, blocked: x.blocked })), recruiterId: g.recruiterId };
}

// ---------------------------------------------------------------------------
// 3 SEPA-Datei
// ---------------------------------------------------------------------------

export const runPaymentInfoId = (period: string) => `GS-LAUF-${period}`;

export async function sepaFile(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  must(BANK.iban && BANK.holder, 'Die Bankverbindung von Matchunt fehlt (BILLING_BANK_IBAN, BILLING_BANK_HOLDER).', 'conflict');
  must(typeof body?.runId === 'string' && UUID.test(body.runId), 'Ungültiger Lauf.');
  const { data: run } = await ctx.db.from('credit_note_runs').select('*').eq('id', body.runId).maybeSingle();
  must(run, 'Lauf nicht gefunden.', 'not_found');
  const { data: notes } = await ctx.db.from('recruiter_credit_notes').select('*').eq('run_id', body.runId).eq('status', 'issued').order('number');
  const list = (notes ?? []) as any[];
  must(list.length > 0, 'In diesem Lauf ist keine Gutschrift mehr offen.', 'conflict');
  const bps = await rowsIn(ctx, 'recruiter_billing_profiles', '*', 'recruiter_id', list.map((n) => n.recruiter_id));
  const today = todayKey(ctx.now());
  const skipped: { number: string; why: string }[] = [];
  const payments = [];
  for (const n of list) {
    const acct = effectiveAccount(bps.find((b) => b.recruiter_id === n.recruiter_id), ctx.now());
    if (!acct.account) { skipped.push({ number: n.number, why: acct.blocked ?? 'Konto fehlt' }); continue; }
    if (n.iban_masked && acct.account.masked !== n.iban_masked) { skipped.push({ number: n.number, why: `Konto hat sich geändert (Gutschrift nennt ${n.iban_masked})` }); continue; }
    payments.push({ endToEndId: n.number, amountCents: Number(n.total_cents), name: acct.account.holder || n.recipient?.name || 'Headhunter', iban: acct.account.iban!, bic: acct.account.bic, remittance: `Gutschrift ${n.number} ${periodLabel((run as any).period)}` });
  }
  must(payments.length > 0, `Keine Überweisung möglich. ${skipped.map((s) => `${s.number}: ${s.why}`).join(' · ')}`, 'conflict');
  const exec = list.map((n) => String(n.pay_until ?? today)).sort()[0];
  const xml = buildPain001({
    msgId: `MATCHUNT-GS-${(run as any).period}-${Date.now().toString(36).toUpperCase()}`,
    paymentInfoId: runPaymentInfoId((run as any).period),
    createdAt: new Date(ctx.now()).toISOString(),
    executionDate: exec < today ? today : exec,
    debtor: { name: BANK.holder || ISSUER.name, iban: BANK.iban, bic: BANK.bic || null },
    payments,
  });
  const path = `sepa/${(run as any).period}-${today}.xml`;
  try { await creditFiles(ctx).put(path, new TextEncoder().encode(xml), 'application/xml'); } catch (e) { console.warn('[gutschriften] SEPA nicht abgelegt', e instanceof Error ? e.message : e); }
  await ctx.db.from('credit_note_runs').update({ sepa_path: path, sepa_created_at: nowIso(ctx) }).eq('id', (run as any).id);
  return { fileName: `SEPA-Gutschriften-${(run as any).period}.xml`, xml, count: payments.length, totalCents: payments.reduce((a, p) => a + p.amountCents, 0), executionDate: exec < today ? today : exec, skipped };
}

// ---------------------------------------------------------------------------
// 4 Ausgezahlt (aus dem Kontoauszug, A6)
// ---------------------------------------------------------------------------

export async function markCreditNotePaid(ctx: PlacementCtx, noteId: string, paidOn: string) {
  const { data: n } = await ctx.db.from('recruiter_credit_notes').select('*').eq('id', noteId).maybeSingle();
  must(n, 'Gutschrift nicht gefunden.', 'not_found');
  must((n as any).status === 'issued', 'Die Gutschrift ist schon als ausgezahlt gebucht.', 'conflict');
  const { error } = await ctx.db.from('recruiter_credit_notes').update({ status: 'paid', paid_on: paidOn }).eq('id', noteId).eq('status', 'issued');
  dbFail(error, 'Die Gutschrift');
  const { error: tErr } = await ctx.db.from('recruiter_payout_tranches').update({ status: 'paid', paid_at: `${paidOn}T12:00:00Z` }).eq('credit_note_id', noteId).eq('status', 'approved');
  if (tErr) console.warn('[gutschriften] Anteile nicht auf ausgezahlt gesetzt', tErr.message);
  if ((n as any).run_id) {
    const { data: rest } = await ctx.db.from('recruiter_credit_notes').select('id').eq('run_id', (n as any).run_id).eq('status', 'issued').limit(1);
    if (!(rest ?? []).length) await ctx.db.from('credit_note_runs').update({ status: 'paid' }).eq('id', (n as any).run_id);
  }
  await notify(ctx, (n as any).recruiter_id, 'credit_note_paid', (l) => tx(l, m`Gutschrift ${(n as any).number} ausgezahlt`, m`Credit note ${(n as any).number} paid out`, m`Kreditnota ${(n as any).number} utbetald`, m`Kreditnota ${(n as any).number} utbetalt`),
    (l) => tx(l, `${eur(Number((n as any).total_cents))} sind am ${dateDe(paidOn)} an dich überwiesen worden.`, `${eurL(Number((n as any).total_cents), l)} was transferred to you on ${dateKeyIn(paidOn, l)}.`, `${eurL(Number((n as any).total_cents), l)} har överförts till dig ${dateKeyIn(paidOn, l)}.`, `${eurL(Number((n as any).total_cents), l)} ble overført til deg ${dateKeyIn(paidOn, l)}.`), 'credit_note', noteId);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Belege und Einwände
// ---------------------------------------------------------------------------

export async function creditNoteUrl(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  must(typeof body?.creditNoteId === 'string' && UUID.test(body.creditNoteId), 'Ungültige Gutschrift.');
  const { data: n } = await ctx.db.from('recruiter_credit_notes').select('pdf_path').eq('id', body.creditNoteId).maybeSingle();
  must((n as any)?.pdf_path, 'Zur Gutschrift liegt kein PDF vor.', 'not_found');
  const url = await creditFiles(ctx).url((n as any).pdf_path, 300);
  must(url, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  return { url };
}

export async function resolveObjection(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  must(typeof body?.objectionId === 'string' && UUID.test(body.objectionId), 'Ungültiger Einwand.');
  const resolution = text(body?.resolution, 2000);
  must(resolution, 'Bitte kurz schreiben, wie der Einwand geklärt ist.');
  const { data: o, error } = await ctx.db.from('credit_note_objections').update({ status: 'resolved', resolution, resolved_at: nowIso(ctx), resolved_by: user.id }).eq('id', body.objectionId).eq('status', 'open').select('recruiter_id, credit_note_id').maybeSingle();
  dbFail(error, 'Der Einwand');
  must(o, 'Der Einwand ist schon geklärt.', 'conflict');
  await notify(ctx, (o as any).recruiter_id, 'credit_note_objection_resolved', (l) => tx(l, 'Dein Einwand ist geklärt', 'Your objection has been resolved', 'Din invändning är utredd', 'Innsigelsen din er avklart'), resolution.slice(0, 300), 'credit_note', (o as any).credit_note_id);
  return { ok: true };
}

export { periodOf, shiftPeriod, periodEnd };

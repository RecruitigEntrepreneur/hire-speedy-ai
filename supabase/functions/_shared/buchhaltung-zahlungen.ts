// deno-lint-ignore-file no-explicit-any
// Zahlungen aus dem Kontoauszug (A6). Umbau 11.11.2026.
//
// Kontoauszug hochladen (CAMT.053 oder CSV) → bank_transactions (fingerprint
// gegen Doppelimport) → je Buchung ein Vorschlag → Admin bestätigt jede Zeile
// („Buchen“, „sichere Vorschläge buchen“, „Zuordnen“, „Ausblenden“). Von selbst
// wird nichts gebucht. Eingang → invoice_payments (applyInvoicePayment),
// Abbuchung „GS-…“ → Gutschrift ausgezahlt.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeHex } from 'https://deno.land/std@0.224.0/encoding/hex.ts';
import { dbFail, must } from './interview-service.ts';
import { assertPeriodOpen, todayKey, type PlacementCtx } from './placement-service.ts';
import {
  CUSTOMER_TYPES, OPEN_STATUSES, UUID, applyInvoicePayment, namesFor, nowIso, openCentsOf, requireAdminUser, rowsIn,
} from './buchhaltung-kern.ts';
import { fingerprintKeys, parseStatement, suggestFor, type CreditRunRef, type OpenCreditNoteRef, type OpenInvoiceRef, type Suggestion } from './buchhaltung-bank.ts';
import { markCreditNotePaid, runPaymentInfoId } from './buchhaltung-gutschriften.ts';
import { periodLabel } from './buchhaltung-rechnen.ts';

const MAX_FILE_CHARS = 6_000_000;

async function sha256(s: string): Promise<string> {
  return encodeHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))));
}

// ---------------------------------------------------------------------------
// Hochladen
// ---------------------------------------------------------------------------

export async function importStatement(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const content = typeof body?.content === 'string' ? body.content : '';
  const fileName = typeof body?.fileName === 'string' ? body.fileName.slice(0, 200) : 'Kontoauszug';
  must(content.trim().length > 0, 'Die Datei ist leer.');
  must(content.length <= MAX_FILE_CHARS, 'Die Datei ist zu groß (höchstens etwa 6 MB).');
  let parsed;
  try { parsed = parseStatement(content, fileName); } catch (e) { must(false, e instanceof Error ? e.message : 'Die Datei ließ sich nicht lesen.'); }
  must(parsed!.rows.length > 0, `In der Datei steht keine Buchung${parsed!.skipped ? ` (${parsed!.skipped} Zeilen übersprungen)` : ''}.`);
  const { data: imp, error: iErr } = await ctx.db.from('bank_imports').insert({
    file_name: fileName, format: parsed!.format, period_from: parsed!.periodFrom, period_to: parsed!.periodTo, row_count: parsed!.rows.length, created_by: user.id,
  }).select('id').maybeSingle();
  dbFail(iErr, 'Der Kontoauszug');
  const keys = fingerprintKeys(parsed!.rows);
  const rows = await Promise.all(parsed!.rows.map(async (r, i) => ({
    import_id: (imp as any).id, booked_on: r.bookedOn, amount_cents: r.amountCents, counterparty: r.counterparty?.slice(0, 300) ?? null,
    counterparty_iban: r.counterpartyIban, purpose: r.purpose?.slice(0, 1000) ?? null, fingerprint: await sha256(keys[i]), status: 'open',
  })));
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await ctx.db.from('bank_transactions').upsert(rows.slice(i, i + 200), { onConflict: 'fingerprint', ignoreDuplicates: true }).select('id');
    dbFail(error, 'Die Buchungen');
    inserted += (data ?? []).length;
  }
  await ctx.db.from('bank_imports').update({ row_count: inserted }).eq('id', (imp as any).id);
  return { ok: true, format: parsed!.format, periodFrom: parsed!.periodFrom, periodTo: parsed!.periodTo, imported: inserted, duplicates: rows.length - inserted, skipped: parsed!.skipped, warnings: parsed!.warnings.slice(0, 10) };
}

// ---------------------------------------------------------------------------
// Vorschläge
// ---------------------------------------------------------------------------

async function matchTargets(ctx: PlacementCtx) {
  const { data: invs } = await ctx.db.from('invoices').select('id, invoice_number, status, invoice_type, total_amount_cents, total_amount, paid_amount_cents, recipient, placement_id, due_date, client_paid_reported_on')
    .in('status', OPEN_STATUSES).in('invoice_type', CUSTOMER_TYPES).limit(1000);
  const open = (invs ?? []) as any[];
  const placements = await rowsIn(ctx, 'placements', 'id, submission_id', 'id', open.map((i) => i.placement_id));
  const names = await namesFor(ctx, placements);
  const invoices: (OpenInvoiceRef & { dueDate: string | null })[] = open.map((i) => ({
    id: i.id, number: i.invoice_number, openCents: openCentsOf(i), totalCents: Number(i.total_amount_cents ?? 0), recipientName: i.recipient?.name ?? null,
    candidateName: names.get(i.placement_id)?.candidateName ?? null, dueDate: i.due_date,
  }));
  const { data: ns } = await ctx.db.from('recruiter_credit_notes').select('id, number, total_cents, recipient, run_id, status').eq('status', 'issued').limit(1000);
  const notes: (OpenCreditNoteRef & { runId: string | null })[] = ((ns ?? []) as any[]).map((n) => ({ id: n.id, number: n.number, totalCents: Number(n.total_cents), recruiterName: n.recipient?.name ?? null, runId: n.run_id }));
  const runIds = [...new Set(notes.map((n) => n.runId).filter(Boolean))] as string[];
  const runRows = await rowsIn(ctx, 'credit_note_runs', 'id, period', 'id', runIds);
  const runs: CreditRunRef[] = runRows.map((r) => {
    const own = notes.filter((n) => n.runId === r.id);
    return { id: r.id, period: periodLabel(r.period), refs: [runPaymentInfoId(r.period)], openTotalCents: own.reduce((a, n) => a + n.totalCents, 0), openCount: own.length };
  }).filter((r) => r.openCount > 1);
  return { invoices, notes, runs, reported: open.filter((i) => i.client_paid_reported_on) };
}

const txView = (t: any, s: Suggestion | null) => ({
  id: t.id, bookedOn: t.booked_on, amountCents: Number(t.amount_cents), counterparty: t.counterparty, counterpartyIban: t.counterparty_iban, purpose: t.purpose,
  status: t.status, invoiceId: t.invoice_id, creditNoteId: t.credit_note_id, bookedAt: t.booked_at, suggestion: s,
});

export async function paymentsOverview(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const [{ data: lastImp }, { data: open, error }, { data: booked }, { count: hidden }] = await Promise.all([
    ctx.db.from('bank_imports').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ctx.db.from('bank_transactions').select('*').eq('status', 'open').order('booked_on', { ascending: false }).limit(500),
    ctx.db.from('bank_transactions').select('*').eq('status', 'booked').order('booked_at', { ascending: false }).limit(30),
    ctx.db.from('bank_transactions').select('id', { count: 'exact', head: true }).eq('status', 'hidden'),
  ]);
  dbFail(error, 'Die Buchungen');
  const t = await matchTargets(ctx);
  const rows = ((open ?? []) as any[]).map((x) => txView(x, suggestFor({ amountCents: Number(x.amount_cents), purpose: x.purpose, counterparty: x.counterparty }, t.invoices, t.notes, t.runs)));
  const numberOf = new Map(t.invoices.map((i) => [i.id, i.number]));
  const bookedInv = await rowsIn(ctx, 'invoices', 'id, invoice_number', 'id', ((booked ?? []) as any[]).map((b) => b.invoice_id));
  const bookedNotes = await rowsIn(ctx, 'recruiter_credit_notes', 'id, number', 'id', ((booked ?? []) as any[]).map((b) => b.credit_note_id));
  const placements = await rowsIn(ctx, 'placements', 'id, submission_id', 'id', t.reported.map((i) => i.placement_id));
  const names = await namesFor(ctx, placements);
  return {
    lastImport: lastImp ? { fileName: (lastImp as any).file_name, format: (lastImp as any).format, periodFrom: (lastImp as any).period_from, periodTo: (lastImp as any).period_to, rows: (lastImp as any).row_count, createdAt: (lastImp as any).created_at } : null,
    open: rows,
    safeCount: rows.filter((r) => r.suggestion?.safe).length,
    booked: ((booked ?? []) as any[]).map((b) => ({ ...txView(b, null), target: bookedInv.find((i) => i.id === b.invoice_id)?.invoice_number ?? bookedNotes.find((n) => n.id === b.credit_note_id)?.number ?? null })),
    hiddenCount: hidden ?? 0,
    reported: t.reported.map((i) => ({ id: i.id, number: i.invoice_number, candidateName: names.get(i.placement_id)?.candidateName ?? null, reportedOn: i.client_paid_reported_on, openCents: openCentsOf(i) })),
    targets: {
      invoices: t.invoices.map((i) => ({ id: i.id, number: i.number, openCents: i.openCents, recipient: i.recipientName, candidateName: i.candidateName })),
      creditNotes: t.notes.map((n) => ({ id: n.id, number: n.number, totalCents: n.totalCents, recruiterName: n.recruiterName })),
    },
    invoiceNumbers: Object.fromEntries(numberOf),
  };
}

// ---------------------------------------------------------------------------
// Buchen, Zuordnen, Ausblenden
// ---------------------------------------------------------------------------

async function loadTx(ctx: PlacementCtx, id: unknown) {
  must(typeof id === 'string' && UUID.test(id), 'Ungültige Buchung.');
  const { data, error } = await ctx.db.from('bank_transactions').select('*').eq('id', id).maybeSingle();
  dbFail(error, 'Die Buchung');
  must(data, 'Buchung nicht gefunden.', 'not_found');
  return data as any;
}

async function bookOne(ctx: PlacementCtx, user: User, tx: any, target: { kind: string; id: string }) {
  must(tx.status === 'open', 'Die Buchung ist schon erledigt.', 'conflict');
  await assertPeriodOpen(ctx.db, tx.booked_on, 'Die Buchung');
  const amount = Number(tx.amount_cents);
  const at = nowIso(ctx);
  if (target.kind === 'invoice') {
    must(amount > 0, 'Eine Abbuchung lässt sich keiner Rechnung zuordnen.', 'conflict');
    const { data: inv } = await ctx.db.from('invoices').select('*').eq('id', target.id).maybeSingle();
    must(inv, 'Rechnung nicht gefunden.', 'not_found');
    const open = openCentsOf(inv);
    must(amount <= open, `Der Betrag ist höher als offen (${(open / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €). Bitte von Hand klären.`, 'conflict');
    // Erst die Buchung belegen (verhindert doppeltes Buchen), dann die Zahlung
    const { data: claimed } = await ctx.db.from('bank_transactions').update({ status: 'booked', invoice_id: target.id, booked_at: at, booked_by: user.id }).eq('id', tx.id).eq('status', 'open').select('id').maybeSingle();
    must(claimed, 'Die Buchung ist schon erledigt.', 'conflict');
    try {
      const r = await applyInvoicePayment(ctx, inv, { amountCents: amount, paidOn: tx.booked_on, source: 'bank', bankTransactionId: tx.id, note: null, actorId: user.id });
      return { kind: 'invoice', number: (inv as any).invoice_number, status: r.status, openCents: r.openCents };
    } catch (e) {
      await ctx.db.from('bank_transactions').update({ status: 'open', invoice_id: null, booked_at: null, booked_by: null }).eq('id', tx.id);
      throw e;
    }
  }
  if (target.kind === 'credit_note') {
    must(amount < 0, 'Ein Eingang ist keine Auszahlung einer Gutschrift.', 'conflict');
    const { data: n } = await ctx.db.from('recruiter_credit_notes').select('id, number, total_cents, status').eq('id', target.id).maybeSingle();
    must(n, 'Gutschrift nicht gefunden.', 'not_found');
    must(-amount === Number((n as any).total_cents), 'Der Betrag passt nicht zur Gutschrift. Bitte von Hand klären.', 'conflict');
    const { data: claimed } = await ctx.db.from('bank_transactions').update({ status: 'booked', credit_note_id: target.id, booked_at: at, booked_by: user.id }).eq('id', tx.id).eq('status', 'open').select('id').maybeSingle();
    must(claimed, 'Die Buchung ist schon erledigt.', 'conflict');
    try { await markCreditNotePaid(ctx, target.id, tx.booked_on); } catch (e) {
      await ctx.db.from('bank_transactions').update({ status: 'open', credit_note_id: null, booked_at: null, booked_by: null }).eq('id', tx.id);
      throw e;
    }
    return { kind: 'credit_note', number: (n as any).number };
  }
  if (target.kind === 'credit_run') {
    must(amount < 0, 'Ein Eingang ist keine Sammelüberweisung.', 'conflict');
    const { data: ns } = await ctx.db.from('recruiter_credit_notes').select('id, number, total_cents').eq('run_id', target.id).eq('status', 'issued');
    const list = (ns ?? []) as any[];
    must(list.length && -amount === list.reduce((a, n) => a + Number(n.total_cents), 0), 'Die Summe passt nicht zu den offenen Gutschriften des Laufs.', 'conflict');
    const { data: claimed } = await ctx.db.from('bank_transactions').update({ status: 'booked', booked_at: at, booked_by: user.id }).eq('id', tx.id).eq('status', 'open').select('id').maybeSingle();
    must(claimed, 'Die Buchung ist schon erledigt.', 'conflict');
    for (const n of list) await markCreditNotePaid(ctx, n.id, tx.booked_on);
    return { kind: 'credit_run', number: `${list.length} Gutschriften` };
  }
  must(false, 'Bitte eine Rechnung oder Gutschrift wählen.');
}

export async function bookTransaction(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const tx = await loadTx(ctx, body?.transactionId);
  let target = body?.target && typeof body.target.id === 'string' && UUID.test(body.target.id) && ['invoice', 'credit_note', 'credit_run'].includes(body.target.kind) ? { kind: body.target.kind, id: body.target.id } : null;
  if (!target) {
    const t = await matchTargets(ctx);
    const s = suggestFor({ amountCents: Number(tx.amount_cents), purpose: tx.purpose, counterparty: tx.counterparty }, t.invoices, t.notes, t.runs);
    must(s.kind !== 'none' && s.targetId, 'Für diese Buchung gibt es keinen Vorschlag. Bitte zuordnen.', 'conflict');
    target = { kind: s.kind, id: s.targetId! };
  }
  return { ok: true, ...(await bookOne(ctx, user, tx, target)) };
}

/** Alle sicheren Vorschläge buchen (der Admin bestätigt mit dem Knopf). */
export async function bookSafeSuggestions(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const { data: open } = await ctx.db.from('bank_transactions').select('*').eq('status', 'open').order('booked_on', { ascending: true }).limit(500);
  let booked = 0;
  const problems: string[] = [];
  const t = await matchTargets(ctx);
  for (const tx of (open ?? []) as any[]) {
    const amount = Number(tx.amount_cents);
    const s = suggestFor({ amountCents: amount, purpose: tx.purpose, counterparty: tx.counterparty }, t.invoices, t.notes, t.runs);
    if (!s.safe || !s.targetId) continue;
    try {
      await bookOne(ctx, user, tx, { kind: s.kind, id: s.targetId });
      booked += 1;
      // Ziele nachführen: eine Teilzahlung ändert den offenen Betrag
      if (s.kind === 'invoice') {
        const i = t.invoices.find((x) => x.id === s.targetId);
        if (i) i.openCents -= amount;
        t.invoices = t.invoices.filter((x) => x.openCents > 0);
      } else if (s.kind === 'credit_note') {
        t.notes = t.notes.filter((x) => x.id !== s.targetId);
      } else if (s.kind === 'credit_run') {
        t.notes = t.notes.filter((x) => x.runId !== s.targetId);
        t.runs = t.runs.filter((x) => x.id !== s.targetId);
      }
    } catch (e) { problems.push(`${tx.booked_on} · ${s.label}: ${e instanceof Error ? e.message : 'nicht gebucht'}`); }
  }
  return { ok: true, booked, problems };
}

export async function hideTransaction(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const tx = await loadTx(ctx, body?.transactionId);
  const hide = body?.hide !== false;
  must(hide ? tx.status === 'open' : tx.status === 'hidden', hide ? 'Die Buchung ist schon erledigt.' : 'Die Buchung ist nicht ausgeblendet.', 'conflict');
  const { error } = await ctx.db.from('bank_transactions').update({ status: hide ? 'hidden' : 'open', booked_at: hide ? nowIso(ctx) : null, booked_by: hide ? user.id : null }).eq('id', tx.id);
  dbFail(error, 'Die Buchung');
  return { ok: true };
}

export async function hiddenTransactions(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const { data } = await ctx.db.from('bank_transactions').select('*').eq('status', 'hidden').order('booked_on', { ascending: false }).limit(200);
  return { rows: ((data ?? []) as any[]).map((x) => txView(x, null)) };
}

export { todayKey };

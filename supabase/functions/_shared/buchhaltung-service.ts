// deno-lint-ignore-file no-explicit-any
// Admin › Besetzungen (A1–A3, A5). Umbau 11.11.2026.
//
//   A1 Fahrplan     je Besetzung Fassung, Beträge (Kunde, Headhunter 1. + 2. Teil,
//                   Matchunt) und genau ein nächster Schritt; Kennzahlen.
//   A2 Rechnungen   Liste mit Stand, Menü ⋯ (PDF, Mail erneut, Korrigieren,
//                   Stornieren, Zahlung von Hand).
//   A3 Prüfen       Prüfliste (Land → Steuerfall, Leistungsdatum, Betrag aus Paket ×
//                   Gehalt, Zahlungsziel, Bestellnummer/„folgt“ ab Tag 7, Frist).
//   A5 Storno       Stornorechnung (negativ, eigener Nummernkreis) und bei Korrektur
//                   eine neue Rechnung. Der alte Beleg bleibt unverändert (GoBD).
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { dbFail, must } from './interview-service.ts';
import {
  PACKAGE_NAMES, assertPeriodOpen, bookPayment, docOf, loadInvoice, notify, refreshDraft, releaseInvoiceCore, signedOnOf, todayKey,
  type PlacementCtx,
} from './placement-service.ts';
import { COUNTRY_NAMES, NUMBERING, formatNumber, releaseBlockers, taxCaseFor } from './billing-config.ts';
import { eur, renderInvoicePdf } from './invoice-pdf.ts';
import { layout } from './intake-mail.ts';
import { isPackageKey, versionOfSnapshot } from './konditionen.ts';
import {
  CUSTOMER_TYPES, EMAIL, OPEN_STATUSES, UUID, customerRecipients, esc, mailCustomer, namesFor, nowIso, openCentsOf, requireAdminUser, rowsIn, text,
} from './buchhaltung-kern.ts';
import {
  dateDe, dateDeShort, dunningOptions, nextStep, poFollowsFrom, releaseDeadline, runName, workdaysUntil, periodOf,
} from './buchhaltung-rechnen.ts';
import { nextRunSummary, trancheContext } from './buchhaltung-gutschriften.ts';

const PKG_SHORT: Record<string, string> = { core: 'Core', continuity_90: 'C90', continuity_180: 'C180' };

function packageLabel(p: any): string {
  if (p.replaces_placement_id) return 'Nachbesetzung';
  const key = isPackageKey(p.package_key) ? p.package_key : null;
  if (!key) return '–';
  if (key === 'core') return 'Core';
  const v = Number(p.conditions_version) || versionOfSnapshot(p.pricing_snapshot);
  return `${PKG_SHORT[key]} Fassung ${v}`;
}

/** Die Rechnung, um die es im Fahrplan gerade geht: Entwurf vor offen vor bezahlt. */
function currentInvoice(invs: any[]) {
  const live = invs.filter((i) => CUSTOMER_TYPES.includes(i.invoice_type ?? 'placement_fee') && i.status !== 'cancelled');
  return live.find((i) => i.status === 'draft')
    ?? live.find((i) => OPEN_STATUSES.includes(i.status))
    ?? live.find((i) => ['placement_fee', 'salary_difference'].includes(i.invoice_type ?? 'placement_fee'))
    ?? null;
}

// ---------------------------------------------------------------------------
// A1 + A2: Übersicht
// ---------------------------------------------------------------------------

export async function overview(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const [{ data: placementRows, error: pErr }, { data: invoiceRows, error: iErr }] = await Promise.all([
    ctx.db.from('placements').select('*').order('created_at', { ascending: false }).limit(400),
    ctx.db.from('invoices').select('*').order('created_at', { ascending: false }).limit(800),
  ]);
  dbFail(pErr, 'Die Besetzungen');
  dbFail(iErr, 'Die Rechnungen');
  const placements = (placementRows ?? []) as any[];
  const invoices = (invoiceRows ?? []) as any[];
  const known = new Set(placements.map((p) => p.id));
  const extra = await rowsIn(ctx, 'placements', '*', 'id', invoices.map((i) => i.placement_id).filter((id) => id && !known.has(id)));
  const allPlacements = [...placements, ...extra];
  const pIds = placements.map((p) => p.id);
  const [names, tranches, claims, offers, reminders, profiles] = await Promise.all([
    namesFor(ctx, allPlacements),
    rowsIn(ctx, 'recruiter_payout_tranches', '*', 'placement_id', pIds),
    rowsIn(ctx, 'continuity_claims', 'id, placement_id, status, kind', 'placement_id', pIds),
    rowsIn(ctx, 'research_offers', 'placement_id, decision, status, valid_until', 'placement_id', pIds),
    rowsIn(ctx, 'invoice_reminders', 'invoice_id, level, sent_at, pay_until, created_at', 'invoice_id', invoices.map((i) => i.id)),
    rowsIn(ctx, 'company_profiles', 'user_id, purchase_order_required', 'user_id', [...new Set(invoices.map((i) => i.client_id))]),
  ]);
  const notes = await rowsIn(ctx, 'recruiter_credit_notes', 'id, number, pay_until, status', 'id', tranches.map((t) => t.credit_note_id));
  const tc = await trancheContext(ctx, tranches, allPlacements);
  const run = await nextRunSummary(ctx);
  const byNumber = new Map(invoices.map((i) => [i.id, i.invoice_number]));
  const remBy = (id: string) => reminders.filter((r) => r.invoice_id === id).map((r) => ({ level: Number(r.level), payUntil: r.pay_until, sentAt: r.sent_at ?? r.created_at }));

  const invView = (i: any) => {
    const p = allPlacements.find((x) => x.id === i.placement_id);
    const n = names.get(i.placement_id);
    const open = OPEN_STATUSES.includes(i.status);
    const signed = signedOnOf(i);
    const releaseBy = i.status === 'draft' && signed ? releaseDeadline(signed) : null;
    const rem = remBy(i.id);
    const opts = dunningOptions({ status: i.status, dueDate: i.due_date, today, reminderSentAt: i.reminder_sent_at, reminders: rem });
    const last = rem.filter((r) => r.level >= 1).sort((a, b) => b.level - a.level)[0] ?? null;
    const poRequired = !!profiles.find((c) => c.user_id === i.client_id)?.purchase_order_required;
    return {
      id: i.id, number: i.status === 'draft' ? null : i.invoice_number, type: i.invoice_type ?? 'placement_fee', status: i.status,
      issuedAt: i.issued_at, dueDate: i.due_date, signedOn: signed,
      netCents: Number(i.amount_cents ?? Math.round(Number(i.amount ?? 0) * 100)), totalCents: Number(i.total_amount_cents ?? Math.round(Number(i.total_amount ?? 0) * 100)),
      paidCents: Number(i.paid_amount_cents ?? 0), openCents: open ? openCentsOf(i) : 0, paidAt: i.paid_at ? String(i.paid_at).slice(0, 10) : null,
      recipient: i.recipient?.name ?? n?.companyName ?? null, email: i.recipient?.email ?? null,
      candidateName: n?.candidateName ?? null, jobTitle: n?.jobTitle ?? null, placementId: i.placement_id,
      overdue: open && !!i.due_date && i.due_date < today,
      releaseBy, workdaysLeft: releaseBy ? workdaysUntil(today, releaseBy) : null,
      purchaseOrder: i.purchase_order ?? p?.purchase_order ?? null, poFollows: !!i.po_follows, poRequired,
      reminderSentAt: i.reminder_sent_at ?? rem.find((r) => r.level === 0)?.sentAt ?? null,
      dunningLevel: Number(i.dunning_level ?? 0), lastDunning: last ? { level: last.level, sentAt: last.sentAt, payUntil: last.payUntil } : null,
      dunningAllowed: opts.some((o) => o.allowed),
      hasPdf: !!i.pdf_path, sentAt: i.sent_at, sentTo: i.sent_to,
      cancelledAt: i.cancelled_at ?? null, cancelledByNumber: i.cancelled_by_invoice_id ? byNumber.get(i.cancelled_by_invoice_id) ?? null : null,
      correctsNumber: i.corrects_invoice_id ? byNumber.get(i.corrects_invoice_id) ?? null : null, cancelReason: i.cancel_reason ?? null,
      reportedPaidOn: i.client_paid_reported_on ?? null,
    };
  };
  const list = invoices.map(invView);

  const rows = placements.map((p) => {
    const n = names.get(p.id);
    const invs = invoices.filter((i) => i.placement_id === p.id);
    const inv = currentInvoice(invs);
    const iv = inv ? list.find((x) => x.id === inv.id)! : null;
    const ts = tranches.filter((t) => t.placement_id === p.id);
    const claimOpen = claims.some((c) => c.placement_id === p.id && ['submitted', 'in_review'].includes(c.status));
    const offer = offers.find((o) => o.placement_id === p.id);
    const coreNonStart = (p.package_key ?? 'core') === 'core' && !!p.non_start_reported_at && !offer && !p.client_sphere_at && !p.replaces_placement_id;
    const trancheView = ts.map((t) => {
      const d = tc.due(t);
      const note = t.credit_note_id ? notes.find((x) => x.id === t.credit_note_id) : null;
      const short = t.tranche_type === 'retention' ? '2. Teil' : t.tranche_type === 'research_bounty' ? 'Auslobung' : (p.package_key ?? 'core') === 'core' ? 'Anteil' : '1. Teil';
      const runFor = d.due && d.since ? (periodOf(d.since) < run.period ? run.period : periodOf(d.since)) : null;
      return { type: t.tranche_type, label: short, status: t.status, amountCents: Number(t.amount_cents ?? 0), dueNow: d.due, dueSince: d.since, waitingFor: d.waitingFor, runName: runFor ? runName(runFor) : null, creditNoteNumber: note?.number ?? null, payUntil: note?.pay_until ?? null };
    });
    const feeExpected = p.replaces_placement_id ? Number(p.pricing_snapshot?.differenceFeeCents ?? 0) > 0 : Number(p.client_fee_cents ?? 0) > 0;
    const dueT = trancheView.find((t) => t.dueNow);
    const step = nextStep({
      today, openClaim: claimOpen, coreNonStartOpen: coreNonStart, startContested: !!p.start_contested_at && !p.start_fixed_at,
      feeExpected,
      invoice: inv ? { status: inv.status, dueDate: inv.due_date, releaseBy: iv?.releaseBy ?? null, reminderSentAt: iv?.reminderSentAt ?? null, dunningLevel: iv?.dunningLevel ?? 0, lastDunningPayUntil: iv?.lastDunning?.payUntil ?? null, dunningAllowed: !!iv?.dunningAllowed } : null,
      placementState: p.placement_state, startFixed: !!p.start_fixed_at || ['started', 'completed', 'ended_early'].includes(p.placement_state),
      firstDay: p.first_working_day ?? p.start_date, startReported: p.start_report_kind === 'started' && !!p.start_reported_at,
      research: { state: p.research_state, since: p.research_started_at ?? null },
      tranches: trancheView.map((t) => ({ label: t.label, status: t.status, dueNow: t.dueNow, creditNoteNumber: t.creditNoteNumber, payUntil: t.payUntil })),
      retention: { state: p.retention_state, releaseDate: p.retention_release_date, continuityEnd: p.continuity_end_date },
      runName: dueT?.runName ?? run.runName,
    });
    const initial = trancheView.find((t) => t.type === 'initial');
    const retention = trancheView.find((t) => t.type === 'retention');
    const bounty = trancheView.find((t) => t.type === 'research_bounty');
    const orig = p.replaces_placement_id ? allPlacements.find((x) => x.id === p.replaces_placement_id) : null;
    return {
      placementId: p.id, submissionId: p.submission_id, candidateName: n?.candidateName ?? 'Kandidat', companyName: n?.companyName ?? '', jobTitle: n?.jobTitle ?? '',
      recruiterName: n?.recruiterName ?? null, recruiterFirst: n?.recruiterFirst ?? null, packageKey: p.package_key, packageLabel: packageLabel(p),
      conditionsVersion: Number(p.conditions_version) || versionOfSnapshot(p.pricing_snapshot), startDate: p.first_working_day ?? p.start_date,
      placementState: p.placement_state, invoiceState: p.invoice_state, researchState: p.research_state,
      clientFeeCents: p.replaces_placement_id ? Number(p.pricing_snapshot?.differenceFeeCents ?? 0) : Number(p.client_fee_cents ?? 0),
      recruiterInitialCents: Number(p.recruiter_initial_cents ?? initial?.amountCents ?? 0), recruiterRetentionCents: Number(p.recruiter_retention_cents ?? retention?.amountCents ?? 0),
      bountyCents: bounty?.amountCents ?? null, matchuntCents: Number(p.matchunt_cents ?? 0), core: (p.package_key ?? 'core') === 'core',
      replacementFor: orig ? (names.get(orig.id)?.candidateName ?? 'erste Besetzung') : null,
      invoice: iv ? { id: iv.id, number: iv.number, status: iv.status, totalCents: iv.totalCents, openCents: iv.openCents, dueDate: iv.dueDate, overdue: iv.overdue } : null,
      claimId: claimOpen ? claims.find((c) => c.placement_id === p.id && ['submitted', 'in_review'].includes(c.status))?.id ?? null : null,
      tranches: trancheView,
      next: step,
    };
  });

  const drafts = list.filter((i) => i.status === 'draft');
  const customer = list.filter((i) => CUSTOMER_TYPES.includes(i.type) && OPEN_STATUSES.includes(i.status));
  return {
    today,
    rows,
    invoices: list,
    kpis: {
      drafts: drafts.length,
      draftsUntil: drafts.map((d) => d.releaseBy).filter(Boolean).sort()[0] ?? null,
      openCents: customer.reduce((a, i) => a + i.openCents, 0),
      overdueCents: customer.filter((i) => i.overdue).reduce((a, i) => a + i.openCents, 0),
      dunnable: customer.filter((i) => i.overdue && i.dunningAllowed).length,
      run,
    },
    blockers: [...new Set([...releaseBlockers('invoice'), ...releaseBlockers('credit_note'), ...releaseBlockers('cancellation')])],
  };
}

// ---------------------------------------------------------------------------
// A3: Rechnung prüfen
// ---------------------------------------------------------------------------

export interface Check { key: string; state: 'ok' | 'fail' | 'info'; label: string }

async function checksFor(ctx: PlacementCtx, raw: any) {
  must(raw.status === 'draft', 'Die Rechnung ist schon gestellt.', 'conflict');
  const today = todayKey(ctx.now());
  const fresh = await refreshDraft(ctx.db, raw);
  const inv = fresh.inv;
  const cp = fresh.company;
  const { data: p } = inv.placement_id ? await ctx.db.from('placements').select('*').eq('id', inv.placement_id).maybeSingle() : { data: null };
  const pl = p as any;
  const checks: Check[] = [];
  const firm = cp.legal_name || cp.company_name || inv.recipient?.name || 'dem Kunden';

  // Anschrift und Land → Steuerfall
  const country = inv.recipient?.country ? String(inv.recipient.country).toUpperCase() : null;
  const taxText = fresh.tax.taxCase === 'domestic' ? '19 % USt' : fresh.tax.taxCase === 'reverse_charge' ? 'Reverse Charge, ohne USt' : 'nicht im Inland steuerbar, ohne USt';
  if (!inv.recipient?.street || !inv.recipient?.city) checks.push({ key: 'address', state: 'fail', label: 'Anschrift fehlt (Straße, PLZ und Ort in den Rechnungsdaten des Kunden)' });
  else if (fresh.tax.missing) checks.push({ key: 'address', state: 'fail', label: `${fresh.tax.missing} fehlt` });
  else if (!country) {
    if (/^\d{5}$/.test(String(fresh.postalCode).trim()) && fresh.tax.taxCase === 'domestic') checks.push({ key: 'address', state: 'ok', label: 'Anschrift vollständig · Land fehlt, laut PLZ Deutschland → 19 % USt' });
    else checks.push({ key: 'address', state: 'fail', label: 'Land fehlt (Rechnungsdaten des Kunden)' });
  } else checks.push({ key: 'address', state: 'ok', label: `Anschrift und Land: ${COUNTRY_NAMES[country] ?? country} → ${taxText}` });

  // Leistungsdatum
  const signed = signedOnOf(inv);
  checks.push(signed ? { key: 'service', state: 'ok', label: `Leistungsdatum: Unterschrift ${dateDe(signed)}` } : { key: 'service', state: 'fail', label: 'Leistungsdatum fehlt' });

  // Betrag aus Paket × Gehalt
  const net = Number(inv.amount_cents ?? 0);
  if (net <= 0) checks.push({ key: 'amount', state: 'fail', label: 'Betrag 0 €' });
  else if ((inv.invoice_type ?? 'placement_fee') === 'placement_fee') {
    const expected = pl ? Number(pl.client_fee_cents ?? 0) : null;
    const pct = pl?.pricing_snapshot?.clientFeePct ?? inv.pricing_snapshot?.clientFeePct;
    const gross = Number(pl?.gross_annual_target_compensation_cents ?? 0);
    const pkg = PACKAGE_NAMES[pl?.package_key ?? '']?.replace('Matchunt ', '') ?? '';
    if (expected != null && expected !== net) checks.push({ key: 'amount', state: 'fail', label: `Betrag ${eur(net)} weicht von der Besetzung ab (${eur(expected)})` });
    else checks.push({ key: 'amount', state: 'ok', label: `Betrag ${eur(net)} netto aus ${pkg ? `${pkg} ` : ''}${pct != null ? `${String(pct).replace('.', ',')} % × ` : ''}${eur(gross)}` });
  } else if (inv.invoice_type === 'salary_difference') {
    const exp = Number(pl?.pricing_snapshot?.differenceFeeCents ?? 0);
    checks.push(exp && exp !== net ? { key: 'amount', state: 'fail', label: `Betrag ${eur(net)} weicht vom Unterschied ab (${eur(exp)})` } : { key: 'amount', state: 'ok', label: `Betrag ${eur(net)} netto: Honorar auf den Unterschied zum höheren Gehalt` });
  } else {
    checks.push({ key: 'amount', state: 'ok', label: `Betrag ${eur(net)} netto: angenommenes Angebot zur Nachbesetzung` });
  }

  // Zahlungsziel
  checks.push({ key: 'terms', state: 'ok', label: `Zahlungsziel ${inv.payment_terms_days} Tage ${fresh.termsSource === 'mandate' ? 'aus dem Auftrag' : '(Standard des Rahmenvertrags)'}` });

  // Bestellnummer
  let poFollowsPossible = false;
  if (inv.purchase_order) checks.push({ key: 'po', state: 'ok', label: `Bestellnummer ${inv.purchase_order}` });
  else if (!cp.purchase_order_required) checks.push({ key: 'po', state: 'info', label: `Bestellnummer bei ${firm} keine Pflicht` });
  else {
    const from = signed ? poFollowsFrom(signed) : null;
    if (from && today >= from) { poFollowsPossible = true; checks.push({ key: 'po', state: 'info', label: `Bestellnummer fehlt · seit ${dateDe(from)} mit Vermerk „Bestellnummer folgt“ möglich` }); }
    else checks.push({ key: 'po', state: 'fail', label: `Bestellnummer fehlt (Pflicht bei ${firm})${from ? ` · ohne Nummer ab ${dateDe(from)} möglich` : ''}` });
  }

  // Frist
  if (signed) {
    const by = releaseDeadline(signed);
    const left = workdaysUntil(today, by);
    checks.push({ key: 'deadline', state: 'info', label: left >= 0 ? `Frist: freigeben bis ${dateDe(by)}, noch ${left} ${left === 1 ? 'Werktag' : 'Werktage'}` : `Frist: freigeben bis ${dateDe(by)}, seit ${-left} ${left === -1 ? 'Werktag' : 'Werktagen'} vorbei` });
  }

  // Nummernkreis und Bank
  for (const b of releaseBlockers('invoice')) checks.push({ key: 'config', state: 'fail', label: `${b} fehlt` });

  const rec = await customerRecipients(ctx, inv);
  return { inv, checks, poFollowsPossible, email: rec.to, cc: rec.cc, company: firm, placement: pl };
}

export async function invoiceCheck(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const raw = await loadInvoice(ctx.db, body?.invoiceId);
  const c = await checksFor(ctx, raw);
  const n = c.placement ? (await namesFor(ctx, [c.placement])).get(c.placement.id) : null;
  const bytes = await renderInvoicePdf(docOf(c.inv, { poFollows: c.poFollowsPossible }));
  return {
    invoice: {
      id: c.inv.id, company: c.company, totalCents: Number(c.inv.total_amount_cents ?? 0), netCents: Number(c.inv.amount_cents ?? 0),
      candidateName: n?.candidateName ?? null, jobTitle: n?.jobTitle ?? null, type: c.inv.invoice_type,
    },
    pdfBase64: encodeBase64(bytes),
    checks: c.checks,
    canRelease: !c.checks.some((x) => x.state === 'fail'),
    poFollowsPossible: c.poFollowsPossible,
    email: c.email, cc: c.cc,
  };
}

export async function releaseChecked(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const raw = await loadInvoice(ctx.db, body?.invoiceId);
  const c = await checksFor(ctx, raw);
  const fails = c.checks.filter((x) => x.state === 'fail');
  must(!fails.length, `Freigabe gesperrt: ${fails.map((f) => f.label).join(' · ')}`, 'conflict');
  must(!c.poFollowsPossible || body?.poFollows !== false, 'Ohne Bestellnummer nur mit dem Vermerk „Bestellnummer folgt“.', 'conflict');
  const email = typeof body?.email === 'string' && body.email.trim() ? body.email.trim() : c.email;
  must(email && EMAIL.test(email), 'Bitte die Rechnungs-E-Mail des Kunden angeben.');
  return await releaseInvoiceCore(ctx, raw, user.id, email, { poFollows: c.poFollowsPossible });
}

// ---------------------------------------------------------------------------
// A2 ⋯: PDF, Mail erneut senden, Zahlung von Hand
// ---------------------------------------------------------------------------

export async function invoiceUrl(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  if (inv.status === 'draft' || !inv.pdf_path) {
    const fresh = inv.status === 'draft' ? (await refreshDraft(ctx.db, inv)).inv : inv;
    return { pdfBase64: encodeBase64(await renderInvoicePdf(docOf(fresh))) };
  }
  const url = await ctx.invoiceFiles.url(inv.pdf_path, 300);
  must(url, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  return { url };
}

export async function resendInvoice(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  must(inv.status !== 'draft' && inv.pdf_path, 'Die Rechnung ist noch nicht gestellt.', 'conflict');
  const bytes = await ctx.invoiceFiles.get(inv.pdf_path);
  must(bytes, 'Das PDF ist gerade nicht abrufbar.', 'not_found');
  const storno = inv.invoice_type === 'cancellation';
  const title = `${storno ? 'Stornorechnung' : 'Rechnung'} ${inv.invoice_number}`;
  const override = typeof body?.email === 'string' && EMAIL.test(body.email.trim()) ? body.email.trim() : null;
  const html = [
    'Guten Tag,',
    `anbei noch einmal unsere ${esc(title)} über ${esc(eur(Number(inv.total_amount_cents ?? 0)))}${!storno && inv.due_date ? `, zahlbar bis ${esc(dateDe(inv.due_date))}` : ''}.`,
    'Bei Fragen antworten Sie einfach auf diese Mail.',
  ];
  const att = [{ filename: `${String(inv.invoice_number).replace(/[^\w.-]/g, '_')}.pdf`, contentBase64: encodeBase64(bytes!), contentType: 'application/pdf' }];
  let sentTo: string[] = [];
  if (override) {
    const r = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: override, replyTo: 'info@bluewater-bridge.de', subject: `${title} – Matchunt`, html: layout({ preheader: title, heading: title, body: html.map((p) => `<p style="margin:0 0 12px 0;">${p}</p>`).join('') }), text: html.join('\n\n'), attachments: att }, { template: 'invoice_resent', meta: { invoice_id: inv.id } });
    if (r.sent) sentTo = [override];
  } else {
    const r = await mailCustomer(ctx, inv, { subject: `${title} – Matchunt`, heading: title, paragraphs: html, text: html.join('\n\n'), attachments: att, template: 'invoice_resent', meta: { invoice_id: inv.id } });
    sentTo = r.sentTo;
  }
  must(sentTo.length, 'Die Mail konnte nicht verschickt werden.', 'upstream_error');
  await ctx.db.from('invoices').update({ sent_at: nowIso(ctx), sent_to: sentTo.join(', ') }).eq('id', inv.id);
  return { ok: true, sentTo };
}

/** Notweg: Zahlung von Hand (bucht invoice_payments und startet ggf. die Nachbesetzung). */
export const manualPayment = (ctx: PlacementCtx, user: User, body: any) => bookPayment(ctx, user, body);

// ---------------------------------------------------------------------------
// A5: Stornieren oder Korrigieren
// ---------------------------------------------------------------------------

async function correctionContext(ctx: PlacementCtx, inv: any) {
  must(inv.status !== 'draft', 'Ein Entwurf wird nicht storniert, nur geprüft.', 'conflict');
  must(CUSTOMER_TYPES.includes(inv.invoice_type ?? 'placement_fee'), 'Diesen Beleg kann man nicht stornieren.', 'conflict');
  must(inv.status !== 'cancelled', 'Die Rechnung ist schon storniert.', 'conflict');
  const { data: p } = inv.placement_id ? await ctx.db.from('placements').select('*').eq('id', inv.placement_id).maybeSingle() : { data: null };
  const pl = p as any;
  const ts = pl ? await rowsIn(ctx, 'recruiter_payout_tranches', 'id, tranche_type, status, amount_cents', 'placement_id', [pl.id]) : [];
  const salaryLocked = ts.some((t) => ['approved', 'paid'].includes(t.status));
  const cp = await customerRecipients(ctx, inv);
  return { pl, ts, salaryLocked, company: cp.company };
}

export async function correctionPreview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  const c = await correctionContext(ctx, inv);
  const n = c.pl ? (await namesFor(ctx, [c.pl])).get(c.pl.id) : null;
  const year = Number(todayKey(ctx.now()).slice(0, 4));
  const r = inv.recipient ?? {};
  return {
    invoice: {
      id: inv.id, number: inv.invoice_number, type: inv.invoice_type, status: inv.status, totalCents: Number(inv.total_amount_cents ?? 0), netCents: Number(inv.amount_cents ?? 0),
      paidCents: Number(inv.paid_amount_cents ?? 0), dueDate: inv.due_date, company: r.name ?? null, candidateName: n?.candidateName ?? null,
      purchaseOrder: inv.purchase_order ?? null, costCenter: inv.cost_center ?? null,
      recipient: { name: r.name ?? '', street: r.street ?? '', city: r.city ?? '', country: r.country ?? '', vatId: r.vatId ?? '' },
      grossCents: c.pl ? Number(c.pl.gross_annual_target_compensation_cents ?? 0) : null, clientFeePct: c.pl?.pricing_snapshot?.clientFeePct ?? null,
    },
    canCancelOnly: Number(inv.paid_amount_cents ?? 0) === 0,
    salaryChangeable: (inv.invoice_type ?? 'placement_fee') === 'placement_fee' && !!c.pl && !c.salaryLocked,
    salaryLockedWhy: c.salaryLocked ? 'Ein Anteil des Headhunters ist schon gutgeschrieben.' : null,
    blockers: { cancellation: releaseBlockers('cancellation'), invoice: releaseBlockers('invoice') },
    sampleNumbers: {
      cancellation: NUMBERING.cancellation.template ? formatNumber(NUMBERING.cancellation.template, year, 0).replace(/0+$/, '…') : null,
      invoice: NUMBERING.invoice.template ? formatNumber(NUMBERING.invoice.template, year, 0).replace(/0+$/, '…') : null,
    },
  };
}

async function nextNumber(ctx: PlacementCtx, kind: 'invoice' | 'cancellation', year: number) {
  const { data: n, error } = await ctx.db.rpc('next_document_number', { _kind: kind, _year: year, _start: NUMBERING[kind].startNext });
  must(!error && typeof n === 'number', 'Die Belegnummer konnte nicht vergeben werden.');
  return formatNumber(NUMBERING[kind].template, year, n as number);
}

const fileName = (number: string) => `${number.replace(/[^\w.-]/g, '_')}.pdf`;

export async function cancelOrCorrect(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  const mode = body?.mode === 'correct' ? 'correct' : body?.mode === 'cancel' ? 'cancel' : null;
  must(mode, 'Bitte „Stornieren“ oder „Korrigieren“ wählen.');
  const reason = text(body?.reason, 500);
  must(reason.length >= 3, 'Bitte den Grund angeben. Er steht auf dem Beleg.');
  const c = await correctionContext(ctx, inv);
  const blockers = [...releaseBlockers('cancellation'), ...(mode === 'correct' ? releaseBlockers('invoice') : [])];
  must(!blockers.length, `Noch gesperrt. Es fehlt: ${[...new Set(blockers)].join(', ')}.`, 'conflict');
  const paid = Number(inv.paid_amount_cents ?? 0);
  if (mode === 'cancel') must(paid === 0, 'Auf die Rechnung ist schon Geld eingegangen. Bitte „Korrigieren“ wählen, dann wird die Zahlung auf die neue Rechnung angerechnet.', 'conflict');
  const today = todayKey(ctx.now());
  await assertPeriodOpen(ctx.db, today, 'Die Stornorechnung');
  const year = Number(today.slice(0, 4));
  const at = nowIso(ctx);

  // Neue Angaben für die Korrektur
  const ch = body?.changes ?? {};
  let next: any = null;
  let salaryChanged = false;
  let newGross: number | null = null;
  if (mode === 'correct') {
    const r = { ...(inv.recipient ?? {}) };
    if (ch.name !== undefined) { const v = text(ch.name, 200); must(v, 'Bitte den Firmennamen angeben.'); r.name = v; }
    if (ch.street !== undefined) r.street = text(ch.street, 200) || null;
    if (ch.city !== undefined) r.city = text(ch.city, 160) || null;
    if (ch.country !== undefined) r.country = text(ch.country, 2).toUpperCase() || null;
    if (ch.vatId !== undefined) r.vatId = text(ch.vatId, 40).replace(/\s+/g, '') || null;
    must(r.street && r.city, 'Bitte die vollständige Anschrift angeben.');
    const tax = taxCaseFor(r.country, r.vatId);
    must(!tax.missing, `Es fehlt: ${tax.missing}.`);
    const po = ch.purchaseOrder !== undefined ? (text(ch.purchaseOrder, 80) || null) : (inv.purchase_order ?? null);
    const cc = ch.costCenter !== undefined ? (text(ch.costCenter, 80) || null) : (inv.cost_center ?? null);
    let net = Number(inv.amount_cents ?? 0);
    let lines = (inv.lines ?? []).map((l: any) => ({ ...l, details: [...(l.details ?? [])] }));
    let snapshot = inv.pricing_snapshot ?? null;
    if (ch.grossCents !== undefined && ch.grossCents !== null && ch.grossCents !== '') {
      const gross = Math.round(Number(ch.grossCents));
      must(Number.isFinite(gross) && gross > 0, 'Bitte das Bruttojahreszielgehalt laut Vertrag angeben.');
      must((inv.invoice_type ?? 'placement_fee') === 'placement_fee' && c.pl, 'Das Gehalt lässt sich nur bei der Honorarrechnung korrigieren.', 'conflict');
      if (gross !== Number(c.pl.gross_annual_target_compensation_cents ?? 0)) {
        must(!c.salaryLocked, 'Ein Anteil des Headhunters ist schon gutgeschrieben. Das Gehalt lässt sich so nicht mehr korrigieren.', 'conflict');
        const pct = Number(c.pl.pricing_snapshot?.clientFeePct ?? 0);
        must(pct > 0, 'Der Honorarsatz der Besetzung fehlt.', 'conflict');
        net = Math.round(gross * pct / 100);
        salaryChanged = true;
        if (lines[0]) {
          lines[0].amountCents = net;
          lines[0].details = lines[0].details.map((d: string) => d.startsWith('Bemessungsgrundlage') ? `Bemessungsgrundlage: Bruttojahreszielgehalt ${eur(gross)} × ${String(pct).replace('.', ',')} %` : d);
        }
        snapshot = c.pl.pricing_snapshot;
        newGross = gross;
      }
    }
    if (lines[0]) lines = [{ ...lines[0], details: [...lines[0].details, `Korrektur der Rechnung ${inv.invoice_number}: ${reason}`] }, ...lines.slice(1)];
    const vat = Math.round(net * tax.vatRate / 100);
    const total = net + vat;
    const carry = Math.min(paid, total);
    next = {
      recipient: r, tax, po, cc, net, vat, total, lines, snapshot, carry,
      status: carry >= total ? 'paid' : carry > 0 ? 'partially_paid' : 'open',
    };
  }

  // 1 Stornorechnung
  const stornoNumber = await nextNumber(ctx, 'cancellation', year);
  const storno = {
    placement_id: inv.placement_id, client_id: inv.client_id, invoice_number: stornoNumber, invoice_type: 'cancellation', status: 'issued',
    amount: -Number(inv.amount_cents ?? 0) / 100, tax_amount: -Number(inv.tax_amount_cents ?? 0) / 100, total_amount: -Number(inv.total_amount_cents ?? 0) / 100,
    amount_cents: -Number(inv.amount_cents ?? 0), tax_amount_cents: -Number(inv.tax_amount_cents ?? 0), total_amount_cents: -Number(inv.total_amount_cents ?? 0),
    payment_terms_days: 0, issued_at: today, due_date: today, pricing_snapshot: inv.pricing_snapshot ?? null, mandate_id: inv.mandate_id ?? null,
    submission_id: inv.submission_id ?? null, job_id: inv.job_id ?? null, vat_rate: inv.vat_rate, reverse_charge: !!inv.reverse_charge, tax_case: inv.tax_case ?? null,
    recipient: inv.recipient, lines: (inv.lines ?? []).map((l: any) => ({ ...l, title: `Storno: ${l.title}`, amountCents: -Number(l.amountCents ?? 0), details: [...(l.details ?? []), `zu Rechnung ${inv.invoice_number} vom ${dateDe(inv.issued_at)}`] })),
    corrects_invoice_id: inv.id, cancel_reason: reason, purchase_order: inv.purchase_order ?? null, cost_center: inv.cost_center ?? null,
    released_at: at, released_by: user.id,
  };
  const stornoBytes = await renderInvoicePdf(docOf(storno, { correctsNumber: inv.invoice_number, reason }));
  const stornoPath = `${year}/${stornoNumber.replace(/[^\w.-]/g, '_')}.pdf`;
  await ctx.invoiceFiles.put(stornoPath, stornoBytes);
  const { data: st, error: sErr } = await ctx.db.from('invoices').insert({ ...storno, pdf_path: stornoPath }).select('id').maybeSingle();
  dbFail(sErr, 'Die Stornorechnung');
  const stornoId = (st as any).id as string;
  const { error: oErr } = await ctx.db.from('invoices').update({ status: 'cancelled', cancelled_at: at, cancelled_by_invoice_id: stornoId, cancel_reason: reason }).eq('id', inv.id);
  dbFail(oErr, 'Die alte Rechnung');

  const attachments = [{ filename: fileName(stornoNumber), contentBase64: encodeBase64(stornoBytes), contentType: 'application/pdf' }];
  let newNumber: string | null = null;
  let newId: string | null = null;
  let draftId: string | null = null;
  const isFee = ['placement_fee', 'salary_difference'].includes(inv.invoice_type ?? 'placement_fee');

  if (mode === 'correct') {
    // Gehalt korrigiert: Besetzung (Trigger rechnet Anteile neu) und offene Anteile anpassen
    if (salaryChanged && c.pl) {
      const gross = newGross as number;
      const { data: upd, error: gErr } = await ctx.db.from('placements').update({ gross_annual_target_compensation_cents: gross, agreed_salary: Math.round(gross / 100) }).eq('id', c.pl.id).select('*').maybeSingle();
      dbFail(gErr, 'Das Gehalt der Besetzung');
      const np = upd as any;
      for (const t of c.ts.filter((x) => ['pending', 'due'].includes(x.status))) {
        const amount = t.tranche_type === 'initial' ? Number(np.recruiter_initial_cents ?? 0) : t.tranche_type === 'retention' ? Number(np.recruiter_retention_cents ?? 0) : null;
        if (amount && amount > 0) await ctx.db.from('recruiter_payout_tranches').update({ amount_cents: amount }).eq('id', t.id);
      }
    }
    newNumber = await nextNumber(ctx, 'invoice', year);
    const row = {
      placement_id: inv.placement_id, client_id: inv.client_id, invoice_number: newNumber, invoice_type: inv.invoice_type ?? 'placement_fee', status: next.status,
      amount: next.net / 100, tax_amount: next.vat / 100, total_amount: next.total / 100, amount_cents: next.net, tax_amount_cents: next.vat, total_amount_cents: next.total,
      payment_terms_days: inv.payment_terms_days ?? 14, issued_at: today, due_date: inv.due_date ?? today, pricing_snapshot: next.snapshot, mandate_id: inv.mandate_id ?? null,
      submission_id: inv.submission_id ?? null, job_id: inv.job_id ?? null, vat_rate: next.tax.vatRate, reverse_charge: next.tax.taxCase === 'reverse_charge', tax_case: next.tax.taxCase,
      recipient: next.recipient, lines: next.lines, corrects_invoice_id: inv.id, purchase_order: next.po, cost_center: next.cc, po_follows: !next.po && !!inv.po_follows,
      research_offer_id: inv.research_offer_id ?? null, released_at: at, released_by: user.id,
      paid_amount_cents: next.carry || null, paid_at: next.status === 'paid' ? (inv.paid_at ?? at) : null,
      payment_note: next.carry ? `Zahlungen auf ${inv.invoice_number} angerechnet: ${eur(next.carry)}` : null,
      reminder_sent_at: inv.reminder_sent_at ?? null,
    };
    const bytes = await renderInvoicePdf(docOf(row, { correctsNumber: inv.invoice_number, correctsLabel: 'Ersetzt Rechnung' }));
    const path = `${year}/${newNumber.replace(/[^\w.-]/g, '_')}.pdf`;
    await ctx.invoiceFiles.put(path, bytes);
    const { data: ni, error: nErr } = await ctx.db.from('invoices').insert({ ...row, pdf_path: path }).select('id').maybeSingle();
    dbFail(nErr, 'Die neue Rechnung');
    newId = (ni as any).id;
    attachments.push({ filename: fileName(newNumber), contentBase64: encodeBase64(bytes), contentType: 'application/pdf' });
    if (isFee && inv.placement_id && next.status !== 'paid') await ctx.db.from('placements').update({ invoice_state: 'invoiced' }).eq('id', inv.placement_id).neq('invoice_state', 'paid');
  } else {
    if (isFee && inv.placement_id) await ctx.db.from('placements').update({ invoice_state: 'not_invoiced' }).eq('id', inv.placement_id).neq('invoice_state', 'paid');
    if (body?.redraft !== false) {
      // Als Entwurf neu anlegen: geht wieder durch die Prüfung (A3)
      const { data: d, error: dErr } = await ctx.db.from('invoices').insert({
        placement_id: inv.placement_id, client_id: inv.client_id, invoice_number: `ENTWURF-${crypto.randomUUID().slice(0, 8)}`, invoice_type: inv.invoice_type ?? 'placement_fee', status: 'draft',
        amount: Number(inv.amount_cents ?? 0) / 100, tax_amount: Number(inv.tax_amount_cents ?? 0) / 100, total_amount: Number(inv.total_amount_cents ?? 0) / 100,
        amount_cents: inv.amount_cents, tax_amount_cents: inv.tax_amount_cents, total_amount_cents: inv.total_amount_cents,
        payment_terms_days: inv.payment_terms_days ?? 14, issued_at: today, pricing_snapshot: inv.pricing_snapshot ?? null, mandate_id: inv.mandate_id ?? null,
        submission_id: inv.submission_id ?? null, job_id: inv.job_id ?? null, vat_rate: inv.vat_rate, reverse_charge: !!inv.reverse_charge, tax_case: inv.tax_case ?? null,
        recipient: inv.recipient, lines: inv.lines, corrects_invoice_id: inv.id, research_offer_id: inv.research_offer_id ?? null,
        purchase_order: inv.purchase_order ?? null, cost_center: inv.cost_center ?? null,
      }).select('id').maybeSingle();
      if (dErr) console.warn('[buchhaltung] Neuer Entwurf nicht angelegt', dErr.message);
      draftId = (d as any)?.id ?? null;
    }
  }

  // Beide Belege per Mail an den Kunden
  let sentTo: string[] = [];
  try {
    const subject = mode === 'correct' ? `Korrektur der Rechnung ${inv.invoice_number} · neue Rechnung ${newNumber}` : `Stornorechnung ${stornoNumber} zu Rechnung ${inv.invoice_number}`;
    const paras = mode === 'correct'
      ? ['Guten Tag,', `wir haben unsere Rechnung ${esc(inv.invoice_number)} korrigiert. Grund: ${esc(reason)}.`, `Im Anhang finden Sie die Stornorechnung ${esc(stornoNumber)} und die neue Rechnung ${esc(newNumber!)} über ${esc(eur(next.total))}${next.carry ? `. Ihre Zahlung über ${esc(eur(next.carry))} haben wir angerechnet` : ''}${next.status !== 'paid' && inv.due_date ? `, fällig weiter am ${esc(dateDe(inv.due_date))}` : ''}.`, 'Bitte buchen Sie beide Belege. Bei Fragen antworten Sie einfach auf diese Mail.']
      : ['Guten Tag,', `wir haben unsere Rechnung ${esc(inv.invoice_number)} storniert. Grund: ${esc(reason)}.`, `Im Anhang finden Sie die Stornorechnung ${esc(stornoNumber)}. Bitte zahlen Sie die alte Rechnung nicht mehr.`, 'Bei Fragen antworten Sie einfach auf diese Mail.'];
    const r = await mailCustomer(ctx, inv, { subject, heading: subject, paragraphs: paras, text: paras.join('\n\n').replace(/<[^>]+>/g, ''), attachments, template: mode === 'correct' ? 'invoice_corrected' : 'invoice_cancelled', meta: { invoice_id: inv.id, cancellation_id: stornoId, new_invoice_id: newId } });
    sentTo = r.sentTo;
    if (sentTo.length) {
      await ctx.db.from('invoices').update({ sent_at: at, sent_to: sentTo.join(', ') }).eq('id', stornoId);
      if (newId) await ctx.db.from('invoices').update({ sent_at: at, sent_to: sentTo.join(', ') }).eq('id', newId);
    }
  } catch (e) {
    console.warn('[buchhaltung] Storno-Mail nicht verschickt', e instanceof Error ? e.message : e);
  }

  if (salaryChanged && c.pl) {
    const n = (await namesFor(ctx, [c.pl])).get(c.pl.id);
    if (n?.recruiterId) await notify(ctx, n.recruiterId, 'placement_corrected', `Gehalt korrigiert: ${n.candidateName}`, 'Das Gehalt laut Vertrag wurde korrigiert. Dein Anteil ist neu berechnet, du siehst ihn unter Verdienste.', 'placement', c.pl.id);
  }
  return { ok: true, mode, stornoNumber, newNumber, newInvoiceId: newId, draftId, sentTo };
}


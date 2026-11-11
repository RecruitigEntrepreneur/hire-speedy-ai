// deno-lint-ignore-file no-explicit-any
// Erinnerung und Mahnungen an Kunden (K13, A4). Umbau 11.11.2026.
//
//   Stufe 0  Zahlungserinnerung, automatisch 7 Tage nach Fälligkeit (täglicher
//            Lauf), einmal je Rechnung, freundlich („vielleicht untergegangen“).
//   Stufe 1  1. Mahnung per Klick, frühestens nach der Erinnerung, neue Frist 7 Tage.
//   Stufe 2  2. Mahnung erst nach Ablauf der Frist der ersten: Verzugszinsen
//            (Basiszinssatz + 9 Prozentpunkte, § 288 Abs. 2 BGB, tagesgenau)
//            und 40 € Pauschale (§ 288 Abs. 5 BGB).
//   Stufe 3  „Inkasso oder Anwalt“: nur ein Vermerk, es geht nichts raus.
// Der Headhunter sieht die Mahnstufe (invoices.dunning_level, Vertrag § 10 Abs. 3).
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { dbFail, must } from './interview-service.ts';
import { loadInvoice, notify, todayKey, type PlacementCtx } from './placement-service.ts';
import { BASE_RATE_PCT } from './billing-config.ts';
import { eur, renderDunningPdf } from './invoice-pdf.ts';
import { REMINDER_AFTER_DUE_DAYS, addDays } from './konditionen.ts';
import {
  CUSTOMER_TYPES, OPEN_STATUSES, customerRecipients, esc, mailCustomer, namesFor, nowIso, openCentsOf, requireAdminUser, rowsIn, text,
} from './buchhaltung-kern.ts';
import { DUNNING_DAYS, LATE_FEE_CENTS, dateDe, dunningOptions, lateInterest } from './buchhaltung-rechnen.ts';

async function subjectOf(ctx: PlacementCtx, inv: any): Promise<string | null> {
  if (!inv.placement_id) return null;
  const { data: p } = await ctx.db.from('placements').select('id, submission_id').eq('id', inv.placement_id).maybeSingle();
  if (!p) return null;
  const n = (await namesFor(ctx, [p])).get((p as any).id);
  return n ? [n.candidateName, n.jobTitle].filter(Boolean).join(', ') : null;
}

const invoiceUrl = (ctx: PlacementCtx, inv: any) => `${ctx.appUrl()}/dashboard/rechnungen?beleg=${inv.id}`;

// ---------------------------------------------------------------------------
// Täglich: Zahlungserinnerung (K13)
// ---------------------------------------------------------------------------

/** Täglich: Zahlungserinnerung 7 Tage nach Fälligkeit (einmal je Rechnung). */
export async function runPaymentReminders(ctx: PlacementCtx): Promise<{ sent: number; skipped?: number; failed?: number }> {
  const today = todayKey(ctx.now());
  const limit = addDays(today, -REMINDER_AFTER_DUE_DAYS);
  const { data, error } = await ctx.db.from('invoices').select('*')
    .in('status', OPEN_STATUSES).in('invoice_type', CUSTOMER_TYPES).is('reminder_sent_at', null).lte('due_date', limit).limit(200);
  if (error) { console.warn('[mahnwesen] Rechnungen nicht lesbar', error.message); return { sent: 0 }; }
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const inv of (data ?? []) as any[]) {
    // Kunde hat „Überwiesen“ gemeldet: keine Erinnerung, Matchunt sieht es in A6
    if (inv.client_paid_reported_on) { skipped += 1; continue; }
    const open = openCentsOf(inv);
    if (open <= 0) { skipped += 1; continue; }
    // Erst den Vermerk (einmal je Rechnung, UNIQUE invoice_id+level), dann die Mail
    const { data: row, error: rErr } = await ctx.db.from('invoice_reminders').insert({ invoice_id: inv.id, level: 0, open_cents: open, pay_until: null }).select('id').maybeSingle();
    let reminderId = (row as any)?.id as string | undefined;
    if (rErr) {
      if (rErr.code !== '23505') { console.warn('[mahnwesen] Erinnerung nicht vermerkt', rErr.message); failed += 1; continue; }
      const { data: ex } = await ctx.db.from('invoice_reminders').select('id, sent_at').eq('invoice_id', inv.id).eq('level', 0).maybeSingle();
      if ((ex as any)?.sent_at) { await ctx.db.from('invoices').update({ reminder_sent_at: (ex as any).sent_at }).eq('id', inv.id); skipped += 1; continue; }
      reminderId = (ex as any)?.id;
    }
    try {
      const subject = await subjectOf(ctx, inv);
      const heading = `Zahlungserinnerung · Rechnung ${inv.invoice_number} · ${eur(open)} offen`;
      const r = await mailCustomer(ctx, inv, {
        subject: heading,
        heading: 'Zahlungserinnerung',
        paragraphs: [
          'Guten Tag,',
          `vielleicht ist es untergegangen: Von unserer Rechnung <strong>${esc(inv.invoice_number)}</strong> vom ${esc(dateDe(inv.issued_at))}${subject ? ` (${esc(subject)})` : ''} sind noch <strong>${esc(eur(open))}</strong> offen. Fällig war sie am ${esc(dateDe(inv.due_date))}. Haben Sie schon überwiesen, ist alles in Ordnung, dann haben sich unsere Nachrichten gekreuzt.`,
        ],
        text: `Guten Tag,\nvielleicht ist es untergegangen: Von unserer Rechnung ${inv.invoice_number} vom ${dateDe(inv.issued_at)}${subject ? ` (${subject})` : ''} sind noch ${eur(open)} offen. Fällig war sie am ${dateDe(inv.due_date)}. Haben Sie schon überwiesen, ist alles in Ordnung, dann haben sich unsere Nachrichten gekreuzt.\n\nRechnung ansehen: ${invoiceUrl(ctx, inv)}`,
        cta: { label: 'Rechnung ansehen', url: invoiceUrl(ctx, inv) },
        template: 'invoice_reminder', meta: { invoice_id: inv.id, level: 0 },
      });
      if (!r.sentTo.length) { failed += 1; continue; }
      const at = nowIso(ctx);
      await ctx.db.from('invoice_reminders').update({ sent_at: at, sent_to: r.sentTo.join(', ') }).eq('id', reminderId!);
      await ctx.db.from('invoices').update({ reminder_sent_at: at }).eq('id', inv.id);
      sent += 1;
    } catch (e) {
      failed += 1;
      console.warn('[mahnwesen] Erinnerung nicht verschickt', inv.id, e instanceof Error ? e.message : e);
    }
  }
  return { sent, skipped, failed };
}

// ---------------------------------------------------------------------------
// Mahnen (A4)
// ---------------------------------------------------------------------------

async function dunningState(ctx: PlacementCtx, inv: any) {
  const today = todayKey(ctx.now());
  const reminders = await rowsIn(ctx, 'invoice_reminders', 'id, invoice_id, level, sent_at, sent_to, pay_until, open_cents, interest_cents, fee_cents, note, created_at', 'invoice_id', [inv.id]);
  const facts = reminders.map((r) => ({ level: Number(r.level), payUntil: r.pay_until, sentAt: r.sent_at ?? r.created_at }));
  const options = dunningOptions({ status: inv.status, dueDate: inv.due_date, today, reminderSentAt: inv.reminder_sent_at, reminders: facts });
  return { today, reminders, options };
}

function amountsFor(inv: any, level: number, today: string, basePct: number | null) {
  const open = openCentsOf(inv);
  const interest = level === 2 && basePct != null && inv.due_date ? lateInterest(open, basePct, inv.due_date, today) : null;
  const fee = level === 2 ? LATE_FEE_CENTS : 0;
  return { open, interest, fee, total: open + (interest?.interestCents ?? 0) + fee };
}

function dunningTexts(inv: any, level: 1 | 2, a: ReturnType<typeof amountsFor>, payUntil: string, reminderOn: string | null, firstDunningOn: string | null, subject: string | null, basePct: number | null) {
  const nr = inv.invoice_number;
  if (level === 1) {
    const p2 = `trotz unserer Erinnerung${reminderOn ? ` vom ${dateDe(reminderOn)}` : ''} sind von der Rechnung ${nr}${subject ? ` (${subject})` : ''} noch ${eur(a.open)} offen. Bitte überweisen Sie den Betrag bis ${dateDe(payUntil)}, Verwendungszweck ${nr}.`;
    return {
      subject: `1. Mahnung · Rechnung ${nr} · ${eur(a.open)} offen`,
      paragraphs: ['Guten Tag,', p2, 'Haben Sie inzwischen bezahlt, ist alles in Ordnung, dann haben sich unsere Nachrichten gekreuzt.'],
    };
  }
  const i = a.interest;
  const p2 = `die Rechnung ${nr}${subject ? ` (${subject})` : ''} ist trotz unserer Mahnung${firstDunningOn ? ` vom ${dateDe(firstDunningOn)}` : ''} noch offen (${eur(a.open)}). Seit dem ${dateDe(addDays(inv.due_date, 1))} sind Sie in Verzug. Wir berechnen deshalb Verzugszinsen von ${eur(i?.interestCents ?? 0)} (${String(i?.ratePct ?? (basePct ?? 0) + 9).replace('.', ',')} % p. a. für ${i?.days ?? 0} Tage, § 288 Abs. 2 BGB) und die Pauschale von ${eur(a.fee)} nach § 288 Abs. 5 BGB.`;
  return {
    subject: `2. Mahnung · Rechnung ${nr} · ${eur(a.total)} offen`,
    paragraphs: ['Guten Tag,', p2, `Bitte überweisen Sie insgesamt ${eur(a.total)} bis ${dateDe(payUntil)}, Verwendungszweck ${nr}.`, 'Haben Sie inzwischen bezahlt, ist alles in Ordnung, dann haben sich unsere Nachrichten gekreuzt.'],
  };
}

function parseBase(body: any): number | null {
  if (body?.basePct === undefined || body?.basePct === null || body?.basePct === '') return BASE_RATE_PCT;
  const v = Number(String(body.basePct).replace(',', '.'));
  must(Number.isFinite(v) && v > -5 && v < 20, 'Bitte den Basiszinssatz in Prozent angeben, z. B. 2,27.');
  return v;
}

/** Dialog A4: Stufen, Beträge, Empfänger, Vorschau. */
export async function dunningPreview(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  const st = await dunningState(ctx, inv);
  const level = ([1, 2, 3].includes(Number(body?.level)) ? Number(body.level) : (st.options.find((o) => o.allowed)?.level ?? 1)) as 1 | 2 | 3;
  const basePct = parseBase(body);
  const a = amountsFor(inv, level, st.today, basePct);
  const payUntil = addDays(st.today, DUNNING_DAYS);
  const r0 = st.reminders.find((r) => Number(r.level) === 0);
  const r1 = st.reminders.find((r) => Number(r.level) === 1);
  const subject = await subjectOf(ctx, inv);
  const rec = await customerRecipients(ctx, inv);
  const t = level === 3 ? null : dunningTexts(inv, level, a, payUntil, r0?.sent_at ?? inv.reminder_sent_at, r1?.sent_at ?? null, subject, basePct);
  return {
    invoice: {
      id: inv.id, number: inv.invoice_number, recipient: inv.recipient?.name ?? null, totalCents: Number(inv.total_amount_cents ?? 0),
      paidCents: Number(inv.paid_amount_cents ?? 0), openCents: a.open, dueDate: inv.due_date, issuedAt: inv.issued_at,
      reminderSentAt: r0?.sent_at ?? inv.reminder_sent_at ?? null, dunningLevel: Number(inv.dunning_level ?? 0), subject,
    },
    options: st.options,
    history: st.reminders.sort((x, y) => Number(x.level) - Number(y.level)).map((r) => ({ level: Number(r.level), sentAt: r.sent_at, payUntil: r.pay_until, sentTo: r.sent_to, interestCents: Number(r.interest_cents ?? 0), feeCents: Number(r.fee_cents ?? 0), note: r.note })),
    level,
    basePct,
    basePctFromConfig: BASE_RATE_PCT,
    amounts: { openCents: a.open, interestCents: a.interest?.interestCents ?? 0, interestDays: a.interest?.days ?? 0, ratePct: a.interest?.ratePct ?? null, feeCents: a.fee, totalCents: a.total },
    payUntil: level === 3 ? null : payUntil,
    recipients: { to: rec.to, cc: rec.cc },
    preview: t ? { subject: t.subject, text: t.paragraphs.join('\n\n') } : null,
  };
}

/** Mahnung senden (Stufe 1/2) oder „Inkasso oder Anwalt“ vermerken (Stufe 3). */
export async function sendDunning(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const inv = await loadInvoice(ctx.db, body?.invoiceId);
  const level = Number(body?.level) as 1 | 2 | 3;
  must([1, 2, 3].includes(level), 'Bitte die Mahnstufe wählen.');
  const st = await dunningState(ctx, inv);
  const opt = st.options.find((o) => o.level === level)!;
  must(opt.allowed, opt.why ?? 'Diese Mahnstufe ist gerade nicht möglich.', 'conflict');
  const note = text(body?.note, 2000) || null;
  const at = nowIso(ctx);
  const names = inv.placement_id ? await (async () => {
    const { data: p } = await ctx.db.from('placements').select('id, submission_id').eq('id', inv.placement_id).maybeSingle();
    return p ? (await namesFor(ctx, [p])).get((p as any).id) ?? null : null;
  })() : null;

  if (level === 3) {
    const { error } = await ctx.db.from('invoice_reminders').insert({ invoice_id: inv.id, level: 3, sent_at: at, open_cents: openCentsOf(inv), note: note ?? 'Inkasso oder Anwalt', created_by: user.id });
    dbFail(error, 'Der Vermerk');
    await ctx.db.from('invoices').update({ dunning_level: 3 }).eq('id', inv.id);
    if (names?.recruiterId) await notify(ctx, names.recruiterId, 'invoice_dunning', `Mahnstufe 3: ${names.candidateName}`, `Rechnung ${inv.invoice_number} ist trotz zwei Mahnungen offen. Matchunt gibt sie an Inkasso oder Anwalt.`, 'placement', inv.placement_id);
    return { ok: true, level, sent: false };
  }

  const basePct = parseBase(body);
  if (level === 2) must(basePct != null, 'Bitte den aktuellen Basiszinssatz eintragen (Bundesbank, § 247 BGB).');
  const a = amountsFor(inv, level, st.today, basePct);
  must(a.open > 0, 'Auf der Rechnung ist nichts mehr offen.', 'conflict');
  const payUntil = addDays(st.today, DUNNING_DAYS);
  const r0 = st.reminders.find((r) => Number(r.level) === 0);
  const r1 = st.reminders.find((r) => Number(r.level) === 1);
  const subject = names ? [names.candidateName, names.jobTitle].filter(Boolean).join(', ') : null;
  const t = dunningTexts(inv, level, a, payUntil, r0?.sent_at ?? inv.reminder_sent_at, r1?.sent_at ?? null, subject, basePct);

  // Vermerk zuerst (eine Mahnung je Stufe), Mail danach
  const { data: row, error } = await ctx.db.from('invoice_reminders').insert({
    invoice_id: inv.id, level, pay_until: payUntil, open_cents: a.open, interest_cents: a.interest?.interestCents ?? 0, fee_cents: a.fee, note, created_by: user.id,
  }).select('id').maybeSingle();
  if (error?.code === '23505') must(false, 'Diese Mahnstufe ist schon verschickt.', 'conflict');
  dbFail(error, 'Die Mahnung');

  const attachments: { filename: string; contentBase64: string; contentType: string }[] = [];
  if (body?.attachPdf !== false) {
    const bytes = await renderDunningPdf({
      level, issuedOn: st.today, recipient: { name: inv.recipient?.name ?? '', street: inv.recipient?.street ?? null, city: inv.recipient?.city ?? null, country: inv.recipient?.country ?? null },
      invoiceNumber: inv.invoice_number, invoiceDate: inv.issued_at, dueOn: inv.due_date, totalCents: Number(inv.total_amount_cents ?? 0), paidCents: Number(inv.paid_amount_cents ?? 0),
      openCents: a.open, interest: a.interest ? { cents: a.interest.interestCents, ratePct: a.interest.ratePct, days: a.interest.days, basePct: basePct ?? 0 } : null,
      feeCents: a.fee, payUntil, reminderOn: r0?.sent_at ?? inv.reminder_sent_at ?? null, subject,
    });
    const path = `mahnungen/${st.today.slice(0, 4)}/${String(inv.invoice_number).replace(/[^\w.-]/g, '_')}-${level}.pdf`;
    try { await ctx.invoiceFiles.put(path, bytes); } catch (e) { console.warn('[mahnwesen] Mahnung nicht abgelegt', e instanceof Error ? e.message : e); }
    attachments.push({ filename: `${level}-Mahnung-${String(inv.invoice_number).replace(/[^\w.-]/g, '_')}.pdf`, contentBase64: encodeBase64(bytes), contentType: 'application/pdf' });
  }
  let sentTo: string[] = [];
  try {
    const r = await mailCustomer(ctx, inv, {
      subject: t.subject, heading: `${level}. Mahnung`, paragraphs: t.paragraphs.map((p) => esc(p)), text: t.paragraphs.join('\n\n'),
      cta: { label: 'Rechnung ansehen', url: invoiceUrl(ctx, inv) }, attachments, template: 'invoice_dunning', meta: { invoice_id: inv.id, level },
    });
    sentTo = r.sentTo;
  } catch (e) {
    // Mail ging nicht raus: Vermerk zurücknehmen, damit es erneut versucht werden kann
    await ctx.db.from('invoice_reminders').delete().eq('id', (row as any).id);
    throw e;
  }
  if (!sentTo.length) {
    await ctx.db.from('invoice_reminders').delete().eq('id', (row as any).id);
    must(false, 'Die Mahnung konnte nicht verschickt werden. Bitte später erneut versuchen.', 'upstream_error');
  }
  await ctx.db.from('invoice_reminders').update({ sent_at: at, sent_to: sentTo.join(', ') }).eq('id', (row as any).id);
  await ctx.db.from('invoices').update({ dunning_level: level }).eq('id', inv.id);
  if (names?.recruiterId) {
    await notify(ctx, names.recruiterId, 'invoice_dunning', `Mahnstufe ${level}: ${names.candidateName}`, `${names.companyName} hat Rechnung ${inv.invoice_number} noch nicht bezahlt. Matchunt hat die ${level}. Mahnung geschickt, neue Frist ${dateDe(payUntil)}.`, 'placement', inv.placement_id);
  }
  return { ok: true, level, sent: true, sentTo, payUntil };
}

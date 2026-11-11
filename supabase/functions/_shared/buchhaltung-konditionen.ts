// deno-lint-ignore-file no-explicit-any
// Admin › Pakete & Konditionen (A10, J6). Umbau 11.11.2026.
//
// Die Werte stehen fest im Code (konditionen.ts); hier sieht Matchunt die
// Fassungen mit Prüfregeln, setzt den Stichtag für Fassung 2 („ab Live-Gang“),
// informiert die Headhunter (mindestens 8 Wochen vor dem Tag, ab dem Fassung 2
// für alle gilt, Vertrag § 18 Abs. 2) und sieht, wer schon zugestimmt hat.
import type { User } from 'https://esm.sh/@supabase/supabase-js@2';
import { dbFail, must } from './interview-service.ts';
import { notify, todayKey, type PlacementCtx } from './placement-service.ts';
import { CONDITIONS, JOKER_DEFAULT_PCT, JOKER_VALID_DAYS, matchuntOnClaimPct, splitChecks, type ConditionsVersion, type PackageKey } from './konditionen.ts';
import { CONDITIONS_KEY, conditionsSettings } from './konditionen-db.ts';
import { DATE, nowIso, requireAdminUser, rowsIn } from './buchhaltung-kern.ts';
import { addDays } from './konditionen.ts';
import { dateDe } from './buchhaltung-rechnen.ts';
import { esc, layout } from './intake-mail.ts';

const NAMES: Record<PackageKey, string> = { core: 'Core', continuity_90: 'C90', continuity_180: 'C180' };
export const ANNOUNCE_WEEKS = 8;

/** Fassung 2 gilt für alle 12 Monate nach dem Stichtag (§ 18 Abs. 2). */
export function forcedFromOf(activeFrom: string): string {
  const [y, m, d] = activeFrom.split('-').map(Number);
  const dt = new Date(Date.UTC(y + 1, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0); // 29.02. → 28.02.
  return dt.toISOString().slice(0, 10);
}

export async function conditionsOverview(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const rows: any[] = [];
  const core1 = CONDITIONS[1].core;
  const core2 = CONDITIONS[2].core;
  const coreSame = JSON.stringify(core1) === JSON.stringify(core2);
  for (const key of ['core', 'continuity_90', 'continuity_180'] as PackageKey[]) {
    for (const v of [1, 2] as ConditionsVersion[]) {
      if (key === 'core' && coreSame && v === 2) continue;
      const s = CONDITIONS[v][key];
      const c = splitChecks(s);
      rows.push({
        key, version: key === 'core' && coreSame ? null : v, label: key === 'core' && coreSame ? 'Core' : `${NAMES[key]} · Fassung ${v}`,
        clientPct: s.clientPct, initialPct: s.initialPct, retentionPct: s.continuityDays ? s.retentionPct : null, matchuntPct: s.matchuntPct,
        bountyPct: s.continuityDays ? s.bountyPct : null, matchuntOnClaimPct: s.continuityDays ? matchuntOnClaimPct(s) : null, continuityDays: s.continuityDays,
        ok: c.ok,
      });
    }
  }
  const c90 = CONDITIONS[2].continuity_90;
  const allOk = rows.every((r) => r.ok);
  const checkText = `${c90.initialPct} + ${c90.retentionPct} + ${c90.matchuntPct} = ${c90.clientPct} und ${c90.initialPct} + ${c90.bountyPct} + ${matchuntOnClaimPct(c90)} = ${c90.clientPct}, entsprechend ${CONDITIONS[2].continuity_180.clientPct}`;

  const settings = await conditionsSettings(ctx.db);
  const { data: roles } = await ctx.db.from('user_roles').select('user_id').eq('role', 'recruiter');
  const ids = [...new Set(((roles ?? []) as any[]).map((r) => r.user_id))];
  const [profs, consents] = await Promise.all([
    rowsIn(ctx, 'profiles', 'user_id, full_name, email', 'user_id', ids),
    rowsIn(ctx, 'recruiter_condition_consents', 'recruiter_id, version, consented_at', 'recruiter_id', ids),
  ]);
  const list = ids.map((id) => {
    const p = profs.find((x) => x.user_id === id);
    const c = consents.find((x) => x.recruiter_id === id && Number(x.version) === 2);
    return { id, name: p?.full_name ?? 'ohne Namen', email: p?.email ?? null, consentedAt: c?.consented_at ?? null };
  }).sort((a, b) => (a.consentedAt ? 0 : 1) - (b.consentedAt ? 0 : 1) || a.name.localeCompare(b.name, 'de'));

  const active = !!settings.activeFrom && today >= settings.activeFrom;
  const announceBy = settings.forcedFrom ? addDays(settings.forcedFrom, -ANNOUNCE_WEEKS * 7) : null;
  return {
    rows, allOk, checkText,
    settings,
    active,
    canEditDate: !active,
    announce: {
      allowed: !!settings.activeFrom && (!announceBy || today <= announceBy),
      latest: announceBy,
      why: !settings.activeFrom ? 'Erst den Stichtag setzen.' : announceBy && today > announceBy ? `Die Ankündigung muss spätestens am ${dateDe(announceBy)} raus sein (8 Wochen vor dem ${dateDe(settings.forcedFrom)}).` : null,
    },
    consents: { count: list.filter((x) => x.consentedAt).length, total: list.length, list },
    joker: { pct: JOKER_DEFAULT_PCT, validDays: JOKER_VALID_DAYS },
  };
}

export async function setConditionsDate(ctx: PlacementCtx, user: User, body: any) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const current = await conditionsSettings(ctx.db);
  must(!current.activeFrom || today < current.activeFrom, `Fassung 2 gilt schon seit ${dateDe(current.activeFrom)}. Der Stichtag lässt sich nicht mehr ändern.`, 'conflict');
  const v = body?.activeFrom;
  let value: Record<string, unknown>;
  if (v === null || v === '') {
    value = { activeFrom: null, forcedFrom: null, announcedAt: null };
  } else {
    must(typeof v === 'string' && DATE.test(v), 'Bitte den Stichtag als Datum angeben.');
    must(v >= today, 'Der Stichtag darf nicht in der Vergangenheit liegen.');
    const forcedFrom = forcedFromOf(v);
    value = { activeFrom: v, forcedFrom, announcedAt: current.activeFrom === v ? current.announcedAt : null };
  }
  const { error } = await ctx.db.from('billing_settings').upsert({ key: CONDITIONS_KEY, value, updated_at: nowIso(ctx), updated_by: user.id }, { onConflict: 'key' });
  dbFail(error, 'Der Stichtag');
  return { ok: true, settings: value };
}

export async function announceConditions(ctx: PlacementCtx, user: User) {
  await requireAdminUser(ctx, user);
  const today = todayKey(ctx.now());
  const s = await conditionsSettings(ctx.db);
  must(s.activeFrom && s.forcedFrom, 'Erst den Stichtag setzen.', 'conflict');
  const latest = addDays(s.forcedFrom!, -ANNOUNCE_WEEKS * 7);
  must(today <= latest, `Zu spät: Die Ankündigung muss mindestens 8 Wochen vor dem ${dateDe(s.forcedFrom)} raus sein.`, 'conflict');
  const { data: roles } = await ctx.db.from('user_roles').select('user_id').eq('role', 'recruiter');
  const ids = [...new Set(((roles ?? []) as any[]).map((r) => r.user_id))];
  const { data: consents } = await ctx.db.from('recruiter_condition_consents').select('recruiter_id').eq('version', 2);
  const done = new Set(((consents ?? []) as any[]).map((c) => c.recruiter_id));
  const profs = await rowsIn(ctx, 'profiles', 'user_id, full_name, email', 'user_id', ids);
  let sent = 0;
  let mailed = 0;
  const failed: string[] = [];
  for (const id of ids) {
    if (done.has(id)) continue;
    await notify(ctx, id, 'conditions_announced', `Neue Konditionen ab ${dateDe(s.activeFrom)}`,
      `Mehr für Nachbesetzungen, Auszahlung in zwei Teilen. Was du vorher aktiviert hast, bleibt, wie es ist. Ohne Zustimmung gilt die bisherige Fassung bis ${dateDe(addDays(s.forcedFrom!, -1))}. Sieh es dir in der Übersicht an.`,
      'conditions', id);
    sent += 1;
    // Ankündigung in Textform (§ 18 Abs. 2): Mail an jeden Headhunter, dient als Nachweis
    const p = profs.find((x) => x.user_id === id);
    if (p?.email) {
      const mail = announceMail(String(p.full_name ?? ''), s.activeFrom!, s.forcedFrom!, ctx.appUrl());
      const r = await ctx.mail({ fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: p.email, replyTo: 'info@bluewater-bridge.de', ...mail } as any,
        { template: 'conditions_announced', meta: { recruiter_id: id, active_from: s.activeFrom, forced_from: s.forcedFrom } });
      if ((r as any)?.sent) mailed += 1; else failed.push(p.email);
    } else {
      failed.push(p?.full_name ?? id);
    }
  }
  const value = { ...s, announcedAt: nowIso(ctx) };
  const { error } = await ctx.db.from('billing_settings').upsert({ key: CONDITIONS_KEY, value, updated_at: nowIso(ctx), updated_by: user.id }, { onConflict: 'key' });
  dbFail(error, 'Die Ankündigung');
  return { ok: true, notified: sent, mailed, mailFailed: failed, alreadyConsented: done.size };
}

/** Mail „Neue Konditionen“ an einen Headhunter (Textform nach § 18 Abs. 2). */
export function announceMail(name: string, activeFrom: string, forcedFrom: string, appUrl: string) {
  const first = name.trim().split(' ')[0] || '';
  const heading = `Neue Konditionen ab ${dateDe(activeFrom)}`;
  const row = (a: string, b: string, c: string) => `<tr><td style="padding:6px 8px 6px 0;">${esc(a)}</td><td style="padding:6px 8px;color:#6b7280;">${esc(b)}</td><td style="padding:6px 0 6px 8px;"><strong>${esc(c)}</strong></td></tr>`;
  const v1 = CONDITIONS[1], v2 = CONDITIONS[2];
  const table = '<table role="presentation" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 16px 0;">'
    + '<tr><td></td><td style="padding:0 8px 4px;color:#6b7280;font-size:12px;">bisher</td><td style="padding:0 0 4px 8px;color:#6b7280;font-size:12px;">neu</td></tr>'
    + row('Core', `${v1.core.initialPct} % bei Antritt`, 'unverändert')
    + row('Continuity 90', `${v1.continuity_90.initialPct} % bei Antritt, ${v1.continuity_90.retentionPct} % nach 90 Tagen`, `${v2.continuity_90.initialPct} % bei Antritt, ${v2.continuity_90.retentionPct} % nach 90 Tagen`)
    + row('Continuity 180', `${v1.continuity_180.initialPct} % bei Antritt, ${v1.continuity_180.retentionPct} % nach 180 Tagen`, `${v2.continuity_180.initialPct} % bei Antritt, ${v2.continuity_180.retentionPct} % nach 180 Tagen`)
    + row('Nachbesetzung', `${v1.continuity_90.bountyPct} bzw. ${v1.continuity_180.bountyPct} %`, `${v2.continuity_90.bountyPct} %, für alle Headhunter ausgeschrieben`)
    + '</table>';
  const body = [
    `<p style="margin:0 0 12px 0;">Hallo${first ? ` ${esc(first)}` : ''},</p>`,
    `<p style="margin:0 0 12px 0;">ab dem ${esc(dateDe(activeFrom))} gibt es neue Konditionen: mehr für Nachbesetzungen und die Auszahlung in zwei Teilen. Sie gelten für Stellen, die du ab dann aktivierst. Was du vorher aktiviert hast, bleibt, wie es ist.</p>`,
    table,
    `<p style="margin:0 0 12px 0;">Du kannst jederzeit in der App zustimmen. Stimmst du nicht zu, gilt deine bisherige Fassung bis ${esc(dateDe(addDays(forcedFrom, -1)))}; ab dem ${esc(dateDe(forcedFrom))} gelten die neuen Konditionen für alle (Rahmenvertrag § 18 Abs. 2).</p>`,
  ].join('');
  return {
    subject: heading,
    html: layout({ preheader: heading, heading, body, cta: { label: 'Konditionen ansehen', url: `${appUrl}/recruiter/earnings` } } as any),
    text: `${heading}\nNeu: Continuity ${v2.continuity_90.initialPct} % bei Antritt, ${v2.continuity_90.retentionPct} % nach der Garantie, Nachbesetzung ${v2.continuity_90.bountyPct} %.\nOhne Zustimmung gilt deine bisherige Fassung bis ${dateDe(addDays(forcedFrom, -1))}.\n${appUrl}/recruiter/earnings`,
  };
}

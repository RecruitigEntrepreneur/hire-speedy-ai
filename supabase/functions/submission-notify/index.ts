/**
 * submission-notify – Mail „Neuer Kandidat für …“ an den Inhaber der Stelle,
 * direkt nach dem Einreichen.
 *
 * Body: { submissionId }
 *
 * Nur der einreichende Headhunter (oder ein Admin), höchstens einmal je
 * Einreichung. Die Mail enthält Eckdaten (Rolle, Erfahrungsband, grobe Region,
 * Kündigungsfrist) und den Headhunter – weder Kandidatennamen noch Gehalt noch Score.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/http.ts';
import { esc, layout, sendIntakeMail } from '../_shared/intake-mail.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

const TEMPLATE = 'new_candidate_client';
const TIER_LABEL: Record<string, string> = { partner: 'Partner', silver: 'Silber Partner', gold: 'Gold Partner' };

const str = (v: unknown) => (typeof v === 'string' ? v : '');

function noticeLabel(v: string | null): string | null {
  if (!v) return null;
  if (v === 'immediate') return 'sofort verfügbar';
  const m = v.match(/^(\d+)_(weeks|months|month)/);
  if (!m) return null;
  const n = Number(m[1]);
  return `Kündigungsfrist ${n} ${m[2] === 'weeks' ? (n === 1 ? 'Woche' : 'Wochen') : n === 1 ? 'Monat' : 'Monate'}`;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return fail('invalid_request', 'Nur POST.');

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return fail('not_allowed', 'Anmeldung fehlt.');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: userData } = await anon.auth.getUser(token);
    const user = userData?.user;
    if (!user) return fail('not_allowed', 'Anmeldung ungültig.');
    const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: isAdmin } = await db.rpc('has_role', { _user_id: user.id, _role: 'admin' });

    const body = await req.json().catch(() => null) as { submissionId?: string } | null;
    if (!body?.submissionId) return fail('invalid_request', 'submissionId fehlt.');

    const { data: sub } = await db.from('submissions')
      .select('id, recruiter_id, job_id, candidate_id')
      .eq('id', body.submissionId).maybeSingle();
    if (!sub) return fail('not_found', 'Einreichung nicht gefunden.');
    if (sub.recruiter_id !== user.id && !isAdmin) return fail('not_allowed', 'Diese Einreichung gehört nicht zu deinem Konto.');

    const { data: already } = await db.from('email_events').select('id').eq('template_name', TEMPLATE).eq('metadata->>submission_id', sub.id).eq('status', 'sent').limit(1);
    if ((already ?? []).length) return json({ sent: false, skipped: 'schon verschickt' });

    const [{ data: job }, { data: cand }, { data: rec }, { data: tier }] = await Promise.all([
      db.from('jobs').select('title, client_id').eq('id', sub.job_id).maybeSingle(),
      db.from('candidates').select('job_title, city, experience_years, notice_period').eq('id', sub.candidate_id).maybeSingle(),
      db.from('profiles').select('full_name').eq('user_id', sub.recruiter_id).maybeSingle(),
      db.from('recruiter_partner_status').select('tier').eq('user_id', sub.recruiter_id).is('ended_at', null).maybeSingle(),
    ]);
    if (!job?.client_id || !cand) return fail('not_found', 'Stelle oder Kandidat nicht gefunden.');
    const { data: client } = await db.from('profiles').select('email, full_name').eq('user_id', job.client_id).maybeSingle();
    if (!client?.email) return json({ sent: false, skipped: 'keine E-Mail beim Kunden' });

    const [{ data: region }, { data: band }] = await Promise.all([
      db.rpc('anon_region_broad', { city: cand.city ?? null }),
      db.rpc('anon_experience_band', { years: cand.experience_years ?? null }),
    ]);
    const role = str(cand.job_title);
    const details = [
      typeof band === 'string' && band !== 'Nicht angegeben' ? `${band} Erfahrung` : null,
      typeof region === 'string' && region !== 'DACH' ? `Region ${region}` : null,
      noticeLabel(cand.notice_period),
    ].filter(Boolean).join(' · ');
    const hh = [str(rec?.full_name), tier?.tier ? `Matchunt ${TIER_LABEL[tier.tier] ?? 'Partner'}` : null].filter(Boolean).join(' · ');
    const link = `${getPublicAppUrl()}/dashboard/candidates/${sub.id}`;
    const title = str(job.title);

    const html = layout({
      preheader: `Neuer Kandidat für ${title}`,
      heading: `Neuer Kandidat für „${title}“`,
      body: [
        `<p style="margin:0 0 12px 0;">Guten Tag${client.full_name ? ` ${esc(client.full_name)}` : ''},</p>`,
        `<p style="margin:0 0 12px 0;">für Ihre Stelle <strong>${esc(title)}</strong> wurde ein Kandidat vorgestellt.</p>`,
        role || details || hh
          ? `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin:0 0 12px 0;">${role ? `<strong>${esc(role)}</strong>` : ''}${details ? `${role ? '<br>' : ''}<span style="color:#6b7280;">${esc(details)}</span>` : ''}${hh ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;">Vorgestellt von ${esc(hh)}</div>` : ''}</div>`
          : '',
      ].join(''),
      cta: { label: 'Kandidat ansehen', url: link },
      footnote: 'Name und Kontakt sehen Sie, sobald Sie ein Interview vereinbaren. Rückfragen an den Headhunter stellen Sie direkt im Kandidatenprofil.',
    });

    const res = await sendIntakeMail(db, {
      to: client.email,
      subject: `Neuer Kandidat für „${title}“`,
      html,
      template: TEMPLATE,
      meta: { submission_id: sub.id, job_id: sub.job_id },
      idempotencyKey: `${TEMPLATE}-${sub.id}`,
    });
    return json({ sent: res.sent, error: res.error ?? null });
  } catch (e) {
    console.error('submission-notify', e instanceof Error ? e.message : e);
    return fail('internal_error', 'Das hat nicht geklappt.');
  }
});

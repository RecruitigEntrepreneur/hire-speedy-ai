// Headhunter benachrichtigt aus einer Aufgabe heraus den Kunden oder den
// Kandidaten – über das System, mit vorgefertigten Sätzen, ohne Direktkontakt.
//
//   client_nudge      → Benachrichtigung + Mail an das Kundenteam der Stelle,
//                       höchstens einmal in 3 Tagen je Einreichung,
//                       Kandidat erscheint vor Opt-In nur als Bewerber-Kürzel.
//   candidate_message → Mail an den Kandidaten im Namen des Headhunters,
//                       Antwort geht an den Headhunter.
//
// Jeder Versand landet als Beleg im candidate_activity_log.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const NUDGE_COOLDOWN_MS = 3 * 86_400_000;

const anonCode = (candidateId: string) => `PR-${String(candidateId ?? '').slice(0, 6).toUpperCase()}`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

async function loadBundle(db: any, submissionId: unknown, recruiterId: string) {
  must(typeof submissionId === 'string' && UUID.test(submissionId), 'Ungültige Einreichung.');
  const { data, error } = await db.from('submissions')
    .select('id, stage, status, identity_unlocked, company_revealed, recruiter_id, candidate_id, job_id, submitted_at, jobs!inner(id, title, company_name, client_id, organization_id), candidates!inner(id, full_name, email, phone)')
    .eq('id', submissionId).maybeSingle();
  must(!error && data, 'Einreichung nicht gefunden.', 'not_found');
  must(data.recruiter_id === recruiterId, 'Keine Berechtigung für diese Einreichung.', 'not_allowed');
  return { submission: data, job: data.jobs, candidate: data.candidates };
}

async function clientTeam(db: any, job: any): Promise<{ userId: string; email: string | null; name: string }[]> {
  const ids = new Set<string>();
  if (job.client_id) ids.add(job.client_id);
  if (job.organization_id) {
    const { data: org } = await db.from('organizations').select('owner_id').eq('id', job.organization_id).maybeSingle();
    if (org?.owner_id) ids.add(org.owner_id);
    const { data: members } = await db.from('organization_members').select('user_id, role').eq('organization_id', job.organization_id).eq('status', 'active');
    for (const m of members ?? []) if (m.role !== 'finance') ids.add(m.user_id);
  }
  if (!ids.size) return [];
  const { data: profiles } = await db.from('profiles').select('user_id, full_name, email').in('user_id', [...ids]);
  return (profiles ?? []).map((p: any) => ({ userId: p.user_id, email: p.email ? String(p.email).toLowerCase() : null, name: p.full_name || 'Kunde' }));
}

async function recruiterProfile(db: any, userId: string) {
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return { name: data?.full_name || 'Ihr Headhunter', email: data?.email ? String(data.email).toLowerCase() : null };
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const db = serviceClient();
    const ctx = defaultCtx(db);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    must(text.length > 0 && text.length <= 2000, 'Der Text fehlt oder ist zu lang.');

    const b = await loadBundle(db, body.submissionId, user.id);
    const me = await recruiterProfile(db, user.id);
    const nowIso = new Date(ctx.now()).toISOString();

    if (body.action === 'client_nudge') {
      // Sperre: einmal in drei Tagen je Einreichung
      const { data: recent } = await db.from('candidate_activity_log')
        .select('id, created_at')
        .eq('related_submission_id', b.submission.id)
        .eq('recruiter_id', user.id)
        .contains('metadata', { kind: 'client_nudge' })
        .gte('created_at', new Date(ctx.now() - NUDGE_COOLDOWN_MS).toISOString())
        .limit(1);
      must(!(recent && recent.length), 'Der Kunde wurde in den letzten drei Tagen schon erinnert.', 'not_allowed');

      const label = b.submission.identity_unlocked ? b.candidate.full_name : `Bewerber ${anonCode(b.candidate.id)}`;
      const title = `Ihr Headhunter bittet um Rückmeldung zu ${label}`;
      const message = `${b.job.title} · ${text}`;
      const team = await clientTeam(db, b.job);
      const detailUrl = `${ctx.appUrl()}/dashboard/candidates/${b.submission.id}`;
      let mails = 0;
      for (const person of team) {
        await db.from('notifications').insert({ user_id: person.userId, type: 'recruiter_nudge', title, message, related_type: 'submission', related_id: b.submission.id });
        if (!person.email) continue;
        const bodyText = `Guten Tag ${person.name},\n\n${me.name} über Matchunt zu ${label} für ${b.job.title}:\n\n${text}\n\nZur Einreichung: ${detailUrl}\n\nAntworten Sie direkt im Dashboard (Interview anfragen, Absagen oder „Noch in Prüfung“).`;
        const r = await ctx.mail({
          fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: person.email, replyTo: me.email ?? undefined,
          subject: title,
          text: bodyText,
          html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(bodyText.replace(detailUrl, ''))}<p><a href="${detailUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Einreichung öffnen</a></p></div>`,
        }, { template: 'recruiter_client_nudge', meta: { submission_id: b.submission.id, intent: body.intent ?? null } });
        if (r.sent) mails++;
      }
      await db.from('candidate_activity_log').insert({
        candidate_id: b.candidate.id, recruiter_id: user.id, activity_type: 'email',
        title: 'Kunden erinnert', description: text,
        metadata: { kind: 'client_nudge', intent: body.intent ?? null, hints: body.hints ?? [], recipients: team.length, mails },
        related_submission_id: b.submission.id,
      });
      return json({ ok: true, recipients: team.length, mails });
    }

    if (body.action === 'candidate_message') {
      must(!!b.candidate.email, 'Der Kandidat hat keine E-Mail-Adresse.', 'not_found');
      const first = String(b.candidate.full_name || '').trim().split(/\s+/)[0] || 'Hallo';
      const subject = typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim().slice(0, 120) : `Kurze Rückmeldung zu ${b.job.title}`;
      const bodyText = `Hallo ${first},\n\n${text}\n\nViele Grüße\n${me.name}`;
      const r = await ctx.mail({
        fromEmail: ctx.fromEmail, fromName: `${me.name} über Matchunt`, to: b.candidate.email, replyTo: me.email ?? undefined,
        subject, text: bodyText,
        html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(bodyText)}</div>`,
      }, { template: 'recruiter_candidate_message', meta: { submission_id: b.submission.id, kind: body.kind ?? null } });
      await db.from('candidate_activity_log').insert({
        candidate_id: b.candidate.id, recruiter_id: user.id, activity_type: 'email',
        title: `Nachricht an ${first}`, description: text,
        metadata: { kind: 'candidate_message', message_kind: body.kind ?? null, sent: r.sent, error: r.error ?? null },
        related_submission_id: b.submission.id,
      });
      must(r.sent, `Die Mail konnte nicht gesendet werden${r.error ? `: ${r.error}` : '.'}`, 'upstream_error');
      return json({ ok: true });
    }

    must(false, 'Unbekannte Aktion.');
  } catch (e) {
    return interviewFailure(e);
  }
});

// Headhunter benachrichtigt aus einer Aufgabe heraus den Kunden oder den
// Kandidaten – über das System, mit vorgefertigten Sätzen, ohne Direktkontakt.
//
//   client_nudge      → Benachrichtigung + Mail an das Kundenteam der Stelle,
//                       höchstens einmal in 3 Tagen je Einreichung,
//                       Kandidat erscheint vor Opt-In nur als Bewerber-Kürzel.
//                       Seit 20.10.2026 auch für mehrere Einreichungen auf einmal
//                       (`submissionIds`): je Kundenteam EINE Mail mit allen Kandidaten,
//                       je Stelle eine Benachrichtigung, je Einreichung ein Beleg.
//   candidate_message → Mail an den Kandidaten im Namen des Headhunters,
//                       Antwort geht an den Headhunter.
//   job_questions     → Offene Fragen der Aufnahme an das Kundenteam einer Stelle
//                       (Briefing „Kunden fragen“, 21.10.2026). Nur mit laufender
//                       Suche, höchstens einmal in 7 Tagen je Stelle und Headhunter.
//                       Der Kunde antwortet in der Aufnahme der Stelle.
//
// Jeder Versand landet als Beleg im candidate_activity_log.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const NUDGE_COOLDOWN_MS = 3 * 86_400_000;
const QUESTIONS_COOLDOWN_MS = 7 * 86_400_000;

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
    // Kann diese Version bündeln? Das Fenster fragt vorher, damit eine ältere
    // Version nie eine Mail je Kandidat verschickt (20.10.2026).
    if (body.action === 'ping') return json({ ok: true, bundles: true });
    const user = await authUser(req);
    const db = serviceClient();
    const ctx = defaultCtx(db);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    must(text.length > 0 && text.length <= 2000, 'Der Text fehlt oder ist zu lang.');

    const me = await recruiterProfile(db, user.id);

    if (body.action === 'client_nudge') {
      const ids: unknown[] = Array.isArray(body.submissionIds) && body.submissionIds.length ? body.submissionIds : [body.submissionId];
      must(ids.length <= 30, 'Höchstens 30 Einreichungen auf einmal.');
      const bundles = [];
      for (const id of [...new Set(ids)]) bundles.push(await loadBundle(db, id, user.id));

      // Sperre: einmal in drei Tagen je Einreichung
      const { data: recent } = await db.from('candidate_activity_log')
        .select('related_submission_id')
        .in('related_submission_id', bundles.map((x) => x.submission.id))
        .eq('recruiter_id', user.id)
        .contains('metadata', { kind: 'client_nudge' })
        .gte('created_at', new Date(ctx.now() - NUDGE_COOLDOWN_MS).toISOString());
      const blocked = new Set((recent ?? []).map((r: any) => r.related_submission_id));
      const todo = bundles.filter((x) => !blocked.has(x.submission.id));
      must(todo.length > 0, 'Der Kunde wurde in den letzten drei Tagen schon erinnert.', 'not_allowed');

      const label = (x: typeof todo[number]) => (x.submission.identity_unlocked ? x.candidate.full_name : `Bewerber ${anonCode(x.candidate.id)}`);
      // Nach dem Interview (Nachgespräch, 20.10.2026): nach dem Eindruck fragen, nicht nach einer Prüfung
      const afterInterview = body.intent === 'interview_feedback';
      const ask = afterInterview ? 'bittet um Ihren Eindruck aus dem Interview mit' : 'bittet um Rückmeldung zu';
      const closing = afterInterview
        ? 'Antworten Sie direkt im Dashboard: nächstes Gespräch, Angebot oder Absage.'
        : 'Antworten Sie direkt im Dashboard (Interview anfragen, Absagen oder „Noch in Prüfung“).';
      const detailUrl = (x: typeof todo[number]) => `${ctx.appUrl()}/dashboard/candidates/${x.submission.id}`;

      // Je Kundenteam eine Mail, darin je Stelle die wartenden Kandidaten
      const byClient = new Map<string, typeof todo>();
      for (const x of todo) {
        const key = `${x.job.client_id ?? ''}|${x.job.organization_id ?? ''}`;
        byClient.set(key, [...(byClient.get(key) ?? []), x]);
      }
      let recipients = 0;
      let mails = 0;
      for (const list of byClient.values()) {
        const team = await clientTeam(db, list[0].job);
        recipients += team.length;
        const byJob = new Map<string, typeof todo>();
        for (const x of list) byJob.set(x.job.id, [...(byJob.get(x.job.id) ?? []), x]);
        const title = list.length === 1
          ? `Ihr Headhunter ${ask} ${label(list[0])}`
          : `Ihr Headhunter ${ask} ${list.length} Kandidaten`;
        for (const person of team) {
          for (const jobList of byJob.values()) {
            const n = jobList.length;
            await db.from('notifications').insert({
              user_id: person.userId, type: 'recruiter_nudge',
              title: n === 1 ? `Ihr Headhunter ${ask} ${label(jobList[0])}` : `Ihr Headhunter ${ask} ${n} Kandidaten`,
              message: `${jobList[0].job.title} · ${text}`,
              related_type: 'submission', related_id: jobList[0].submission.id,
            });
          }
          if (!person.email) continue;
          const blocks = [...byJob.values()].map((jobList) =>
            `${jobList[0].job.title}:\n${jobList.map((x) => `– ${label(x)}: ${detailUrl(x)}`).join('\n')}`);
          const bodyText = `Guten Tag ${person.name},\n\n${me.name} bittet über Matchunt um Ihre Rückmeldung:\n\n${text}\n\n${blocks.join('\n\n')}\n\n${closing}`;
          const htmlJobs = [...byJob.values()].map((jobList) =>
            `<p style="margin:16px 0 6px;font-weight:600">${esc(jobList[0].job.title)}</p>`
            + jobList.map((x) => `<p style="margin:0 0 6px">${esc(label(x))} · <a href="${detailUrl(x)}" style="color:#111">Einreichung öffnen</a></p>`).join('')).join('');
          const r = await ctx.mail({
            fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: person.email, replyTo: me.email ?? undefined,
            subject: title,
            text: bodyText,
            html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(`Guten Tag ${person.name},\n\n${me.name} bittet über Matchunt um Ihre Rückmeldung:\n\n${text}`)}${htmlJobs}<p style="margin-top:16px;color:#555">${esc(closing)}</p></div>`,
          }, { template: 'recruiter_client_nudge', meta: { submission_ids: list.map((x) => x.submission.id), intent: body.intent ?? null } });
          if (r.sent) mails++;
        }
      }

      for (const x of todo) {
        await db.from('candidate_activity_log').insert({
          candidate_id: x.candidate.id, recruiter_id: user.id, activity_type: 'email',
          title: afterInterview ? 'Kunden nach Interview-Eindruck gefragt' : 'Kunden erinnert', description: text,
          metadata: { kind: 'client_nudge', intent: body.intent ?? null, hints: body.hints ?? [], recipients, mails, bundle: todo.length },
          related_submission_id: x.submission.id,
        });
      }
      return json({ ok: true, bundled: true, nudged: todo.map((x) => x.submission.id), skipped: [...blocked], recipients, mails });
    }

    if (body.action === 'job_questions') {
      must(typeof body.jobId === 'string' && UUID.test(body.jobId), 'Ungültige Stelle.');
      const fragen: string[] = Array.isArray(body.fragen)
        ? [...new Set(body.fragen.map((f: any) => (typeof f?.frage === 'string' ? f.frage.trim() : '')).filter((f: string) => f && f.length <= 200))].slice(0, 20) as string[]
        : [];
      must(fragen.length > 0, 'Bitte mindestens eine Frage auswählen.');
      // Nur wer für diese Stelle sucht, darf den Kunden fragen.
      const { data: act } = await db.from('recruiter_job_activations')
        .select('id, status').eq('job_id', body.jobId).eq('recruiter_id', user.id)
        .order('activated_at', { ascending: false }).limit(1).maybeSingle();
      must(act && act.status !== 'ended', 'Fragen an den Kunden gehen erst, wenn du für diese Stelle suchst.', 'not_allowed');
      const { data: job } = await db.from('jobs').select('id, title, client_id, organization_id').eq('id', body.jobId).maybeSingle();
      must(job, 'Stelle nicht gefunden.', 'not_found');
      const { data: recent } = await db.from('email_events').select('id')
        .eq('template_name', 'recruiter_job_questions')
        .contains('metadata', { job_id: body.jobId, recruiter_id: user.id })
        .gte('created_at', new Date(ctx.now() - QUESTIONS_COOLDOWN_MS).toISOString()).limit(1);
      must(!(recent ?? []).length, 'Du hast den Kunden in den letzten sieben Tagen schon gefragt.', 'not_allowed');

      const team = await clientTeam(db, job);
      const link = `${ctx.appUrl()}/dashboard/aufnahme/${job.id}`;
      const subject = `Ihr Headhunter hat ${fragen.length === 1 ? 'eine Frage' : `${fragen.length} Fragen`} zu ${job.title}`;
      const liste = fragen.map((f) => `– ${f}`).join('\n');
      const closing = 'Antworten Sie direkt in der Aufnahme der Stelle; Ihr Headhunter sieht die Angaben dann im Briefing.';
      let mails = 0;
      for (const person of team) {
        await db.from('notifications').insert({
          user_id: person.userId, type: 'recruiter_nudge', title: subject,
          message: `${text}\n${liste}`, related_type: 'job', related_id: job.id,
        });
        if (!person.email) continue;
        const r = await ctx.mail({
          fromEmail: ctx.fromEmail, fromName: 'Matchunt', to: person.email, replyTo: me.email ?? undefined, subject,
          text: `Guten Tag ${person.name},\n\n${me.name} sucht über Matchunt für Ihre Stelle „${job.title}“ und hat Fragen:\n\n${text}\n\n${liste}\n\n${closing}\n${link}`,
          html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">${paragraphs(`Guten Tag ${person.name},\n\n${me.name} sucht über Matchunt für Ihre Stelle „${job.title}“ und hat Fragen:\n\n${text}`)}`
            + `<ul style="margin:0 0 16px;padding-left:20px">${fragen.map((f) => `<li style="margin:0 0 4px">${esc(f)}</li>`).join('')}</ul>`
            + `<p style="margin:0 0 12px"><a href="${link}" style="color:#111;font-weight:600">Fragen in der Aufnahme beantworten</a></p>`
            + `<p style="margin-top:16px;color:#555">${esc(closing)}</p></div>`,
        }, { template: 'recruiter_job_questions', meta: { job_id: job.id, recruiter_id: user.id, fragen: fragen.length } });
        if (r.sent) mails++;
      }
      return json({ ok: true, recipients: team.length, mails });
    }

    if (body.action === 'candidate_message') {
      const b = await loadBundle(db, body.submissionId, user.id);
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

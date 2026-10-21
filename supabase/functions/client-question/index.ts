// Frage des Kunden an den Headhunter zu einem eingereichten Kandidaten – und die Antwort.
//
//   ask     Kunde (Team der Stelle) → Headhunter der Einreichung
//   answer  Headhunter der Einreichung → der Kunde, der gefragt hat
//
// Jede Nachricht landet in `messages` (Stelle + Kandidat, ein Gespräch je Einreichung),
// dazu Glocke und Mail über den bestätigten Absender. Antworten des Headhunters werden
// geschwärzt (Name, Arbeitgeber), solange der Kandidat nicht zugestimmt hat.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { canUserActOnJob } from '../_shared/team-access.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { esc, layout, sendIntakeMail } from '../_shared/intake-mail.ts';

// deno-lint-ignore-file no-explicit-any

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_TEXT = 1000;

const anonCode = (candidateId: string) => `PR-${String(candidateId ?? '').slice(0, 6).toUpperCase()}`;
const paragraphs = (text: string) =>
  text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

class Fail extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
function must(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new Fail(message, status);
}

async function authUserId(req: Request): Promise<string> {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  must(!error && data.user, 'Bitte melden Sie sich an.', 401);
  return data.user!.id;
}

/** Ganze Wörter ersetzen, Groß/klein egal. */
function replaceWords(text: string, tokens: string[], repl: string): string {
  let out = text;
  for (const t of [...new Set(tokens)].filter((x) => x && x.length >= 3).sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu');
    out = out.replace(re, repl);
  }
  return out;
}

const LEGAL = /^(gmbh|ag|kg|se|mbh|co|ohg|ug|ltd|inc|gbr|e\.?v\.?|und|&|the|group|gruppe|holding)$/i;

/** Name und Arbeitgeber des Kandidaten aus dem Antworttext nehmen, solange er nicht zugestimmt hat. */
async function scrubAnswer(db: any, candidateId: string, text: string): Promise<string> {
  const { data: cand } = await db.from('candidates').select('full_name, company').eq('id', candidateId).maybeSingle();
  const { data: exps } = await db.from('candidate_experiences').select('company_name').eq('candidate_id', candidateId);
  const name = String(cand?.full_name ?? '').trim();
  const nameTokens = name ? [name, ...name.split(/\s+/)] : [];
  const firms = [cand?.company, ...(exps ?? []).map((e: any) => e.company_name)].filter(Boolean).map((f: string) => f.trim());
  const firmTokens = firms.flatMap((f) => [f, ...f.split(/\s+/).filter((w) => w.length >= 4 && !LEGAL.test(w))]);
  return replaceWords(replaceWords(text, nameTokens, 'der Kandidat'), firmTokens, '[ein Unternehmen]');
}

async function profile(db: any, userId: string) {
  const { data } = await db.from('profiles').select('full_name, email').eq('user_id', userId).maybeSingle();
  return { name: (data?.full_name as string) || null, email: data?.email ? String(data.email).toLowerCase() : null };
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    must(action === 'ask' || action === 'answer', 'Unbekannte Aktion.');
    must(typeof body.submission_id === 'string' && UUID.test(body.submission_id), 'Ungültige Einreichung.');
    const raw = typeof body.text === 'string' ? body.text.trim() : '';
    must(raw.length >= 2, 'Bitte eine Nachricht eingeben.');
    must(raw.length <= MAX_TEXT, `Höchstens ${MAX_TEXT} Zeichen.`);

    const userId = await authUserId(req);
    const db = serviceClient();

    const { data: sub } = await db
      .from('submissions')
      .select('id, job_id, candidate_id, recruiter_id, identity_unlocked, jobs!inner(id, title, company_name), candidates!inner(job_title)')
      .eq('id', body.submission_id)
      .maybeSingle();
    must(sub, 'Einreichung nicht gefunden.', 404);
    const job = (sub as any).jobs;
    const code = anonCode(sub.candidate_id);
    const appUrl = getPublicAppUrl();

    // Bisheriges Gespräch zu dieser Einreichung (Stelle + Kandidat)
    const { data: thread } = await db
      .from('messages')
      .select('id, conversation_id, sender_id, recipient_id, created_at')
      .eq('job_id', sub.job_id)
      .eq('candidate_id', sub.candidate_id)
      .or(`sender_id.eq.${sub.recruiter_id},recipient_id.eq.${sub.recruiter_id}`)
      .order('created_at', { ascending: true });

    if (action === 'ask') {
      must(await canUserActOnJob(db, userId, sub.job_id), 'Keine Berechtigung für diese Stelle.', 403);
      const conversationId = (thread ?? []).find((m: any) => m.sender_id === userId || m.recipient_id === userId)?.conversation_id ?? crypto.randomUUID();
      const { data: msg, error } = await db
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: userId, recipient_id: sub.recruiter_id, job_id: sub.job_id, candidate_id: sub.candidate_id, content: raw })
        .select('id')
        .single();
      if (error) throw error;

      const asker = await profile(db, userId);
      const firm = job.company_name || 'Der Kunde';
      await db.from('notifications').insert({
        user_id: sub.recruiter_id,
        type: 'client_question',
        title: `${firm} hat eine Frage zu deinem Kandidaten`,
        message: `${code} · ${job.title}: „${raw.slice(0, 140)}${raw.length > 140 ? '…' : ''}“`,
        related_type: 'conversation',
        related_id: conversationId,
      });

      const hh = await profile(db, sub.recruiter_id);
      let mailSent = false;
      if (hh.email) {
        const link = `${appUrl}/recruiter/messages?c=${conversationId}`;
        const res = await sendIntakeMail(db, {
          to: hh.email,
          subject: `${firm} fragt zu ${(sub as any).candidates?.job_title || 'deinem Kandidaten'} (${code})`,
          html: layout({
            preheader: `Frage zu ${code} · ${job.title}`,
            heading: 'Der Kunde hat eine Frage',
            body: `<p style="margin:0 0 12px">Hallo ${esc(hh.name ?? '')},</p>
<p style="margin:0 0 12px">${esc(asker.name ?? 'Der Kunde')} von <strong>${esc(firm)}</strong> fragt zu deinem Kandidaten <strong>${esc(code)}</strong> für „${esc(job.title)}“:</p>
<blockquote style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid #111827;color:#334155;">${paragraphs(raw)}</blockquote>`,
            cta: { label: 'Antworten', url: link },
            after: 'Je schneller du antwortest, desto schneller entscheidet der Kunde.',
            footnote: 'Bitte nenne in der Antwort keinen Namen und keinen Arbeitgeber des Kandidaten, solange er nicht zugestimmt hat.',
          }),
          template: 'client_question',
          replyTo: asker.email ?? undefined,
          meta: { message_id: msg.id, submission_id: sub.id },
          idempotencyKey: `client-question-${msg.id}`,
        });
        mailSent = res.sent;
      }
      return json({ ok: true, message_id: msg.id, conversation_id: conversationId, mail_sent: mailSent });
    }

    // answer: nur der Headhunter dieser Einreichung, an den Kunden, der zuletzt gefragt hat
    must(sub.recruiter_id === userId, 'Keine Berechtigung für diese Einreichung.', 403);
    const lastAsk = [...(thread ?? [])].reverse().find((m: any) => m.sender_id !== userId);
    must(lastAsk, 'Zu diesem Kandidaten liegt keine Frage des Kunden vor.', 409);
    const clientId = lastAsk.sender_id as string;
    const text = sub.identity_unlocked ? raw : await scrubAnswer(db, sub.candidate_id, raw);
    const { data: msg, error } = await db
      .from('messages')
      .insert({ conversation_id: lastAsk.conversation_id, sender_id: userId, recipient_id: clientId, job_id: sub.job_id, candidate_id: sub.candidate_id, content: text })
      .select('id')
      .single();
    if (error) throw error;

    const hh = await profile(db, userId);
    const hhName = hh.name || 'Ihr Headhunter';
    await db.from('notifications').insert({
      user_id: clientId,
      type: 'recruiter_answer',
      title: `${hhName} hat Ihre Frage beantwortet`,
      message: `${code} · ${job.title}: „${text.slice(0, 140)}${text.length > 140 ? '…' : ''}“`,
      related_type: 'submission',
      related_id: sub.id,
    });

    const client = await profile(db, clientId);
    let mailSent = false;
    if (client.email) {
      const res = await sendIntakeMail(db, {
        to: client.email,
        subject: `${hhName} hat Ihre Frage beantwortet`,
        html: layout({
          preheader: `Antwort zu ${code} · ${job.title}`,
          heading: 'Antwort auf Ihre Frage',
          body: `<p style="margin:0 0 12px">Guten Tag${client.name ? ` ${esc(client.name)}` : ''},</p>
<p style="margin:0 0 12px"><strong>${esc(hhName)}</strong> hat Ihre Frage zu <strong>${esc(code)}</strong> für „${esc(job.title)}“ beantwortet:</p>
<blockquote style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid #111827;color:#334155;">${paragraphs(text)}</blockquote>`,
          cta: { label: 'Zum Bewerberprofil', url: `${appUrl}/dashboard/candidates/${sub.id}` },
        }),
        template: 'recruiter_answer',
        meta: { message_id: msg.id, submission_id: sub.id },
        idempotencyKey: `recruiter-answer-${msg.id}`,
      });
      mailSent = res.sent;
    }
    return json({ ok: true, message_id: msg.id, conversation_id: lastAsk.conversation_id, mail_sent: mailSent, scrubbed: text !== raw });
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error('[client-question]', e);
    return json({ error: 'Die Nachricht konnte nicht gesendet werden.' }, 500);
  }
});

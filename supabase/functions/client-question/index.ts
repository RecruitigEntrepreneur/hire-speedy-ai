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
import { m, tx } from '../_shared/notify-i18n.ts';
import { clientLanguage, recruiterLanguage } from '../_shared/recipient-language.ts';

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
      // Glocke und Mail an den Headhunter in seiner Profilsprache (du); Deutsch wortgleich
      const l = await recruiterLanguage(db, sub.recruiter_id);
      const firm = job.company_name || tx(l, 'Der Kunde', 'The client', 'Kunden', 'Kunden');
      await db.from('notifications').insert({
        user_id: sub.recruiter_id,
        type: 'client_question',
        title: tx(l, m`${firm} hat eine Frage zu deinem Kandidaten`, m`${firm} has a question about your candidate`, m`${firm} har en fråga om din kandidat`, m`${firm} har et spørsmål om kandidaten din`),
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
          subject: tx(l, m`${firm} fragt zu ${(sub as any).candidates?.job_title || 'deinem Kandidaten'} (${code})`, m`${firm} asks about ${(sub as any).candidates?.job_title || 'your candidate'} (${code})`, m`${firm} frågar om ${(sub as any).candidates?.job_title || 'din kandidat'} (${code})`, m`${firm} spør om ${(sub as any).candidates?.job_title || 'kandidaten din'} (${code})`),
          html: layout({
            ...(l === 'de' ? {} : { lang: l }),
            preheader: tx(l, m`Frage zu ${code} · ${job.title}`, m`Question about ${code} · ${job.title}`, m`Fråga om ${code} · ${job.title}`, m`Spørsmål om ${code} · ${job.title}`),
            heading: tx(l, 'Der Kunde hat eine Frage', 'The client has a question', 'Kunden har en fråga', 'Kunden har et spørsmål'),
            body: `<p style="margin:0 0 12px">${tx(l, 'Hallo', 'Hi', 'Hej', 'Hei')} ${esc(hh.name ?? '')},</p>
<p style="margin:0 0 12px">${tx(l,
  m`${esc(asker.name ?? 'Der Kunde')} von <strong>${esc(firm)}</strong> fragt zu deinem Kandidaten <strong>${esc(code)}</strong> für „${esc(job.title)}“:`,
  m`${esc(asker.name ?? 'The client')} from <strong>${esc(firm)}</strong> asks about your candidate <strong>${esc(code)}</strong> for “${esc(job.title)}”:`,
  m`${esc(asker.name ?? 'Kunden')} från <strong>${esc(firm)}</strong> frågar om din kandidat <strong>${esc(code)}</strong> för ”${esc(job.title)}”:`,
  m`${esc(asker.name ?? 'Kunden')} fra <strong>${esc(firm)}</strong> spør om kandidaten din <strong>${esc(code)}</strong> til «${esc(job.title)}»:`)}</p>
<blockquote style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid #111827;color:#334155;">${paragraphs(raw)}</blockquote>`,
            cta: { label: tx(l, 'Antworten', 'Reply', 'Svara', 'Svar'), url: link },
            after: tx(l, 'Je schneller du antwortest, desto schneller entscheidet der Kunde.', 'The faster you reply, the faster the client decides.', 'Ju snabbare du svarar, desto snabbare bestämmer sig kunden.', 'Jo raskere du svarer, desto raskere bestemmer kunden seg.'),
            footnote: tx(l, 'Bitte nenne in der Antwort keinen Namen und keinen Arbeitgeber des Kandidaten, solange er nicht zugestimmt hat.', 'Please do not mention the candidate’s name or employer in your answer until they have agreed.', 'Nämn inte kandidatens namn eller arbetsgivare i svaret förrän kandidaten har gett sitt samtycke.', 'Ikke nevn kandidatens navn eller arbeidsgiver i svaret før kandidaten har samtykket.'),
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
    // Glocke und Mail an den Kunden in seiner Sprache (Profil, sonst Deutsch); Deutsch wortgleich
    const cl = await clientLanguage(db, { userId: clientId });
    const hhName = hh.name || tx(cl, 'Ihr Headhunter', 'Your headhunter', 'Din headhunter', 'Din headhunter');
    const answered = tx(cl, m`${hhName} hat Ihre Frage beantwortet`, m`${hhName} has answered your question`, m`${hhName} har svarat på din fråga`, m`${hhName} har svart på spørsmålet ditt`);
    await db.from('notifications').insert({
      user_id: clientId,
      type: 'recruiter_answer',
      title: answered,
      message: `${code} · ${job.title}: „${text.slice(0, 140)}${text.length > 140 ? '…' : ''}“`,
      related_type: 'submission',
      related_id: sub.id,
    });

    const client = await profile(db, clientId);
    let mailSent = false;
    if (client.email) {
      const res = await sendIntakeMail(db, {
        to: client.email,
        subject: answered,
        html: layout({
          ...(cl === 'de' ? {} : { lang: cl }),
          preheader: tx(cl, m`Antwort zu ${code} · ${job.title}`, m`Answer about ${code} · ${job.title}`, m`Svar om ${code} · ${job.title}`, m`Svar om ${code} · ${job.title}`),
          heading: tx(cl, 'Antwort auf Ihre Frage', 'Answer to your question', 'Svar på din fråga', 'Svar på spørsmålet ditt'),
          body: `<p style="margin:0 0 12px">${tx(cl, 'Guten Tag', 'Hello', 'Hej', 'Hei')}${client.name ? ` ${esc(client.name)}` : ''},</p>
<p style="margin:0 0 12px">${tx(cl,
  m`<strong>${esc(hhName)}</strong> hat Ihre Frage zu <strong>${esc(code)}</strong> für „${esc(job.title)}“ beantwortet:`,
  m`<strong>${esc(hhName)}</strong> has answered your question about <strong>${esc(code)}</strong> for “${esc(job.title)}”:`,
  m`<strong>${esc(hhName)}</strong> har svarat på din fråga om <strong>${esc(code)}</strong> för ”${esc(job.title)}”:`,
  m`<strong>${esc(hhName)}</strong> har svart på spørsmålet ditt om <strong>${esc(code)}</strong> til «${esc(job.title)}»:`)}</p>
<blockquote style="margin:12px 0;padding:10px 14px;background:#f8fafc;border-left:3px solid #111827;color:#334155;">${paragraphs(text)}</blockquote>`,
          cta: { label: tx(cl, 'Zum Bewerberprofil', 'Go to candidate profile', 'Till kandidatprofilen', 'Til kandidatprofilen'), url: `${appUrl}/dashboard/candidates/${sub.id}` },
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

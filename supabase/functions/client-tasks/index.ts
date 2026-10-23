// Aufgaben des Kunden (23.10.2026): Liste je Kundenteam und die Antworten, die keine
// andere Function abdeckt (Frage beantworten/weitergeben, nachfassen lassen, Antritt,
// Rechnung). Logik in _shared/client-tasks.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import {
  answerQuestion, askFollowup, confirmStart, forwardQuestion, invoicePaid, invoiceQuestion, listClientTasks, logDone, questionColleagues,
} from '../_shared/client-tasks.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = defaultCtx(serviceClient());
    switch (body.action ?? 'list') {
      case 'list': return json(await listClientTasks(ctx, user, body));
      case 'log_done': return json(await logDone(ctx, user, body));
      case 'answer_question': return json(await answerQuestion(ctx, user, body));
      case 'forward_question': return json(await forwardQuestion(ctx, user, body));
      case 'question_colleagues': return json(await questionColleagues(ctx, user, body));
      case 'ask_followup': return json(await askFollowup(ctx, user, body));
      case 'confirm_start': return json(await confirmStart(ctx, user, body));
      case 'invoice_paid': return json(await invoicePaid(ctx, user, body));
      case 'invoice_question': return json(await invoiceQuestion(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});

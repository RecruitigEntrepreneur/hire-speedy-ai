// Kunden-Seite der Interview-Terminierung v2: Kontext für das Anfrage-Fenster,
// freie Zeiten (mit Outlook), Mail-Vorschau, Senden, andere Zeit bestätigen,
// Anfrage zurückziehen. Logik in _shared/interview-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import {
  authUser, availability, confirmAlternative, defaultCtx, interviewFailure, inviteColleague, must, preview, requestContext, send, withdraw,
} from '../_shared/interview-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = defaultCtx(serviceClient());
    switch (body.action) {
      case 'context': return json(await requestContext(ctx, user, body.submissionId));
      case 'availability': return json(await availability(ctx, user, body));
      case 'preview': return json(await preview(ctx, user, body));
      case 'send': return json(await send(ctx, user, body));
      case 'confirm_alternative': return json(await confirmAlternative(ctx, user, body.interviewId));
      case 'withdraw': return json(await withdraw(ctx, user, body.interviewId, body.reason));
      case 'invite_colleague': return json(await inviteColleague(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});

// Angebot über den Headhunter (22.10.2026): Kontext und Angebot für den Kunden,
// Antwort des Kandidaten durch den Headhunter, Empfehlung vor dem Angebot.
// Logik in _shared/offer-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { authUser, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { createOffer, extendOffer, keepOffer, offerContext, recommend, recruiterContext, respondOffer, withdrawOffer } from '../_shared/offer-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const user = await authUser(req);
    const ctx = defaultCtx(serviceClient());
    switch (body.action) {
      case 'context': return json(await offerContext(ctx, user, body));
      case 'recruiter_context': return json(await recruiterContext(ctx, user, body));
      case 'create': return json(await createOffer(ctx, user, body));
      case 'respond': return json(await respondOffer(ctx, user, body));
      case 'keep': return json(await keepOffer(ctx, user, body));
      case 'withdraw': return json(await withdrawOffer(ctx, user, body));
      case 'extend': return json(await extendOffer(ctx, user, body));
      case 'recommend': return json(await recommend(ctx, user, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});

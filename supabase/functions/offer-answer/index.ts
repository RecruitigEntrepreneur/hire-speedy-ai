// Angebot an den Kandidaten (G + H, 25.10.2026): Seite /angebot/:token ohne Konto.
// Der persönliche Link ist der Zugang (nur sein Hash liegt in der Datenbank).
// Stand ansehen, antworten (Zusage, Absage, mit dem Headhunter sprechen) oder eine
// gemeldete Zusage bestätigen. Logik in _shared/offer-candidate.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { candidateAnswer, candidatePeek } from '../_shared/offer-candidate.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const ctx = defaultCtx(serviceClient());
    switch (body.action) {
      case 'peek': return json(await candidatePeek(ctx, body));
      case 'answer': return json(await candidateAnswer(ctx, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});

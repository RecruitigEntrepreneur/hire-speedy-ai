// Kandidat auf dem Laufenden beim Arbeitsvertrag (29.10.2026): Seite /vertrag/:token ohne Konto.
// Der persönliche Link ist der Zugang (nur sein Hash liegt in der Datenbank).
// Stand ansehen und antworten: angekommen, noch nicht da, schon unterschrieben,
// nach einer Meldung der Firma „Stimmt“ oder „Stimmt so nicht“.
// Logik in _shared/contract-service.ts.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';
import { contractCtx, statusAnswer, statusPeek } from '../_shared/contract-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const ctx = contractCtx(defaultCtx(serviceClient()));
    switch (body.action) {
      case 'peek': return json(await statusPeek(ctx, body));
      case 'answer': return json(await statusAnswer(ctx, body));
      default: must(false, 'Unbekannte Aktion.');
    }
  } catch (e) {
    return interviewFailure(e);
  }
});

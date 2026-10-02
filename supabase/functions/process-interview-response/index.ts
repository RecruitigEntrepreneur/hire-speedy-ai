// Antwort des Kandidaten: Termin bestätigen (accept), andere Zeit wählen
// (alternative; bei verbundenem Kalender des Kunden sofort gebucht, sonst
// bestätigt der Kunde) oder ablehnen (decline). Ohne Anmeldung, nur Token.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { candidateRespond, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    must(['accept', 'alternative', 'decline'].includes(body.action), 'Unbekannte Aktion.');
    return json(await candidateRespond(defaultCtx(serviceClient()), body));
  } catch (e) {
    return interviewFailure(e);
  }
});

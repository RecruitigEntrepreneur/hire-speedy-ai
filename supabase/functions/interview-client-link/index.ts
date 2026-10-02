// Kunde bestätigt die vom Kandidaten angefragte Zeit direkt aus der Mail
// (/interview/bestaetigen/:token), ohne Anmeldung. Der Link ist 7 Tage gültig
// und nur einmal verwendbar.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { clientLink, defaultCtx, interviewFailure, must } from '../_shared/interview-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    must(['peek', 'confirm'].includes(body.action), 'Unbekannte Aktion.');
    return json(await clientLink(defaultCtx(serviceClient()), body));
  } catch (e) {
    return interviewFailure(e);
  }
});

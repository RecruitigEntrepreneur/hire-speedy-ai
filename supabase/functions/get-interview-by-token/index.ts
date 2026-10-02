// Kandidatenseite /interview/respond/:token: lädt die Einladung über den
// gehashten Link (alte Links mit Klartext-Token funktionieren weiter).
// Liefert nur, was der Kandidat sehen darf: Firma, Stelle, Termine,
// Gesprächspartner mit Name und Rolle (ohne Mailadressen), Headhunter.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { json, preflight } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { defaultCtx, interviewFailure, loadCandidateView } from '../_shared/interview-service.ts';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const body = await req.json().catch(() => ({}));
    return json(await loadCandidateView(defaultCtx(serviceClient()), body.token));
  } catch (e) {
    return interviewFailure(e);
  }
});

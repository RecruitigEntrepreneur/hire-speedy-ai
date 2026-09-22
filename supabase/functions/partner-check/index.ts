import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { workflowFailure } from '../_shared/recruiter-onboarding-service.ts';
import { partnerCheck } from '../_shared/recruiter-partner-service.ts';

/**
 * Öffentliche Prüfung einer Partnernummer, ohne Anmeldung (verify_jwt = false).
 * Die Prüfseite matchunt.ai/partner/<nummer> fragt per POST, das Website-Abzeichen
 * per GET (?n=…&embed=1), damit der Browser keine Vorabanfrage schicken muss.
 * Antwortet nur mit dem, was die Prüfseite zeigen darf.
 */
serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  try {
    const db = serviceClient();
    const origin = req.headers.get('origin');
    if (req.method === 'GET') {
      const url = new URL(req.url);
      return json(await partnerCheck(db, { number: url.searchParams.get('n'), embed: url.searchParams.get('embed') }, origin));
    }
    const body = await req.json().catch(() => ({}));
    return json(await partnerCheck(db, { number: body.number, embed: body.embed }, origin));
  } catch (e) {
    return workflowFailure(e);
  }
});

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, clientIp } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { must, workflowFailure } from '../_shared/recruiter-onboarding-service.ts';
import { peekClientLink, sendClientCode, verifyClientCode } from '../_shared/client-code.ts';

/**
 * client-login — Anmeldung für Kunden per Code (/anmelden).
 *
 * Drei Aktionen, alle ohne Sitzung: persönlichen Link ansehen, Code anfordern,
 * Code prüfen und die Sitzung zurückgeben. Logik und Schutz stehen in
 * _shared/client-code.ts.
 */
serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    const db = serviceClient();
    if (body.action === 'peek') return json(await peekClientLink(db, body.link));
    if (body.action === 'code') return json(await sendClientCode(db, { email: body.email, link: body.link, ip: clientIp(req) }));
    if (body.action === 'verify') return json(await verifyClientCode(db, { email: body.email, link: body.link, code: body.code, ip: clientIp(req) }));
    must(false, 'Unbekannte Aktion.');
  } catch (e) { return workflowFailure(e); }
});

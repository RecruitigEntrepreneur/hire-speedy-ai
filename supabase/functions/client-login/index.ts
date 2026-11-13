import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { must, workflowFailure, WorkflowError } from '../_shared/recruiter-onboarding-service.ts';
import { peekClientLink, sendClientCode, verifyClientCode } from '../_shared/client-code.ts';
import { normLang, type Lang } from '../_shared/i18n.ts';
import { localizeIntakeMessage } from '../_shared/intake-i18n.ts';

/**
 * client-login — Anmeldung für Kunden per Code (/anmelden).
 *
 * Drei Aktionen, alle ohne Sitzung: persönlichen Link ansehen, Code anfordern,
 * Code prüfen und die Sitzung zurückgeben. Logik und Schutz stehen in
 * _shared/client-code.ts.
 *
 * Jeder Aufruf kann `lang` tragen: In dieser Sprache gehen die Code-Mail und
 * die Meldungen raus. Die Logik meldet weiter im deutschen Wortlaut; übersetzt
 * wird hier, an einer Stelle. Ohne `lang` bleibt alles Deutsch.
 */
serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  let lang: Lang | null = null;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const body = await req.json().catch(() => ({}));
    lang = normLang(body.lang);
    const db = serviceClient();
    if (body.action === 'peek') return json(await peekClientLink(db, body.link));
    if (body.action === 'code') return json(await sendClientCode(db, { email: body.email, link: body.link, ip: clientIp(req), lang }));
    if (body.action === 'verify') return json(await verifyClientCode(db, { email: body.email, link: body.link, code: body.code, ip: clientIp(req) }));
    must(false, 'Unbekannte Aktion.');
  } catch (e) {
    // Kundentexte (Sie) stehen in intake-i18n; gemeinsame Meldungen findet es beim Headhunter-Einstieg.
    if (e instanceof WorkflowError) return fail(e.reason, localizeIntakeMessage(lang, e.message));
    return workflowFailure(e, lang);
  }
});

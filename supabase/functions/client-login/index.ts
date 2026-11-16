import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { must, verifiedUser, workflowFailure, WorkflowError } from '../_shared/recruiter-onboarding-service.ts';
import { peekClientLink, sendClientCode, verifyClientCode } from '../_shared/client-code.ts';
import { normLang, type Lang } from '../_shared/i18n.ts';
import { localizeIntakeMessage } from '../_shared/intake-i18n.ts';
import { openDraftSession } from '../_shared/client-start-session.ts';
import { clientContractCheck, clientContractSignUrl, clientContractState } from '../_shared/client-contract.ts';

/**
 * client-login — Anmeldung für Kunden per Code (/anmelden).
 *
 * Ohne Sitzung: persönlichen Link ansehen, Code anfordern, Code prüfen und die
 * Sitzung zurückgeben (_shared/client-code.ts), dazu die Anmeldung aus der Aufnahme
 * (_shared/client-start-session.ts). Mit Sitzung: der eigene Vertrag im Wartezustand
 * des Dashboards (_shared/client-contract.ts).
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
    if (body.action === 'draft-session') return json(await openDraftSession(db, { draft_token: body.draft_token, ticket: body.ticket, ip: clientIp(req) }));
    if (body.action === 'contract-state') return json(await clientContractState(db, await verifiedUser(req)));
    if (body.action === 'contract-sign') return json(await clientContractSignUrl(db, await verifiedUser(req)));
    if (body.action === 'contract-check') return json(await clientContractCheck(db, await verifiedUser(req)));
    must(false, 'Unbekannte Aktion.');
  } catch (e) {
    // Kundentexte (Sie) stehen in intake-i18n; gemeinsame Meldungen findet es beim Headhunter-Einstieg.
    if (e instanceof WorkflowError) return fail(e.reason, localizeIntakeMessage(lang, e.message));
    return workflowFailure(e, lang);
  }
});

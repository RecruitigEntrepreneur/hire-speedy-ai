import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp } from '../_shared/http.ts';
import { hashKey } from '../_shared/tokens.ts';
import { checkLimits, LIMITS } from '../_shared/intake-limits.ts';
import { serviceClient, resolveDraft, touchDraft, logEvent } from '../_shared/intake-core.ts';

/**
 * intake-ai — der einzige Weg des Gasts zur KI.
 *
 * Warum ein Proxy und nicht verify_jwt = false an intake-questions:
 * Die KI-Functions kennen keinen Aufrufer-Begriff (kein Auth-Header-Parsing,
 * kein getUser, keine Owner-Pruefung) und es gibt nirgends ein Rate-Limit.
 * Ein Flip auf verify_jwt = false wuerde LLM- und Firecrawl-Budget ungebremst
 * ins offene Netz stellen. Hier sitzt stattdessen:
 *   - Pruefung des Entwurfs-Tokens
 *   - Zaehlung je Entwurf und je IP
 *   - harte Obergrenzen auf die Eingabe (Token-Kosten)
 *   - Protokollierung jedes Aufrufs, damit Missbrauch ueberhaupt sichtbar wird
 *
 * intake-questions bleibt unveraendert auf verify_jwt = true und behaelt seine
 * gelockte Eigenschaft "stateless, kein DB-Zugriff, kein Service-Role".
 */

const MAX_JOB_DRAFT_BYTES = 32 * 1024;
const MAX_TEXT_CHARS = 60_000;
const MAX_ANSWERS = 200;

/** Ziele, die per Proxy erreichbar sind. Nichts sonst. */
const TARGETS = {
  questions: 'intake-questions',
  parse_text: 'parse-job-url',
  parse_url: 'parse-job-url',
} as const;
type Op = keyof typeof TARGETS;

/**
 * SSRF-Vorfilter. parse-job-url:78-83 fetcht die uebergebene URL heute ohne
 * jede Pruefung — als anonym erreichbarer Endpunkt waere das ein Werkzeug fuer
 * Cloud-Metadaten (169.254.169.254) und interne Hosts. Die Function selbst
 * wird gesondert gehaertet; hier steht die erste Sperre.
 */
const PRIVATE_HOST = new RegExp(
  [
    '^localhost$', '^127\\.', '^0\\.', '^10\\.', '^192\\.168\\.',
    '^172\\.(1[6-9]|2[0-9]|3[01])\\.', '^169\\.254\\.',
    '^::1$', '^fc', '^fd', '^fe80:',
    '\\.local$', '\\.internal$', '^metadata',
  ].join('|'),
  'i',
);

function urlIsSafe(raw: string): { ok: boolean; message?: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, message: 'Bitte geben Sie eine vollständige Adresse an (mit https://).' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, message: 'Nur http- und https-Adressen werden geladen.' };
  }
  if (PRIVATE_HOST.test(parsed.hostname)) {
    return { ok: false, message: 'Diese Adresse kann nicht geladen werden.' };
  }
  if (!parsed.hostname.includes('.')) {
    return { ok: false, message: 'Diese Adresse kann nicht geladen werden.' };
  }
  return { ok: true };
}

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const op = body?.op as Op;
    if (!op || !(op in TARGETS)) return fail('invalid_request', 'Unbekannte Operation.');

    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;

    if (['pending_admin', 'accepted', 'rejected'].includes(draft.review_state)) {
      return fail('conflict', 'Dieser Vorgang ist abgeschlossen.');
    }

    const limit = await checkLimits(supabase, LIMITS.ai(draft.id, ip));
    if (!limit.allowed) {
      return fail('rate_limited',
        'Die KI-Unterstützung ist für diesen Vorgang vorübergehend ausgeschöpft. Sie können weiterhin alles von Hand eintragen.');
    }

    // ---- Nutzlast bauen und deckeln ---------------------------------------
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    let forward: Record<string, unknown>;

    if (op === 'questions') {
      const jobDraft = payload.job_draft ?? {};
      if (JSON.stringify(jobDraft).length > MAX_JOB_DRAFT_BYTES) {
        return fail('invalid_request', 'Der Stellenentwurf ist zu groß.');
      }
      const answers = Array.isArray(payload.answers) ? payload.answers.slice(-MAX_ANSWERS) : [];
      const askedIds = Array.isArray(payload.asked_ids) ? payload.asked_ids.slice(-MAX_ANSWERS) : [];
      forward = {
        contract_type: draft.contract_type,
        job_draft: jobDraft,
        answers,
        asked_ids: askedIds,
        max_questions: 2,
      };
    } else if (op === 'parse_text') {
      const text = String(payload.jobText ?? '').slice(0, MAX_TEXT_CHARS);
      if (text.trim().length < 10) {
        return fail('invalid_request', 'Bitte beschreiben Sie die Rolle etwas ausführlicher.');
      }
      forward = { jobText: text };
    } else {
      const url = String(payload.jobUrl ?? '').trim().slice(0, 2000);
      const safe = urlIsSafe(url);
      if (!safe.ok) return fail('invalid_request', safe.message!);
      forward = { jobUrl: url };
    }

    // ---- Weiterreichen ----------------------------------------------------
    // Server-zu-Server mit Service-Role-Bearer; dasselbe Muster wie in
    // process-talent-hub-action/index.ts:427-438.
    const target = TARGETS[op];
    const started = Date.now();
    let upstream: Response;
    try {
      upstream = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/${target}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(forward),
        signal: AbortSignal.timeout(55_000),
      });
    } catch (e) {
      console.error('[intake-ai] Aufruf von', target, 'fehlgeschlagen:', e);
      return fail('upstream_error',
        'Die KI-Unterstützung ist gerade nicht erreichbar. Sie können alle Angaben auch von Hand eintragen.');
    }

    const elapsed = Date.now() - started;

    if (!upstream.ok) {
      const text = (await upstream.text()).slice(0, 300);
      console.error('[intake-ai]', target, upstream.status, text);
      await logEvent(supabase, {
        type: 'first_value', linkId: draft.link_id, draftId: draft.id, ipHash,
        meta: { ai_op: op, ok: false, status: upstream.status, ms: elapsed },
      });
      // 404 heisst hier: Function nicht deployed. Das ist ein Betriebszustand,
      // kein Kundenfehler — und laut Doku am 29.08. der reale Zustand.
      return fail(upstream.status === 404 ? 'not_deployed' : 'upstream_error',
        upstream.status === 404
          ? 'Die KI-Unterstützung ist noch nicht freigeschaltet. Bitte tragen Sie die Angaben von Hand ein.'
          : 'Die KI-Unterstützung antwortet gerade nicht. Sie können alles von Hand eintragen.');
    }

    const data = await upstream.json();

    // Kostenspur: ohne sie gibt es fuer Missbrauch an einem oeffentlichen Link
    // keine Datenbasis.
    await supabase.from('intake_link_events').insert({
      link_id: draft.link_id,
      draft_id: draft.id,
      event_type: 'first_value',
      ip_hash: ipHash,
      meta: { ai_op: op, ok: true, ms: elapsed, target },
    });

    await touchDraft(supabase, draft.id);
    return json(data);
  } catch (e) {
    console.error('[intake-ai]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});

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
  parse_pdf: 'parse-job-pdf',
  // Firmendaten aus der eigenen Website und dem Impressum. Der Gast ruft die
  // Function nicht selbst: sie laeuft mit Service-Role und haette ohne diesen
  // Vorhof weder Token-Pruefung noch Rate-Limit.
  enrich_company: 'enrich-company-from-domain',
} as const;
type Op = keyof typeof TARGETS;

/** Obergrenze fuer hochgeladene Anzeigen. */
const MAX_PDF_BYTES = 8 * 1024 * 1024;

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
    /** Gesetzt beim PDF-Weg — die Ablage wird nach dem Auslesen wieder geraeumt. */
    let pdfPath: string | null = null;

    if (op === 'questions') {
      const jobDraft = payload.job_draft ?? {};
      if (JSON.stringify(jobDraft).length > MAX_JOB_DRAFT_BYTES) {
        return fail('invalid_request', 'Der Stellenentwurf ist zu groß.');
      }
      // Seit dem 04.09.2026 erfindet intake-questions keine Fragen mehr: die
      // stehen im Katalog (src/lib/briefCatalog.ts). Durchgereicht wird jetzt
      // die gestellte Frage, die Antwort darauf und die noch offenen Zeilen --
      // daraus erntet das Modell Felder und stellt hoechstens eine Nachfrage.
      // Die alten Felder answers/asked_ids/max_questions entfallen.
      const kappen = (v: unknown, n: number) => (Array.isArray(v) ? v.slice(0, n) : []);
      forward = {
        contract_type: draft.contract_type,
        job_draft: jobDraft,
        question: payload.question ?? undefined,
        answer: String(payload.answer ?? '').slice(0, 4000),
        open_slots: kappen(payload.open_slots, 60),
        known: payload.known ?? {},
        asked_followups: kappen(payload.asked_followups, MAX_ANSWERS),
      };
    } else if (op === 'parse_text') {
      const text = String(payload.jobText ?? '').slice(0, MAX_TEXT_CHARS);
      if (text.trim().length < 10) {
        return fail('invalid_request', 'Bitte beschreiben Sie die Rolle etwas ausführlicher.');
      }
      forward = { jobText: text };
    } else if (op === 'enrich_company') {
      // Die Domain ist der Schluessel. Reihenfolge: was der Kunde als Website
      // angegeben hat, sonst die Domain seiner Geschaeftsadresse.
      const roh = String(payload.domain ?? draft.company_website ?? draft.company_domain ?? '').trim();
      const domain = roh
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split(/[/?#]/)[0]
        .toLowerCase()
        .slice(0, 253);
      // Eine Freemail-Domain ist kein Unternehmen -- gmail.com auszulesen
      // liefert Google, nicht den Kunden.
      if (!domain || !domain.includes('.') || draft.is_freemail) {
        return fail('invalid_request',
          'Für die automatische Ergänzung brauchen wir die Website Ihres Unternehmens.');
      }
      forward = { domain };
    } else if (op === 'parse_url') {
      const url = String(payload.jobUrl ?? '').trim().slice(0, 2000);
      const safe = urlIsSafe(url);
      if (!safe.ok) return fail('invalid_request', safe.message!);
      forward = { jobUrl: url };
    } else {
      // ---- PDF ------------------------------------------------------------
      // Der Gast laedt NICHT selbst in den Storage: der Bucket job-documents
      // erlaubt Uploads nur "TO authenticated" (20251212181114:8-12), und eine
      // anon-Policy dafuer waere ein offenes Ablageziel im Netz. Die Datei
      // kommt stattdessen durch diesen Endpunkt und wird hier mit Service-Role
      // unter einem Pfad abgelegt, den der Aufrufer nicht bestimmt.
      const b64 = String(payload.file_base64 ?? '');
      if (!b64) return fail('invalid_request', 'Keine Datei empfangen.');
      // base64 ist rund 4/3 der Rohgroesse.
      if (b64.length > MAX_PDF_BYTES * 1.4) {
        return fail('invalid_request', 'Die Datei ist zu groß. Bitte fügen Sie den Text der Anzeige ein.');
      }

      let bytes: Uint8Array;
      try {
        const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64;
        const bin = atob(clean);
        bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      } catch {
        return fail('invalid_request', 'Die Datei konnte nicht gelesen werden.');
      }
      if (bytes.length > MAX_PDF_BYTES) {
        return fail('invalid_request', 'Die Datei ist größer als 8 MB.');
      }
      // Signatur pruefen, statt der Dateiendung zu glauben.
      if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) {
        return fail('invalid_request', 'Das ist keine PDF-Datei.');
      }

      // Pfad aus dem Entwurf, nicht aus der Anfrage — sonst waere der Upload
      // ein frei adressierbarer Schreibzugriff auf den Bucket.
      const path = `uploads/intake/${draft.id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('job-documents')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (upErr) {
        console.error('[intake-ai] PDF-Upload:', upErr.message);
        return fail('internal_error', 'Die Datei konnte nicht abgelegt werden.');
      }
      pdfPath = path;
      forward = { pdfPath: path };
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
      if (pdfPath) {
        await supabase.storage.from('job-documents').remove([pdfPath]).catch(() => {});
      }
      return fail('upstream_error',
        'Die KI-Unterstützung ist gerade nicht erreichbar. Sie können alle Angaben auch von Hand eintragen.');
    }

    const elapsed = Date.now() - started;

    // Die hochgeladene Anzeige wird nicht aufbewahrt: ihr Inhalt steckt danach
    // im Entwurf, die Datei selbst hat keinen Zweck mehr.
    const cleanupPdf = async () => {
      if (!pdfPath) return;
      const { error } = await supabase.storage.from('job-documents').remove([pdfPath]);
      if (error) console.warn('[intake-ai] PDF nicht geraeumt:', pdfPath, error.message);
    };

    if (!upstream.ok) {
      await cleanupPdf();
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
    await cleanupPdf();

    // Kostenspur: ohne sie gibt es fuer Missbrauch an einem oeffentlichen Link
    // keine Datenbasis.
    await supabase.from('intake_link_events').insert({
      link_id: draft.link_id,
      draft_id: draft.id,
      event_type: 'first_value',
      ip_hash: ipHash,
      // Das Modell gehoert ins Protokoll: ohne es laesst sich spaeter nicht
      // sagen, welches Modell ein Ergebnis erzeugt hat.
      meta: { ai_op: op, ok: true, ms: elapsed, target,
              model: (data as Record<string, unknown>)?.model ?? null },
    });

    await touchDraft(supabase, draft.id);
    return json(data);
  } catch (e) {
    console.error('[intake-ai]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});

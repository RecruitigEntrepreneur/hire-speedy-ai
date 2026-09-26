import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { requireAdmin, isServiceRole } from '../_shared/admin-auth.ts';
import { renderVertragsdokument } from './render.ts';

/**
 * generate-mandate-pdf — die Vermittlungsvereinbarung als Dokument.
 *
 * Erzeugt aus dem unveraenderlichen Snapshot des Mandats das Dokument, das der
 * Admin ueber DocuSign zur Unterschrift versendet. Quelle ist ausschliesslich
 * commercial_mandates.snapshot -- also genau das, was der Kunde gesehen und
 * bestaetigt hat, nicht der heutige Stand irgendeiner Tabelle. Deshalb steht
 * die Pruefsumme des Snapshots mit im Dokument.
 *
 * pdf-lib ist im Repo bereits im Einsatz (generate-cv-pdf/index.ts:3).
 *
 * Die Signaturmarke /sig1/ ist als Ankertext eingebettet: DocuSign kann das
 * Unterschriftsfeld daran ausrichten (anchorString), und eine spaetere
 * API-Anbindung braucht das Dokument nicht zu aendern.
 */

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    // Zwei Aufrufer: ein angemeldeter Admin, und unser eigenes Backend --
    // docusign-send braucht das Dokument, hat aber keine Admin-Sitzung.
    if (!isServiceRole(req)) {
      const admin = await requireAdmin(req, supabase);
      if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
    }

    const body = await req.json().catch(() => ({}));
    const mandateId = String(body?.mandate_id ?? '');
    const frameworkId = String(body?.framework_id ?? '');
    if (!mandateId && !frameworkId) {
      return fail('invalid_request', 'mandate_id oder framework_id fehlt.');
    }

    // Zwei Dokumentarten, EIN Generator. Ein zweiter waere ein zweites Layout
    // fuer denselben Vertragslauf -- und damit zwei Wahrheiten darueber, wie
    // ein Matchunt-Vertrag aussieht.
    const istRahmen = Boolean(frameworkId);

    const { data: m, error } = istRahmen
      ? await supabase.from('client_framework_agreements').select('*').eq('id', frameworkId).maybeSingle()
      : await supabase.from('commercial_mandates').select('*').eq('id', mandateId).maybeSingle();
    if (error) return fail('internal_error', error.message);
    if (!m) return fail('not_found', 'Vereinbarung nicht gefunden.');
    if (!istRahmen && !m.client_confirmed_at) {
      return fail('conflict', 'Die Konditionen wurden vom Kunden noch nicht bestätigt.');
    }

    const { bytes, nummer, seiten } = await renderVertragsdokument(m, istRahmen);

    // ---- Ablegen -----------------------------------------------------------
    const path = `${m.id}/${nummer}.pdf`;
    const { error: upErr } = await supabase.storage
      .from('mandate-documents')
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      console.error('[generate-mandate-pdf] Upload:', upErr.message);
      return fail('internal_error', `Dokument konnte nicht abgelegt werden: ${upErr.message}`);
    }

    // Echter SHA-256 ueber das vollstaendige Dokument. Ein Hash ueber die
    // ersten Kilobytes wuerde die Spalte document_sha256 zur Falschaussage
    // machen -- gerade bei einem Vertragsdokument.
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const documentSha = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await supabase.from(istRahmen ? 'client_framework_agreements' : 'commercial_mandates')
      .update({ document_path: path, document_sha256: documentSha }).eq('id', m.id);

    const { data: signed } = await supabase.storage
      .from('mandate-documents').createSignedUrl(path, 60 * 30);

    return json({
      ok: true,
      path,
      // Nur auf ausdrueckliche Anforderung und nur fuer das eigene Backend:
      // docusign-send haengt die Bytes an den Umschlag, ein zweiter Download
      // ueber eine signierte URL waere ein unnoetiger Umweg mit eigener
      // Fehlerquelle.
      base64: body?.include_base64 && isServiceRole(req)
        ? encodeBase64(bytes)
        : undefined,
      sha256: documentSha,
      // 30 Minuten: lang genug zum Herunterladen und in DocuSign hochladen,
      // kurz genug, dass eine weitergegebene URL wertlos wird.
      url: signed?.signedUrl ?? null,
      number: nummer,
      pages: seiten,
    });
  } catch (e) {
    console.error('[generate-mandate-pdf]', e);
    return fail('internal_error', 'Das Dokument konnte nicht erzeugt werden.');
  }
});

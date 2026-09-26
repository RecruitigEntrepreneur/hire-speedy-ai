import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { isServiceRole } from '../_shared/admin-auth.ts';
import { docusignConfig, envelopeStatus } from '../_shared/docusign.ts';
import { applyEnvelopeState, saveSignedDocument } from '../_shared/docusign-apply.ts';
import { syncAllowed, syncClientEnvelopes } from '../_shared/docusign-sync.ts';

// Alle 15 Minuten per Cron (Migration 20260926151000): offene Kundenumschläge
// bei DocuSign nachfragen. Aufrufbar mit dem Cron-Schlüssel oder dem
// Service-Schlüssel. Logik in _shared/docusign-sync.ts.
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  try {
    const db = serviceClient();
    if (!await syncAllowed(req, db, isServiceRole)) return fail('not_allowed', 'Keine Berechtigung.');
    const cfg = docusignConfig();
    if (!cfg) return json({ ok: true, skipped: 'DocuSign ist nicht eingerichtet.' });
    const result = await syncClientEnvelopes(db, cfg, {
      status: envelopeStatus, apply: applyEnvelopeState, saveDocument: saveSignedDocument,
    });
    return json({ ok: true, ...result });
  } catch (e) {
    console.error('[docusign-sync]', e);
    return fail('internal_error', 'Abgleich fehlgeschlagen.');
  }
});

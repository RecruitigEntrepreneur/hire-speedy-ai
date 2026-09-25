import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { isServiceRole } from '../_shared/admin-auth.ts';
import { docusignConfig, envelopeStatus } from '../_shared/docusign.ts';
import { applyEnvelopeState, saveSignedDocument } from '../_shared/docusign-apply.ts';
import { syncClientEnvelopes } from '../_shared/docusign-sync.ts';

// Alle 15 Minuten per Cron (Migration 20260925160000): offene Kundenumschläge
// bei DocuSign nachfragen. Nur mit dem Service-Schlüssel aufrufbar, wie die
// anderen Cron-Läufe. Logik in _shared/docusign-sync.ts.
serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (!isServiceRole(req)) return fail('not_allowed', 'Keine Berechtigung.');
  try {
    const cfg = docusignConfig();
    if (!cfg) return json({ ok: true, skipped: 'DocuSign ist nicht eingerichtet.' });
    const result = await syncClientEnvelopes(serviceClient(), cfg, {
      status: envelopeStatus, apply: applyEnvelopeState, saveDocument: saveSignedDocument,
    });
    return json({ ok: true, ...result });
  } catch (e) {
    console.error('[docusign-sync]', e);
    return fail('internal_error', 'Abgleich fehlgeschlagen.');
  }
});

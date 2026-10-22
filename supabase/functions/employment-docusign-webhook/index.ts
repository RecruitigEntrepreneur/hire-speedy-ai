// DocuSign Connect für Arbeitsverträge (Paket 3, 22.10.2026). Ohne gültige Signatur
// wird nichts übernommen; sonst könnte jeder einen Vertrag als unterschrieben melden.
// Doppelte und verspätete Ereignisse sind normal: die Übernahme ist idempotent.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { fail, json } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { verifyWebhook } from '../_shared/docusign.ts';
import { defaultCtx } from '../_shared/interview-service.ts';
import { applyEnvelopeEvent, contractCtx, type SignerSnapshot } from '../_shared/contract-service.ts';

serve(async (req) => {
  if (req.method !== 'POST') return fail('invalid_request', 'POST erforderlich.');
  try {
    const raw = await req.text();
    // Bei Schlüsselwechsel schickt Connect mehrere Signaturen
    const signatures = [...req.headers].filter(([name]) => /^x-docusign-signature-\d+$/.test(name));
    const valid = await Promise.all(signatures.map(([, value]) => verifyWebhook(raw, value)));
    if (!valid.some(Boolean)) return fail('not_allowed', 'Signatur ungültig.');
    const payload = JSON.parse(raw);
    const data = payload?.data ?? {};
    const envelopeId = data.envelopeId ?? payload?.envelopeId;
    if (typeof envelopeId !== 'string') return json({ ignored: true });
    const summary = data.envelopeSummary ?? {};
    const snap: SignerSnapshot = { status: String(summary.status ?? ''), signers: summary?.recipients?.signers ?? [] };
    const result = await applyEnvelopeEvent(contractCtx(defaultCtx(serviceClient())), envelopeId, snap);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error('[employment-docusign-webhook]', e);
    // 500: DocuSign stellt erneut zu
    return fail('internal_error', 'Ereignis konnte noch nicht verarbeitet werden.');
  }
});

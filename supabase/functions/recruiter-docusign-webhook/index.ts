import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { verifyWebhook } from '../_shared/docusign.ts';
import { json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { dbError, signatureConfig, syncEnvelope, type RecruiterEnvelope } from '../_shared/recruiter-onboarding-service.ts';

serve(async req => {
  if (req.method !== 'POST') return fail('invalid_request', 'POST erforderlich.');
  try {
    const raw = await req.text();
    // Connect may supply more than one signature during key rotation.
    const signatures = [...req.headers].filter(([name]) => /^x-docusign-signature-\d+$/.test(name));
    const valid = await Promise.all(signatures.map(([,value]) => verifyWebhook(raw, value)));
    if (!valid.some(Boolean)) return fail('not_allowed', 'Signatur ungültig.');
    const payload = JSON.parse(raw);
    const envelopeId = payload?.data?.envelopeId;
    if (typeof envelopeId !== 'string') return json({ ignored: true });
    const db = serviceClient();
    const { data, error } = await db.from('recruiter_contract_envelopes').select('*').eq('envelope_id', envelopeId).maybeSingle();
    dbError(error);
    if (!data) return json({ ignored: true });
    await syncEnvelope(db, data as RecruiterEnvelope, signatureConfig());
    return json({ ok: true });
  } catch {
    // Retry on provider, database, evidence-storage and concurrency failures.
    // Never ACK an event whose signed documents have not been durably saved.
    return fail('internal_error', 'Ereignis konnte noch nicht verarbeitet werden.');
  }
});

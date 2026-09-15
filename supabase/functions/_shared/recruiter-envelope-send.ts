import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import type { DocuSignConfig } from './docusign.ts';
import { recruiterConnect } from './recruiter-connect.ts';
import { must, dbError, patchEnvelope, providerRequest, sha256, syncEnvelope, type RecruiterEnvelope } from './recruiter-onboarding-service.ts';
export async function sendRecruiterEnvelope(db: SupabaseClient, current: RecruiterEnvelope, cfg: DocuSignConfig, dependencies = { patchEnvelope, providerRequest, syncEnvelope }) {
  const { patchEnvelope: update, providerRequest: request, syncEnvelope: sync } = dependencies;
  let e=current;
  must(['prepared','creating','sent'].includes(e.state), 'Dieser Vertragsvorgang ist geschlossen.', 'conflict');
      if (e.state === 'prepared') {
        const eventNotification = recruiterConnect();
        // Only the request winning this CAS may create an envelope. A timed-out
        // creation is NEVER repeated blindly; recovery uses transaction_id.
        const documents = [];
        for (const [i, d] of e.documents.entries()) {
          const { data, error } = await db.storage.from('recruiter-contracts').download(d.path); dbError(error);
          const bytes = new Uint8Array(await data!.arrayBuffer());
          must(await sha256(bytes) === d.sha256, 'Vertragsdatei wurde nach der Freigabe verändert.', 'conflict');
          documents.push({ documentBase64: encodeBase64(bytes), name: d.name, fileExtension: 'pdf', documentId: String(i + 1) });
        }
        e = await update(db, e, { state: 'creating', create_started_at: new Date().toISOString() });
        const signer = (recipientId: string, name: string, email: string, anchor: string, clientUserId?: string) => ({
          recipientId, routingOrder: recipientId, name, email, ...(clientUserId ? { clientUserId, ...(recipientId === '1' ? { embeddedRecipientStartURL: 'SIGN_AT_DOCUSIGN' } : {}) } : {}),
          tabs: { signHereTabs: [{ anchorString: anchor, anchorUnits: 'pixels', anchorIgnoreIfNotPresent: 'false' }] },
        });
        const created = await (await request(cfg, '/envelopes', { method: 'POST', body: JSON.stringify({
          status: 'created', transactionId: e.transaction_id, emailSubject: 'Ihr Recruiter-Vertrag mit Matchunt',
          eventNotification,
          documents, recipients: { signers: [signer('1',e.snapshot.signer,e.snapshot.signerEmail,'/recruiter_sign/',e.recruiter_client_user_id ?? undefined), signer('2',e.counter_name,e.counter_email,'/matchunt_sign/',e.counter_user_id)] },
          customFields: { textCustomFields: [{ name: 'recruiter_contract_id', value: e.id, show: 'false' }] },
        }) })).json();
        must(typeof created.envelopeId === 'string', 'DocuSign hat keine Umschlagkennung geliefert.', 'upstream_error');
        e = await update(db, e, { envelope_id: created.envelopeId });
      } else if (!e.envelope_id) {
        must(e.create_started_at && Date.now() - Date.parse(e.create_started_at) < 6 * 86400000, 'Erstellung unklar. Bitte den Umschlag anhand der Transaktionskennung in DocuSign klären; kein neuer Versand.', 'conflict');
        const found = await (await request(cfg, `/envelopes/status?transaction_ids=${e.transaction_id}`, { method: 'PUT', body: '{}' })).json();
        must(found.envelopes?.length === 1 && found.envelopes[0].envelopeId, 'DocuSign-Erstellung noch unklar. Es wird kein zweiter Umschlag erzeugt. Bitte später erneut prüfen.', 'conflict');
        e = await update(db, e, { envelope_id: found.envelopes[0].envelopeId });
      }
      const provider = await (await request(cfg, `/envelopes/${e.envelope_id}`)).json();
      if (provider.status === 'created') await request(cfg, `/envelopes/${e.envelope_id}`, { method: 'PUT', body: JSON.stringify({ status: 'sent' }) });
      return await sync(db, e, cfg);

}

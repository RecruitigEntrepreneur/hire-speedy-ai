import { ensureRecruiterPackage } from '../_shared/recruiter-package.ts';
import { sendRecruiterEnvelope } from '../_shared/recruiter-envelope-send.ts';
import { contractDataIssues } from '../_shared/recruiter-contract-data.ts';
import { recipientView } from '../_shared/docusign.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { hashToken } from '../_shared/tokens.ts';
import { cleanProfile, normalizeEmail, canOpenRecruiterSignature } from '../_shared/recruiter-contract-policy.ts';
import { must, verifiedUser, dbError, patchCase, publicCase, workflowFailure, type OnboardingCase, envelopeById, signatureConfig, syncEnvelope } from '../_shared/recruiter-onboarding-service.ts';

serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const user = await verifiedUser(req);
    const body = await req.json();
    must(typeof body.token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(body.token), 'Ungültiger Einladungslink.');
    const db = serviceClient();
    const { data, error } = await db.from('recruiter_onboarding_cases').select('*').eq('token_hash', await hashToken(body.token)).maybeSingle();
    dbError(error);
    must(data && data.email === normalizeEmail(user.email!), 'Diese Einladung ist für ein anderes bestätigtes E-Mail-Konto bestimmt oder nicht mehr gültig.', 'not_allowed');
    let c = data as OnboardingCase;
    must(!c.revoked_at, 'Diese Einladung wurde widerrufen.', 'revoked');
    must(c.claimed_by === user.id || !c.claimed_by && Date.parse(c.expires_at) > Date.now(), 'Die Einladung ist abgelaufen oder bereits zugeordnet.', 'expired');
    if (!c.claimed_by) c = await patchCase(db, c, { claimed_by: user.id, claimed_at: new Date().toISOString(), state: 'draft' });
    must(c.claimed_by === user.id, 'Keine Berechtigung.', 'not_allowed');
    if (body.action === 'save' || body.action === 'submit') {
      must(c.revision === body.revision, 'Der Vorgang wurde inzwischen geändert. Bitte neu laden.', 'conflict');
      must(c.state === 'draft', 'Die Angaben sind bereits zur Prüfung eingereicht.', 'conflict');
      const profile = cleanProfile(body.profile);
      if (body.action === 'submit') { const issues=contractDataIssues(profile,c.kind); must(!issues.length,issues.join(' ')); }
      c = await patchCase(db, c, { profile, state: body.action === 'submit' ? 'review' : 'draft' });
    } else if (body.action === 'start') {
      // Explicit user action only. Loading a page never sends a contract.
      const cfg=signatureConfig();
      let contract=await ensureRecruiterPackage(db,c);
      if(['prepared','creating','sent'].includes(contract.state)) contract=await sendRecruiterEnvelope(db,contract,cfg);
      if(canOpenRecruiterSignature({userId:user.id,userEmail:user.email!,claimedBy:c.claimed_by,clientUserId:contract.recruiter_client_user_id,signerEmail:contract.snapshot.signerEmail,state:contract.state,signedAt:contract.recruiter_signed_at})) {
        const url=await recipientView(cfg,{envelopeId:contract.envelope_id!,name:contract.snapshot.signer,email:contract.snapshot.signerEmail,clientUserId:user.id,returnUrl:`${getPublicAppUrl()}/recruiter/invitation`});
        return json({url});
      }
      return json({remote:contract.recruiter_client_user_id !== user.id,contract_id:contract.id});
    } else if (body.action === 'sync' || body.action === 'document' || body.action === 'signature') {
      const contract = await envelopeById(db, body.contract_id);
      must(contract.case_id === c.id, 'Keine Berechtigung.', 'not_allowed');
      if (body.action === 'signature') {
        must(['review','approved'].includes(c.state) && contract.envelope_id && canOpenRecruiterSignature({ userId: user.id, userEmail: user.email!, claimedBy: c.claimed_by, clientUserId: contract.recruiter_client_user_id, signerEmail: contract.snapshot.signerEmail, state: contract.state, signedAt: contract.recruiter_signed_at }), 'Der Signaturzugang gehört ausschließlich der benannten unterzeichnenden Person und muss noch offen sein.', 'not_allowed');
        const url = await recipientView(signatureConfig(), { envelopeId: contract.envelope_id, name: contract.snapshot.signer, email: contract.snapshot.signerEmail, clientUserId: user.id, returnUrl: `${getPublicAppUrl()}/recruiter/invitation` });
        return json({ url });
      } else if (body.action === 'sync') {
        if (!contract.last_synced_at || Date.now() - Date.parse(contract.last_synced_at) >= 15 * 60000) await syncEnvelope(db, contract, signatureConfig());
      } else {
        const path = body.document === 'signed' ? contract.signed_document_path : body.document === 'certificate' ? contract.certificate_path
          : contract.documents.find(d => d.role === body.document)?.path;
        must(path, 'Dokument noch nicht verfügbar.', 'not_found');
        const { data: url, error: urlError } = await db.storage.from('recruiter-contracts').createSignedUrl(path, 120);
        dbError(urlError); return json({ url: url!.signedUrl });
      }
    } else must(body.action === 'load', 'Unbekannte Aktion.');
    return json(await publicCase(db, c));
  } catch (e) { return workflowFailure(e); }
});

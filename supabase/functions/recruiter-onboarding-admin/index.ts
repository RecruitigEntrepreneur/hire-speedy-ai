import { recruiterCountersigner } from '../_shared/recruiter-countersigner.ts';
import { sendRecruiterEnvelope } from '../_shared/recruiter-envelope-send.ts';
import { TEMPLATE_HASH } from '../_shared/recruiter-contract-templates.ts';
import { recruiterCounterDeadline } from '../_shared/recruiter-deadline.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { decodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { preflight, json } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';
import { generateToken, hashToken } from '../_shared/tokens.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { recipientView, type DocuSignConfig } from '../_shared/docusign.ts';
import { caseMails, invitationMails } from '../_shared/email-event-log.ts';
import { refreshDueContracts } from '../_shared/recruiter-contract-refresh.ts';
import { grantRecruiterAccess, sendWelcomeMail } from '../_shared/recruiter-activation.ts';
import { cleanProfile, normalizeEmail, validEmail, profileIssues, packageIssues, requiredReviewChecks, type ContractDocument } from '../_shared/recruiter-contract-policy.ts';
import { must, dbError, caseById, patchCase, envelopeById, patchEnvelope, signatureConfig, providerRequest, sha256, syncEnvelope, workflowFailure, type RecruiterEnvelope, type OnboardingCase } from '../_shared/recruiter-onboarding-service.ts';

/**
 * Einladungsmail mit persönlichem Link. Gemeinsam für „mail“ (Link nach dem Anlegen)
 * und „reissue“ (neuer Link, etwa zum Erinnern). Schreibt email_events mit case_id,
 * damit die Admin-Karte Zustellung, Öffnungen und Klicks zeigt.
 */
async function sendInvitation(db: ReturnType<typeof serviceClient>, c: OnboardingCase, token: string, note: string, replyTo: string | undefined) {
  const url = `${getPublicAppUrl()}/recruiter/invitation#${token}`;
  const result = await sendIntakeMail(db, {
    to: c.email, subject: 'Ihre Einladung zum Matchunt Recruiter-Netzwerk',
    template: 'recruiter_onboarding_invitation', replyTo,
    idempotencyKey: `recruiter-invitation/${c.id}`,
    html: layout({ preheader: 'Ihr persönlicher Einstieg bei Matchunt', heading: 'Willkommen bei Matchunt',
          body: `<p>Guten Tag ${esc(c.profile.name)},</p><p>wir freuen uns, die Zusammenarbeit mit Ihnen vorzubereiten.</p>${note ? `<p>${esc(note).replace(/\n/g, '<br>')}</p>` : ''}<p>Über Ihren persönlichen Link können Sie Ihre bereits hinterlegten Angaben prüfen, ergänzen und den Vertragsprozess starten. Bitte verwenden Sie dafür die E-Mail-Adresse, an die diese Einladung gesendet wurde.</p><p>Nach Bestätigung Ihrer Angaben wird Ihr persönliches Vertragspaket erstellt. Sie können es direkt mit DocuSign prüfen und unterschreiben. Anschließend prüft Matchunt Ihre Unterlagen und zeichnet ausdrücklich gegen. Danach informieren wir Sie über die Freischaltung.</p><p>Bei Fragen antworten Sie gern direkt auf diese Nachricht.</p><p>Mit freundlichen Grüßen<br>Ihr Matchunt-Team</p>`,
          cta: { label: 'Persönliches Onboarding starten', url },
          footnote: `Dieser persönliche Link ist bis ${esc(new Date(c.expires_at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' }))} gültig. Bitte nicht weiterleiten. <a href="${esc(getPublicAppUrl())}/impressum">Impressum</a> · <a href="${esc(getPublicAppUrl())}/datenschutz">Datenschutz</a>`,
        }), meta: { case_id: c.id },
  });
  must(result.sent, 'Die Einladung wurde angelegt, die E-Mail konnte aber nicht versendet werden.', 'upstream_error');
  return url;
}

serve(async req => {
  const pre = preflight(req); if (pre) return pre;
  try {
    must(req.method === 'POST', 'Bitte POST verwenden.');
    const db = serviceClient();
    const admin = await requireAdmin(req, db);
    must(admin.ok, admin.message ?? 'Keine Berechtigung.', 'not_allowed');
    const body = await req.json();
    if (body.action === 'list') {
      const { data: cases, error } = await db.from('recruiter_onboarding_cases')
        .select('id,revision,entry_source,kind,email,profile,state,feedback,internal_note,expires_at,revoked_at,claimed_at,claimed_by,checks,reviewed_at,created_at')
        .order('created_at', { ascending: false }).limit(100);
      dbError(error);
      const ids = (cases ?? []).map(c => c.id);
      const { data: contracts, error: ce } = await db.from('recruiter_contract_envelopes').select('*').in('case_id', ids);
      dbError(ce);
      // Freischaltung lebt in user_roles; hier nur als Kennzeichen je Vorgang.
      const owners = [...new Set((cases ?? []).map(c => c.claimed_by).filter((id): id is string => typeof id === 'string'))];
      const activated = new Set<string>();
      if (owners.length) {
        const { data: roles, error: re } = await db.from('user_roles').select('user_id,verified').eq('role', 'recruiter').in('user_id', owners);
        dbError(re);
        for (const r of roles ?? []) if (r.verified === true) activated.add(r.user_id);
      }
      // Einladungsmail je Vorgang für die Liste. Fehlt email_events, bleibt die Liste trotzdem nutzbar.
      const mails = await invitationMails(db, ids).catch(e => { console.error('[recruiter-admin] Mailstatus nicht geladen', e?.message ?? e); return null; });
      let ready = false; let setupMessage = ''; let cfg: DocuSignConfig | null = null;
      try { cfg = signatureConfig(); await recruiterCountersigner(db); ready = true; }
      catch (e) { setupMessage = e instanceof Error ? e.message : 'DocuSign-Einrichtung prüfen.'; }
      // Offene Unterschriften selbst bei DocuSign abfragen; dabei geht auch die Mail zum Gegenzeichnen raus.
      const fresh = cfg ? await refreshDueContracts(db, (contracts ?? []) as RecruiterEnvelope[], cfg) : contracts;
      return json({ cases: (cases ?? []).map(({ claimed_by, ...row }) => ({ ...row, activated: typeof claimed_by === 'string' && activated.has(claimed_by), ...(mails ? { mail: mails[row.id] ?? null } : {}) })), contracts: fresh, docusign_enabled: ready, docusign_setup_message: setupMessage });
    }
    if (body.action === 'create') {
      const email = normalizeEmail(String(body.email ?? ''));
      must(validEmail(email), 'Gültige Kontakt-E-Mail erforderlich.');
      must(['individual','agency'].includes(body.kind), 'Bitte Einzelrecruiter oder neue Agentur wählen.');
      const profile = cleanProfile(body.profile);
      must(profile.name, 'Name des Kontakts fehlt.');
      const days = Number(body.days ?? 7);
      must(Number.isInteger(days) && days >= 1 && days <= 30, 'Linklaufzeit muss zwischen 1 und 30 Tagen liegen.');
      const token = generateToken();
      const { data, error } = await db.from('recruiter_onboarding_cases').insert({
        kind: body.kind, email, profile, contract_template_hash: TEMPLATE_HASH, token_hash: await hashToken(token),
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        internal_note: String(body.internal_note ?? '').trim().slice(0, 2000), created_by: admin.userId,
      }).select('id').single();
      dbError(error);
      return json({ id: data!.id, token, url: `${getPublicAppUrl()}/recruiter/invitation#${token}` });
    }
    const c = await caseById(db, body.case_id);
    // Mails dieses Vorgangs mit Zustellung, Öffnungen und Klicks für die Admin-Karte.
    if (body.action === 'mails') return json({ mails: await caseMails(db, c.id, { fetch: (input, init) => fetch(input, init), apiKey: Deno.env.get('RESEND_API_KEY') }) });
    if (body.action === 'mail') {
      must(!c.revoked_at && !c.claimed_by && Date.parse(c.expires_at) > Date.now(), 'Einladung ist nicht mehr versendbar.', 'conflict');
      must(typeof body.token === 'string' && await hashToken(body.token) === c.token_hash, 'Bitte den ursprünglichen Einladungslink verwenden.');
      await sendInvitation(db, c, body.token, String(body.message ?? '').trim().slice(0, 1200), admin.email);
      await patchCase(db, c, { last_mail_at: new Date().toISOString() });
      return json({ accepted_by_mail_provider: true });
    }
    if (body.action === 'history') {
      // Verlauf für die Akte: jeder Zustandswechsel von Vorgang und Vertrag (Trigger recruiter_onboarding_log).
      const { data, error } = await db.from('recruiter_onboarding_audit').select('event,revision,occurred_at')
        .eq('case_id', c.id).order('occurred_at', { ascending: true }).limit(500);
      dbError(error);
      return json({ history: data ?? [] });
    }
    if (body.action === 'reissue') {
      // Neuer Link für eine noch nicht begonnene Einladung, etwa zum Erinnern oder wenn keine Mail
      // rausging. Der Link eines Vorgangs ist unveränderlich (Wächter: „Invitation identity is
      // immutable“). Deshalb entsteht eine neue Einladung mit denselben Angaben; erst wenn deren Mail
      // raus ist, wird die alte widerrufen. Scheitert die Mail, wird die neue wieder widerrufen.
      must(!c.claimed_by && (c as OnboardingCase & { entry_source?: string }).entry_source !== 'website', 'Nur eine noch nicht begonnene Einladung lässt sich neu versenden.', 'conflict');
      const days = Number(body.days ?? 7);
      must(Number.isInteger(days) && days >= 1 && days <= 30, 'Linklaufzeit muss zwischen 1 und 30 Tagen liegen.');
      const token = generateToken();
      const { data: fresh, error } = await db.from('recruiter_onboarding_cases').insert({
        kind: c.kind, email: c.email, profile: c.profile, contract_template_hash: TEMPLATE_HASH, token_hash: await hashToken(token),
        expires_at: new Date(Date.now() + days * 86400000).toISOString(),
        internal_note: String((c as OnboardingCase & { internal_note?: string }).internal_note ?? '').slice(0, 2000), created_by: admin.userId,
      }).select('*').single();
      dbError(error);
      const next = fresh as OnboardingCase;
      let url: string;
      try {
        url = await sendInvitation(db, next, token, String(body.message ?? '').trim().slice(0, 1200), admin.email);
      } catch (e) {
        await patchCase(db, next, { revoked_at: new Date().toISOString() }).catch(() => undefined);
        throw e;
      }
      const sent = await patchCase(db, next, { last_mail_at: new Date().toISOString() });
      if (!c.revoked_at) await patchCase(db, c, { revoked_at: new Date().toISOString() });
      return json({ id: sent.id, url, expires_at: sent.expires_at });
    }
    if (body.action === 'activate') {
      // Freischaltung von Hand: Normalfall ist seit 21.09.2026 die automatische nach der
      // Gegenzeichnung (autoActivateRecruiter). Hier nur, falls die scheiterte, oder um
      // die Zugangsmail erneut zu senden. Erst nach Prüfung, Freigabe und beidseitiger Unterschrift.
      must(c.state === 'approved' && !c.revoked_at && c.claimed_by, 'Der Vorgang ist noch nicht geprüft und freigegeben.', 'conflict');
      const { data: done, error: de } = await db.from('recruiter_contract_envelopes').select('id').eq('case_id', c.id).eq('state', 'completed').limit(1).maybeSingle();
      dbError(de); must(done, 'Der Vertrag ist noch nicht von beiden Seiten unterzeichnet.', 'conflict');
      must(await grantRecruiterAccess(db, c), 'Für dieses Konto gibt es keine Recruiter-Rolle.', 'conflict');
      const result = await sendWelcomeMail(db, c, { replyTo: admin.email });
      must(result.sent, 'Freigeschaltet, aber die Zugangsmail konnte nicht versendet werden. Bitte erneut auslösen.', 'upstream_error');
      return json({ ok: true });
    }
    if (['revoke','changes','approve'].includes(body.action)) {
      must(c.revision === body.revision, 'Bitte den aktuellen Vorgang neu laden.', 'conflict');
      if (body.action === 'revoke') {
        must(!c.claimed_by, 'Ein bereits gestarteter Vorgang kann hier nicht als Einladung widerrufen werden.', 'conflict');
        await patchCase(db, c, { revoked_at: new Date().toISOString() });
      } else if (body.action === 'changes') {
        must(c.claimed_by && ['review','approved'].includes(c.state), 'Keine Rückfrage möglich.', 'conflict');
        const feedback = String(body.feedback ?? '').trim().slice(0, 2000);
        must(feedback.length >= 10, 'Bitte eine konkrete Rückfrage angeben.');
        await patchCase(db, c, { state: 'draft', feedback, checks: {}, reviewed_at: null, reviewed_by: null });
      } else {
        must(c.state === 'review' && !c.revoked_at, 'Vorgang ist nicht zur Prüfung eingereicht.', 'conflict');
        const issues = profileIssues(c.profile); must(!issues.length, issues.join(' '));
        const checks = Object.fromEntries(requiredReviewChecks(c.kind).map(k => [k, body.checks?.[k] === true]));
        must(Object.values(checks).every(Boolean), 'Bitte alle erforderlichen Prüfungen einschließlich Datenschutz und Nutzerbefugnissen abschließen.');
        await patchCase(db, c, { state: 'approved', feedback: '', checks, reviewed_at: new Date().toISOString(), reviewed_by: admin.userId });
      }
      return json({ ok: true });
    }
    if (body.action === 'package') {
      must(c.state === 'approved' && !c.revoked_at && c.revision === body.revision, 'Bitte erst den aktuellen Vorgang prüfen und freigeben.', 'conflict');
      must(body.release_confirmed === true, 'Die Vollständigkeit und Freigabe der PDF-Fassungen muss bestätigt werden.');
      const source = String(body.source_reference ?? '').trim();
      const version = String(body.package_version ?? '').trim();
      must(source.length >= 10 && source.length <= 1000 && version.length >= 3 && version.length <= 100, 'Fassung und nachvollziehbarer Freigabevermerk fehlen.');
      const { id: counterId, name: counterName, email: counterEmail } = await recruiterCountersigner(db);
      must(counterEmail !== c.profile.signerEmail, 'Recruiter und Matchunt benötigen getrennte Unterzeichner.');
      must(Array.isArray(body.documents) && body.documents.length === 7, 'Rahmenvertrag und vollständige Anlagen als PDF erforderlich.');
      const id = crypto.randomUUID();
      const documents: ContractDocument[] = [];
      const uploads: { path: string; bytes: Uint8Array }[] = [];
      let total = 0;
      for (const raw of body.documents) {
        must(typeof raw.base64 === 'string' && raw.base64.length <= 7_000_000, 'PDF ist zu groß (maximal 5 MB).');
        const bytes = decodeBase64(raw.base64); total += bytes.length;
        must(total <= 15_000_000 && new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-', 'Bitte gültige PDFs mit zusammen maximal 15 MB hochladen.');
        const path = `${c.id}/${id}/${String(raw.role)}.pdf`;
        const name = String(raw.name ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 160);
        documents.push({ role: raw.role, name, path, sha256: await sha256(bytes) }); uploads.push({ path, bytes });
      }
      const issues = packageIssues(documents, `${c.id}/${id}`); must(!issues.length, issues.join(' '));
      for (const upload of uploads) {
        const { error } = await db.storage.from('recruiter-contracts').upload(upload.path, upload.bytes, { contentType: 'application/pdf', upsert: false }); dbError(error);
      }
      const { error } = await db.from('recruiter_contract_envelopes').insert({
        id, case_id: c.id, package_version: version, source_reference: source, snapshot: c.profile, documents,
        recruiter_client_user_id: c.email === normalizeEmail(c.profile.signerEmail) ? c.claimed_by : null,
        approved_by: admin.userId, counter_user_id: counterId, counter_email: counterEmail, counter_name: counterName,
      }); dbError(error); return json({ id });
    }
    let e = await envelopeById(db, body.contract_id);
    must(e.case_id === c.id, 'Vertrag gehört nicht zu diesem Vorgang.');
    if (body.action === 'document') {
      const path = body.document === 'signed' ? e.signed_document_path : body.document === 'certificate' ? e.certificate_path : e.documents.find(d => d.role === body.document)?.path;
      must(path, 'Dokument noch nicht verfügbar.', 'not_found');
      const { data, error } = await db.storage.from('recruiter-contracts').createSignedUrl(path, 120); dbError(error); return json({ url: data!.signedUrl });
    }
    if (body.action === 'void' && e.state === 'prepared' && !e.envelope_id) {
      const reason = String(body.reason ?? '').trim();
      must(reason.length >= 10, 'Bitte den Grund für die Rücknahme angeben.');
      await patchEnvelope(db, e, { state: 'voided', closure_reason: reason.slice(0,1000) });
      return json({ ok: true });
    }
    const cfg = signatureConfig();
    if (body.action === 'void') {
      const reason = String(body.reason ?? '').trim();
      must(reason.length >= 10, 'Bitte den Grund für die Rücknahme angeben.');
      must(e.envelope_id && ['creating','sent'].includes(e.state), 'Unklaren oder abgeschlossenen Umschlag zuerst in DocuSign klären.', 'conflict');
      await providerRequest(cfg, `/envelopes/${e.envelope_id}`, { method: 'PUT', body: JSON.stringify({ status: 'voided', voidedReason: reason.slice(0,1000) }) });
      e = await syncEnvelope(db, e, cfg);
      must(e.state === 'voided', 'DocuSign hat die Rücknahme noch nicht bestätigt.', 'conflict');
      await patchEnvelope(db, e, { closure_reason: reason.slice(0,1000) });
      return json({ ok: true });
    }
    if (body.action === 'send') {
      must(c.state === 'approved' && !c.revoked_at, 'Vorgang nicht freigegeben.', 'conflict');
      must(['prepared','creating','sent'].includes(e.state), 'Dieser Vertragsvorgang ist geschlossen.', 'conflict');
      return json({ contract: await sendRecruiterEnvelope(db, e, cfg) });
    }
    if (body.action === 'sync') {
      if (e.last_synced_at && Date.now() - Date.parse(e.last_synced_at) < 15 * 60000) return json({ contract: e });
      return json({ contract: await syncEnvelope(db, e, cfg) });
    }
    if (body.action === 'counter') {
      must(e.counter_user_id === admin.userId && c.state === 'approved' && !c.revoked_at, 'Nur der festgelegte Matchunt-Unterzeichner darf gegenzeichnen.', 'not_allowed');
      must(e.state === 'sent' && e.recruiter_signed_at && !e.countersigned_at, 'Die Recruiter-Unterschrift ist noch nicht bestätigt.', 'conflict');
      must(Date.now() < Date.parse(recruiterCounterDeadline(e.recruiter_signed_at)), 'Die Gegenzeichnungsfrist ist abgelaufen. Der Vorgang muss neu vereinbart werden.', 'expired');
      const url = await recipientView(cfg, { envelopeId: e.envelope_id!, name: e.counter_name, email: e.counter_email, clientUserId: e.counter_user_id, returnUrl: `${getPublicAppUrl()}/admin/recruiters?contract_return=${e.id}` });
      return json({ url });
    }
    must(false, 'Unbekannte Aktion.');
  } catch (e) { return workflowFailure(e); }
});

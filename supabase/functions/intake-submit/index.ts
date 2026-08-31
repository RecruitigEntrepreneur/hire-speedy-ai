import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp, userAgent } from '../_shared/http.ts';
import { hashKey, contentHash } from '../_shared/tokens.ts';
import { isPlausibleEmail } from '../_shared/domain.ts';
import {
  serviceClient, resolveDraft, logEvent, publicDraft,
  resolveTemplate, effectiveTerms, clientFacingTerms,
} from '../_shared/intake-core.ts';
import { sendIntakeMail, layout, esc } from '../_shared/intake-mail.ts';
import { getPublicAppUrl, intakeResumeUrl } from '../_shared/app-url.ts';

/**
 * intake-submit — die Beauftragungsanfrage. Ohne Login.
 *
 * Ein einziger, atomarer Schritt: Konditionen bestaetigen, AGB zustimmen,
 * Anfrage einreichen. Das Ergebnis ist ein Angebot des Kunden mit Nachweis
 * (Zeitstempel, Adresse, gehashte IP, User-Agent, Pruefsumme des gezeigten
 * Textes) — nicht der Vertragsschluss. Matchunt nimmt gesondert an, und der
 * Vertrag wird danach zur Unterschrift versendet.
 *
 * Die Vorbedingungen werden hier serverseitig geprueft, nicht nur im Frontend:
 * im Gast-Fall steht der Browser vollstaendig unter der Kontrolle des
 * Aufrufers. Dieselbe Bedingung steht zusaetzlich als CHECK auf intake_drafts.
 */

/** Version des Zustimmungstextes. Aendert sich der Wortlaut, aendert sich die
 *  Version — sonst ist der Nachweis wertlos. Spiegel in
 *  src/components/intake/guest/consentText.ts. */
const CONSENT_VERSION = '2026-09-v1';

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = serviceClient();
    const ip = clientIp(req);
    const ipHash = ip ? await hashKey(ip) : null;
    const ua = userAgent(req);

    const found = await resolveDraft(supabase, body?.draft_token);
    if (!found.ok) return fail(found.reason!, found.message!);
    const draft = found.draft!;

    if (draft.review_state === 'pending_admin') {
      return json({ ok: true, already: true, review_state: 'pending_admin' });
    }
    if (['accepted', 'rejected'].includes(draft.review_state)) {
      return fail('conflict', 'Dieser Vorgang ist bereits abgeschlossen.');
    }

    // ---- Vorbedingungen, im Klartext ---------------------------------------
    const missing: string[] = [];
    const built = (draft.built ?? {}) as Record<string, any>;
    if (!String(built.title ?? draft.title ?? '').trim()) missing.push('Bezeichnung der Position');
    if (!String(draft.contact_name ?? '').trim()) missing.push('Ansprechpartner');
    if (!isPlausibleEmail(draft.contact_email)) missing.push('Geschäftliche E-Mail-Adresse');
    if (draft.identity_state !== 'email_verified') missing.push('Bestätigung Ihrer E-Mail-Adresse');
    if (!String(draft.company_name ?? '').trim()) missing.push('Name des Unternehmens');
    if (missing.length > 0) {
      return fail('conflict', 'Es fehlen noch Angaben.', { missing });
    }

    // Zustimmungen sind Pflicht und werden serverseitig erzwungen — dasselbe
    // Doppel wie in process-interview-response/index.ts:129-131.
    if (body?.accept_terms !== true || body?.accept_agb !== true) {
      return fail('invalid_request',
        'Bitte bestätigen Sie die Konditionen und die Allgemeinen Geschäftsbedingungen.');
    }
    const signerName = String(body?.signer_name ?? draft.contact_name ?? '').trim().slice(0, 120);
    if (signerName.length < 3) {
      return fail('invalid_request', 'Bitte geben Sie Ihren Namen an.');
    }

    // ---- Geltende Konditionen ----------------------------------------------
    let link: Record<string, any> | null = null;
    if (draft.link_id) {
      const { data } = await supabase.from('intake_links').select('*').eq('id', draft.link_id).maybeSingle();
      link = data ?? null;
    }
    const template = await resolveTemplate(supabase, link?.terms_template_id);
    if (!template) return fail('not_deployed', 'Die Konditionen sind nicht hinterlegt.');

    const t = effectiveTerms(template, link);
    const shown = clientFacingTerms(template, link);

    // ---- Der unveraenderliche Snapshot -------------------------------------
    // Vollstaendiges Abbild dessen, was der Kunde gesehen und bestaetigt hat.
    // Genau das fehlt heute: terms_version wird hart als '1.0' uebergeben,
    // der Text steht als JSX in drei verschiedenen Dateien, es gibt keinen Hash.
    const now = new Date().toISOString();
    const snapshot = {
      captured_at: now,
      consent_version: CONSENT_VERSION,
      terms: {
        template_id: template.id,
        template_key: template.key,
        template_version: template.version,
        label: template.label,
        body_md: template.body_md,
        body_sha256: template.body_sha256,
        fee_percentage: t.fee_percentage,
        fee_basis: t.fee_basis,
        payment_terms_days: t.payment_terms_days,
        guarantee_days: t.guarantee_days,
        refund_rule: t.refund_rule,
        vat_note: t.vat_note,
        requires_signature: t.requires_signature,
      },
      agb: {
        version: template.agb_version,
        url: `${getPublicAppUrl()}/agb`,
        sha256: template.agb_sha256 ?? null,
      },
      client: {
        contact_name: draft.contact_name,
        contact_email: draft.contact_email,
        contact_phone: draft.contact_phone,
        contact_role: draft.contact_role,
        signer_name: signerName,
        company_name: draft.company_name,
        company_legal_name: draft.company_legal_name,
        company_street: draft.company_street,
        company_postal_code: draft.company_postal_code,
        company_city: draft.company_city,
        company_country: draft.company_country,
        company_vat_id: draft.company_vat_id,
        company_registration_number: draft.company_registration_number,
        company_domain: draft.company_domain,
        billing_email: draft.billing_email ?? draft.contact_email,
      },
      position: {
        title: built.title ?? draft.title,
        location: built.location ?? null,
        employment_type: draft.contract_type,
        seniority: built.experience_level ?? null,
      },
    };
    const snapshotSha = await contentHash(JSON.stringify(snapshot));

    // ---- Das Angebot des Kunden --------------------------------------------
    // Ein bereits offenes Angebot wird ueberschrieben, ein bereits bestaetigtes
    // nie (Trigger commercial_mandates_guard).
    // Auch 'client_confirmed' mitnehmen: nach einer Rueckfrage reicht derselbe
    // Kunde denselben Vorgang erneut ein. Ein Insert wuerde am partiellen
    // Unique-Index commercial_mandates_one_live_idx scheitern.
    const { data: open } = await supabase
      .from('commercial_mandates')
      .select('id, status')
      .eq('draft_id', draft.id)
      .in('status', ['proposed', 'client_confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const mandateFields = {
      draft_id: draft.id,
      template_id: template.id,
      template_version: template.version,
      fee_percentage: t.fee_percentage,
      recruiter_fee_percentage: t.recruiter_fee_percentage,
      fee_basis: t.fee_basis,
      contracting_margin_percentage: t.contracting_margin_percentage,
      payment_terms_days: t.payment_terms_days,
      guarantee_days: t.guarantee_days,
      refund_rule: t.refund_rule,
      snapshot,
      snapshot_sha256: snapshotSha,
      agb_version: template.agb_version,
      agb_sha256: template.agb_sha256 ?? null,
      status: 'client_confirmed',
      client_confirmed_at: now,
      client_confirmed_name: signerName,
      client_confirmed_email: draft.contact_email,
      client_confirmed_ip_hash: ipHash,
      client_confirmed_user_agent: ua,
      agb_accepted_at: now,
      signature_status: t.requires_signature ? 'pending' : 'not_required',
    };

    const mandateQuery = open
      ? supabase.from('commercial_mandates').update(mandateFields).eq('id', open.id).select('*').single()
      : supabase.from('commercial_mandates').insert(mandateFields).select('*').single();

    const { data: mandate, error: mandateErr } = await mandateQuery;
    if (mandateErr || !mandate) {
      console.error('[intake-submit] Mandat nicht angelegt:', mandateErr?.message);
      return fail('internal_error', 'Die Beauftragungsanfrage konnte nicht gespeichert werden.');
    }

    // ---- Entwurf einreichen -------------------------------------------------
    const { data: saved, error: draftErr } = await supabase
      .from('intake_drafts')
      .update({
        capture_state: 'complete',
        commercial_state: 'confirmed',
        review_state: 'pending_admin',
        submitted_at: now,
        last_activity_at: now,
      })
      .eq('id', draft.id)
      .select('*')
      .single();

    if (draftErr || !saved) {
      console.error('[intake-submit] Einreichen fehlgeschlagen:', draftErr?.message);
      return fail('internal_error', 'Die Anfrage konnte nicht eingereicht werden.');
    }

    // ---- Nachweise ----------------------------------------------------------
    const consentRows = [
      { consent_type: 'commercial_terms', version: `${template.key}-v${template.version}` },
      { consent_type: 'agb', version: template.agb_version },
    ].map((c) => ({
      subject_type: 'intake_draft',
      subject_id: draft.id,
      consent_type: c.consent_type,
      version: c.version,
      granted: true,
      ip_address: ipHash,
      user_agent: ua,
      granted_at: now,
      scope: mandate.mandate_number,
    }));
    const { error: consentErr } = await supabase.from('consents').insert(consentRows);
    if (consentErr) console.warn('[intake-submit] consents:', consentErr.message);

    await logEvent(supabase, {
      type: 'terms_confirmed', linkId: draft.link_id, draftId: draft.id, ipHash, userAgent: ua,
      meta: { mandate: mandate.mandate_number, fee: t.fee_percentage, version: template.version },
    });
    await logEvent(supabase, {
      type: 'intake_completed', linkId: draft.link_id, draftId: draft.id, ipHash,
      meta: { completeness: saved.completeness },
    });
    await logEvent(supabase, {
      type: 'submitted', linkId: draft.link_id, draftId: draft.id, ipHash, userAgent: ua,
      meta: { mandate: mandate.mandate_number },
    });

    // ---- Eingangsbestaetigung: ausdruecklich noch kein Vertrag --------------
    const resumeUrl = intakeResumeUrl(String(body?.draft_token));
    const html = layout({
      preheader: `Ihre Anfrage für ${esc(snapshot.position.title ?? 'die Position')} ist bei uns eingegangen.`,
      heading: 'Ihre Beauftragungsanfrage ist eingegangen',
      body: `
        <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name)},</p>
        <p style="margin:0 0 16px 0;">
          vielen Dank. Wir haben Ihre Anfrage für <strong>${esc(snapshot.position.title ?? 'die Position')}</strong>
          erhalten und prüfen sie.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:18px 0;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:45%;">Vorgangsnummer</td><td style="padding:6px 0;font-weight:600;">${esc(mandate.mandate_number)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Erfolgshonorar</td><td style="padding:6px 0;font-weight:600;">${esc(t.fee_percentage)} % ${t.fee_basis === 'annual_target_salary' ? 'des Zieljahresgehalts' : 'des Jahresbruttogehalts'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Fällig</td><td style="padding:6px 0;">nur im Erfolgsfall, ${esc(t.payment_terms_days)} Tage netto</td></tr>
          ${t.guarantee_days ? `<tr><td style="padding:6px 0;color:#6b7280;">Nachbesetzung</td><td style="padding:6px 0;">${esc(t.guarantee_days)} Tage</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6b7280;">AGB-Fassung</td><td style="padding:6px 0;">${esc(template.agb_version)}</td></tr>
        </table>
        <p style="margin:0 0 8px 0;font-weight:600;">Wie es weitergeht</p>
        <p style="margin:0 0 16px 0;">
          Wir prüfen das Mandat${t.requires_signature ? ' und senden Ihnen anschließend die Vermittlungsvereinbarung zur digitalen Unterschrift zu. Sobald sie unterzeichnet ist, starten wir die Suche.' : ' und melden uns mit der Freigabe.'}
        </p>`,
      cta: { label: 'Anfrage ansehen', url: resumeUrl },
      footnote:
        'Diese Bestätigung dokumentiert den Eingang Ihrer Anfrage. Ein Vertrag kommt erst mit unserer ausdrücklichen Annahme zustande. Bis dahin entstehen Ihnen keine Kosten.',
    });

    const mail = await sendIntakeMail(supabase, {
      to: draft.contact_email,
      subject: `Ihre Beauftragungsanfrage ${mandate.mandate_number} ist eingegangen`,
      html,
      template: 'intake_submitted',
      meta: { draft_id: draft.id, mandate_id: mandate.id },
    });

    // ---- Und der Betreuer erfaehrt es ---------------------------------------
    const recipients = new Set<string>();
    if (draft.owner_user_id) recipients.add(draft.owner_user_id);
    const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin').limit(10);
    (admins ?? []).forEach((a) => recipients.add(a.user_id));
    if (recipients.size > 0) {
      await supabase.from('notifications').insert(
        [...recipients].map((user_id) => ({
          user_id,
          type: 'intake_submitted',
          title: 'Neue Beauftragungsanfrage',
          message: `${draft.company_name} · ${snapshot.position.title ?? 'Position'} — ${mandate.mandate_number}`,
          related_type: 'intake_draft',
          related_id: draft.id,
        })),
      );
    }

    return json({
      ok: true,
      review_state: 'pending_admin',
      mandate_number: mandate.mandate_number,
      confirmation_sent: mail.sent,
      requires_signature: t.requires_signature,
      draft: publicDraft(saved),
    });
  } catch (e) {
    console.error('[intake-submit]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});

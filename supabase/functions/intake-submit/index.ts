import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail, clientIp, userAgent } from '../_shared/http.ts';
import { hashKey, contentHash } from '../_shared/tokens.ts';
import { isPlausibleEmail } from '../_shared/domain.ts';
import {
  serviceClient, resolveDraft, logEvent, publicDraft,
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
    // ---- Besteht schon ein Rahmenvertrag? ----------------------------------
    // Wenn ja, sind die Konditionen dort EINMAL gewaehlt und stehen fest. Die
    // Position wird dann unter diesem Vertrag beauftragt: ein protokollierter
    // Vorgang, keine zweite Unterschrift. Der Vertragstext selbst regelt, dass
    // die Auftragserteilung ueber dieses System erfolgt.
    const { data: rvRaw } = await supabase
      .rpc('active_framework_for_draft', { _draft_id: draft.id });
    const framework = rvRaw && (rvRaw as Record<string, any>).id
      ? (rvRaw as Record<string, any>)
      : null;
    // Ein Rahmenvertrag ohne Konditionen taugt nicht als Grundlage -- das kann
    // nur ein Altvertrag aus dem Modell "ein Vertrag je Position" sein. Dann
    // laeuft dieser Vorgang wie bisher.
    const unterRahmenvertrag = !!(framework?.package_key && framework?.pricing_snapshot);

    const packageKey     = unterRahmenvertrag ? framework!.package_key     : draft.selected_package_key;
    const packageVersion = unterRahmenvertrag ? framework!.package_version : draft.selected_package_version;

    // Ohne Paketwahl gibt es keine Anfrage. Die Constraint
    // intake_drafts_submit_requires_verified wuerde es ohnehin ablehnen --
    // hier steht es, damit der Kunde einen Satz statt eines Datenbankfehlers
    // bekommt. Unter einem Rahmenvertrag entfaellt die Wahl.
    if (!packageKey) {
      return fail('invalid_request',
        'Bitte wählen Sie zuerst eines der drei Pakete aus.');
    }
    // Gelaufen, nicht zugestimmt. Ein 'failed' entsteht schon bei einer
    // USt-IdNr., die nicht zum Laendermuster passt -- also bei einem Tippfehler.
    // Den Kunden daran endgueltig scheitern zu lassen, hiesse die automatische
    // Pruefung entscheiden zu lassen. Sie liefert einen Bericht; entschieden
    // wird im Admin-Bereich.
    if (['not_checked', 'checking'].includes(draft.company_state)) {
      return fail('conflict',
        'Die Prüfung Ihrer Firmenangaben läuft noch. Bitte versuchen Sie es in einem Moment erneut.');
    }

    const { data: pkg } = await supabase
      .from('commercial_packages')
      .select('*')
      .eq('package_key', packageKey)
      .eq('version', packageVersion)
      .maybeSingle();
    if (!pkg) return fail('not_deployed', 'Das gewählte Paket ist nicht hinterlegt.');

    // Der Vertragstext des Einzelauftrags, zentral gepflegt.
    const { data: contractTpl } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('doc_type', 'assignment')
      .eq('language', 'de')
      .eq('is_active', true)
      .maybeSingle();
    if (!contractTpl) return fail('not_deployed', 'Der Vertragstext ist nicht hinterlegt.');

    // Der Preis-Snapshot. Ab hier wird aus IHM gerechnet, nie mehr aus
    // commercial_packages -- sonst wuerde eine spaetere Preisaenderung diesen
    // Auftrag rueckwirkend veraendern.
    const pricingSnapshot = {
      packageKey: pkg.package_key,
      packageVersion: pkg.version,
      publicName: pkg.public_name,
      clientFeePct: Number(pkg.client_fee_pct),
      continuityDays: pkg.continuity_days,
      recruiterInitialPct: Number(pkg.recruiter_initial_pct),
      recruiterRetentionPct: Number(pkg.recruiter_retention_pct),
      matchuntPct: Number(pkg.matchunt_pct),
      researchBountyPct: Number(pkg.research_bounty_pct),
      matchuntOnClaimPct: Number(pkg.matchunt_on_claim_pct),
      researchMaxActiveDays: pkg.research_max_active_days,
      claimNoticeDays: pkg.claim_notice_days,
      eligibleClaimCategories: pkg.eligible_claim_categories ?? [],
      excludedClaimCategories: pkg.excluded_claim_categories ?? [],
      capturedAt: new Date().toISOString(),
    };
    // Unter einem Rahmenvertrag gilt DESSEN Abbild, nicht ein neu gebautes.
    // Sonst wanderte eine zwischenzeitliche Preisaenderung still in die
    // naechste Position -- obwohl die Kondition fest vereinbart ist.
    const geltenderSnapshot = unterRahmenvertrag
      ? framework!.pricing_snapshot
      : pricingSnapshot;
    const pricingSha = unterRahmenvertrag && framework!.pricing_snapshot_sha256
      ? framework!.pricing_snapshot_sha256
      : await contentHash(JSON.stringify(pricingSnapshot));

    // Die Schaetzgrundlage aus der Aufnahme. Unverbindlich -- abgerechnet wird
    // spaeter nach dem unterzeichneten Arbeitsvertrag.
    const basisCents: number | null = draft.estimate_basis_cents ?? null;
    const feeCents = basisCents
      ? Math.round((basisCents * Number(pkg.client_fee_pct)) / 100) : null;
    const initCents = basisCents
      ? Math.round((basisCents * Number(pkg.recruiter_initial_pct)) / 100) : null;
    const retCents = basisCents
      ? Math.round((basisCents * Number(pkg.recruiter_retention_pct)) / 100) : null;

    // ---- Der unveraenderliche Snapshot -------------------------------------
    // Vollstaendiges Abbild dessen, was der Kunde gesehen und bestaetigt hat.
    // Genau das fehlt heute: terms_version wird hart als '1.0' uebergeben,
    // der Text steht als JSX in drei verschiedenen Dateien, es gibt keinen Hash.
    const now = new Date().toISOString();
    const snapshot = {
      captured_at: now,
      consent_version: CONSENT_VERSION,
      // Was der Kunde gesehen und gewaehlt hat -- ohne die Innenaufteilung.
      // Der Snapshot geht spaeter in das Vertragsdokument; dort haette der
      // Recruiter-Anteil nichts zu suchen.
      package: {
        key: pkg.package_key,
        version: pkg.version,
        name: pkg.public_name,
        summary: pkg.summary,
        fee_percentage: Number(pkg.client_fee_pct),
        fee_basis: 'gross_annual_target_compensation',
        continuity_days: pkg.continuity_days,
        claim_notice_days: pkg.claim_notice_days,
        payment_terms_days: pkg.payment_terms_days,
        eligible_claim_categories: pkg.eligible_claim_categories ?? [],
        excluded_claim_categories: pkg.excluded_claim_categories ?? [],
      },
      // Bewusst KEINE Schaetzung im Snapshot: der Snapshot ist das Abbild
      // dessen, was der Kunde gesehen hat, und er hat keinen Betrag gesehen.
      // Eine Zahl hier landete ueber generate-mandate-pdf im Vertragsdokument.
      contract: {
        template_id: contractTpl.id,
        template_version: contractTpl.version,
        title: contractTpl.title,
        // Der Volltext gehoert in den Snapshot, nicht nur seine Pruefsumme:
        // generate-mandate-pdf erzeugt das Dokument aus dem Snapshot allein.
        // Mit blossem Hash liesse sich spaeter zwar pruefen, ob der Text sich
        // geaendert hat, aber nicht mehr rekonstruieren, welcher es war.
        body_md: contractTpl.body_md,
        body_sha256: contractTpl.body_sha256,
        vendor: {
          legal_name: contractTpl.vendor_legal_name,
          brand: contractTpl.vendor_brand,
          street: contractTpl.vendor_street,
          postal_code: contractTpl.vendor_postal_code,
          city: contractTpl.vendor_city,
          register: contractTpl.vendor_register,
          court: contractTpl.vendor_court,
        },
      },
      agb: {
        version: contractTpl.agb_version,
        url: `${getPublicAppUrl()}/agb`,
        sha256: contractTpl.agb_sha256 ?? null,
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
      contract_template_id: contractTpl.id,
      // fee_percentage und recruiter_fee_percentage werden vom Trigger
      // commercial_mandates_check_pricing aus dem Paket gesetzt. Was hier
      // stuende, wuerde ueberschrieben -- deshalb steht hier nichts.
      fee_basis: 'annual_target_salary',
      payment_terms_days: pkg.payment_terms_days,
      package_key: pkg.package_key,
      package_version: pkg.version,
      pricing_snapshot: geltenderSnapshot,
      pricing_snapshot_sha256: pricingSha,
      package_selected_at: draft.package_selected_at ?? now,
      gross_annual_target_compensation_cents: basisCents,
      compensation_basis: basisCents ? 'intake_estimate' : null,
      client_fee_cents: feeCents,
      recruiter_initial_cents: initCents,
      recruiter_retention_cents: retCents,
      matchunt_cents: feeCents != null
        ? feeCents - (initCents ?? 0) - (retCents ?? 0) : null,
      snapshot,
      snapshot_sha256: snapshotSha,
      agb_version: contractTpl.agb_version,
      agb_sha256: contractTpl.agb_sha256 ?? null,
      status: 'client_confirmed',
      client_confirmed_at: now,
      client_confirmed_name: signerName,
      client_confirmed_email: draft.contact_email,
      client_confirmed_ip_hash: ipHash,
      client_confirmed_user_agent: ua,
      agb_accepted_at: now,
      ...(unterRahmenvertrag
        ? {
            // Beauftragung unter bestehendem Rahmenvertrag. Der Nachweis ist
            // der protokollierte Vorgang: wer, wann, unter welcher Fassung.
            framework_agreement_id: framework!.id,
            ordered_at: now,
            ordered_by_name: signerName,
            ordered_by_email: draft.contact_email,
            ordered_ip_hash: ipHash,
            ordered_user_agent: ua,
            order_terms_version: framework!.template_version,
            // Angenommen ist der Auftrag mit der Bestellung -- die Pruefung des
            // Kunden hat beim Rahmenvertrag stattgefunden. Veroeffentlicht wird
            // trotzdem erst auf Klick von Matchunt.
            status: 'accepted',
            accepted_at: now,
            signature_status: 'not_required',
          }
        : {
            // Erster Vorgang dieses Kunden: hier entsteht der Rahmenvertrag,
            // und der wird unterschrieben. Er geht erst nach der Admin-Freigabe
            // raus, deshalb 'pending' und nicht 'sent'.
            signature_status: 'pending',
          }),
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
      { consent_type: 'commercial_terms', version: `${pkg.package_key}-v${pkg.version}` },
      { consent_type: 'agb', version: contractTpl.agb_version },
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
      meta: { mandate: mandate.mandate_number, package: pkg.package_key,
              fee: Number(pkg.client_fee_pct), version: pkg.version },
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
      preheader: unterRahmenvertrag
        ? `Ihr Auftrag für ${esc(snapshot.position.title ?? 'die Position')} ist eingegangen.`
        : `Ihre Anfrage für ${esc(snapshot.position.title ?? 'die Position')} ist bei uns eingegangen.`,
      heading: unterRahmenvertrag
        ? 'Ihr Auftrag ist eingegangen'
        : 'Ihre Beauftragungsanfrage ist eingegangen',
      body: `
        <p style="margin:0 0 16px 0;">Guten Tag ${esc(draft.contact_name)},</p>
        <p style="margin:0 0 16px 0;">
          vielen Dank. Wir haben ${unterRahmenvertrag ? 'Ihren Auftrag' : 'Ihre Anfrage'} für
          <strong>${esc(snapshot.position.title ?? 'die Position')}</strong>
          erhalten${unterRahmenvertrag ? '' : ' und prüfen ihn'}.
        </p>
        ${unterRahmenvertrag ? `
        <p style="margin:0 0 16px 0;">
          Der Auftrag läuft unter Ihrem bestehenden Rahmenvertrag
          <strong>${esc(framework!.agreement_number)}</strong>. Eine erneute Unterschrift
          ist nicht nötig — die vereinbarten Konditionen gelten unverändert.
        </p>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:18px 0;border-collapse:collapse;">
          <tr><td style="padding:6px 0;color:#6b7280;width:45%;">Vorgangsnummer</td><td style="padding:6px 0;font-weight:600;">${esc(mandate.mandate_number)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Paket</td><td style="padding:6px 0;font-weight:600;">${esc(pkg.public_name)}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Erfolgshonorar</td><td style="padding:6px 0;font-weight:600;">${esc(Number(pkg.client_fee_pct))} % des Bruttojahreszielgehalts</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Fällig</td><td style="padding:6px 0;">nur im Erfolgsfall, ${esc(pkg.payment_terms_days)} Tage netto</td></tr>
          ${pkg.continuity_days ? `<tr><td style="padding:6px 0;color:#6b7280;">Erneuter Suchlauf</td><td style="padding:6px 0;">bei Ausscheiden in den ersten ${esc(pkg.continuity_days)} Tagen</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#6b7280;">AGB-Fassung</td><td style="padding:6px 0;">${esc(contractTpl.agb_version)}</td></tr>
        </table>
        <p style="margin:0 0 8px 0;font-weight:600;">Wie es weitergeht</p>
        <p style="margin:0 0 16px 0;">${unterRahmenvertrag
          ? 'Wir sichten die Position und starten die Suche. Sie hören von uns, sobald sie läuft.'
          : 'Wir prüfen Ihre Anfrage und senden Ihnen anschließend den Vertrag zur digitalen '
            + 'Unterschrift zu. Erst wenn beide Seiten unterzeichnet haben, starten wir die Suche.'}
        </p>`,
      cta: { label: 'Anfrage ansehen', url: resumeUrl },
      footnote: unterRahmenvertrag
        ? 'Diese Bestätigung dokumentiert Ihre Auftragserteilung unter dem bestehenden '
          + 'Rahmenvertrag. Kosten entstehen ausschließlich im Erfolgsfall.'
        : 'Diese Bestätigung dokumentiert den Eingang Ihrer Anfrage. Ein Vertrag kommt erst mit '
          + 'unserer ausdrücklichen Annahme zustande. Bis dahin entstehen Ihnen keine Kosten.',
    });

    const mail = await sendIntakeMail(supabase, {
      to: draft.contact_email,
      subject: unterRahmenvertrag
        ? `Ihr Auftrag ${mandate.mandate_number} ist eingegangen`
        : `Ihre Beauftragungsanfrage ${mandate.mandate_number} ist eingegangen`,
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
          title: unterRahmenvertrag ? 'Neuer Auftrag (Rahmenvertrag)' : 'Neue Beauftragungsanfrage',
          message: `${draft.company_name} · ${snapshot.position.title ?? 'Position'} — ${mandate.mandate_number}`,
          related_type: 'intake_draft',
          related_id: draft.id,
        })),
      );
    }

    // ---- Vertrag zur Unterschrift -------------------------------------------
    // Hier wird NICHT versendet. Der Kunde wird zuerst gefragt, wer
    // unterschreibt -- er selbst oder ein Entscheider.
    //
    // Der Grund ist kein technischer: im Mittelstand nimmt HR oder der Hiring
    // Manager die Stelle auf, unterschreiben tut die Geschaeftsfuehrung. Wer
    // sofort einen Umschlag an den Absender schickt, produziert bei genau den
    // groesseren Mandaten einen Vertrag, den niemand zeichnen darf -- und muss
    // ihn dann verwerfen und neu ausstellen.
    //
    // Die Frage steht auf der naechsten Seite; von dort ruft das Frontend
    // docusign-send mit der Antwort auf. Zwischen Absenden und Umschlag liegen
    // damit ein Klick und wenige Sekunden.

    return json({
      ok: true,
      review_state: 'pending_admin',
      mandate_number: mandate.mandate_number,
      confirmation_sent: mail.sent,
      // Unter bestehendem Rahmenvertrag wird nichts mehr unterschrieben.
      requires_signature: !unterRahmenvertrag,
      framework_agreement_number: unterRahmenvertrag ? framework!.agreement_number : null,
      draft: publicDraft(saved),
    });
  } catch (e) {
    console.error('[intake-submit]', e);
    return fail('internal_error', 'Unerwarteter Fehler.');
  }
});

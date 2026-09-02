import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { contentHash } from '../_shared/tokens.ts';
import { serviceClient, resolveDraft, logEvent } from '../_shared/intake-core.ts';
import { requireAdmin, isServiceRole } from '../_shared/admin-auth.ts';
import { docusignConfig, createEnvelope, recipientView, docusignAppOrigin, type Signer } from '../_shared/docusign.ts';
import { getPublicAppUrl } from '../_shared/app-url.ts';

/**
 * docusign-send — den Vertrag zur Unterschrift geben.
 *
 * Ausgeloest direkt nach der Beauftragungsanfrage (Entscheidung 02.09.2026).
 *
 * WER unterschreibt, entscheidet der Kunde -- und das ist der Punkt, an dem
 * die meisten Vorgaenge sonst liegenbleiben: im Mittelstand nimmt HR oder der
 * Hiring Manager die Stelle auf, unterschreiben tut die Geschaeftsfuehrung.
 * Wer den Absender zwingt, selbst zu zeichnen, verliert genau die groesseren
 * Mandate. Deshalb zwei Wege, EIN Umschlag:
 *   self  -> eingebettet auf unserer Seite (clientUserId gesetzt), sofort fertig
 *   other -> DocuSign stellt per Mail zu (kein clientUserId)
 * Der Unterschied ist ein Feld, kein zweiter Code-Pfad.
 * Das bindet Matchunt nicht: der Kunde unterschreibt zuerst, Matchunt zeichnet
 * zuletzt gegen, und ERST die Gegenzeichnung ist die Annahme. Der Versand ist
 * ein Angebot zur Unterschrift, kein Vertragsschluss.
 *
 * EIN Umschlag, beide Dokumente: Rahmenvertrag und Einzelauftrag. Der Kunde
 * unterschreibt in einem Durchgang. Zwei Umschlaege waeren zwei Mails, zwei
 * Termine und zwei Gelegenheiten, es liegen zu lassen.
 *
 * Der Rahmenvertrag wird hier angelegt, falls es noch keinen gibt -- sonst
 * scheiterte die Freigabe an commercial_mandates_signature_needs_framework,
 * und der Kunde saehe einen Fehler fuer etwas, das er nicht verursacht hat.
 * Existiert bereits ein wirksamer, geht nur der Einzelauftrag raus.
 *
 * Die Reihenfolge wird bei DocuSign ueber routingOrder erzwungen: Matchunt
 * bekommt den Umschlag erst zu sehen, wenn der Kunde unterzeichnet hat.
 */

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const body = await req.json().catch(() => ({}));

    // Drei Aufrufer: das eigene Backend (nach der Anfrage), ein Admin, und der
    // Gast ueber sein Entwurfs-Token -- er darf den Lauf fuer die eigene
    // Aufnahme anstossen, aber fuer keine fremde.
    let draftId = String(body?.draft_id ?? '');
    if (!isServiceRole(req)) {
      if (body?.draft_token) {
        const found = await resolveDraft(supabase, body.draft_token);
        if (!found.ok) return fail(found.reason!, found.message!);
        draftId = found.draft!.id;
      } else {
        const admin = await requireAdmin(req, supabase);
        if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
      }
    }
    if (!draftId) return fail('invalid_request', 'draft_id fehlt.');

    const cfg = docusignConfig();
    if (!cfg) {
      return fail('not_deployed',
        'DocuSign ist noch nicht eingerichtet. Es fehlen die Zugangsdaten (DOCUSIGN_INTEGRATION_KEY, '
        + 'DOCUSIGN_USER_ID, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY).');
    }

    const { data: draft } = await supabase
      .from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
    if (!draft) return fail('not_found', 'Die Aufnahme wurde nicht gefunden.');

    // Harte Widersprueche in den Firmenangaben: kein automatischer Versand.
    // Ein Vertrag an eine Firma, deren Angaben sich widersprechen, ist genau
    // der Fall, in dem ein Mensch hinsehen soll.
    if (draft.company_state === 'failed') {
      return fail('conflict',
        'Die Firmenangaben weisen harte Widersprüche auf. Der Vertrag geht erst nach Prüfung raus.');
    }

    const { data: mandate } = await supabase
      .from('commercial_mandates').select('*')
      .eq('draft_id', draftId)
      .in('status', ['client_confirmed', 'accepted'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!mandate) return fail('conflict', 'Es liegt keine bestätigte Beauftragungsanfrage vor.');

    // Schon unterwegs? Dann nicht noch einmal -- ein zweiter Umschlag zum
    // selben Auftrag waere fuer den Kunden nicht unterscheidbar.
    if (mandate.envelope_id) {
      return json({ ok: true, already: true, envelope_id: mandate.envelope_id,
                    mandate_id: mandate.id });
    }

    // ---- Rahmenvertrag beschaffen -------------------------------------------
    const orgId = draft.organization_id ?? draft.matched_organization_id ?? null;
    let framework: Record<string, any> | null = null;

    const bestehend = orgId
      ? await supabase.from('client_framework_agreements').select('*')
          .eq('organization_id', orgId)
          .in('status', ['draft', 'pending_release', 'sent', 'customer_signed', 'active'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : await supabase.from('client_framework_agreements').select('*')
          .eq('origin_draft_id', draftId)
          .in('status', ['draft', 'pending_release', 'sent', 'customer_signed', 'active'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
    framework = bestehend.data ?? null;

    if (!framework) {
      const { data: tpl } = await supabase.from('contract_templates').select('*')
        .eq('doc_type', 'framework').eq('language', 'de').eq('is_active', true).maybeSingle();
      if (!tpl) return fail('not_deployed', 'Es ist kein aktiver Rahmenvertragstext hinterlegt.');

      const snapshot = {
        captured_at: new Date().toISOString(),
        contract: { template_id: tpl.id, template_version: tpl.version,
                    title: tpl.title, body_md: tpl.body_md, body_sha256: tpl.body_sha256 },
        vendor: { legal_name: tpl.vendor_legal_name, brand: tpl.vendor_brand,
                  street: tpl.vendor_street, postal_code: tpl.vendor_postal_code,
                  city: tpl.vendor_city, country: tpl.vendor_country,
                  register: tpl.vendor_register, court: tpl.vendor_court, vat_id: tpl.vendor_vat_id },
        client: {
          company_name: draft.company_name, company_legal_name: draft.company_legal_name,
          company_street: draft.company_street, company_postal_code: draft.company_postal_code,
          company_city: draft.company_city, company_country: draft.company_country,
          company_vat_id: draft.company_vat_id,
          company_registration_number: draft.company_registration_number,
          contact_name: draft.contact_name, contact_email: draft.contact_email,
          contact_role: draft.contact_role, signer_name: draft.contact_name,
        },
        agb: { version: tpl.agb_version, sha256: tpl.agb_sha256 },
      };

      const { data: neu, error: rvErr } = await supabase
        .from('client_framework_agreements').insert({
          organization_id: orgId,
          origin_draft_id: draftId,
          client_user_id: draft.client_user_id ?? draft.matched_client_user_id ?? null,
          template_id: tpl.id, template_version: tpl.version,
          snapshot, snapshot_sha256: await contentHash(JSON.stringify(snapshot)),
          agb_version: tpl.agb_version, agb_sha256: tpl.agb_sha256,
          customer_signer_name: draft.contact_name,
          customer_signer_email: draft.contact_email,
          customer_signer_role: draft.contact_role,
          status: 'draft',
        }).select('*').single();
      if (rvErr) return fail('internal_error', `Rahmenvertrag: ${rvErr.message}`);
      framework = neu;
    }

    const rahmenNochOffen = framework!.status !== 'active';

    // ---- Dokumente erzeugen -------------------------------------------------
    const pdf = async (payload: Record<string, unknown>) => {
      const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-mandate-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        },
        body: JSON.stringify({ ...payload, include_base64: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d?.base64) {
        throw new Error(`Dokument konnte nicht erzeugt werden: ${d?.message ?? res.status}`);
      }
      return d as { base64: string; number: string; sha256: string };
    };

    const dokumente: { base64: string; name: string }[] = [];
    if (rahmenNochOffen) {
      const d = await pdf({ framework_id: framework!.id });
      dokumente.push({ base64: d.base64, name: `Rahmenvertrag ${d.number}.pdf` });
    }
    const dEinzel = await pdf({ mandate_id: mandate.id });
    dokumente.push({ base64: dEinzel.base64, name: `Einzelauftrag ${dEinzel.number}.pdf` });

    // ---- Umschlag -----------------------------------------------------------
    // ---- Wer unterschreibt --------------------------------------------------
    const eigenhaendig = body?.signer_self !== false;   // Vorgabe: der Absender
    const kundenName = eigenhaendig
      ? (mandate.client_confirmed_name || draft.contact_name || 'Auftraggeber')
      : String(body?.signer_name ?? '').trim().slice(0, 120);
    const kundenMail = eigenhaendig
      ? (mandate.client_confirmed_email || draft.contact_email)
      : String(body?.signer_email ?? '').trim().toLowerCase().slice(0, 200);

    if (!kundenMail) {
      return fail('invalid_request', eigenhaendig
        ? 'Ohne E-Mail-Adresse kann nichts zur Unterschrift gehen.'
        : 'Bitte geben Sie die E-Mail-Adresse der unterzeichnenden Person an.');
    }
    if (!eigenhaendig) {
      if (!kundenName) {
        return fail('invalid_request', 'Bitte geben Sie den Namen der unterzeichnenden Person an.');
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kundenMail)) {
        return fail('invalid_request', 'Die E-Mail-Adresse der unterzeichnenden Person ist unvollständig.');
      }
    }

    const gegenName = Deno.env.get('DOCUSIGN_COUNTERSIGNER_NAME') ?? 'Matchunt';
    const gegenMail = Deno.env.get('DOCUSIGN_COUNTERSIGNER_EMAIL');
    if (!gegenMail) {
      return fail('not_deployed',
        'DOCUSIGN_COUNTERSIGNER_EMAIL fehlt — ohne Gegenzeichner kann der Vertrag nicht wirksam werden.');
    }

    const signers: Signer[] = [
      // clientUserId NUR beim eigenhaendigen Weg: es unterdrueckt die
      // DocuSign-Mail und macht die Ansicht einbettbar. Beim Weg ueber einen
      // Entscheider ist die Mail genau das, was wir wollen.
      { name: kundenName, email: kundenMail,
        ...(eigenhaendig ? { clientUserId: `client-${draftId}` } : {}),
        anchor: '/sig1/', routingOrder: 1, recipientId: '1' },
      // Kein clientUserId: Matchunt zeichnet aus dem Admin-Bereich gegen und
      // bekommt zusaetzlich die DocuSign-Mail. Faellt unsere Oberflaeche aus,
      // bleibt der Vertrag trotzdem abschliessbar.
      { name: gegenName, email: gegenMail,
        anchor: '/sig2/', routingOrder: 2, recipientId: '2' },
    ];

    const umschlag = await createEnvelope(cfg, {
      subject: rahmenNochOffen
        ? `Rahmenvertrag und Einzelauftrag ${mandate.mandate_number}`
        : `Einzelauftrag ${mandate.mandate_number}`,
      blurb: 'Bitte prüfen und unterzeichnen Sie die beigefügten Unterlagen.',
      documents: dokumente,
      signers,
      customFields: {
        mandate_id: mandate.id,
        framework_id: framework!.id,
        draft_id: draftId,
      },
    });

    const jetzt = new Date().toISOString();

    // ---- Zustand fuehren ----------------------------------------------------
    if (rahmenNochOffen) {
      await supabase.from('client_framework_agreements')
        .update({ status: 'pending_release', released_for_signature_at: jetzt })
        .eq('id', framework!.id);
      await supabase.from('client_framework_agreements')
        .update({ status: 'sent', envelope_id: umschlag.envelopeId, envelope_sent_at: jetzt,
                  customer_signer_name: kundenName, customer_signer_email: kundenMail })
        .eq('id', framework!.id);
    }

    await supabase.from('commercial_mandates').update({
      framework_agreement_id: framework!.id,
      // Wer unterschreiben SOLL. Der Webhook traegt spaeter ein, wer es
      // tatsaechlich getan hat -- die beiden auseinanderzuhalten ist der
      // Unterschied zwischen Absicht und Nachweis.
      customer_signer_name: kundenName,
      customer_signer_email: kundenMail,
      released_for_signature_at: jetzt,
      envelope_id: umschlag.envelopeId,
      signature_envelope_id: umschlag.envelopeId,
      signature_status: 'sent',
      signature_sent_at: jetzt,
    }).eq('id', mandate.id);

    await logEvent(supabase, {
      type: 'contract_sent', linkId: draft.link_id, draftId,
      meta: { envelope: umschlag.envelopeId, mandate: mandate.mandate_number,
              signer_self: eigenhaendig,
              framework: rahmenNochOffen ? framework!.agreement_number : 'bestehend',
              documents: dokumente.length },
    });

    // ---- Eingebettete Unterschrift ------------------------------------------
    let signUrl: string | null = null;
    if (eigenhaendig) try {
      const appUrl = getPublicAppUrl();
      signUrl = await recipientView(cfg, {
        envelopeId: umschlag.envelopeId,
        name: kundenName,
        email: kundenMail,
        clientUserId: `client-${draftId}`,
        // Landet im iframe, nicht im Hauptfenster. Die Seite dort meldet dem
        // umgebenden Fenster, dass unterschrieben wurde.
        returnUrl: `${appUrl}/aufnahme/unterschrift-fertig`,
        // Ohne diese beiden verbietet DocuSign das Einbetten, und der Kunde
        // saehe einen leeren Rahmen.
        frameAncestors: [appUrl, docusignAppOrigin(cfg)],
        messageOrigins: [docusignAppOrigin(cfg)],
      });
    } catch (e) {
      // Der Umschlag ist raus -- das ist der Teil, der zaehlt. Ohne
      // eingebettete Ansicht unterschreibt der Kunde ueber die DocuSign-Mail.
      console.warn('[docusign-send] recipientView:', e instanceof Error ? e.message : e);
    }

    return json({
      ok: true,
      envelope_id: umschlag.envelopeId,
      mandate_id: mandate.id,
      framework_id: framework!.id,
      documents: dokumente.length,
      // Gesetzt = der Kunde unterschreibt gleich hier. Null beim Weg ueber
      // einen Entscheider -- dann sagt die Oberflaeche, an wen es ging.
      sign_url: signUrl,
      signer: { self: eigenhaendig, name: kundenName, email: kundenMail },
    });
  } catch (e) {
    console.error('[docusign-send]', e);
    return fail('upstream_error',
      e instanceof Error ? e.message : 'Der Vertrag konnte nicht zur Unterschrift gegeben werden.');
  }
});

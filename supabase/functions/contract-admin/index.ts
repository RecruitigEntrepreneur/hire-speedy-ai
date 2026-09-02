import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { contentHash } from '../_shared/tokens.ts';
import { serviceClient, logEvent } from '../_shared/intake-core.ts';
import { requireAdmin } from '../_shared/admin-auth.ts';

/**
 * contract-admin — Rahmenvertrag und Einzelauftrag durch den Unterschriftslauf.
 *
 * Unterschrieben wird in fester Reihenfolge: erst der Kunde, dann Matchunt.
 * Erst die Gegenzeichnung macht den Vertrag wirksam. Diese Funktion setzt die
 * Reihenfolge nicht durch -- das tun die Trigger framework_guard und die
 * CHECK-Constraints. Sie bildet sie ab und gibt verstaendliche Fehler zurueck,
 * damit der Admin nicht auf eine Datenbankmeldung sieht.
 *
 * Der Versand laeuft vorerst manuell ueber DocuSign. Die Zustaende sind genau
 * die, die eine spaetere DocuSign-Anbindung setzen wuerde -- der Umstieg ist
 * ein Austausch des Ausloesers, kein Umbau des Ablaufs. Deshalb traegt jeder
 * Schritt schon envelope_id.
 *
 * Was es hier NICHT gibt: eine Aktion, die Konditionen aendert. Es gibt drei
 * Pakete. Der frühere Weg "propose_new_terms" ist entfallen.
 */

const MAX = (s: unknown, n: number) => String(s ?? '').trim().slice(0, n) || null;

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const admin = await requireAdmin(req, supabase);
    if (!admin.ok) return fail('not_allowed', admin.message ?? 'Keine Berechtigung.');
    const adminId = admin.userId!;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');

    // ======================================================================
    // Rahmenvertrag anlegen
    // ======================================================================
    if (action === 'create_framework') {
      const draftId = String(body?.draft_id ?? '');
      if (!draftId) return fail('invalid', 'draft_id fehlt.');

      const { data: draft } = await supabase
        .from('intake_drafts').select('*').eq('id', draftId).maybeSingle();
      if (!draft) return fail('not_found', 'Die Aufnahme wurde nicht gefunden.');

      // Gibt es schon einen wirksamen Rahmenvertrag? Dann keinen zweiten --
      // der partielle Unique-Index wuerde es ohnehin ablehnen, aber der Admin
      // soll erfahren WARUM, und welchen er stattdessen verwenden kann.
      if (draft.organization_id ?? draft.matched_organization_id) {
        const orgId = draft.organization_id ?? draft.matched_organization_id;
        const { data: vorhanden } = await supabase
          .from('client_framework_agreements')
          .select('id, agreement_number, status')
          .eq('organization_id', orgId)
          .in('status', ['draft', 'pending_release', 'sent', 'customer_signed', 'active'])
          .maybeSingle();
        if (vorhanden) {
          return json({
            ok: true, existing: true, framework: vorhanden,
            message: vorhanden.status === 'active'
              ? `Für diesen Kunden gilt bereits der Rahmenvertrag ${vorhanden.agreement_number}. Der Einzelauftrag hängt sich darunter.`
              : `Für diesen Kunden läuft bereits ${vorhanden.agreement_number} (${vorhanden.status}).`,
          });
        }
      }

      const { data: tpl } = await supabase
        .from('contract_templates').select('*')
        .eq('doc_type', 'framework').eq('language', 'de').eq('is_active', true).maybeSingle();
      if (!tpl) return fail('not_deployed', 'Es ist kein aktiver Rahmenvertragstext hinterlegt.');

      // Abbild dessen, was unterschrieben wird. Nach der Kundenunterschrift
      // unveraenderlich (Trigger framework_guard).
      const snapshot = {
        captured_at: new Date().toISOString(),
        contract: {
          template_id: tpl.id, template_version: tpl.version,
          title: tpl.title, body_md: tpl.body_md, body_sha256: tpl.body_sha256,
        },
        vendor: {
          legal_name: tpl.vendor_legal_name, brand: tpl.vendor_brand,
          street: tpl.vendor_street, postal_code: tpl.vendor_postal_code,
          city: tpl.vendor_city, country: tpl.vendor_country,
          register: tpl.vendor_register, court: tpl.vendor_court, vat_id: tpl.vendor_vat_id,
        },
        client: {
          company_name: draft.company_name, company_legal_name: draft.company_legal_name,
          street: draft.company_street, postal_code: draft.company_postal_code,
          city: draft.company_city, country: draft.company_country,
          vat_id: draft.company_vat_id, registration_number: draft.company_registration_number,
          domain: draft.company_domain, billing_email: draft.billing_email ?? draft.contact_email,
          signer_name: draft.contact_name, signer_email: draft.contact_email,
          signer_role: draft.contact_role,
        },
        agb: { version: tpl.agb_version, sha256: tpl.agb_sha256 },
      };

      const { data: rv, error } = await supabase.from('client_framework_agreements').insert({
        organization_id: draft.organization_id ?? draft.matched_organization_id ?? null,
        origin_draft_id: draft.id,
        client_user_id: draft.client_user_id ?? draft.matched_client_user_id ?? null,
        template_id: tpl.id,
        template_version: tpl.version,
        snapshot,
        snapshot_sha256: await contentHash(JSON.stringify(snapshot)),
        agb_version: tpl.agb_version,
        agb_sha256: tpl.agb_sha256,
        customer_signer_name: draft.contact_name,
        customer_signer_email: draft.contact_email,
        customer_signer_role: draft.contact_role,
        status: 'draft',
      }).select('*').single();
      if (error) return fail('internal_error', error.message);

      return json({ ok: true, framework: rv });
    }

    // ======================================================================
    // Zur Unterschrift freigeben
    // ======================================================================
    // Der eigene Schritt zwischen "geprueft" und "beim Kunden". Ohne ihn gaebe
    // es keinen Moment, in dem ein Mensch das fertige Dokument ansieht.
    if (action === 'release_for_signature') {
      const kind = body?.framework_id ? 'framework' : 'assignment';
      const now = new Date().toISOString();

      if (kind === 'framework') {
        const { data, error } = await supabase.from('client_framework_agreements')
          .update({ status: 'pending_release', released_for_signature_at: now, released_by: adminId })
          .eq('id', String(body.framework_id)).select('*').single();
        if (error) return fail('conflict', error.message);
        await logEvent(supabase, {
          type: 'contract_released', draftId: data.origin_draft_id, actorUserId: adminId,
          meta: { framework: data.agreement_number },
        });
        return json({ ok: true, framework: data });
      }

      const mandateId = String(body?.mandate_id ?? '');
      if (!mandateId) return fail('invalid', 'mandate_id oder framework_id fehlt.');

      const { data: m } = await supabase.from('commercial_mandates')
        .select('*').eq('id', mandateId).maybeSingle();
      if (!m) return fail('not_found', 'Einzelauftrag nicht gefunden.');
      if (!m.framework_agreement_id) {
        return fail('conflict',
          'Der Einzelauftrag hängt an keinem Rahmenvertrag. Bitte zuerst den Rahmenvertrag anlegen und verknüpfen.');
      }
      if (m.status !== 'accepted') {
        return fail('conflict',
          `Der Einzelauftrag steht auf "${m.status}". Erst annehmen, dann zur Unterschrift freigeben.`);
      }

      const { data, error } = await supabase.from('commercial_mandates')
        .update({ released_for_signature_at: now, released_by: adminId, signature_status: 'pending' })
        .eq('id', mandateId).select('*').single();
      if (error) return fail('conflict', error.message);

      await logEvent(supabase, {
        type: 'contract_released', draftId: data.draft_id, actorUserId: adminId,
        meta: { mandate: data.mandate_number },
      });
      return json({ ok: true, mandate: data });
    }

    // ======================================================================
    // Versand vermerken (DocuSign, vorerst manuell)
    // ======================================================================
    if (action === 'mark_sent') {
      const now = new Date().toISOString();
      const envelope = MAX(body?.envelope_id, 200);

      if (body?.framework_id) {
        const { data, error } = await supabase.from('client_framework_agreements')
          .update({ status: 'sent', envelope_id: envelope, envelope_sent_at: now })
          .eq('id', String(body.framework_id)).select('*').single();
        if (error) return fail('conflict', error.message);
        await logEvent(supabase, {
          type: 'contract_sent', draftId: data.origin_draft_id, actorUserId: adminId,
          meta: { framework: data.agreement_number, envelope },
        });
        return json({ ok: true, framework: data });
      }

      const { data, error } = await supabase.from('commercial_mandates')
        .update({ signature_status: 'sent', signature_sent_at: now,
                  signature_sent_by: adminId, envelope_id: envelope,
                  signature_envelope_id: envelope })
        .eq('id', String(body?.mandate_id ?? '')).select('*').single();
      if (error) return fail('conflict', error.message);
      await logEvent(supabase, {
        type: 'contract_sent', draftId: data.draft_id, actorUserId: adminId,
        meta: { mandate: data.mandate_number, envelope },
      });
      return json({ ok: true, mandate: data });
    }

    // ======================================================================
    // Kundenunterschrift vermerken
    // ======================================================================
    if (action === 'record_customer_signature') {
      const signedAt = body?.signed_at ? new Date(body.signed_at).toISOString() : new Date().toISOString();

      if (body?.framework_id) {
        const { data: rv } = await supabase.from('client_framework_agreements')
          .select('*').eq('id', String(body.framework_id)).maybeSingle();
        if (!rv) return fail('not_found', 'Rahmenvertrag nicht gefunden.');
        // Doppelt zugestellte Meldungen sind bei DocuSign normal. Zweimal
        // dieselbe Unterschrift zu vermerken darf nicht scheitern -- und darf
        // vor allem das Datum nicht verschieben.
        if (rv.customer_signed_at) {
          return json({ ok: true, already: true, framework: rv });
        }

        const { data, error } = await supabase.from('client_framework_agreements')
          .update({
            status: 'customer_signed',
            customer_signed_at: signedAt,
            customer_signer_name: MAX(body?.signer_name, 120) ?? rv.customer_signer_name,
            customer_signer_email: MAX(body?.signer_email, 200) ?? rv.customer_signer_email,
            signed_document_path: MAX(body?.document_path, 500),
          })
          .eq('id', rv.id).select('*').single();
        if (error) return fail('conflict', error.message);

        await logEvent(supabase, {
          type: 'contract_signed', draftId: data.origin_draft_id, actorUserId: adminId,
          meta: { framework: data.agreement_number, party: 'customer' },
        });
        return json({ ok: true, framework: data });
      }

      const { data: m } = await supabase.from('commercial_mandates')
        .select('*').eq('id', String(body?.mandate_id ?? '')).maybeSingle();
      if (!m) return fail('not_found', 'Einzelauftrag nicht gefunden.');
      if (m.customer_signed_at) return json({ ok: true, already: true, mandate: m });

      const { data, error } = await supabase.from('commercial_mandates')
        .update({
          customer_signed_at: signedAt,
          customer_signer_name: MAX(body?.signer_name, 120) ?? m.client_confirmed_name,
          customer_signer_email: MAX(body?.signer_email, 200) ?? m.client_confirmed_email,
          signature_status: 'signed',
          signature_signed_at: signedAt,
          signature_recorded_by: adminId,
          signed_document_path: MAX(body?.document_path, 500),
        })
        .eq('id', m.id).select('*').single();
      if (error) return fail('conflict', error.message);

      await logEvent(supabase, {
        type: 'contract_signed', draftId: data.draft_id, actorUserId: adminId,
        meta: { mandate: data.mandate_number, party: 'customer' },
      });
      return json({ ok: true, mandate: data });
    }

    // ======================================================================
    // Gegenzeichnen -- und damit wirksam machen
    // ======================================================================
    if (action === 'countersign') {
      const now = new Date().toISOString();
      const name = MAX(body?.signer_name, 120) ?? admin.email ?? 'Matchunt';

      if (body?.framework_id) {
        const { data: rv } = await supabase.from('client_framework_agreements')
          .select('*').eq('id', String(body.framework_id)).maybeSingle();
        if (!rv) return fail('not_found', 'Rahmenvertrag nicht gefunden.');
        if (!rv.customer_signed_at) {
          return fail('conflict',
            'Der Kunde hat noch nicht unterschrieben. Matchunt zeichnet zuletzt.');
        }
        if (rv.countersigned_at) return json({ ok: true, already: true, framework: rv });

        const { data, error } = await supabase.from('client_framework_agreements')
          .update({ status: 'active', countersigned_at: now,
                    countersigner_name: name, countersigner_user_id: adminId })
          .eq('id', rv.id).select('*').single();
        if (error) return fail('conflict', error.message);

        await logEvent(supabase, {
          type: 'contract_countersigned', draftId: data.origin_draft_id, actorUserId: adminId,
          meta: { framework: data.agreement_number },
        });
        return json({ ok: true, framework: data });
      }

      const { data: m } = await supabase.from('commercial_mandates')
        .select('*').eq('id', String(body?.mandate_id ?? '')).maybeSingle();
      if (!m) return fail('not_found', 'Einzelauftrag nicht gefunden.');
      if (!m.customer_signed_at) {
        return fail('conflict', 'Der Kunde hat noch nicht unterschrieben. Matchunt zeichnet zuletzt.');
      }
      if (m.countersigned_at) return json({ ok: true, already: true, mandate: m });

      // Der Rahmenvertrag muss wirksam sein, sonst haengt der Einzelauftrag
      // an nichts. Die Veroeffentlichungssperre wuerde es spaeter ohnehin
      // merken -- hier ist der ehrlichere Ort, es zu sagen.
      const { data: rv } = await supabase.from('client_framework_agreements')
        .select('agreement_number, status').eq('id', m.framework_agreement_id).maybeSingle();
      if (!rv || rv.status !== 'active') {
        return fail('conflict',
          `Der Rahmenvertrag ${rv?.agreement_number ?? ''} ist noch nicht wirksam (Stand "${rv?.status ?? 'fehlt'}"). Erst ihn gegenzeichnen.`);
      }

      const { data, error } = await supabase.from('commercial_mandates')
        .update({ countersigned_at: now, countersigner_name: name, countersigner_user_id: adminId })
        .eq('id', m.id).select('*').single();
      if (error) return fail('conflict', error.message);

      await logEvent(supabase, {
        type: 'contract_countersigned', draftId: data.draft_id, actorUserId: adminId,
        meta: { mandate: data.mandate_number },
      });
      return json({ ok: true, mandate: data, publishable: true });
    }

    // ======================================================================
    // Ablehnung durch den Kunden
    // ======================================================================
    if (action === 'record_decline') {
      const reason = MAX(body?.reason, 1000);
      if (body?.framework_id) {
        const { data, error } = await supabase.from('client_framework_agreements')
          .update({ status: 'declined', declined_at: new Date().toISOString(), decline_reason: reason })
          .eq('id', String(body.framework_id)).select('*').single();
        if (error) return fail('conflict', error.message);
        await logEvent(supabase, {
          type: 'contract_declined', draftId: data.origin_draft_id, actorUserId: adminId,
          meta: { framework: data.agreement_number, reason },
        });
        return json({ ok: true, framework: data });
      }
      const { data, error } = await supabase.from('commercial_mandates')
        .update({ signature_status: 'declined', decline_reason: reason,
                  declined_at: new Date().toISOString(), declined_by: adminId })
        .eq('id', String(body?.mandate_id ?? '')).select('*').single();
      if (error) return fail('conflict', error.message);
      await logEvent(supabase, {
        type: 'contract_declined', draftId: data.draft_id, actorUserId: adminId,
        meta: { mandate: data.mandate_number, reason },
      });
      return json({ ok: true, mandate: data });
    }

    // ======================================================================
    // Einzelauftrag mit dem Rahmenvertrag verknuepfen
    // ======================================================================
    if (action === 'link_framework') {
      const { data, error } = await supabase.from('commercial_mandates')
        .update({ framework_agreement_id: String(body?.framework_id ?? '') })
        .eq('id', String(body?.mandate_id ?? '')).select('*').single();
      if (error) return fail('conflict', error.message);
      return json({ ok: true, mandate: data });
    }

    return fail('invalid', `Unbekannte Aktion "${action}".`);
  } catch (e) {
    console.error('[contract-admin]', e);
    return fail('server_error', 'Der Vertragsschritt konnte nicht ausgeführt werden.');
  }
});

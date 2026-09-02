import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient, logEvent } from '../_shared/intake-core.ts';
import { docusignConfig, verifyWebhook, completedDocument } from '../_shared/docusign.ts';

/**
 * docusign-webhook — Ereignisse aus DocuSign Connect.
 *
 * Ohne Signaturpruefung koennte jeder, der die Adresse kennt, einen Vertrag als
 * unterzeichnet melden und damit die Veroeffentlichungssperre aushebeln. Die
 * Pruefung steht deshalb ganz vorn, vor dem Lesen des Inhalts.
 *
 * Doppelte und verspaetete Zustellungen sind bei Connect normal. Jede
 * Verarbeitung ist deshalb idempotent: ein bereits gesetzter Zeitstempel wird
 * nie ueberschrieben. Eine zweite Meldung darf das Unterschriftsdatum nicht
 * verschieben -- es ist ein Nachweis, kein Statusfeld.
 *
 * Die Zustaende werden aus den EMPFAENGERN abgeleitet, nicht aus dem
 * Umschlagstatus: nur so laesst sich zwischen "Kunde hat unterschrieben" und
 * "beide haben unterschrieben" unterscheiden.
 */

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const raw = await req.text();

    const ok = await verifyWebhook(raw, req.headers.get('x-docusign-signature-1'));
    if (!ok) {
      console.warn('[docusign-webhook] Signatur ungültig oder DOCUSIGN_HMAC_KEY fehlt.');
      return fail('not_allowed', 'Signatur ungültig.');
    }

    const payload = JSON.parse(raw);
    const daten = payload?.data ?? {};
    const envelopeId: string | undefined = daten.envelopeId ?? payload?.envelopeId;
    if (!envelopeId) return json({ ok: true, ignored: 'ohne envelopeId' });

    const supabase = serviceClient();

    const umschlag = daten.envelopeSummary ?? {};
    const signers: Record<string, any>[] = umschlag?.recipients?.signers ?? [];
    const kunde  = signers.find((s) => String(s.recipientId) === '1');
    const gegen  = signers.find((s) => String(s.recipientId) === '2');

    const kundeFertig = kunde?.status === 'completed';
    const gegenFertig = gegen?.status === 'completed';
    const abgelehnt   = signers.some((s) => s.status === 'declined');
    const jetzt = new Date().toISOString();

    // Beide Dokumente haengen am selben Umschlag.
    const { data: mandate } = await supabase.from('commercial_mandates')
      .select('*').eq('envelope_id', envelopeId).maybeSingle();
    const { data: framework } = await supabase.from('client_framework_agreements')
      .select('*').eq('envelope_id', envelopeId).maybeSingle();

    if (!mandate && !framework) {
      // Kein Fehler: der Umschlag gehoert nicht zu uns oder wurde geloescht.
      return json({ ok: true, ignored: 'unbekannter Umschlag' });
    }

    const draftId = mandate?.draft_id ?? framework?.origin_draft_id ?? null;

    // ---- Ablehnung ----------------------------------------------------------
    if (abgelehnt) {
      const grund = signers.find((s) => s.status === 'declined')?.declinedReason ?? null;
      if (mandate && mandate.signature_status !== 'declined') {
        await supabase.from('commercial_mandates')
          .update({ signature_status: 'declined', decline_reason: grund, declined_at: jetzt })
          .eq('id', mandate.id);
      }
      if (framework && framework.status === 'sent') {
        await supabase.from('client_framework_agreements')
          .update({ status: 'declined', declined_at: jetzt, decline_reason: grund })
          .eq('id', framework.id);
      }
      await logEvent(supabase, { type: 'contract_declined', draftId,
        meta: { envelope: envelopeId, reason: grund } });
      return json({ ok: true, state: 'declined' });
    }

    // ---- Kundenunterschrift -------------------------------------------------
    // Der Zeitstempel wird nur gesetzt, wenn er fehlt. Eine zweite Zustellung
    // darf ihn nicht verschieben.
    if (kundeFertig) {
      const signedAt = kunde?.signedDateTime ?? jetzt;

      if (framework && !framework.customer_signed_at) {
        await supabase.from('client_framework_agreements').update({
          status: 'customer_signed',
          customer_signed_at: signedAt,
          customer_signer_name: kunde?.name ?? framework.customer_signer_name,
          customer_signer_email: kunde?.email ?? framework.customer_signer_email,
        }).eq('id', framework.id);
      }
      if (mandate && !mandate.customer_signed_at) {
        await supabase.from('commercial_mandates').update({
          customer_signed_at: signedAt,
          customer_signer_name: kunde?.name ?? mandate.client_confirmed_name,
          customer_signer_email: kunde?.email ?? mandate.client_confirmed_email,
          signature_status: 'signed',
          signature_signed_at: signedAt,
        }).eq('id', mandate.id);

        await logEvent(supabase, { type: 'contract_signed', draftId,
          meta: { envelope: envelopeId, party: 'customer' } });
      }
    }

    // ---- Gegenzeichnung -----------------------------------------------------
    if (gegenFertig) {
      const gegenAt = gegen?.signedDateTime ?? jetzt;

      // Der Rahmenvertrag zuerst: der Einzelauftrag verlangt ihn wirksam.
      if (framework && !framework.countersigned_at && framework.customer_signed_at) {
        await supabase.from('client_framework_agreements').update({
          status: 'active',
          countersigned_at: gegenAt,
          countersigner_name: gegen?.name ?? 'Matchunt',
        }).eq('id', framework.id);
      }
      if (mandate && !mandate.countersigned_at && mandate.customer_signed_at) {
        await supabase.from('commercial_mandates').update({
          countersigned_at: gegenAt,
          countersigner_name: gegen?.name ?? 'Matchunt',
          // Die Gegenzeichnung IST die Annahme. Ohne diesen Schritt bliebe der
          // Auftrag auf 'client_confirmed' und das Freigabe-Gate zu.
          status: 'accepted',
          accepted_at: mandate.accepted_at ?? gegenAt,
        }).eq('id', mandate.id);

        await logEvent(supabase, { type: 'contract_countersigned', draftId,
          meta: { envelope: envelopeId } });
      }
    }

    // ---- Unterzeichnetes Dokument sichern -----------------------------------
    if (umschlag?.status === 'completed' || (kundeFertig && gegenFertig)) {
      const cfg = docusignConfig();
      if (cfg) {
        try {
          const bytes = await completedDocument(cfg, envelopeId);
          const pfad = `${mandate?.id ?? framework?.id}/${envelopeId}-signiert.pdf`;
          await supabase.storage.from('mandate-documents')
            .upload(pfad, bytes, { contentType: 'application/pdf', upsert: true });

          const digest = await crypto.subtle.digest('SHA-256', bytes);
          const sha = Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0')).join('');

          if (mandate) {
            await supabase.from('commercial_mandates')
              .update({ signed_document_path: pfad }).eq('id', mandate.id);
          }
          if (framework) {
            await supabase.from('client_framework_agreements')
              .update({ signed_document_path: pfad, signed_document_sha256: sha })
              .eq('id', framework.id);
          }
        } catch (e) {
          // Der Vertrag ist wirksam -- das haengt nicht daran, ob wir die
          // Kopie schon abgelegt haben. Nur vermerken.
          console.warn('[docusign-webhook] Dokument nicht gesichert:',
            e instanceof Error ? e.message : e);
        }
      }
    }

    return json({ ok: true, customer_signed: kundeFertig, countersigned: gegenFertig });
  } catch (e) {
    console.error('[docusign-webhook]', e);
    // 500 sorgt dafuer, dass DocuSign erneut zustellt -- besser als ein
    // stillschweigend verlorenes Ereignis.
    return fail('internal_error', 'Ereignis konnte nicht verarbeitet werden.');
  }
});

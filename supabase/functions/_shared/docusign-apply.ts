import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent } from '../_shared/intake-core.ts';

/**
 * Den Zustand eines Umschlags auf unsere Daten anwenden.
 *
 * Eine Funktion fuer zwei Ausloeser: den Webhook (DocuSign meldet) und die
 * Statusabfrage (wir fragen nach). Zwei Umsetzungen waeren zwei Auslegungen
 * davon, wann ein Vertrag als unterschrieben gilt -- und die eine wuerde
 * frueher oder spaeter von der anderen abweichen.
 *
 * Idempotent in beide Richtungen: ein gesetzter Zeitstempel wird nie
 * ueberschrieben. Er ist ein Nachweis, kein Statusfeld. Deshalb ist es
 * gleichgueltig, ob ein Ereignis doppelt, verspaetet oder gar nicht kommt --
 * die Abfrage holt denselben Stand nach.
 */

export interface SignerState {
  recipientId: string;
  status: string;
  name?: string;
  email?: string;
  signedDateTime?: string;
  declinedReason?: string;
}

export interface ApplyResult {
  matched: boolean;
  customerSigned: boolean;
  countersigned: boolean;
  declined: boolean;
  mandateId: string | null;
  frameworkId: string | null;
}

export async function applyEnvelopeState(
  supabase: SupabaseClient,
  envelopeId: string,
  signers: SignerState[],
): Promise<ApplyResult> {
  const kunde = signers.find((s) => String(s.recipientId) === '1');
  const gegen = signers.find((s) => String(s.recipientId) === '2');

  const kundeFertig = kunde?.status === 'completed';
  const gegenFertig = gegen?.status === 'completed';
  const abgelehnt   = signers.some((s) => s.status === 'declined');
  const jetzt = new Date().toISOString();

  const { data: mandate } = await supabase.from('commercial_mandates')
    .select('*').eq('envelope_id', envelopeId).maybeSingle();
  const { data: framework } = await supabase.from('client_framework_agreements')
    .select('*').eq('envelope_id', envelopeId).maybeSingle();

  const leer: ApplyResult = {
    matched: false, customerSigned: false, countersigned: false,
    declined: false, mandateId: null, frameworkId: null,
  };
  if (!mandate && !framework) return leer;

  const draftId = mandate?.draft_id ?? framework?.origin_draft_id ?? null;
  // Wer gegengezeichnet hat, falls es ueber unsere Oberflaeche lief. Kam die
  // Unterschrift ueber die DocuSign-Mail, steht hier niemand -- das ist
  // ehrlicher, als die Annahme einem beliebigen Admin zuzuschreiben.
  const countersignerUserId = mandate?.countersigner_user_id
    ?? framework?.countersigner_user_id ?? null;
  const ergebnis: ApplyResult = {
    matched: true,
    customerSigned: kundeFertig,
    countersigned: gegenFertig,
    declined: abgelehnt,
    mandateId: mandate?.id ?? null,
    frameworkId: framework?.id ?? null,
  };

  // ---- Ablehnung -----------------------------------------------------------
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
    return ergebnis;
  }

  // ---- Kundenunterschrift --------------------------------------------------
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
        customer_signer_name: kunde?.name ?? mandate.customer_signer_name,
        customer_signer_email: kunde?.email ?? mandate.customer_signer_email,
        signature_status: 'signed',
        signature_signed_at: signedAt,
      }).eq('id', mandate.id);
      await logEvent(supabase, { type: 'contract_signed', draftId,
        meta: { envelope: envelopeId, party: 'customer' } });
    }
  }

  // ---- Gegenzeichnung ------------------------------------------------------
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

      // Die Gegenzeichnung IST die Annahme -- wer gegenzeichnet, hat
      // entschieden. Ein zweiter Klick "annehmen" waere eine Formalie, die
      // liegenbleiben kann, waehrend der Kunde auf seinen Zugang wartet.
      //
      // Angelegt wird: Stelle, Kundenkonto, Zugangslink, Annahmemail.
      // NICHT veroeffentlicht: das bleibt ein bewusster Klick, damit ein
      // duennes Briefing nicht ungeprueft ans Recruiter-Netz geht.
      //
      // Nicht blockierend: der Vertrag ist wirksam, auch wenn die Anlage
      // scheitert. Sie laesst sich im Admin-Bereich nachholen.
      if (draftId) {
        try {
          const res = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/intake-admin`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
              },
              body: JSON.stringify({
                action: 'accept',
                draft_id: draftId,
                acting_user_id: countersignerUserId ?? null,
              }),
            });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            console.warn('[docusign-apply] Annahme nicht ausgefuehrt:', d?.message ?? res.status);
          }
        } catch (e) {
          console.warn('[docusign-apply] Annahme fehlgeschlagen:',
            e instanceof Error ? e.message : e);
        }
      }
    }
  }

  return ergebnis;
}

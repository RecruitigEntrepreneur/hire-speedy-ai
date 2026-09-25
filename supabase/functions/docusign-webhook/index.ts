import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient } from '../_shared/intake-core.ts';
import { verifyWebhook } from '../_shared/docusign.ts';
import { applyEnvelopeState, saveSignedDocument, type SignerState } from '../_shared/docusign-apply.ts';

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
    const signers = (umschlag?.recipients?.signers ?? []) as SignerState[];

    // Dieselbe Logik wie in docusign-status. Ein Webhook kann ausbleiben oder
    // doppelt kommen; die Abfrage holt denselben Stand nach. Zwei Umsetzungen
    // waeren zwei Auslegungen davon, wann ein Vertrag als unterschrieben gilt.
    const ergebnis = await applyEnvelopeState(supabase, envelopeId, signers);
    if (!ergebnis.matched) {
      // Kein Fehler: der Umschlag gehoert nicht zu uns oder wurde geloescht.
      return json({ ok: true, ignored: 'unbekannter Umschlag' });
    }

    const kundeFertig = ergebnis.customerSigned;
    const gegenFertig = ergebnis.countersigned;

    // ---- Unterzeichnetes Dokument sichern -----------------------------------
    if (umschlag?.status === 'completed' || (kundeFertig && gegenFertig)) {
      await saveSignedDocument(supabase, envelopeId, ergebnis);
    }

    return json({ ok: true, customer_signed: kundeFertig, countersigned: gegenFertig });
  } catch (e) {
    console.error('[docusign-webhook]', e);
    // 500 sorgt dafuer, dass DocuSign erneut zustellt -- besser als ein
    // stillschweigend verlorenes Ereignis.
    return fail('internal_error', 'Ereignis konnte nicht verarbeitet werden.');
  }
});

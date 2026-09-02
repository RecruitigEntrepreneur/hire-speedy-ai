import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { preflight, json, fail } from '../_shared/http.ts';
import { serviceClient, resolveDraft } from '../_shared/intake-core.ts';
import { requireAdmin, isServiceRole } from '../_shared/admin-auth.ts';
import { docusignConfig, envelopeStatus } from '../_shared/docusign.ts';
import { applyEnvelopeState, type SignerState } from '../_shared/docusign-apply.ts';

/**
 * docusign-status — den Stand eines Umschlags bei DocuSign abfragen und
 * anwenden.
 *
 * Der Webhook ist der schnelle Weg, aber er ist nicht der verlaessliche: er
 * setzt eine eingerichtete Connect-Konfiguration mit HMAC-Schluessel voraus,
 * er kann ausfallen, und eine verlorene Zustellung merkt niemand. Ohne einen
 * zweiten Weg haette ein einziges verpasstes Ereignis zur Folge, dass ein
 * unterschriebener Vertrag bei uns als offen gilt -- und die Stelle nie
 * freigegeben werden koennte.
 *
 * Diese Funktion holt denselben Stand aktiv. Sie teilt sich die gesamte Logik
 * mit dem Webhook (_shared/docusign-apply.ts), damit beide Wege nie
 * auseinanderlaufen koennen.
 *
 * Damit ist der HMAC-Schluessel eine Bequemlichkeit, keine Voraussetzung.
 */

serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  try {
    const supabase = serviceClient();
    const body = await req.json().catch(() => ({}));

    // Admin, eigenes Backend, oder der Gast fuer die eigene Aufnahme.
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

    const cfg = docusignConfig();
    if (!cfg) return fail('not_deployed', 'DocuSign ist nicht eingerichtet.');

    // Den Umschlag finden: entweder direkt benannt oder ueber die Aufnahme.
    let envelopeId = String(body?.envelope_id ?? '');
    if (!envelopeId && draftId) {
      const { data: m } = await supabase.from('commercial_mandates')
        .select('envelope_id').eq('draft_id', draftId)
        .not('envelope_id', 'is', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      envelopeId = m?.envelope_id ?? '';
    }
    if (!envelopeId) {
      return fail('not_found', 'Zu diesem Vorgang liegt noch kein Umschlag vor.');
    }

    const stand = await envelopeStatus(cfg, envelopeId);
    const signers = (stand?.recipients?.signers ?? []) as SignerState[];
    const ergebnis = await applyEnvelopeState(supabase, envelopeId, signers);

    if (!ergebnis.matched) {
      return fail('not_found', 'Der Umschlag gehört zu keinem bekannten Vorgang.');
    }

    return json({
      ok: true,
      envelope_id: envelopeId,
      envelope_status: stand?.status ?? null,
      customer_signed: ergebnis.customerSigned,
      countersigned: ergebnis.countersigned,
      declined: ergebnis.declined,
      // Was der Kunde daraus lesen soll, ohne unsere Zustandsnamen zu kennen.
      summary: ergebnis.declined ? 'abgelehnt'
             : ergebnis.countersigned ? 'beidseitig unterzeichnet'
             : ergebnis.customerSigned ? 'vom Kunden unterzeichnet, Gegenzeichnung offen'
             : 'zur Unterschrift versendet',
    });
  } catch (e) {
    console.error('[docusign-status]', e);
    return fail('upstream_error',
      e instanceof Error ? e.message : 'Der Stand konnte nicht abgefragt werden.');
  }
});

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Ein Rahmenvertrag wird wirksam (Gegenzeichnung) -- EIN Weg für die
 * DocuSign-Rückmeldung (docusign-apply) und den Admin-Knopf (contract-admin).
 *
 * Zwei Dinge passieren dabei mit:
 *
 * 1. Ablösung. Ein Kunde mit Fassung 1, der zum ersten Mal Contracting
 *    beauftragt, unterschreibt Fassung 2 (supersedes_id). Je Firma darf nur ein
 *    Vertrag wirksam sein (client_framework_one_active_idx) -- die alte Fassung
 *    endet deshalb, BEVOR die neue wirksam wird.
 *
 * 2. Kondition. Bis zum 25.09.2026 bekam ein neuer Rahmenvertrag nie sein
 *    Paket: nur eine einmalige Nachtrags-Migration hatte es gesetzt. Weitere
 *    Positionen neuer Kunden liefen deshalb wieder mit eigener Unterschrift,
 *    obwohl der Vertrag "einmal je Kunde" verspricht. Jetzt übernimmt der
 *    Vertrag das Paket des Festanstellungs-Auftrags, mit dem er unterschrieben
 *    wurde. Beginnt der Kunde mit Contracting, bleibt das Paket offen (Core bis
 *    zur Wahl, § 8 Abs. 2) -- die Wahl trägt intake-submit nach.
 */
export async function rahmenvertragWirksam(
  db: SupabaseClient,
  rv: Record<string, any>,
  args: { countersignedAt: string; name: string; userId?: string | null },
): Promise<{ data: Record<string, any> | null; error: string | null }> {
  if (rv.supersedes_id) {
    const { error } = await db.from('client_framework_agreements')
      .update({ status: 'superseded' })
      .eq('id', rv.supersedes_id).eq('status', 'active');
    if (error) console.warn('[framework-activate] alte Fassung nicht beendet:', error.message);
  }

  const patch: Record<string, unknown> = {
    status: 'active',
    countersigned_at: args.countersignedAt,
    countersigner_name: args.name,
    ...(args.userId ? { countersigner_user_id: args.userId } : {}),
  };

  if (!rv.package_key) {
    const { data: auftrag } = await db.from('commercial_mandates')
      .select('package_key, package_version, pricing_snapshot, pricing_snapshot_sha256, package_selected_at, client_confirmed_at')
      .eq('framework_agreement_id', rv.id)
      .not('package_key', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1).maybeSingle();
    if (auftrag?.package_key && auftrag.pricing_snapshot) {
      Object.assign(patch, {
        package_key: auftrag.package_key,
        package_version: auftrag.package_version,
        pricing_snapshot: auftrag.pricing_snapshot,
        pricing_snapshot_sha256: auftrag.pricing_snapshot_sha256,
        package_selected_at: auftrag.package_selected_at ?? auftrag.client_confirmed_at,
      });
    }
  }

  const { data, error } = await db.from('client_framework_agreements')
    .update(patch).eq('id', rv.id).select('*').single();
  return { data: data ?? null, error: error?.message ?? null };
}

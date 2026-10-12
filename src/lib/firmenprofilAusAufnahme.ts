import { supabase } from '@/integrations/supabase/client';
import { firmenprofilAusAufnahme } from '../../supabase/functions/_shared/firmenprofil';

/**
 * Beim Einreichen im Dashboard: leere Felder des Firmenprofils aus der Aufnahme
 * füllen (Entscheidung 12.10.2026) -- dieselbe Regel wie bei der Annahme über den
 * Aufnahme-Link (intake-admin): nur Stammdaten und Mitarbeiterzahl, nur in leere
 * Felder. Vorher füllten Dashboard-Stellen das Profil nie; die Vorbereitungsliste
 * fragte dann nach der Mitarbeiterzahl, die der Kunde gerade angegeben hatte.
 *
 * Das Firmenprofil pflegt der Inhaber; Kollegen im Team füllen es nicht.
 * Nicht blockierend: scheitert es, ist die Stelle trotzdem eingereicht.
 */
export async function profilAusAufnahme(userId: string, firma: object, jobRow: Record<string, unknown>): Promise<void> {
  try {
    const { data: mitglied } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    if (mitglied && mitglied.role !== 'owner') return;
    const res = await firmenprofilAusAufnahme(supabase as never, userId, { ...firma }, jobRow);
    if (res.fehler) console.warn('[Firmenprofil aus Aufnahme]', res.fehler);
  } catch (e) {
    console.warn('[Firmenprofil aus Aufnahme]', e);
  }
}

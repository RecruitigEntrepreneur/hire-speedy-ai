import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { firmenprofilAusAufnahme } from './firmenprofil.ts';
import { draftToJobRow } from './intake-mapping.ts';

/**
 * Kundenkonto zu einer Aufnahme anlegen. Die Adresse ist per Code verifiziert,
 * deshalb email_confirm: true -- dasselbe Vorgehen wie in accept-invite.
 * Wirft, wenn das Konto nicht entsteht.
 */
export async function createClientAccount(db: SupabaseClient, draft: Record<string, any>): Promise<string> {
  const { data: created, error } = await db.auth.admin.createUser({
    email: draft.contact_email,
    email_confirm: true,
    user_metadata: { full_name: draft.contact_name, role: 'client' },
  });
  if (error || !created?.user) throw new Error(error?.message ?? 'unbekannt');
  const userId = created.user.id;

  // handle_new_user() vergibt die Rolle 'client'. Der Trigger kann je
  // nach Fassung ausbleiben; deshalb hier absichern -- aber nur genau
  // eine Rollenzeile, sonst liefert das maybeSingle() in
  // src/lib/auth.tsx:53-63 einen Fehler und der Login haengt.
  const { data: roles } = await db.from('user_roles').select('id, role').eq('user_id', userId);
  if (!roles || roles.length === 0) {
    await db.from('user_roles').insert({ user_id: userId, role: 'client' });
  }
  const { data: prof } = await db.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  if (!prof) {
    await db.from('profiles').insert({
      user_id: userId,
      email: draft.contact_email,
      full_name: draft.contact_name,
      company_name: draft.company_name,
    });
  }
  return userId;
}

/**
 * Konto und Aufnahme verbinden, solange die Stelle noch nicht angenommen ist:
 * Der Kunde sieht im Dashboard seinen Rahmenvertrag (RLS über client_user_id), und
 * der Start-Kasten fragt nicht nach Firmendaten, die er gerade eingegeben hat. Nur
 * leere Felder, nie überschreiben. Die Annahme findet das Konto später über die Adresse.
 * Wirft nie: Daran darf die Unterschrift nicht scheitern.
 */
export async function attachClientToDraft(db: SupabaseClient, draft: Record<string, any>, userId: string) {
  try {
    const { data: mandate } = await db.from('commercial_mandates').select('framework_agreement_id')
      .eq('draft_id', draft.id).not('framework_agreement_id', 'is', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (mandate?.framework_agreement_id) {
      const { error } = await db.from('client_framework_agreements').update({ client_user_id: userId })
        .eq('id', mandate.framework_agreement_id).is('client_user_id', null);
      if (error) console.warn('[client-account] Rahmenvertrag nicht verbunden:', error.message);
    }
    const profil = await firmenprofilAusAufnahme(db, userId, draft, draftToJobRow(draft));
    if (profil.fehler) console.warn('[client-account] Firmenprofil nicht gefuellt:', profil.fehler);
  } catch (e) {
    console.warn('[client-account] Aufnahme nicht verbunden:', e instanceof Error ? e.message : e);
  }
}

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Abschaltbare Kunden-Mails (Einstellungen › Mein Konto, 09.10.2026).
 * Nur reine Mitteilungen: Absage, „bleibt beim alten Termin“ und die
 * Bestätigung ohne Kalenderdatei (der Termin steht dann schon in Outlook).
 * Alles mit Kalenderdatei, Handlungsbedarf, Codes, Einladungen und Verträgen
 * geht immer raus.
 */
const OPTIONAL: Record<string, 'interview_updates'> = {
  interview_declined_client: 'interview_updates',
  interview_reschedule_declined_client: 'interview_updates',
  interview_booked_client: 'interview_updates',
};

export async function clientMailAllowed(db: SupabaseClient, to: string, template: string, hasCalendarFile: boolean): Promise<boolean> {
  const key = OPTIONAL[template];
  if (!key || hasCalendarFile) return true;
  try {
    const { data: profile } = await db.from('profiles').select('user_id').ilike('email', to.trim()).limit(1).maybeSingle();
    if (!profile?.user_id) return true;
    const { data: prefs } = await db.from('client_notification_preferences').select(key).eq('user_id', profile.user_id).maybeSingle();
    return (prefs as Record<string, unknown> | null)?.[key] !== false;
  } catch {
    // Im Zweifel geht die Mail raus.
    return true;
  }
}

import { supabase } from '@/integrations/supabase/client';

/**
 * Kundenanmeldung per Code (/anmelden, Entscheidung 25.09.2026): persönlicher
 * Link aus der Zugangsmail oder die eigene Adresse, dann der Code aus der Mail,
 * beim ersten Mal ein Passwort, dann ins Dashboard. Server: client-login.
 */

/** Antwort auf den persönlichen Link aus der Zugangsmail (/anmelden#<Schlüssel>). */
export type ClientLinkPeek = { status: 'open'; name: string; masked_email: string } | { status: 'expired' | 'invalid' };

/** Ziel nach der Anmeldung: nur Seiten im Kundenbereich, keine fremden Adressen. */
export function safeClientPath(value: string | null | undefined): string {
  if (!value || !/^\/dashboard(\/|\?|$)/.test(value)) return '/dashboard';
  return value;
}

/** Beim ersten Mal (noch kein Passwort) bietet das Dashboard den Rundgang an, auch mit Stelle. */
export const FIRST_VISIT_PARAM = 'rundgang';
export const withFirstVisit = (path: string) => `${path}${path.includes('?') ? '&' : '?'}${FIRST_VISIT_PARAM}=1`;

export async function clientLoginApi<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('client-login', { body });
  if (error) {
    let message = 'Die Anmeldung ist gerade nicht erreichbar. Bitte versuchen Sie es gleich noch einmal.';
    if (error.context instanceof Response) {
      const detail = await error.context.clone().json().catch(() => null);
      if (typeof detail?.message === 'string') message = detail.message;
    }
    throw new Error(message);
  }
  return data as T;
}

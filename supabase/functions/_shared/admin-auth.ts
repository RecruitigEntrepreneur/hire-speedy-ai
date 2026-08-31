/**
 * Serverseitige Admin-Pruefung.
 *
 * Notwendig, weil ProtectedRoute (src/App.tsx:117-143) reine UI ist und
 * role === 'admin' dort sogar jede allowedRoles-Pruefung umgeht. Wer die
 * Function direkt aufruft, kommt an der Route ohnehin vorbei.
 *
 * verify_jwt = true stellt nur sicher, DASS ein gueltiges Token vorliegt --
 * nicht, WEM es gehoert und welche Rolle es hat.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AdminContext {
  ok: boolean;
  userId?: string;
  email?: string;
  message?: string;
}

export async function requireAdmin(
  req: Request,
  service: SupabaseClient,
): Promise<AdminContext> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return { ok: false, message: 'Nicht angemeldet.' };

  // Eigener Client mit dem Nutzer-Token: getUser() validiert die Signatur
  // gegen das Projekt-Secret.
  const asUser = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } },
  );

  const { data: userData, error } = await asUser.auth.getUser();
  if (error || !userData?.user) return { ok: false, message: 'Sitzung ungültig.' };

  const userId = userData.user.id;

  // Rollenpruefung mit Service-Role: user_roles ist fuer den Nutzer selbst
  // zwar lesbar, aber die Pruefung darf nicht davon abhaengen.
  const { data: roles, error: roleErr } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .limit(1);

  if (roleErr) {
    console.error('[admin-auth] Rollenprüfung fehlgeschlagen:', roleErr.message);
    return { ok: false, message: 'Berechtigung konnte nicht geprüft werden.' };
  }
  if (!roles || roles.length === 0) return { ok: false, message: 'Keine Berechtigung.' };

  return { ok: true, userId, email: userData.user.email ?? undefined };
}

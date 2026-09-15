import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normalizeEmail } from './recruiter-contract-policy.ts';
import { dbError, must } from './recruiter-onboarding-service.ts';

/** Reuse the customer integration's signer, but require a verified admin account
 * so the recruiter flow can enforce review before embedded countersigning. */
export async function recruiterCountersigner(db: SupabaseClient, env = (key: string) => Deno.env.get(key)) {
  const explicitId = env('RECRUITER_COUNTERSIGNER_USER_ID')?.trim();
  const email = normalizeEmail(env('DOCUSIGN_COUNTERSIGNER_EMAIL') ?? '');
  const name = (env('RECRUITER_COUNTERSIGNER_NAME') || env('DOCUSIGN_COUNTERSIGNER_NAME'))?.trim();
  must(name && (explicitId || email), 'Der Matchunt-Gegenzeichner muss in der bestehenden DocuSign-Einrichtung hinterlegt sein.', 'not_deployed');
  let query = db.from('user_roles').select('user_id').eq('role', 'admin');
  if (explicitId) query = query.eq('user_id', explicitId);
  const { data: roles, error } = await query;
  dbError(error);
  for (const role of roles ?? []) {
    const { data, error: userError } = await db.auth.admin.getUserById(role.user_id);
    dbError(userError);
    const user = data.user as (typeof data.user & { banned_until?: string });
    if (user?.email_confirmed_at && user.email
      && (!user.banned_until || Date.parse(user.banned_until) <= Date.now())
      && (explicitId || normalizeEmail(user.email) === email)) {
      return { id: user.id, name, email: normalizeEmail(user.email) };
    }
  }
  must(false, 'Der konfigurierte DocuSign-Gegenzeichner benötigt ein bestätigtes, aktives Matchunt-Admin-Konto.', 'not_deployed');
}

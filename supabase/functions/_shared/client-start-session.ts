import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveDraft } from './intake-core.ts';
import { LIMITS } from './intake-limits.ts';
import { accountForEmail } from './client-access.ts';
import { attachClientToDraft, createClientAccount } from './client-account.ts';
import { checkSessionTicket } from './client-session-ticket.ts';
import { liveClientDeps, type ClientCodeDeps } from './client-code.ts';
import { issueSession, type CodeSession } from './login-code.ts';
import { must } from './recruiter-onboarding-service.ts';
import { customerMailLanguage, seedProfileLanguage } from './intake-language.ts';

/**
 * Anmeldung beim Absenden der Aufnahme (Entscheidung 30.10.2026): Wer seine Adresse
 * gerade per Code bestätigt hat, ist beim Unterschreiben schon angemeldet, genau wie
 * der Headhunter. Das Funnel-Ende fällt weg: Er landet im Dashboard, auch wenn er das
 * Fenster schließt oder jemand anderes unterschreibt.
 *
 * Keine Sitzung, und damit der Weg per Mail und Code, wenn:
 *   not_ready      die Adresse nicht bestätigt oder die Aufnahme nicht abgeschickt ist
 *   other_browser  die Marke aus der Code-Bestätigung fehlt (client-session-ticket.ts)
 *   other_role     die Adresse zu einem Headhunter oder Admin gehört: nichts still übernehmen
 *   blocked        das Konto gesperrt ist oder zu viele Versuche kamen
 *   failed         Konto oder Sitzung nicht entstanden. Die Unterschrift geht trotzdem weiter.
 */
export type NoSession = 'not_ready' | 'other_browser' | 'other_role' | 'blocked' | 'failed';
export type DraftSession = { session: CodeSession } | { session: null; reason: NoSession };

const none = (reason: NoSession): DraftSession => ({ session: null, reason });

export async function openDraftSession(db: SupabaseClient, body: { draft_token?: unknown; ticket?: unknown; ip: string | null },
  deps: ClientCodeDeps = liveClientDeps()): Promise<DraftSession> {
  const found = await resolveDraft(db, body.draft_token);
  must(found.ok, found.message ?? 'Ungültiger Zugriffslink.', found.reason ?? 'not_found');
  const draft = found.draft!;
  const email = String(draft.contact_email ?? '').trim().toLowerCase();
  if (!email || draft.identity_state !== 'email_verified' || !['pending_admin', 'accepted'].includes(draft.review_state)) return none('not_ready');
  if (!await checkSessionTicket(draft.id, email, body.ticket)) return none('other_browser');
  const limit = await deps.limits(db, LIMITS.clientVerify(email, body.ip));
  if (!limit.allowed) return none('blocked');

  const account = await accountForEmail(db, email);
  if (account && !(account.roles.length === 1 && account.roles[0] === 'client')) return none('other_role');
  if (account) {
    const { data: role } = await db.from('user_roles').select('status').eq('user_id', account.userId).eq('role', 'client').maybeSingle();
    if (role?.status === 'suspended') return none('blocked');
  }
  try {
    const userId = account?.userId ?? await createClientAccount(db, draft);
    await attachClientToDraft(db, draft, userId);
    // Sprache der Aufnahme ans neue Konto, damit Dashboard und Mails gleich passen.
    await seedProfileLanguage(db, userId, await customerMailLanguage(db, draft));
    const session = await issueSession(db, email, deps);
    return session ? { session } : none('failed');
  } catch (e) {
    console.error('[client-start-session] Konto nicht angelegt:', e instanceof Error ? e.message : e);
    return none('failed');
  }
}

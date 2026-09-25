import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hashCode, generateNumericCode, timingSafeEqual } from './tokens.ts';

/**
 * Anmeldecode im Konto: erzeugen, prüfen, gegen eine Sitzung tauschen.
 *
 * Gemeinsamer Kern der Headhunter-Anmeldung (recruiter-code.ts) und der
 * Kundenanmeldung (client-code.ts). Sechs Ziffern, eine Stunde gültig, fünf
 * Versuche; gespeichert wird nur der gepfefferte Hash in app_metadata unter dem
 * Schlüssel der jeweiligen Seite. Die Texte an den Menschen bleiben beim
 * Aufrufer: Headhunter werden geduzt, Kunden gesiezt.
 *
 * Supabase stellt nach der Prüfung nur die Sitzung aus: generateLink liefert
 * ein Einmal-Token, das der Server in derselben Sekunde gegen /auth/v1/verify
 * einlöst.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 60;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_PATTERN = /^\d{6}$/;
interface StoredCode { hash: string; expires_at: string; attempts: number }

export interface SessionDeps {
  fetch: typeof fetch;
  env: (key: string) => string | undefined;
}
export interface CodeSession { access_token: string; refresh_token: string; expires_in: number | null }

/** Neuen Code erzeugen und im Konto ablegen. Ein neuer Code ersetzt den alten: es gilt immer nur einer. */
export async function storeCode(db: SupabaseClient, userId: string, email: string, key: string): Promise<string | null> {
  const code = generateNumericCode(CODE_LENGTH);
  const stored: StoredCode = { hash: await hashCode(email, code), expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60000).toISOString(), attempts: 0 };
  const saved = await db.auth.admin.updateUserById(userId, { app_metadata: { [key]: stored } });
  if (saved.error) { console.error('[login-code] Code nicht gespeichert', saved.error.status ?? ''); return null; }
  return code;
}

/**
 * Was beim Einlösen schiefgehen kann, damit der Aufrufer es in seinen Worten sagt:
 *   wrong      falsch oder abgelaufen (auch: Konto unbekannt)
 *   exhausted  gerade der letzte erlaubte Versuch verbraucht
 *   unsaved    Code stimmte, ließ sich aber nicht entwerten (nochmal versuchen)
 *   failed     Code stimmte, aber Supabase hat keine Sitzung ausgestellt (neuer Code nötig)
 */
export type RedeemResult = { ok: true; session: CodeSession } | { ok: false; failure: 'wrong' | 'exhausted' | 'unsaved' | 'failed' };

export async function redeemCode(db: SupabaseClient, email: string, code: string, key: string, deps: SessionDeps): Promise<RedeemResult> {
  // Konto samt gespeichertem Code holen; das Einmal-Token wird gleich zur Sitzung.
  const link = await db.auth.admin.generateLink({ type: 'magiclink', email });
  const user = link.data?.user;
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !user || !tokenHash) return { ok: false, failure: 'wrong' };
  const stored = (user.app_metadata as Record<string, unknown> | undefined)?.[key] as StoredCode | undefined;
  const usable = !!stored && typeof stored.hash === 'string' && Date.parse(stored.expires_at) > Date.now() && stored.attempts < CODE_MAX_ATTEMPTS;
  if (!usable || !timingSafeEqual(stored.hash, await hashCode(email, code))) {
    // Fehlversuch zählen; ein abgelaufener oder verbrauchter Code wird entfernt.
    const attempts = usable ? stored.attempts + 1 : CODE_MAX_ATTEMPTS;
    const remaining = usable && attempts < CODE_MAX_ATTEMPTS;
    await db.auth.admin.updateUserById(user.id, { app_metadata: { [key]: remaining ? { ...stored, attempts } : null } });
    return { ok: false, failure: usable && !remaining ? 'exhausted' : 'wrong' };
  }
  const cleared = await db.auth.admin.updateUserById(user.id, { app_metadata: { [key]: null } });
  if (cleared.error) return { ok: false, failure: 'unsaved' };
  const url = deps.env('SUPABASE_URL');
  const anon = deps.env('SUPABASE_ANON_KEY');
  // Serverseitig, damit die Adresse bei Einladungen im Browser nie auftaucht.
  const res = await deps.fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anon!, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: tokenHash }),
    signal: AbortSignal.timeout(15000),
  });
  const session = res.ok ? await res.json().catch(() => null) : null;
  if (!session?.access_token || !session?.refresh_token) {
    console.error('[login-code] Sitzung nicht ausgestellt', res.status);
    return { ok: false, failure: 'failed' };
  }
  return { ok: true, session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in ?? null } };
}

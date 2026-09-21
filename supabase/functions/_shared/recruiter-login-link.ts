import type { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateToken, hashToken, timingSafeEqual } from './tokens.ts';

/**
 * Persönlicher Anmeldelink aus der Willkommensmail (Entscheidung 21.09.2026).
 *
 * Der Link meldet niemanden an. Er sagt der Anmeldeseite nur, wer kommt: Sie
 * begrüßt mit dem Vornamen und schickt den Code auf Knopfdruck an die Adresse
 * des Kontos. Hinein kommt weiterhin nur, wer den Code aus der Mail hat.
 *
 * Schlüssel = Konto-ID + 256 Zufallsbit. Gespeichert wird nur der Hash, in den
 * Admin-Metadaten des Kontos (keine Tabelle, keine Migration). 30 Tage gültig
 * und beliebig oft nutzbar. Die letzten drei Links gelten, damit nach einem
 * erneuten Versand auch die ältere Mail noch funktioniert.
 */
export const LOGIN_LINK_KEY = 'recruiter_login_link';
export const LOGIN_LINK_DAYS = 30;
const KEEP = 3;
const LINK_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;
interface StoredLink { hash: string; expires_at: string }

const storedLinks = (user: User | null | undefined): StoredLink[] => {
  const value = user?.app_metadata?.[LOGIN_LINK_KEY];
  return Array.isArray(value) ? value.filter((l): l is StoredLink => typeof l?.hash === 'string' && typeof l?.expires_at === 'string') : [];
};

export async function issueLoginLink(db: SupabaseClient, userId: string, now = Date.now()): Promise<string> {
  const secret = generateToken();
  const fresh: StoredLink = { hash: await hashToken(secret), expires_at: new Date(now + LOGIN_LINK_DAYS * 86_400_000).toISOString() };
  const { data } = await db.auth.admin.getUserById(userId);
  const kept = storedLinks(data?.user).filter(l => Date.parse(l.expires_at) > now).slice(0, KEEP - 1);
  const { error } = await db.auth.admin.updateUserById(userId, { app_metadata: { [LOGIN_LINK_KEY]: [fresh, ...kept] } });
  if (error) throw new Error(`Anmeldelink nicht gespeichert (${error.status ?? 'auth'})`);
  return `${userId}.${secret}`;
}

export type LoginLinkState = { status: 'open'; user: User } | { status: 'expired' | 'invalid' };

/** Passt der Schlüssel zum Konto, und gilt er noch? */
export async function checkLoginLink(db: SupabaseClient, link: unknown, now = Date.now()): Promise<LoginLinkState> {
  const m = typeof link === 'string' ? LINK_PATTERN.exec(link) : null;
  if (!m) return { status: 'invalid' };
  const { data, error } = await db.auth.admin.getUserById(m[1]);
  const user = data?.user;
  if (error || !user?.email) return { status: 'invalid' };
  const hash = await hashToken(m[2]);
  const match = storedLinks(user).find(l => timingSafeEqual(l.hash, hash));
  if (!match) return { status: 'invalid' };
  return Date.parse(match.expires_at) > now ? { status: 'open', user } : { status: 'expired' };
}

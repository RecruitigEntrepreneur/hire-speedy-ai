// deno-lint-ignore-file no-explicit-any
// Persönliche Unterschrifts-Links (Unterschrift über Matchunt, 23.10.2026).
// Je Unterzeichner ein Link; in der Datenbank liegt nur der Hash. Ein neuer Link
// widerruft den alten derselben Rolle. Ohne Abhängigkeit vom Vertragsablauf,
// damit contract-service und die öffentliche Function contract-sign ihn nutzen.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateToken, hashToken } from './tokens.ts';

export type SignerRole = 'company' | 'candidate';

export const LINK_DAYS = 14;
const DAY_MS = 86_400_000;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** DocuSign kennt den eingebetteten Unterzeichner an dieser Kennung (je Vertrag und Rolle). */
export const clientUserIdFor = (contractId: string, role: SignerRole) => `mh-${contractId}-${role}`;
export const recipientIdFor = (role: SignerRole) => (role === 'company' ? '1' : '2');

/** Neuer Link für eine Rolle; offene ältere derselben Rolle werden widerrufen. Liefert den Klartext einmal. */
export async function createSignLink(db: SupabaseClient, o: {
  contractId: string; envelopeId: string; role: SignerRole; name: string; email: string; createdBy: string | null; now: number;
}): Promise<{ id: string; token: string; expiresAt: string }> {
  const nowIso = new Date(o.now).toISOString();
  await db.from('employment_sign_links').update({ revoked_at: nowIso })
    .eq('contract_id', o.contractId).eq('signer_role', o.role).is('revoked_at', null).is('signed_at', null);
  const token = generateToken();
  const expiresAt = new Date(o.now + LINK_DAYS * DAY_MS).toISOString();
  const { data, error } = await db.from('employment_sign_links').insert({
    contract_id: o.contractId, envelope_id: o.envelopeId, signer_role: o.role, name: o.name.slice(0, 200), email: o.email.slice(0, 320),
    token_hash: await hashToken(token), expires_at: expiresAt, sent_at: nowIso, reminders_sent: 0, created_by: o.createdBy, created_at: nowIso,
  }).select('id').maybeSingle();
  if (error || !data) throw new Error(`Der Unterschrifts-Link konnte nicht angelegt werden${error ? `: ${error.message}` : ''}.`);
  return { id: (data as any).id, token, expiresAt };
}

export async function linkByToken(db: SupabaseClient, token: unknown): Promise<any | null> {
  if (typeof token !== 'string' || !TOKEN.test(token)) return null;
  const { data } = await db.from('employment_sign_links').select('*').eq('token_hash', await hashToken(token)).maybeSingle();
  return data ?? null;
}

/** Alle Links eines Vertrags, neueste zuerst. */
export async function linksOf(db: SupabaseClient, contractId: string): Promise<any[]> {
  const { data } = await db.from('employment_sign_links').select('*').eq('contract_id', contractId).order('created_at', { ascending: false });
  return (data ?? []) as any[];
}

/** Neuester Link einer Rolle (auch widerrufen), für die Anzeige „verschickt · geöffnet“. */
export const latestLink = (links: any[], role: SignerRole) => links.find((l) => l.signer_role === role) ?? null;

/** Alle offenen Links des Vertrags widerrufen (Umschlag zurückgezogen, abgelehnt, abgesprungen). */
export async function revokeLinks(db: SupabaseClient, contractId: string, now: number) {
  await db.from('employment_sign_links').update({ revoked_at: new Date(now).toISOString() })
    .eq('contract_id', contractId).is('revoked_at', null).is('signed_at', null);
}

export async function markLinkSigned(db: SupabaseClient, contractId: string, role: SignerRole, at: string) {
  await db.from('employment_sign_links').update({ signed_at: at })
    .eq('contract_id', contractId).eq('signer_role', role).is('revoked_at', null).is('signed_at', null);
}

export async function markLinkOpened(db: SupabaseClient, link: any, now: number) {
  const nowIso = new Date(now).toISOString();
  await db.from('employment_sign_links').update({ opened_at: link.opened_at ?? nowIso, last_opened_at: nowIso }).eq('id', link.id);
}

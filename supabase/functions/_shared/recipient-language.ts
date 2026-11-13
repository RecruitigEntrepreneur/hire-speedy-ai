import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normLang, type Lang } from './i18n.ts';

/**
 * Sprache eines Empfängers für Mails und Benachrichtigungen (Mehrsprachigkeit, 13.11.2026).
 *
 * Regel:
 * - Wer ein Konto hat (Headhunter, Kunde, Kollege des Kunden): die Sprache aus seinem Profil.
 * - Kandidaten haben kein Konto: sie bekommen die Sprache ihres Headhunters (er spricht
 *   Kandidaten in seinem Markt an).
 * - Kontakte des Kunden ohne Konto: Profil, falls die Adresse eines hat, sonst das Land
 *   der Firma, sonst Deutsch.
 * - Ohne jede Angabe: Deutsch, so wie die Plattform bisher schreibt.
 *
 * Die Spalte profiles.language kommt aus der Migration 20261112120000_mehrsprachigkeit.sql.
 * Fehlt sie noch, liefert alles hier null bzw. 'de'. Wirft nie.
 */

const quiet = (where: string, e: unknown) =>
  console.warn(`[recipient-language] ${where} ausgelassen`, e instanceof Error ? e.message : (e as { code?: string })?.code ?? '');

/** Land (ISO-Kürzel oder Name) → Sprache. DACH ist Deutsch. */
export function languageOfCountry(country: string | null | undefined): Lang | null {
  switch ((country ?? '').trim().toUpperCase()) {
    case 'SE': case 'SWE': case 'SWEDEN': case 'SCHWEDEN': case 'SVERIGE': return 'sv';
    case 'NO': case 'NOR': case 'NORWAY': case 'NORWEGEN': case 'NORGE': return 'nb';
    case 'AT': case 'AUT': case 'AUSTRIA': case 'ÖSTERREICH': return 'de-AT';
    case 'CH': case 'CHE': case 'SWITZERLAND': case 'SCHWEIZ': return 'de-CH';
    case 'DE': case 'DEU': case 'GERMANY': case 'DEUTSCHLAND': return 'de';
    default: return null;
  }
}

/** Sprache aus dem Profil eines Kontos. */
export async function languageOfUser(db: SupabaseClient, userId: string | null | undefined): Promise<Lang | null> {
  if (!userId) return null;
  try {
    const { data, error } = await db.from('profiles').select('language').eq('user_id', userId).maybeSingle();
    if (error) { quiet('Profil', error); return null; }
    return normLang((data as { language?: unknown } | null)?.language);
  } catch (e) { quiet('Profil', e); return null; }
}

/** Sprache aus dem Profil zu einer Mailadresse (z. B. Kollegen des Kunden). */
export async function languageOfEmail(db: SupabaseClient, email: string | null | undefined): Promise<Lang | null> {
  const address = (email ?? '').trim().toLowerCase();
  if (!address) return null;
  try {
    const { data, error } = await db.from('profiles').select('language').ilike('email', address).limit(1).maybeSingle();
    if (error) { quiet('Profil per Mail', error); return null; }
    return normLang((data as { language?: unknown } | null)?.language);
  } catch (e) { quiet('Profil per Mail', e); return null; }
}

/** Headhunter: Profil, sonst Deutsch. */
export async function recruiterLanguage(db: SupabaseClient, recruiterId: string | null | undefined): Promise<Lang> {
  return (await languageOfUser(db, recruiterId)) ?? 'de';
}

/** Kandidat: Sprache seines Headhunters. */
export async function candidateLanguage(db: SupabaseClient, recruiterId: string | null | undefined): Promise<Lang> {
  return recruiterLanguage(db, recruiterId);
}

/**
 * Kunde: Profil des Empfängers (per Konto oder Mail), sonst Land der Firma, sonst Deutsch.
 * `country` gibt der Aufrufer mit, wenn er die Firma schon geladen hat.
 */
export async function clientLanguage(
  db: SupabaseClient,
  who: { userId?: string | null; email?: string | null; country?: string | null },
): Promise<Lang> {
  return (await languageOfUser(db, who.userId))
    ?? (await languageOfEmail(db, who.email))
    ?? languageOfCountry(who.country)
    ?? 'de';
}

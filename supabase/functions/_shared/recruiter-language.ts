import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normLang, type Lang } from './i18n.ts';
import type { LimitResult, LimitRule } from './intake-limits.ts';
import { isMissingRelation } from './http.ts';
import { must, dbError, patchCase, type OnboardingCase } from './recruiter-onboarding-service.ts';

/**
 * Sprache und öffentlicher Link im Headhunter-Einstieg (Mehrsprachigkeit, 12.11.2026).
 *
 * Alles hier liest und schreibt Spalten aus der Migration
 * 20261112120000_mehrsprachigkeit.sql. Lovable führt Migrationen erst später
 * aus. Deshalb gilt für jede Funktion, die der Einstieg selbst aufruft: Fehlt
 * die Spalte oder die Tabelle, bleibt der Hauptablauf heil. Lesen liefert dann
 * null, Schreiben wird ausgelassen und nur protokolliert.
 */

const quiet = (where: string, e: unknown) =>
  console.warn(`[recruiter-language] ${where} ausgelassen`, e instanceof Error ? e.message : (e as { code?: string })?.code ?? '');

/** Sprache am Vorgang. Vor der Migration gibt es die Spalte nicht: dann null. */
export const caseLanguage = (c: unknown): Lang | null => normLang((c as { language?: unknown } | null | undefined)?.language);

/**
 * Die Person hat im Menü eine Sprache gewählt: am Vorgang merken. Jede Änderung
 * am Vorgang zählt die Revision hoch (Wächter recruiter_onboarding_guard), also
 * nur schreiben, wenn sich etwas ändert. Wirft nie.
 */
export async function setCaseLanguage(db: SupabaseClient, c: OnboardingCase, lang: Lang | null): Promise<OnboardingCase> {
  if (!lang || caseLanguage(c) === lang) return c;
  try { return await patchCase(db, c, { language: lang }); }
  catch (e) { quiet('Sprache am Vorgang', e); return c; }
}

/** Sprache am Profil der Person, für Oberfläche und spätere Mails. Wirft nie. */
export async function rememberProfileLanguage(db: SupabaseClient, userId: string | null | undefined, lang: Lang | null, opts: { onlyIfEmpty?: boolean } = {}) {
  if (!userId || !lang) return;
  try {
    let q = db.from('profiles').update({ language: lang }).eq('user_id', userId);
    if (opts.onlyIfEmpty) q = q.is('language', null);
    const { error } = await q;
    if (error) quiet('Sprache am Profil', error);
  } catch (e) { quiet('Sprache am Profil', e); }
}

/**
 * Bekannte Sprache zu einer Adresse, wenn der Aufruf selbst keine nennt
 * (Anmeldeseite, „Code erneut senden“): erst das Profil, dann der jüngste
 * Vorgang. Wirft nie; ohne Migration null, also Deutsch wie bisher.
 */
export async function storedLanguage(db: SupabaseClient, email: string): Promise<Lang | null> {
  try {
    const { data, error } = await db.from('profiles').select('language').eq('email', email).limit(1).maybeSingle();
    const found = error ? null : normLang((data as { language?: unknown } | null)?.language);
    if (found) return found;
  } catch { /* Spalte fehlt noch */ }
  try {
    const { data, error } = await db.from('recruiter_onboarding_cases').select('language').eq('email', email)
      .is('revoked_at', null).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return error ? null : normLang((data as { language?: unknown } | null)?.language);
  } catch { return null; }
}

// ── Öffentlicher Headhunter-Link mit Kennung ────────────────────────────────

export const LINK_KEY_PATTERN = /^[a-z0-9-]{3,40}$/;
/** Kennung aus dem Link, wie sie gespeichert ist; alles andere null. */
export function cleanLinkKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  return LINK_KEY_PATTERN.test(key) ? key : null;
}

export interface PublicLink {
  id: string; key: string; label: string; language: string | null; expires_at: string | null;
  revoked_at: string | null; opened_count: number; created_at: string;
}
const LINK_COLUMNS = 'id,key,label,language,expires_at,revoked_at,opened_count,created_at';
export const linkUsable = (l: Pick<PublicLink, 'expires_at' | 'revoked_at'>, now = Date.now()) =>
  !l.revoked_at && (!l.expires_at || Date.parse(l.expires_at) > now);

/** Gültiger Link zur Kennung, sonst null (unbekannt, abgelaufen, zurückgezogen, Tabelle fehlt). Wirft nie. */
export async function usableLink(db: SupabaseClient, via: unknown, now = Date.now()): Promise<PublicLink | null> {
  const key = cleanLinkKey(via);
  if (!key) return null;
  try {
    const { data, error } = await db.from('recruiter_public_links').select(LINK_COLUMNS).eq('key', key).maybeSingle();
    if (error || !data) return null;
    return linkUsable(data as PublicLink, now) ? data as PublicLink : null;
  } catch { return null; }
}

/** Was am neuen Vorgang gespeichert wird: Kennung nur, wenn der Link gilt. */
export async function sourceKey(db: SupabaseClient, via: unknown): Promise<string | null> {
  return (await usableLink(db, via))?.key ?? null;
}

type Limits = (db: SupabaseClient, rules: LimitRule[]) => Promise<LimitResult>;

/**
 * Aktion `link` (ohne Sitzung): Gilt die Kennung, und in welcher Sprache
 * begrüßt die Seite? Zählt einen Aufruf. Unbekannt, abgelaufen oder
 * zurückgezogen ist kein Fehler. Wer die Grenze reißt, bekommt weiter die
 * Antwort, wird aber nicht mehr gezählt.
 */
export async function openPublicLink(db: SupabaseClient, via: unknown, ip: string | null, limits: Limits, rules: (ip: string | null, key: string) => LimitRule[]) {
  const none = { valid: false, language: null as Lang | null };
  const key = cleanLinkKey(via);
  if (!key) return none;
  const limit = await limits(db, rules(ip, key)).catch(() => ({ allowed: true } as LimitResult));
  if (!limit.allowed) {
    const link = await usableLink(db, key);
    return link ? { valid: true, language: normLang(link.language) } : none;
  }
  try {
    // Zählen und Prüfen in einer Anweisung (Funktion aus der Migration).
    const { data, error } = await db.rpc('recruiter_public_link_open', { _key: key });
    if (error) { quiet('Aufruf zählen', error); return none; }
    const row = (Array.isArray(data) ? data[0] : data) as { link_language?: unknown } | null | undefined;
    return row ? { valid: true, language: normLang(row.link_language) } : none;
  } catch (e) { quiet('Aufruf zählen', e); return none; }
}

// ── Admin: Links verwalten (recruiter-onboarding-admin) ─────────────────────

/** Eingaben für `link-create` prüfen. Reine Logik, damit sie sich testen lässt. */
export function cleanLinkInput(body: { label?: unknown; key?: unknown; language?: unknown; expires_at?: unknown }, now = Date.now()) {
  const label = String(body.label ?? '').trim().replace(/\s+/g, ' ').slice(0, 120);
  must(label.length >= 2, 'Bitte einen Namen für den Link angeben.');
  must(typeof body.key === 'string' && LINK_KEY_PATTERN.test(body.key), 'Die Kennung braucht 3 bis 40 Zeichen: nur Kleinbuchstaben, Ziffern und Bindestrich.');
  // null oder leer = „Automatisch“: der Browser entscheidet.
  let language: Lang | null = null;
  if (body.language !== null && body.language !== undefined && body.language !== '') {
    language = normLang(body.language);
    must(language, 'Diese Sprache gibt es nicht.');
  }
  let expires_at: string | null = null;
  if (body.expires_at !== null && body.expires_at !== undefined && body.expires_at !== '') {
    // Nur ein Datum (Datumsfeld im Admin): Der Link gilt bis zum Ende dieses Tages
    // (23:59:59 MEZ; in der Sommerzeit eine Stunde länger).
    const raw = typeof body.expires_at === 'string' ? body.expires_at.trim() : '';
    const time = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? Date.parse(`${raw}T22:59:59Z`) : raw ? Date.parse(raw) : NaN;
    must(Number.isFinite(time), 'Das Ablaufdatum ist ungültig.');
    must(time > now, 'Das Ablaufdatum muss in der Zukunft liegen.');
    expires_at = new Date(time).toISOString();
  }
  return { label, key: body.key as string, language, expires_at };
}

export async function createLink(db: SupabaseClient, adminId: string | undefined, body: Parameters<typeof cleanLinkInput>[0]) {
  const input = cleanLinkInput(body);
  const { data, error } = await db.from('recruiter_public_links').insert({ ...input, created_by: adminId ?? null }).select(LINK_COLUMNS).single();
  must(error?.code !== '23505', 'Diese Kennung gibt es schon. Bitte eine andere wählen.', 'conflict');
  dbError(error);
  return { link: { ...(data as PublicLink), started_count: 0, signed_count: 0 } };
}

export async function revokeLink(db: SupabaseClient, id: unknown) {
  must(typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id), 'Ungültiger Link.');
  const { data, error } = await db.from('recruiter_public_links').update({ revoked_at: new Date().toISOString() })
    .eq('id', id).is('revoked_at', null).select('id').maybeSingle();
  dbError(error);
  if (!data) {
    const { data: known, error: readError } = await db.from('recruiter_public_links').select('id').eq('id', id).maybeSingle();
    dbError(readError); must(known, 'Link nicht gefunden.', 'not_found');
  }
  return { ok: true };
}

/** Zählt je Kennung: begonnene Vorgänge und solche mit Unterschrift des Headhunters. */
export function linkCounts(cases: { id: string; source_key: string | null }[], signedCaseIds: Set<string>) {
  const counts: Record<string, { started: number; signed: number }> = {};
  for (const c of cases) {
    if (!c.source_key) continue;
    const row = counts[c.source_key] ??= { started: 0, signed: 0 };
    row.started += 1;
    if (signedCaseIds.has(c.id)) row.signed += 1;
  }
  return counts;
}

export async function listLinks(db: SupabaseClient) {
  const { data: links, error } = await db.from('recruiter_public_links').select(LINK_COLUMNS).order('created_at', { ascending: false }).limit(500);
  // Migration noch nicht angewandt: leere Liste statt Fehler, mit Kennzeichen für die Admin-Seite.
  if (error && (isMissingRelation(error) || error.code === '42703')) return { links: [], pending_migration: true };
  dbError(error);
  const { data: cases, error: caseError } = await db.from('recruiter_onboarding_cases').select('id,source_key').not('source_key', 'is', null).limit(10000);
  if (caseError && (isMissingRelation(caseError) || caseError.code === '42703')) return { links: [], pending_migration: true };
  dbError(caseError);
  const ids = (cases ?? []).map(c => c.id as string);
  const signed = new Set<string>();
  // In Blöcken, damit die Abfrage auch bei vielen Vorgängen kurz bleibt.
  for (let i = 0; i < ids.length; i += 200) {
    const { data: rows, error: signError } = await db.from('recruiter_contract_envelopes').select('case_id')
      .in('case_id', ids.slice(i, i + 200)).not('recruiter_signed_at', 'is', null);
    dbError(signError);
    for (const r of rows ?? []) signed.add(r.case_id as string);
  }
  const counts = linkCounts((cases ?? []) as { id: string; source_key: string | null }[], signed);
  return { links: ((links ?? []) as PublicLink[]).map(l => ({ ...l, started_count: counts[l.key]?.started ?? 0, signed_count: counts[l.key]?.signed ?? 0 })) };
}

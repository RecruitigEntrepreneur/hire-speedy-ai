import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { normLang, type Lang } from './i18n.ts';
import { localizeIntakeMessage } from './intake-i18n.ts';

/**
 * Sprache in der Kunden-Aufnahme (Mehrsprachigkeit, 12.11.2026).
 *
 * Die Sprache hängt am Link (intake_links.language: in ihr begrüßt die Seite;
 * NULL = automatisch) und am Entwurf (intake_drafts.language: was der Kunde im
 * Menü gewählt hat). In der Sprache des Entwurfs gehen die Mails an den Kunden
 * raus, in der Sprache des Aufrufs die Servermeldungen.
 *
 * Beide Spalten kommen aus der Migration 20261112120000_mehrsprachigkeit.sql.
 * Lovable führt Migrationen erst später aus. Deshalb gilt hier überall: Fehlt
 * die Spalte, bleibt der Hauptablauf heil. Lesen liefert null, Schreiben wird
 * ausgelassen oder ohne die Spalte wiederholt.
 */

type Row = Record<string, unknown>;
type DbError = { code?: string; message?: string } | null | undefined;

const quiet = (where: string, e: unknown) =>
  console.warn(`[intake-language] ${where} ausgelassen`, e instanceof Error ? e.message : (e as { code?: string })?.code ?? '');

/** `lang` aus dem Body eines Aufrufs; Unbekanntes zählt als keine Angabe. */
export const callLanguage = (body: unknown): Lang | null => normLang((body as { lang?: unknown } | null | undefined)?.lang);

/** Sprache an einer Zeile (Link, Entwurf, Profil). Vor der Migration gibt es die Spalte nicht: dann null. */
export const rowLanguage = (row: unknown): Lang | null => normLang((row as { language?: unknown } | null | undefined)?.language);

/** Die Spalte `language` gibt es noch nicht (Lesen: 42703, Schreiben über PostgREST: PGRST204). */
export const isMissingLanguageColumn = (error: DbError): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST204') && /language/i.test(error.message ?? '');

/**
 * Abfrage erst mit, bei fehlender Spalte noch einmal ohne `language`.
 * `run(true)` nimmt die Spalte mit, `run(false)` lässt sie weg.
 */
export async function withLanguageColumn<T extends { error: DbError }>(run: (withLanguage: boolean) => PromiseLike<T>): Promise<T & { languageSkipped?: boolean }> {
  const first = await run(true);
  if (!isMissingLanguageColumn(first.error)) return first;
  quiet('Spalte language', first.error);
  return { ...(await run(false)), languageSkipped: true };
}

/**
 * Sprache für `create` und `update` eines Links: einer der sechs Codes, oder
 * leer/null = automatisch. Unbekanntes ist ein Fehler, damit kein Link still
 * in der falschen Sprache begrüßt.
 */
export function parseLinkLanguage(value: unknown): { ok: true; language: Lang | null } | { ok: false } {
  if (value === null || value === undefined || value === '') return { ok: true, language: null };
  const language = normLang(value);
  return language ? { ok: true, language } : { ok: false };
}

/** Sprache des Links zu einem Entwurf. Wirft nie; ohne Link oder ohne Migration null. */
export async function linkLanguageById(db: SupabaseClient, linkId: unknown): Promise<Lang | null> {
  if (typeof linkId !== 'string' || !linkId) return null;
  try {
    const { data, error } = await db.from('intake_links').select('language').eq('id', linkId).maybeSingle();
    return error ? null : rowLanguage(data);
  } catch { return null; }
}

/**
 * Der Kunde hat im Menü eine Sprache gewählt (jeder Aufruf trägt sie mit): am
 * Entwurf merken, aber nur schreiben, wenn sich der Wert ändert. Die Zeile im
 * Speicher trägt die Sprache in jedem Fall, damit Antwort und Mails dieses
 * Aufrufs schon stimmen. Wirft nie.
 */
export async function rememberDraftLanguage(db: SupabaseClient, draft: Row | null | undefined, lang: Lang | null): Promise<void> {
  if (!draft?.id || !lang || rowLanguage(draft) === lang) return;
  draft.language = lang;
  try {
    const { error } = await db.from('intake_drafts').update({ language: lang }).eq('id', draft.id as string);
    if (error) quiet('Sprache am Entwurf', error);
  } catch (e) { quiet('Sprache am Entwurf', e); }
}

/**
 * In welcher Sprache eine Mail an den Kunden rausgeht: Entwurf, sonst Link,
 * sonst Sprache des Aufrufs, sonst null (Deutsch wie bisher). Der Link wird nur
 * gelesen, wenn der Entwurf keine Sprache trägt.
 */
export async function customerMailLanguage(db: SupabaseClient, draft: Row | null | undefined, callLang: Lang | null = null, link?: Row | null): Promise<Lang | null> {
  return rowLanguage(draft)
    ?? (link ? rowLanguage(link) : await linkLanguageById(db, draft?.link_id))
    ?? callLang;
}

/** Sprache am Profil eines Kontos. Wirft nie; ohne Migration null. */
export async function profileLanguage(db: SupabaseClient, userId: string | null | undefined): Promise<Lang | null> {
  if (!userId) return null;
  try {
    const { data, error } = await db.from('profiles').select('language').eq('user_id', userId).limit(1).maybeSingle();
    return error ? null : rowLanguage(data);
  } catch { return null; }
}

/** Sprache der Aufnahme ans Profil des neuen Kundenkontos, wenn dort noch keine steht. Wirft nie. */
export async function seedProfileLanguage(db: SupabaseClient, userId: string | null | undefined, lang: Lang | null): Promise<void> {
  if (!userId || !lang) return;
  try {
    const { error } = await db.from('profiles').update({ language: lang }).eq('user_id', userId).is('language', null);
    if (error) quiet('Sprache am Profil', error);
  } catch (e) { quiet('Sprache am Profil', e); }
}

// ── Servermeldungen an einer Stelle übersetzen ──────────────────────────────

/** Felder einer Antwort, die Text für den Menschen tragen. */
function localizeBody(lang: Lang, body: Row): Row {
  const out: Row = { ...body };
  for (const key of ['message', 'notice'] as const) {
    if (typeof out[key] === 'string') out[key] = localizeIntakeMessage(lang, out[key] as string);
  }
  // intake-submit: „Es fehlen noch Angaben“ nennt die fehlenden Angaben einzeln.
  if (Array.isArray(out.missing)) out.missing = out.missing.map(m => typeof m === 'string' ? localizeIntakeMessage(lang, m) : m);
  return out;
}

/**
 * Hüllt den Handler einer Function ein und übersetzt ihre Meldungen in die
 * Sprache des Aufrufs (`lang` im Body). Die Function selbst meldet weiter im
 * deutschen Wortlaut; übersetzt wird hier, an einer Stelle.
 *
 * Fehlerantworten (Status ab 400) werden immer angesehen. Antworten mit Status
 * 200 nur mit `success: true`: dort, wo auch eine gelungene Antwort Text trägt
 * (intake-resume, intake-forward, intake-packages). Ohne `lang`, bei Deutsch
 * ohne Schweizer Schreibweise und bei allem, was kein JSON ist, bleibt die
 * Antwort unberührt. Eine Meldung ohne Übersetzung geht deutsch raus.
 */
export function withIntakeLang(handler: (req: Request) => Promise<Response> | Response, opts: { success?: boolean } = {}) {
  return async (req: Request): Promise<Response> => {
    let lang: Lang | null = null;
    if (req.method === 'POST') {
      try { lang = callLanguage(await req.clone().json()); } catch { /* kein JSON: keine Sprache */ }
    }
    const res = await handler(req);
    if (!lang || lang === 'de' || lang === 'de-AT') return res;
    if (res.status < 400 && !opts.success) return res;
    if (!(res.headers.get('Content-Type') ?? '').includes('application/json')) return res;
    try {
      const body = await res.clone().json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) return res;
      return new Response(JSON.stringify(localizeBody(lang, body as Row)), { status: res.status, headers: res.headers });
    } catch { return res; }
  };
}

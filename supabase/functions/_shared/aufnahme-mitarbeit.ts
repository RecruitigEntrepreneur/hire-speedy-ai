import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sha256Hex } from './tokens.ts';
import { kuerzel, opSchluessel, WER_PFAD, type Op } from './aufnahme-ops.ts';
import type { DraftRow } from './intake-core.ts';

/**
 * Mitarbeit an einer Kunden-Aufnahme (26.11.2026).
 *
 * Zwei Rollen je Zugang (intake_draft_tokens.rolle):
 *  - 'voll': wer die Aufnahme begonnen hat (oder der Entscheider, an den am Ende
 *    weitergeleitet wurde). Darf alles.
 *  - 'beschreiben': die eingeladene Kollegin. Beschreibt die Stelle, mehr nicht:
 *    kein Kontakt, kein Paket, keine Anfrage, kein Vertrag. Ihre Bestätigung steht
 *    an ihrem Zugang und ändert den Ansprechpartner nicht.
 *
 * `live` ist der Name des Echtzeit-Kanals, über den sich die Beteiligten sehen
 * („wer ist wo“, „hat sich geändert“). Über ihn laufen nie Inhalte; die holt sich
 * jeder über seinen eigenen Zugang.
 */

export type Rolle = 'voll' | 'beschreiben';
type Token = Record<string, any> | null | undefined;

export const rolleVon = (token: Token): Rolle => (token?.rolle === 'beschreiben' ? 'beschreiben' : 'voll');

export const liveSchluessel = async (draftId: string): Promise<string> =>
  (await sha256Hex(`${Deno.env.get('INTAKE_TOKEN_PEPPER') ?? ''}:live:${draftId}`)).slice(0, 32);

export interface Ich {
  rolle: Rolle;
  name: string | null;
  email: string | null;
  kuerzel: string;
  bestaetigt: boolean;
  zurueckgegeben: boolean;
}

export function ichVon(draft: DraftRow, token: Token): Ich {
  if (rolleVon(token) === 'beschreiben') {
    const name = token?.recipient_name || token?.recipient_email || null;
    return {
      rolle: 'beschreiben', name, email: token?.recipient_email ?? null, kuerzel: kuerzel(name),
      bestaetigt: Boolean(token?.bestaetigt_am), zurueckgegeben: Boolean(token?.zurueckgegeben_am),
    };
  }
  const name = draft.contact_name || draft.contact_email || null;
  return {
    rolle: 'voll', name, email: draft.contact_email ?? null, kuerzel: kuerzel(name),
    bestaetigt: draft.identity_state === 'email_verified', zurueckgegeben: false,
  };
}

/** Was die Seite über die Mitarbeit wissen muss: wer ich bin, wen ich eingeladen habe, der Kanal. */
export async function mitarbeitInfo(supabase: SupabaseClient, draft: DraftRow, token: Token) {
  const ich = ichVon(draft, token);
  let helfer: Record<string, unknown>[] = [];
  if (ich.rolle === 'voll') {
    const { data } = await supabase
      .from('intake_draft_tokens')
      .select('id, recipient_email, recipient_name, created_at, bestaetigt_am, zurueckgegeben_am, last_used_at')
      .eq('draft_id', draft.id)
      .eq('rolle', 'beschreiben')
      .is('revoked_at', null)
      .order('created_at', { ascending: true });
    helfer = (data ?? []).map((t) => ({
      id: t.id,
      name: t.recipient_name || t.recipient_email,
      email: t.recipient_email,
      kuerzel: kuerzel(t.recipient_name || t.recipient_email),
      eingeladen_am: t.created_at,
      bestaetigt: Boolean(t.bestaetigt_am),
      zurueckgegeben_am: t.zurueckgegeben_am ?? null,
      zuletzt: t.last_used_at ?? null,
    }));
  }
  return {
    ich,
    helfer,
    einladender: ich.rolle === 'beschreiben' ? { name: draft.contact_name || draft.contact_email || null, kuerzel: kuerzel(draft.contact_name || draft.contact_email) } : null,
    live: await liveSchluessel(draft.id),
  };
}

/** Vermerkt je geänderter Antwort, wer sie zuletzt geändert hat (dyn.wer). */
export function werEintragen(dyn: unknown, ops: Op[], ich: Ich): Record<string, unknown> {
  const basis = (dyn && typeof dyn === 'object' && !Array.isArray(dyn) ? { ...(dyn as Record<string, unknown>) } : {}) as Record<string, unknown>;
  const wer = { ...((basis[WER_PFAD] as Record<string, unknown>) ?? {}) };
  const am = new Date().toISOString();
  for (const op of ops) wer[opSchluessel(op)] = { k: ich.kuerzel, n: ich.name, am };
  basis[WER_PFAD] = wer;
  return basis;
}

/** Prüft, ob eine Liste von Änderungen aus dem Browser gültig aussieht. */
export function opsAusBody(raw: unknown): Op[] | null {
  if (!Array.isArray(raw)) return null;
  const ok: Op[] = [];
  for (const o of raw.slice(0, 500)) {
    if (!o || typeof o !== 'object') continue;
    const feld = (o as Op).feld;
    const pfad = (o as Op).pfad;
    if (!['built', 'answers', 'dyn', 'freelance', 'flexibility'].includes(feld)) continue;
    if (!Array.isArray(pfad) || pfad.length > 12 || !pfad.every((p) => typeof p === 'string' && p.length <= 120)) continue;
    // dyn.wer schreibt nur der Server.
    if (feld === 'dyn' && pfad[0] === WER_PFAD) continue;
    ok.push((o as Op).weg ? { feld, pfad, weg: true } : { feld, pfad, wert: (o as Op).wert });
  }
  return ok;
}

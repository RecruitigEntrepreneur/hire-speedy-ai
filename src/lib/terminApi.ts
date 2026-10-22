import { supabase } from '@/integrations/supabase/client';
import type { InterviewHoursRules } from '@/lib/interviewScheduling';
import type { AnonymFund } from '../../supabase/functions/_shared/linkedin-anonym';
import type { Steckbrief } from '../../supabase/functions/_shared/termin-seite';

/**
 * Anbindung der Terminseite und des LinkedIn-Beitrags (21.10.2026):
 * Functions termin-seite (öffentlich) und linkedin (angemeldet), dazu die
 * Einstellungen der Terminseite (Tabelle recruiter_booking_pages, eigene Zeile).
 */

/** Fehler einer Function mit Grund und Zusatz (z. B. feld, tage, funde). */
export class FunktionsFehler extends Error {
  constructor(message: string, public grund: string | null, public extra: Record<string, unknown>) { super(message); }
}

async function rufe<T>(name: string, body: Record<string, unknown>, fallback = 'Das hat gerade nicht geklappt. Versuch es gleich noch einmal.'): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    const detail = ctx instanceof Response ? await ctx.clone().json().catch(() => null) : null;
    const { error: grund, message, ...extra } = (detail ?? {}) as { error?: string; message?: string } & Record<string, unknown>;
    throw new FunktionsFehler(typeof message === 'string' ? message : fallback, typeof grund === 'string' ? grund : null, extra);
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Öffentliche Terminseite
// ---------------------------------------------------------------------------
export type Gespraechsart = 'teams' | 'phone';
export interface HeadhunterOeffentlich { name: string; initialen: string; titel: string | null; linkedin: string | null }
export interface TerminTag { tag: string; zeiten: string[] }
export interface SeitenDaten {
  headhunter: HeadhunterOeffentlich; stelle: Steckbrief | null; stelle_gefunden: boolean; offen: boolean; pausiert: boolean;
  kalender: boolean; dauer: number; arten: Gespraechsart[]; tage: TerminTag[];
}
export interface BuchungsDaten {
  start: string; mode: Gespraechsart; first_name: string; last_name: string; email: string; phone?: string; linkedin_url?: string;
  note?: string; consent: boolean; upload_id?: string | null; website?: string;
}
export interface TerminAnsicht {
  status: 'booked' | 'cancelled' | 'vorbei'; start: string; ende: string; mode: Gespraechsart; join_url: string | null; vorname: string;
  headhunter: HeadhunterOeffentlich; stelle: string | null; dauer: number; tage: TerminTag[];
}

export const terminSeiteApi = {
  seite: (slug: string, stelle?: string) => rufe<SeitenDaten>('termin-seite', { action: 'seite', slug, stelle }),
  lebenslauf: (slug: string, datei: { name: string; typ: string; base64: string | null; text?: string }) =>
    rufe<{ upload_id: string; gelesen: boolean; felder: { first_name: string; last_name: string; email: string; phone: string; linkedin_url: string } }>(
      'termin-seite', { action: 'lebenslauf', slug, name: datei.name, typ: datei.typ, datei: datei.base64, text: datei.text }, 'Der Lebenslauf konnte nicht gelesen werden. Du kannst trotzdem buchen.'),
  buchen: (slug: string, stelle: string | undefined, d: BuchungsDaten) =>
    rufe<{ ok: true; termin: { start: string; ende: string; mode: Gespraechsart; join_url: string | null; headhunter: string } | null; verwalten_url?: string }>(
      'termin-seite', { action: 'buchen', slug, stelle, ...d }),
  termin: (token: string) => rufe<TerminAnsicht>('termin-seite', { action: 'termin', token }),
  verschieben: (token: string, start: string) => rufe<{ ok: true; start: string; join_url: string | null }>('termin-seite', { action: 'verschieben', token, start }),
  absagen: (token: string, grund: string) => rufe<{ ok: true }>('termin-seite', { action: 'absagen', token, grund }),
};

// ---------------------------------------------------------------------------
// LinkedIn
// ---------------------------------------------------------------------------
export interface LinkedinStatus { eingerichtet: boolean; verbunden: boolean; abgelaufen: boolean; name: string | null; bild: string | null; gueltig_bis: string | null }
export interface PostenDaten { job_id: string; text: string; bild: string; vorlage: string; format: string; sichtbarkeit: 'PUBLIC' | 'CONNECTIONS'; gehalt: boolean }

export const linkedinApi = {
  status: () => rufe<LinkedinStatus>('linkedin', { action: 'status' }),
  start: (return_to: string) => rufe<{ url: string }>('linkedin', { action: 'start', return_to }),
  trennen: () => rufe<{ ok: true }>('linkedin', { action: 'trennen' }),
  posten: (d: PostenDaten) => rufe<{ ok: true; post_id: string; urn: string; url: string; gepostet: string }>('linkedin', { action: 'posten', ...d }),
  loeschen: (post_id: string) => rufe<{ ok: true }>('linkedin', { action: 'loeschen', post_id }),
};
export type { AnonymFund };

// ---------------------------------------------------------------------------
// Einstellungen der Terminseite (eigene Zeile, RLS)
// ---------------------------------------------------------------------------
export interface TerminseiteZeile {
  recruiter_id: string; slug: string; active: boolean; rules: InterviewHoursRules | Record<string, never>;
  duration_minutes: number; allow_teams: boolean; allow_phone: boolean;
}

const tabelle = () => (supabase as unknown as { from: (t: string) => any }).from('recruiter_booking_pages'); // eslint-disable-line @typescript-eslint/no-explicit-any

export async function meineTerminseite(userId: string): Promise<TerminseiteZeile | null> {
  const { data, error } = await tabelle().select('*').eq('recruiter_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as TerminseiteZeile | null) ?? null;
}

export async function speichereTerminseite(zeile: TerminseiteZeile): Promise<void> {
  const { error } = await tabelle().upsert({ ...zeile, updated_at: new Date().toISOString() }, { onConflict: 'recruiter_id' });
  if (error) throw new Error(error.code === '23505' ? 'Diese Adresse ist schon vergeben.' : error.message);
}

export async function slugFrei(slug: string): Promise<boolean> {
  const { data } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: boolean | null }>)('booking_slug_free', { p_slug: slug });
  return data !== false;
}

/** „Marko Benko“ → „marko-benko“ (ohne Umlaute, ohne reservierte Wörter). */
export function slugVorschlag(name: string): string {
  const s = name.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return s.length >= 3 && s !== 'termin' ? s : `headhunter-${Math.random().toString(36).slice(2, 7)}`;
}

export const SLUG_MUSTER = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const TERMINSEITE_BASIS = 'https://matchunt.ai/t/';

export interface BeitragsStand { posted_at: string; status: 'posted' | 'manual'; post_urn: string | null; bookings: number }
export async function beitragsStand(jobId: string): Promise<BeitragsStand | null> {
  const { data } = await (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<{ data: BeitragsStand[] | null }>)('my_job_post_status', { p_job_id: jobId });
  return data?.[0] ?? null;
}

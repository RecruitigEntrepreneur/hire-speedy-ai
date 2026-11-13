import { supabase } from '@/integrations/supabase/client';
import i18n, { currentLanguage } from '@/i18n';
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

// Ersatzmeldungen beim Aufruf übersetzt (Namespace interviews); Meldungen der Function kommen, wie sie sind.
const fx = (key: string) => i18n.t(`interviews:termin.${key}`);

async function rufe<T>(name: string, body: Record<string, unknown>, fallback: string = fx('generic')): Promise<T> {
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

/** Persönliche Einladung /t/einladung/<token> aus Sicht des Kandidaten. */
export interface EinladungsDaten {
  stand: 'offen' | 'gebucht' | 'abgelaufen' | 'zurueckgezogen'; offen: boolean; pausiert: boolean; kalender: boolean; tage: TerminTag[];
  dauer: number; arten: Gespraechsart[]; headhunter: HeadhunterOeffentlich; vorname: string; email_maskiert: string | null; telefon_bekannt: boolean;
  /** 'angefragt': Der Headhunter bittet um den Lebenslauf und es liegt noch keiner vor (05.11.2026). */
  lebenslauf?: 'angefragt' | null;
  /** Bei „gebucht“: der Termin, für die Seite „Du hast schon einen Termin“. */
  termin?: { start: string; mode: Gespraechsart } | null;
}

/** Lebenslauf-Anfrage ohne Termin /t/lebenslauf/<token> aus Sicht des Kandidaten (05.11.2026). */
export interface AnfrageDaten {
  stand: 'offen' | 'erledigt' | 'abgelaufen' | 'zurueckgezogen';
  headhunter: { name: string; initialen: string; titel: string | null; linkedin: string | null };
  vorname: string;
}

/** Wer nimmt den Lebenslauf an: Terminseite (slug), persönliche Einladung oder Anfrage-Link. */
export type LebenslaufZiel = { slug: string } | { einladung: string } | { anfrage: string };

export const terminSeiteApi = {
  seite: (slug: string, stelle?: string) => rufe<SeitenDaten>('termin-seite', { action: 'seite', slug, stelle, lang: currentLanguage() }),
  einladung: (token: string) => rufe<EinladungsDaten>('termin-seite', { action: 'einladung', token }),
  buchenEinladung: (token: string, d: { start: string; mode: Gespraechsart; consent: boolean; email?: string; phone?: string; website?: string; upload_id?: string | null; linkedin_url?: string }) =>
    rufe<{ ok: true; termin: { start: string; ende: string; mode: Gespraechsart; join_url: string | null; headhunter: string } | null }>(
      'termin-seite', { action: 'buchen', einladung: token, ...d, lang: currentLanguage() }),
  lebenslauf: (ziel: string | LebenslaufZiel, datei: { name: string; typ: string; base64: string | null; text?: string }) =>
    rufe<{ upload_id: string; gelesen: boolean; felder: { first_name: string; last_name: string; email: string; phone: string; linkedin_url: string } }>(
      'termin-seite', { action: 'lebenslauf', ...(typeof ziel === 'string' ? { slug: ziel } : ziel), name: datei.name, typ: datei.typ, datei: datei.base64, text: datei.text }, fx('cvRead')),
  anfrage: (token: string) => rufe<AnfrageDaten>('termin-seite', { action: 'anfrage', token }),
  lebenslaufSenden: (ziel: { einladung: string } | { anfrage: string }, d: { upload_id?: string | null; linkedin_url?: string; consent: boolean }) =>
    rufe<{ ok: true; lebenslauf: boolean; linkedin: boolean }>('termin-seite', { action: 'lebenslauf_senden', ...ziel, ...d }, fx('generic')),
  buchen: (slug: string, stelle: string | undefined, d: BuchungsDaten) =>
    rufe<{ ok: true; termin: { start: string; ende: string; mode: Gespraechsart; join_url: string | null; headhunter: string } | null; verwalten_url?: string }>(
      'termin-seite', { action: 'buchen', slug, stelle, ...d, lang: currentLanguage() }),
  termin: (token: string) => rufe<TerminAnsicht>('termin-seite', { action: 'termin', token }),
  verschieben: (token: string, start: string) => rufe<{ ok: true; start: string; join_url: string | null }>('termin-seite', { action: 'verschieben', token, start }),
  absagen: (token: string, grund: string) => rufe<{ ok: true }>('termin-seite', { action: 'absagen', token, grund }),
};

// ---------------------------------------------------------------------------
// Kandidat zum Gespräch einladen (Headhunter, angemeldet)
// ---------------------------------------------------------------------------
export const einladungApi = {
  senden: (d: { candidate_id: string; arten: Gespraechsart[]; weg: 'mail' | 'selbst'; text?: string; lebenslauf?: boolean }) =>
    rufe<{ ok: true; id: string; token: string }>('termin-einladung', { action: 'senden', ...d }, fx('inviteSend')),
  link: (candidate_id: string) => rufe<{ ok: true; id: string; token: string }>('termin-einladung', { action: 'link', candidate_id }),
  erinnern: (candidate_id: string) => rufe<{ ok: true }>('termin-einladung', { action: 'erinnern', candidate_id }, fx('reminderSend')),
  zurueckziehen: (candidate_id: string) => rufe<{ ok: true }>('termin-einladung', { action: 'zurueckziehen', candidate_id }),
  /** Lebenslauf anfragen ohne Termin (05.11.2026): eigener Link, per Mail oder zum selbst Verschicken. */
  lebenslaufAnfragen: (d: { candidate_id: string; weg: 'mail' | 'selbst'; text?: string }) =>
    rufe<{ ok: true; id: string; token: string }>('termin-einladung', { action: 'lebenslauf_anfragen', ...d }, fx('requestSend')),
  lebenslaufErinnern: (candidate_id: string) =>
    rufe<{ ok: true }>('termin-einladung', { action: 'lebenslauf_erinnern', candidate_id }, fx('reminderSend')),
};

/** Fertiger Link zur Lebenslauf-Anfrage. */
export const lebenslaufLink = (token: string) => `${window.location.origin}/t/lebenslauf/${token}`;

/** Fertiger Link zur Einladung, auf der Adresse, auf der der Headhunter gerade arbeitet. */
export const einladungsLink = (token: string) => `${window.location.origin}/t/einladung/${token}`;

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
  if (error) throw new Error(error.code === '23505' ? fx('slugTaken') : error.message);
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

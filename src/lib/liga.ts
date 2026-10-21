// Matchunt Liga: Aufrufe der Datenbankfunktionen aus 20261021090000_matchunt_liga.sql
// und die Rechnungen für „Meine Punkte“. Die Funktionen sind noch nicht im
// generierten Supabase-Typ, deshalb die Casts.

import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_RULES, mergeRules, type LigaAwardBadge, type LigaAwardKind, type LigaEventKind, type LigaRules,
} from '../../supabase/functions/_shared/liga';

export * from '../../supabase/functions/_shared/liga';

type RpcResult<T> = { data: T | null; error: { message: string } | null };

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => Promise<RpcResult<T>>)(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------------------------------------------------------------------------
// Headhunter
// ---------------------------------------------------------------------------

export interface LigaSeasonInfo {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  grace_days: number;
  closed: boolean;
  top_n: number;
  min_placements: number;
  newcomer_months: number;
  rules: Partial<LigaRules>;
  days_left: number;
}

export interface LigaEvent {
  id: string;
  kind: LigaEventKind;
  points: number;
  original: number;
  corrected: boolean;
  reason: string | null;
  occurred_at: string;
  label: string | null;
}

export interface LigaMe {
  participant: boolean;
  /** Eigener Name aus dem Profil, für das Rückblick-Bild. */
  name: string | null;
  season: LigaSeasonInfo | null;
  me: {
    rank: number | null;
    participants: number;
    points: number;
    placements: number;
    interviews: number;
    submissions: number;
    quote: number | null;
    excluded: boolean;
    awards: LigaAwardKind[];
    gap_above: number | null;
    gap_top: number | null;
  } | null;
  exclusion: string | null;
  events: LigaEvent[];
  pending_holds: { label: string | null; until: string }[];
  awards: { kind: LigaAwardKind; title: string; prize: string | null; image_url: string | null }[];
  prefs: { show_name: boolean; weekly_mail: boolean; award_seen_season: string | null } | null;
}

export interface LigaTableRow {
  rank: number;
  participants: number;
  name: string | null;
  city: string | null;
  is_me: boolean;
  points: number;
  placements: number;
  interviews: number;
  quote: number | null;
  awards: LigaAwardKind[];
}

export interface LigaSeasonListRow {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  grace_days: number;
  closed: boolean;
  running: boolean;
}

export interface LigaHallRow {
  season_id: string;
  season_label: string;
  ends_on: string;
  name: string | null;
  city: string | null;
  is_me: boolean;
  points: number;
  placements: number;
  awards: LigaAwardKind[];
  rank: number;
  participants: number;
  /** Nur in den eigenen Zeilen gefüllt. */
  interviews: number | null;
  quote: number | null;
}

export const ligaMe = (seasonId?: string | null) => rpc<LigaMe | null>('liga_me', seasonId ? { p_season_id: seasonId } : {});
export const ligaTable = (seasonId?: string | null) => rpc<LigaTableRow[]>('liga_table', seasonId ? { p_season_id: seasonId } : {});
export const ligaSeasons = () => rpc<LigaSeasonListRow[]>('liga_seasons_list');
export const ligaHallOfFame = () => rpc<LigaHallRow[]>('liga_hall_of_fame');
export const ligaSetPreferences = (p: { show_name?: boolean; weekly_mail?: boolean; award_seen_season?: string }) =>
  rpc<void>('liga_set_preferences', {
    p_show_name: p.show_name ?? null, p_weekly_mail: p.weekly_mail ?? null, p_award_seen_season: p.award_seen_season ?? null,
  });

/** Jüngste Auszeichnung je Headhunter (Kunde, Prüfseite, Signatur). Fehler heißen: keine Auszeichnung. */
export async function ligaAwardsOf(ids: string[]): Promise<Record<string, LigaAwardBadge>> {
  if (ids.length === 0) return {};
  try {
    const rows = await rpc<(LigaAwardBadge & { recruiter_id: string })[]>('liga_awards_of', { p_recruiter_ids: ids });
    return Object.fromEntries((rows ?? []).map(({ recruiter_id, ...a }) => [recruiter_id, a]));
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminLigaSeason {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  grace_days: number;
  visible_from: string | null;
  closed_at: string | null;
  budget_eur: number | null;
  participants: number | null;
  placements: number | null;
  awards_active: number;
  prizes_open: number | null;
}

export interface AdminLigaRow {
  recruiter_id: string;
  rank: number | null;
  participants: number;
  full_name: string | null;
  company_name: string | null;
  tier: 'partner' | 'silver' | 'gold' | null;
  points: number;
  placements: number;
  holds: number;
  offers: number;
  interviews: number;
  submissions: number;
  quote: number | null;
  deductions: number;
  previous_rank: number | null;
  excluded: boolean;
  exclusion_reason: string | null;
  newcomer: boolean;
  awards: LigaAwardKind[];
}

export interface AdminLigaEvent {
  id: string;
  kind: LigaEventKind;
  points: number;
  occurred_at: string;
  label: string | null;
  submission_id: string | null;
  job_id: string | null;
  corrected_points: number | null;
  correction_reason: string | null;
  corrected_at: string | null;
}

export interface AdminLigaResult {
  recruiter_id: string;
  full_name: string | null;
  company_name: string | null;
  email: string | null;
  rank: number;
  points: number;
  placements: number;
  awards: LigaAwardKind[];
  prizes: string[] | null;
  prize_value: number;
  prize_done_at: string | null;
  award_mailed_at: string | null;
}

export interface SeasonRow {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  grace_days: number;
  visible_from: string | null;
  top_n: number;
  min_placements: number;
  newcomer_months: number;
  budget_eur: number | null;
  tax_checked_on: string | null;
  rules: Partial<LigaRules>;
  closed_at: string | null;
}

export interface AwardRow {
  id?: string;
  season_id: string;
  kind: LigaAwardKind;
  title: string;
  prize: string | null;
  value_eur: number;
  image_url: string | null;
  active: boolean;
  sort: number;
}

export const adminLigaSeasons = () => rpc<AdminLigaSeason[]>('admin_liga_seasons');
export const adminLigaTable = (seasonId: string) => rpc<AdminLigaRow[]>('admin_liga_table', { p_season_id: seasonId });
export const adminLigaEvents = (seasonId: string, recruiterId: string) =>
  rpc<AdminLigaEvent[]>('admin_liga_events', { p_season_id: seasonId, p_recruiter_id: recruiterId });
export const adminLigaCorrect = (eventId: string, points: number, reason: string) =>
  rpc<void>('admin_liga_correct', { p_event_id: eventId, p_points: points, p_reason: reason });
export const adminLigaExclude = (seasonId: string, recruiterId: string, reason: string | null) =>
  rpc<void>('admin_liga_exclude', { p_season_id: seasonId, p_recruiter_id: recruiterId, p_reason: reason });
export const adminLigaRecompute = (seasonId: string) => rpc<number>('admin_liga_recompute', { p_season_id: seasonId });
export const adminLigaPreview = (seasonId: string) =>
  rpc<{ recruiter_id: string; full_name: string | null; rank: number; points: number; placements: number; awards: LigaAwardKind[] }[]>(
    'admin_liga_preview', { p_season_id: seasonId });
export const adminLigaClose = (seasonId: string) => rpc<{ awarded: number; participants: number }>('admin_liga_close', { p_season_id: seasonId });
export const adminLigaResults = (seasonId: string) => rpc<AdminLigaResult[]>('admin_liga_results', { p_season_id: seasonId });
export const adminLigaPrizeDone = (seasonId: string, recruiterId: string, done: boolean) =>
  rpc<void>('admin_liga_prize_done', { p_season_id: seasonId, p_recruiter_id: recruiterId, p_done: done });

export interface LigaMailResult { ok: boolean; dry_run: boolean; total: number; sent: number; failed: number; preview: { to: string; subject: string }[]; sample_html?: string }

/** Wochenstand-Vorschau, Testmail an Marko, Glückwunsch-Mails (Edge Function liga-weekly). */
export async function ligaMail(body: { mode: 'weekly' | 'awards'; season_id?: string; dry_run?: boolean; test?: boolean }): Promise<LigaMailResult> {
  const { data, error } = await supabase.functions.invoke('liga-weekly', { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx && typeof ctx.json === 'function' ? await ctx.json().then((j: { message?: string }) => j.message).catch(() => null) : null;
    throw new Error(msg ?? error.message);
  }
  return data as LigaMailResult;
}

/** Saisons und Preise liest und schreibt nur der Admin direkt (RLS). */
// Ohne generierten Typ: die Tabellen kennt der Supabase-Typ noch nicht.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Untyped = any;
const table = (name: string): Untyped => (supabase as unknown as { from: (t: string) => Untyped }).from(name);

export async function loadSeason(id: string): Promise<{ season: SeasonRow; awards: AwardRow[] }> {
  const [{ data: season, error: e1 }, { data: awards, error: e2 }] = await Promise.all([
    table('liga_seasons').select('*').eq('id', id).maybeSingle(),
    table('liga_awards').select('*').eq('season_id', id).order('sort'),
  ]);
  if (e1 || e2 || !season) throw new Error((e1 ?? e2)?.message ?? 'Saison nicht gefunden.');
  return { season: season as unknown as SeasonRow, awards: (awards ?? []) as unknown as AwardRow[] };
}

export async function saveSeason(s: Omit<SeasonRow, 'id' | 'closed_at'> & { id?: string }): Promise<string> {
  const { id, ...fields } = s;
  const q = id ? table('liga_seasons').update(fields).eq('id', id).select('id').single()
    : table('liga_seasons').insert(fields).select('id').single();
  const { data, error } = await q;
  if (error) throw new Error(error.message.includes('liga_seasons_starts_on_idx') ? 'Es gibt schon eine Saison mit diesem Start.' : error.message);
  return (data as unknown as { id: string }).id;
}

export async function saveAwards(seasonId: string, awards: AwardRow[]): Promise<void> {
  const rows = awards.map(({ id, ...a }) => ({ ...(id ? { id } : {}), ...a, season_id: seasonId }));
  const { error } = await table('liga_awards').upsert(rows, { onConflict: 'season_id,kind' });
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Rechnungen für die Seite
// ---------------------------------------------------------------------------

/** Nächstes Quartal nach einem Datum: Vorschlag für „Saison anlegen“. */
export function nextQuarter(after: Date): { label: string; starts_on: string; ends_on: string } {
  const q = Math.floor(after.getMonth() / 3) + 1;
  const nq = q === 4 ? 1 : q + 1;
  const year = q === 4 ? after.getFullYear() + 1 : after.getFullYear();
  const startMonth = (nq - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(year, endMonth, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { label: `Q${nq} ${year}`, starts_on: `${year}-${pad(startMonth)}-01`, ends_on: `${year}-${pad(endMonth)}-${pad(lastDay)}` };
}

export interface BreakdownLine { kind: LigaEventKind; count: number; points: number }

/** „Interviews 7 × 3 = 21 · Angebot 1 × 5 …“: Punkte je Art, in Regelreihenfolge. */
export function breakdown(events: Pick<LigaEvent, 'kind' | 'points'>[]): BreakdownLine[] {
  const order: LigaEventKind[] = ['interview_first', 'interview_more', 'offer', 'placement', 'placement_holds', 'fast_hit', 'accuracy_bonus', 'no_show', 'placement_ended'];
  const map = new Map<LigaEventKind, BreakdownLine>();
  for (const e of events) {
    const line = map.get(e.kind) ?? { kind: e.kind, count: 0, points: 0 };
    line.count += 1;
    line.points += e.points;
    map.set(e.kind, line);
  }
  return order.filter((k) => map.has(k)).map((k) => map.get(k)!);
}

export interface LigaTip { text: string; points: number }

/**
 * „Was dir am meisten bringt“ (H3): nur Fakten aus dem eigenen Stand, keine
 * Aufforderung. Einstellungen, deren Garantiezeit in der Saison endet, und der
 * Treffsicherheits-Bonus, wenn er rechnerisch noch erreichbar ist.
 */
export function ligaTips(me: LigaMe, today = new Date()): LigaTip[] {
  if (!me.season || me.season.closed || !me.me) return [];
  const r = mergeRules(me.season.rules);
  const tips: LigaTip[] = [];
  for (const h of me.pending_holds) {
    if (h.until > me.season.ends_on) continue;
    tips.push({ text: `Deine Einstellung${h.label ? ` als ${h.label}` : ''} ist ab ${dmy(h.until)} über die Garantiezeit.`, points: r.placement_holds });
  }
  const hasBonus = me.events.some((e) => e.kind === 'accuracy_bonus');
  if (!hasBonus) {
    const subs = me.me.submissions;
    const quote = me.me.quote ?? 0;
    if (subs < r.accuracy_min && quote >= r.accuracy_quote) {
      const missing = r.accuracy_min - subs;
      tips.push({ text: `Noch ${missing} ${missing === 1 ? 'Einreichung' : 'Einreichungen'} bis zum Treffsicherheits-Bonus, wenn deine Quote bei ${Math.round(r.accuracy_quote * 100)} % oder mehr bleibt.`, points: r.accuracy_bonus });
    } else if (subs >= r.accuracy_min && quote < r.accuracy_quote) {
      tips.push({ text: `Der Treffsicherheits-Bonus kommt ab ${Math.round(r.accuracy_quote * 100)} % Interview-Quote; du liegst bei ${Math.round(quote * 100)} %.`, points: r.accuracy_bonus });
    }
  }
  void today;
  return tips.sort((a, b) => b.points - a.points);
}

/** Vorschau für eine neue Regelfassung (A3): die Ereignisse der Saison mit anderen Punkten. */
export function rescore(events: Pick<AdminLigaEvent, 'kind' | 'points' | 'corrected_points'>[], rules: Partial<LigaRules>): number {
  const r = mergeRules(rules);
  return events.reduce((sum, e) => sum + (e.corrected_points ?? (r[e.kind] as number)), 0);
}

export const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};

export const dm = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });

export { DEFAULT_RULES };

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { layout, sendIntakeMail } from './intake-mail.ts';
import { APP_ORIGIN } from './recruiter-partner.ts';
import {
  awardMailBodyHtml, awardMailContent, weeklyBodyHtml, weeklyContent, type LigaAwardKind, type LigaWeeklyRow,
} from './liga.ts';

/**
 * Mails der Matchunt Liga: Wochenstand am Montag (Zusatz 2) und Glückwunsch nach dem
 * Saisonabschluss. Nur Stand und Fakten, keine Aufforderung, mehr zu arbeiten.
 * `dryRun` liefert Empfänger und Betreff, ohne zu senden und ohne etwas zu merken.
 */
type Mail = typeof sendIntakeMail;
export interface LigaMailResult { dry_run: boolean; total: number; sent: number; failed: number; preview: { to: string; subject: string }[]; sample_html?: string }

const WEEKLY_FOOT = 'Du bekommst diese Mail montags, solange eine Saison der Matchunt Liga läuft. '
  + 'Abbestellen: Profil › Partnerstatus › Sichtbarkeit. Die Liga ändert nichts an deinen Plätzen und Konditionen.';

export async function sendWeekly(db: SupabaseClient, opts: { dryRun: boolean; onlyTo?: string | null; mail?: Mail; today?: string }): Promise<LigaMailResult> {
  const { data, error } = await db.rpc('liga_weekly_rows', { p_dry_run: opts.dryRun || !!opts.onlyTo });
  if (error) throw new Error(`Wochenstand nicht lesbar: ${error.message}`);
  const rows = ((data ?? []) as LigaWeeklyRow[]).filter((r) => r.email);
  const day = opts.today ?? new Date().toISOString().slice(0, 10);
  const result: LigaMailResult = { dry_run: opts.dryRun, total: rows.length, sent: 0, failed: 0, preview: [] };
  for (const r of rows) {
    const c = weeklyContent(r);
    const html = layout({
      preheader: c.lines[0], heading: c.heading, body: weeklyBodyHtml(r),
      cta: { label: 'Zur Liga', url: `${APP_ORIGIN}/recruiter/liga` }, footnote: WEEKLY_FOOT,
    });
    result.preview.push({ to: r.email!, subject: c.subject });
    result.sample_html ??= html;
    if (opts.dryRun) continue;
    // Testversand: eine Mail an die genannte Adresse statt an alle.
    const to = opts.onlyTo ?? r.email!;
    const sent = await (opts.mail ?? sendIntakeMail)(db, {
      to, subject: c.subject, html, template: 'liga_weekly',
      meta: { recruiter_id: r.recruiter_id, season: r.season_label, test: !!opts.onlyTo },
      idempotencyKey: opts.onlyTo ? undefined : `liga-weekly-${r.recruiter_id}-${day}`,
    });
    if (sent.sent) result.sent++; else result.failed++;
    if (opts.onlyTo) break;
  }
  return result;
}

interface ResultRow {
  recruiter_id: string; full_name: string | null; email: string | null; rank: number; points: number; participants: number;
  awards: LigaAwardKind[]; prizes: string[] | null; award_mailed_at: string | null; season_label: string;
}

export async function sendAwards(db: SupabaseClient, seasonId: string, opts: { dryRun: boolean; onlyTo?: string | null; mail?: Mail }): Promise<LigaMailResult> {
  const { data: season, error: se } = await db.from('liga_seasons').select('closed_at').eq('id', seasonId).maybeSingle();
  if (se) throw new Error(se.message);
  if (!season?.closed_at) throw new Error('Die Saison ist noch nicht abgeschlossen.');
  const { data, error } = await db.from('liga_results')
    .select('recruiter_id,rank,points,participants,awards,award_mailed_at,season:liga_seasons(label)')
    .eq('season_id', seasonId).neq('awards', '{}');
  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((r) => r.recruiter_id as string);
  const [{ data: people }, { data: prizes }] = await Promise.all([
    db.from('profiles').select('user_id,full_name,email').in('user_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']),
    db.from('liga_awards').select('kind,title,prize').eq('season_id', seasonId).eq('active', true),
  ]);
  const person = new Map((people ?? []).map((p) => [p.user_id as string, p]));
  const rows: ResultRow[] = (data ?? []).map((r) => {
    const p = person.get(r.recruiter_id as string);
    const awards = r.awards as LigaAwardKind[];
    return {
      recruiter_id: r.recruiter_id as string, full_name: (p?.full_name as string | null) ?? null, email: (p?.email as string | null) ?? null,
      rank: r.rank as number, points: r.points as number, participants: r.participants as number, awards,
      prizes: (prizes ?? []).filter((a) => awards.includes(a.kind as LigaAwardKind) && a.prize).map((a) => `${a.title}: ${a.prize}`),
      award_mailed_at: (r.award_mailed_at as string | null) ?? null,
      season_label: ((r.season as { label?: string } | null)?.label) ?? '',
    };
  }).sort((a, b) => a.rank - b.rank);
  const open = rows.filter((r) => r.email && (opts.onlyTo || !r.award_mailed_at));
  const result: LigaMailResult = { dry_run: opts.dryRun, total: open.length, sent: 0, failed: 0, preview: [] };
  for (const r of open) {
    const c = awardMailContent(r);
    const html = layout({
      preheader: c.paragraphs[0], heading: c.heading, body: awardMailBodyHtml(r),
      cta: { label: 'Zum Partnerstatus', url: `${APP_ORIGIN}/recruiter/profile/partnerstatus` },
    });
    result.preview.push({ to: r.email!, subject: c.subject });
    result.sample_html ??= html;
    if (opts.dryRun) continue;
    const sent = await (opts.mail ?? sendIntakeMail)(db, {
      to: opts.onlyTo ?? r.email!, subject: c.subject, html, template: 'liga_award',
      meta: { recruiter_id: r.recruiter_id, season_id: seasonId, test: !!opts.onlyTo },
    });
    if (sent.sent) {
      result.sent++;
      if (!opts.onlyTo) await db.from('liga_results').update({ award_mailed_at: new Date().toISOString() }).eq('season_id', seasonId).eq('recruiter_id', r.recruiter_id);
    } else result.failed++;
    if (opts.onlyTo) break;
  }
  return result;
}

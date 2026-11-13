import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Info, Loader2, Trophy } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { openFeedback } from '@/components/feedback/FeedbackWidget';
import { LigaAwardCard, LigaStar } from '@/components/recruiter/liga/LigaAwardCard';
import { LigaAwardDialog } from '@/components/recruiter/liga/LigaAwardDialog';
import { downloadRueckblick } from '@/components/recruiter/liga/ligaShare';
import {
  AWARD_LABEL, EVENT_LABEL, RULE_ROWS, breakdown, ligaHallOfFame, ligaMe, ligaSeasons,
  ligaTable, ligaTips, mergeRules, quotePct, signed, type LigaAwardKind, type LigaHallRow, type LigaMe, type LigaRules, type LigaTableRow,
} from '@/lib/liga';

// Anzeige in der Sprache der Oberfläche. Die Tabellen in lib/liga (auch für Admin, Mails, Prüfseite) bleiben deutsch.
const date = (iso: string, year: boolean) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso)
  .toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' as const } : {}), timeZone: 'Europe/Berlin' });
const dmy = (iso: string) => date(iso, true);
const dm = (iso: string) => date(iso, false);
const awardLabel = (t: TFunction, kind: LigaAwardKind) => t(`award.${kind}`, { defaultValue: AWARD_LABEL[kind] });
const eventLabel = (t: TFunction, kind: string) => t(`event.${kind}`, { defaultValue: EVENT_LABEL[kind as keyof typeof EVENT_LABEL] ?? kind });
const ruleLabel = (t: TFunction, row: (typeof RULE_ROWS)[number], r: LigaRules) =>
  t(`rule.${row.key}`, { days: r.fast_days, quote: Math.round(r.accuracy_quote * 100), min: r.accuracy_min, defaultValue: row.label(r) });
const ligaName = (t: TFunction, name: string | null | undefined, city: string | null | undefined) =>
  (name && name.trim()) || (city && city.trim() ? t('nameFromCity', { city: city.trim() }) : t('table.headhunter'));

/**
 * Matchunt Liga (H2–H6, Wireframe freigegeben 20.10.2026): eigene Seite im Menü
 * mit Tabelle, Meine Punkte, Regeln, Preise, Ehrentafel. Nur Anerkennung: die
 * Liga ändert nichts an Plätzen und Konditionen.
 */
type Tab = 'tabelle' | 'punkte' | 'regeln' | 'preise' | 'ehrentafel';
const TABS: Tab[] = ['tabelle', 'punkte', 'regeln', 'preise', 'ehrentafel'];

export default function RecruiterLiga() {
  const [params, setParams] = useSearchParams();
  const { t } = useTranslation('recruiterLiga');
  const tab = (TABS.some(x => x === params.get('tab')) ? params.get('tab') : 'tabelle') as Tab;
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const seasons = useQuery({ queryKey: ['liga', 'seasons'], queryFn: ligaSeasons });
  const me = useQuery({ queryKey: ['liga', 'me', seasonId], queryFn: () => ligaMe(seasonId) });
  const table = useQuery({ queryKey: ['liga', 'table', seasonId], queryFn: () => ligaTable(seasonId) });
  const hall = useQuery({ queryKey: ['liga', 'hall'], queryFn: ligaHallOfFame });

  const season = me.data?.season ?? null;
  useEffect(() => { if (!seasonId && season) setSeasonId(season.id); }, [season, seasonId]);
  const setTab = (next: string) => setParams(p => { const n = new URLSearchParams(p); n.set('tab', next); return n; }, { replace: true });

  const loading = me.isLoading || seasons.isLoading;
  const failed = me.isError || seasons.isError;

  return <DashboardLayout>
    <div className="max-w-5xl space-y-5">
      <Card className="border-border/30 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trophy className="h-6 w-6 text-[#C8A24A]"/>{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{season ? seasonLine(t, season) : t('noSeason')}</p>
          </div>
          {(seasons.data?.length ?? 0) > 1 && <Select value={seasonId ?? undefined} onValueChange={setSeasonId}>
            <SelectTrigger className="w-full sm:w-48" aria-label={t('season')}><SelectValue placeholder={t('season')}/></SelectTrigger>
            <SelectContent>{seasons.data!.map(s => <SelectItem key={s.id} value={s.id}>{t(s.running ? 'seasonOptionRunning' : s.closed ? 'seasonOption' : 'seasonOptionGrace', { label: s.label })}</SelectItem>)}</SelectContent>
          </Select>}
        </CardContent>
      </Card>

      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{t('loading')}</p>}
      {failed && <p role="alert" className="text-sm">{t('failed')}</p>}

      {!loading && !failed && me.data && <>
        <Standing me={me.data}/>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start">
            {TABS.map(x => <TabsTrigger key={x} value={x}>{t(`tabs.${x}`)}</TabsTrigger>)}
          </TabsList>
          <TabsContent value="tabelle"><TableTab rows={table.data ?? []} me={me.data} loading={table.isLoading}/></TabsContent>
          <TabsContent value="punkte"><PointsTab me={me.data} onRules={() => setTab('regeln')}/></TabsContent>
          <TabsContent value="regeln"><RulesTab me={me.data}/></TabsContent>
          <TabsContent value="preise"><PrizesTab me={me.data}/></TabsContent>
          <TabsContent value="ehrentafel"><HallTab rows={hall.data ?? []} loading={hall.isLoading} myName={me.data.name ?? ''}/></TabsContent>
        </Tabs>
        <LigaAwardDialog/>
      </>}
    </div>
  </DashboardLayout>;
}

function seasonLine(t: TFunction, s: NonNullable<LigaMe['season']>) {
  if (s.closed) return t('seasonLine.closed', { label: s.label, from: dmy(s.starts_on), to: dmy(s.ends_on) });
  if (s.days_left > 0) return t('seasonLine.running', { label: s.label, to: dmy(s.ends_on), count: s.days_left });
  return t('seasonLine.over', { label: s.label, days: s.grace_days });
}

/** Eigener Stand oben, über allen Reitern. */
function Standing({ me }: { me: LigaMe }) {
  const { t } = useTranslation('recruiterLiga');
  if (!me.participant && !me.me) {
    return <Card><CardContent className="p-5 text-sm">
      {t('standing.notParticipant')}
    </CardContent></Card>;
  }
  if (me.exclusion) {
    return <Card><CardContent className="space-y-1 p-5 text-sm">
      <p className="font-medium">{t('standing.excludedTitle')}</p>
      <p className="text-muted-foreground">{t('standing.excludedText', { reason: me.exclusion })}</p>
    </CardContent></Card>;
  }
  const m = me.me;
  const s = me.season;
  if (!m || !s) return null;
  const top = s.top_n;
  return <Card className="border-border/30 shadow-sm"><CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xl font-semibold">{m.rank ? t('rankOf', { rank: m.rank, total: m.participants }) : t('notRanked')} · {m.points} {t('table.points')}</p>
      <p className="text-sm text-muted-foreground">
        {t('placements', { count: m.placements })} · {t('interviews', { count: m.interviews })} · {t('quoteValue', { value: quotePct(m.quote) })}
      </p>
    </div>
    {!s.closed && <p className="text-sm sm:max-w-xs sm:text-right">
      {m.gap_above !== null && m.rank && m.rank > 1 ? t('standing.gapAbove', { count: m.gap_above, rank: m.rank - 1 }) : ''}
      {m.rank && m.rank <= top ? t('standing.topSeason', { top }) : m.gap_top !== null ? t('standing.gapTop', { points: m.gap_top, top }) : t('standing.top', { top })}
    </p>}
    {s.closed && m.awards.length > 0 && <LigaAwardCard award={m.awards[0]} season={s.label}/>}
  </CardContent></Card>;
}

function TableTab({ rows, me, loading }: { rows: LigaTableRow[]; me: LigaMe; loading: boolean }) {
  const { t } = useTranslation('recruiterLiga');
  const top = me.season?.top_n ?? 10;
  if (loading) return <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground"/>;
  if (rows.length === 0) return <Empty text={t('table.empty')}/>;
  return <Card className="mt-3"><CardContent className="p-0">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="w-14 px-4 py-2 font-medium">{t('table.rank')}</th><th className="px-2 py-2 font-medium">{t('table.headhunter')}</th>
          <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t('table.placementsShort')}</th><th className="hidden px-2 py-2 text-right font-medium sm:table-cell">{t('table.interviewsShort')}</th>
          <th className="px-2 py-2 text-right font-medium">{t('table.quote')}</th><th className="px-4 py-2 text-right font-medium">{t('table.points')}</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => <TableLine key={`${r.rank}-${i}`} r={r} cut={!me.season?.closed && r.rank > top && (i === 0 || rows[i - 1].rank <= top)} top={top} season={me.season?.label ?? ''}/>)}
        </tbody>
      </table>
    </div>
    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <Trans t={t} i18nKey="table.consent" components={{ link: <Link className="underline" to="/recruiter/profile/partnerstatus"/> }}/>
    </p>
  </CardContent></Card>;
}

function TableLine({ r, cut, top, season }: { r: LigaTableRow; cut: boolean; top: number; season: string }) {
  const { t } = useTranslation('recruiterLiga');
  return <>
    {cut && <tr><td colSpan={6} className="px-4 py-1.5 text-[11px] text-[#A07F2C]"><span className="border-t border-dashed border-[#C8A24A] pt-1">{t('table.cut', { top })}</span></td></tr>}
    <tr className={cn('border-b border-border/60 last:border-0', r.is_me && 'bg-primary/5 font-medium')}>
      <td className="px-4 py-2 tabular-nums">{r.rank}</td>
      <td className="px-2 py-2">
        <span className={cn(!r.name && !r.is_me && 'text-muted-foreground')}>{r.is_me ? t('you') : ligaName(t, r.name, r.city)}</span>
        {r.awards.map(a => <span key={a} className="ml-1.5"><LigaStar title={`${awardLabel(t, a)} ${season}`}/></span>)}
      </td>
      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{r.placements}</td>
      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{r.interviews}</td>
      <td className="px-2 py-2 text-right tabular-nums">{quotePct(r.quote)}</td>
      <td className="px-4 py-2 text-right font-semibold tabular-nums">{r.points}</td>
    </tr>
  </>;
}

function PointsTab({ me, onRules }: { me: LigaMe; onRules: () => void }) {
  const { toast } = useToast();
  const { t } = useTranslation('recruiterLiga');
  const lines = useMemo(() => breakdown(me.events), [me.events]);
  const tips = useMemo(() => ligaTips(me), [me]);
  const [all, setAll] = useState(false);
  if (!me.me) return <Empty text={t('pointsTab.empty')}/>;
  const events = all ? me.events : me.events.slice(0, 8);
  const report = () => {
    if (!openFeedback()) toast({ title: t('pointsTab.reportTitle'), description: t('pointsTab.reportText') });
  };
  return <div className="mt-3 space-y-4">
    <Card><CardContent className="space-y-2 p-5">
      <p className="text-3xl font-bold tabular-nums">{me.me.points} <span className="text-base font-medium text-muted-foreground">{t('pointsWord')}</span></p>
      {lines.length > 0
        ? <p className="text-sm text-muted-foreground">{lines.map(l => `${eventLabel(t, l.kind)} ${l.count > 1 ? `${l.count} × ${signed(l.points / l.count)} = ${signed(l.points)}` : signed(l.points)}`).join(' · ')}</p>
        : <p className="text-sm text-muted-foreground">{t('pointsTab.none')}</p>}
    </CardContent></Card>

    {tips.length > 0 && <Card className="border-[#C8A24A]/40"><CardContent className="space-y-2 p-5">
      <h2 className="text-sm font-semibold">{t('pointsTab.best')}</h2>
      <ul className="space-y-1.5">{tips.map(tip => <li key={tip.text} className="flex items-start justify-between gap-3 text-sm">
        <span>{tip.text}</span><span className="shrink-0 font-semibold tabular-nums text-[#A07F2C]">{signed(tip.points)}</span>
      </li>)}</ul>
    </CardContent></Card>}

    <Card><CardContent className="p-0">
      <h2 className="px-5 pb-1 pt-4 text-sm font-semibold">{t('pointsTab.log')}</h2>
      {me.events.length === 0 ? <p className="px-5 pb-4 text-sm text-muted-foreground">{t('pointsTab.noEntries')}</p> :
        <ul className="divide-y divide-border/60">{events.map(e => <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="mr-2 tabular-nums text-muted-foreground">{dm(e.occurred_at)}</span>
            {eventLabel(t, e.kind)}{e.label ? <span className="text-muted-foreground"> · {e.label}</span> : null}
            {e.corrected && <span className="mt-0.5 block text-xs text-muted-foreground">{t('pointsTab.corrected', { reason: e.reason })}</span>}
          </span>
          <span className={cn('shrink-0 font-semibold tabular-nums', e.points < 0 && 'text-destructive')}>
            {e.corrected && <span className="mr-1.5 font-normal text-muted-foreground line-through">{signed(e.original)}</span>}{signed(e.points)}
          </span>
        </li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-xs">
        <span className="flex gap-3">
          {me.events.length > 8 && <button type="button" className="underline" onClick={() => setAll(!all)}>{all ? t('pointsTab.less') : t('pointsTab.all', { count: me.events.length })}</button>}
          <button type="button" className="underline" onClick={onRules}>{t('pointsTab.allRules')}</button>
        </span>
        <button type="button" className="text-muted-foreground underline" onClick={report}>{t('pointsTab.report')}</button>
      </div>
    </CardContent></Card>
  </div>;
}

function RulesTab({ me }: { me: LigaMe }) {
  const { t } = useTranslation('recruiterLiga');
  const s = me.season;
  const r = mergeRules(s?.rules);
  const plus = RULE_ROWS.filter(x => (r[x.key] as number) > 0);
  const minus = RULE_ROWS.filter(x => (r[x.key] as number) < 0);
  const Row = ({ label, points }: { label: string; points: number }) =>
    <li className="flex items-start justify-between gap-3 py-2 text-sm"><span>{label}</span><span className={cn('shrink-0 font-semibold tabular-nums', points < 0 && 'text-destructive')}>{signed(points)}</span></li>;
  return <div className="mt-3 grid gap-4 md:grid-cols-2">
    <Card><CardContent className="p-5">
      <p className="mb-2 text-xs text-muted-foreground">{s ? t('rules.header', { label: s.label, from: dmy(s.starts_on), to: dmy(s.ends_on) }) : t('tabs.regeln')}</p>
      <h2 className="text-sm font-semibold">{t('rules.plus')}</h2>
      <ul className="divide-y divide-border/60">{plus.map(x => <Row key={x.key} label={ruleLabel(t, x, r)} points={r[x.key] as number}/>)}</ul>
      <h2 className="mt-4 text-sm font-semibold">{t('rules.minus')}</h2>
      <ul className="divide-y divide-border/60">{minus.map(x => <Row key={x.key} label={ruleLabel(t, x, r)} points={r[x.key] as number}/>)}</ul>
    </CardContent></Card>
    <Card><CardContent className="space-y-2 p-5 text-sm">
      <h2 className="font-semibold">{t('rules.goodToKnow')}</h2>
      <p>{t('rules.p1')}</p>
      <p>{t('rules.p2')}</p>
      {s && <p>{t('rules.p3', { date: dmy(s.ends_on), days: s.grace_days })}</p>}
      <p>{t('rules.p4')}</p>
      <p>{t('rules.p5')}</p>
      <p className="text-muted-foreground">{t('rules.p6')}</p>
    </CardContent></Card>
  </div>;
}

function PrizesTab({ me }: { me: LigaMe }) {
  const { t } = useTranslation('recruiterLiga');
  const s = me.season;
  const r = mergeRules(s?.rules);
  if (!s || me.awards.length === 0) return <Empty text={t('prizes.empty')}/>;
  return <div className="mt-3 space-y-3">
    <div className="grid gap-3 md:grid-cols-3">
      {me.awards.map(a => <Card key={a.kind}><CardContent className="space-y-2 p-5">
        {a.image_url
          ? <img src={a.image_url} alt="" className="h-28 w-full rounded-md object-cover"/>
          : <div className="flex h-28 items-center justify-center rounded-md bg-[#0A0A0A]"><LigaAwardCard award={a.kind} season={s.label} size="sm" className="border-0"/></div>}
        <p className="font-semibold">{a.title}</p>
        <p className="text-xs text-muted-foreground">{t(`awardWho.${a.kind}`, { top: s.top_n, months: s.newcomer_months, min: r.accurate_award_min })}</p>
        {a.prize && <p className="text-sm">{a.prize}</p>}
      </CardContent></Card>)}
    </div>
    <p className="text-xs text-muted-foreground">
      {t('prizes.minimum', { count: s.min_placements })}
    </p>
  </div>;
}

function HallTab({ rows, loading, myName }: { rows: LigaHallRow[]; loading: boolean; myName: string }) {
  const { t } = useTranslation('recruiterLiga');
  if (loading) return <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground"/>;
  const seasons = [...new Map(rows.map(r => [r.season_id, r])).values()];
  const mine = rows.filter(r => r.is_me);
  if (rows.length === 0) return <Empty text={t('hall.empty')}/>;
  return <div className="mt-3 grid gap-4 md:grid-cols-2">
    <Card><CardContent className="p-0">
      <h2 className="px-5 pb-1 pt-4 text-sm font-semibold">{t('tabs.ehrentafel')}</h2>
      <ul className="divide-y divide-border/60">{seasons.map(s => {
        const winners = rows.filter(r => r.season_id === s.season_id && (r.awards.includes('season_winner') || r.awards.includes('newcomer')));
        return <li key={s.season_id} className="space-y-1 px-5 py-3">
          <p className="text-xs text-muted-foreground">{s.season_label}</p>
          {winners.length === 0 && <p className="text-sm text-muted-foreground">{t('hall.noAward')}</p>}
          {winners.map(w => <p key={`${w.season_id}-${w.rank}`} className="text-sm">
            <span className="text-[#C8A24A]">✦ </span><span className="font-medium">{w.is_me ? t('you') : ligaName(t, w.name, w.city)}</span>
            <span className="text-muted-foreground"> · {awardLabel(t, w.awards.includes('season_winner') ? 'season_winner' : 'newcomer')} · {w.points} {t('table.points')}</span>
          </p>)}
        </li>;
      })}</ul>
    </CardContent></Card>
    <Card><CardContent className="space-y-3 p-5">
      <h2 className="text-sm font-semibold">{t('hall.yourSeasons')}</h2>
      {mine.length === 0 && <p className="text-sm text-muted-foreground">{t('hall.noSeasons')}</p>}
      {mine.map(m => <div key={m.season_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
        <div className="space-y-1">
          <p className="text-sm font-medium">{m.season_label} · {t('rankOf', { rank: m.rank, total: m.participants })} · {m.points} {t('table.points')}</p>
          {m.awards.length > 0 && <div className="flex flex-wrap gap-1.5">{m.awards.map(a => <LigaAwardCard key={a} award={a} season={m.season_label} size="sm"/>)}</div>}
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadRueckblick({
          season: m.season_label, placements: m.placements, interviews: m.interviews ?? 0, quote: m.quote, rank: m.rank, participants: m.participants,
          award: m.awards[0] ?? null, name: myName,
        })}><Download className="mr-1.5 h-3.5 w-3.5"/>{t('hall.image')}</Button>
      </div>)}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{t('hall.imageNote')}</p>
    </CardContent></Card>
  </div>;
}

function Empty({ text }: { text: string }) {
  return <Card className="mt-3"><CardContent className="p-5 text-sm text-muted-foreground">{text}</CardContent></Card>;
}

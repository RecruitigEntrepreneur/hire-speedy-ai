import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Info, Loader2, Trophy } from 'lucide-react';
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
  AWARD_LABEL, AWARD_WHO, EVENT_LABEL, RULE_ROWS, breakdown, dm, dmy, ligaHallOfFame, ligaMe, ligaName, ligaSeasons,
  ligaTable, ligaTips, mergeRules, quotePct, signed, type LigaHallRow, type LigaMe, type LigaTableRow,
} from '@/lib/liga';

/**
 * Matchunt Liga (H2–H6, Wireframe freigegeben 20.10.2026): eigene Seite im Menü
 * mit Tabelle, Meine Punkte, Regeln, Preise, Ehrentafel. Nur Anerkennung: die
 * Liga ändert nichts an Plätzen und Konditionen.
 */
type Tab = 'tabelle' | 'punkte' | 'regeln' | 'preise' | 'ehrentafel';
const TABS: [Tab, string][] = [['tabelle', 'Tabelle'], ['punkte', 'Meine Punkte'], ['regeln', 'Regeln'], ['preise', 'Preise'], ['ehrentafel', 'Ehrentafel']];

export default function RecruiterLiga() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'tabelle') as Tab;
  const [seasonId, setSeasonId] = useState<string | null>(null);

  const seasons = useQuery({ queryKey: ['liga', 'seasons'], queryFn: ligaSeasons });
  const me = useQuery({ queryKey: ['liga', 'me', seasonId], queryFn: () => ligaMe(seasonId) });
  const table = useQuery({ queryKey: ['liga', 'table', seasonId], queryFn: () => ligaTable(seasonId) });
  const hall = useQuery({ queryKey: ['liga', 'hall'], queryFn: ligaHallOfFame });

  const season = me.data?.season ?? null;
  useEffect(() => { if (!seasonId && season) setSeasonId(season.id); }, [season, seasonId]);
  const setTab = (t: string) => setParams(p => { const n = new URLSearchParams(p); n.set('tab', t); return n; }, { replace: true });

  const loading = me.isLoading || seasons.isLoading;
  const failed = me.isError || seasons.isError;

  return <DashboardLayout>
    <div className="max-w-5xl space-y-5">
      <Card className="border-border/30 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trophy className="h-6 w-6 text-[#C8A24A]"/>Matchunt Liga</h1>
            <p className="mt-1 text-sm text-muted-foreground">{season ? seasonLine(season) : 'Die erste Saison ist noch nicht angelegt.'}</p>
          </div>
          {(seasons.data?.length ?? 0) > 1 && <Select value={seasonId ?? undefined} onValueChange={setSeasonId}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Saison"><SelectValue placeholder="Saison"/></SelectTrigger>
            <SelectContent>{seasons.data!.map(s => <SelectItem key={s.id} value={s.id}>Saison {s.label}{s.running ? ' · läuft' : s.closed ? '' : ' · Nachfrist'}</SelectItem>)}</SelectContent>
          </Select>}
        </CardContent>
      </Card>

      {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Liga wird geladen …</p>}
      {failed && <p role="alert" className="text-sm">Die Liga ist gerade nicht erreichbar. Bitte lade die Seite gleich noch einmal.</p>}

      {!loading && !failed && me.data && <>
        <Standing me={me.data}/>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start">
            {TABS.map(([t, label]) => <TabsTrigger key={t} value={t}>{label}</TabsTrigger>)}
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

function seasonLine(s: NonNullable<LigaMe['season']>) {
  if (s.closed) return `Saison ${s.label} · abgeschlossen · ${dmy(s.starts_on)}–${dmy(s.ends_on)}`;
  if (s.days_left > 0) return `Saison ${s.label} läuft bis ${dmy(s.ends_on)} · noch ${s.days_left} ${s.days_left === 1 ? 'Tag' : 'Tage'}`;
  return `Saison ${s.label} ist vorbei · Nachfrist ${s.grace_days} Tage, dann steht die Tabelle fest`;
}

/** Eigener Stand oben, über allen Reitern. */
function Standing({ me }: { me: LigaMe }) {
  if (!me.participant && !me.me) {
    return <Card><CardContent className="p-5 text-sm">
      Die Liga wertet Headhunter mit Matchunt-Partnerstatus (Vertrag ab 2.1). Regeln und Preise kannst du dir trotzdem ansehen.
    </CardContent></Card>;
  }
  if (me.exclusion) {
    return <Card><CardContent className="space-y-1 p-5 text-sm">
      <p className="font-medium">Du bist in dieser Saison nicht gewertet.</p>
      <p className="text-muted-foreground">Grund: {me.exclusion}. Fragen dazu? Antworte einfach auf eine Mail von Matchunt.</p>
    </CardContent></Card>;
  }
  const m = me.me;
  const s = me.season;
  if (!m || !s) return null;
  const top = s.top_n;
  return <Card className="border-border/30 shadow-sm"><CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <p className="text-xl font-semibold">{m.rank ? `Platz ${m.rank} von ${m.participants}` : 'Noch nicht platziert'} · {m.points} Punkte</p>
      <p className="text-sm text-muted-foreground">
        {m.placements} {m.placements === 1 ? 'Einstellung' : 'Einstellungen'} · {m.interviews} {m.interviews === 1 ? 'Kunden-Interview' : 'Kunden-Interviews'} · Quote {quotePct(m.quote)}
      </p>
    </div>
    {!s.closed && <p className="text-sm sm:max-w-xs sm:text-right">
      {m.gap_above !== null && m.rank && m.rank > 1 ? `Noch ${m.gap_above} ${m.gap_above === 1 ? 'Punkt' : 'Punkte'} bis Platz ${m.rank - 1}. ` : ''}
      {m.rank && m.rank <= top ? `Plätze 1–${top} werden Top Performer der Saison.` : m.gap_top !== null ? `${m.gap_top} Punkte bis Platz ${top}: Top Performer.` : `Plätze 1–${top} werden Top Performer.`}
    </p>}
    {s.closed && m.awards.length > 0 && <LigaAwardCard award={m.awards[0]} season={s.label}/>}
  </CardContent></Card>;
}

function TableTab({ rows, me, loading }: { rows: LigaTableRow[]; me: LigaMe; loading: boolean }) {
  const top = me.season?.top_n ?? 10;
  if (loading) return <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground"/>;
  if (rows.length === 0) return <Empty text="Noch keine Punkte in dieser Saison. Punkte gibt es ab dem ersten Kunden-Interview."/>;
  return <Card className="mt-3"><CardContent className="p-0">
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs text-muted-foreground">
          <th className="w-14 px-4 py-2 font-medium">Platz</th><th className="px-2 py-2 font-medium">Headhunter</th>
          <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Einst.</th><th className="hidden px-2 py-2 text-right font-medium sm:table-cell">Interv.</th>
          <th className="px-2 py-2 text-right font-medium">Quote</th><th className="px-4 py-2 text-right font-medium">Punkte</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => <TableLine key={`${r.rank}-${i}`} r={r} cut={!me.season?.closed && r.rank > top && (i === 0 || rows[i - 1].rank <= top)} top={top} season={me.season?.label ?? ''}/>)}
        </tbody>
      </table>
    </div>
    <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
      Namen nur mit Einwilligung, sonst Ort. Deine Einwilligung: <Link className="underline" to="/recruiter/profile/partnerstatus">Partnerstatus › Sichtbarkeit</Link>.
    </p>
  </CardContent></Card>;
}

function TableLine({ r, cut, top, season }: { r: LigaTableRow; cut: boolean; top: number; season: string }) {
  return <>
    {cut && <tr><td colSpan={6} className="px-4 py-1.5 text-[11px] text-[#A07F2C]"><span className="border-t border-dashed border-[#C8A24A] pt-1">bis Platz {top}: Top Performer</span></td></tr>}
    <tr className={cn('border-b border-border/60 last:border-0', r.is_me && 'bg-primary/5 font-medium')}>
      <td className="px-4 py-2 tabular-nums">{r.rank}</td>
      <td className="px-2 py-2">
        <span className={cn(!r.name && !r.is_me && 'text-muted-foreground')}>{r.is_me ? 'Du' : ligaName(r.name, r.city)}</span>
        {r.awards.map(a => <span key={a} className="ml-1.5"><LigaStar title={`${AWARD_LABEL[a]} ${season}`}/></span>)}
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
  const lines = useMemo(() => breakdown(me.events), [me.events]);
  const tips = useMemo(() => ligaTips(me), [me]);
  const [all, setAll] = useState(false);
  if (!me.me) return <Empty text="Hier stehen deine Punkte, sobald du in der Liga gewertet wirst."/>;
  const events = all ? me.events : me.events.slice(0, 8);
  const report = () => {
    if (!openFeedback()) toast({ title: 'Schreib uns kurz', description: 'Antworte einfach auf eine Mail von Matchunt und nenne Datum und Eintrag.' });
  };
  return <div className="mt-3 space-y-4">
    <Card><CardContent className="space-y-2 p-5">
      <p className="text-3xl font-bold tabular-nums">{me.me.points} <span className="text-base font-medium text-muted-foreground">Punkte</span></p>
      {lines.length > 0
        ? <p className="text-sm text-muted-foreground">{lines.map(l => `${EVENT_LABEL[l.kind]} ${l.count > 1 ? `${l.count} × ${signed(l.points / l.count)} = ${signed(l.points)}` : signed(l.points)}`).join(' · ')}</p>
        : <p className="text-sm text-muted-foreground">Noch keine Punkte. Eine Einreichung allein zählt nicht; Punkte gibt es ab dem ersten Kunden-Interview.</p>}
    </CardContent></Card>

    {tips.length > 0 && <Card className="border-[#C8A24A]/40"><CardContent className="space-y-2 p-5">
      <h2 className="text-sm font-semibold">Was dir am meisten bringt</h2>
      <ul className="space-y-1.5">{tips.map(t => <li key={t.text} className="flex items-start justify-between gap-3 text-sm">
        <span>{t.text}</span><span className="shrink-0 font-semibold tabular-nums text-[#A07F2C]">{signed(t.points)}</span>
      </li>)}</ul>
    </CardContent></Card>}

    <Card><CardContent className="p-0">
      <h2 className="px-5 pb-1 pt-4 text-sm font-semibold">Protokoll</h2>
      {me.events.length === 0 ? <p className="px-5 pb-4 text-sm text-muted-foreground">Noch keine Einträge.</p> :
        <ul className="divide-y divide-border/60">{events.map(e => <li key={e.id} className="flex items-start justify-between gap-3 px-5 py-2.5 text-sm">
          <span className="min-w-0">
            <span className="mr-2 tabular-nums text-muted-foreground">{dm(e.occurred_at)}</span>
            {EVENT_LABEL[e.kind]}{e.label ? <span className="text-muted-foreground"> · {e.label}</span> : null}
            {e.corrected && <span className="mt-0.5 block text-xs text-muted-foreground">Von Matchunt korrigiert: {e.reason}</span>}
          </span>
          <span className={cn('shrink-0 font-semibold tabular-nums', e.points < 0 && 'text-destructive')}>
            {e.corrected && <span className="mr-1.5 font-normal text-muted-foreground line-through">{signed(e.original)}</span>}{signed(e.points)}
          </span>
        </li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-xs">
        <span className="flex gap-3">
          {me.events.length > 8 && <button type="button" className="underline" onClick={() => setAll(!all)}>{all ? 'weniger' : `alle ${me.events.length} Einträge`}</button>}
          <button type="button" className="underline" onClick={onRules}>Alle Regeln ansehen</button>
        </span>
        <button type="button" className="text-muted-foreground underline" onClick={report}>Eintrag stimmt nicht? Melden</button>
      </div>
    </CardContent></Card>
  </div>;
}

function RulesTab({ me }: { me: LigaMe }) {
  const s = me.season;
  const r = mergeRules(s?.rules);
  const plus = RULE_ROWS.filter(x => (r[x.key] as number) > 0);
  const minus = RULE_ROWS.filter(x => (r[x.key] as number) < 0);
  const Row = ({ label, points }: { label: string; points: number }) =>
    <li className="flex items-start justify-between gap-3 py-2 text-sm"><span>{label}</span><span className={cn('shrink-0 font-semibold tabular-nums', points < 0 && 'text-destructive')}>{signed(points)}</span></li>;
  return <div className="mt-3 grid gap-4 md:grid-cols-2">
    <Card><CardContent className="p-5">
      <p className="mb-2 text-xs text-muted-foreground">{s ? `Regeln der Saison ${s.label} · gültig ${dmy(s.starts_on)}–${dmy(s.ends_on)}` : 'Regeln'}</p>
      <h2 className="text-sm font-semibold">Dafür gibt es Punkte</h2>
      <ul className="divide-y divide-border/60">{plus.map(x => <Row key={x.key} label={x.label(r)} points={r[x.key] as number}/>)}</ul>
      <h2 className="mt-4 text-sm font-semibold">Abzüge</h2>
      <ul className="divide-y divide-border/60">{minus.map(x => <Row key={x.key} label={x.label(r)} points={r[x.key] as number}/>)}</ul>
    </CardContent></Card>
    <Card><CardContent className="space-y-2 p-5 text-sm">
      <h2 className="font-semibold">Gut zu wissen</h2>
      <p>Eine Einreichung allein bringt keine Punkte. Es zählt, was beim Kunden ankommt.</p>
      <p>Gleichstand: mehr Einstellungen, dann die bessere Interview-Quote, dann wer früher dort war.</p>
      {s && <p>Saisonende {dmy(s.ends_on)}, danach {s.grace_days} Tage Nachfrist für spät gemeldete Termine. Dann steht die Tabelle fest.</p>}
      <p>Fair Play: Wer gegen den Vertrag verstößt, etwa durch Direktkontakt zum Kunden, wird für die Saison nicht gewertet.</p>
      <p>Regeln ändern sich nie mitten in der Saison.</p>
      <p className="text-muted-foreground">Die Liga ändert nichts an deinen Plätzen und Konditionen. Mit Namen erscheinst du nur, wenn du es einschaltest.</p>
    </CardContent></Card>
  </div>;
}

function PrizesTab({ me }: { me: LigaMe }) {
  const s = me.season;
  const r = mergeRules(s?.rules);
  if (!s || me.awards.length === 0) return <Empty text="Für diese Saison sind noch keine Preise festgelegt."/>;
  return <div className="mt-3 space-y-3">
    <div className="grid gap-3 md:grid-cols-3">
      {me.awards.map(a => <Card key={a.kind}><CardContent className="space-y-2 p-5">
        {a.image_url
          ? <img src={a.image_url} alt="" className="h-28 w-full rounded-md object-cover"/>
          : <div className="flex h-28 items-center justify-center rounded-md bg-[#0A0A0A]"><LigaAwardCard award={a.kind} season={s.label} size="sm" className="border-0"/></div>}
        <p className="font-semibold">{a.title}</p>
        <p className="text-xs text-muted-foreground">{AWARD_WHO[a.kind](s.top_n, s.newcomer_months, r.accurate_award_min)}</p>
        {a.prize && <p className="text-sm">{a.prize}</p>}
      </CardContent></Card>)}
    </div>
    <p className="text-xs text-muted-foreground">
      Mindestleistung für einen Preis: {s.min_placements} {s.min_placements === 1 ? 'Einstellung' : 'Einstellungen'} in der Saison. Preise sind Anerkennung, kein Teil der Vergütung.
    </p>
  </div>;
}

function HallTab({ rows, loading, myName }: { rows: LigaHallRow[]; loading: boolean; myName: string }) {
  if (loading) return <Loader2 className="mt-4 h-4 w-4 animate-spin text-muted-foreground"/>;
  const seasons = [...new Map(rows.map(r => [r.season_id, r])).values()];
  const mine = rows.filter(r => r.is_me);
  if (rows.length === 0) return <Empty text="Die Ehrentafel füllt sich mit der ersten abgeschlossenen Saison."/>;
  return <div className="mt-3 grid gap-4 md:grid-cols-2">
    <Card><CardContent className="p-0">
      <h2 className="px-5 pb-1 pt-4 text-sm font-semibold">Ehrentafel</h2>
      <ul className="divide-y divide-border/60">{seasons.map(s => {
        const winners = rows.filter(r => r.season_id === s.season_id && (r.awards.includes('season_winner') || r.awards.includes('newcomer')));
        return <li key={s.season_id} className="space-y-1 px-5 py-3">
          <p className="text-xs text-muted-foreground">{s.season_label}</p>
          {winners.length === 0 && <p className="text-sm text-muted-foreground">Ohne Auszeichnung vergeben.</p>}
          {winners.map(w => <p key={`${w.season_id}-${w.rank}`} className="text-sm">
            <span className="text-[#C8A24A]">✦ </span><span className="font-medium">{w.is_me ? 'Du' : ligaName(w.name, w.city)}</span>
            <span className="text-muted-foreground"> · {w.awards.includes('season_winner') ? AWARD_LABEL.season_winner : AWARD_LABEL.newcomer} · {w.points} Punkte</span>
          </p>)}
        </li>;
      })}</ul>
    </CardContent></Card>
    <Card><CardContent className="space-y-3 p-5">
      <h2 className="text-sm font-semibold">Deine Saisons</h2>
      {mine.length === 0 && <p className="text-sm text-muted-foreground">Noch keine abgeschlossene Saison mit Punkten.</p>}
      {mine.map(m => <div key={m.season_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 last:border-0 last:pb-0">
        <div className="space-y-1">
          <p className="text-sm font-medium">{m.season_label} · Platz {m.rank} von {m.participants} · {m.points} Punkte</p>
          {m.awards.length > 0 && <div className="flex flex-wrap gap-1.5">{m.awards.map(a => <LigaAwardCard key={a} award={a} season={m.season_label} size="sm"/>)}</div>}
        </div>
        <Button variant="outline" size="sm" onClick={() => downloadRueckblick({
          season: m.season_label, placements: m.placements, interviews: m.interviews ?? 0, quote: m.quote, rank: m.rank, participants: m.participants,
          award: m.awards[0] ?? null, name: myName,
        })}><Download className="mr-1.5 h-3.5 w-3.5"/>Rückblick-Bild</Button>
      </div>)}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0"/>Das Rückblick-Bild entsteht in deinem Browser und wird nicht gespeichert. Es zeigt nur deine eigenen Zahlen.</p>
    </CardContent></Card>
  </div>;
}

function Empty({ text }: { text: string }) {
  return <Card className="mt-3"><CardContent className="p-5 text-sm text-muted-foreground">{text}</CardContent></Card>;
}

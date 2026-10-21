import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronDown, ChevronRight, Download, Loader2, Mail, Plus, RefreshCw, Trophy } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  AWARD_LABEL, AWARD_WHO, DEFAULT_RULES, EVENT_LABEL, RULE_ROWS, adminLigaClose, adminLigaCorrect, adminLigaEvents, adminLigaExclude,
  adminLigaPreview, adminLigaPrizeDone, adminLigaRecompute, adminLigaResults, adminLigaSeasons, adminLigaTable, dm, dmy, ligaMail, loadSeason,
  mergeRules, nextQuarter, quotePct, rescore, saveAwards, saveSeason, signed,
  type AdminLigaEvent, type AdminLigaRow, type AdminLigaSeason, type AwardRow, type LigaAwardKind, type LigaRules, type SeasonRow,
} from '@/lib/liga';

/**
 * Admin › Matchunt Liga (A1–A5, Wireframe freigegeben 20.10.2026): Saisons anlegen,
 * Preise und Punkteregeln je Saison festlegen, Tabelle mit Punkte-Protokoll prüfen,
 * korrigieren (mit Grund, sieht der Headhunter), aus der Saison nehmen, abschließen.
 */
type Tab = 'saisons' | 'tabelle' | 'preise' | 'regeln' | 'abschluss';
const TABS: [Tab, string][] = [['saisons', 'Saisons'], ['tabelle', 'Tabelle'], ['preise', 'Saison und Preise'], ['regeln', 'Punkteregeln'], ['abschluss', 'Abschluss']];
const KINDS: LigaAwardKind[] = ['season_winner', 'top_performer', 'newcomer', 'accurate'];
const TIER: Record<string, string> = { partner: 'Partner', silver: 'Silber', gold: 'Gold' };
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (iso: string, days: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const euro = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${n.toLocaleString('de-DE')} €`);

function seasonState(s: Pick<AdminLigaSeason, 'starts_on' | 'ends_on' | 'grace_days' | 'closed_at'>) {
  const t = today();
  if (s.closed_at) return { key: 'closed' as const, text: `abgeschlossen ${dm(s.closed_at)}` };
  if (t < s.starts_on) return { key: 'planned' as const, text: 'geplant' };
  if (t <= s.ends_on) {
    const days = Math.round((new Date(`${s.ends_on}T12:00:00`).getTime() - new Date(`${t}T12:00:00`).getTime()) / 86_400_000);
    return { key: 'running' as const, text: `läuft · noch ${days} Tage` };
  }
  const graceEnd = addDays(s.ends_on, s.grace_days);
  return t <= graceEnd ? { key: 'grace' as const, text: `Nachfrist bis ${dmy(graceEnd)}` } : { key: 'ready' as const, text: 'bereit zum Abschluss' };
}

export default function AdminLiga() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(([t]) => t === params.get('tab')) ? params.get('tab') : 'saisons') as Tab;
  const seasons = useQuery({ queryKey: ['admin-liga', 'seasons'], queryFn: adminLigaSeasons });
  const fallback = useMemo(() => {
    const list = seasons.data ?? [];
    return list.find(s => seasonState(s).key === 'running') ?? list.find(s => !s.closed_at) ?? list[0] ?? null;
  }, [seasons.data]);
  const seasonId = params.get('s') ?? fallback?.id ?? null;
  const season = seasons.data?.find(s => s.id === seasonId) ?? null;
  const go = (t: Tab, s?: string | null) => setParams(p => {
    const n = new URLSearchParams(p); n.set('tab', t); if (s) n.set('s', s); return n;
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin-liga'] });

  const create = async () => {
    const last = seasons.data?.[0];
    const next = nextQuarter(last ? new Date(`${last.ends_on}T12:00:00`) : new Date(Date.now() - 92 * 86_400_000));
    try {
      const id = await saveSeason({
        label: next.label, starts_on: next.starts_on, ends_on: next.ends_on, grace_days: 10, visible_from: addDays(next.starts_on, -14),
        top_n: 10, min_placements: 1, newcomer_months: 6, budget_eur: null, tax_checked_on: null, rules: {},
      });
      await saveAwards(id, defaultAwards(id));
      toast.success(`Saison ${next.label} angelegt`);
      await refresh();
      go('preise', id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Saison konnte nicht angelegt werden.');
    }
  };

  return <DashboardLayout>
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Trophy className="h-6 w-6 text-[#C8A24A]"/>Matchunt Liga</h1>
          <p className="text-sm text-muted-foreground">{season ? `Saison ${season.label} · ${seasonState(season).text}` : 'Noch keine Saison angelegt.'}</p>
        </div>
        <div className="flex items-center gap-2">
          {(seasons.data?.length ?? 0) > 0 && tab !== 'saisons' && <Select value={seasonId ?? undefined} onValueChange={v => go(tab, v)}>
            <SelectTrigger className="w-44" aria-label="Saison"><SelectValue/></SelectTrigger>
            <SelectContent>{seasons.data!.map(s => <SelectItem key={s.id} value={s.id}>Saison {s.label}</SelectItem>)}</SelectContent>
          </Select>}
          <Button onClick={() => void create()}><Plus className="mr-1.5 h-4 w-4"/>Saison anlegen</Button>
        </div>
      </div>

      {seasons.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/>}
      {seasons.isError && <p role="alert" className="text-sm">Die Liga ist nicht erreichbar. Ist die Migration (Lovable Nr. 27) angestoßen?</p>}

      {seasons.data && <Tabs value={tab} onValueChange={t => go(t as Tab)}>
        <TabsList className="h-auto flex-wrap justify-start">{TABS.map(([t, l]) => <TabsTrigger key={t} value={t}>{l}</TabsTrigger>)}</TabsList>
        <TabsContent value="saisons"><SeasonsTab rows={seasons.data} go={go}/></TabsContent>
        <TabsContent value="tabelle">{season ? <TableTab season={season}/> : <None/>}</TabsContent>
        <TabsContent value="preise">{season ? <SeasonTab key={season.id} id={season.id} onSaved={refresh}/> : <None/>}</TabsContent>
        <TabsContent value="regeln">{season ? <RulesTab key={season.id} id={season.id} running={fallback} onSaved={refresh}/> : <None/>}</TabsContent>
        <TabsContent value="abschluss">{season ? <CloseTab key={season.id} season={season} onDone={refresh}/> : <None/>}</TabsContent>
      </Tabs>}
    </div>
  </DashboardLayout>;
}

function defaultAwards(seasonId: string): AwardRow[] {
  return [
    { season_id: seasonId, kind: 'season_winner', title: 'Headhunter der Saison', prize: null, value_eur: 0, image_url: null, active: true, sort: 1 },
    { season_id: seasonId, kind: 'top_performer', title: 'Top Performer', prize: 'Abzeichen für Signatur und LinkedIn, Urkunde', value_eur: 0, image_url: null, active: true, sort: 2 },
    { season_id: seasonId, kind: 'newcomer', title: 'Aufsteiger der Saison', prize: null, value_eur: 0, image_url: null, active: true, sort: 3 },
    { season_id: seasonId, kind: 'accurate', title: 'Treffsicher', prize: 'Abzeichen', value_eur: 0, image_url: null, active: false, sort: 4 },
  ];
}

function None() {
  return <Card className="mt-3"><CardContent className="p-5 text-sm text-muted-foreground">Leg zuerst eine Saison an.</CardContent></Card>;
}

// ---------------------------------------------------------------------------
// A1 Saisons
// ---------------------------------------------------------------------------

function SeasonsTab({ rows, go }: { rows: AdminLigaSeason[]; go: (t: Tab, s?: string | null) => void }) {
  if (rows.length === 0) return <None/>;
  return <Card className="mt-3"><CardContent className="overflow-x-auto p-0">
    <table className="w-full text-sm">
      <thead><tr className="border-b text-left text-xs text-muted-foreground">
        {['Saison', 'Zeitraum', 'Status', 'Teilnehmer', 'Einstellungen', 'Preise', 'Budget', ''].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}
      </tr></thead>
      <tbody>{rows.map(s => {
        const st = seasonState(s);
        return <tr key={s.id} className="border-b last:border-0">
          <td className="px-4 py-2.5 font-medium">{s.label}</td>
          <td className="px-4 py-2.5">{dmy(s.starts_on).slice(0, 6)}–{dmy(s.ends_on)}<span className="block text-xs text-muted-foreground">Nachfrist {s.grace_days} Tage{s.visible_from ? ` · sichtbar ab ${dmy(s.visible_from)}` : ''}</span></td>
          <td className="px-4 py-2.5"><Badge variant={st.key === 'running' ? 'default' : 'outline'}>{st.text}</Badge></td>
          <td className="px-4 py-2.5 tabular-nums">{s.participants ?? '—'}</td>
          <td className="px-4 py-2.5 tabular-nums">{s.placements ?? '—'}</td>
          <td className="px-4 py-2.5">{s.closed_at ? `vergeben${s.prizes_open ? ` · ${s.prizes_open} offen` : ''}` : `${s.awards_active} festgelegt`}</td>
          <td className="px-4 py-2.5 tabular-nums">{euro(s.budget_eur)}</td>
          <td className="px-4 py-2.5 text-right">
            {st.key === 'planned' && <Button size="sm" variant="outline" onClick={() => go('preise', s.id)}>Bearbeiten</Button>}
            {(st.key === 'running' || st.key === 'grace') && <Button size="sm" variant="outline" onClick={() => go('tabelle', s.id)}>Tabelle</Button>}
            {st.key === 'ready' && <Button size="sm" onClick={() => go('abschluss', s.id)}>Abschließen</Button>}
            {st.key === 'closed' && <Button size="sm" variant="outline" onClick={() => go('abschluss', s.id)}>Ergebnis</Button>}
          </td>
        </tr>;
      })}</tbody>
    </table>
  </CardContent></Card>;
}

// ---------------------------------------------------------------------------
// Tabelle mit Protokoll (A4 Korrektur, Aus Saison nehmen)
// ---------------------------------------------------------------------------

function TableTab({ season }: { season: AdminLigaSeason }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-liga', 'table', season.id], queryFn: () => adminLigaTable(season.id) });
  const [tier, setTier] = useState('all');
  const [minOnly, setMinOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exclude, setExclude] = useState<AdminLigaRow | null>(null);
  const [busy, setBusy] = useState(false);
  const closed = !!season.closed_at;
  const rows = (q.data ?? []).filter(r => (tier === 'all' || r.tier === tier) && (!minOnly || r.placements >= 1));
  const counted = (q.data ?? []).filter(r => !r.excluded);
  const sum = (k: 'placements' | 'interviews' | 'submissions') => counted.reduce((a, r) => a + r[k], 0);
  const kpis: [string, string][] = [
    [String(counted.length), 'gewertete Headhunter'], [String(sum('placements')), 'Einstellungen'], [String(sum('interviews')), 'Kunden-Interviews'],
    [sum('submissions') ? `${Math.round((sum('interviews') / sum('submissions')) * 100)} %` : '–', 'Interview-Quote gesamt'],
    [String((q.data ?? []).filter(r => r.excluded).length), 'aus der Saison genommen'],
  ];
  const recompute = async () => {
    setBusy(true);
    try { await adminLigaRecompute(season.id); await qc.invalidateQueries({ queryKey: ['admin-liga'] }); toast.success('Neu berechnet'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Neu berechnen ging nicht.'); }
    finally { setBusy(false); }
  };
  const csv = () => {
    const head = ['Platz', 'Name', 'Firma', 'Stufe', 'Punkte', 'Einstellungen', 'hält', 'Angebote', 'Interviews', 'Einreichungen', 'Quote', 'Abzüge', 'ausgeschlossen'];
    const lines = (q.data ?? []).map(r => [r.rank ?? '', r.full_name ?? '', r.company_name ?? '', r.tier ?? '', r.points, r.placements, r.holds, r.offers, r.interviews, r.submissions, quotePct(r.quote), r.deductions, r.excluded ? r.exclusion_reason ?? 'ja' : '']);
    const text = [head, ...lines].map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/csv;charset=utf-8' }));
    a.download = `Matchunt-Liga-${season.label.replace(/\s+/g, '-')}.csv`;
    a.click();
  };

  return <div className="mt-3 space-y-4">
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{kpis.map(([v, l]) => <Card key={l}><CardContent className="p-4"><p className="text-xl font-semibold tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{l}</p></CardContent></Card>)}</div>
    <div className="flex flex-wrap items-center gap-2">
      <Select value={tier} onValueChange={setTier}><SelectTrigger className="w-36" aria-label="Stufe"><SelectValue/></SelectTrigger>
        <SelectContent><SelectItem value="all">Stufe: alle</SelectItem><SelectItem value="gold">Gold</SelectItem><SelectItem value="silver">Silber</SelectItem><SelectItem value="partner">Partner</SelectItem></SelectContent></Select>
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={minOnly} onCheckedChange={v => setMinOnly(v === true)}/>nur mit Einstellung</label>
      <span className="flex-1"/>
      {!closed && <Button variant="outline" size="sm" disabled={busy} onClick={() => void recompute()}><RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', busy && 'animate-spin')}/>Neu berechnen</Button>}
      {!closed && <MailButtons mode="weekly" label="Wochenmail"/>}
      <Button variant="outline" size="sm" onClick={csv}><Download className="mr-1.5 h-3.5 w-3.5"/>CSV</Button>
    </div>
    {q.isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Card><CardContent className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground">
          {['Platz', 'Headhunter', 'Punkte', 'Einst.', 'hält', 'Angeb.', 'Interv.', 'Einr.', 'Quote', 'Abzüge', 'Vorsaison', 'Auszeichnung'].map(h => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(r => <Fragment key={r.recruiter_id}>
          <tr className={cn('cursor-pointer border-b hover:bg-muted/40', r.excluded && 'text-muted-foreground')} onClick={() => setOpenId(openId === r.recruiter_id ? null : r.recruiter_id)}>
            <td className="px-3 py-2 tabular-nums">{openId === r.recruiter_id ? <ChevronDown className="mr-1 inline h-3.5 w-3.5"/> : <ChevronRight className="mr-1 inline h-3.5 w-3.5"/>}{r.rank ?? '—'}</td>
            <td className="px-3 py-2"><span className="font-medium">{r.full_name ?? 'ohne Namen'}</span>{r.tier && <Badge variant="outline" className="ml-1.5 text-[10px]">{TIER[r.tier]}</Badge>}
              <span className="block text-xs text-muted-foreground">{[r.company_name, r.newcomer ? 'neu' : null, r.excluded ? `aus der Saison: ${r.exclusion_reason}` : null].filter(Boolean).join(' · ')}</span></td>
            <td className="px-3 py-2 font-semibold tabular-nums">{r.points}</td>
            <td className="px-3 py-2 tabular-nums">{r.placements}</td><td className="px-3 py-2 tabular-nums">{r.holds}</td>
            <td className="px-3 py-2 tabular-nums">{r.offers}</td><td className="px-3 py-2 tabular-nums">{r.interviews}</td>
            <td className="px-3 py-2 tabular-nums">{r.submissions}</td><td className="px-3 py-2 tabular-nums">{quotePct(r.quote)}</td>
            <td className={cn('px-3 py-2 tabular-nums', r.deductions < 0 && 'text-destructive')}>{signed(r.deductions)}</td>
            <td className="px-3 py-2 tabular-nums">{r.previous_rank ?? '—'}</td>
            <td className="px-3 py-2">{r.awards.map(a => <span key={a} className="mr-1 whitespace-nowrap text-xs text-[#A07F2C]">✦ {AWARD_LABEL[a]}</span>)}</td>
          </tr>
          {openId === r.recruiter_id && <tr className="border-b bg-muted/20"><td colSpan={12} className="px-6 py-3">
            <Protocol season={season} row={r} onExclude={() => setExclude(r)}/>
          </td></tr>}
        </Fragment>)}</tbody>
      </table>
      {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">Keine Teilnehmer mit diesem Filter.</p>}
    </CardContent></Card>}
    <ExcludeDialog season={season} row={exclude} onClose={() => setExclude(null)}/>
  </div>;
}

function Protocol({ season, row, onExclude }: { season: AdminLigaSeason; row: AdminLigaRow; onExclude: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-liga', 'events', season.id, row.recruiter_id], queryFn: () => adminLigaEvents(season.id, row.recruiter_id) });
  const [edit, setEdit] = useState<AdminLigaEvent | null>(null);
  const closed = !!season.closed_at;
  const include = async () => {
    try { await adminLigaExclude(season.id, row.recruiter_id, null); await qc.invalidateQueries({ queryKey: ['admin-liga'] }); toast.success('Wieder in der Wertung'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ging nicht.'); }
  };
  if (q.isLoading) return <Loader2 className="h-4 w-4 animate-spin"/>;
  return <div className="space-y-2">
    {(q.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Noch keine Punkte in dieser Saison.</p>}
    <ul className="space-y-1">{(q.data ?? []).map(e => <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
      <span><span className="mr-2 tabular-nums text-muted-foreground">{dm(e.occurred_at)}</span>{EVENT_LABEL[e.kind]}{e.label && <span className="text-muted-foreground"> · {e.label}</span>}
        {e.corrected_points !== null && <span className="block text-xs text-muted-foreground">korrigiert {e.corrected_at ? dm(e.corrected_at) : ''}: {e.correction_reason}</span>}</span>
      <span className="flex shrink-0 items-center gap-2">
        {e.corrected_points !== null && <span className="text-muted-foreground line-through">{signed(e.points)}</span>}
        <span className="font-semibold tabular-nums">{signed(e.corrected_points ?? e.points)}</span>
        {!closed && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEdit(e)}>Korrigieren</Button>}
      </span>
    </li>)}</ul>
    {!closed && <div className="flex gap-2 border-t pt-2">
      {row.excluded ? <Button size="sm" variant="outline" onClick={() => void include()}>Wieder aufnehmen</Button>
        : <Button size="sm" variant="outline" className="text-destructive" onClick={onExclude}>Aus Saison nehmen</Button>}
    </div>}
    <CorrectDialog event={edit} name={row.full_name} season={season.label} onClose={() => setEdit(null)}/>
  </div>;
}

function CorrectDialog({ event, name, season, onClose }: { event: AdminLigaEvent | null; name: string | null; season: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [points, setPoints] = useState('0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (event) { setPoints(String(event.corrected_points ?? event.points)); setReason(event.correction_reason ?? ''); } }, [event]);
  const save = async () => {
    if (!event) return;
    setBusy(true);
    try { await adminLigaCorrect(event.id, Number(points), reason); await qc.invalidateQueries({ queryKey: ['admin-liga'] }); toast.success('Korrigiert'); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Korrigieren ging nicht.'); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!event} onOpenChange={o => { if (!o) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Punkte korrigieren · {name ?? 'Headhunter'} · {season}</DialogTitle>
        {event && <DialogDescription>Eintrag: {dm(event.occurred_at)} {EVENT_LABEL[event.kind]} · {signed(event.points)}</DialogDescription>}</DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label htmlFor="liga-points">Neue Punkte</Label><Input id="liga-points" type="number" value={points} onChange={e => setPoints(e.target.value)} className="w-28"/></div>
        <div className="space-y-1"><Label htmlFor="liga-reason">Grund (Pflicht, sieht der Headhunter)</Label>
          <Textarea id="liga-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Kunde hat den Termin verlegt, Nichterscheinen war falsch gemeldet."/></div>
        <p className="text-xs text-muted-foreground">Jede Korrektur steht im Protokoll, mit Admin und Datum. Sie bleibt bei jeder Neuberechnung erhalten.</p>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button disabled={busy || reason.trim().length < 3 || points === '' || Number.isNaN(Number(points))} onClick={() => void save()}>Korrigieren</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

function ExcludeDialog({ season, row, onClose }: { season: AdminLigaSeason; row: AdminLigaRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (row) setReason(''); }, [row]);
  const save = async () => {
    if (!row) return;
    setBusy(true);
    try { await adminLigaExclude(season.id, row.recruiter_id, reason); await qc.invalidateQueries({ queryKey: ['admin-liga'] }); toast.success('Aus der Saison genommen'); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ging nicht.'); }
    finally { setBusy(false); }
  };
  return <Dialog open={!!row} onOpenChange={o => { if (!o) onClose(); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{row?.full_name ?? 'Headhunter'} aus der Saison {season.label} nehmen</DialogTitle>
        <DialogDescription>Für einen bestätigten Verstoß, etwa Direktkontakt zum Kunden. Der Headhunter sieht den Grund auf seiner Liga-Seite.</DialogDescription></DialogHeader>
      <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Grund"/>
      <DialogFooter><Button variant="outline" onClick={onClose}>Abbrechen</Button>
        <Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void save()}>Aus Saison nehmen</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

// ---------------------------------------------------------------------------
// A2 Saison und Preise
// ---------------------------------------------------------------------------

function SeasonTab({ id, onSaved }: { id: string; onSaved: () => void }) {
  const q = useQuery({ queryKey: ['admin-liga', 'season', id], queryFn: () => loadSeason(id) });
  const [s, setS] = useState<SeasonRow | null>(null);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setS(q.data.season);
    const have = new Map(q.data.awards.map(a => [a.kind, a]));
    setAwards(defaultAwards(id).map(d => have.get(d.kind) ?? d));
  }, [q.data, id]);
  if (!s) return <Loader2 className="mt-3 h-4 w-4 animate-spin"/>;
  const started = s.starts_on <= today();
  const closed = !!s.closed_at;
  const used = awards.filter(a => a.active).reduce((sum, a) => sum + a.value_eur * (a.kind === 'top_performer' ? s.top_n : 1), 0);
  const money = awards.some(a => a.active && a.value_eur > 0);
  const set = <K extends keyof SeasonRow>(k: K, v: SeasonRow[K]) => setS({ ...s, [k]: v });
  const setAward = (kind: LigaAwardKind, patch: Partial<AwardRow>) => setAwards(awards.map(a => a.kind === kind ? { ...a, ...patch } : a));
  const save = async () => {
    setBusy(true);
    try {
      await saveSeason(seasonFields(s));
      await saveAwards(s.id, awards);
      toast.success('Gespeichert');
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern ging nicht.'); }
    finally { setBusy(false); }
  };
  const num = (v: string) => (v === '' ? 0 : Math.max(0, Math.round(Number(v)) || 0));
  return <div className="mt-3 space-y-4">
    <Card><CardContent className="grid gap-4 p-5 md:grid-cols-4">
      <Field label="Name"><Input value={s.label} disabled={closed} onChange={e => set('label', e.target.value)}/></Field>
      <Field label="Beginn"><Input type="date" value={s.starts_on} disabled={started} onChange={e => set('starts_on', e.target.value)}/></Field>
      <Field label="Ende"><Input type="date" value={s.ends_on} disabled={started} onChange={e => set('ends_on', e.target.value)}/></Field>
      <Field label="Nachfrist (Tage)"><Input type="number" value={s.grace_days} disabled={closed} onChange={e => set('grace_days', num(e.target.value))}/></Field>
      <Field label="Für Headhunter sichtbar ab"><Input type="date" value={s.visible_from ?? ''} disabled={closed} onChange={e => set('visible_from', e.target.value || null)}/></Field>
      <Field label="Top Performer bis Platz"><Input type="number" value={s.top_n} disabled={closed} onChange={e => set('top_n', num(e.target.value))}/></Field>
      <Field label="Mindestleistung für Preise (Einstellungen)"><Input type="number" value={s.min_placements} disabled={closed} onChange={e => set('min_placements', num(e.target.value))}/></Field>
      <Field label="Neuling: unter … Monaten"><Input type="number" value={s.newcomer_months} disabled={closed} onChange={e => set('newcomer_months', num(e.target.value))}/></Field>
      <p className="text-xs text-muted-foreground md:col-span-4">Teilnahme: alle Headhunter mit Partnerstatus (Vertrag ab 2.1). {started ? 'Beginn und Ende stehen fest, weil die Saison begonnen hat.' : ''}</p>
    </CardContent></Card>

    <Card><CardContent className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Auszeichnungen und Preise</h2>
        <span className="flex items-center gap-2 text-sm">Budget
          <Input type="number" className="h-8 w-28" value={s.budget_eur ?? ''} disabled={closed} onChange={e => set('budget_eur', e.target.value === '' ? null : num(e.target.value))}/>€
          <span className={cn('text-muted-foreground', s.budget_eur !== null && used > s.budget_eur && 'font-medium text-destructive')}>· vergeben {euro(used)}</span></span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">{['Auszeichnung', 'Wer', 'Preis', 'Wert je Person', 'Bild (https)', 'Aktiv'].map(h => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{awards.map(a => <tr key={a.kind} className="border-b last:border-0 align-top">
            <td className="px-2 py-2"><Input value={a.title} disabled={closed} onChange={e => setAward(a.kind, { title: e.target.value })} className="h-8 min-w-40"/></td>
            <td className="px-2 py-2 text-xs text-muted-foreground">{AWARD_WHO[a.kind](s.top_n, s.newcomer_months, mergeRules(s.rules).accurate_award_min)}</td>
            <td className="px-2 py-2"><Input value={a.prize ?? ''} disabled={closed} onChange={e => setAward(a.kind, { prize: e.target.value || null })} className="h-8 min-w-56" placeholder="z. B. Wochenende in Hamburg für zwei"/></td>
            <td className="px-2 py-2"><Input type="number" value={a.value_eur} disabled={closed} onChange={e => setAward(a.kind, { value_eur: num(e.target.value) })} className="h-8 w-24"/></td>
            <td className="px-2 py-2"><Input value={a.image_url ?? ''} disabled={closed} onChange={e => setAward(a.kind, { image_url: e.target.value || null })} className="h-8 min-w-40" placeholder="https://…"/></td>
            <td className="px-2 py-2"><Switch checked={a.active} disabled={closed} onCheckedChange={v => setAward(a.kind, { active: v })} aria-label={`${a.title} aktiv`}/></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className={cn('flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm', money && !s.tax_checked_on && 'border-amber-500/60 bg-amber-500/10')}>
        <span className="flex-1">Geldwerte Preise: vor dem ersten Einsatz mit dem Steuerberater klären (Umsatzsteuer, Pauschalsteuer nach § 37b EStG).</span>
        <label className="flex items-center gap-2"><Checkbox checked={!!s.tax_checked_on} disabled={closed} onCheckedChange={v => set('tax_checked_on', v === true ? today() : null)}/>
          {s.tax_checked_on ? `geprüft am ${dmy(s.tax_checked_on)}` : 'geprüft'}</label>
      </div>
      <p className="text-xs text-muted-foreground">Preise sind Anerkennung, kein Teil der Vergütung. Kein Rang wirkt auf Plätze, Erstzugriff oder Konditionen.</p>
    </CardContent></Card>
    {!closed && <div className="flex justify-end"><Button disabled={busy} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Speichern</Button></div>}
  </div>;
}

/** Nur die Felder, die der Admin pflegt (ohne Zeitstempel und Abschluss). */
function seasonFields(s: SeasonRow) {
  return {
    id: s.id, label: s.label, starts_on: s.starts_on, ends_on: s.ends_on, grace_days: s.grace_days, visible_from: s.visible_from || null,
    top_n: s.top_n, min_placements: s.min_placements, newcomer_months: s.newcomer_months, budget_eur: s.budget_eur,
    tax_checked_on: s.tax_checked_on, rules: s.rules,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

// ---------------------------------------------------------------------------
// A3 Punkteregeln
// ---------------------------------------------------------------------------

const THRESHOLDS: { key: keyof LigaRules; label: string; pct?: boolean }[] = [
  { key: 'fast_days', label: 'Schneller Treffer: höchstens Werktage' },
  { key: 'accuracy_quote', label: 'Treffsicherheit: Quote ab', pct: true },
  { key: 'accuracy_min', label: 'Treffsicherheit: Einreichungen ab' },
  { key: 'accurate_award_min', label: 'Auszeichnung Treffsicher: Einreichungen ab' },
];

function RulesTab({ id, running, onSaved }: { id: string; running: AdminLigaSeason | null; onSaved: () => void }) {
  const q = useQuery({ queryKey: ['admin-liga', 'season', id], queryFn: () => loadSeason(id) });
  const runningQ = useQuery({ queryKey: ['admin-liga', 'season', running?.id], queryFn: () => loadSeason(running!.id), enabled: !!running && running.id !== id });
  const [rules, setRules] = useState<LigaRules>(DEFAULT_RULES);
  const [preview, setPreview] = useState<{ name: string; before: number; after: number }[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.data) setRules(mergeRules(q.data.season.rules)); }, [q.data]);
  if (!q.data) return <Loader2 className="mt-3 h-4 w-4 animate-spin"/>;
  const s = q.data.season;
  const locked = s.starts_on <= today();
  const compare = running && running.id !== id ? (runningQ.data ? mergeRules(runningQ.data.season.rules) : null) : null;
  const set = (k: keyof LigaRules, v: string, pct?: boolean) => setRules({ ...rules, [k]: v === '' ? 0 : pct ? Number(v) / 100 : Math.round(Number(v)) });
  const save = async () => {
    setBusy(true);
    try {
      const changed = Object.fromEntries(Object.entries(rules).filter(([k, v]) => DEFAULT_RULES[k as keyof LigaRules] !== v));
      await saveSeason({ ...seasonFields(s), rules: changed });
      toast.success(`Fassung für ${s.label} gespeichert`);
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Speichern ging nicht.'); }
    finally { setBusy(false); }
  };
  const runPreview = async () => {
    if (!running) return;
    setBusy(true);
    try {
      const [table, ev] = await Promise.all([
        adminLigaTable(running.id),
        (supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => Promise<{ data: { recruiter_id: string; kind: AdminLigaEvent['kind']; points: number; corrected_points: number | null }[] | null }> } } })
          .from('liga_events').select('recruiter_id,kind,points,corrected_points').eq('season_id', running.id),
      ]);
      const by = new Map<string, typeof ev.data>();
      for (const e of ev.data ?? []) by.set(e.recruiter_id, [...(by.get(e.recruiter_id) ?? []), e]);
      setPreview(table.filter(r => !r.excluded).map(r => ({ name: r.full_name ?? 'ohne Namen', before: r.points, after: rescore(by.get(r.recruiter_id) ?? [], rules) }))
        .sort((a, b) => b.after - a.after).slice(0, 10));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Vorschau ging nicht.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 space-y-4">
    <p className="text-sm">{locked ? `Fassung für ${s.label}. Die Saison hat begonnen; ihre Regeln sind gesperrt.` : `Fassung für ${s.label} (geplant).${running && running.id !== id ? ` ${running.label} läuft und ist gesperrt.` : ''}`}</p>
    <Card><CardContent className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground">
          <th className="px-4 py-2 font-medium">Ereignis</th><th className="px-4 py-2 font-medium">Quelle</th><th className="px-4 py-2 font-medium">Punkte {s.label}</th>
          {compare && <th className="px-4 py-2 font-medium">{running!.label}</th>}
        </tr></thead>
        <tbody>
          {RULE_ROWS.map(r => <tr key={r.key} className="border-b">
            <td className="px-4 py-2">{r.label(rules)}</td><td className="px-4 py-2 text-xs text-muted-foreground">{r.source}</td>
            <td className="px-4 py-2"><Input type="number" className="h-8 w-20" value={rules[r.key]} disabled={locked} onChange={e => set(r.key, e.target.value)}/></td>
            {compare && <td className="px-4 py-2 tabular-nums text-muted-foreground">{signed(compare[r.key])}</td>}
          </tr>)}
          {THRESHOLDS.map(t => <tr key={t.key} className="border-b last:border-0">
            <td className="px-4 py-2" colSpan={2}>{t.label}</td>
            <td className="px-4 py-2"><span className="flex items-center gap-1"><Input type="number" className="h-8 w-20" disabled={locked}
              value={t.pct ? Math.round(rules[t.key] * 100) : rules[t.key]} onChange={e => set(t.key, e.target.value, t.pct)}/>{t.pct && '%'}</span></td>
            {compare && <td className="px-4 py-2 tabular-nums text-muted-foreground">{t.pct ? `${Math.round(compare[t.key] * 100)} %` : compare[t.key]}</td>}
          </tr>)}
        </tbody>
      </table>
    </CardContent></Card>
    {!locked && <div className="flex flex-wrap justify-end gap-2">
      {running && running.id !== id && <Button variant="outline" disabled={busy} onClick={() => void runPreview()}>Vorschau: Tabelle {running.label} nach neuen Regeln</Button>}
      <Button disabled={busy} onClick={() => void save()}>Fassung speichern</Button>
    </div>}
    {preview && <Card><CardContent className="p-4 text-sm">
      <p className="mb-2 font-medium">Vorschau (Spitze, ohne Treffsicherheits-Schwellen neu zu prüfen)</p>
      <ol className="space-y-1">{preview.map((p, i) => <li key={p.name + i} className="flex justify-between"><span>{i + 1}. {p.name}</span><span className="tabular-nums">{p.before} → <span className="font-semibold">{p.after}</span></span></li>)}</ol>
    </CardContent></Card>}
  </div>;
}

// ---------------------------------------------------------------------------
// A5 Abschluss und Preise ausgeben
// ---------------------------------------------------------------------------

function CloseTab({ season, onDone }: { season: AdminLigaSeason; onDone: () => void }) {
  const qc = useQueryClient();
  const st = seasonState(season);
  const closed = !!season.closed_at;
  const ready = st.key === 'ready';
  const preview = useQuery({ queryKey: ['admin-liga', 'preview', season.id], queryFn: () => adminLigaPreview(season.id), enabled: ready && !closed });
  const table = useQuery({ queryKey: ['admin-liga', 'table', season.id], queryFn: () => adminLigaTable(season.id), enabled: ready && !closed });
  const results = useQuery({ queryKey: ['admin-liga', 'results', season.id], queryFn: () => adminLigaResults(season.id), enabled: closed });
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const plan = preview.data ?? [];
  const winner = plan.find(p => p.awards.includes('season_winner'));
  const tops = plan.filter(p => p.awards.includes('top_performer'));
  const newcomer = plan.find(p => p.awards.includes('newcomer'));
  const accurate = plan.find(p => p.awards.includes('accurate'));
  const excluded = (table.data ?? []).filter(r => r.excluded);

  const close = async () => {
    setBusy(true);
    try {
      const r = await adminLigaClose(season.id);
      toast.success(`Saison ${season.label} abgeschlossen · ${r.awarded} Auszeichnungen vergeben`);
      setConfirm(false);
      await qc.invalidateQueries({ queryKey: ['admin-liga'] });
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Abschließen ging nicht.'); }
    finally { setBusy(false); }
  };
  const done = async (recruiterId: string, v: boolean) => {
    try { await adminLigaPrizeDone(season.id, recruiterId, v); await qc.invalidateQueries({ queryKey: ['admin-liga'] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Ging nicht.'); }
  };

  if (closed) {
    return <div className="mt-3 space-y-3">
      <p className="text-sm">Saison {season.label} ist abgeschlossen ({dm(season.closed_at!)}). Die Tabelle steht fest; Abzeichen, Prüfseite und Glückwunsch-Fenster sind aktiv.</p>
      {(results.data?.length ?? 0) > 0 && <Card><CardContent className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
        <span>Glückwunsch-Mails: {results.data!.filter(r => r.award_mailed_at).length} von {results.data!.length} versendet</span>
        <MailButtons mode="awards" seasonId={season.id} label="Glückwunsch-Mails" canSend onSent={() => void qc.invalidateQueries({ queryKey: ['admin-liga'] })}/>
      </CardContent></Card>}
      <Card><CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">{['Platz', 'Headhunter', 'Auszeichnung', 'Preis', 'Wert', 'Ausgegeben'].map(h => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{(results.data ?? []).map(r => <tr key={r.recruiter_id} className="border-b last:border-0">
            <td className="px-4 py-2 tabular-nums">{r.rank}</td>
            <td className="px-4 py-2"><span className="font-medium">{r.full_name}</span><span className="block text-xs text-muted-foreground">{[r.company_name, r.email].filter(Boolean).join(' · ')}</span></td>
            <td className="px-4 py-2 text-xs text-[#A07F2C]">{r.awards.map(a => `✦ ${AWARD_LABEL[a]}`).join(' · ')}</td>
            <td className="px-4 py-2 text-xs">{(r.prizes ?? []).join(' · ')}</td>
            <td className="px-4 py-2 tabular-nums">{euro(r.prize_value)}</td>
            <td className="px-4 py-2"><label className="flex items-center gap-2 text-xs"><Checkbox checked={!!r.prize_done_at} onCheckedChange={v => void done(r.recruiter_id, v === true)}/>{r.prize_done_at ? dm(r.prize_done_at) : 'offen'}</label></td>
          </tr>)}</tbody>
        </table>
        {results.data?.length === 0 && <p className="p-4 text-sm text-muted-foreground">In dieser Saison wurde keine Auszeichnung vergeben.</p>}
      </CardContent></Card>
    </div>;
  }

  const Step = ({ n, ok, children }: { n: number; ok: boolean; children: React.ReactNode }) =>
    <li className="flex items-center gap-2 text-sm"><span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-xs', ok && 'border-success bg-success/15 text-success')}>{ok ? <Check className="h-3.5 w-3.5"/> : n}</span>{children}</li>;

  return <div className="mt-3 space-y-4">
    <ol className="flex flex-wrap gap-4">
      <Step n={1} ok={ready}>Nachfrist vorbei{!ready && ` (${st.text})`}</Step>
      <Step n={2} ok={ready && !!preview.data}>Ergebnis prüfen</Step>
      <Step n={3} ok={false}>Vergeben</Step>
    </ol>
    {!ready && <Card><CardContent className="p-5 text-sm text-muted-foreground">Abschließen geht nach dem {dmy(addDays(season.ends_on, season.grace_days))}: Saisonende plus {season.grace_days} Tage Nachfrist für spät gemeldete Termine.</CardContent></Card>}
    {ready && <div className="grid gap-4 md:grid-cols-2">
      <Card><CardContent className="space-y-2 p-5 text-sm">
        <h2 className="font-semibold">Ergebnis</h2>
        {preview.isLoading && <Loader2 className="h-4 w-4 animate-spin"/>}
        <Line label={AWARD_LABEL.season_winner} value={winner ? `${winner.full_name} · ${winner.points}` : 'niemand erfüllt die Mindestleistung'}/>
        <Line label={AWARD_LABEL.top_performer} value={tops.length ? `${Math.max(...tops.map(t => t.rank)) === 1 ? 'Platz 1' : `Plätze 1–${Math.max(...tops.map(t => t.rank))}`} · ${tops.length} ${tops.length === 1 ? 'Person' : 'Personen'}` : '—'}/>
        <Line label={AWARD_LABEL.newcomer} value={newcomer ? `${newcomer.full_name} · ${newcomer.points}` : '—'}/>
        {accurate && <Line label={AWARD_LABEL.accurate} value={`${accurate.full_name}`}/>}
        {excluded.map(x => <Line key={x.recruiter_id} label="aus der Saison" value={`${x.full_name} · ${x.exclusion_reason}`}/>)}
      </CardContent></Card>
      <Card><CardContent className="space-y-2 p-5 text-sm">
        <h2 className="font-semibold">Beim Vergeben passiert</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Abzeichen und Prüfseite für {plan.length} {plan.length === 1 ? 'Person' : 'Personen'}</li>
          <li>Fenster „Du bist …“ beim nächsten Öffnen, Mitteilung im Postfach</li>
          <li>Abzeichen im Signatur-Baustein, auf der Urkunde und beim Kunden unter „Wer sucht für Sie“</li>
          <li>Tabelle {season.label} wird eingefroren</li>
          <li>Preise danach hier abhaken, sobald sie ausgegeben sind</li>
        </ul>
        <Button className="mt-2" disabled={!preview.data} onClick={() => setConfirm(true)}>Auszeichnungen vergeben</Button>
      </CardContent></Card>
    </div>}
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Saison {season.label} abschließen?</DialogTitle>
          <DialogDescription>Die Tabelle wird eingefroren und die Auszeichnungen gehen raus. Das lässt sich nicht rückgängig machen.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Abbrechen</Button>
          <Button disabled={busy} onClick={() => void close()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Abschließen und vergeben</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <p className="flex justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0"><span className="text-muted-foreground">{label}</span><span className="text-right">{value}</span></p>;
}

/** Vorschau (nichts wird gesendet), Test an Marko, bei Glückwunsch-Mails auch der echte Versand. */
function MailButtons({ mode, seasonId, label, canSend, onSent }: { mode: 'weekly' | 'awards'; seasonId?: string; label: string; canSend?: boolean; onSent?: () => void }) {
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof ligaMail>> | null>(null);
  const [confirm, setConfirm] = useState(false);
  const run = async (kind: 'preview' | 'test' | 'send') => {
    setBusy(kind);
    try {
      const r = await ligaMail({ mode, season_id: seasonId, dry_run: kind === 'preview', test: kind === 'test' });
      if (kind === 'preview') setPreview(r);
      else { toast.success(kind === 'test' ? 'Testmail an marko.benko@bluewater-bridge.de unterwegs' : `${r.sent} Mails versendet${r.failed ? `, ${r.failed} fehlgeschlagen` : ''}`); onSent?.(); setConfirm(false); }
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Ging nicht.'); }
    finally { setBusy(''); }
  };
  return <>
    <span className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run('preview')}><Mail className="mr-1.5 h-3.5 w-3.5"/>{label}: Vorschau</Button>
      <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run('test')}>Test an mich</Button>
      {canSend && <Button size="sm" disabled={!!busy} onClick={() => setConfirm(true)}>Jetzt senden</Button>}
    </span>
    <Dialog open={!!preview} onOpenChange={o => { if (!o) setPreview(null); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{label}: Vorschau</DialogTitle>
          <DialogDescription>{preview?.total ?? 0} Empfänger. Nichts wurde gesendet.</DialogDescription></DialogHeader>
        <ul className="max-h-32 space-y-0.5 overflow-auto text-xs">{preview?.preview.map(p => <li key={p.to}><span className="text-muted-foreground">{p.to}</span> · {p.subject}</li>)}</ul>
        {preview?.sample_html && <iframe title="Beispielmail" srcDoc={preview.sample_html} className="h-96 w-full rounded border"/>}
      </DialogContent>
    </Dialog>
    <Dialog open={confirm} onOpenChange={setConfirm}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{label} jetzt senden?</DialogTitle>
          <DialogDescription>Geht an alle Ausgezeichneten, die sie noch nicht bekommen haben. Bereits versendete werden übersprungen.</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" onClick={() => setConfirm(false)}>Abbrechen</Button>
          <Button disabled={!!busy} onClick={() => void run('send')}>{busy === 'send' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Senden</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

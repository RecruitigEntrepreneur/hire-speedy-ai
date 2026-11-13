import { PartnerTierProgress } from './PartnerTierProgress';
import { fmtDate, fmtMonthYear } from '@/lib/localeFormat';
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Check, ChevronRight, Copy, ExternalLink, FileText, Globe, Linkedin, Loader2, Lock, Mail, Megaphone, MessageSquare, Printer, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { onboardingApi } from '@/lib/recruiterOnboardingApi';
import { cn } from '@/lib/utils';
import { PartnerCard } from './PartnerCard';
import { LigaAwardCard } from '../liga/LigaAwardCard';
import {
  AWARD_LABEL, ligaAwardsOf, ligaHallOfFame, ligaMe, ligaSetPreferences, ligaTable, quotePct,
  type LigaAwardBadge, type LigaMe, type LigaTableRow,
} from '@/lib/liga';
import { LINKEDIN_READY, PartnerPanel, type PanelActions, type PanelKind, type PartnerPerson } from './PartnerPanels';
import { copyRich, copyText, downloadBase64, downloadSvgAsPng, downloadText } from './partnerClient';
import { checkUrl, type Lang, type PartnerChannel, type PartnerStatusRow } from '../../../../supabase/functions/_shared/recruiter-partner';

/**
 * Profil › Partnerstatus (Wireframe „Kacheln mit Seitenfenster“, freigegeben 22.09.2026).
 * Oben der Nachweis mit den drei Knöpfen für den Alltag, darunter je Stelle eine Kachel
 * zum einmaligen Einrichten, unten Sichtbarkeit und Stufen. Alles freiwillig.
 */
const TILES: { kind: PanelKind; icon: LucideIcon }[] = [
  { kind: 'linkedin', icon: Linkedin },
  { kind: 'signature', icon: Mail },
  { kind: 'website', icon: Globe },
  { kind: 'outreach', icon: MessageSquare },
  { kind: 'post', icon: Megaphone },
  { kind: 'print', icon: Printer },
];

function Section({ title, icon: Icon, children }: { title: string; icon?: LucideIcon; children: ReactNode }) {
  return <Card><CardContent className="space-y-4 p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold">{Icon && <Icon className="h-5 w-5"/>}{title}</h2>
    {children}
  </CardContent></Card>;
}

/** Mit Auszeichnung der Matchunt Liga sagen Signatur und Beitrag, was neu ist. */
function tilePurpose(t: TFunction, kind: PanelKind, award: LigaAwardBadge | null): string {
  if (award && kind === 'signature') return t('tiles.signature.purposeAward');
  if (award && kind === 'post') return t('tiles.post.purposeAward', { award: t(`recruiterLiga:award.${award.award}`, { defaultValue: AWARD_LABEL[award.award] }), season: award.season_label });
  return t(`tiles.${kind}.purpose`);
}

function tileState(t: TFunction, kind: PanelKind, p: PartnerStatusRow): { text: string; done?: boolean; muted?: boolean } {
  switch (kind) {
    case 'linkedin': return !LINKEDIN_READY ? { text: t('state.soon'), muted: true } : p.channels.linkedin ? { text: t('state.setUp'), done: true } : { text: t('state.twoMinutes') };
    case 'signature': return p.channels.signature ? { text: t('state.setUp'), done: true } : { text: t('state.twoMinutes') };
    case 'website': return p.website_domain ? { text: t('state.runsOn', { domain: p.website_domain }), done: true } : { text: t('state.twoMinutes') };
    case 'outreach': return { text: t('state.languages') };
    case 'post': return p.channels.post ? { text: t('state.shared'), done: true } : { text: t('state.template') };
    default: return { text: t('state.files') };
  }
}

export function PartnerStatusSection({ partner, person, onChange }: { partner: PartnerStatusRow; person: PartnerPerson; onChange: (row: PartnerStatusRow) => void }) {
  const { toast } = useToast();
  const { t } = useTranslation(['recruiterPartner', 'recruiterLiga']);
  const qc = useQueryClient();
  const [params] = useSearchParams();
  // ?panel=signature öffnet ein Fenster direkt, etwa aus dem Glückwunsch-Fenster der Liga.
  const [open, setOpen] = useState<PanelKind | null>(() => TILES.find(tile => tile.kind === params.get('panel'))?.kind ?? null);
  const [busy, setBusy] = useState('');
  const awardQ = useQuery({ queryKey: ['liga', 'award', partner.user_id], queryFn: () => ligaAwardsOf([partner.user_id]), retry: false });
  const award = awardQ.data?.[partner.user_id] ?? null;
  const liga = useQuery({ queryKey: ['liga', 'me', null], queryFn: () => ligaMe(null), retry: false });
  const ligaRows = useQuery({ queryKey: ['liga', 'table', null], queryFn: () => ligaTable(null), retry: false, enabled: !!liga.data?.season });
  const hall = useQuery({ queryKey: ['liga', 'hall'], queryFn: ligaHallOfFame, retry: false, enabled: !!liga.data });
  const myAwards = (hall.data ?? []).filter(r => r.is_me && r.awards.length > 0);
  const number = partner.partner_number;
  const fail = (e: unknown, fallback: string) => toast({ title: e instanceof Error ? e.message : fallback, variant: 'destructive' });

  const run = async (key: string, work: () => Promise<void>, fallback: string) => {
    setBusy(key);
    try { await work(); } catch (e) { fail(e, fallback); } finally { setBusy(''); }
  };
  const settings = (patch: Record<string, unknown>, key: string) => run(key, async () => {
    onChange(await onboardingApi<PartnerStatusRow>(false, { action: 'partner-settings', ...patch }));
  }, t('errors.setting'));
  const ligaPref = (patch: { show_name?: boolean; weekly_mail?: boolean }, key: string) => run(key, async () => {
    await ligaSetPreferences(patch);
    await qc.invalidateQueries({ queryKey: ['liga'] });
  }, t('errors.setting'));

  const actions: PanelActions = {
    busy,
    copy: (value, what = t('what.text')) => { void copyText(value).then(() => toast({ title: t('copied', { what }) }), e => fail(e, t('errors.copy'))); },
    copyRich: (html, plain) => { void copyRich(html, plain).then(() => toast({ title: t('signatureCopied'), description: t('signatureCopiedText') }), e => fail(e, t('errors.copy'))); },
    channel: (channel: PartnerChannel, done: boolean) => void settings({ channel, done }, 'channel'),
    certificate: () => void run('certificate', async () => {
      const r = await onboardingApi<{ file_name: string; base64: string }>(false, { action: 'partner-certificate' });
      downloadBase64(r.base64, r.file_name, 'application/pdf');
    }, t('errors.certificate')),
    qr: (format: 'svg' | 'png') => void run('qr', async () => {
      const r = await onboardingApi<{ svg: string; file_name: string }>(false, { action: 'partner-qr' });
      if (format === 'svg') downloadText(r.svg, r.file_name, 'image/svg+xml');
      else await downloadSvgAsPng(r.svg, r.file_name.replace(/\.svg$/, '.png'));
    }, t('errors.qr')),
    testMail: (lang: Lang) => void run('test', async () => {
      const r = await onboardingApi<{ sent: boolean; to: string }>(false, { action: 'partner-signature-test', lang });
      toast({ title: t('testMailSent'), description: t('testMailSentText', { to: r.to }) });
    }, t('errors.testMail')),
  };

  const header = <Card><CardContent className="space-y-1 p-5">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><Award className="h-5 w-5"/>{t('title')}</h2>
    <p className="text-sm text-muted-foreground">{t('lead')}</p>
  </CardContent></Card>;

  if (partner.ended_at) {
    return <div className="space-y-5">
      {header}
      <Section title={t('ended.title')}>
        <p className="text-sm">{t('ended.text', { date: fmtDate(partner.ended_at) })}</p>
        <p className="text-sm text-muted-foreground">{t('ended.questions')}</p>
      </Section>
    </div>;
  }

  return <div className="space-y-5">
    {header}

    <Section title={t('proof.title')}>
      <div className="flex flex-wrap items-center gap-4">
        <PartnerCard tier={partner.tier} size="lg"/>
        {award && <LigaAwardCard award={award.award} season={award.season_label} size="lg"/>}
        <div>
          <p className="font-medium">{t('proof.activeSince', { date: fmtMonthYear(partner.granted_at) })}</p>
          <p className="text-sm text-muted-foreground"><Trans t={t} i18nKey="proof.number" values={{ number }} components={{ mono: <span className="font-mono"/> }}/></p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => actions.copy(checkUrl(number), t('what.checkLink'))}><Copy className="mr-2 h-4 w-4"/>{t('proof.copyLink')}</Button>
        <Button variant="outline" disabled={busy === 'certificate'} onClick={actions.certificate}>
          {busy === 'certificate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4"/>}{t('proof.certificate')}
        </Button>
        <Button variant="outline" onClick={() => window.open(`/partner/${number}`, '_blank', 'noopener')}>{t('proof.checkPage')}<ExternalLink className="ml-2 h-4 w-4"/></Button>
      </div>
      <p className="text-xs text-muted-foreground">{t('proof.note')}</p>
    </Section>

    {liga.data?.participant && liga.data.season && liga.data.me && <LigaSection me={liga.data} rows={ligaRows.data ?? []}/>}

    <Section title={t('setup.title')}>
      <div className="grid gap-2 sm:grid-cols-2">
        {TILES.map(tile => {
          const s = tileState(t, tile.kind, partner);
          return <button key={tile.kind} type="button" onClick={() => setOpen(tile.kind)}
            className="group flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted"><tile.icon className="h-4 w-4"/></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t(`tiles.${tile.kind}.title`)}</span>
              <span className="block text-xs text-muted-foreground">{tilePurpose(t, tile.kind, award)}</span>
              <span className={cn('mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px]',
                s.done ? 'bg-success/15 text-success' : s.muted ? 'bg-muted text-muted-foreground' : 'border border-border text-muted-foreground')}>
                {s.done && <Check className="h-3 w-3 shrink-0"/>}<span className="truncate">{s.text}</span>
              </span>
            </span>
            <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"/>
          </button>;
        })}
      </div>
    </Section>

    <div className="grid gap-5 md:grid-cols-2">
      <Section title={t('visibility.title')}>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="partner-directory" className="space-y-1 font-normal"><span className="block text-sm font-medium">{t('visibility.directory')}</span>
              <span className="block text-xs text-muted-foreground">{t('visibility.directoryHint')}</span></Label>
            <Switch id="partner-directory" checked={!!partner.directory_consent_at} disabled={busy === 'directory'} onCheckedChange={v => void settings({ directory: v }, 'directory')}/>
          </div>
          <div className="flex items-start justify-between gap-3">
            <Label htmlFor="partner-expertise" className="space-y-1 font-normal"><span className="block text-sm font-medium">{t('visibility.expertise')}</span>
              <span className="block text-xs text-muted-foreground">{person.focus ? t('visibility.expertiseShows', { focus: person.focus }) : t('visibility.expertiseDefault')}</span></Label>
            <Switch id="partner-expertise" checked={!!partner.show_expertise_at} disabled={busy === 'expertise'} onCheckedChange={v => void settings({ expertise: v }, 'expertise')}/>
          </div>
          {liga.data?.participant && <>
            <div className="flex items-start justify-between gap-3">
              <Label htmlFor="liga-name" className="space-y-1 font-normal"><span className="block text-sm font-medium">{t('visibility.ligaName')}</span>
                <span className="block text-xs text-muted-foreground">{t('visibility.ligaNameHint')}</span></Label>
              <Switch id="liga-name" checked={!!liga.data.prefs?.show_name} disabled={busy === 'liga-name'} onCheckedChange={v => void ligaPref({ show_name: v }, 'liga-name')}/>
            </div>
            <div className="flex items-start justify-between gap-3">
              <Label htmlFor="liga-mail" className="space-y-1 font-normal"><span className="block text-sm font-medium">{t('visibility.ligaMail')}</span>
                <span className="block text-xs text-muted-foreground">{t('visibility.ligaMailHint')}</span></Label>
              <Switch id="liga-mail" checked={liga.data.prefs?.weekly_mail ?? true} disabled={busy === 'liga-mail'} onCheckedChange={v => void ligaPref({ weekly_mail: v }, 'liga-mail')}/>
            </div>
          </>}
        </div>
      </Section>
      <Section title={t('tiers.title')}>
        <PartnerTierProgress/>
        <div className="space-y-2 border-t border-border pt-4 text-sm">
          <p className="flex items-start gap-2"><span className="text-[#C8A24A]">✦</span>
            <span><span className="font-medium">Top Performer</span><span className="block text-xs text-muted-foreground">{t('tiers.topPerformer', { top: liga.data?.season?.top_n ?? 10 })}</span></span></p>
          {myAwards.length > 0 && <div className="flex flex-wrap gap-1.5">{myAwards.flatMap(r => r.awards.map(a => <LigaAwardCard key={`${r.season_id}-${a}`} award={a} season={r.season_label} size="sm"/>))}</div>}
        </div>
      </Section>
    </div>

    <Sheet open={open !== null} onOpenChange={o => { if (!o) setOpen(null); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {open && <PartnerPanel kind={open} partner={partner} person={person} actions={actions} award={award}/>}
      </SheetContent>
    </Sheet>
  </div>;
}

/** Eigener Stand der laufenden Saison und die Spitze der Tabelle (Wireframe 20.10.2026). */
function LigaSection({ me, rows }: { me: LigaMe; rows: LigaTableRow[] }) {
  const { t } = useTranslation(['recruiterPartner', 'recruiterLiga']);
  const s = me.season!;
  const m = me.me!;
  const head = rows.filter(r => r.rank <= 3);
  const mine = rows.find(r => r.is_me && r.rank > 3);
  return <Section title={t('liga.title', { label: s.label })}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <p className="text-xl font-semibold">{m.rank ? t('recruiterLiga:rankOf', { rank: m.rank, total: m.participants }) : t('recruiterLiga:notRanked')}</p>
        <p className="text-sm text-muted-foreground">{m.points} {t('recruiterLiga:table.points')} · {t('recruiterLiga:placements', { count: m.placements })} · {t('recruiterLiga:interviews', { count: m.interviews })} · {t('recruiterLiga:quoteValue', { value: quotePct(m.quote) })}</p>
        <p className="text-sm">
          {m.rank && m.rank > 1 && m.gap_above !== null ? t('recruiterLiga:standing.gapAbove', { count: m.gap_above, rank: m.rank - 1 }) : ''}
          {t('recruiterLiga:standing.topSeason', { top: s.top_n })}
        </p>
      </div>
      {rows.length > 0 && <ol className="min-w-[14rem] space-y-1 text-sm">
        {[...head, ...(mine ? [mine] : [])].map((r, i) => <li key={`${r.rank}-${i}`} className={cn('flex justify-between gap-4', r.is_me && 'font-medium')}>
          <span><span className="mr-2 tabular-nums text-muted-foreground">{r.rank}</span>{r.is_me ? t('recruiterLiga:you') : (r.name && r.name.trim()) || (r.city && r.city.trim() ? t('recruiterLiga:nameFromCity', { city: r.city.trim() }) : t('recruiterLiga:table.headhunter'))}</span>
          <span className="tabular-nums">{r.points}</span>
        </li>)}
      </ol>}
    </div>
    <p className="text-xs text-muted-foreground"><Trans t={t} i18nKey="liga.note" components={{ link: <Link to="/recruiter/liga" className="underline"/> }}/></p>
  </Section>;
}

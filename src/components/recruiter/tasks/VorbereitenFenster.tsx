import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarPlus, FileUp, Loader2, NotebookPen, Phone, PhoneCall, Play, Video, Zap, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { jobMeta } from '@/components/candidates/matching/PassendeStellen';
import { EinladungFenster } from '@/components/recruiter/termin/EinladungFenster';
import { supabase } from '@/integrations/supabase/client';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useMatchV41 } from '@/hooks/useMatchV41';
import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { tagMonat, uhrzeit, VORBEREITEN_TON, type Vorbereitung } from '@/lib/kandidatVorbereiten';
import { effectiveTier, TIER_STYLE } from '@/lib/matchV41';
import { einladungApi } from '@/lib/terminApi';
import { cn } from '@/lib/utils';
import { daysAgo, prepTexts } from './taskWindow';
import { clockTime, dayMonth } from './sprache';

const NS = 'recruiterTasks';

/** Uhrzeit in Berlin, in der Sprache der Oberfläche */
const zeit = (iso: string) => clockTime(iso, 'Europe/Berlin');
const tel = (nummer: string) => `tel:${nummer.replace(/[^\d+]/g, '')}`;
const artenKey = (arten: string[]) => (arten.length > 1 ? 'both' : arten[0] === 'teams' ? 'teams' : 'phone');

/** Zwei Spalten mit dem, was der Headhunter vor dem Handgriff wissen muss. */
function Fakten({ zeilen }: { zeilen: [string, ReactNode][] }) {
  return <dl className="divide-y divide-border/40 rounded-lg border border-border/60 text-sm">
    {zeilen.map(([k, w]) => <div key={k} className="flex gap-3 px-3 py-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 flex-1">{w}</dd>
    </div>)}
  </dl>;
}

function Nebenweg({ Icon, children, onClick }: { Icon: LucideIcon; children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground">
    <Icon className="h-3.5 w-3.5"/>{children}
  </button>;
}

function Anrufen({ v, variant = 'outline' }: { v: Vorbereitung; variant?: 'default' | 'outline' }) {
  const { t } = useTranslation(NS);
  if (!v.telefon) return <Button variant={variant} disabled title={t('pw.noPhoneTitle')} className="gap-1.5"><Phone className="h-4 w-4"/>{t('guide.call')}</Button>;
  return <Button variant={variant} asChild className="gap-1.5"><a href={tel(v.telefon)}><Phone className="h-4 w-4"/>{t('guide.call')}</a></Button>;
}

function Wahl({ an, onClick, titel, unter }: { an: boolean; onClick: () => void; titel: string; unter: string }) {
  return <button type="button" role="radio" aria-checked={an} onClick={onClick} className={cn('rounded-lg border p-3 text-left transition-colors', an ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30')}>
    <span className="block text-sm font-medium">{titel}</span>
    <span className="mt-0.5 block text-xs text-muted-foreground">{unter}</span>
  </button>;
}

/** „Bereit“: gleich hier sehen, wo der Kandidat passt, und einreichen. */
function PassendeStellenListe({ v, onEinreichen }: { v: Vorbereitung; onEinreichen: (ziel: string) => void }) {
  const { t: tx } = useTranslation(NS);
  const m = useMatchV41(v.candidateId);
  const vorname = v.name.split(/\s+/)[0];
  const offen = m.rows.filter(r => ['sehr_passend', 'passend', 'pruefen'].includes(effectiveTier(r)) && !r.submittedAt);
  return <div className="space-y-3">
    {m.loading ? <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-12 w-full"/>)}</div>
      : m.unavailable || m.error ? <p className="text-sm text-muted-foreground">{tx('pw.jobs.unavailable')}</p>
        : offen.length === 0 ? <p className="text-sm text-muted-foreground">{tx('pw.jobs.none', { first: vorname })}</p>
          : <>
            <p className="text-sm">{tx('pw.jobs.intro', { first: vorname })}</p>
            <ul className="divide-y divide-border/40 rounded-lg border border-border/60">
              {offen.slice(0, 3).map(r => {
                const t = effectiveTier(r);
                return <li key={r.job_id} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.job?.title ?? tx('fallback.job')}</span>
                    <span className="block truncate text-xs text-muted-foreground">{[jobMeta(r), t === 'ausgeblendet' ? null : TIER_STYLE[t].label].filter(Boolean).join(' · ')}</span>
                  </span>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEinreichen(r.job_id)}>{tx('pw.jobs.submit')}</Button>
                </li>;
              })}
            </ul>
          </>}
  </div>;
}

function Inhalt({ v, onClose, onChanged }: { v: Vorbereitung; onClose: () => void; onChanged: () => void }) {
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [einladen, setEinladen] = useState(false);
  const [arbeitet, setArbeitet] = useState<string | null>(null);
  // „Gespräch war“: fast immer hat es stattgefunden, darum ist „Ja“ schon gewählt
  const [fandStatt, setFandStatt] = useState(true);
  const [terminFrage, setTerminFrage] = useState(false);
  const [terminAm, setTerminAm] = useState('');
  const vorname = v.name.split(/\s+/)[0];
  const texte = prepTexts(v);
  /** „heute“, „gestern“, „vor 3 Tagen“ als Teil eines festen Textes: <basis>Today, <basis>Yesterday, <basis>Days */
  const seit = (basis: string, iso: string) => { const d = daysAgo(iso); return d <= 0 ? t(`${basis}Today`) : d === 1 ? t(`${basis}Yesterday`) : t(`${basis}Days`, { count: d }); };

  const zumProfil = (suche = '') => { onClose(); navigate(`/recruiter/candidates/${v.candidateId}${suche}`); };
  const fertig = (meldung: string) => { toast.success(meldung); onChanged(); onClose(); };

  /** „Nicht relevant“: dauerhaft aus den Aufgaben, der Kandidat selbst bleibt. `label` steht im Aktivitätslog und bleibt deutsch. */
  const ausblenden = async (grund: string, label: string) => {
    setArbeitet(grund);
    const { error } = await (supabase as unknown as { from: (t: string) => any }).from('candidates') // eslint-disable-line @typescript-eslint/no-explicit-any
      .update({ prep_dismissed_at: new Date().toISOString(), prep_dismissed_reason: grund }).eq('id', v.candidateId);
    setArbeitet(null);
    if (error) { toast.error(t('pw.toast.failed')); return; }
    await logActivity(v.candidateId, 'note', `Aus den Aufgaben genommen: ${label}`, undefined, { kind: 'prep_dismissed', reason: grund });
    fertig(t('pw.toast.removed', { first: vorname }));
  };

  const anrufErgebnis = async (titel: string, meta: Record<string, unknown>) => {
    const r = await logActivity(v.candidateId, 'call', titel, undefined, { ...meta, task_category: `prep_${v.art}` });
    if (!r) toast.error(t('pw.toast.logFailed'));
    return !!r;
  };

  const erinnern = async () => {
    setArbeitet('erinnern');
    try {
      await einladungApi.erinnern(v.candidateId);
      fertig(t('pw.toast.reminded', { first: vorname }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('pw.toast.failed'));
    } finally { setArbeitet(null); }
  };

  const keinInteresse = async () => {
    setArbeitet('kein_interesse');
    try { await einladungApi.zurueckziehen(v.candidateId); } catch { /* Link läuft ohnehin ab, das Ausblenden zählt */ }
    await ausblenden('kein_interesse', 'Kein Interesse');
  };

  const terminSpeichern = async () => {
    const ms = Date.parse(terminAm);
    if (Number.isNaN(ms)) { toast.error(t('pw.toast.needDateTime')); return; }
    const iso = new Date(ms).toISOString();
    // Titel und outcome im Aktivitätslog: gespeichert, bleiben deutsch
    if (await anrufErgebnis(`Termin ausgemacht: ${tagMonat(iso)} um ${uhrzeit(iso)}`, { reached: true, outcome: 'Termin ausgemacht', termin_at: iso })) {
      fertig(t('pw.toast.appointmentSaved', { date: dayMonth(iso), time: zeit(iso) }));
    }
  };

  const nichtRelevant = <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
    <span>{t('pw.dismiss.question')}</span>
    {([['vormerken', 'Nur vormerken'], ['passt_nicht', 'Passt nicht'], ['kein_interesse', 'Kein Interesse']] as const).map(([k, l]) =>
      <button key={k} type="button" disabled={!!arbeitet} onClick={() => void ausblenden(k, l)} className="underline-offset-2 hover:text-foreground hover:underline">{t(`pw.dismiss.${k}`)}</button>)}
  </div>;

  let koerper: ReactNode;
  let unter: string;
  const rolle = v.rolle ? `${v.rolle} · ` : '';
  switch (v.art) {
    case 'termin': {
      const tm = v.termin!;
      const min = Math.round((Date.parse(tm.start) - Date.now()) / 60_000);
      unter = `${rolle}${t('pw.sub.termin', { time: zeit(tm.start) })}`;
      koerper = <div className="space-y-4">
        <p className="text-sm">{min > 0 && min <= 90 ? t('pw.termin.startsIn', { min }) : min <= 0 ? t('pw.termin.running') : t('pw.termin.startsAt', { time: zeit(tm.start) })}</p>
        <Fakten zeilen={[
          [t('pw.facts.when'), t('pw.facts.whenValue', { from: zeit(tm.start), to: zeit(tm.ende) })],
          [t('pw.facts.how'), t(`pw.how.${tm.mode === 'teams' ? 'teams' : 'phone'}${tm.selbstGebucht ? 'Self' : 'Phone'}`, { first: vorname })],
          ...(tm.notiz ? [[t('pw.facts.noteFrom', { first: vorname }), tm.notiz] as [string, ReactNode]] : []),
          [t('pw.facts.cv'), v.lebenslauf ? t('pw.facts.cvYes') : t('pw.facts.cvNo')],
        ]}/>
        <div className="flex flex-wrap gap-2">
          {tm.mode === 'teams' && tm.joinUrl
            ? <Button asChild className="gap-1.5"><a href={tm.joinUrl} target="_blank" rel="noreferrer"><Video className="h-4 w-4"/>{t('pw.join')}</a></Button>
            : <Anrufen v={v} variant="default"/>}
          <Button variant="outline" className="gap-1.5" onClick={() => zumProfil('?interview=live')}><NotebookPen className="h-4 w-4"/>{t('pw.openInterview')}</Button>
        </div>
      </div>;
      break;
    }
    case 'war':
      unter = `${rolle}${seit('pw.sub.war', v.seit)}`;
      koerper = <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('pw.war.question')}</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('pw.war.question')}>
            <Wahl an={fandStatt} onClick={() => setFandStatt(true)} titel={t('nach.yes')} unter={t('pw.war.yesHint')}/>
            <Wahl an={!fandStatt} onClick={() => setFandStatt(false)} titel={t('pw.war.no')} unter={t('pw.war.noHint')}/>
          </div>
        </div>
        {fandStatt
          ? <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button className="gap-1.5" onClick={() => zumProfil('?interview=live')}><NotebookPen className="h-4 w-4"/>{t('prep.war.knopf')}</Button>
            <Nebenweg Icon={FileUp} onClick={() => zumProfil('?interview=import')}>{t('pw.war.dropNotes')}</Nebenweg>
            <Nebenweg Icon={Zap} onClick={() => zumProfil('?interview=quick')}>{t('pw.war.fromMemory')}</Nebenweg>
          </div>
          : <div className="flex flex-wrap gap-2">
            <Button className="gap-1.5" disabled={!!arbeitet} onClick={async () => {
              await logActivity(v.candidateId, 'note', 'Nicht zum Gespräch erschienen', undefined, { kind: 'no_show' });
              onChanged();
              setEinladen(true);
            }}><CalendarPlus className="h-4 w-4"/>{t('pw.war.inviteAgain')}</Button>
            <Button variant="outline" disabled={!!arbeitet} onClick={async () => {
              await logActivity(v.candidateId, 'note', 'Nicht zum Gespräch erschienen', undefined, { kind: 'no_show' });
              await ausblenden('nicht_erschienen', 'Nicht erschienen');
            }}>{t('pw.war.sortOut')}</Button>
          </div>}
      </div>;
      break;
    case 'entwurf':
      unter = `${rolle}${seit('pw.sub.entwurf', v.seit)}`;
      koerper = <div className="space-y-4">
        {v.luecken.length > 0 && <div>
          <p className="mb-1.5 text-sm font-medium">{t('pw.entwurf.open')}</p>
          <div className="flex flex-wrap gap-1.5">{v.luecken.map(l => <Badge key={l} variant="outline" className="font-normal">{l}</Badge>)}</div>
        </div>}
        <p className="text-sm text-muted-foreground">{v.luecken.length ? t('pw.entwurf.gaps', { first: vorname }) : t('pw.entwurf.complete')}</p>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" onClick={() => zumProfil('?interview=live')}><Play className="h-4 w-4"/>{t('pw.entwurf.finish')}</Button>
          <Anrufen v={v}/>
        </div>
      </div>;
      break;
    case 'eingeladen': {
      const e = v.einladung!;
      unter = `${rolle}${seit('pw.sub.eingeladen', v.seit)}`;
      koerper = <div className="space-y-4">
        <p className="text-sm">{e.geoeffnetAm ? t('pw.eingeladen.opened', { first: vorname }) : t('pw.eingeladen.notOpened', { first: vorname })}</p>
        <Fakten zeilen={[
          [t('pw.facts.invited'), t(e.perMail ? 'pw.eingeladen.byMail' : 'pw.eingeladen.ownText', { date: dayMonth(e.am), modes: t(`pw.modes.${artenKey(e.arten)}`) })],
          [t('pw.facts.link'), e.geoeffnetAm ? seit('pw.eingeladen.linkOpened', e.geoeffnetAm) : t('view.notOpened')],
          [t('pw.facts.phone'), v.telefon ?? t('pw.facts.phoneMissing')],
        ]}/>
        <div className="flex flex-wrap gap-2">
          <Anrufen v={v} variant="default"/>
          <Button variant="outline" className="gap-1.5" disabled={!!arbeitet || !v.email} title={v.email ? undefined : t('pw.noEmailTitle')} onClick={() => void erinnern()}>
            {arbeitet === 'erinnern' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Bell className="h-4 w-4"/>}{t('pw.eingeladen.remindByMail')}
          </Button>
        </div>
        <div className="border-t pt-3">
          <p className="mb-1.5 text-sm font-medium">{t('pw.eingeladen.callResult')}</p>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={async () => { if (await anrufErgebnis('Erreicht: Bucht selbst', { reached: true, outcome: 'Bucht selbst' })) fertig(t('pw.toast.booksSelf', { first: vorname })); }}>{t('pw.eingeladen.booksSelf')}</Button>
            <Button size="sm" variant={terminFrage ? 'secondary' : 'outline'} disabled={!!arbeitet} onClick={() => setTerminFrage(x => !x)}>{t('pw.eingeladen.appointmentMade')}</Button>
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={async () => { if (await anrufErgebnis('Nicht erreicht', { reached: false })) fertig(t('pw.toast.notReached')); }}>{t('outcomes.nicht_erreicht')}</Button>
            <Button size="sm" variant="outline" disabled={!!arbeitet} onClick={() => void keinInteresse()}>{t('pw.dismiss.kein_interesse')}</Button>
          </div>
          {terminFrage && <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input type="datetime-local" aria-label={t('pw.eingeladen.dateTimeAria')} className="h-9 w-56" value={terminAm} onChange={x => setTerminAm(x.target.value)}/>
            <Button size="sm" disabled={!terminAm} onClick={() => void terminSpeichern()}>{t('pw.eingeladen.saveAppointment')}</Button>
          </div>}
        </div>
      </div>;
      break;
    }
    case 'bereit':
      unter = `${rolle}${t('pw.sub.bereit')}`;
      koerper = <div className="space-y-4">
        <PassendeStellenListe v={v} onEinreichen={id => zumProfil(`?einreichen=${id}`)}/>
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button variant="outline" onClick={() => zumProfil('?einreichen=alle')}>{t('pw.jobs.all')}</Button>
          <Button variant="ghost" disabled={!!arbeitet} onClick={() => void ausblenden('vormerken', 'Nur vormerken')}>{t('pw.dismiss.vormerken')}</Button>
        </div>
      </div>;
      break;
    default:
      unter = `${rolle}${seit('pw.sub.neu', v.seit)}`;
      koerper = <div className="space-y-4">
        <p className="text-sm">{t('pw.neu.text', { first: vorname })}</p>
        <Fakten zeilen={[
          [t('pw.facts.cv'), v.lebenslauf ? t('pw.facts.cvYes') : t('pw.facts.cvNo')],
          [t('pw.facts.contact'), v.email && v.telefon ? t('pw.contact.both') : v.email ? t('pw.contact.emailOnly') : v.telefon ? t('pw.contact.phoneOnly') : t('pw.contact.none')],
          ...(v.stellen ? [[t('pw.facts.fits'), t('pw.facts.fitsValue', { count: v.stellen })] as [string, ReactNode]] : []),
        ]}/>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" onClick={() => setEinladen(true)}><CalendarPlus className="h-4 w-4"/>{t('pw.neu.invite')}</Button>
          <Anrufen v={v}/>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <Nebenweg Icon={PhoneCall} onClick={() => zumProfil('?interview=live')}>{t('pw.neu.live')}</Nebenweg>
          <Nebenweg Icon={FileUp} onClick={() => zumProfil('?interview=import')}>{t('pw.neu.alreadyTalked')}</Nebenweg>
        </div>
        {nichtRelevant}
      </div>;
  }

  return <>
    <Dialog open={!einladen} onOpenChange={o => { if (!o) onClose(); }}>
      {/* Fokus aufs Fenster statt auf den Namen, sonst steht beim Öffnen ein Rahmen um den Namen */}
      <DialogContent className="outline-none sm:max-w-lg" onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement).focus(); }}>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <button type="button" className="hover:underline" onClick={() => zumProfil()}>{v.name}</button>
            <Badge variant="secondary" className={cn('px-1.5 text-[11px] font-medium', VORBEREITEN_TON[v.art])}>{texte.pill}</Badge>
          </DialogTitle>
          <DialogDescription>{unter}</DialogDescription>
        </DialogHeader>
        {koerper}
      </DialogContent>
    </Dialog>
    <EinladungFenster
      open={einladen}
      onOpenChange={o => { setEinladen(o); if (!o) onClose(); }}
      candidate={{ id: v.candidateId, vorname, email: v.email }}
      onFertig={onChanged}
    />
  </>;
}

/**
 * Fenster der Aufgaben vor der Einreichung (01.11.2026). Hält die Aufgabe fest, damit es nach dem
 * Neuladen nicht verschwindet, solange der Headhunter noch darin arbeitet.
 */
export function VorbereitenFenster({ item, onClose, onChanged }: { item: UnifiedTaskItem | null; onClose: () => void; onChanged: () => void }) {
  if (!item?.prep) return null;
  return <Inhalt key={item.itemId} v={item.prep} onClose={onClose} onChanged={onChanged}/>;
}

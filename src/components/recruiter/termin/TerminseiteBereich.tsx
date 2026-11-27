import { toolText, VIDEO_TOOL_NAME, VIDEO_TOOL_SHORT, type VideoTool } from '@/lib/interviewScheduling';
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarOff, Check, Copy, ExternalLink, Loader2, Phone, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarConnectCard, KalenderKachelnBald } from '@/components/interview/calendar/CalendarConnectCard';
import { InterviewHoursEditor } from '@/components/interview/calendar/InterviewHoursEditor';
import { useCalendarStatus } from '@/components/interview/calendar/useCalendarStatus';
import { normalizeRules, type InterviewHoursRules } from '@/lib/interviewScheduling';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { SLUG_MUSTER, slugFrei, slugVorschlag, TERMINSEITE_BASIS } from '@/lib/terminApi';
import { cn } from '@/lib/utils';
import { TERMIN_STANDARD } from '../../../../supabase/functions/_shared/termin-seite';
import { useRuecksprung, useTerminseite } from './useTerminseite';

/**
 * Profil › Terminseite (21.10.2026): Kalender verbinden, buchbare Zeiten,
 * freischalten. Rechts die Seite so, wie Kandidaten sie sehen. Wer aus dem
 * Beitragsfenster kommt, landet nach dem Freischalten wieder dort (zurueck).
 */
const RUECKSPRUNG = '/recruiter/profile/terminseite';
const DAUERN = [15, 30, 45, 60];
// Beschriftung je Vorlauf: recruiterTermin → seite.vorlauf.h<Stunden>
const VORLAUF = [1, 4, 24, 48] as const;

function Schritt({ nr, fertig, titel, rechts, children }: { nr: number; fertig: boolean; titel: string; rechts?: React.ReactNode; children: React.ReactNode }) {
  return <section className="flex gap-3 border-t border-border py-4 first:border-t-0 first:pt-0">
    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium', fertig ? 'bg-foreground text-background' : 'bg-muted')}>
      {fertig ? <Check className="h-3.5 w-3.5"/> : nr}
    </span>
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{titel}</h3>{rechts}</div>
      {children}
    </div>
  </section>;
}

export function TerminseiteBereich({ zurueck }: { zurueck?: string | null }) {
  const { t } = useTranslation('recruiterTermin');
  const vorlauf = useMemo(() => VORLAUF.map((value) => ({ value, label: t(`seite.vorlauf.h${value}`) })), [t]);
  // ?kalender= verarbeitet der Kalender-Baustein in Schritt 1 (auch den IT-Weg)
  useRuecksprung({ kalender: false });
  const kontakt = useRecruiterKontakt();
  const kal = useCalendarStatus();
  const { zeile, isLoading, speichern } = useTerminseite();
  const [regeln, setRegeln] = useState<InterviewHoursRules>(TERMIN_STANDARD as InterviewHoursRules);
  const [dauer, setDauer] = useState(15);
  const [teams, setTeams] = useState(true);
  const [werkzeug, setWerkzeug] = useState<VideoTool>('teams');
  // Variante B (26.11.2026): ohne Kalender freischalten geht, nach einer kurzen Rückfrage
  const [ohneFrage, setOhneFrage] = useState(false);
  const [telefon, setTelefon] = useState(true);
  const [slug, setSlug] = useState('');
  const [slugFehler, setSlugFehler] = useState('');
  const [geaendert, setGeaendert] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (zeile) {
      setRegeln(Object.keys(zeile.rules ?? {}).length ? normalizeRules(zeile.rules) : (TERMIN_STANDARD as InterviewHoursRules));
      setDauer(zeile.duration_minutes);
      setTeams(zeile.allow_teams);
      if (zeile.video_tool) setWerkzeug(zeile.video_tool);
      setTelefon(zeile.allow_phone);
      setSlug(zeile.slug);
    } else if (kontakt?.name) {
      setSlug(slugVorschlag(kontakt.name));
    }
  }, [isLoading, zeile, kontakt?.name]);

  const verbunden = kal.state === 'connected';
  // Video-Werkzeuge: das des Kalenders (Outlook → Teams, Google → Meet) und Zoom, wenn verbunden
  const werkzeuge: VideoTool[] = [
    kal.status?.provider === 'google' && verbunden ? 'meet' : 'teams',
    ...(kal.status?.zoom?.state === 'connected' ? ['zoom' as const] : []),
  ];
  const werkzeugJetzt: VideoTool = werkzeuge.includes(werkzeug) ? werkzeug : werkzeuge[0];
  const mitOutlook = verbunden && kal.status?.provider === 'microsoft';
  const matchuntTeams = !!kal.status?.providers?.matchuntTeams;
  // Teams ohne Outlook: Link nur über das Matchunt-Konto
  const teamsOhneLink = teams && werkzeugJetzt === 'teams' && !mitOutlook && !matchuntTeams;
  const videoHinweis = werkzeugJetzt === 'zoom' ? t('seite.zoomHint')
    : werkzeugJetzt === 'meet' ? toolText(t('seite.teamsHint'), 'meet', 'google')
    : mitOutlook ? t('seite.teamsHint')
    : matchuntTeams ? t('seite.teamsMatchunt') : t('seite.teamsNoLink');
  const aktiv = !!zeile?.active;
  const link = `${TERMINSEITE_BASIS}${slug}`;
  const name = kontakt?.name || t('seite.yourName');
  const initialen = useMemo(() => name.split(/\s+/).slice(0, 2).map(teil => teil[0]?.toUpperCase()).join(''), [name]);

  const pruefeSlug = async (s: string) => {
    if (!SLUG_MUSTER.test(s) || s.length < 3 || s === 'termin') { setSlugFehler(t('seite.slugInvalid')); return false; }
    if (!(await slugFrei(s))) { setSlugFehler(t('seite.slugTaken')); return false; }
    setSlugFehler('');
    return true;
  };

  const sichern = async (aktivNeu = aktiv, ohneKalenderOk = false) => {
    if (!teams && !telefon) { toast.error(t('seite.chooseMode')); return; }
    if (aktivNeu && teamsOhneLink) { toast.error(t('seite.noTeamsLink')); return; }
    if (!(await pruefeSlug(slug))) return;
    // Ohne Kalender einschalten: erst bewusst bestätigen (Doppelbelegung möglich)
    if (aktivNeu && !aktiv && !verbunden && !ohneKalenderOk) { setOhneFrage(true); return; }
    try {
      // video_tool nur mitschicken, wenn die Spalte schon da ist oder nicht Teams gewählt ist (Migration 20261126100000)
      const mitWerkzeug = (zeile && 'video_tool' in zeile) || werkzeugJetzt !== 'teams' ? { video_tool: werkzeugJetzt } : {};
      await speichern.mutateAsync({ slug, active: aktivNeu, rules: normalizeRules(regeln), duration_minutes: dauer, allow_teams: teams, allow_phone: telefon, ...mitWerkzeug });
      setGeaendert(false);
      toast.success(aktivNeu && !aktiv ? t('seite.activated') : t('seite.saved'));
      if (aktivNeu && zurueck) window.location.href = zurueck;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('seite.saveFailed'));
    }
  };

  const kopieren = async () => {
    try { await navigator.clipboard.writeText(link); toast.success(t('seite.linkCopied')); } catch { toast.error(t('seite.copyFailed')); }
  };

  const aendere = <T,>(set: (v: T) => void) => (v: T) => { set(v); setGeaendert(true); };

  if (isLoading || kal.isLoading) return <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>{t('seite.loading')}</CardContent></Card>;

  return <Card id="terminseite">
    <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5"/>{t('seite.title')}</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('seite.intro')}</p>

        {/* Schritt 1 (16.11.2026): derselbe Kalender-Baustein wie beim Kunden und in der Übersicht, mit du –
            App-Kacheln Outlook-Kalender und Google Kalender („Bald“), was wir lesen und schreiben, IT-Freigabe, Trennen. */}
        <Schritt nr={1} fertig={verbunden} titel={t('seite.step1')}>
          {kal.state === 'not_configured'
            // Ohne Microsoft-App bei Matchunt: beide Kacheln ausgegraut mit „Bald“
            ? <div className="space-y-2">
              <KalenderKachelnBald fuer="headhunter"/>
              <p className="text-xs text-muted-foreground">{t('seite.notConfigured')}</p>
              <p className="text-xs text-muted-foreground">{t('seite.privacy')}</p>
            </div>
            : <CalendarConnectCard variant="settings" fuer="headhunter" eingebettet
                ruecksprung={zurueck ? `${RUECKSPRUNG}?zurueck=${encodeURIComponent(zurueck)}` : RUECKSPRUNG} />}
        </Schritt>

        <Schritt nr={2} fertig={!!zeile && !geaendert} titel={t('seite.step2')}>
          <InterviewHoursEditor value={regeln} onChange={aendere(setRegeln)} compact noticeOptions={vorlauf}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('seite.duration')}</Label>
              <Select value={String(dauer)} onValueChange={v => aendere(setDauer)(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                <SelectContent>{DAUERN.map(d => <SelectItem key={d} value={String(d)}>{t('seite.minutes', { count: d })}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">{t('seite.modes')}</p>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={teams} onCheckedChange={v => aendere(setTeams)(v === true)}/>{VIDEO_TOOL_SHORT[werkzeugJetzt]} <span className="text-xs text-muted-foreground">{videoHinweis}</span></label>
              <label className="flex items-center gap-2"><Checkbox checked={telefon} onCheckedChange={v => aendere(setTelefon)(v === true)}/>{t('seite.phone')} <span className="text-xs text-muted-foreground">{t('seite.phoneHint')}</span></label>
            </div>
            {teams && werkzeuge.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t('seite.videoVia')}</span>
                {werkzeuge.map(w => (
                  <button key={w} type="button" onClick={() => aendere(setWerkzeug)(w)}
                          className={cn('rounded-full border px-2.5 py-0.5 transition-colors', w === werkzeugJetzt ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground hover:text-foreground')}>
                    {VIDEO_TOOL_NAME[w]}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('seite.modesHint')}</p>
          </div>
        </Schritt>

        <Schritt nr={3} fertig={aktiv} titel={t('seite.step3')} rechts={<label className="flex items-center gap-2 text-xs text-muted-foreground">{t('seite.activeSwitch')}<Switch checked={aktiv} disabled={speichern.isPending} onCheckedChange={v => void sichern(v)}/></label>}>
          <div className="space-y-1.5">
            <Label htmlFor="termin-slug" className="text-xs text-muted-foreground">{t('seite.address')}</Label>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                <span className="shrink-0 text-muted-foreground">matchunt.ai/t/</span>
                <Input id="termin-slug" value={slug} className="h-9 border-0 px-1 shadow-none focus-visible:ring-0" onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setGeaendert(true); }} onBlur={() => void pruefeSlug(slug)}/>
              </div>
              <Button variant="outline" size="sm" onClick={() => void kopieren()} disabled={!zeile}><Copy className="mr-1.5 h-3.5 w-3.5"/>{t('seite.copy')}</Button>
            </div>
            {slugFehler && <p role="alert" className="text-xs text-destructive">{slugFehler}</p>}
            <p className="text-xs text-muted-foreground">{t('seite.addressHint')}</p>
          </div>
          {!verbunden && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarOff className="h-3.5 w-3.5 shrink-0"/>{aktiv ? t('seite.withoutCalendarActive') : t('seite.calendarBetter')}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={speichern.isPending || (!geaendert && !!zeile)} onClick={() => void sichern()}>{speichern.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>}{t('seite.save')}</Button>
            {zurueck && aktiv && <Button size="sm" variant="outline" onClick={() => { window.location.href = zurueck; }}>{t('seite.backToPost')}</Button>}
          </div>
        </Schritt>
      </div>

      <aside className="space-y-3 rounded-lg bg-muted/40 p-4">
        <p className="text-xs text-muted-foreground">{t('seite.preview')}</p>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">{initialen || '·'}</span><div><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">{t('seite.headhunter')}</p></div></div>
          <div><p className="text-sm font-medium">{t('seite.confidential', { count: dauer })}</p><p className="flex items-center gap-2 text-xs text-muted-foreground">{teams && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3"/>{VIDEO_TOOL_SHORT[werkzeugJetzt]}</span>}{telefon && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3"/>{t('seite.phone')}</span>}<span>{t('seite.timezone')}</span></p></div>
          <div className="grid grid-cols-3 gap-1.5">{['9:00', '9:30', '10:15', '11:30', '14:00', '16:15'].map(z => <span key={z} className="rounded-md border border-border py-1 text-center text-xs">{z}</span>)}</div>
          <p className="text-[11px] text-muted-foreground">{t('seite.sampleTimes')}</p>
        </div>
        {aktiv && <Button variant="outline" size="sm" asChild><a href={`/t/${slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>{t('seite.openPage')}</a></Button>}
        <p className="text-xs text-muted-foreground">{t('seite.previewHint')}</p>
      </aside>
    </CardContent>
    <AlertDialog open={ohneFrage} onOpenChange={setOhneFrage}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('seite.withoutTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('seite.withoutLead')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => document.getElementById('terminseite')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{t('seite.withoutConnect')}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void sichern(true, true)}>{t('seite.withoutConfirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}

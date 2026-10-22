import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarOff, Check, CheckCircle2, Copy, ExternalLink, Loader2, Phone, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
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
const VORLAUF = [{ value: 1, label: 'in 1 Std' }, { value: 4, label: 'in 4 Std' }, { value: 24, label: 'ab morgen' }, { value: 48, label: 'ab 2 Tagen' }];

function Schritt({ nr, fertig, titel, rechts, children }: { nr: number; fertig: boolean; titel: string; rechts?: React.ReactNode; children: React.ReactNode }) {
  return <section className="flex gap-3 border-t border-border py-4 first:border-t-0 first:pt-0">
    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium', fertig ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted')}>
      {fertig ? <Check className="h-3.5 w-3.5"/> : nr}
    </span>
    <div className="min-w-0 flex-1 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{titel}</h3>{rechts}</div>
      {children}
    </div>
  </section>;
}

export function TerminseiteBereich({ zurueck }: { zurueck?: string | null }) {
  useRuecksprung();
  const kontakt = useRecruiterKontakt();
  const kal = useCalendarStatus();
  const { zeile, isLoading, speichern } = useTerminseite();
  const [regeln, setRegeln] = useState<InterviewHoursRules>(TERMIN_STANDARD as InterviewHoursRules);
  const [dauer, setDauer] = useState(15);
  const [teams, setTeams] = useState(true);
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
      setTelefon(zeile.allow_phone);
      setSlug(zeile.slug);
    } else if (kontakt?.name) {
      setSlug(slugVorschlag(kontakt.name));
    }
  }, [isLoading, zeile, kontakt?.name]);

  const verbunden = kal.state === 'connected';
  const aktiv = !!zeile?.active;
  const link = `${TERMINSEITE_BASIS}${slug}`;
  const name = kontakt?.name || 'Dein Name';
  const initialen = useMemo(() => name.split(/\s+/).slice(0, 2).map(t => t[0]?.toUpperCase()).join(''), [name]);

  const pruefeSlug = async (s: string) => {
    if (!SLUG_MUSTER.test(s) || s.length < 3 || s === 'termin') { setSlugFehler('Nur Kleinbuchstaben, Ziffern und Bindestriche, mindestens 3 Zeichen.'); return false; }
    if (!(await slugFrei(s))) { setSlugFehler('Diese Adresse ist schon vergeben.'); return false; }
    setSlugFehler('');
    return true;
  };

  const sichern = async (aktivNeu = aktiv) => {
    if (!teams && !telefon) { toast.error('Wähle mindestens eine Gesprächsart.'); return; }
    if (!(await pruefeSlug(slug))) return;
    if (aktivNeu && !verbunden) { toast.error('Verbinde zuerst deinen Kalender. Ohne ihn zeigt die Seite keine freien Zeiten.'); return; }
    try {
      await speichern.mutateAsync({ slug, active: aktivNeu, rules: normalizeRules(regeln), duration_minutes: dauer, allow_teams: teams, allow_phone: telefon });
      setGeaendert(false);
      toast.success(aktivNeu && !aktiv ? 'Terminseite ist aktiv.' : 'Gespeichert.');
      if (aktivNeu && zurueck) window.location.href = zurueck;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern hat nicht geklappt.');
    }
  };

  const kopieren = async () => {
    try { await navigator.clipboard.writeText(link); toast.success('Link kopiert.'); } catch { toast.error('Kopieren ging nicht.'); }
  };

  const aendere = <T,>(set: (v: T) => void) => (v: T) => { set(v); setGeaendert(true); };

  if (isLoading || kal.isLoading) return <Card><CardContent className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Lädt …</CardContent></Card>;

  return <Card id="terminseite">
    <CardContent className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5"/>Deine Terminseite</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Kandidaten aus deinen LinkedIn-Beiträgen buchen hier ein Gespräch mit dir, nur zu Zeiten, die in deinem Kalender wirklich frei sind.</p>

        <Schritt nr={1} fertig={verbunden} titel="Kalender verbinden" rechts={verbunden ? <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" disabled={kal.disconnect.isPending} onClick={() => kal.disconnect.mutate()}>Trennen</Button> : undefined}>
          {verbunden
            ? <p className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4"/>Outlook verbunden{kal.status?.accountEmail ? ` · ${kal.status.accountEmail}` : ''}</p>
            : kal.state === 'not_configured'
              ? <p className="text-sm text-muted-foreground">Die Kalender-Anbindung ist bei Matchunt noch nicht eingerichtet.</p>
              : <div className="space-y-2">
                {kal.state === 'expired' && <p className="text-sm text-amber-700">Die Verbindung ist abgelaufen. Bitte neu verbinden.</p>}
                {kal.state === 'it_pending' && <p className="text-sm text-amber-700">Deine IT muss der Verbindung einmal zustimmen; wir haben ihr den Link geschickt.</p>}
                <Button size="sm" disabled={kal.connect.isPending} onClick={() => kal.connect.mutate(zurueck ? `${RUECKSPRUNG}?zurueck=${encodeURIComponent(zurueck)}` : RUECKSPRUNG)}>
                  {kal.connect.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/> : null}Mit Outlook verbinden
                </Button>
              </div>}
          <p className="text-xs text-muted-foreground">Matchunt sieht nur frei/belegt und trägt gebuchte Termine mit Teams-Link ein. Keine Mails, keine Inhalte. Google folgt.</p>
        </Schritt>

        <Schritt nr={2} fertig={!!zeile && !geaendert} titel="Wann du buchbar bist">
          <InterviewHoursEditor value={regeln} onChange={aendere(setRegeln)} compact noticeOptions={VORLAUF}/>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dauer eines Gesprächs</Label>
              <Select value={String(dauer)} onValueChange={v => aendere(setDauer)(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue/></SelectTrigger>
                <SelectContent>{DAUERN.map(d => <SelectItem key={d} value={String(d)}>{d} Minuten</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Gesprächsart, die Kandidaten wählen können</p>
            <div className="flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2"><Checkbox checked={teams} onCheckedChange={v => aendere(setTeams)(v === true)}/>Teams <span className="text-xs text-muted-foreground">Link aus deinem Outlook</span></label>
              <label className="flex items-center gap-2"><Checkbox checked={telefon} onCheckedChange={v => aendere(setTelefon)(v === true)}/>Telefon <span className="text-xs text-muted-foreground">du rufst an</span></label>
            </div>
            <p className="text-xs text-muted-foreground">Beides an: Kandidat wählt. Eins an: steht fest. Bei Telefon ist seine Nummer Pflicht.</p>
          </div>
        </Schritt>

        <Schritt nr={3} fertig={aktiv} titel="Freischalten" rechts={<label className="flex items-center gap-2 text-xs text-muted-foreground">aktiv<Switch checked={aktiv} disabled={speichern.isPending} onCheckedChange={v => void sichern(v)}/></label>}>
          <div className="space-y-1.5">
            <Label htmlFor="termin-slug" className="text-xs text-muted-foreground">Adresse deiner Terminseite</Label>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                <span className="shrink-0 text-muted-foreground">matchunt.ai/t/</span>
                <Input id="termin-slug" value={slug} className="h-9 border-0 px-1 shadow-none focus-visible:ring-0" onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setGeaendert(true); }} onBlur={() => void pruefeSlug(slug)}/>
              </div>
              <Button variant="outline" size="sm" onClick={() => void kopieren()} disabled={!zeile}><Copy className="mr-1.5 h-3.5 w-3.5"/>Kopieren</Button>
            </div>
            {slugFehler && <p role="alert" className="text-xs text-destructive">{slugFehler}</p>}
            <p className="text-xs text-muted-foreground">Je Stelle kommt der Teil …/tax-manager-… dazu. Ausschalten stoppt neue Buchungen, gebuchte Termine bleiben.</p>
          </div>
          {!verbunden && <p className="flex items-center gap-1.5 text-xs text-amber-700"><CalendarOff className="h-3.5 w-3.5"/>Erst den Kalender verbinden, dann lässt sich die Seite freischalten.</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={speichern.isPending || (!geaendert && !!zeile)} onClick={() => void sichern()}>{speichern.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin"/>}Speichern</Button>
            {zurueck && aktiv && <Button size="sm" variant="outline" onClick={() => { window.location.href = zurueck; }}>Zurück zum Beitrag</Button>}
          </div>
        </Schritt>
      </div>

      <aside className="space-y-3 rounded-lg bg-muted/40 p-4">
        <p className="text-xs text-muted-foreground">Vorschau · so sehen Kandidaten es</p>
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">{initialen || '·'}</span><div><p className="text-sm font-medium">{name}</p><p className="text-xs text-muted-foreground">Headhunter</p></div></div>
          <div><p className="text-sm font-medium">{dauer} Minuten, vertraulich</p><p className="flex items-center gap-2 text-xs text-muted-foreground">{teams && <span className="inline-flex items-center gap-1"><Video className="h-3 w-3"/>Teams</span>}{telefon && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3"/>Telefon</span>}<span>· Zeitzone Berlin</span></p></div>
          <div className="grid grid-cols-3 gap-1.5">{['9:00', '9:30', '10:15', '11:30', '14:00', '16:15'].map(z => <span key={z} className="rounded-md border border-border py-1 text-center text-xs">{z}</span>)}</div>
          <p className="text-[11px] text-muted-foreground">Beispielzeiten; echte Zeiten kommen aus deinem Kalender.</p>
        </div>
        {aktiv && <Button variant="outline" size="sm" asChild><a href={`/t/${slug}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5"/>Seite öffnen</a></Button>}
        <p className="text-xs text-muted-foreground">Name und Position kommen aus „Über dich“. Dein Foto bleibt privat.</p>
      </aside>
    </CardContent>
  </Card>;
}

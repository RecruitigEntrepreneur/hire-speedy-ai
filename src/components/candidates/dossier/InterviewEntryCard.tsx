import { useEffect, useState, type ReactNode } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Bell, CalendarPlus, Check, CheckCircle2, Circle, CircleDot, Copy, FileUp, Loader2, NotebookPen, Phone, PhoneCall, Play, Video, X, Zap, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EinladungFenster } from '@/components/recruiter/termin/EinladungFenster';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { useErstgespraeche, type Erstgespraech } from '@/components/recruiter/termin/Erstgespraeche';
import { useKandidatEinladung } from '@/components/recruiter/termin/useKandidatEinladung';
import { useLebenslaufAnfrage, vorTagenKurz } from '@/components/recruiter/termin/useLebenslaufAnfrage';
import { cvViewUrl } from '@/hooks/useCandidateCv';
import type { CurrentCv } from '@/lib/candidateCv';
import { einladungApi, einladungsLink } from '@/lib/terminApi';
import { cn } from '@/lib/utils';

interface SourceRow {
  id: string;
  kind: string;
  label: string | null;
  created_at: string;
  raw_text: string | null;
  expires_at: string | null;
}

const KIND_LABEL: Record<string, string> = {
  notes: 'Eigene Notizen',
  transcript: 'Transkript',
  photo: 'Foto',
  mail: 'Mail',
  quick: 'Aus dem Kopf',
  live: 'Live-Interview',
};

const SCHRITTE = ['Einladen', 'Termin', 'Gespräch', 'Abschließen'];
const MAX_LUECKEN = 4;

const wann = (iso: string) => format(new Date(iso), "EEE, d.M. 'um' HH:mm", { locale: de });
const tage = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
const vorTagen = (iso: string) => { const d = tage(iso); return d === 0 ? 'heute' : d === 1 ? 'gestern' : `vor ${d} Tagen`; };

/** Zeile unter dem Hauptknopf: die anderen Wege, ruhig und klein. */
function Nebenweg({ Icon, children, onClick, disabled }: { Icon: LucideIcon; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50">
    <Icon className="h-3.5 w-3.5"/>{children}
  </button>;
}

/**
 * Das Kandidateninterview in einer Karte (01.11.2026, Gestaltung „Mit Schritten“): Einladen,
 * Termin, Gespräch, Abschließen. Immer ein klarer nächster Schritt, die anderen Wege darunter.
 * Darunter der Verlauf der Quellen.
 */
export function InterviewEntryCard({
  candidateId,
  vorname,
  email,
  hasInterview,
  completed = false,
  interviewDate,
  gaps = [],
  refreshKey,
  onImport,
  onLive,
  onQuick,
  lebenslauf = null,
  onLebenslaufAnfragen,
  onUploadCv,
}: {
  candidateId: string;
  vorname: string;
  email: string | null;
  hasInterview: boolean;
  /** Mit „Interview abschließen“ beendet und alle Mindestangaben da (interviewCompleted). */
  completed?: boolean;
  interviewDate: string | null;
  /** Was zum Abschließen noch fehlt (abschlussGaps). */
  gaps?: { key: string; label: string }[];
  refreshKey?: number;
  onImport: () => void;
  onLive: () => void;
  onQuick: () => void;
  /** Aktueller Lebenslauf aus der Akte (05.11.2026): Zeile unten in der Karte. */
  lebenslauf?: CurrentCv | null;
  onLebenslaufAnfragen?: () => void;
  onUploadCv?: () => void;
}) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [arbeitet, setArbeitet] = useState<'erinnern' | 'link' | 'zurueck' | null>(null);
  const { einladung, neuLaden, isLoading: einladungLaedt } = useKandidatEinladung(candidateId);
  const { anfrage, neuLaden: anfrageNeu } = useLebenslaufAnfrage(candidateId);
  const [erinnert, setErinnert] = useState(false);

  const lebenslaufErinnern = async () => {
    try {
      await einladungApi.lebenslaufErinnern(candidateId);
      setErinnert(true);
      toast.success(`Erinnerung an ${vorname} ist raus.`);
      void anfrageNeu();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Erinnerung konnte nicht verschickt werden.');
    }
  };
  const lebenslaufAnsehen = async () => {
    const url = lebenslauf ? await cvViewUrl(lebenslauf) : null;
    if (url) window.open(url, '_blank', 'noopener'); else toast.error('Der Lebenslauf konnte nicht geöffnet werden.');
  };
  const { data: termine = [], isLoading: termineLaden } = useErstgespraeche({ candidateId });

  // „Anlegen und einladen“ (Kandidaten anlegen, 04.11.2026): ?einladen=1 öffnet gleich die Einladung.
  const [suche, setSuche] = useSearchParams();
  useEffect(() => {
    if (suche.get('einladen') !== '1') return;
    setFensterOffen(true);
    const next = new URLSearchParams(suche);
    next.delete('einladen');
    setSuche(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    supabase
      .from('candidate_capture_sources' as never)
      .select('id, kind, label, created_at, raw_text, expires_at')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => setSources(error ? [] : ((data ?? []) as unknown as SourceRow[])));
  }, [candidateId, refreshKey]);

  const jetzt = Date.now();
  const kommend: Erstgespraech | undefined = termine.find((t) => Date.parse(t.ends_at) > jetzt);
  const vorbei: Erstgespraech | undefined = [...termine].reverse().find((t) => Date.parse(t.ends_at) <= jetzt);
  const laeuft = !!kommend && Date.parse(kommend.starts_at) - 10 * 60_000 <= jetzt;

  const aktion = async (art: 'erinnern' | 'link' | 'zurueck') => {
    setArbeitet(art);
    try {
      if (art === 'erinnern') { await einladungApi.erinnern(candidateId); toast.success(`Erinnerung an ${vorname} ist raus.`); }
      if (art === 'link') {
        const r = await einladungApi.link(candidateId);
        await navigator.clipboard.writeText(einladungsLink(r.token));
        toast.success('Persönlicher Link kopiert.');
      }
      if (art === 'zurueck') { await einladungApi.zurueckziehen(candidateId); toast.success('Einladung zurückgezogen. Der Link gilt nicht mehr.'); }
      await neuLaden();
      notifyTasksChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat gerade nicht geklappt.');
    } finally { setArbeitet(null); }
  };

  // Stand der Karte: abgeschlossen, Termin steht, Interview offen, eingeladen, noch nichts.
  let schritt: number;
  let etikett: { text: string; ton: string };
  let titel: string;
  let unter: ReactNode;
  let haupt: ReactNode;
  let neben: ReactNode;

  const liveBtn = <Nebenweg Icon={PhoneCall} onClick={onLive}>Jetzt live führen</Nebenweg>;
  const einwerfen = <Nebenweg Icon={FileUp} onClick={onImport}>Notizen einwerfen</Nebenweg>;
  const ausKopf = <Nebenweg Icon={Zap} onClick={onQuick}>Aus dem Kopf</Nebenweg>;

  if (completed) {
    schritt = SCHRITTE.length;
    etikett = { text: 'abgeschlossen', ton: 'bg-success/10 text-success' };
    titel = 'Interview abgeschlossen';
    unter = interviewDate ? `Am ${new Date(interviewDate).toLocaleDateString('de-DE')}` : 'Du kannst den Kandidaten einreichen.';
    haupt = <Button size="sm" variant="outline" onClick={onLive} className="gap-1.5"><NotebookPen className="h-3.5 w-3.5"/>Interview öffnen</Button>;
    neben = <Nebenweg Icon={FileUp} onClick={onImport}>Nachtrag einwerfen</Nebenweg>;
  } else if (kommend) {
    schritt = 2;
    etikett = { text: laeuft ? 'jetzt' : 'Termin steht', ton: 'bg-primary/10 text-primary' };
    titel = wann(kommend.starts_at);
    unter = `${Math.round((Date.parse(kommend.ends_at) - Date.parse(kommend.starts_at)) / 60000)} Minuten · ${kommend.mode === 'teams' ? 'Teams' : `Telefon${kommend.phone ? ` ${kommend.phone}` : ''}`} · ${vorname} hat gebucht`;
    haupt = kommend.mode === 'teams' && kommend.join_url
      ? <Button size="sm" asChild className="gap-1.5"><a href={kommend.join_url} target="_blank" rel="noreferrer"><Video className="h-3.5 w-3.5"/>Beitreten</a></Button>
      : kommend.mode === 'phone' && kommend.phone
        ? <Button size="sm" asChild className="gap-1.5"><a href={`tel:${kommend.phone.replace(/[^\d+]/g, '')}`}><Phone className="h-3.5 w-3.5"/>Anrufen</a></Button>
        : <Button size="sm" onClick={onLive} className="gap-1.5"><NotebookPen className="h-3.5 w-3.5"/>Interview öffnen</Button>;
    neben = <>{(kommend.join_url || kommend.phone) && <Nebenweg Icon={NotebookPen} onClick={onLive}>Interview öffnen</Nebenweg>}{einwerfen}</>;
  } else if (hasInterview || vorbei) {
    schritt = 3;
    const nochNichts = !hasInterview;
    etikett = { text: nochNichts ? 'Gespräch war' : 'Entwurf', ton: 'bg-warning/10 text-warning' };
    if (nochNichts && vorbei) {
      titel = `Gespräch war ${vorTagen(vorbei.starts_at)}`;
      unter = 'Halte es fest, solange es frisch ist.';
    } else if (gaps.length) {
      titel = `Interview-Entwurf · ${gaps.length === 1 ? '1 Angabe fehlt' : `${gaps.length} Angaben fehlen`}`;
      unter = `Noch offen: ${gaps.slice(0, MAX_LUECKEN).map((g) => g.label).join(', ')}${gaps.length > MAX_LUECKEN ? ` und ${gaps.length - MAX_LUECKEN} weitere` : ''}`;
    } else {
      titel = 'Alle Angaben da';
      unter = 'Noch 1 Schritt, dann kannst du einreichen.';
    }
    const fertig = !nochNichts && !gaps.length;
    haupt = <Button size="sm" onClick={onLive} className="gap-1.5">{fertig ? <Check className="h-3.5 w-3.5"/> : <Play className="h-3.5 w-3.5"/>}{fertig ? 'Interview abschließen' : nochNichts ? 'Interview erfassen' : 'Interview fertigstellen'}</Button>;
    neben = <>{einwerfen}{ausKopf}</>;
  } else if (einladung) {
    schritt = 1;
    etikett = { text: `wartet auf ${vorname}`, ton: 'bg-warning/10 text-warning' };
    titel = `${vorname} ist eingeladen`;
    const art = einladung.arten.length > 1 ? 'Teams oder Telefon' : einladung.arten[0] === 'teams' ? 'Teams' : 'Telefon';
    unter = `${vorTagen(einladung.seit)[0].toUpperCase()}${vorTagen(einladung.seit).slice(1)} ${einladung.perMail ? 'per Mail' : 'als Link'} · ${art} · ${einladung.geoeffnet ? 'Link geöffnet' : 'noch nicht geöffnet'}`;
    haupt = email
      ? <Button size="sm" onClick={() => void aktion('erinnern')} disabled={!!arbeitet} className="gap-1.5">{arbeitet === 'erinnern' ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Bell className="h-3.5 w-3.5"/>}Erinnern</Button>
      : <Button size="sm" onClick={() => void aktion('link')} disabled={!!arbeitet} className="gap-1.5"><Copy className="h-3.5 w-3.5"/>Link kopieren</Button>;
    neben = <>{email && <Nebenweg Icon={Copy} onClick={() => void aktion('link')} disabled={!!arbeitet}>Link kopieren</Nebenweg>}{liveBtn}<Nebenweg Icon={X} onClick={() => void aktion('zurueck')} disabled={!!arbeitet}>Einladung zurückziehen</Nebenweg></>;
  } else {
    schritt = 0;
    etikett = { text: 'noch keins erfasst', ton: 'bg-muted text-muted-foreground' };
    titel = `Noch kein Gespräch mit ${vorname}`;
    unter = 'Lade ein oder halte fest, was ihr schon besprochen habt.';
    haupt = <Button size="sm" onClick={() => setFensterOffen(true)} className="gap-1.5"><CalendarPlus className="h-3.5 w-3.5"/>Zum Gespräch einladen</Button>;
    neben = <>{liveBtn}{einwerfen}{ausKopf}</>;
  }

  // Beim ersten Laden keinen falschen Stand zeigen, der gleich wechselt.
  const laedt = !completed && !hasInterview && (einladungLaedt || termineLaden);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight">Interview</h3>
          {!laedt && <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', etikett.ton)}>{etikett.text}</span>}
        </div>

        <div className="flex items-center gap-1.5" aria-label={`Schritt ${Math.min(schritt + 1, SCHRITTE.length)} von ${SCHRITTE.length}`}>
          {SCHRITTE.map((s, i) => {
            const fertig = !laedt && i < schritt;
            const aktuell = !laedt && i === schritt;
            const Icon = fertig ? CheckCircle2 : aktuell ? CircleDot : Circle;
            return <div key={s} className={cn('flex items-center gap-1.5', i < SCHRITTE.length - 1 && 'flex-1')}>
              <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-[11px]', fertig ? 'text-success' : aktuell ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                <Icon className="h-3.5 w-3.5"/>{s}
              </span>
              {i < SCHRITTE.length - 1 && <span className={cn('h-px min-w-2 flex-1', fertig ? 'bg-success/50' : 'bg-border')}/>}
            </div>;
          })}
        </div>

        {laedt ? <div className="flex h-[74px] items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground"/></div> : <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[200px] flex-1">
              <p className="text-[15px] font-medium leading-snug">{titel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{unter}</p>
            </div>
            {haupt}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">{neben}</div>
        </>}

        {/* Lebenslauf (05.11.2026): ruhig in Grau, gelb wird es erst beim Einreichen. */}
        {!laedt && (
          <p className="border-t border-border pt-2.5 text-xs text-muted-foreground">
            {lebenslauf ? (
              <><span className="text-success">✓ Lebenslauf da</span> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => void lebenslaufAnsehen()}>ansehen</button></>
            ) : anfrage ? (
              <>
                {anfrage.linkedin_at ? 'LinkedIn-Profil da · Lebenslauf fehlt fürs Einreichen' : anfrage.weg === 'einladung' && einladung && !anfrage.reminded_at ? 'Lebenslauf: mit der Einladung angefragt' : `Lebenslauf: angefragt ${vorTagenKurz(anfrage.reminded_at ?? anfrage.sent_at ?? anfrage.created_at)}, noch nicht da`}
                {email && !erinnert && !(anfrage.weg === 'einladung' && einladung && !anfrage.reminded_at) && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={() => void lebenslaufErinnern()}>Erinnern</button></>}
              </>
            ) : (
              <>
                Lebenslauf fehlt
                {onLebenslaufAnfragen && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={onLebenslaufAnfragen}>anfragen</button></>}
                {onUploadCv && <> · <button type="button" className="underline-offset-2 hover:text-foreground hover:underline" onClick={onUploadCv}>selbst hochladen</button></>}
              </>
            )}
          </p>
        )}

        {sources.length > 0 && (
          <ul className="divide-y divide-border rounded-md border border-border text-xs">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                <span className="min-w-0 truncate">
                  {new Date(s.created_at).toLocaleDateString('de-DE')} · {KIND_LABEL[s.kind] ?? s.kind}
                  {s.label && s.label !== KIND_LABEL[s.kind] ? ` · ${s.label}` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {s.raw_text == null ? 'Rohtext gelöscht' : s.expires_at ? `Rohtext bis ${new Date(s.expires_at).toLocaleDateString('de-DE')}` : 'Bleibt gespeichert'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <EinladungFenster open={fensterOffen} onOpenChange={setFensterOffen} candidate={{ id: candidateId, vorname, email, hatLebenslauf: !!lebenslauf }} onFertig={() => { void neuLaden(); void anfrageNeu(); notifyTasksChanged(); }}/>
    </Card>
  );
}

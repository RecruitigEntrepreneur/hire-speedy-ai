import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, CalendarOff, Check, Copy, Loader2, Phone, Send, Video } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarStatus } from '@/components/interview/calendar/useCalendarStatus';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { einladungApi, einladungsLink, type Gespraechsart } from '@/lib/terminApi';
import { angebotArten, EINLADUNG_ANLAESSE, einladungsText, textMitLink, type Angebot, type EinladungAnlass } from '@/lib/einladungTexte';
import { cn } from '@/lib/utils';
import { useTerminseite } from './useTerminseite';

const ANGEBOTE: { key: Angebot; label: string; hinweis: string; Icon: typeof Video }[] = [
  { key: 'teams', label: 'Teams', hinweis: 'Link kommt automatisch', Icon: Video },
  { key: 'phone', label: 'Telefon', hinweis: 'Du rufst an', Icon: Phone },
  { key: 'beides', label: 'Beides', hinweis: 'Kandidat entscheidet', Icon: ArrowLeftRight },
];

const SPEICHER = 'matchunt.einladung.angebot';
const letztesAngebot = (): Angebot => {
  try {
    const v = localStorage.getItem(SPEICHER);
    return v === 'phone' || v === 'beides' ? v : 'teams';
  } catch { return 'teams'; }
};

/**
 * Kandidat zum Gespräch einladen (01.11.2026): Der Headhunter wählt, was er anbietet, und
 * schickt die Einladung per Mail über Matchunt oder selbst über LinkedIn oder WhatsApp.
 */
export function EinladungFenster({ open, onOpenChange, candidate, onFertig }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidate: { id: string; vorname: string; email: string | null };
  onFertig: () => void;
}) {
  const kontakt = useRecruiterKontakt();
  const { zeile, isLoading: seiteLaedt } = useTerminseite();
  const kal = useCalendarStatus();
  const hhVorname = (kontakt?.name ?? '').trim().split(/\s+/)[0] || '';
  const dauer = zeile?.duration_minutes ?? 15;
  const [angebot, setAngebot] = useState<Angebot>(letztesAngebot);
  const [anlass, setAnlass] = useState<EinladungAnlass>('kennenlernen');
  const [text, setText] = useState('');
  const [bearbeitet, setBearbeitet] = useState(false);
  const [sendet, setSendet] = useState<'mail' | 'selbst' | null>(null);
  const [kopiert, setKopiert] = useState(false);

  // Der Vorschlag folgt Angebot und Anlass, bis der Headhunter selbst etwas geändert hat.
  useEffect(() => {
    if (!open || bearbeitet) return;
    setText(einladungsText({ vorname: candidate.vorname, hhVorname, dauer, anlass, angebot }));
  }, [open, bearbeitet, candidate.vorname, hhVorname, dauer, anlass, angebot]);
  useEffect(() => { if (!open) { setBearbeitet(false); setKopiert(false); } }, [open]);

  const arten: Gespraechsart[] = angebotArten(angebot);
  const merken = () => { try { localStorage.setItem(SPEICHER, angebot); } catch { /* nur Komfort */ } };

  const perMail = async () => {
    setSendet('mail');
    try {
      await einladungApi.senden({ candidate_id: candidate.id, arten, weg: 'mail', text });
      merken();
      toast.success(`Einladung an ${candidate.vorname} ist raus.`);
      onFertig();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Die Einladung konnte nicht verschickt werden.');
    } finally { setSendet(null); }
  };

  const selbst = async () => {
    setSendet('selbst');
    try {
      const r = await einladungApi.senden({ candidate_id: candidate.id, arten, weg: 'selbst' });
      const fertigerText = textMitLink(text, einladungsLink(r.token));
      merken();
      onFertig();
      try {
        await navigator.clipboard.writeText(fertigerText);
        setKopiert(true);
        toast.success('Text mit persönlichem Link kopiert.');
      } catch {
        // Die Einladung gilt schon: den fertigen Text zeigen, damit der Link nicht verloren geht.
        setText(fertigerText);
        setBearbeitet(true);
        toast.info('Automatisches Kopieren ging nicht. Der Text mit Link steht jetzt im Feld.');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Das hat gerade nicht geklappt.');
    } finally { setSendet(null); }
  };

  const seiteFehlt = !seiteLaedt && !zeile?.active;
  // Lokal (Modus localdb) täuscht TERMIN_TEST_KALENDER einen Kalender vor; dort gibt es keine Outlook-Anbindung.
  const kalenderFehlt = !kal.isLoading && kal.state !== 'connected' && import.meta.env.MODE !== 'localdb';

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{candidate.vorname} zum Gespräch einladen</DialogTitle>
        <DialogDescription>{candidate.vorname} bekommt einen persönlichen Link und wählt eine freie Zeit aus deinem Kalender.</DialogDescription>
      </DialogHeader>

      {seiteFehlt || kalenderFehlt ? <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium"><CalendarOff className="h-4 w-4"/>{seiteFehlt ? 'Deine Terminseite ist noch nicht aktiv' : 'Dein Kalender ist nicht verbunden'}</p>
        <p className="text-muted-foreground">{candidate.vorname} kann nur Zeiten buchen, die in deinem Kalender frei sind. Das richtest du einmal ein, danach geht es hier weiter.</p>
        <Button size="sm" asChild><Link to={`/recruiter/profile/terminseite?zurueck=${encodeURIComponent(`/recruiter/candidates/${candidate.id}`)}`}>Terminseite einrichten</Link></Button>
      </div> : <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">Was bietest du an?</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Was bietest du an?">
            {ANGEBOTE.map(({ key, label, hinweis, Icon }) => <button key={key} type="button" role="radio" aria-checked={angebot === key} onClick={() => setAngebot(key)}
              className={cn('rounded-lg border p-2.5 text-left transition-colors', angebot === key ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30')}>
              <span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-4 w-4"/>{label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{hinweis}</span>
            </button>)}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Dein Text</p>
            <div className="flex gap-1.5">
              {EINLADUNG_ANLAESSE.map(a => <button key={a.key} type="button" onClick={() => { setAnlass(a.key); setBearbeitet(false); }}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs', anlass === a.key ? 'border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{a.label}</button>)}
            </div>
          </div>
          <Textarea rows={11} value={text} onChange={e => { setText(e.target.value); setBearbeitet(true); }} className="text-sm"/>
          <p className="mt-1 text-xs text-muted-foreground">An der Stelle [Link] steht später der persönliche Link. Er gilt 30 Tage.</p>
        </div>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">Lade nur Menschen ein, die dich kennen oder mit dem Gespräch rechnen.</p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button variant="outline" disabled={!!sendet || !text.trim()} onClick={() => void selbst()} className="gap-1.5">
            {sendet === 'selbst' ? <Loader2 className="h-4 w-4 animate-spin"/> : kopiert ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}
            {kopiert ? 'Kopiert' : 'Selbst schicken: Text kopieren'}
          </Button>
          <Button disabled={!!sendet || !text.trim() || !candidate.email} onClick={() => void perMail()} className="gap-1.5" title={candidate.email ? undefined : 'In der Akte steht keine E-Mail.'}>
            {sendet === 'mail' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
            Per Mail senden
          </Button>
        </div>
        {!candidate.email && <p className="text-xs text-muted-foreground">In der Akte steht keine E-Mail, deshalb geht nur „Selbst schicken“. {candidate.vorname} trägt sie beim Buchen ein.</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}

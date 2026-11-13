import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, CalendarOff, Check, Copy, Loader2, Phone, Send, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarStatus } from '@/components/interview/calendar/useCalendarStatus';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { einladungApi, einladungsLink, type Gespraechsart } from '@/lib/terminApi';
import { angebotArten, EINLADUNG_ANLAESSE, einladungsText, mitLebenslaufSatz, textMitLink, type Angebot, type EinladungAnlass } from '@/lib/einladungTexte';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useTerminseite } from './useTerminseite';

// Beschriftung und Hinweis je Angebot: recruiterTermin → angebot.<key>.label / .hint
const ANGEBOTE: { key: Angebot; Icon: typeof Video }[] = [
  { key: 'teams', Icon: Video },
  { key: 'phone', Icon: Phone },
  { key: 'beides', Icon: ArrowLeftRight },
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
  candidate: { id: string; vorname: string; email: string | null; hatLebenslauf?: boolean };
  onFertig: () => void;
}) {
  const { t } = useTranslation('recruiterTermin');
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
  // Lebenslauf anfragen (05.11.2026): von selbst an, wenn in der Akte keiner liegt.
  const [lebenslauf, setLebenslauf] = useState(!candidate.hatLebenslauf);

  // Der Vorschlag folgt Angebot und Anlass, bis der Headhunter selbst etwas geändert hat.
  useEffect(() => {
    if (!open || bearbeitet) return;
    setText(mitLebenslaufSatz(einladungsText({ vorname: candidate.vorname, hhVorname, dauer, anlass, angebot }), lebenslauf));
  }, [open, bearbeitet, candidate.vorname, hhVorname, dauer, anlass, angebot, lebenslauf]);
  useEffect(() => { if (!open) { setBearbeitet(false); setKopiert(false); } else setLebenslauf(!candidate.hatLebenslauf); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Das Häkchen nimmt den Satz mit, auch wenn der Text schon selbst geändert ist.
  const lebenslaufUmschalten = (an: boolean) => {
    setLebenslauf(an);
    if (bearbeitet) setText((alt) => mitLebenslaufSatz(alt, an));
  };

  const arten: Gespraechsart[] = angebotArten(angebot);
  const merken = () => { try { localStorage.setItem(SPEICHER, angebot); } catch { /* nur Komfort */ } };

  const perMail = async () => {
    setSendet('mail');
    try {
      await einladungApi.senden({ candidate_id: candidate.id, arten, weg: 'mail', text, lebenslauf });
      merken();
      toast.success(t('einladung.sent', { name: candidate.vorname }));
      onFertig();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('einladung.sendFailed'));
    } finally { setSendet(null); }
  };

  const selbst = async () => {
    setSendet('selbst');
    try {
      const r = await einladungApi.senden({ candidate_id: candidate.id, arten, weg: 'selbst', lebenslauf });
      const fertigerText = textMitLink(text, einladungsLink(r.token));
      merken();
      onFertig();
      try {
        await navigator.clipboard.writeText(fertigerText);
        setKopiert(true);
        toast.success(t('fenster.copied'));
      } catch {
        // Die Einladung gilt schon: den fertigen Text zeigen, damit der Link nicht verloren geht.
        setText(fertigerText);
        setBearbeitet(true);
        toast.info(t('fenster.copyFailed'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('fenster.failed'));
    } finally { setSendet(null); }
  };

  const seiteFehlt = !seiteLaedt && !zeile?.active;
  // Lokal (Modus localdb) täuscht TERMIN_TEST_KALENDER einen Kalender vor; dort gibt es keine Outlook-Anbindung.
  const kalenderFehlt = !kal.isLoading && kal.state !== 'connected' && import.meta.env.MODE !== 'localdb';

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t('einladung.title', { name: candidate.vorname })}</DialogTitle>
        <DialogDescription>{t('einladung.description', { name: candidate.vorname })}</DialogDescription>
      </DialogHeader>

      {seiteFehlt || kalenderFehlt ? <div className="space-y-3 rounded-lg bg-muted/50 p-4 text-sm">
        <p className="flex items-center gap-2 font-medium"><CalendarOff className="h-4 w-4"/>{seiteFehlt ? t('einladung.pageInactive') : t('einladung.calendarMissing')}</p>
        <p className="text-muted-foreground">{t('einladung.setupText', { name: candidate.vorname })}</p>
        <Button size="sm" asChild><Link to={`/recruiter/profile/terminseite?zurueck=${encodeURIComponent(`/recruiter/candidates/${candidate.id}`)}`}>{t('einladung.setupCta')}</Link></Button>
      </div> : <div className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium">{t('einladung.offerQuestion')}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('einladung.offerQuestion')}>
            {ANGEBOTE.map(({ key, Icon }) => <button key={key} type="button" role="radio" aria-checked={angebot === key} onClick={() => setAngebot(key)}
              className={cn('rounded-lg border p-2.5 text-left transition-colors', angebot === key ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30')}>
              <span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-4 w-4"/>{t(`angebot.${key}.label`)}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{t(`angebot.${key}.hint`)}</span>
            </button>)}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <Checkbox className="mt-0.5" checked={lebenslauf} onCheckedChange={(v) => lebenslaufUmschalten(v === true)}/>
          <span>
            <span className="font-medium">{t('einladung.askCv')}</span>
            <span className="block text-xs text-muted-foreground">{t('einladung.askCvHint', { name: candidate.vorname })}</span>
          </span>
        </label>

        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t('fenster.yourText')}</p>
            <div className="flex gap-1.5">
              {EINLADUNG_ANLAESSE.map(a => <button key={a.key} type="button" onClick={() => { setAnlass(a.key); setBearbeitet(false); }}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs', anlass === a.key ? 'border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{a.label}</button>)}
            </div>
          </div>
          <Textarea rows={11} value={text} onChange={e => { setText(e.target.value); setBearbeitet(true); }} className="text-sm"/>
          <p className="mt-1 text-xs text-muted-foreground">{t('fenster.linkHint')}</p>
        </div>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{t('einladung.onlyKnown')}</p>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <Button variant="outline" disabled={!!sendet || !text.trim()} onClick={() => void selbst()} className="gap-1.5">
            {sendet === 'selbst' ? <Loader2 className="h-4 w-4 animate-spin"/> : kopiert ? <Check className="h-4 w-4"/> : <Copy className="h-4 w-4"/>}
            {kopiert ? t('fenster.copiedShort') : t('fenster.selfSend')}
          </Button>
          <Button disabled={!!sendet || !text.trim() || !candidate.email} onClick={() => void perMail()} className="gap-1.5" title={candidate.email ? undefined : t('fenster.noEmailTitle')}>
            {sendet === 'mail' ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}
            {t('fenster.byMail')}
          </Button>
        </div>
        {!candidate.email && <p className="text-xs text-muted-foreground">{t('einladung.noEmail', { name: candidate.vorname })}</p>}
      </div>}
    </DialogContent>
  </Dialog>;
}

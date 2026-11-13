import { useEffect, useState } from 'react';
import { Check, Copy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRecruiterKontakt } from '@/hooks/useRecruiterKontakt';
import { notifyTasksChanged } from '@/hooks/useUnifiedTaskInbox';
import { einladungApi, lebenslaufLink } from '@/lib/terminApi';
import { LEBENSLAUF_ANLAESSE, lebenslaufText, textMitLink, type LebenslaufAnlass } from '@/lib/einladungTexte';
import { cn } from '@/lib/utils';

/**
 * Lebenslauf anfragen ohne Termin (05.11.2026), z. B. nach dem Gespräch: Der Kandidat bekommt
 * einen persönlichen Link /t/lebenslauf/<token>, per Mail über Matchunt oder selbst verschickt.
 */
export function LebenslaufAnfragenFenster({ open, onOpenChange, candidate, onFertig }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  candidate: { id: string; vorname: string; email: string | null };
  onFertig?: () => void;
}) {
  const { t } = useTranslation('recruiterTermin');
  const kontakt = useRecruiterKontakt();
  const hhVorname = (kontakt?.name ?? '').trim().split(/\s+/)[0] || '';
  const [anlass, setAnlass] = useState<LebenslaufAnlass>('nachher');
  const [text, setText] = useState('');
  const [bearbeitet, setBearbeitet] = useState(false);
  const [sendet, setSendet] = useState<'mail' | 'selbst' | null>(null);
  const [kopiert, setKopiert] = useState(false);

  useEffect(() => {
    if (!open || bearbeitet) return;
    setText(lebenslaufText({ vorname: candidate.vorname, hhVorname, anlass }));
  }, [open, bearbeitet, candidate.vorname, hhVorname, anlass]);
  useEffect(() => { if (!open) { setBearbeitet(false); setKopiert(false); } }, [open]);

  const fertig = () => { notifyTasksChanged(); onFertig?.(); };

  const perMail = async () => {
    setSendet('mail');
    try {
      await einladungApi.lebenslaufAnfragen({ candidate_id: candidate.id, weg: 'mail', text });
      toast.success(t('lebenslauf.sent', { name: candidate.vorname }));
      fertig();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('lebenslauf.sendFailed'));
    } finally { setSendet(null); }
  };

  const selbst = async () => {
    setSendet('selbst');
    try {
      const r = await einladungApi.lebenslaufAnfragen({ candidate_id: candidate.id, weg: 'selbst' });
      const fertigerText = textMitLink(text, lebenslaufLink(r.token));
      fertig();
      try {
        await navigator.clipboard.writeText(fertigerText);
        setKopiert(true);
        toast.success(t('fenster.copied'));
      } catch {
        setText(fertigerText);
        setBearbeitet(true);
        toast.info(t('fenster.copyFailed'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('fenster.failed'));
    } finally { setSendet(null); }
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{t('lebenslauf.title', { name: candidate.vorname })}</DialogTitle>
        <DialogDescription>{t('lebenslauf.description', { name: candidate.vorname })}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">{t('fenster.yourText')}</p>
            <div className="flex gap-1.5">
              {LEBENSLAUF_ANLAESSE.map(a => <button key={a.key} type="button" onClick={() => { setAnlass(a.key); setBearbeitet(false); }}
                className={cn('rounded-full border px-2.5 py-0.5 text-xs', anlass === a.key ? 'border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>{a.label}</button>)}
            </div>
          </div>
          <Textarea rows={9} value={text} onChange={e => { setText(e.target.value); setBearbeitet(true); }} className="text-sm"/>
          <p className="mt-1 text-xs text-muted-foreground">{t('fenster.linkHint')}</p>
        </div>
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
        {!candidate.email && <p className="text-xs text-muted-foreground">{t('lebenslauf.noEmail')}</p>}
      </div>
    </DialogContent>
  </Dialog>;
}

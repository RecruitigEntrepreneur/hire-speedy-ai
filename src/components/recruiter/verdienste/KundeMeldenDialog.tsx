import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { abrechnungApi } from '@/lib/abrechnungApi';

const TOPICS: [string, string][] = [
  ['no_response', 'Reagiert nicht'], ['unfair', 'Unfairer Umgang'], ['circumvention', 'Verdacht auf Umgehung'], ['wrong_info', 'Angaben stimmen nicht'], ['other', 'Etwas anderes'],
];

/**
 * F2: „Kunde melden“ aus dem Werkzeug-Menü der Stelle. Matchunt kümmert sich; der
 * Kunde erfährt nicht, wer gemeldet hat.
 */
export function KundeMeldenDialog({ open, onOpenChange, jobId, jobTitle }: { open: boolean; onOpenChange: (o: boolean) => void; jobId: string; jobTitle: string }) {
  const qc = useQueryClient();
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setTopic(''); setNote(''); onOpenChange(false); };
  const send = async () => {
    if (!topic) { toast.error('Bitte wählen, was los ist.'); return; }
    if (!note.trim()) { toast.error('Bitte kurz beschreiben, was los ist.'); return; }
    setBusy(true);
    try {
      await abrechnungApi.clientReport(jobId, topic, note.trim());
      toast.success('Gemeldet. Matchunt kümmert sich.');
      void qc.invalidateQueries({ queryKey: ['job-terms'] });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Deine Meldung konnte nicht gesendet werden.');
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Kunde melden · {jobTitle}</DialogTitle>
          <DialogDescription>Matchunt kümmert sich darum. Der Kunde erfährt nicht, wer gemeldet hat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">Was ist los?</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map(([key, label]) => (
                <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', topic === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{label}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kunde-melden" className="sr-only">Beschreibung</Label>
            <Textarea id="kunde-melden" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Seit 3 Wochen keine Rückmeldung zu meiner Kandidatin, trotz zwei Erinnerungen" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>Abbrechen</Button>
          <Button disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}An Matchunt senden</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

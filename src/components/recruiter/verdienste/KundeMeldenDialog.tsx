import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { abrechnungApi } from '@/lib/abrechnungApi';

// Schlüssel gehen an die Function; die Beschriftung kommt aus recruiterEarnings:report.topics.
const TOPICS = ['no_response', 'unfair', 'circumvention', 'wrong_info', 'other'];

/**
 * F2: „Kunde melden“ aus dem Werkzeug-Menü der Stelle. Matchunt kümmert sich; der
 * Kunde erfährt nicht, wer gemeldet hat.
 */
export function KundeMeldenDialog({ open, onOpenChange, jobId, jobTitle }: { open: boolean; onOpenChange: (o: boolean) => void; jobId: string; jobTitle: string }) {
  const qc = useQueryClient();
  const { t } = useTranslation('recruiterEarnings');
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const close = () => { setTopic(''); setNote(''); onOpenChange(false); };
  const send = async () => {
    if (!topic) { toast.error(t('report.chooseTopic')); return; }
    if (!note.trim()) { toast.error(t('report.describe')); return; }
    setBusy(true);
    try {
      await abrechnungApi.clientReport(jobId, topic, note.trim());
      toast.success(t('report.sent'));
      void qc.invalidateQueries({ queryKey: ['job-terms'] });
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('api.clientReport'));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('report.title', { job: jobTitle })}</DialogTitle>
          <DialogDescription>{t('report.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">{t('report.question')}</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((key) => (
                <button key={key} type="button" aria-pressed={topic === key} onClick={() => setTopic(key)}
                  className={cn('rounded-full border px-2.5 py-1 text-xs', topic === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>{t(`report.topics.${key}`)}</button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kunde-melden" className="sr-only">{t('report.label')}</Label>
            <Textarea id="kunde-melden" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('report.placeholder')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>{t('cancel')}</Button>
          <Button disabled={busy} onClick={() => void send()}>{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{t('sendToMatchunt')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

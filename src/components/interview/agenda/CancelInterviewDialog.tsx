import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateName } from './CandidateIdentity';
import { interviewApi } from '@/lib/interviewScheduling';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';

interface Props {
  interview: AgendaInterview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Interview absagen bzw. offene Anfrage zurückziehen – mit Begründung,
 *  die dem Recruiter mitgegeben wird (Spalten cancelled_* existieren bereits). */
export function CancelInterviewDialog({ interview: iv, open, onOpenChange, onDone }: Props) {
  const { user } = useAuth();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  if (!iv) return null;
  const isRequest = !iv.scheduledAt;

  const cancel = async () => {
    setSaving(true);
    try {
      if (['pending_response', 'counter_proposed', 'scheduled'].includes(iv.status)) {
        // Über die Function: Outlook-Termin bzw. Teams-Besprechung entfernen, Absage per Kalender
        // an alle Eingeladenen, Mail an den Kandidaten, Headhunter informiert.
        await interviewApi.withdraw(iv.id, reason.trim());
      } else {
        // Alte Anfragen aus der Zeit vor der Terminierung v2
        const { error } = await supabase
          .from('interviews')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_by: user?.id ?? null,
            cancellation_reason: reason.trim() || null,
          })
          .eq('id', iv.id);
        if (error) throw error;
      }
      toast.success(isRequest ? 'Anfrage zurückgezogen. Kandidat und Headhunter sind informiert.' : 'Interview abgesagt. Alle Beteiligten bekommen die Absage.');
      setReason('');
      onOpenChange(false);
      onDone();
    } catch (e) {
      console.error('Absage-Fehler:', e);
      toast.error(e instanceof Error ? e.message : 'Absage fehlgeschlagen.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            {isRequest ? 'Anfrage zurückziehen' : 'Interview absagen'}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1">
            <CandidateName iv={iv} /> · {iv.jobTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Begründung (optional)
          </Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="z. B. Position intern besetzt, Termin nicht mehr nötig …"
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            Der zuständige Recruiter wird benachrichtigt und informiert den Kandidaten.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="destructive" onClick={cancel} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRequest ? 'Zurückziehen' : 'Absagen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

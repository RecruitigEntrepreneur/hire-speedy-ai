import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

interface CancelInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  onCancelled?: () => void;
}

const CANCELLATION_REASONS = [
  { value: 'candidate_cancelled', label: 'Kandidat hat abgesagt' },
  { value: 'company_cancelled', label: 'Unternehmen hat abgesagt' },
  { value: 'scheduling_conflict', label: 'Terminkollision' },
  { value: 'position_filled', label: 'Stelle bereits besetzt' },
  { value: 'other', label: 'Sonstiges' }
];

export function CancelInterviewDialog({
  open,
  onOpenChange,
  interviewId,
  onCancelled
}: CancelInterviewDialogProps) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyParticipants, setNotifyParticipants] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCancel = async () => {
    if (!reason) {
      toast({
        title: 'Grund erforderlich',
        description: 'Bitte wählen Sie einen Grund für die Absage.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();

      // Update interview status
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancellation_reason: `${reason}${notes ? ': ' + notes : ''}`
        })
        .eq('id', interviewId);

      if (updateError) throw updateError;

      // Send notifications if enabled
      if (notifyParticipants) {
        await supabase.functions.invoke('schedule-interview', {
          body: {
            action: 'send-cancellation-notifications',
            interviewId,
            reason: CANCELLATION_REASONS.find(r => r.value === reason)?.label,
            notes
          }
        });
      }

      toast({
        title: 'Interview abgesagt',
        description: notifyParticipants 
          ? 'Das Interview wurde abgesagt und alle Beteiligten wurden benachrichtigt.'
          : 'Das Interview wurde abgesagt.'
      });

      onCancelled?.();
    } catch (error) {
      console.error('Error cancelling interview:', error);
      toast({
        title: 'Fehler',
        description: 'Das Interview konnte nicht abgesagt werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setReason('');
      setNotes('');
      setNotifyParticipants(true);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Interview absagen
          </DialogTitle>
          <DialogDescription>
            Diese Aktion kann nicht rückgängig gemacht werden. Bitte geben Sie einen Grund an.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Grund für die Absage</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {CANCELLATION_REASONS.map((item) => (
                <div key={item.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={item.value} id={item.value} />
                  <Label htmlFor={item.value} className="font-normal cursor-pointer">
                    {item.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notizen (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Zusätzliche Informationen zur Absage..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify"
              checked={notifyParticipants}
              onCheckedChange={(checked) => setNotifyParticipants(checked as boolean)}
            />
            <Label htmlFor="notify" className="font-normal cursor-pointer">
              Alle Beteiligten per E-Mail benachrichtigen
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleCancel}
            disabled={loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Interview absagen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

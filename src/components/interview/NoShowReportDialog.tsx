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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertTriangle } from 'lucide-react';

interface NoShowReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  onReported?: () => void;
}

const NO_SHOW_OPTIONS = [
  { value: 'candidate', label: 'Kandidat ist nicht erschienen', description: 'Der Kandidat hat den Termin nicht wahrgenommen' },
  { value: 'client', label: 'Interviewer nicht verfügbar', description: 'Der Interviewer konnte nicht teilnehmen' },
  { value: 'technical', label: 'Technische Probleme', description: 'Meeting konnte aufgrund technischer Probleme nicht stattfinden' }
];

export function NoShowReportDialog({
  open,
  onOpenChange,
  interviewId,
  onReported
}: NoShowReportDialogProps) {
  const [noShowBy, setNoShowBy] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleReport = async () => {
    if (!noShowBy) {
      toast({
        title: 'Auswahl erforderlich',
        description: 'Bitte wählen Sie aus, wer nicht erschienen ist.',
        variant: 'destructive'
      });
      return;
    }

    try {
      setLoading(true);

      // Update interview with no-show info
      const { error: updateError } = await supabase
        .from('interviews')
        .update({
          status: noShowBy === 'technical' ? 'rescheduling_needed' : 'no_show',
          no_show_reported_at: new Date().toISOString(),
          no_show_by: noShowBy
        })
        .eq('id', interviewId);

      if (updateError) throw updateError;

      // Log activity
      await supabase.functions.invoke('schedule-interview', {
        body: {
          action: 'log-no-show',
          interviewId,
          noShowBy,
          notes
        }
      });

      const selectedOption = NO_SHOW_OPTIONS.find(o => o.value === noShowBy);
      
      toast({
        title: 'No-Show gemeldet',
        description: `${selectedOption?.label} wurde erfasst.${noShowBy === 'technical' ? ' Bitte vereinbaren Sie einen neuen Termin.' : ''}`
      });

      onReported?.();
    } catch (error) {
      console.error('Error reporting no-show:', error);
      toast({
        title: 'Fehler',
        description: 'No-Show konnte nicht gemeldet werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setNoShowBy('');
      setNotes('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            No-Show melden
          </DialogTitle>
          <DialogDescription>
            Bitte geben Sie an, warum das Interview nicht stattgefunden hat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Was ist passiert?</Label>
            <RadioGroup value={noShowBy} onValueChange={setNoShowBy}>
              {NO_SHOW_OPTIONS.map((item) => (
                <div 
                  key={item.value} 
                  className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                  onClick={() => setNoShowBy(item.value)}
                >
                  <RadioGroupItem value={item.value} id={item.value} className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor={item.value} className="font-medium cursor-pointer">
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Zusätzliche Notizen (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Weitere Details zum Vorfall..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleReport}
            disabled={loading || !noShowBy}
            className="bg-amber-500 hover:bg-amber-600"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            No-Show melden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

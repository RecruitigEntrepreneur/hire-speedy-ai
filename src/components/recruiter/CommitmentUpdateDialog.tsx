import { useState } from 'react';
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
import { toast } from 'sonner';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CommitmentUpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  submissionId?: string;
  currentLevel?: string;
  onSuccess?: () => void;
}

export function CommitmentUpdateDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  submissionId,
  currentLevel,
  onSuccess
}: CommitmentUpdateDialogProps) {
  const [level, setLevel] = useState<string>(currentLevel || 'medium');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!level) {
      toast.error('Bitte wählen Sie ein Commitment-Level');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Nicht angemeldet');

      const { error } = await supabase
        .from('candidate_commitment_updates')
        .insert({
          candidate_id: candidateId,
          submission_id: submissionId || null,
          recruiter_id: user.id,
          commitment_level: level,
          reason: reason || null,
          previous_level: currentLevel || null
        });

      if (error) throw error;

      // Trigger score recalculation via edge function
      await supabase.functions.invoke('calculate-scores', {
        body: { candidateId, type: 'commitment_update' }
      });

      toast.success('Commitment-Update gespeichert');
      onOpenChange(false);
      setReason('');
      onSuccess?.();
    } catch (error) {
      console.error('Error updating commitment:', error);
      toast.error('Fehler beim Speichern');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Commitment-Update</DialogTitle>
          <DialogDescription>
            Aktualisieren Sie das Commitment-Level für {candidateName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Commitment-Level</Label>
            <RadioGroup value={level} onValueChange={setLevel} className="space-y-2">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="flex items-center gap-2 cursor-pointer flex-1">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="font-medium">Hoch</p>
                    <p className="text-xs text-muted-foreground">Kandidat ist sehr interessiert und engagiert</p>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Minus className="h-4 w-4 text-yellow-600" />
                  <div>
                    <p className="font-medium">Mittel</p>
                    <p className="text-xs text-muted-foreground">Kandidat ist interessiert, aber noch unentschlossen</p>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-input hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="low" id="low" />
                <Label htmlFor="low" className="flex items-center gap-2 cursor-pointer flex-1">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  <div>
                    <p className="font-medium">Niedrig</p>
                    <p className="text-xs text-muted-foreground">Kandidat zeigt wenig Interesse oder hat Bedenken</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Begründung (optional)</Label>
            <Textarea
              id="reason"
              placeholder="Was hat sich geändert? Warum diese Einschätzung?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Speichern...' : 'Speichern'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronRight, ChevronLeft, Send, AlertCircle } from 'lucide-react';
import { RejectionReasonSelector, REJECTION_CATEGORIES } from './RejectionReasonSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Submission {
  id: string;
  candidate: {
    id: string;
    full_name: string;
    email: string;
  };
  job: {
    id: string;
    title: string;
    company_name: string;
  };
}

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Submission | null;
  onSuccess: () => void;
}

export function RejectionDialog({ open, onOpenChange, submission, onSuccess }: RejectionDialogProps) {
  const [step, setStep] = useState(1);
  const [reasonCategory, setReasonCategory] = useState('');
  const [customFeedback, setCustomFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleClose = () => {
    setStep(1);
    setReasonCategory('');
    setCustomFeedback('');
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!submission || !reasonCategory) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('process-rejection', {
        body: {
          submission_id: submission.id,
          reason_category: reasonCategory,
          custom_feedback: customFeedback,
          rejection_stage: 'screening'
        }
      });

      if (error) throw error;

      toast.success('Kandidat wurde abgelehnt und benachrichtigt');
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error('Fehler beim Ablehnen: ' + (error.message || 'Unbekannter Fehler'));
    } finally {
      setProcessing(false);
    }
  };

  const selectedCategory = REJECTION_CATEGORIES.find(c => c.value === reasonCategory);

  if (!submission) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && 'Ablehnungsgrund auswählen'}
            {step === 2 && 'Feedback hinzufügen'}
            {step === 3 && 'Ablehnung bestätigen'}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Step 1: Select Reason */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Wählen Sie den Hauptgrund für die Ablehnung von <span className="font-medium">{submission.candidate.full_name}</span>:
              </p>
              <RejectionReasonSelector value={reasonCategory} onChange={setReasonCategory} />
            </div>
          )}

          {/* Step 2: Custom Feedback */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Fügen Sie optional zusätzliches Feedback hinzu, das dem Recruiter helfen kann:
              </p>
              <Textarea
                placeholder="Zusätzliches Feedback (optional)..."
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                rows={4}
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Dieses Feedback wird dem Recruiter mitgeteilt, um zukünftige Einreichungen zu verbessern.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Kandidat</p>
                  <p className="font-medium">{submission.candidate.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Position</p>
                  <p className="font-medium">{submission.job.title} bei {submission.job.company_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ablehnungsgrund</p>
                  <p className="font-medium">{selectedCategory?.label}</p>
                </div>
                {customFeedback && (
                  <div>
                    <p className="text-xs text-muted-foreground">Zusätzliches Feedback</p>
                    <p className="text-sm">{customFeedback}</p>
                  </div>
                )}
              </div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Der Recruiter wird per E-Mail über die Ablehnung informiert.
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} disabled={processing}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Zurück
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={processing}>
              Abbrechen
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!reasonCategory}>
                Weiter
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleSubmit} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Ablehnen & Benachrichtigen
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

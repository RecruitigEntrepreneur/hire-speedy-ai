import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronRight, ChevronLeft, Send, AlertCircle } from 'lucide-react';
import { RejectionReasonSelector, REJECTION_CATEGORIES } from './RejectionReasonSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

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
  /** Zusatz, z. B. wenn dabei ein laufendes Angebot endet */
  notice?: string;
}

export function RejectionDialog({ open, onOpenChange, submission, onSuccess, notice }: RejectionDialogProps) {
  const { t } = useTranslation('clientCandidates');
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

      toast.success(t('rejection.saved'));
      handleClose();
      onSuccess();
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(t('rejection.error', { message: error.message || t('rejection.unknownError') }));
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
            {step === 1 && t('rejection.step1')}
            {step === 2 && t('rejection.step2')}
            {step === 3 && t('rejection.step3')}
          </DialogTitle>
        </DialogHeader>

        {notice && <p className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-sm">{notice}</p>}

        <div className="py-4">
          {/* Step 1: Select Reason */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('rejection.chooseReason')} <span className="font-medium">{submission.candidate.full_name}</span>:
              </p>
              <RejectionReasonSelector value={reasonCategory} onChange={setReasonCategory} />
            </div>
          )}

          {/* Step 2: Custom Feedback */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('rejection.feedbackIntro')}
              </p>
              <Textarea
                placeholder={t('rejection.feedbackPlaceholder')}
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                rows={4}
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('rejection.feedbackHint')}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">{t('rejection.candidate')}</p>
                  <p className="font-medium">{submission.candidate.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('rejection.position')}</p>
                  <p className="font-medium">{t('rejection.jobAt', { job: submission.job.title, company: submission.job.company_name })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('rejection.reason')}</p>
                  <p className="font-medium">{selectedCategory?.label}</p>
                </div>
                {customFeedback && (
                  <div>
                    <p className="text-xs text-muted-foreground">{t('rejection.extraFeedback')}</p>
                    <p className="text-sm">{customFeedback}</p>
                  </div>
                )}
              </div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('rejection.confirmHint')}
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
                {t('rejection.back')}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={processing}>
              {t('rejection.cancel')}
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!reasonCategory}>
                {t('rejection.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleSubmit} disabled={processing}>
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                {t('rejection.submit')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

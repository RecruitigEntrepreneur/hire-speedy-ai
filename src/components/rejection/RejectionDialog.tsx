import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { RejectionReasonSelector, REJECTION_CATEGORIES } from './RejectionReasonSelector';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

  // Apple-Stil (22.11.2026, Vorschlag 1): zwei Schritte – erst der Grund, dann Hinweis und Bestätigen.
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{step === 1 ? t('rejection.step1') : t('rejection.step3')}</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{submission.candidate.full_name}</span> · {submission.job.title}
          </DialogDescription>
        </DialogHeader>

        {notice && <p className="rounded-md bg-secondary px-3 py-2 text-sm">{notice}</p>}

        {step === 1 && (
          <div className="space-y-1 text-sm">
            <p className="font-medium">{t('rejection.question')}</p>
            <RejectionReasonSelector value={reasonCategory} onChange={setReasonCategory} />
            <p className="pt-2 text-xs text-muted-foreground">{t('rejection.why')}</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3 border-b pb-2.5">
              <span className="text-muted-foreground">{t('rejection.reason')}</span>
              <span className="font-medium">{selectedCategory?.label}</span>
            </div>
            <div className="space-y-1.5">
              <p className="font-medium">{t('rejection.noteLabel')} <span className="font-normal text-muted-foreground">· {t('rejection.optional')}</span></p>
              <Textarea
                placeholder={t('rejection.feedbackPlaceholder')}
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('rejection.confirmHint')}</p>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {step === 2 && (
              <Button variant="ghost" onClick={() => setStep(1)} disabled={processing}>{t('rejection.back')}</Button>
            )}
          </div>
          <div className="flex gap-2 max-md:w-full max-md:[&>button]:flex-1">
            <Button variant="outline" onClick={handleClose} disabled={processing}>
              {t('rejection.cancel')}
            </Button>
            {step === 1 ? (
              <Button onClick={() => setStep(2)} disabled={!reasonCategory}>{t('rejection.next')}</Button>
            ) : (
              <Button variant="destructive" onClick={handleSubmit} disabled={processing}>
                {processing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('rejection.submit')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

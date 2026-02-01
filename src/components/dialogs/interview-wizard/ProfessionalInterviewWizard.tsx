import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { InterviewWizardData, InterviewWizardProps, DEFAULT_WIZARD_DATA } from './types';
import { InterviewWizardStep1Format } from './InterviewWizardStep1Format';
import { InterviewWizardStep2Slots } from './InterviewWizardStep2Slots';
import { InterviewWizardStep3Message } from './InterviewWizardStep3Message';
import { InterviewWizardStep4Preview } from './InterviewWizardStep4Preview';
import { Target, Calendar, MessageSquare, CheckCircle } from 'lucide-react';

const STEPS = [
  { title: 'Format & Dauer', icon: Target },
  { title: 'Termine', icon: Calendar },
  { title: 'Nachricht', icon: MessageSquare },
  { title: 'Vorschau', icon: CheckCircle },
];

export function ProfessionalInterviewWizard({
  open,
  onOpenChange,
  submissionId,
  candidateAnonymousId,
  jobTitle,
  companyDescription = 'Technologie-Unternehmen',
  onSuccess,
}: InterviewWizardProps) {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<InterviewWizardData>(DEFAULT_WIZARD_DATA);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateData = (updates: Partial<InterviewWizardData>) => {
    setData(prev => ({ ...prev, ...updates }));
  };

  const handleClose = () => {
    setStep(1);
    setData(DEFAULT_WIZARD_DATA);
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('send-interview-invitation', {
        body: {
          submissionId,
          meetingFormat: data.meetingFormat,
          durationMinutes: data.durationMinutes,
          proposedSlots: data.proposedSlots.map(s => s.toISOString()),
          clientMessage: data.clientMessage || undefined,
          meetingLink: data.meetingLink || undefined,
          onsiteAddress: data.onsiteAddress || undefined,
        },
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Fehler beim Senden');

      toast.success('Interview-Einladung erfolgreich gesendet!');
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      console.error('Error sending interview invitation:', err);
      toast.error(err.message || 'Fehler beim Senden der Einladung');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercent = (step / STEPS.length) * 100;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Interview anfragen
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            {STEPS.map((s, index) => {
              const StepIcon = s.icon;
              const isActive = index + 1 === step;
              const isCompleted = index + 1 < step;
              
              return (
                <div
                  key={index}
                  className={`flex items-center gap-1.5 text-xs ${
                    isActive
                      ? 'text-primary font-medium'
                      : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                  }`}
                >
                  <StepIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
              );
            })}
          </div>
          <Progress value={progressPercent} className="h-1" />
        </div>

        {/* Step Content */}
        <div className="mt-4">
          {step === 1 && (
            <InterviewWizardStep1Format
              data={data}
              onChange={updateData}
              onNext={() => setStep(2)}
              onCancel={handleClose}
            />
          )}
          {step === 2 && (
            <InterviewWizardStep2Slots
              data={data}
              onChange={updateData}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <InterviewWizardStep3Message
              data={data}
              onChange={updateData}
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <InterviewWizardStep4Preview
              data={data}
              jobTitle={jobTitle}
              candidateAnonymousId={candidateAnonymousId}
              companyDescription={companyDescription}
              onBack={() => setStep(3)}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

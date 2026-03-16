import { useWizardContext } from './JobWizard';
import { WIZARD_STEPS, WizardStep } from '@/hooks/useJobWizard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2, SkipForward } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function WizardNavigation() {
  const {
    currentStep,
    nextStep,
    prevStep,
    saveDraft,
    saving,
    submitting,
    getStepValidation,
  } = useWizardContext();

  const isMobile = useIsMobile();
  const stepConfig = WIZARD_STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === 6;
  const validation = getStepValidation(currentStep as WizardStep);

  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t px-4 py-3 z-20',
      !isMobile && 'left-auto max-w-[calc(100%-14rem-3rem)]'
    )}>
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Back */}
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <Button
              variant="ghost"
              onClick={prevStep}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </Button>
          )}
        </div>

        {/* Center: Save + Skip */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveDraft}
            disabled={saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Entwurf
          </Button>

          {stepConfig.optional && (
            <Button
              variant="ghost"
              size="sm"
              onClick={nextStep}
              className="gap-1.5 text-muted-foreground"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Überspringen
            </Button>
          )}
        </div>

        {/* Right: Next / Submit */}
        <div>
          {!isLastStep ? (
            <Button
              onClick={nextStep}
              className="gap-1.5"
              disabled={!validation.isValid && currentStep === 0}
            >
              Weiter
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={() => {}}
              disabled={submitting}
              className="gap-1.5"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Zur Freigabe einreichen
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

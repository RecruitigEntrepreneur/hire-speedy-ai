import { createContext, useContext } from 'react';
import { JobWizardState, WIZARD_STEPS } from '@/hooks/useJobWizard';
import { WizardStepper } from './WizardStepper';
import { WizardNavigation } from './WizardNavigation';
import { TrackSelection } from './steps/TrackSelection';
import { SmartImport } from './steps/SmartImport';
import { BasicInfo } from './steps/BasicInfo';
import { CompensationStep } from './steps/CompensationStep';
import { Requirements } from './steps/Requirements';
import { IntakeContext } from './steps/IntakeContext';
import { ReviewPublish } from './steps/ReviewPublish';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

// ─── Context ─────────────────────────────────────────────────────

const WizardContext = createContext<JobWizardState | null>(null);

export function useWizardContext() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizardContext must be used within JobWizard');
  return ctx;
}

// ─── Step Renderer ───────────────────────────────────────────────

function ActiveStep({ step }: { step: number }) {
  switch (step) {
    case 0: return <TrackSelection />;
    case 1: return <SmartImport />;
    case 2: return <BasicInfo />;
    case 3: return <CompensationStep />;
    case 4: return <Requirements />;
    case 5: return <IntakeContext />;
    case 6: return <ReviewPublish />;
    default: return null;
  }
}

// ─── Main Component ──────────────────────────────────────────────

interface JobWizardProps {
  wizard: JobWizardState;
}

export function JobWizard({ wizard }: JobWizardProps) {
  const isMobile = useIsMobile();

  return (
    <WizardContext.Provider value={wizard}>
      <div className={cn(
        'flex min-h-[calc(100vh-8rem)]',
        isMobile ? 'flex-col' : 'flex-row gap-6'
      )}>
        {/* Main Content — left */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile stepper at top */}
          {isMobile && <WizardStepper />}

          <div className="flex-1 pb-24">
            <ActiveStep step={wizard.currentStep} />
          </div>

          {/* Navigation */}
          <WizardNavigation />
        </div>

        {/* Right Sidebar Stepper — desktop only */}
        {!isMobile && <WizardStepper />}
      </div>
    </WizardContext.Provider>
  );
}

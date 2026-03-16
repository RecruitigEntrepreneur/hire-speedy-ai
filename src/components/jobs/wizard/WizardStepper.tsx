import { useWizardContext } from './JobWizard';
import { WizardStep, type StepConfig } from '@/hooks/useJobWizard';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  Target,
  Upload,
  FileText,
  Coins,
  ListChecks,
  Brain,
  Eye,
  Lightbulb,
} from 'lucide-react';
import { useState } from 'react';

const STEP_ICONS = [Target, Upload, FileText, Coins, ListChecks, Brain, Eye];

// ─── SVG Progress Ring ──────────────────────────────────────────

function ProgressRing({ value, size = 80, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? '#4ade80' : value >= 50 ? '#facc15' : value >= 25 ? '#fb923c' : '#64748b';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{value}%</span>
        <span className="text-[9px] text-muted-foreground leading-none">Score</span>
      </div>
    </div>
  );
}

// ─── Main Stepper ───────────────────────────────────────────────

export function WizardStepper() {
  const { currentStep, visitedSteps, goToStep, getStepValidation, scores, trackSteps } = useWizardContext();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  const steps = trackSteps;
  const currentConfig = steps[currentStep];
  const overallScore = Math.round(
    (scores.profileCompleteness + scores.matchingReadiness + scores.recruiterActionability) / 3
  );

  // Group steps by their groupLabel (track-aware)
  const groups: { label: string; steps: StepConfig[] }[] = [];
  for (const step of steps) {
    const existing = groups.find(g => g.label === step.groupLabel);
    if (existing) {
      existing.steps.push(step);
    } else {
      groups.push({ label: step.groupLabel, steps: [step] });
    }
  }

  // Current coaching tip
  const coachingTip = currentConfig?.coachingTip;

  // ── Mobile: Compact bar with dropdown ─────────────────────────

  if (isMobile) {
    return (
      <div className="sticky top-0 z-10 bg-background border-b">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full px-4 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {currentStep + 1}/7
            </span>
            <span className="text-sm font-semibold">{currentConfig.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-medium',
              overallScore >= 80 ? 'text-green-400' :
              overallScore >= 50 ? 'text-yellow-400' : 'text-muted-foreground'
            )}>
              {overallScore}%
            </span>
            <Progress value={((currentStep) / 6) * 100} className="w-16 h-1.5" />
            <ChevronDown className={cn('h-4 w-4 transition-transform', mobileOpen && 'rotate-180')} />
          </div>
        </button>

        {mobileOpen && (
          <div className="px-4 pb-3 space-y-1 border-t">
            {steps.map((step) => {
              const Icon = STEP_ICONS[step.id];
              const isVisited = visitedSteps.has(step.id);
              const isActive = step.id === currentStep;
              const isComplete = isVisited && step.id < currentStep;

              return (
                <button
                  key={step.id}
                  onClick={() => {
                    if (isVisited || step.id <= currentStep) {
                      goToStep(step.id as WizardStep);
                      setMobileOpen(false);
                    }
                  }}
                  disabled={!isVisited && step.id > currentStep}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    isActive && 'bg-primary/10 text-primary font-medium',
                    isComplete && 'text-green-400',
                    !isVisited && step.id > currentStep && 'text-muted-foreground/50 cursor-not-allowed',
                    isVisited && !isActive && !isComplete && 'text-muted-foreground hover:bg-muted/50 cursor-pointer'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : isActive ? (
                    <Circle className="h-4 w-4 fill-primary text-primary" />
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                  <Icon className="h-4 w-4" />
                  <span>{step.title}</span>
                  {step.optional && <span className="text-xs text-muted-foreground">(optional)</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Desktop: Right sidebar with progress ring ─────────────────

  return (
    <div className="w-56 shrink-0">
      <div className="sticky top-6 space-y-4">
        {/* Progress Ring */}
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center">
          <ProgressRing value={overallScore} />
        </div>

        {/* Step Navigation */}
        <div className="bg-card border rounded-lg p-3 space-y-4">
          {groups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2">
                {group.label}
              </p>
              {group.steps.map((step) => {
                const Icon = STEP_ICONS[step.id];
                const isVisited = visitedSteps.has(step.id);
                const isActive = step.id === currentStep;
                const isComplete = isVisited && step.id < currentStep;
                const validation = isComplete ? getStepValidation(step.id as WizardStep) : null;

                return (
                  <button
                    key={step.id}
                    onClick={() => {
                      if (isVisited || step.id <= currentStep) {
                        goToStep(step.id as WizardStep);
                      }
                    }}
                    disabled={!isVisited && step.id > currentStep}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-all leading-tight',
                      isActive && 'bg-primary/10 text-primary font-medium',
                      isComplete && validation?.isValid && 'text-green-400 hover:bg-muted/50 cursor-pointer',
                      isComplete && !validation?.isValid && 'text-yellow-400 hover:bg-muted/50 cursor-pointer',
                      !isVisited && step.id > currentStep && 'text-muted-foreground/40 cursor-not-allowed',
                      isVisited && !isActive && !isComplete && 'text-muted-foreground hover:bg-muted/50 cursor-pointer'
                    )}
                  >
                    {isComplete && validation?.isValid ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    ) : isActive ? (
                      <div className="h-3.5 w-3.5 rounded-full bg-primary shrink-0 flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                      </div>
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="truncate text-left">{step.title}</span>
                    {step.optional && (
                      <span className="text-[9px] text-muted-foreground/50 shrink-0">opt.</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Coaching Tip */}
        {coachingTip && (
          <div className="bg-card border border-primary/20 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Tipp</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {coachingTip}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

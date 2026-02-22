import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Rocket, 
  Send, 
  Eye, 
  Calendar, 
  CheckCircle2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NextStepsCardProps {
  jobStatus: string | null;
  isPaused: boolean;
  candidateCount: number;
  interviewCount: number;
  intakeCompleteness: number;
  onPublish?: () => void;
  onEditIntake: () => void;
  onViewPipeline: () => void;
  className?: string;
}

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  variant: 'primary' | 'secondary' | 'success';
  completed?: boolean;
}

export function NextStepsCard({
  jobStatus,
  isPaused,
  candidateCount,
  interviewCount,
  intakeCompleteness,
  onPublish,
  onEditIntake,
  onViewPipeline,
  className
}: NextStepsCardProps) {
  const isDraft = jobStatus === 'draft' || !jobStatus;
  const isPublished = jobStatus === 'published';

  const steps: Step[] = [];

  if (isPaused) {
    steps.push({
      icon: <Sparkles className="h-5 w-5" />,
      title: 'Job ist pausiert',
      description: 'Reaktivieren Sie den Job, damit Recruiter wieder Kandidaten einreichen können.',
      variant: 'secondary',
    });
  } else if (isDraft) {
    steps.push({
      icon: <Send className="h-5 w-5" />,
      title: 'Job veröffentlichen',
      description: 'Reichen Sie den Job zur Prüfung ein, damit Recruiter aktiv werden können.',
      action: onPublish ? { label: 'Zur Prüfung einreichen', onClick: onPublish } : undefined,
      variant: 'primary',
    });
    if (intakeCompleteness < 60) {
      steps.push({
        icon: <Sparkles className="h-5 w-5" />,
        title: 'Intake verbessern',
        description: 'Mehr Details helfen Recruitern, die passenden Kandidaten zu finden.',
        action: { label: 'Details ergänzen', onClick: onEditIntake },
        variant: 'secondary',
      });
    }
  } else if (isPublished && candidateCount === 0) {
    steps.push({
      icon: <Rocket className="h-5 w-5" />,
      title: 'Recruiter werden aktiv',
      description: 'Ihr Job wurde veröffentlicht. Recruiter suchen nach passenden Kandidaten.',
      variant: 'primary',
    });
    if (intakeCompleteness < 70) {
      steps.push({
        icon: <Sparkles className="h-5 w-5" />,
        title: 'Profil stärken',
        description: 'Ergänzen Sie weitere Details für schnellere und bessere Matches.',
        action: { label: 'Optimieren', onClick: onEditIntake },
        variant: 'secondary',
      });
    }
  } else if (candidateCount > 0 && interviewCount === 0) {
    steps.push({
      icon: <Eye className="h-5 w-5" />,
      title: 'Kandidaten prüfen',
      description: `${candidateCount} Kandidat${candidateCount > 1 ? 'en' : ''} warten auf Ihre Bewertung.`,
      action: { label: 'Pipeline öffnen', onClick: onViewPipeline },
      variant: 'primary',
    });
  } else if (interviewCount > 0) {
    steps.push({
      icon: <Calendar className="h-5 w-5" />,
      title: 'Interviews vorbereiten',
      description: `${interviewCount} Interview${interviewCount > 1 ? 's' : ''} geplant. Bereiten Sie sich vor.`,
      action: { label: 'Interviews ansehen', onClick: onViewPipeline },
      variant: 'primary',
    });
  } else {
    steps.push({
      icon: <CheckCircle2 className="h-5 w-5" />,
      title: 'Alles auf Kurs',
      description: 'Der Recruiting-Prozess läuft. Wir halten Sie auf dem Laufenden.',
      variant: 'success',
    });
  }

  const variantStyles = {
    primary: 'border-primary/20 bg-primary/5',
    secondary: 'border-border/50',
    success: 'border-emerald-500/20 bg-emerald-500/5',
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Nächste Schritte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              "p-4 rounded-lg border transition-all",
              variantStyles[step.variant]
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 shrink-0",
                step.variant === 'primary' ? 'text-primary' :
                step.variant === 'success' ? 'text-emerald-600' : 'text-muted-foreground'
              )}>
                {step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {step.action && (
                  <Button 
                    variant={step.variant === 'primary' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={step.action.onClick}
                    className="mt-3 h-8"
                  >
                    {step.action.label}
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Pulse indicator for "waiting" states */}
            {step.variant === 'primary' && !step.action && (
              <div className="flex items-center gap-2 mt-3 ml-8">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/60 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                </span>
                <span className="text-xs text-muted-foreground">Aktiv – Recruiter werden benachrichtigt</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

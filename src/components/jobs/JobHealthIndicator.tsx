import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  TrendingUp 
} from 'lucide-react';

interface JobHealthIndicatorProps {
  candidatesCount: number;
  interviewsCount: number;
  activeRecruiters: number;
  daysOpen: number;
  status: string | null;
}

type HealthLevel = 'excellent' | 'good' | 'warning' | 'critical';

export function JobHealthIndicator({
  candidatesCount,
  interviewsCount,
  activeRecruiters,
  daysOpen,
  status,
}: JobHealthIndicatorProps) {
  const health = useMemo(() => {
    // Closed/draft jobs don't need health indicators
    if (status === 'closed' || status === 'draft') {
      return null;
    }

    let score = 0;
    const issues: string[] = [];

    // Factor 1: Candidates in pipeline
    if (candidatesCount >= 5) score += 30;
    else if (candidatesCount >= 2) score += 20;
    else if (candidatesCount >= 1) score += 10;
    else issues.push('Keine Kandidaten');

    // Factor 2: Interview activity
    if (interviewsCount >= 2) score += 30;
    else if (interviewsCount >= 1) score += 20;
    else if (candidatesCount > 3 && daysOpen > 14) {
      issues.push('Keine Interviews');
    }

    // Factor 3: Recruiter engagement
    if (activeRecruiters >= 3) score += 25;
    else if (activeRecruiters >= 1) score += 15;
    else if (daysOpen > 7) issues.push('Wenig Recruiter');

    // Factor 4: Time factor (penalty for stale jobs)
    if (daysOpen < 14) score += 15;
    else if (daysOpen < 30) score += 10;
    else if (daysOpen > 45 && candidatesCount < 3) {
      issues.push('Lange offen');
    }

    let level: HealthLevel;
    let label: string;
    let icon: React.ReactNode;
    let colors: { text: string; bg: string; border: string };

    if (score >= 70) {
      level = 'excellent';
      label = 'Läuft gut';
      icon = <CheckCircle2 className="h-3.5 w-3.5" />;
      colors = { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' };
    } else if (score >= 45) {
      level = 'good';
      label = 'OK';
      icon = <TrendingUp className="h-3.5 w-3.5" />;
      colors = { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    } else if (score >= 20) {
      level = 'warning';
      label = 'Achtung';
      icon = <AlertTriangle className="h-3.5 w-3.5" />;
      colors = { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
    } else {
      level = 'critical';
      label = 'Kritisch';
      icon = <XCircle className="h-3.5 w-3.5" />;
      colors = { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
    }

    return { level, label, icon, colors, issues };
  }, [candidatesCount, interviewsCount, activeRecruiters, daysOpen, status]);

  if (!health) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className={`${health.colors.text} ${health.colors.bg} ${health.colors.border} gap-1 cursor-help`}
        >
          {health.icon}
          {health.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">Job Health: {health.label}</p>
          {health.issues.length > 0 && (
            <ul className="text-xs text-muted-foreground">
              {health.issues.map((issue, i) => (
                <li key={i}>• {issue}</li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            {candidatesCount} Kandidaten • {interviewsCount} Interviews • {activeRecruiters} Recruiter
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

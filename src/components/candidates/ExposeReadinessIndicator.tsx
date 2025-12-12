import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';

interface ExposeReadinessIndicatorProps {
  candidate: {
    skills?: string[] | null;
    experience_years?: number | null;
    expected_salary?: number | null;
    availability_date?: string | null;
    notice_period?: string | null;
    city?: string | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown[] | null;
  } | null;
  compact?: boolean;
}

export function ExposeReadinessIndicator({ candidate, compact = false }: ExposeReadinessIndicatorProps) {
  const readiness = getExposeReadiness(candidate);

  const Icon = readiness.level === 'ready' 
    ? CheckCircle2 
    : readiness.level === 'partial' 
    ? AlertCircle 
    : XCircle;

  const iconColor = readiness.level === 'ready'
    ? 'text-emerald-500'
    : readiness.level === 'partial'
    ? 'text-amber-500'
    : 'text-muted-foreground';

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
            <span className={`text-xs ${readiness.badge.color}`}>
              {readiness.score}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium text-sm">{readiness.badge.label}</p>
          {readiness.missingFields.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Fehlt: {readiness.missingFields.join(', ')}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge 
          variant={readiness.badge.variant} 
          className="gap-1 cursor-help"
        >
          <Icon className="h-3 w-3" />
          {readiness.badge.label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[250px]">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Exposé-Qualität</span>
            <span className={`text-sm font-bold ${readiness.badge.color}`}>
              {readiness.score}%
            </span>
          </div>
          {readiness.missingFields.length > 0 && (
            <div className="pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground">Fehlende Felder:</p>
              <ul className="text-xs mt-1 space-y-0.5">
                {readiness.missingFields.map((field) => (
                  <li key={field} className="flex items-center gap-1">
                    <XCircle className="h-2.5 w-2.5 text-destructive" />
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {readiness.isReady && (
            <p className="text-xs text-emerald-600">
              Bereit für Triple-Blind Exposé!
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  Activity
} from 'lucide-react';
import { HealthConfig } from '@/hooks/useClientDashboard';

interface HealthScoreCompactProps {
  health: HealthConfig;
  className?: string;
}

const HEALTH_STYLES = {
  excellent: {
    bg: 'bg-success/10',
    border: 'border-success/30',
    text: 'text-success',
    icon: CheckCircle2,
  },
  good: {
    bg: 'bg-primary/10',
    border: 'border-primary/30',
    text: 'text-primary',
    icon: TrendingUp,
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    text: 'text-warning',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    text: 'text-destructive',
    icon: TrendingDown,
  },
};

export function HealthScoreCompact({ health, className }: HealthScoreCompactProps) {
  const styles = HEALTH_STYLES[health.level];
  const Icon = styles.icon;

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border',
      styles.bg,
      styles.border,
      className
    )}>
      <div className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center',
        styles.bg
      )}>
        <Icon className={cn('h-5 w-5', styles.text)} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('font-semibold', styles.text)}>
            {health.label}
          </span>
          <span className="text-xs text-muted-foreground">
            {health.score}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {health.message}
        </p>
      </div>
      
      <Activity className={cn('h-4 w-4 shrink-0', styles.text)} />
    </div>
  );
}

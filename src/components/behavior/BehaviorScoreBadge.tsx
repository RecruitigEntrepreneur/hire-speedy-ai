import { cn } from '@/lib/utils';
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Ghost,
  Minus 
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type BehaviorClass = 
  | 'fast_responder' 
  | 'high_performer' 
  | 'neutral' 
  | 'slow_responder' 
  | 'ghoster' 
  | 'at_risk';

interface BehaviorScoreBadgeProps {
  behaviorClass: BehaviorClass;
  riskScore?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const behaviorConfig: Record<BehaviorClass, {
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}> = {
  fast_responder: {
    label: 'Schneller Antworter',
    description: 'Reagiert schnell und zuverlässig',
    icon: Zap,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-100',
  },
  high_performer: {
    label: 'Top Performer',
    description: 'Hohe SLA-Erfüllung und Qualität',
    icon: TrendingUp,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-100',
  },
  neutral: {
    label: 'Neutral',
    description: 'Durchschnittliche Performance',
    icon: Minus,
    colorClass: 'text-gray-600',
    bgClass: 'bg-gray-100',
  },
  slow_responder: {
    label: 'Langsamer Antworter',
    description: 'Reagiert langsamer als erwartet',
    icon: Clock,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-100',
  },
  ghoster: {
    label: 'Ghoster',
    description: 'Antwortet häufig nicht',
    icon: Ghost,
    colorClass: 'text-red-600',
    bgClass: 'bg-red-100',
  },
  at_risk: {
    label: 'Gefährdet',
    description: 'Hohe Ausfallwahrscheinlichkeit',
    icon: AlertTriangle,
    colorClass: 'text-orange-600',
    bgClass: 'bg-orange-100',
  },
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const iconSizes = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function BehaviorScoreBadge({
  behaviorClass,
  riskScore,
  showLabel = true,
  size = 'md',
  className,
}: BehaviorScoreBadgeProps) {
  const config = behaviorConfig[behaviorClass] || behaviorConfig.neutral;
  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-full font-medium',
              config.bgClass,
              config.colorClass,
              sizeClasses[size],
              className
            )}
          >
            <Icon className={iconSizes[size]} />
            {showLabel && <span>{config.label}</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            {riskScore !== undefined && (
              <p className="text-xs">
                Risiko-Score: <span className={cn(
                  'font-medium',
                  riskScore < 30 ? 'text-emerald-600' :
                  riskScore < 60 ? 'text-amber-600' : 'text-red-600'
                )}>{Math.round(riskScore)}%</span>
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
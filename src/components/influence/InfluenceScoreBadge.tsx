import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

interface InfluenceScoreBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function InfluenceScoreBadge({ 
  score, 
  showLabel = true, 
  size = 'md',
  className = '' 
}: InfluenceScoreBadgeProps) {
  const getConfig = (score: number) => {
    if (score >= 80) {
      return {
        label: 'Top Performer',
        description: 'Ausgezeichnete Kandidatenführung',
        icon: TrendingUp,
        bgColor: 'bg-emerald-500/10',
        textColor: 'text-emerald-600',
        borderColor: 'border-emerald-500/30',
      };
    }
    if (score >= 60) {
      return {
        label: 'Gut',
        description: 'Gute Kandidatenführung',
        icon: Zap,
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-600',
        borderColor: 'border-blue-500/30',
      };
    }
    if (score >= 40) {
      return {
        label: 'Durchschnitt',
        description: 'Raum für Verbesserung',
        icon: Minus,
        bgColor: 'bg-amber-500/10',
        textColor: 'text-amber-600',
        borderColor: 'border-amber-500/30',
      };
    }
    return {
      label: 'Aufbauend',
      description: 'Nutze die Coaching-Tools',
      icon: TrendingDown,
      bgColor: 'bg-red-500/10',
      textColor: 'text-red-600',
      borderColor: 'border-red-500/30',
    };
  };

  const config = getConfig(score);
  const Icon = config.icon;

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`
            inline-flex items-center gap-1.5 rounded-full border font-medium cursor-help
            ${config.bgColor} ${config.textColor} ${config.borderColor}
            ${sizeClasses[size]}
            ${className}
          `}
        >
          <Icon className={iconSizes[size]} />
          <span className="font-semibold">{score}</span>
          {showLabel && <span className="hidden sm:inline">/ 100</span>}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <div className="font-semibold">{config.label}</div>
          <div className="text-xs text-muted-foreground">{config.description}</div>
          <div className="text-xs">
            Influence Score: <span className="font-medium">{score}/100</span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

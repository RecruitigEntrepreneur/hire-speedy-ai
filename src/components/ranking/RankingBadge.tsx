import { Badge } from '@/components/ui/badge';
import { Trophy, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankingBadgeProps {
  rank: number;
  score?: number;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function RankingBadge({ rank, score, showScore = false, size = 'md' }: RankingBadgeProps) {
  const getRankDisplay = () => {
    if (rank === 1) {
      return {
        icon: Trophy,
        label: '#1',
        className: 'bg-amber-500 text-white border-amber-600',
        iconClassName: 'text-amber-100',
      };
    }
    if (rank === 2) {
      return {
        icon: Medal,
        label: '#2',
        className: 'bg-slate-400 text-white border-slate-500',
        iconClassName: 'text-slate-100',
      };
    }
    if (rank === 3) {
      return {
        icon: Award,
        label: '#3',
        className: 'bg-amber-700 text-white border-amber-800',
        iconClassName: 'text-amber-100',
      };
    }
    return {
      icon: null,
      label: `#${rank}`,
      className: 'bg-muted text-muted-foreground border-border',
      iconClassName: '',
    };
  };

  const { icon: Icon, label, className, iconClassName } = getRankDisplay();

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-bold border gap-1 inline-flex items-center',
        className,
        sizeClasses[size]
      )}
    >
      {Icon && <Icon size={iconSizes[size]} className={iconClassName} />}
      <span>{label}</span>
      {showScore && score !== undefined && (
        <span className="opacity-75 ml-1">({score})</span>
      )}
    </Badge>
  );
}

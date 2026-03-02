import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TrustLevelInfo } from '@/hooks/useRecruiterTrustLevel';

interface TrustLevelBadgeProps {
  levelInfo: TrustLevelInfo;
  size?: 'sm' | 'md';
  className?: string;
}

export function TrustLevelBadge({ levelInfo, size = 'sm', className }: TrustLevelBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        levelInfo.bgColor,
        levelInfo.color,
        levelInfo.borderColor,
        size === 'sm' ? 'text-[10px] px-1.5 py-0 leading-4' : 'text-xs px-2 py-0.5',
        className,
      )}
    >
      {levelInfo.emoji} {levelInfo.label}
    </Badge>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  description?: string;
  trend?: number;
  trendLabel?: string;
  className?: string;
  iconColor?: string;
  isLoading?: boolean;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendLabel = 'vs. last period',
  className,
  iconColor = 'text-primary',
  isLoading,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-20" />
              <div className="h-8 w-8 bg-muted rounded" />
            </div>
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className={cn('p-2 rounded-lg bg-primary/10', iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>

        {trend !== undefined && (
          <div className="mt-3 flex items-center gap-1">
            <span
              className={cn(
                'text-sm font-medium',
                trend > 0 && 'text-green-600',
                trend < 0 && 'text-red-600',
                trend === 0 && 'text-muted-foreground'
              )}
            >
              {trend > 0 ? '+' : ''}{trend}%
            </span>
            <span className="text-xs text-muted-foreground">{trendLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversionRateCardProps {
  title: string;
  value: number;
  previousValue?: number;
  suffix?: string;
  icon?: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  isLoading?: boolean;
}

export function ConversionRateCard({
  title,
  value,
  previousValue,
  suffix = '%',
  icon,
  description,
  trend,
  isLoading,
}: ConversionRateCardProps) {
  const calculateTrend = () => {
    if (trend) return trend;
    if (previousValue === undefined) return 'neutral';
    if (value > previousValue) return 'up';
    if (value < previousValue) return 'down';
    return 'neutral';
  };

  const currentTrend = calculateTrend();
  const changeValue = previousValue !== undefined ? value - previousValue : 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : value}
              </span>
              {suffix && <span className="text-lg text-muted-foreground">{suffix}</span>}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {icon && (
            <div className="p-2 bg-primary/10 rounded-lg">
              {icon}
            </div>
          )}
        </div>

        {previousValue !== undefined && (
          <div className={cn(
            'flex items-center gap-1 mt-3 text-sm',
            currentTrend === 'up' && 'text-green-600',
            currentTrend === 'down' && 'text-red-600',
            currentTrend === 'neutral' && 'text-muted-foreground'
          )}>
            {currentTrend === 'up' && <TrendingUp className="w-4 h-4" />}
            {currentTrend === 'down' && <TrendingDown className="w-4 h-4" />}
            {currentTrend === 'neutral' && <Minus className="w-4 h-4" />}
            <span>
              {changeValue > 0 ? '+' : ''}{changeValue.toFixed(1)}{suffix}
            </span>
            <span className="text-muted-foreground">vs. previous period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

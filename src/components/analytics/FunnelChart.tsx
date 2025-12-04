import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelMetrics } from '@/hooks/useFunnelAnalytics';

interface FunnelChartProps {
  metrics: FunnelMetrics | null;
  isLoading?: boolean;
}

export function FunnelChart({ metrics, isLoading }: FunnelChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" style={{ width: `${100 - i * 15}%` }} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const stages = [
    {
      name: 'Submitted',
      value: metrics?.total_submissions || 0,
      color: 'bg-blue-500',
      percentage: 100,
    },
    {
      name: 'Opted In',
      value: metrics?.submissions_to_opt_in || 0,
      color: 'bg-cyan-500',
      percentage: metrics?.opt_in_rate || 0,
    },
    {
      name: 'Interviewed',
      value: metrics?.opt_in_to_interview || 0,
      color: 'bg-emerald-500',
      percentage: metrics?.interview_rate || 0,
    },
    {
      name: 'Offered',
      value: metrics?.interview_to_offer || 0,
      color: 'bg-amber-500',
      percentage: metrics?.offer_rate || 0,
    },
    {
      name: 'Placed',
      value: metrics?.offer_to_placement || 0,
      color: 'bg-green-500',
      percentage: metrics?.acceptance_rate || 0,
    },
  ];

  const maxValue = stages[0].value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Conversion Funnel</span>
          {metrics && (
            <span className="text-sm font-normal text-muted-foreground">
              {metrics.period_start} - {metrics.period_end}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const widthPercentage = maxValue > 0 ? (stage.value / maxValue) * 100 : 0;
            const conversionFromPrevious = index > 0 && stages[index - 1].value > 0
              ? ((stage.value / stages[index - 1].value) * 100).toFixed(1)
              : null;

            return (
              <div key={stage.name} className="relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{stage.value.toLocaleString()}</span>
                    {conversionFromPrevious && (
                      <span className="text-xs text-muted-foreground">
                        ({conversionFromPrevious}% from prev)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-10 bg-muted rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full ${stage.color} transition-all duration-500 ease-out rounded-lg flex items-center justify-end pr-3`}
                    style={{ width: `${Math.max(widthPercentage, 5)}%` }}
                  >
                    {widthPercentage > 20 && (
                      <span className="text-white text-sm font-medium">
                        {widthPercentage.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
                {index < stages.length - 1 && (
                  <div className="flex justify-center my-1">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {metrics?.total_submissions && metrics?.offer_to_placement
                ? ((metrics.offer_to_placement / metrics.total_submissions) * 100).toFixed(1)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Overall Conversion</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">
              {metrics?.avg_time_to_fill_days?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground">Avg. Days to Fill</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

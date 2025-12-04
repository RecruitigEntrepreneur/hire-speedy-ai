import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelMetrics } from '@/hooks/useFunnelAnalytics';
import { AlertTriangle } from 'lucide-react';

interface DropOffAnalysisProps {
  metrics: FunnelMetrics | null;
  isLoading?: boolean;
}

export function DropOffAnalysis({ metrics, isLoading }: DropOffAnalysisProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Drop-off Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-24 bg-muted rounded" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-muted rounded w-3/4" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const dropOffs = metrics?.drop_offs_by_stage || {};
  const reasons = metrics?.drop_off_reasons || {};

  const totalDropOffs = Object.values(dropOffs).reduce((sum, val) => sum + (val as number), 0);
  const totalReasons = Object.values(reasons).reduce((sum, val) => sum + (val as number), 0);

  const stageLabels: Record<string, string> = {
    screening: 'Screening',
    opt_in: 'Opt-In',
    interview: 'Interview',
    offer: 'Offer',
  };

  const reasonLabels: Record<string, string> = {
    salary: 'Gehalt',
    culture: 'Kultur',
    location: 'Standort',
    skills_mismatch: 'Skills',
    other_offer: 'Anderes Angebot',
    no_response: 'Keine Antwort',
    unknown: 'Unbekannt',
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'screening': return 'bg-red-500';
      case 'opt_in': return 'bg-orange-500';
      case 'interview': return 'bg-yellow-500';
      case 'offer': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Drop-off Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* By Stage */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">By Stage</h4>
          {totalDropOffs === 0 ? (
            <p className="text-sm text-muted-foreground">No drop-offs recorded</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(dropOffs)
                .filter(([_, value]) => (value as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([stage, count]) => {
                  const percentage = totalDropOffs > 0 ? ((count as number) / totalDropOffs) * 100 : 0;
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{stageLabels[stage] || stage}</span>
                        <span className="font-medium">{count as number} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getStageColor(stage)} transition-all duration-500`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* By Reason */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Top Reasons</h4>
          {totalReasons === 0 ? (
            <p className="text-sm text-muted-foreground">No rejection reasons recorded</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(reasons)
                .filter(([_, value]) => (value as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([reason, count], index) => {
                  const percentage = totalReasons > 0 ? ((count as number) / totalReasons) * 100 : 0;
                  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-gray-500'];
                  return (
                    <div key={reason} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors[index]}`} />
                      <span className="flex-1 text-sm">{reasonLabels[reason] || reason}</span>
                      <span className="text-sm font-medium">{percentage.toFixed(0)}%</span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-red-600">{totalDropOffs}</p>
              <p className="text-xs text-muted-foreground">Total Drop-offs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">
                {metrics?.total_submissions && totalDropOffs > 0
                  ? ((totalDropOffs / metrics.total_submissions) * 100).toFixed(0)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Drop-off Rate</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

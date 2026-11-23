import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FunnelMetrics } from '@/hooks/useFunnelAnalytics';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DropOffAnalysisProps {
  metrics: FunnelMetrics | null;
  isLoading?: boolean;
}

export function DropOffAnalysis({ metrics, isLoading }: DropOffAnalysisProps) {
  const { t } = useTranslation('clientDashboard');
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('analytics.dropOff')}</CardTitle>
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

  // Gespeicherte Schlüssel; Anzeige unter clientDashboard:analytics.dropStage / dropReason.
  const STAGES = ['screening', 'opt_in', 'interview', 'offer'];
  const REASONS = ['salary', 'culture', 'location', 'skills_mismatch', 'other_offer', 'no_response', 'unknown'];
  const stageLabel = (s: string) => (STAGES.includes(s) ? t(`analytics.dropStage.${s}`) : s);
  const reasonLabel = (r: string) => (REASONS.includes(r) ? t(`analytics.dropReason.${r}`) : r);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'screening': return 'bg-destructive/70';
      case 'opt_in': return 'bg-destructive/70';
      case 'interview': return 'bg-destructive/70';
      case 'offer': return 'bg-destructive/70';
      default: return 'bg-destructive/70';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          {t('analytics.dropOff')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* By Stage */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('analytics.byStage')}</h4>
          {totalDropOffs === 0 ? (
            <p className="text-sm text-muted-foreground">{t('analytics.noDropOffs')}</p>
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
                        <span>{stageLabel(stage)}</span>
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
          <h4 className="text-sm font-medium text-muted-foreground mb-3">{t('analytics.topReasons')}</h4>
          {totalReasons === 0 ? (
            <p className="text-sm text-muted-foreground">{t('analytics.noReasons')}</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(reasons)
                .filter(([_, value]) => (value as number) > 0)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .slice(0, 5)
                .map(([reason, count], index) => {
                  const percentage = totalReasons > 0 ? ((count as number) / totalReasons) * 100 : 0;
                  const colors = ['bg-destructive/80', 'bg-destructive/65', 'bg-destructive/50', 'bg-destructive/40', 'bg-destructive/30'];
                  return (
                    <div key={reason} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${colors[index]}`} />
                      <span className="flex-1 text-sm">{reasonLabel(reason)}</span>
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
              <p className="text-2xl font-bold text-destructive">{totalDropOffs}</p>
              <p className="text-xs text-muted-foreground">{t('analytics.totalDropOffs')}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">
                {metrics?.total_submissions && totalDropOffs > 0
                  ? ((totalDropOffs / metrics.total_submissions) * 100).toFixed(0)
                  : 0}%
              </p>
              <p className="text-xs text-muted-foreground">{t('analytics.dropOffRate')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

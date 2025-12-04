import { Activity, AlertTriangle, Clock, Lightbulb, RefreshCw, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { DealHealthBadge } from './DealHealthBadge';
import { DealHealth } from '@/hooks/useDealHealth';
import { cn } from '@/lib/utils';

interface DealHealthCardProps {
  health: DealHealth;
  onRefresh?: () => void;
  loading?: boolean;
}

export function DealHealthCard({ health, onRefresh, loading }: DealHealthCardProps) {
  const getBottleneckLabel = (bottleneck: string | null): string => {
    if (!bottleneck) return 'Kein Engpass';
    const labels: Record<string, string> = {
      client_review: 'Client-Review ausstehend',
      client_decision: 'Client-Entscheidung ausstehend',
      candidate_opt_in: 'Kandidaten Opt-In ausstehend',
      interview_scheduling: 'Interview-Planung ausstehend',
    };
    return labels[bottleneck] || bottleneck;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Deal Health
        </CardTitle>
        <div className="flex items-center gap-2">
          <DealHealthBadge 
            score={health.health_score} 
            riskLevel={health.risk_level as 'low' | 'medium' | 'high' | 'critical'} 
          />
          {onRefresh && (
            <Button variant="ghost" size="icon" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Gesundheitsscore</span>
            <span className="font-medium">{health.health_score}%</span>
          </div>
          <Progress 
            value={health.health_score} 
            className={cn(
              'h-2',
              health.risk_level === 'critical' && '[&>div]:bg-red-500',
              health.risk_level === 'high' && '[&>div]:bg-orange-500',
              health.risk_level === 'medium' && '[&>div]:bg-amber-500',
              health.risk_level === 'low' && '[&>div]:bg-green-500'
            )}
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <TrendingDown className="h-3 w-3" />
              Drop-Off Risiko
            </div>
            <p className={cn(
              'font-medium',
              health.drop_off_probability > 70 ? 'text-red-600' : 
              health.drop_off_probability > 40 ? 'text-amber-600' : 'text-green-600'
            )}>
              {health.drop_off_probability.toFixed(0)}%
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              Letzte Aktivität
            </div>
            <p className="font-medium">
              {health.days_since_last_activity === 0 
                ? 'Heute' 
                : `Vor ${health.days_since_last_activity} Tagen`}
            </p>
          </div>
        </div>

        {/* Bottleneck */}
        {health.bottleneck && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Engpass erkannt</p>
                <p className="text-sm text-amber-700">{getBottleneckLabel(health.bottleneck)}</p>
                {health.bottleneck_days > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Seit {health.bottleneck_days} Tagen blockiert
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AI Assessment */}
        {health.ai_assessment && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">{health.ai_assessment}</p>
          </div>
        )}

        {/* Risk Factors */}
        {health.risk_factors && health.risk_factors.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Risikofaktoren</p>
            <ul className="space-y-1">
              {health.risk_factors.map((factor, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {health.recommended_actions && health.recommended_actions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Lightbulb className="h-3 w-3" />
              Empfehlungen
            </p>
            <ul className="space-y-1">
              {health.recommended_actions.map((action, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {action}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-right">
          Berechnet: {new Date(health.calculated_at).toLocaleString('de-DE')}
        </p>
      </CardContent>
    </Card>
  );
}

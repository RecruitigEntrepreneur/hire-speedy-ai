import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, TrendingDown } from 'lucide-react';
import { PipelineCandidate, PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

interface BottleneckSummaryProps {
  candidates: PipelineCandidate[];
}

interface Bottleneck {
  stage: string;
  stageLabel: string;
  count: number;
  avgDays: number;
  severity: 'critical' | 'high' | 'medium';
}

export function BottleneckSummary({ candidates }: BottleneckSummaryProps) {
  const bottlenecks = useMemo(() => {
    const stageStats: Record<string, { count: number; totalHours: number }> = {};
    
    candidates.forEach(c => {
      const stage = c.stage || 'submitted';
      if (!stageStats[stage]) {
        stageStats[stage] = { count: 0, totalHours: 0 };
      }
      stageStats[stage].count++;
      stageStats[stage].totalHours += c.hoursInStage;
    });

    const issues: Bottleneck[] = [];
    
    Object.entries(stageStats).forEach(([stageKey, stats]) => {
      const avgDays = Math.floor((stats.totalHours / stats.count) / 24);
      const stageConfig = PIPELINE_STAGES.find(s => s.key === stageKey);
      
      if (avgDays >= 3 && stats.count > 0) {
        issues.push({
          stage: stageKey,
          stageLabel: stageConfig?.label || stageKey,
          count: stats.count,
          avgDays,
          severity: avgDays >= 7 ? 'critical' : avgDays >= 5 ? 'high' : 'medium',
        });
      }
    });

    return issues.sort((a, b) => b.avgDays - a.avgDays);
  }, [candidates]);

  if (bottlenecks.length === 0) return null;

  const severityConfig = {
    critical: { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    high: { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    medium: { color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  };

  const worstSeverity = bottlenecks[0]?.severity || 'medium';
  const config = severityConfig[worstSeverity];

  return (
    <Card className={`border ${config.border} ${config.bg}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`p-1.5 rounded ${config.bg}`}>
            <TrendingDown className={`h-4 w-4 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`font-medium text-sm ${config.color}`}>
                Bottlenecks erkannt
              </span>
              <Badge variant="outline" className={`${config.color} border-current text-xs`}>
                {bottlenecks.length} {bottlenecks.length === 1 ? 'Bereich' : 'Bereiche'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {bottlenecks.slice(0, 3).map(b => (
                <div key={b.stage} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{b.stageLabel}:</span>
                  <span className="font-medium">{b.count} Kandidaten</span>
                  <span>Ø {b.avgDays}d</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

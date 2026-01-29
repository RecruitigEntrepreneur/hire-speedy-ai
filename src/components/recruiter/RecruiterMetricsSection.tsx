import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: number;
  platformAverage: number;
  suffix?: string;
  invertComparison?: boolean;
}

function MetricCard({ title, value, platformAverage, suffix = '%', invertComparison = false }: MetricCardProps) {
  const diff = value - platformAverage;
  const isPositive = invertComparison ? diff < 0 : diff > 0;
  const isNeutral = Math.abs(diff) < 0.5;

  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <p className="text-2xl font-bold">
          {value.toFixed(1)}{suffix}
        </p>
        <div className="flex items-center gap-1 mt-2">
          {isNeutral ? (
            <Minus className="h-3 w-3 text-muted-foreground" />
          ) : isPositive ? (
            <TrendingUp className="h-3 w-3 text-emerald" />
          ) : (
            <TrendingDown className="h-3 w-3 text-destructive" />
          )}
          <span className={cn(
            "text-xs",
            isNeutral ? "text-muted-foreground" : isPositive ? "text-emerald" : "text-destructive"
          )}>
            {isNeutral ? '=' : isPositive ? '+' : ''}{diff.toFixed(1)}{suffix}
          </span>
          <span className="text-xs text-muted-foreground ml-1">
            vs. ⌀ {platformAverage.toFixed(1)}{suffix}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

interface RecruiterMetricsSectionProps {
  interviewInviteRate: number;
  hireToInterviewRate: number;
  qcRejectionRate: number;
  platformAverages: {
    interviewInviteRate: number;
    hireToInterviewRate: number;
    qcRejectionRate: number;
  };
}

export function RecruiterMetricsSection({
  interviewInviteRate,
  hireToInterviewRate,
  qcRejectionRate,
  platformAverages,
}: RecruiterMetricsSectionProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Deine Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            title="Interview Invite Rate"
            value={interviewInviteRate}
            platformAverage={platformAverages.interviewInviteRate}
          />
          <MetricCard
            title="Hire-to-Interview Rate"
            value={hireToInterviewRate}
            platformAverage={platformAverages.hireToInterviewRate}
          />
          <MetricCard
            title="QC Rejection Rate"
            value={qcRejectionRate}
            platformAverage={platformAverages.qcRejectionRate}
            invertComparison={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

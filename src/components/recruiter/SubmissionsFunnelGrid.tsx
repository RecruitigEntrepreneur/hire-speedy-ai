import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { StatusCount } from '@/hooks/useRecruiterStats';

interface FunnelStage {
  key: string;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
}

const FUNNEL_STAGES: FunnelStage[] = [
  { key: 'submitted', label: 'Submitted', description: 'To be reviewed', colorClass: 'text-amber-600', bgClass: 'bg-amber-50 dark:bg-amber-950/30' },
  { key: 'in_review', label: 'In Review', description: 'In Quality Control', colorClass: 'text-blue-600', bgClass: 'bg-blue-50 dark:bg-blue-950/30' },
  { key: 'forwarded', label: 'Forwarded', description: 'Forwarded to client', colorClass: 'text-indigo-600', bgClass: 'bg-indigo-50 dark:bg-indigo-950/30' },
  { key: 'screening', label: 'Screening', description: 'Screened by client', colorClass: 'text-cyan-600', bgClass: 'bg-cyan-50 dark:bg-cyan-950/30' },
  { key: 'rejected', label: 'Rejected', description: 'Candidate was rejected', colorClass: 'text-destructive', bgClass: 'bg-destructive/10' },
  { key: 'interview_requested', label: 'IV Invited', description: 'Invite was sent out', colorClass: 'text-purple-600', bgClass: 'bg-purple-50 dark:bg-purple-950/30' },
  { key: 'interview_1', label: '1st Interview', description: '1st interview conducted', colorClass: 'text-purple-600', bgClass: 'bg-purple-50 dark:bg-purple-950/30' },
  { key: 'interview_2', label: '2nd Interview', description: '2nd interview conducted', colorClass: 'text-purple-600', bgClass: 'bg-purple-50 dark:bg-purple-950/30' },
  { key: 'offer', label: 'Offer', description: 'Offer stage', colorClass: 'text-emerald', bgClass: 'bg-emerald/10' },
  { key: 'hired', label: 'Hired', description: 'Contract signed', colorClass: 'text-emerald', bgClass: 'bg-emerald/20' },
];

interface SubmissionsFunnelGridProps {
  statusBreakdown: StatusCount[];
}

export function SubmissionsFunnelGrid({ statusBreakdown }: SubmissionsFunnelGridProps) {
  const getStatusData = (key: string): { count: number; earning: number } => {
    // Check both status and stage fields
    const match = statusBreakdown.find(s => 
      s.status === key || s.stage === key
    );
    return {
      count: match?.count || 0,
      earning: match?.potentialEarning || 0,
    };
  };

  const formatEarning = (amount: number): string => {
    if (amount >= 1000) {
      return `€${(amount / 1000).toFixed(1)}k`;
    }
    return `€${amount.toLocaleString()}`;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Submissions Übersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {FUNNEL_STAGES.map((stage) => {
            const data = getStatusData(stage.key);
            const isHired = stage.key === 'hired';
            const isRejected = stage.key === 'rejected';

            return (
              <div
                key={stage.key}
                className={cn(
                  "p-3 rounded-lg border transition-colors",
                  stage.bgClass,
                  isHired && "ring-2 ring-emerald ring-offset-2 ring-offset-background",
                  isRejected && data.count > 0 && "border-destructive/30"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {isHired && <Check className="h-3.5 w-3.5 text-emerald" />}
                  <span className={cn("text-xs font-medium", stage.colorClass)}>
                    {stage.label}
                  </span>
                </div>
                <p className="text-2xl font-bold">{data.count}</p>
                <p className={cn(
                  "text-xs mt-1",
                  isHired ? "text-emerald font-medium" : "text-muted-foreground"
                )}>
                  {isHired && data.count > 0 ? '' : '~'}{formatEarning(data.earning)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

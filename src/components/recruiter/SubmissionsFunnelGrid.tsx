import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { CanonicalStage } from '@/lib/submissionStage';

export interface FunnelEntry {
  stage: CanonicalStage;
  label: string;
  closed: boolean;
  count: number;
  potentialEarning: number;
}

/** Farbgebung je Phase. Die Reihenfolge und das Vokabular kommen aus
 *  src/lib/submissionStage.ts — diese Uebersicht hatte vorher eine eigene
 *  Stage-Liste (forwarded, screening, interview_1/2, hired) und zeigte deshalb
 *  andere Zahlen als der Kanban direkt darunter. */
const TONE: Record<string, { text: string; bg: string }> = {
  submitted: { text: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  in_review: { text: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  interview_requested: { text: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  candidate_opted_in: { text: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
  interview_scheduled: { text: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  interview_counter_proposed: { text: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  interview_completed: { text: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
  offer: { text: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  placed: { text: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-950/50' },
  interview_declined: { text: 'text-muted-foreground', bg: 'bg-muted/50' },
  client_rejected: { text: 'text-destructive', bg: 'bg-destructive/10' },
  rejected: { text: 'text-destructive', bg: 'bg-destructive/10' },
  withdrawn: { text: 'text-muted-foreground', bg: 'bg-muted/50' },
};

const formatEarning = (amount: number): string =>
  amount >= 1000 ? `€${(amount / 1000).toFixed(1)}k` : `€${amount.toLocaleString()}`;

export function SubmissionsFunnelGrid({ breakdown }: { breakdown: FunnelEntry[] }) {
  // Beendete Phasen ohne Faelle sind kein Informationsgewinn.
  const visible = breakdown.filter((e) => !e.closed || e.count > 0);
  const laufend = breakdown.filter((e) => !e.closed).reduce((sum, e) => sum + e.count, 0);
  const offenesHonorar = breakdown
    .filter((e) => !e.closed)
    .reduce((sum, e) => sum + e.potentialEarning, 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Übersicht</CardTitle>
        <p className="text-sm text-muted-foreground">
          {laufend} laufend · offenes Honorar {formatEarning(offenesHonorar)}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {visible.map((entry) => {
            const tone = TONE[entry.stage] ?? { text: 'text-muted-foreground', bg: 'bg-muted/50' };
            const isPlaced = entry.stage === 'placed';

            return (
              <div
                key={entry.stage}
                className={cn(
                  'rounded-lg border p-3 transition-colors',
                  tone.bg,
                  isPlaced && entry.count > 0 && 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-background',
                  entry.closed && 'opacity-80',
                )}
              >
                <div className="mb-1 flex items-center gap-1.5">
                  {isPlaced && entry.count > 0 && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                  <span className={cn('text-xs font-medium', tone.text)}>{entry.label}</span>
                </div>
                <p className="text-2xl font-bold">{entry.count}</p>
                {/* Honorar nur bei laufenden Phasen: bei beendeten waere die
                    Zahl kein Potenzial mehr und liest sich faelschlich als
                    Verdienst. */}
                <p
                  className={cn(
                    'mt-1 text-xs',
                    isPlaced && entry.count > 0
                      ? 'font-medium text-emerald-600'
                      : 'text-muted-foreground',
                  )}
                >
                  {entry.closed ? ' ' : `~${formatEarning(entry.potentialEarning)}`}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoTile } from './BentoTile';
import type { UnifiedAction } from '@/hooks/useClientDashboard';
import { Zap, Eye, CalendarClock, FileText, CheckCircle2, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  actions: UnifiedAction[];
  loading?: boolean;
}

const ICON: Record<string, LucideIcon> = {
  review_candidate: Eye,
  schedule_interview: CalendarClock,
  make_offer: FileText,
};

const linkFor = (a: UnifiedAction): string => {
  if (a.type === 'review_candidate' && a.submissionId) return `/dashboard/candidates/${a.submissionId}`;
  if (a.type === 'make_offer') return '/dashboard/offers';
  return '/dashboard/interviews';
};

const urgencyDot = (u: string) =>
  u === 'critical' ? 'bg-destructive' : u === 'warning' ? 'bg-amber-500' : 'bg-muted-foreground/40';

const waitLabel = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} Tg` : h >= 1 ? `${h} h` : 'neu');

/** Tile C – Entscheidungs-Queue (review_candidate · schedule_interview · make_offer),
 *  serverseitig bereits nach Dringlichkeit sortiert. */
export function BrauchtEntscheidungTile({ actions, loading }: Props) {
  const visible = actions.slice(0, 5);

  return (
    <BentoTile icon={Zap} title="Braucht Entscheidung" count={loading ? undefined : actions.length}>
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : actions.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center py-6 text-center">
          <CheckCircle2 className="mb-1.5 h-8 w-8 text-emerald-500/60" />
          <p className="text-sm text-muted-foreground">Alles erledigt</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {visible.map((a) => {
            const Icon = ICON[a.type] || Zap;
            return (
              <Link
                key={a.id}
                to={linkFor(a)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-2.5 py-2 transition-all',
                  a.urgency === 'critical' ? 'bg-destructive/[0.04] hover:bg-destructive/[0.08]' : 'hover:bg-accent/50',
                )}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', urgencyDot(a.urgency))} />
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium transition-colors group-hover:text-primary">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.subtitle}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{waitLabel(a.waitingHours)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </BentoTile>
  );
}

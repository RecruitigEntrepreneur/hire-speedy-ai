import { cn } from '@/lib/utils';
import { STATUS_LABEL, STATUS_SHORT, type FeedbackStatus } from '@/lib/feedback/labels';

const PRIORITY_STYLE: Record<string, string> = {
  p0: 'bg-red-500/15 text-red-700 dark:text-red-300',
  p1: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  p2: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  p3: 'bg-muted text-muted-foreground',
};

export function PriorityBadge({ priority, className }: { priority: string | null; className?: string }) {
  if (!priority) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase', PRIORITY_STYLE[priority], className)}>
      {priority}
    </span>
  );
}

const STATUS_STYLE: Record<FeedbackStatus, string> = {
  new: 'border-foreground/30 text-foreground',
  in_progress: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  built: 'border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  dismissed: 'border-border text-muted-foreground',
  duplicate: 'border-border text-muted-foreground',
};

export function StatusBadge({ status, short }: { status: string; short?: boolean }) {
  const s = status as FeedbackStatus;
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px]', STATUS_STYLE[s])}>
      {(short ? STATUS_SHORT : STATUS_LABEL)[s] ?? status}
    </span>
  );
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.replace(/@.*/, '').split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

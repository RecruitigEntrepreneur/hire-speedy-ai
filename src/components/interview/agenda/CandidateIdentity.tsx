import { cn } from '@/lib/utils';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CheckCircle2, Lock } from 'lucide-react';

/** Anonymität als Designelement: vor Opt-In Schloss-Avatar + Mono-Code,
 *  nach Freigabe Initialen + Klarname + grüner Haken. */
export function CandidateAvatar({ iv, className }: { iv: AgendaInterview; className?: string }) {
  if (!iv.identityUnlocked) {
    return (
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground',
          className,
        )}
        aria-label="Identität noch nicht freigegeben"
      >
        <Lock className="h-4 w-4" />
      </div>
    );
  }
  const initials = iv.candidateName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary',
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function CandidateName({ iv, className }: { iv: AgendaInterview; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className={cn('truncate text-sm font-medium', !iv.identityUnlocked && 'font-mono text-[13px]')}>
        {iv.candidateName}
      </span>
      {iv.identityUnlocked && (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Identität freigegeben" />
      )}
    </span>
  );
}

import { FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Markierung in Kandidatenlisten: ohne hochgeladenen Lebenslauf kein Einreichen. */
export function CvMissingBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs text-warning', className)} title="Ohne Lebenslauf kann der Kandidat nicht eingereicht werden.">
      <FileWarning className="h-3 w-3" aria-hidden />
      Lebenslauf fehlt
    </span>
  );
}

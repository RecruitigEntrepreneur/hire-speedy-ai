import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { Honorar } from '@/components/recruiter/Honorar';
import type { ChainItem, StepView } from '../../../../supabase/functions/_shared/abrechnung-view';

/**
 * Schritte im Besetzungs-Fenster (H9/H10): ✓ erledigt, ● jetzt dran, ○ später.
 * Ruhig, ohne Ampelfarben; nur der aktuelle Schritt ist hervorgehoben.
 */
export function SchrittListe({ steps }: { steps: StepView[] }) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {steps.map((s, i) => (
        <li key={`${i}-${s.text}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-2 py-2 text-sm">
          <span aria-hidden="true" className={cn('text-center', s.state === 'current' ? 'text-foreground' : 'text-muted-foreground')}>
            {s.state === 'done' ? '✓' : s.state === 'current' ? '●' : '○'}
          </span>
          <span className={cn(s.state === 'current' && 'font-medium', s.state === 'todo' && 'text-muted-foreground')}>
            <Honorar>{s.text}</Honorar>
            {s.note && <span className="text-muted-foreground"> · <Honorar>{s.note}</Honorar></span>}
            <span className="sr-only">{s.state === 'done' ? ' (erledigt)' : s.state === 'current' ? ' (jetzt)' : ' (später)'}</span>
          </span>
          <span className={cn('whitespace-nowrap text-xs tabular-nums', s.state === 'current' ? 'text-foreground' : 'text-muted-foreground')}>{s.date}</span>
        </li>
      ))}
    </ol>
  );
}

/** Fortschritt in der Liste (H8): „Rechnung ✓ · Bezahlt ✓ · Angetreten ✓ · 1. Teil · Garantie · 2. Teil“ */
export function Kette({ items }: { items: ChainItem[] }) {
  return (
    <span className="text-xs text-muted-foreground">
      {items.map((c, i) => (
        <Fragment key={`${i}-${c.label}`}>
          {i > 0 && <span aria-hidden="true"> · </span>}
          <span className={cn(c.state === 'current' && 'font-medium text-foreground', c.state === 'todo' && 'text-muted-foreground/60')}>
            {c.label}{c.state === 'done' ? ' ✓' : ''}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

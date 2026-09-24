import { cn } from '@/lib/utils';
import { verlaufDatum, type Verlauf } from '@/lib/stellenVerlauf';

/**
 * Der Stand einer eingereichten Stelle als Leiste -- im Job-Detail.
 * Erledigte Schritte tragen ihr Datum, der aktuelle sagt, was gerade passiert.
 */
export function VerlaufLeiste({ verlauf, className }: { verlauf: Verlauf; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {verlauf.schritte.map((s) => (
        <div
          key={s.key}
          className={cn(
            'min-w-[7.5rem] flex-1 border-t-[3px] pt-1.5',
            s.zustand === 'erledigt' ? 'border-emerald-500' : s.zustand === 'aktuell' ? 'border-primary' : 'border-border',
          )}
        >
          <p className={cn('text-xs', s.zustand === 'aktuell' ? 'font-semibold' : s.zustand === 'offen' && 'text-muted-foreground')}>
            {s.zustand === 'erledigt' && <span className="text-emerald-600">✓ </span>}
            {s.label}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {s.zustand === 'erledigt' ? verlaufDatum(s.datum) : s.hinweis ?? ''}
          </p>
        </div>
      ))}
    </div>
  );
}

/** Derselbe Stand als Punkte -- fuer Listen, wo eine Zeile reichen muss. */
export function VerlaufPunkte({ verlauf, className }: { verlauf: Verlauf; className?: string }) {
  const titel = verlauf.schritte
    .map((s) => `${s.zustand === 'erledigt' ? '✓' : s.zustand === 'aktuell' ? '●' : '○'} ${s.label}`)
    .join('\n');
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={titel} aria-label={verlauf.kurz}>
      {verlauf.schritte.map((s) => (
        <span
          key={s.key}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            s.zustand === 'erledigt' ? 'bg-emerald-500' : s.zustand === 'aktuell' ? 'bg-primary' : 'bg-muted-foreground/30',
          )}
        />
      ))}
    </span>
  );
}

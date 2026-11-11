import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Check as CheckItem } from '@/lib/buchhaltungApi';

/** Alle Abfragen der Admin-Buchhaltung neu laden (Schlüssel beginnen mit „admin-buchhaltung“). */
export function useRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['admin-buchhaltung'] });
}

export const errText = (e: unknown, fallback = 'Das hat nicht geklappt.') => (e instanceof Error ? e.message : fallback);

/** ✓ / ✗ / · wie in den Wireframes; Kreuz nur bei echtem Hindernis. */
export function CheckList({ checks, className }: { checks: CheckItem[]; className?: string }) {
  return (
    <ul className={cn('space-y-1.5 text-sm', className)}>
      {checks.map((c, i) => (
        <li key={`${c.key ?? i}-${c.label}`} className="flex gap-2">
          {c.state === 'ok' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            : c.state === 'fail' ? <X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              : <span className="w-4 shrink-0 text-center text-muted-foreground">·</span>}
          <span className={cn(c.state === 'fail' && 'text-destructive')}>{c.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'warn' }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-semibold tabular-nums', tone === 'warn' && 'text-destructive')}>{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function Loading() {
  return <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lädt …</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border p-6 text-sm text-muted-foreground">{children}</p>;
}

export function ErrorLine({ error }: { error: unknown }) {
  return <p className="text-sm text-destructive">{errText(error, 'Konnte nicht geladen werden.')}</p>;
}

/** Kleine Box für die Folgen-Vorschau (A8) */
export function Box({ title, value, lines }: { title: string; value: string; lines: string[] }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="font-semibold tabular-nums">{value}</p>
      {lines.map((l) => <p key={l} className="text-xs text-muted-foreground">{l}</p>)}
    </div>
  );
}

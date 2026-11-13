import { cn } from '@/lib/utils';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';
import type { BesetzungItem } from '@/lib/besetzungApi';
import { dayMonth, dranOf, factsOf, statusOf, stepsOf, titleOf, type Fact, type PanelRow, type Step, type Tone } from './besetzungView';

/**
 * Bausteine der Seite „Besetzungen“ (Etappe 2, 25.10.2026; ruhiger seit 11.11.2026):
 * Etikett, Schritte, Eckdaten, Karte, Zeilen der Nachbesetzung.
 */

const PILL: Record<Tone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-destructive/10 text-destructive',
  neutral: 'border border-border bg-muted/40 text-muted-foreground',
};

export function StatusPill({ text, tone, className }: { text: string; tone: Tone; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', PILL[tone], className)}>{text}</span>;
}

/** Schritte ruhig: erledigt grau, jetzt hervorgehoben, nur Abbruch rot. */
export function StepRow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {steps.map((s, n) => (
        <span key={n} className={cn('rounded-md border px-2 py-0.5 text-[11px]',
          s.state === 'done' && 'text-muted-foreground',
          s.state === 'now' && 'border-foreground/30 font-medium text-foreground',
          s.state === 'next' && 'border-dashed text-muted-foreground',
          s.state === 'bad' && 'border-destructive/30 text-destructive')}>
          {s.state === 'done' ? '✓ ' : s.state === 'now' ? '● ' : s.state === 'bad' ? '✕ ' : '○ '}{s.label}
        </span>
      ))}
    </div>
  );
}

const FACT_TONE: Record<Tone, string> = { good: '', warn: '', bad: 'text-destructive', neutral: '' };

/** Auf der Karte gekürzt (limit), im Fenster vollständig mit Umbruch. onAction: Link „ergänzen“ u. Ä. */
export function FactGrid({ facts, limit, onAction }: { facts: Fact[]; limit?: number; onAction?: (a: NonNullable<Fact['action']>) => void }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {(limit ? facts.slice(0, limit) : facts).map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className={cn(limit ? 'truncate' : 'break-words', f.tone && FACT_TONE[f.tone])} title={f.value}>
            {f.value}
            {f.action && onAction && !limit && (
              <button type="button" className="ml-1.5 text-xs font-medium underline underline-offset-2 hover:text-foreground" onClick={() => onAction(f.action!)}>{i18n.t('clientPlacements:facts.add')}</button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Zeilen „✓ Gemeldet 12.12.“, „● Matchunt prüft Ihre Meldung bis 16.12.“ (K6, J3) */
export function PanelRows({ rows }: { rows: PanelRow[] }) {
  if (!rows.length) return null;
  return (
    <ol className="divide-y text-sm">
      {rows.map((r, n) => (
        <li key={n} className="flex items-baseline gap-2 py-1.5">
          <span className={cn('w-3 shrink-0 text-center', r.state === 'now' ? 'text-foreground' : 'text-muted-foreground')}>{r.state === 'done' ? '✓' : r.state === 'now' ? '●' : '○'}</span>
          <span className={cn('min-w-0 flex-1', r.state === 'now' && 'font-medium', r.state === 'next' && 'text-muted-foreground')}>{r.text}</span>
          {r.date && <span className="shrink-0 text-xs text-muted-foreground">{dayMonth(r.date)}</span>}
        </li>
      ))}
    </ol>
  );
}

export function BesetzungCard({ item, hasTask, onOpen }: { item: BesetzungItem; hasTask: boolean; onOpen: () => void }) {
  useTranslation('clientPlacements');
  const status = statusOf(item);
  const dran = dranOf(item, hasTask);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-sm">
          <span className="font-semibold">{titleOf(item)}</span>
          <span className="text-muted-foreground"> · {item.jobTitle}{item.recruiterName ? i18n.t('clientPlacements:common.via', { name: item.recruiterName }) : ''}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {dran && <StatusPill text={i18n.t('clientPlacements:dran.label', { who: dran.text })} tone={dran.tone} />}
          <StatusPill text={status.text} tone={status.tone} />
        </div>
      </div>
      <div className="mt-2"><StepRow steps={stepsOf(item)} /></div>
      <div className="mt-3"><FactGrid facts={factsOf(item)} limit={4} /></div>
    </button>
  );
}

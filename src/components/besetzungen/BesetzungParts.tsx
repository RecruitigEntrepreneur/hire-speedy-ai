import { cn } from '@/lib/utils';
import type { BesetzungItem } from '@/lib/besetzungApi';
import { dranOf, factsOf, statusOf, stepsOf, type Fact, type Step, type Tone } from './besetzungView';

/** Bausteine der Seite „Besetzungen“ (Etappe 2, 25.10.2026): Etikett, Schritte, Eckdaten, Karte. */

const PILL: Record<Tone, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'bg-destructive/10 text-destructive',
  neutral: 'border border-border bg-muted/40 text-muted-foreground',
};

export function StatusPill({ text, tone, className }: { text: string; tone: Tone; className?: string }) {
  return <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium', PILL[tone], className)}>{text}</span>;
}

export function StepRow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {steps.map((s, n) => (
        <span key={n} className={cn('rounded-md border px-2 py-0.5 text-[11px]',
          s.state === 'done' && 'text-emerald-700 dark:text-emerald-400',
          s.state === 'now' && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
          s.state === 'next' && 'text-muted-foreground',
          s.state === 'bad' && 'border-destructive/30 bg-destructive/10 text-destructive')}>
          {s.state === 'done' ? '✓ ' : s.state === 'now' ? '● ' : s.state === 'bad' ? '✕ ' : '○ '}{s.label}
        </span>
      ))}
    </div>
  );
}

const FACT_TONE: Record<Tone, string> = { good: 'text-emerald-700 dark:text-emerald-400', warn: 'text-amber-700 dark:text-amber-400', bad: 'text-destructive', neutral: '' };

/** Auf der Karte gekürzt (limit), im Fenster vollständig mit Umbruch. */
export function FactGrid({ facts, limit }: { facts: Fact[]; limit?: number }) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
      {(limit ? facts.slice(0, limit) : facts).map((f) => (
        <div key={f.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{f.label}</dt>
          <dd className={cn(limit ? 'truncate' : 'break-words', f.tone && FACT_TONE[f.tone])} title={f.value}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BesetzungCard({ item, hasTask, onOpen }: { item: BesetzungItem; hasTask: boolean; onOpen: () => void }) {
  const status = statusOf(item);
  const dran = dranOf(item, hasTask);
  return (
    <button type="button" onClick={onOpen} className="w-full rounded-xl border bg-card p-4 text-left transition-colors hover:border-foreground/30">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="min-w-0 text-sm">
          <span className="font-semibold">{item.name}</span>
          <span className="text-muted-foreground"> · {item.jobTitle}{item.recruiterName ? ` · über ${item.recruiterName}` : ''}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {dran && <StatusPill text={`dran: ${dran.text}`} tone={dran.tone} />}
          <StatusPill text={status.text} tone={status.tone} />
        </div>
      </div>
      <div className="mt-2"><StepRow steps={stepsOf(item)} /></div>
      <div className="mt-3"><FactGrid facts={factsOf(item)} limit={4} /></div>
    </button>
  );
}

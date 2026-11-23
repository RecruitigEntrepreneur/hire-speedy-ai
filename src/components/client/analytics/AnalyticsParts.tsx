import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bausteine der allgemeinen Analytics (22.11.2026, Apple-Stil).
 * Nur Darstellung – gerechnet wird in src/lib/clientAnalytics.ts.
 * Farben: Blau für Mengen, Grün nur für „Eingestellt“, Rot nur für Abgänge.
 */

export function AnaCard({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-5', className)}>
      {title && <h3 className="mb-3 text-[15px] font-semibold tracking-tight">{title}</h3>}
      {children}
    </div>
  );
}

/** Kleine Linie ohne Achsen – zeigt nur die Richtung. */
export function Sparkline({ values, tone = 'klick' }: { values: number[]; tone?: 'klick' | 'green' | 'muted' }) {
  if (values.length < 2 || values.every((v) => v === 0)) return <div className="mt-2 h-6" aria-hidden />;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, n) => `${(n / (values.length - 1)) * 100},${22 - ((v - min) / span) * 20}`).join(' ');
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className={cn('mt-2 h-6 w-full', tone === 'green' ? 'text-green-500' : tone === 'muted' ? 'text-muted-foreground' : 'text-klick')} aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Kpi({ label, value, spark, tone, green }: { label: string; value: ReactNode; spark: number[]; tone?: 'klick' | 'green' | 'muted'; green?: boolean }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-3xl font-semibold tracking-tight', green && 'text-green-600')}>{value}</p>
      <Sparkline values={spark} tone={tone} />
    </div>
  );
}

export interface FlowPart {
  key: string;
  label: string;
  value: number;
  tone: 'green' | 'klick' | 'red' | 'muted';
}

const TILE: Record<FlowPart['tone'], string> = {
  green: 'bg-green-600 text-white',
  klick: 'bg-klick text-klick-foreground',
  red: 'bg-destructive text-destructive-foreground',
  muted: 'bg-secondary text-muted-foreground',
};
const TILE_DOT: Record<FlowPart['tone'], string> = { green: 'bg-green-600', klick: 'bg-klick', red: 'bg-destructive', muted: 'bg-muted-foreground/50' };

/**
 * Kacheln: wohin die Vorschläge gegangen sind. Jede Fläche so groß wie ihre Zahl –
 * die größte Gruppe links, die zweitgrößte rechts oben, kleine Gruppen als Reihe darunter.
 * Kleine Kacheln zeigen nur die Zahl; ihre Erklärung steht in der Zeile unter den Kacheln.
 */
export function FlowTiles({ total, totalLabel, parts }: { total: number; totalLabel: string; parts: FlowPart[] }) {
  const shown = parts.filter((p) => p.value > 0).sort((x, y) => y.value - x.value);
  if (!total || !shown.length) return null;
  const [first, second, ...rest] = shown;
  const restSum = rest.reduce((s, p) => s + p.value, 0);
  const big = (p: FlowPart) => (
    <div key={p.key} className={cn('flex min-h-0 min-w-0 flex-col justify-end overflow-hidden rounded-xl p-3', TILE[p.tone])} style={{ flexGrow: p.value, flexBasis: 0 }}>
      <p className="text-3xl font-semibold leading-none tracking-tight">{p.value}</p>
      <p className="mt-1 truncate text-sm">{p.label}</p>
    </div>
  );
  return (
    <div>
      <div className="flex h-44 gap-1.5">
        <div className="flex min-w-[30%]" style={{ flexGrow: first.value, flexBasis: 0 }}>{big(first)}</div>
        {second && (
          <div className="flex min-w-[30%] flex-col gap-1.5" style={{ flexGrow: second.value + restSum, flexBasis: 0 }}>
            {big(second)}
            {rest.length > 0 && (
              <div className="flex min-h-[2.25rem] gap-1.5" style={{ flexGrow: restSum, flexBasis: 0 }}>
                {rest.map((p) => (
                  <div key={p.key} title={`${p.value} ${p.label}`} className={cn('flex min-w-[2.25rem] items-center justify-center overflow-hidden rounded-lg text-sm font-semibold', TILE[p.tone])} style={{ flexGrow: p.value, flexBasis: 0 }}>
                    {p.value}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{total} {totalLabel}</span>
        {rest.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', TILE_DOT[p.tone])} />{p.value} {p.label}</span>
        ))}
      </p>
    </div>
  );
}

/** Zeit-Balken: Abschnitte im Verhältnis ihrer Dauer, der eigene Anteil blau. */
export function TimeBar({ segments, legend = true, scaleTo }: { segments: { key: string; label: string; short: string; days: number; mine: boolean }[]; legend?: boolean; scaleTo?: number }) {
  const total = segments.reduce((s, x) => s + x.days, 0) || 1;
  // scaleTo: gemeinsame Länge zweier Balken, damit der kürzere auch kürzer aussieht
  const width = scaleTo && scaleTo > 0 ? `${Math.max(35, Math.min(100, (total / scaleTo) * 100))}%` : undefined;
  return (
    <div>
      <div className="flex gap-1" style={{ width }}>
        {segments.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: ${s.short}`}
            className={cn('flex h-8 min-w-[2.75rem] items-center justify-center overflow-hidden whitespace-nowrap rounded-lg px-1.5 text-xs', s.mine ? 'bg-klick font-medium text-klick-foreground' : 'bg-secondary text-muted-foreground')}
            style={{ flexGrow: Math.max(0.06, s.days / total), flexBasis: 0 }}
          >
            {s.short}
          </div>
        ))}
      </div>
      {legend && (
        <ul className="mt-3 space-y-1 text-xs">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <span className={cn('h-2 w-2 shrink-0 rounded-full', s.mine ? 'bg-klick' : 'bg-border')} />
                <span className={s.mine ? 'font-medium' : 'text-muted-foreground'}>{s.label}</span>
              </span>
              <span className={cn('whitespace-nowrap', s.mine ? 'font-medium' : 'text-muted-foreground')}>{s.short}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Säulen mit Zahl darüber. */
export function Columns({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center">
          <div className="flex h-24 w-full flex-col justify-end">
            <p className="mb-1 text-center text-xs font-medium">{d.value}</p>
            <div className={cn('w-full rounded-t-md', d.value ? 'bg-klick/85' : 'bg-border')} style={{ height: d.value ? `${Math.max(6, (d.value / max) * 100)}%` : 2 }} />
          </div>
          <p className="mt-1.5 text-center text-[11px] leading-tight text-muted-foreground">{d.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Ring: Anteil erledigt, grün. */
export function Ring({ value, total }: { value: number; total: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const part = total ? Math.min(1, value / total) : 0;
  return (
    <svg viewBox="0 0 80 80" className="h-24 w-24 shrink-0" role="img" aria-label={`${value}/${total}`}>
      <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" className="stroke-secondary" />
      {part > 0 && (
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-green-500" strokeDasharray={`${part * c} ${c}`} transform="rotate(-90 40 40)" />
      )}
      <text x="40" y="45" textAnchor="middle" className="fill-foreground text-[15px] font-semibold">{value}/{total}</text>
    </svg>
  );
}

/** Linien über die Zeit, gemeinsame Skala. */
export function TrendLines({ series, from, to }: { series: { key: string; label: string; values: number[]; tone: 'klick' | 'green' | 'muted' }[]; from: string; to: string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const color = { klick: 'text-klick', green: 'text-green-500', muted: 'text-muted-foreground' } as const;
  const dot = { klick: 'bg-klick', green: 'bg-green-500', muted: 'bg-muted-foreground' } as const;
  return (
    <div>
      <div className="relative h-28">
        <div className="absolute inset-x-0 bottom-0 border-b" />
        {series.map((s) => (
          <svg key={s.key} viewBox="0 0 100 100" preserveAspectRatio="none" className={cn('absolute inset-0 h-full w-full', color[s.tone])} aria-hidden>
            <polyline
              points={s.values.map((v, n) => `${s.values.length > 1 ? (n / (s.values.length - 1)) * 100 : 50},${96 - (v / max) * 90}`).join(' ')}
              fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        ))}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>{from}</span>
        <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', dot[s.tone])} />{s.label}</span>
          ))}
        </span>
        <span>{to}</span>
      </div>
    </div>
  );
}

/** Waagerechte Balken mit Zahl rechts. */
export function BarList({ rows }: { rows: { key: string; label: string; value: number; muted?: boolean }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.key}>
          <div className="flex justify-between gap-3"><span>{r.label}</span><span>{r.value}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-secondary">
            <div className={cn('h-1.5 rounded-full', r.muted ? 'bg-muted-foreground/40' : 'bg-klick/85')} style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Säulen je Woche, ohne Zahlen – zeigt, ob noch Vorschläge kommen. */
export function WeekBars({ values, from, to }: { values: number[]; from: string; to: string }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex h-20 items-end gap-1">
        {values.map((v, n) => (
          <div key={n} title={String(v)} className={cn('flex-1 rounded-t-sm', v ? 'bg-klick/85' : 'bg-border')} style={{ height: v ? `${Math.max(8, (v / max) * 100)}%` : 2 }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>{from}</span><span>{to}</span></div>
    </div>
  );
}

/** Gehaltswünsche als Bänder: Säule je Band, Bänder im eigenen Budget kräftig, darüber rot, darunter blass. */
export function SalaryBands({ bands }: { bands: { label: string; count: number; over: boolean; inBudget: boolean }[] }) {
  const max = Math.max(1, ...bands.map((b) => b.count));
  return (
    <div className="flex gap-2">
      {bands.map((b) => (
        <div key={b.label} className="flex min-w-0 max-w-[7rem] flex-1 flex-col items-center">
          <div className="flex h-24 w-full flex-col justify-end">
            <p className="mb-1 text-center text-xs font-medium">{b.count}</p>
            <div className={cn('w-full rounded-t-md', b.over ? 'bg-destructive/80' : b.inBudget ? 'bg-klick' : 'bg-klick/35')} style={{ height: `${Math.max(8, (b.count / max) * 100)}%` }} />
          </div>
          <p className={cn('mt-1.5 text-center text-[11px] leading-tight', b.inBudget ? 'font-medium text-foreground' : 'text-muted-foreground')}>{b.label}</p>
        </div>
      ))}
    </div>
  );
}

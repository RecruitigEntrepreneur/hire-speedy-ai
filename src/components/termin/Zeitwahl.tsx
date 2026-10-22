import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { TerminTag } from '@/lib/terminApi';

/** Tagesleiste und Uhrzeiten der Terminseite (nur freie Zeiten, deutsche Zeit). */
const TAG = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short' });
const NR = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: 'numeric' });
const LANG = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' });
const UHR = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: 'numeric', minute: '2-digit' });

export const uhrzeit = (iso: string) => UHR.format(new Date(iso));
export const tagLang = (iso: string) => LANG.format(new Date(iso));
export const terminKurz = (iso: string) => `${TAG.format(new Date(iso)).replace('.', '')} ${new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' }).format(new Date(iso))} · ${uhrzeit(iso)}`;

export function Zeitwahl({ tage, gewaehlt, onWahl }: { tage: TerminTag[]; gewaehlt: string | null; onWahl: (iso: string) => void }) {
  const [tag, setTag] = useState<string | null>(null);
  useEffect(() => {
    if (!tage.length) { setTag(null); return; }
    if (!tag || !tage.some(t => t.tag === tag)) setTag(gewaehlt ? tage.find(t => t.zeiten.includes(gewaehlt))?.tag ?? tage[0].tag : tage[0].tag);
  }, [tage, tag, gewaehlt]);
  const aktuell = useMemo(() => tage.find(t => t.tag === tag) ?? null, [tage, tag]);

  return <div className="space-y-3">
    <div role="tablist" aria-label="Tag wählen" className="flex gap-1.5 overflow-x-auto pb-1">
      {tage.map(t => {
        const d = new Date(`${t.tag}T12:00:00Z`);
        const an = t.tag === tag;
        return <button key={t.tag} type="button" role="tab" aria-selected={an} aria-label={`${LANG.format(d)}, ${t.zeiten.length} ${t.zeiten.length === 1 ? 'freie Zeit' : 'freie Zeiten'}`} onClick={() => setTag(t.tag)}
          className={cn('flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 text-xs leading-tight transition-colors',
            an ? 'border-transparent bg-foreground text-background' : 'border-border hover:bg-muted')}>
          <span>{TAG.format(d).replace('.', '')}</span><span className="text-sm font-semibold">{NR.format(d)}</span>
        </button>;
      })}
    </div>
    {aktuell && <>
      <p className="text-xs text-muted-foreground">{LANG.format(new Date(`${aktuell.tag}T12:00:00Z`))} · {aktuell.zeiten.length} {aktuell.zeiten.length === 1 ? 'freie Zeit' : 'freie Zeiten'}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {aktuell.zeiten.map(z => <button key={z} type="button" onClick={() => onWahl(z)} aria-pressed={gewaehlt === z}
          className={cn('rounded-lg border py-2 text-sm tabular-nums transition-colors', gewaehlt === z ? 'border-transparent bg-foreground text-background' : 'border-border hover:border-foreground/40 hover:bg-muted')}>
          {uhrzeit(z)}
        </button>)}
      </div>
    </>}
  </div>;
}

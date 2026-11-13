import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import type { TerminTag } from '@/lib/terminApi';

/** Tagesleiste und Uhrzeiten der Terminseite (nur freie Zeiten, deutsche Zeit), in der Sprache der Oberfläche. */
const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(intlLocale(i18n.language), { timeZone: 'Europe/Berlin', ...opts });
const tagKurz = (d: Date) => fmt({ weekday: 'short' }).format(d).replace('.', '');
const tagNr = (d: Date) => fmt({ day: 'numeric' }).format(d);
const tagLangD = (d: Date) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(d);

export const uhrzeit = (iso: string) => fmt({ hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
export const tagLang = (iso: string) => tagLangD(new Date(iso));
/** Nur der Wochentag, z. B. für „Auf Freitag, 10:00 verschieben“. */
export const wochentag = (iso: string) => fmt({ weekday: 'long' }).format(new Date(iso));
export const terminKurz = (iso: string) => `${tagKurz(new Date(iso))} ${fmt({ day: '2-digit', month: '2-digit' }).format(new Date(iso))} · ${uhrzeit(iso)}`;

export function Zeitwahl({ tage, gewaehlt, onWahl }: { tage: TerminTag[]; gewaehlt: string | null; onWahl: (iso: string) => void }) {
  const { t: tr } = useTranslation('candidatePages');
  const [tag, setTag] = useState<string | null>(null);
  useEffect(() => {
    if (!tage.length) { setTag(null); return; }
    if (!tag || !tage.some(t => t.tag === tag)) setTag(gewaehlt ? tage.find(t => t.zeiten.includes(gewaehlt))?.tag ?? tage[0].tag : tage[0].tag);
  }, [tage, tag, gewaehlt]);
  const aktuell = useMemo(() => tage.find(t => t.tag === tag) ?? null, [tage, tag]);

  return <div className="space-y-3">
    <div role="tablist" aria-label={tr('zeitwahl.chooseDay')} className="flex gap-1.5 overflow-x-auto pb-1">
      {tage.map(t => {
        const d = new Date(`${t.tag}T12:00:00Z`);
        const an = t.tag === tag;
        return <button key={t.tag} type="button" role="tab" aria-selected={an} aria-label={`${tagLangD(d)}, ${tr('zeitwahl.freeTimes', { count: t.zeiten.length })}`} onClick={() => setTag(t.tag)}
          className={cn('flex min-w-[3.25rem] shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 text-xs leading-tight transition-colors',
            an ? 'border-transparent bg-foreground text-background' : 'border-border hover:bg-muted')}>
          <span>{tagKurz(d)}</span><span className="text-sm font-semibold">{tagNr(d)}</span>
        </button>;
      })}
    </div>
    {aktuell && <>
      <p className="text-xs text-muted-foreground">{tagLangD(new Date(`${aktuell.tag}T12:00:00Z`))} · {tr('zeitwahl.freeTimes', { count: aktuell.zeiten.length })}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {aktuell.zeiten.map(z => <button key={z} type="button" onClick={() => onWahl(z)} aria-pressed={gewaehlt === z}
          className={cn('rounded-lg border py-2 text-sm tabular-nums transition-colors', gewaehlt === z ? 'border-transparent bg-foreground text-background' : 'border-border hover:border-foreground/40 hover:bg-muted')}>
          {uhrzeit(z)}
        </button>)}
      </div>
    </>}
  </div>;
}

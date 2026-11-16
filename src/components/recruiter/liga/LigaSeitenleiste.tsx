import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ligaMe } from '@/lib/liga';
import { cn } from '@/lib/utils';

/**
 * Liga unten in der Seitenleiste (16.11.2026, Marko: „den Part nach links in die Seitenleiste unten,
 * klickbar, dann sparen wir uns den Klick in der Liste“). Ersetzt den Menüpunkt „Matchunt Liga“ und
 * auf dem Computer die Karte in der Übersicht; am Handy bleibt die Karte (dort gibt es keine Seitenleiste).
 * Immer da, auch ohne Teilnahme, damit die Liga erreichbar bleibt.
 */
export function LigaSeitenleiste() {
  // Dieselbe Abfrage wie die Karte in der Übersicht: ein Aufruf für beide.
  const q = useQuery({ queryKey: ['liga', 'me', null], queryFn: () => ligaMe(null), staleTime: 60_000, retry: false });
  const { t } = useTranslation('recruiterLiga');
  const { pathname } = useLocation();
  const aktiv = pathname.startsWith('/recruiter/liga');

  const d = q.data;
  const s = d?.season && !d.season.closed ? d.season : null;
  const days = s ? (s.days_left > 0 ? t('card.daysLeft', { count: s.days_left }) : t('card.grace')) : null;
  const m = d?.participant && s && d.me && !d.me.excluded ? d.me : null;

  let zeile2: string;
  let zeile3: string | null;
  if (m && s) {
    zeile2 = `${m.rank ? t('rankOf', { rank: m.rank, total: m.participants }) : t('notRanked')} · ${m.points} ${t('table.points')}`;
    const gap = m.rank && m.rank > 1 && m.gap_above !== null ? t('card.gap', { count: m.gap_above, rank: m.rank - 1 }) : null;
    zeile3 = [gap ?? s.label, days].filter(Boolean).join(' · ');
  } else {
    zeile2 = t('side.notIn');
    zeile3 = s && days ? t('side.running', { season: s.label, days }) : null;
  }

  return (
    <Link to="/recruiter/liga" aria-current={aktiv ? 'page' : undefined}
          className={cn('block rounded-lg border px-3 py-2.5 transition-colors',
            aktiv ? 'border-foreground bg-muted' : 'border-border/60 bg-muted/40 hover:bg-muted')}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="text-[#C8A24A]" aria-hidden="true">✦</span>
        <span className="font-medium text-foreground">Matchunt Liga</span>
        <ChevronRight className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
      </span>
      {q.isLoading
        ? <span className="mt-1.5 block h-3 w-3/4 animate-pulse rounded bg-muted" aria-hidden="true" />
        : <>
          <span className="mt-0.5 block text-sm font-semibold">{zeile2}</span>
          {zeile3 && <span className="block text-xs text-muted-foreground">{zeile3}</span>}
        </>}
    </Link>
  );
}

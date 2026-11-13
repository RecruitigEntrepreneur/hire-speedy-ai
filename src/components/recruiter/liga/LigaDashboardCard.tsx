import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { ligaMe } from '@/lib/liga';

/**
 * H1: schmale Liga-Karte auf der Übersicht. Nur für Teilnehmer mit laufender Saison,
 * eine Zeile Stand, eine Zeile Abstand und Preis. Nicht größer als nötig.
 */
export function LigaDashboardCard() {
  const q = useQuery({ queryKey: ['liga', 'me', null], queryFn: () => ligaMe(null), staleTime: 60_000, retry: false });
  const { t } = useTranslation('recruiterLiga');
  const d = q.data;
  if (!d?.participant || !d.season || !d.me || d.season.closed || d.me.excluded) return null;
  const s = d.season;
  const m = d.me;
  const winner = d.awards.find(a => a.kind === 'season_winner');
  const gap = m.rank && m.rank > 1 && m.gap_above !== null ? t('card.gap', { count: m.gap_above, rank: m.rank - 1 }) : null;
  const days = s.days_left > 0 ? t('card.daysLeft', { count: s.days_left }) : t('card.grace');
  return <Card className="border-border/30 shadow-sm">
    <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground"><span className="text-[#C8A24A]">✦</span> {t('badgeLine', { season: s.label })}</span>
          <span>{days}</span>
          <Link to="/recruiter/liga?tab=regeln" className="inline-flex items-center gap-0.5 underline-offset-2 hover:underline"><Info className="h-3 w-3"/>{t('tabs.regeln')}</Link>
        </p>
        <p className="mt-0.5 font-semibold">{m.rank ? t('rankOf', { rank: m.rank, total: m.participants }) : t('notRanked')} · {m.points} {t('table.points')}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[gap, t('card.top', { top: s.top_n }), winner?.prize ? t('card.prize', { prize: winner.prize }) : null].filter(Boolean).join(' · ')}
        </p>
      </div>
      <Link to="/recruiter/liga" className="inline-flex shrink-0 items-center text-sm font-medium hover:underline">{t('card.toLiga')}<ChevronRight className="h-4 w-4"/></Link>
    </CardContent>
  </Card>;
}

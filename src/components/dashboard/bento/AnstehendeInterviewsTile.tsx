import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { meetingTypeLabel } from '@/components/interview/agenda/meetingType';
import { Skeleton } from '@/components/ui/skeleton';
import { BentoTile } from './BentoTile';
import { KachelLeer, KachelReiter, KachelZeile } from './KachelTeile';
import { useClientUpcomingInterviews, type UpcomingInterview } from '@/hooks/useClientUpcomingInterviews';
import { CalendarDays } from 'lucide-react';

const isTodayIso = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return i18n.t('clientDashboard:tiles.today');
  if (diff === 1) return i18n.t('clientDashboard:tiles.tomorrow');
  return fmtWeekdayDayMonth(d);
};

const timeLabel = (iso: string) => fmtTime(iso);

/** Tile D – Anstehende (bestätigte, zukünftige) Interviews mit Join-Link.
 *  Apple-Stil (21.11.2026): gleiche Zeilen wie die anderen Kacheln, der Termin ist die Hauptzeile. */
export function AnstehendeInterviewsTile() {
  const { t } = useTranslation(['clientDashboard', 'interviews']);
  const { data, isLoading } = useClientUpcomingInterviews();
  const [tab, setTab] = useState<'all' | 'today'>('all');
  const items = data || [];
  const heute = items.filter((iv) => isTodayIso(iv.scheduledAt));
  const aktiv = tab === 'today' && heute.length ? 'today' : 'all';
  const reiter: { key: 'all' | 'today'; label: string }[] = [
    { key: 'all', label: t('tiles.allCount', { count: items.length }) },
    ...(heute.length ? [{ key: 'today' as const, label: `${t('tiles.today')} (${heute.length})` }] : []),
  ];
  const visible = (aktiv === 'today' ? heute : items).slice(0, 5);

  return (
    <BentoTile
      icon={CalendarDays}
      title={t('tiles.upcomingInterviews')}
      count={isLoading ? undefined : items.length}
      to="/dashboard/interviews"
      toLabel={t('tiles.calendar')}
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <KachelReiter<'all' | 'today'> items={reiter} value={aktiv} onChange={setTab} />
          {items.length === 0 ? (
            <KachelLeer>{t('tiles.noUpcoming')}</KachelLeer>
          ) : (
            <div>
              {visible.map((iv: UpcomingInterview) => (
                <KachelZeile
                  key={iv.id}
                  title={`${dateLabel(iv.scheduledAt)} · ${timeLabel(iv.scheduledAt)}`}
                  sub={`${iv.anonId} · ${meetingTypeLabel(iv.meetingFormat)}`}
                  action={iv.joinUrl ? t('tiles.join') : undefined}
                  actionHref={iv.joinUrl ?? undefined}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </BentoTile>
  );
}

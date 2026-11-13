import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { meetingTypeLabel } from '@/components/interview/agenda/meetingType';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BentoTile } from './BentoTile';
import { useClientUpcomingInterviews, type UpcomingInterview } from '@/hooks/useClientUpcomingInterviews';
import { CalendarDays, Video, Phone, MapPin, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatIcon = (f: string | null): LucideIcon => (f === 'phone' ? Phone : f === 'onsite' ? MapPin : Video);

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

/** Tile D – Anstehende (bestätigte, zukünftige) Interviews mit Join-Link. */
export function AnstehendeInterviewsTile() {
  const { t } = useTranslation(['clientDashboard', 'interviews']);
  const { data, isLoading } = useClientUpcomingInterviews();
  const items = data || [];

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
      ) : items.length === 0 ? (
        <div className="flex h-full items-center justify-center py-6 text-center text-sm text-muted-foreground">
          {t('tiles.noUpcoming')}
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((iv: UpcomingInterview) => {
            const Icon = formatIcon(iv.meetingFormat);
            const isToday = isTodayIso(iv.scheduledAt);
            return (
              <div
                key={iv.id}
                className="flex items-center gap-3 rounded-lg border border-border/40 p-2 transition-all hover:border-primary/30"
              >
                <div
                  className={cn(
                    'min-w-[52px] rounded-md py-1 text-center',
                    isToday ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  <p className="text-[10px] font-medium leading-tight">{dateLabel(iv.scheduledAt)}</p>
                  <p className="text-sm font-bold leading-tight">{timeLabel(iv.scheduledAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-medium">{iv.anonId}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3" />
                    {meetingTypeLabel(iv.meetingFormat)}
                  </p>
                </div>
                {iv.joinUrl && (
                  <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-xs">
                    <a href={iv.joinUrl} target="_blank" rel="noreferrer">
                      {t('tiles.join')}
                    </a>
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </BentoTile>
  );
}

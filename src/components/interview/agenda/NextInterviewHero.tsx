import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { durationLabel } from '@/lib/interviewScheduling';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateAvatar, CandidateName } from './CandidateIdentity';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { relativeDay } from '@/lib/interviewRequestUtils';
import { meetingTypeLabel, MeetingTypeIcon } from './meetingType';
import { CalendarPlus, Clock, Sparkles, Video } from 'lucide-react';

interface Props {
  interview: AgendaInterview;
  onOpenGuide: (iv: AgendaInterview) => void;
  /** Klick auf das Interview öffnet das Interview-Fenster */
  onOpen: (iv: AgendaInterview) => void;
  onEdit: (iv: AgendaInterview) => void;
}

function countdownLabel(iv: AgendaInterview, now: number): string {
  const start = new Date(iv.scheduledAt!).getTime();
  const tx = (key: string, options?: Record<string, unknown>) => i18n.t(`clientInterviews:hero.${key}`, options) as string;
  if (now >= start) return tx('live');
  const mins = Math.round((start - now) / 60_000);
  if (mins < 60) return tx('inMinutes', { m: mins });
  const h = Math.floor(mins / 60);
  if (h < 24) return tx('inHours', { h, m: mins % 60 });
  // Ab einem Tag nach Kalendertagen, wie im Interview-Fenster
  return tx('startsDay', { day: relativeDay(iv.scheduledAt!, new Date(now).toISOString()) });
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return i18n.t('clientInterviews:day.today');
  if (diff === 1) return i18n.t('clientInterviews:day.tomorrow');
  return fmtWeekdayDayMonth(d);
};

/** Das nächste bestätigte Interview – groß, mit Live-Countdown, Beitreten und Guide. */
export function NextInterviewHero({ interview: iv, onOpenGuide, onOpen, onEdit }: Props) {
  const { t } = useTranslation('clientInterviews');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const isLive = iv.scheduledAt ? now >= new Date(iv.scheduledAt).getTime() : false;
  const time = fmtTime(iv.scheduledAt!);

  const addToCalendar = () =>
    downloadIcs(
      `interview-${iv.candidateName.replace(/[^\w]+/g, '-')}`,
      buildIcs({
        title: `Interview · ${iv.candidateName} · ${iv.jobTitle}`,
        description: iv.notes || undefined,
        location: iv.onsiteAddress || iv.joinUrl || undefined,
        url: iv.joinUrl || undefined,
        start: new Date(iv.scheduledAt!),
        durationMinutes: iv.durationMinutes,
      }),
    );

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-background">
      <CardContent className="p-5">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Clock className="h-3.5 w-3.5" />
          {t('hero.next', { when: countdownLabel(iv, now) })}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[60px] rounded-lg bg-primary px-2 py-1.5 text-center text-primary-foreground">
            <p className="text-[10px] font-medium leading-tight">{dayLabel(iv.scheduledAt!)}</p>
            <p className="text-base font-bold leading-tight">{time}</p>
          </div>
          <CandidateAvatar iv={iv} className="h-10 w-10" />
          <button type="button" onClick={() => onOpen(iv)} className="min-w-0 flex-1 basis-48 rounded-md text-left hover:opacity-90" aria-label={t('hero.openAria', { name: iv.candidateName })}>
            <div className="flex flex-wrap items-center gap-2">
              <CandidateName iv={iv} className="text-base" />
              {iv.identityUnlocked ? (
                <Badge variant="outline" className="gap-1 border-emerald-500/40 text-xs text-emerald-600">
                  {t('identity.unlocked')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {t('hero.anonymous')}
                </Badge>
              )}
              {!iv.confirmed && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  {t('row.unconfirmed')}
                </Badge>
              )}
              {iv.rescheduleRequested && (
                <Badge variant="outline" className="text-xs">{t('row.rescheduleRequested')}</Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MeetingTypeIcon type={iv.meetingType} className="h-3.5 w-3.5" />
              {meetingTypeLabel(iv.meetingType)} · {iv.jobTitle} · {durationLabel(iv.durationMinutes)}
            </p>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            {iv.joinUrl && (
              <Button asChild variant="hero" size="sm" className="gap-1.5">
                <a href={iv.joinUrl} target="_blank" rel="noreferrer">
                  <Video className="h-4 w-4" />
                  {isLive ? t('hero.joinNow') : t('row.join')}
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onOpenGuide(iv)}>
              <Sparkles className="h-4 w-4" />
              {t('hero.guide')}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={addToCalendar}
              aria-label={t('hero.addCalendar')}
              title={t('hero.addCalendar')}
            >
              <CalendarPlus className="h-4 w-4" />
            </Button>
            {iv.confirmed && !iv.rescheduleRequested && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onEdit(iv)}>
                {t('hero.reschedule')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

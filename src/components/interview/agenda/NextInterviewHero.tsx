import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { fmtTime, fmtWeekdayDayMonth } from '@/lib/localeFormat';
import { durationLabel } from '@/lib/interviewScheduling';
import { Button } from '@/components/ui/button';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { relativeDay } from '@/lib/interviewRequestUtils';
import { meetingTypeLabel } from './meetingType';

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

  // Apple-Stil (21.11.2026): dieselbe Form wie „Als Nächstes“ – Titel, eine große Zeile, ein Satz, ein blauer Knopf.
  const name = !iv.identityUnlocked && iv.candidateRole ? iv.candidateRole : iv.candidateName;
  const leise = 'whitespace-nowrap text-xs text-muted-foreground hover:text-foreground';
  return (
    <div className="rounded-[20px] border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold tracking-tight">{t('hero.title')}</h2>
        <span className="text-xs text-muted-foreground">{countdownLabel(iv, now)}</span>
      </div>
      <button type="button" onClick={() => onOpen(iv)} className="mt-4 block max-w-full text-left" aria-label={t('hero.openAria', { name: iv.candidateName })}>
        <p className="text-xl font-semibold leading-snug tracking-tight">{dayLabel(iv.scheduledAt!)}, {time} · {name}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {[meetingTypeLabel(iv.meetingType), durationLabel(iv.durationMinutes), iv.jobTitle,
            !iv.confirmed ? t('row.unconfirmed') : null, iv.rescheduleRequested ? t('row.rescheduleRequested') : null].filter(Boolean).join(' · ')}
        </p>
      </button>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-2">
          {iv.joinUrl ? (
            <Button asChild className="px-5">
              <a href={iv.joinUrl} target="_blank" rel="noreferrer">{isLive ? t('hero.joinNow') : t('row.join')}</a>
            </Button>
          ) : (
            <Button className="px-5" onClick={() => onOpen(iv)}>{t('row.details')}</Button>
          )}
          <Button variant="secondary" className="px-5" onClick={() => onOpenGuide(iv)}>{t('hero.guide')}</Button>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className={leise} onClick={addToCalendar}>{t('hero.addCalendar')}</button>
          {iv.confirmed && !iv.rescheduleRequested && <button type="button" className={leise} onClick={() => onEdit(iv)}>{t('hero.reschedule')}</button>}
        </div>
      </div>
    </div>
  );
}

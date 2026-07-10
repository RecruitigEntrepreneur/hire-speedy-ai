import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateAvatar, CandidateName } from './CandidateIdentity';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { meetingTypeLabel, MeetingTypeIcon } from './meetingType';
import { CalendarPlus, Clock, Sparkles, Video } from 'lucide-react';

interface Props {
  interview: AgendaInterview;
  onOpenGuide: (iv: AgendaInterview) => void;
  onEdit: (iv: AgendaInterview) => void;
}

function countdownLabel(iv: AgendaInterview, now: number): string {
  const start = new Date(iv.scheduledAt!).getTime();
  if (now >= start) return 'läuft gerade';
  const mins = Math.round((start - now) / 60_000);
  if (mins < 60) return `beginnt in ${mins} Min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `beginnt in ${h} Std ${mins % 60} Min`;
  const d = Math.floor(h / 24);
  return `beginnt in ${d} ${d === 1 ? 'Tag' : 'Tagen'}`;
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diff = Math.round((that.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Morgen';
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
};

/** Das nächste bestätigte Interview – groß, mit Live-Countdown, Beitreten und Guide. */
export function NextInterviewHero({ interview: iv, onOpenGuide, onEdit }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const isLive = iv.scheduledAt ? now >= new Date(iv.scheduledAt).getTime() : false;
  const time = new Date(iv.scheduledAt!).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

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
          Als Nächstes · {countdownLabel(iv, now)}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-[60px] rounded-lg bg-primary px-2 py-1.5 text-center text-primary-foreground">
            <p className="text-[10px] font-medium leading-tight">{dayLabel(iv.scheduledAt!)}</p>
            <p className="text-base font-bold leading-tight">{time}</p>
          </div>
          <CandidateAvatar iv={iv} className="h-10 w-10" />
          <div className="min-w-0 flex-1 basis-48">
            <div className="flex flex-wrap items-center gap-2">
              <CandidateName iv={iv} className="text-base" />
              {iv.identityUnlocked ? (
                <Badge variant="outline" className="gap-1 border-emerald-500/40 text-xs text-emerald-600">
                  Identität freigegeben
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  anonym bis Opt-In
                </Badge>
              )}
              {!iv.confirmed && (
                <Badge variant="outline" className="text-xs text-amber-600">
                  unbestätigt
                </Badge>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MeetingTypeIcon type={iv.meetingType} className="h-3.5 w-3.5" />
              {meetingTypeLabel(iv.meetingType)} · {iv.jobTitle} · {iv.durationMinutes} Min
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {iv.joinUrl && (
              <Button asChild variant="hero" size="sm" className="gap-1.5">
                <a href={iv.joinUrl} target="_blank" rel="noreferrer">
                  <Video className="h-4 w-4" />
                  {isLive ? 'Jetzt beitreten' : 'Beitreten'}
                </a>
              </Button>
            )}
            {iv.identityUnlocked && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onOpenGuide(iv)}>
                <Sparkles className="h-4 w-4" />
                Interview-Guide
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={addToCalendar}
              aria-label="Zum Kalender hinzufügen (.ics)"
              title="Zum Kalender hinzufügen (.ics)"
            >
              <CalendarPlus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => onEdit(iv)}>
              Umbuchen
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

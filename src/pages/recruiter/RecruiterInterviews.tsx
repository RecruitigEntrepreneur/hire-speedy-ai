import { useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarClock,
  CalendarX,
  Video,
  Phone,
  MapPin,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  Hourglass,
  Lock,
} from 'lucide-react';
import {
  useRecruiterInterviewAgenda,
  type RecruiterInterview,
  type RecruiterInterviewAgenda,
} from '@/hooks/useRecruiterInterviewAgenda';
import {
  RecruiterTerminSheet,
  type RecruiterTerminVariant,
} from '@/components/interview/agenda/RecruiterTerminSheet';
import { cn } from '@/lib/utils';

const formatFee = (fee: number | null) => (fee ? `~€${Math.round(fee / 1000)}k` : null);

function MeetingIcon({ type, className }: { type: string | null; className?: string }) {
  if (type === 'phone') return <Phone className={className} />;
  if (type === 'onsite' || type === 'in_person') return <MapPin className={className} />;
  return <Video className={className} />;
}

/** Leitet die Sheet-Variante aus der Gruppierung des Hooks ab — damit Deeplinks
 *  (?interview=…) dieselbe Einordnung bekommen wie ein Klick in der Liste. */
function variantOf(
  iv: RecruiterInterview,
  agenda: RecruiterInterviewAgenda,
): RecruiterTerminVariant {
  if (agenda.counterProposals.some((x) => x.id === iv.id)) return 'counter';
  if (agenda.debriefDue.some((x) => x.id === iv.id)) return 'debrief';
  if (agenda.awaitingScheduling.some((x) => x.id === iv.id)) return 'awaiting';
  if (agenda.cancelled.some((x) => x.id === iv.id)) return 'cancelled';
  if (agenda.agendaDays.some((d) => d.items.some((x) => x.id === iv.id))) return 'agenda';
  return 'past';
}

function InterviewRow({
  iv,
  variant,
  onOpen,
}: {
  iv: RecruiterInterview;
  variant: RecruiterTerminVariant;
  onOpen: (iv: RecruiterInterview, variant: RecruiterTerminVariant) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(iv, variant)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(iv, variant);
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer hover:border-primary/30 hover:bg-accent/40',
        variant === 'debrief' && 'border-amber-500/30 bg-amber-500/[0.04]',
        variant === 'counter' && 'border-warning/40 bg-warning/[0.04]',
        variant === 'awaiting' && 'border-border/60 bg-muted/20',
        variant === 'cancelled' && 'border-border/60',
        (variant === 'agenda' || variant === 'past') && 'border-border bg-card',
      )}
    >
      {/* Zeit-Block */}
      <div className="w-16 shrink-0 text-center">
        {iv.scheduledAt ? (
          <>
            <div className="text-sm font-semibold tabular-nums">
              {format(new Date(iv.scheduledAt), 'HH:mm')}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {variant === 'agenda'
                ? t('recruiterInterviews.row.duration', { min: iv.durationMinutes })
                : format(new Date(iv.scheduledAt), 'dd.MM.', { locale: de })}
            </div>
          </>
        ) : (
          <Hourglass className="h-4 w-4 mx-auto text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <MeetingIcon type={iv.meetingType} className="h-4 w-4 shrink-0 text-muted-foreground" />

      {/* Kandidat + Job @ Firma */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">{iv.candidateName}</span>
          {variant === 'agenda' && !iv.confirmed && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-amber-500/50 text-amber-600 dark:text-amber-400 shrink-0"
            >
              {t('recruiterInterviews.row.unconfirmed')}
            </Badge>
          )}
          {variant === 'counter' && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-warning/50 text-warning shrink-0"
            >
              {t('recruiterInterviews.row.counter')}
            </Badge>
          )}
          {variant === 'awaiting' && iv.slotsExpired && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-destructive/50 text-destructive shrink-0"
            >
              {t('recruiterInterviews.row.slots_expired')}
            </Badge>
          )}
          {variant === 'cancelled' && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">
              {t(
                iv.status === 'no_show'
                  ? 'recruiterInterviews.row.no_show'
                  : 'recruiterInterviews.row.cancelled',
              )}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <span className="truncate">
            {iv.jobTitle} · {iv.companyLabel}
          </span>
          {!iv.companyRevealed && <Lock className="h-2.5 w-2.5 shrink-0 opacity-60" />}
        </div>
        {(variant === 'awaiting' || variant === 'counter') && (
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {t('recruiterInterviews.row.waiting_since', {
              time: formatDistanceToNow(new Date(iv.createdAt), { locale: de }),
            })}
          </div>
        )}
      </div>

      {/* Fee + Aktionen */}
      <div className="flex items-center gap-1.5 shrink-0">
        {formatFee(iv.potentialFee) && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 tabular-nums hidden sm:inline">
            {formatFee(iv.potentialFee)}
          </span>
        )}
        {/* Anrufen gilt in JEDEM Zustand: vor dem Termin ("kommst du?") ist der
            Griff zum Telefon genauso wichtig wie beim Nachfassen. */}
        {iv.candidatePhone && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label={t('recruiterTermin.action.call')}
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `tel:${iv.candidatePhone}`;
            }}
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        )}
        {variant === 'agenda' && iv.joinUrl && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={(e) => {
              e.stopPropagation();
              window.open(iv.joinUrl!, '_blank', 'noopener');
            }}
          >
            <ExternalLink className="h-3 w-3" />
            {t('recruiterInterviews.row.join')}
          </Button>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </div>
  );
}

export default function RecruiterInterviews() {
  const { t } = useTranslation();
  const { data: agenda, isLoading, refetch } = useRecruiterInterviewAgenda();
  const [pastOpen, setPastOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheet, setSheet] = useState<{
    iv: RecruiterInterview | null;
    variant: RecruiterTerminVariant;
  }>({ iv: null, variant: 'agenda' });

  const openTermin = useCallback(
    (iv: RecruiterInterview, variant: RecruiterTerminVariant) => {
      setSheet({ iv, variant });
    },
    [],
  );

  const closeTermin = useCallback(
    (open: boolean) => {
      if (open) return;
      setSheet((s) => ({ ...s, iv: null }));
      // Deeplink-Parameter entfernen, sonst öffnet sich das Sheet beim
      // nächsten Render sofort wieder.
      if (searchParams.has('interview')) {
        const next = new URLSearchParams(searchParams);
        next.delete('interview');
        setSearchParams(next, { replace: true });
      }
    },
    [searchParams, setSearchParams],
  );

  // Deeplink aus Benachrichtigungen: /recruiter/interviews?interview=<id>
  const deepLinkId = searchParams.get('interview');
  useEffect(() => {
    if (!deepLinkId || !agenda) return;
    if (sheet.iv?.id === deepLinkId) return;
    const target = agenda.all.find((x) => x.id === deepLinkId);
    if (target) setSheet({ iv: target, variant: variantOf(target, agenda) });
  }, [deepLinkId, agenda, sheet.iv?.id]);

  const stats = [
    { label: t('recruiterInterviews.stats.today'), value: agenda?.todayCount ?? 0 },
    { label: t('recruiterInterviews.stats.week'), value: agenda?.weekCount ?? 0 },
    {
      // Ersetzt den alten "Unbestätigt"-Zähler: der zählte nur bereits
      // terminierte Termine und stand deshalb auf 0, während offene Anfragen
      // unbeantwortet lagen.
      label: t('recruiterInterviews.stats.awaiting'),
      value: agenda?.awaitingCount ?? 0,
      warn: (agenda?.awaitingCount ?? 0) > 0,
    },
    {
      label: t('recruiterInterviews.stats.debrief'),
      value: agenda?.debriefDue.length ?? 0,
      warn: (agenda?.debriefDue.length ?? 0) > 0,
    },
  ];

  const nextUp = agenda?.nextUp ?? null;

  const cancelShare = useMemo(() => {
    const total = agenda?.all.length ?? 0;
    const dead = agenda?.cancelled.length ?? 0;
    if (total < 5 || dead === 0) return null;
    return Math.round((dead / total) * 100);
  }, [agenda?.all.length, agenda?.cancelled.length]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock className="h-6 w-6 text-primary" />
            {t('recruiterInterviews.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t('recruiterInterviews.subtitle')}
          </p>
        </div>

        {/* Stat-Reihe */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <Card key={s.label} className="border-border/40">
              <CardContent className="p-3.5">
                <div
                  className={cn(
                    'text-2xl font-bold tabular-nums',
                    s.warn && 'text-amber-600 dark:text-amber-400',
                  )}
                >
                  {isLoading ? <Skeleton className="h-8 w-8" /> : s.value}
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <>
            {/* Next Up */}
            {nextUp && nextUp.scheduledAt && (
              <Card className="border-primary/25 bg-primary/[0.03]">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-primary mb-1">
                        {t('recruiterInterviews.next_up', {
                          time: formatDistanceToNow(new Date(nextUp.scheduledAt), {
                            locale: de,
                            addSuffix: true,
                          }),
                        })}
                      </p>
                      <p className="font-semibold truncate">
                        {format(new Date(nextUp.scheduledAt), 'EEEE, dd.MM. · HH:mm', {
                          locale: de,
                        })}{' '}
                        — {nextUp.candidateName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {nextUp.jobTitle} · {nextUp.companyLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {nextUp.joinUrl && (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open(nextUp.joinUrl!, '_blank', 'noopener')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t('recruiterInterviews.row.join')}
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTermin(nextUp, variantOf(nextUp, agenda!))}
                      >
                        {t('recruiterInterviews.open_submission')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Gegenvorschlag zuerst: jemand wartet auf eine Reaktion */}
            {(agenda?.counterProposals.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-warning flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t('recruiterInterviews.sections.counter', {
                    count: agenda!.counterProposals.length,
                  })}
                </p>
                <div className="space-y-2">
                  {agenda!.counterProposals.map((iv) => (
                    <InterviewRow key={iv.id} iv={iv} variant="counter" onOpen={openTermin} />
                  ))}
                </div>
              </div>
            )}

            {/* Debrief fällig — Handlungsdruck */}
            {(agenda?.debriefDue.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t('recruiterInterviews.sections.debrief', {
                    count: agenda!.debriefDue.length,
                  })}
                </p>
                <div className="space-y-2">
                  {agenda!.debriefDue.map((iv) => (
                    <InterviewRow key={iv.id} iv={iv} variant="debrief" onOpen={openTermin} />
                  ))}
                </div>
              </div>
            )}

            {/* Agenda nach Tagen */}
            {(agenda?.agendaDays.length ?? 0) > 0 ? (
              <div className="space-y-5">
                {agenda!.agendaDays.map((day) => (
                  <div key={day.key} className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {day.label}{' '}
                      <span className="text-muted-foreground/60">({day.items.length})</span>
                    </p>
                    <div className="space-y-2">
                      {day.items.map((iv) => (
                        <InterviewRow key={iv.id} iv={iv} variant="agenda" onOpen={openTermin} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              (agenda?.debriefDue.length ?? 0) === 0 &&
              (agenda?.counterProposals.length ?? 0) === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CalendarClock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {t('recruiterInterviews.empty')}
                    </p>
                  </CardContent>
                </Card>
              )
            )}

            {/* Warten auf Terminierung */}
            {(agenda?.awaitingScheduling.length ?? 0) > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Hourglass className="h-3.5 w-3.5" />
                  {t('recruiterInterviews.sections.awaiting', {
                    count: agenda!.awaitingScheduling.length,
                  })}
                </p>
                <div className="space-y-2">
                  {agenda!.awaitingScheduling.map((iv) => (
                    <InterviewRow key={iv.id} iv={iv} variant="awaiting" onOpen={openTermin} />
                  ))}
                </div>
              </div>
            )}

            {/* Abgesagt / nicht erschienen — eigene Gruppe mit Quote, damit
                sichtbar wird, wo die Termine sterben. */}
            {(agenda?.cancelled.length ?? 0) > 0 && (
              <Collapsible open={cancelledOpen} onOpenChange={setCancelledOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', cancelledOpen && 'rotate-180')}
                    />
                    <CalendarX className="h-3.5 w-3.5" />
                    {t('recruiterInterviews.sections.cancelled', {
                      count: agenda!.cancelled.length,
                    })}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {cancelShare !== null && (
                    <p className="text-xs text-muted-foreground">
                      {t('recruiterInterviews.cancel_hint', { percent: cancelShare })}
                    </p>
                  )}
                  {agenda!.cancelled.slice(0, 20).map((iv) => (
                    <InterviewRow key={iv.id} iv={iv} variant="cancelled" onOpen={openTermin} />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Vergangene */}
            {(agenda?.past.length ?? 0) > 0 && (
              <Collapsible open={pastOpen} onOpenChange={setPastOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', pastOpen && 'rotate-180')}
                    />
                    {t('recruiterInterviews.sections.past', { count: agenda!.past.length })}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {agenda!.past.slice(0, 20).map((iv) => (
                    <div key={iv.id} className="opacity-70">
                      <InterviewRow iv={iv} variant="past" onOpen={openTermin} />
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </>
        )}
      </div>

      <RecruiterTerminSheet
        interview={sheet.iv}
        variant={sheet.variant}
        open={!!sheet.iv}
        onOpenChange={closeTermin}
        onSaved={refetch}
      />
    </DashboardLayout>
  );
}

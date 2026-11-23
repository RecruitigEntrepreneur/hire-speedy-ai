import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { CandidateAvatar, CandidateName } from './CandidateIdentity';
import { meetingTypeLabel, MeetingTypeIcon } from './meetingType';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { fmtRange } from '@/lib/interviewScheduling';
import { cn } from '@/lib/utils';
import {
  ArrowLeftRight, Bell, CalendarCheck, CalendarPlus, Hourglass, Loader2, MoreHorizontal, Star, UserX, Video, XCircle,
} from 'lucide-react';

export type AgendaRowVariant = 'agenda' | 'counter' | 'awaiting' | 'feedback' | 'past';

interface Props {
  iv: AgendaInterview;
  variant: AgendaRowVariant;
  onDetails: (iv: AgendaInterview) => void;
  /** neue Anfrage über das Fenster „Interview anfragen“ (ersetzt die alte bzw. den Termin) */
  onNewRequest?: (iv: AgendaInterview) => void;
  /** angefragte andere Zeit des Kandidaten bestätigen */
  onConfirmAlternative?: (iv: AgendaInterview) => void;
  /** Bestätigung läuft gerade */
  confirming?: boolean;
  onCancel?: (iv: AgendaInterview) => void;
  onNoShow?: (iv: AgendaInterview) => void;
  onRespondCounter?: (iv: AgendaInterview) => void;
  onRemind?: (iv: AgendaInterview) => void;
  onFeedback?: (iv: AgendaInterview) => void;
  onOpenGuide?: (iv: AgendaInterview) => void;
  /** Karte statt Zeile (Apple-Stil, 23.11.2026): Person oder Rolle, Stelle, unten Termin und die eine Handlung. */
  karte?: boolean;
}

// Anzeige immer in deutscher Zeit, egal wo der Browser steht; Format in der Sprache der Oberfläche
const timeShort = (iso: string) =>
  new Date(iso).toLocaleTimeString(intlLocale(i18n.language), { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString(intlLocale(i18n.language), { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' });

const tr = (key: string, options?: Record<string, unknown>) => i18n.t(`clientInterviews:row.${key}`, options) as string;
const waitLabel = (h: number) => (h >= 48 ? tr('waitDays', { count: Math.floor(h / 24) }) : h >= 1 ? tr('waitHours', { count: h }) : tr('justAsked'));
const sinceLabel = (h: number) => (h >= 48 ? tr('sinceDays', { count: Math.floor(h / 24) }) : h >= 24 ? tr('sinceYesterday') : h >= 1 ? tr('sinceHours', { count: h }) : tr('sinceJustNow'));

/** „3 Vorschläge seit 2 Tagen“ */
const awaitingLabel = (iv: AgendaInterview) => {
  const n = iv.proposedSlots.length;
  if (n === 0) return tr('askedSince', { since: sinceLabel(iv.waitingHours) });
  return tr('proposalsSince', { count: n, since: sinceLabel(iv.waitingHours) });
};

/** Beschriftung unter clientInterviews:row.past.<status>. */
const PAST_LABEL: Record<string, { label: string; cls: string }> = {
  completed: { label: 'completed', cls: 'text-emerald-600 border-emerald-500/40' },
  cancelled: { label: 'cancelled', cls: 'text-muted-foreground' },
  declined: { label: 'declined', cls: 'text-muted-foreground' },
  no_show: { label: 'no_show', cls: 'text-destructive border-destructive/40' },
  scheduled: { label: 'completed', cls: 'text-emerald-600 border-emerald-500/40' },
};

/** Eine Interview-Zeile – die Variante bestimmt Zeitblock, Status und Aktionen. */
export function AgendaRow({
  iv, variant, onDetails, onNewRequest, onConfirmAlternative, confirming, onCancel, onNoShow, onRespondCounter, onRemind,
  onFeedback, onOpenGuide, karte = false,
}: Props) {
  const { t } = useTranslation(['clientInterviews', 'interviews']);
  // „Kandidat fragt eine andere Zeit an“: die angefragte Zeit steht in counter_slots[0]
  const requested = variant === 'counter' ? iv.counterSlots[0]?.datetime ?? null : null;
  const requestedOpen = !!requested && new Date(requested).getTime() > Date.now();

  const addToCalendar = () =>
    iv.scheduledAt &&
    downloadIcs(
      `interview-${iv.candidateName.replace(/[^\w]+/g, '-')}`,
      buildIcs({
        title: `Interview · ${iv.candidateName} · ${iv.jobTitle}`,
        location: iv.onsiteAddress || iv.joinUrl || undefined,
        url: iv.joinUrl || undefined,
        start: new Date(iv.scheduledAt),
        durationMinutes: iv.durationMinutes,
      }),
    );

  const leftBlock =
    variant === 'awaiting' ? (
      <div className="flex min-w-[60px] items-center justify-center rounded-lg bg-muted px-2 py-2.5">
        <Hourglass className="h-4 w-4 text-muted-foreground" />
      </div>
    ) : variant === 'counter' ? (
      <div className="flex min-w-[60px] items-center justify-center rounded-lg bg-warning/10 px-2 py-2.5">
        <ArrowLeftRight className="h-4 w-4 text-warning" />
      </div>
    ) : iv.scheduledAt ? (
      <div className={cn('min-w-[60px] rounded-lg px-2 py-1.5 text-center', variant === 'agenda' ? 'bg-muted' : 'bg-muted/50')}>
        <p className="text-[10px] font-medium leading-tight text-muted-foreground">{dateShort(iv.scheduledAt)}</p>
        <p className="text-sm font-bold leading-tight">{timeShort(iv.scheduledAt)}</p>
      </div>
    ) : (
      <div className="min-w-[60px]" />
    );

  const menu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" aria-label={t('row.moreActions')}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => onDetails(iv)}>{t('row.details')}</DropdownMenuItem>
          {iv.identityUnlocked && onOpenGuide && (
            <DropdownMenuItem onClick={() => onOpenGuide(iv)}>{t('row.guide')}</DropdownMenuItem>
          )}
          {iv.scheduledAt && (variant === 'agenda' || variant === 'counter') && (
            <DropdownMenuItem onClick={addToCalendar}>
              <CalendarPlus className="mr-2 h-4 w-4" /> {t('row.toCalendar')}
            </DropdownMenuItem>
          )}
          {variant === 'counter' && onRespondCounter && (
            <DropdownMenuItem onClick={() => onRespondCounter(iv)}>{t('row.viewRequest')}</DropdownMenuItem>
          )}
          {onNewRequest && (variant === 'agenda' || variant === 'awaiting') && (
            <DropdownMenuItem onClick={() => onNewRequest(iv)}>
              {variant === 'awaiting' ? t('row.newSlots') : t('row.rebook')}
            </DropdownMenuItem>
          )}
          {variant === 'feedback' && onNoShow && (
            <DropdownMenuItem onClick={() => onNoShow(iv)}>
              <UserX className="mr-2 h-4 w-4" /> {t('row.reportNoShow')}
            </DropdownMenuItem>
          )}
          {onCancel && variant !== 'past' && variant !== 'feedback' && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onCancel(iv)}>
                <XCircle className="mr-2 h-4 w-4" /> {variant === 'agenda' ? t('row.cancel') : t('row.withdraw')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
  );

  if (karte) {
    // Ohne freigegebenen Namen ist die Rolle die Hauptzeile, die Kennung steht leise dahinter.
    const ohneName = !iv.identityUnlocked && !!iv.candidateRole;
    const wann = iv.scheduledAt ? `${dateShort(iv.scheduledAt)}, ${timeShort(iv.scheduledAt)}` : null;
    const art = meetingTypeLabel(iv.meetingType);
    const meta =
      variant === 'counter' ? [requested ? t('row.asksFor', { time: fmtRange(requested, iv.durationMinutes) }) : t('row.asksOther'), waitLabel(iv.waitingHours)].join(' · ')
        : variant === 'awaiting' ? [art, iv.slotsExpired ? t('row.slotsExpired') : awaitingLabel(iv)].join(' · ')
          : variant === 'past' ? [wann, PAST_LABEL[iv.status] ? t(`row.past.${PAST_LABEL[iv.status].label}`) : iv.status].filter(Boolean).join(' · ')
            : [wann, art, variant === 'agenda' && !iv.confirmed ? t('row.unconfirmed') : null, iv.rescheduleRequested ? t('row.rescheduleRequested') : null].filter(Boolean).join(' · ');
    const blau = 'whitespace-nowrap text-xs font-medium text-klick hover:underline disabled:opacity-50';
    const grau = 'whitespace-nowrap text-xs text-muted-foreground hover:text-foreground';
    return (
      <div className="flex flex-col rounded-xl border bg-card p-4">
        <div className="flex items-start gap-2">
          <button type="button" onClick={() => onDetails(iv)} className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-medium">{ohneName ? iv.candidateRole : iv.candidateName}</p>
            <p className="truncate text-xs text-muted-foreground">{[iv.jobTitle, ohneName ? iv.candidateName : null].filter(Boolean).join(' · ')}</p>
          </button>
          {menu}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span>
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {variant === 'agenda' && iv.joinUrl && <a href={iv.joinUrl} target="_blank" rel="noreferrer" className={blau}>{t('row.join')} ›</a>}
            {variant === 'counter' && requestedOpen && onConfirmAlternative && (
              <button type="button" className={blau} disabled={confirming} onClick={() => onConfirmAlternative(iv)}>{t('row.confirmTime')} ›</button>
            )}
            {variant === 'counter' && !requestedOpen && !onNewRequest && onRespondCounter && (
              <button type="button" className={blau} onClick={() => onRespondCounter(iv)}>{t('row.respond')} ›</button>
            )}
            {variant === 'counter' && onNewRequest && (
              <button type="button" className={requestedOpen ? grau : blau} disabled={confirming} onClick={() => onNewRequest(iv)}>{t('row.newSlots')}{requestedOpen ? '' : ' ›'}</button>
            )}
            {variant === 'awaiting' && onRemind && <button type="button" className={grau} onClick={() => onRemind(iv)}>{t('row.remind')}</button>}
            {variant === 'awaiting' && iv.slotsExpired && onNewRequest && (
              <button type="button" className={blau} onClick={() => onNewRequest(iv)}>{t('row.newSlots')} ›</button>
            )}
            {variant === 'feedback' && onFeedback && <button type="button" className={blau} onClick={() => onFeedback(iv)}>{t('row.giveFeedback')} ›</button>}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        // Am Handy bricht die Zeile um (16.11.2026): Termin, Bild, Name oben, Stand und Knöpfe darunter
        'group flex flex-wrap items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-accent/40 sm:flex-nowrap',
      )}
    >
      {leftBlock}
      <CandidateAvatar iv={iv} />

      {variant === 'counter' ? (
        <button onClick={() => onDetails(iv)} className="min-w-0 flex-1 text-left">
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm">
            <CandidateName iv={iv} />
            {requested ? (
              <span className={cn('truncate', !requestedOpen && 'text-muted-foreground line-through')}>
                {t('row.asksFor', { time: fmtRange(requested, iv.durationMinutes) })}
              </span>
            ) : (
              <span className="truncate">{t('row.asksOther')}</span>
            )}
          </span>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {iv.candidateMessage ? `„${iv.candidateMessage}“ · ` : ''}
            {iv.jobTitle}
            {requested && !requestedOpen ? t('row.requestedPassed') : ''}
          </p>
        </button>
      ) : (
        <button onClick={() => onDetails(iv)} className="min-w-0 flex-1 text-left">
          <CandidateName iv={iv} />
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <MeetingTypeIcon type={iv.meetingType} className="h-3 w-3 shrink-0" />
            {/* eigener Text-Span, sonst endet der abgeschnittene Titel ohne „…“ */}
            <span className="truncate">
              {meetingTypeLabel(iv.meetingType)}
              {iv.onsiteAddress ? `, ${iv.onsiteAddress}` : ''} · {iv.jobTitle}
            </span>
          </p>
          {/* Handy: der Stand als Zeile unter dem Namen, damit die Knöpfe in eine Reihe passen */}
          {variant === 'awaiting' && (
            <p className={cn('mt-0.5 truncate text-xs sm:hidden', iv.slotsExpired ? 'font-medium text-foreground' : 'text-muted-foreground')}>
              {iv.slotsExpired ? t('row.slotsExpired') : awaitingLabel(iv)}
            </p>
          )}
        </button>
      )}

      {/* Am Handy: Umbruch, dann Platzhalter, damit Stand und Knöpfe rechtsbündig in der zweiten Zeile stehen */}
      {variant !== 'counter' && <span className="h-0 basis-full sm:hidden" aria-hidden />}
      {variant !== 'counter' && <span className="flex-1 sm:hidden" aria-hidden />}

      {/* Status/Zusatz je Variante */}
      {variant === 'agenda' && !iv.confirmed && (
        <Badge variant="outline" className="shrink-0 text-xs text-amber-600">{t('row.unconfirmed')}</Badge>
      )}
      {iv.rescheduleRequested && (
        <Badge variant="outline" className="shrink-0 text-xs">{t('row.rescheduleRequested')}</Badge>
      )}
      {variant === 'counter' && iv.reschedulesInterviewId && (
        <Badge variant="outline" className="shrink-0 text-xs">{t('row.reschedule')}</Badge>
      )}
      {variant === 'counter' && (
        <span className="hidden shrink-0 text-xs text-muted-foreground lg:inline">{waitLabel(iv.waitingHours)}</span>
      )}
      {variant === 'awaiting' && (
        <span className={cn('shrink-0 text-xs max-sm:hidden', iv.slotsExpired ? 'font-medium text-foreground' : 'text-muted-foreground')}>
          {iv.slotsExpired ? t('row.slotsExpired') : awaitingLabel(iv)}
        </span>
      )}
      {variant === 'past' && (
        <Badge variant="outline" className={cn('shrink-0 text-xs', (PAST_LABEL[iv.status] || PAST_LABEL.cancelled).cls)}>
          {PAST_LABEL[iv.status] ? t(`row.past.${PAST_LABEL[iv.status].label}`) : iv.status}
        </Badge>
      )}

      {/* Primäraktion je Variante */}
      {variant === 'agenda' && iv.joinUrl && (
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs">
          <a href={iv.joinUrl} target="_blank" rel="noreferrer">
            <Video className="h-3.5 w-3.5" /> {t('row.join')}
          </a>
        </Button>
      )}
      {variant === 'counter' && (
        <div className="flex w-full shrink-0 justify-end gap-1.5 sm:w-auto">
          {requestedOpen && onConfirmAlternative ? (
            <Button size="sm" className="h-7 gap-1 text-xs" disabled={confirming} onClick={() => onConfirmAlternative(iv)}>
              {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}
              {t('row.confirmTime')}
            </Button>
          ) : (
            !onNewRequest &&
            onRespondCounter && (
              <Button size="sm" className="h-7 text-xs" onClick={() => onRespondCounter(iv)}>
                {t('row.respond')}
              </Button>
            )
          )}
          {onNewRequest && (
            <Button
              size="sm"
              variant={requestedOpen ? 'outline' : 'default'}
              className="h-7 text-xs"
              disabled={confirming}
              onClick={() => onNewRequest(iv)}
            >
              {t('row.newSlots')}
            </Button>
          )}
        </div>
      )}
      {variant === 'awaiting' && iv.slotsExpired && onNewRequest && (
        <Button size="sm" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onNewRequest(iv)}>
          <CalendarPlus className="h-3.5 w-3.5" /> {t('row.newSlots')}
        </Button>
      )}
      {variant === 'awaiting' && onRemind && (
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => onRemind(iv)}>
          <Bell className="h-3.5 w-3.5" /> {t('row.remind')}
        </Button>
      )}
      {variant === 'feedback' && onFeedback && (
        <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 border-amber-500/40 text-xs text-amber-600" onClick={() => onFeedback(iv)}>
          <Star className="h-3.5 w-3.5" /> {t('row.giveFeedback')}
        </Button>
      )}

      {/* Sekundäraktionen */}
      {menu}
    </div>
  );
}

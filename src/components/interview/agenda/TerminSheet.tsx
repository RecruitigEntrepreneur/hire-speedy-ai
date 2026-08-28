import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  ClockAlert,
  Lock,
  MapPin,
  MessageSquareQuote,
  NotebookPen,
  Pencil,
  Phone,
  User,
  Video,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AgendaInterview } from '@/hooks/useClientInterviewAgenda';
import { cn } from '@/lib/utils';

export type TerminVariant = 'counter' | 'awaiting' | 'agenda' | 'feedback' | 'past';

const PILL_CLASSES: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

const fmtSlot = (iso: string) =>
  `${new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}, ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;

const fmtTag = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function waitingLabel(hours: number): string {
  const days = Math.floor(hours / 24);
  return days >= 1 ? `${days} ${days === 1 ? 'Tag' : 'Tagen'}` : `${Math.max(1, hours)} Std.`;
}

// Termin-Panel: alles zum Termin an Ort und Stelle — die Agenda bleibt sichtbar,
// Entscheidungen über den MENSCHEN fallen weiter im Bewerberprofil (Ausstieg unten).
// Alle Aktionen laufen über die bestehenden, sicheren Handler der Seite.
export function TerminSheet({
  interview,
  variant,
  open,
  onOpenChange,
  onEdit,
  onRemind,
  onCancel,
  onRespondCounter,
  onFeedback,
}: {
  interview: AgendaInterview | null;
  variant: TerminVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (iv: AgendaInterview) => void;
  onRemind: (iv: AgendaInterview) => void;
  onCancel: (iv: AgendaInterview) => void;
  onRespondCounter: (iv: AgendaInterview) => void;
  onFeedback: (iv: AgendaInterview) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (!interview) return null;
  const iv = interview;

  const terminalKey =
    iv.status === 'declined'
      ? 'declined'
      : iv.status === 'cancelled'
        ? 'cancelled'
        : iv.status === 'no_show'
          ? 'no_show'
          : 'completed';

  const pill: { key: string; tone: string } =
    variant === 'counter'
      ? { key: 'counter', tone: 'warn' }
      : variant === 'awaiting'
        ? iv.slotsExpired
          ? { key: 'expired', tone: 'crit' }
          : { key: 'awaiting', tone: 'neutral' }
        : variant === 'agenda'
          ? iv.confirmed
            ? { key: 'scheduled', tone: 'ok' }
            : { key: 'requested', tone: 'neutral' }
          : variant === 'feedback'
            ? { key: 'feedback', tone: 'crit' }
            : { key: terminalKey, tone: 'neutral' };

  const ctx =
    variant === 'counter'
      ? t('terminsheet.ctx_counter')
      : variant === 'awaiting'
        ? t(iv.slotsExpired ? 'terminsheet.ctx_awaiting_expired' : 'terminsheet.ctx_awaiting', {
            time: waitingLabel(iv.waitingHours),
          })
        : variant === 'agenda'
          ? t(iv.confirmed ? 'terminsheet.ctx_scheduled' : 'terminsheet.ctx_requested')
          : variant === 'feedback'
            ? t('terminsheet.ctx_feedback', { date: iv.scheduledAt ? fmtTag(iv.scheduledAt) : '—' })
            : t(`terminsheet.ctx_${terminalKey}`);

  const meetingLabel =
    iv.meetingType === 'phone'
      ? t('terminsheet.meeting_phone')
      : iv.meetingType === 'onsite'
        ? t('terminsheet.meeting_onsite')
        : t('terminsheet.meeting_video');
  const MeetingIcon = iv.meetingType === 'phone' ? Phone : iv.meetingType === 'onsite' ? MapPin : Video;

  const goProfile = () => {
    onOpenChange(false);
    navigate(`/dashboard/candidates/${iv.submissionId}`);
  };

  const act = (fn: (iv: AgendaInterview) => void) => () => {
    onOpenChange(false);
    fn(iv);
  };

  const showSlots = (variant === 'awaiting' || variant === 'counter') && iv.proposedSlots.length > 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-0 text-left">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              {iv.identityUnlocked ? <User className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className={cn('truncate text-sm', !iv.identityUnlocked && 'font-mono')}>
                {iv.candidateName}
              </SheetTitle>
              <p className="truncate text-xs text-muted-foreground">{iv.jobTitle}</p>
            </div>
            <span
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                PILL_CLASSES[pill.tone]
              )}
            >
              {t(`terminsheet.pill.${pill.key}`)}
            </span>
          </div>
        </SheetHeader>

        <p className="mt-3 text-sm text-muted-foreground">{ctx}</p>

        {/* Termin-Fakten */}
        <div className="mt-4 space-y-3">
          {(variant === 'agenda' || variant === 'feedback' || variant === 'past') && iv.scheduledAt && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                {fmtSlot(iv.scheduledAt)}
                <span className="font-normal text-muted-foreground">
                  · {t('terminsheet.duration', { min: iv.durationMinutes })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <MeetingIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">
                  {meetingLabel}
                  {iv.meetingType === 'onsite' && iv.onsiteAddress ? ` · ${iv.onsiteAddress}` : ''}
                </span>
                {variant === 'agenda' && iv.joinUrl && (
                  <a
                    href={iv.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    {t('terminsheet.join')}
                  </a>
                )}
              </div>
            </div>
          )}

          {showSlots && (
            <div className="rounded-lg border p-3">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {t('terminsheet.slots_title')}
              </p>
              {iv.proposedSlots.map((s) => {
                const past = new Date(s.datetime).getTime() < Date.now();
                return (
                  <div key={s.datetime} className="flex items-center gap-2 py-1 text-sm">
                    <ClockAlert
                      className={cn('h-4 w-4 shrink-0', past ? 'text-muted-foreground/50' : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
                    <span className={cn('flex-1', past && 'text-muted-foreground/60 line-through')}>
                      {fmtSlot(s.datetime)}
                    </span>
                    {past && (
                      <span className="text-[11px] text-muted-foreground/60">
                        {t('terminsheet.expired_tag')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {variant === 'counter' && iv.counterSlots.length > 0 && (
            <div className="rounded-lg border border-warning/40 p-3">
              <p className="mb-1.5 text-xs font-semibold text-warning">
                {t('terminsheet.counter_title')}
              </p>
              {iv.counterSlots.map((s) => (
                <div key={s.datetime} className="flex items-center gap-2 py-1 text-sm font-medium">
                  <CalendarPlus className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  {fmtSlot(s.datetime)}
                </div>
              ))}
            </div>
          )}

          {iv.candidateMessage && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
                {t('terminsheet.msg')}
              </p>
              <p className="text-sm italic">„{iv.candidateMessage}“</p>
            </div>
          )}

          {iv.notes && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                {t('terminsheet.notes')}
              </p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{iv.notes}</p>
            </div>
          )}

          {variant === 'past' && iv.feedback && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t('terminsheet.feedback_title')}
              </p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{iv.feedback}</p>
            </div>
          )}
        </div>

        {/* EINE Primäraktion pro Zustand + Sekundäres */}
        <div className="mt-5 flex flex-col gap-2">
          {variant === 'awaiting' && (
            <>
              <Button className="w-full gap-1.5" onClick={act(onEdit)}>
                <CalendarPlus className="h-4 w-4" />
                {t('terminsheet.actions.new_slots')}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => onRemind(iv)}>
                  <Bell className="h-3.5 w-3.5" />
                  {t('terminsheet.actions.remind')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={act(onCancel)}
                >
                  <XCircle className="h-3.5 w-3.5" />
                  {t('terminsheet.actions.withdraw')}
                </Button>
              </div>
            </>
          )}

          {variant === 'counter' && (
            <>
              <Button className="w-full gap-1.5" onClick={act(onRespondCounter)}>
                <CalendarCheck className="h-4 w-4" />
                {t('terminsheet.actions.respond')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={act(onCancel)}
              >
                <XCircle className="h-3.5 w-3.5" />
                {t('terminsheet.actions.withdraw')}
              </Button>
            </>
          )}

          {variant === 'agenda' && (
            <>
              {iv.joinUrl ? (
                <Button asChild className="w-full gap-1.5">
                  <a href={iv.joinUrl} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4" />
                    {t('terminsheet.join')}
                  </a>
                </Button>
              ) : (
                <Button className="w-full gap-1.5" onClick={act(onEdit)}>
                  <Pencil className="h-4 w-4" />
                  {t('terminsheet.actions.edit')}
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={act(onEdit)}>
                  <Pencil className="h-3.5 w-3.5" />
                  {t('terminsheet.actions.reschedule')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 text-destructive hover:text-destructive"
                  onClick={act(onCancel)}
                >
                  <CalendarX className="h-3.5 w-3.5" />
                  {t('terminsheet.actions.cancel')}
                </Button>
              </div>
            </>
          )}

          {variant === 'feedback' && (
            <Button className="w-full gap-1.5" onClick={act(onFeedback)}>
              <NotebookPen className="h-4 w-4" />
              {t('terminsheet.actions.feedback')}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={goProfile}>
            {t('terminsheet.actions.profile')}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

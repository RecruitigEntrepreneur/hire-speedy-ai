import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  CalendarX,
  ClockAlert,
  ExternalLink,
  FileText,
  Lock,
  Mail,
  MapPin,
  MessageSquareQuote,
  NotebookPen,
  Phone,
  Send,
  User,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { useInterviewFeedback, type FeedbackData } from '@/hooks/useInterviewFeedback';
import type { RecruiterInterview } from '@/hooks/useRecruiterInterviewAgenda';
import { cn } from '@/lib/utils';

export type RecruiterTerminVariant =
  | 'agenda'
  | 'debrief'
  | 'awaiting'
  | 'counter'
  | 'cancelled'
  | 'past';

const PILL_CLASSES: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  warn: 'bg-warning/10 text-warning',
  crit: 'bg-destructive/10 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
};

const RECOMMENDATIONS: { key: NonNullable<FeedbackData['recommendation']>; tone: string }[] = [
  { key: 'next_round', tone: 'default' },
  { key: 'hire', tone: 'default' },
  { key: 'undecided', tone: 'outline' },
  { key: 'reject', tone: 'outline' },
];

const fmtSlot = (iso: string) =>
  `${new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}, ${new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;

const fmtTag = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

function waitingLabel(hours: number): string {
  const days = Math.floor(hours / 24);
  return days >= 1 ? `${days} ${days === 1 ? 'Tag' : 'Tagen'}` : `${Math.max(1, hours)} Std.`;
}

/**
 * Termin-Panel aus RECRUITER-Sicht. Spiegelbild des Client-TerminSheet, mit drei
 * bewusst anderen Regeln:
 *
 *  1. Der Kandidat ist immer im Klartext — der Recruiter hat ihn eingereicht.
 *     Maskiert wird hier die FIRMA (companyRevealed), nicht die Person.
 *  2. Es gibt KEINE schreibende Termin-Aktion. RLS auf public.interviews erlaubt
 *     Schreiben nur dem Kunden (j.client_id = auth.uid()); Terminvorschläge
 *     laufen ausschliesslich über send-interview-invitation, das canUserActOnJob
 *     prüft. Ein "Neue Termine vorschlagen"-Knopf wäre eine garantierte 403.
 *     Der Hebel des Recruiters ist der Kandidat: anrufen, mailen.
 *  3. Das Debrief geht nach interview_feedback (evaluator_id = auth.uid()), NICHT
 *     nach interviews.feedback — letzteres gehört dem Kunden.
 */
export function RecruiterTerminSheet({
  interview,
  variant,
  open,
  onOpenChange,
  onSaved,
}: {
  interview: RecruiterInterview | null;
  variant: RecruiterTerminVariant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { myFeedback, submitFeedback } = useInterviewFeedback(interview?.id);
  const [note, setNote] = useState('');
  const [recommendation, setRecommendation] =
    useState<FeedbackData['recommendation']>(undefined);

  // Beim Wechsel des Termins den Entwurf auf das gespeicherte Feedback zurücksetzen,
  // damit nicht der Text des vorigen Termins im Feld stehen bleibt.
  useEffect(() => {
    setNote(myFeedback?.notes ?? '');
    setRecommendation(myFeedback?.recommendation ?? undefined);
  }, [interview?.id, myFeedback?.notes, myFeedback?.recommendation]);

  if (!interview) return null;
  const iv = interview;

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
            : { key: 'unconfirmed', tone: 'warn' }
          : variant === 'debrief'
            ? { key: 'debrief', tone: 'crit' }
            : variant === 'cancelled'
              ? { key: iv.status === 'no_show' ? 'no_show' : 'cancelled', tone: 'neutral' }
              : { key: 'done', tone: 'neutral' };

  const ctx =
    variant === 'counter'
      ? t('recruiterTermin.ctx.counter')
      : variant === 'awaiting'
        ? t(iv.slotsExpired ? 'recruiterTermin.ctx.expired' : 'recruiterTermin.ctx.awaiting', {
            time: waitingLabel(iv.waitingHours),
          })
        : variant === 'agenda'
          ? t(iv.confirmed ? 'recruiterTermin.ctx.scheduled' : 'recruiterTermin.ctx.unconfirmed')
          : variant === 'debrief'
            ? t('recruiterTermin.ctx.debrief', {
                date: iv.scheduledAt ? fmtTag(iv.scheduledAt) : '—',
              })
            : variant === 'cancelled'
              ? t(
                  iv.status === 'no_show'
                    ? 'recruiterTermin.ctx.no_show'
                    : 'recruiterTermin.ctx.cancelled',
                )
              : t('recruiterTermin.ctx.done');

  const meetingLabel =
    iv.meetingType === 'phone'
      ? t('recruiterTermin.meeting.phone')
      : iv.meetingType === 'onsite'
        ? t('recruiterTermin.meeting.onsite')
        : t('recruiterTermin.meeting.video');
  const MeetingIcon =
    iv.meetingType === 'phone' ? Phone : iv.meetingType === 'onsite' ? MapPin : Video;

  const close = () => onOpenChange(false);
  const goSubmission = () => {
    close();
    navigate(`/recruiter/submissions/${iv.submissionId}?interview=${iv.id}`);
  };
  const goCandidate = () => {
    if (!iv.candidateId) return;
    close();
    navigate(`/recruiter/candidates/${iv.candidateId}`);
  };

  const showProposed =
    (variant === 'awaiting' || variant === 'counter') && iv.proposedSlots.length > 0;
  const showTermin =
    (variant === 'agenda' || variant === 'debrief' || variant === 'past' || variant === 'cancelled') &&
    !!iv.scheduledAt;
  const canSaveDebrief = note.trim().length > 0 || !!recommendation;

  const saveDebrief = () => {
    submitFeedback.mutate(
      { interviewId: iv.id, feedback: { notes: note.trim() || undefined, recommendation } },
      { onSuccess: () => onSaved?.() },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-0 text-left">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-hidden="true"
            >
              <User className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-sm">{iv.candidateName}</SheetTitle>
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <span className="truncate">
                  {iv.jobTitle} · {iv.companyLabel}
                </span>
                {!iv.companyRevealed && <Lock className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />}
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                PILL_CLASSES[pill.tone],
              )}
            >
              {t(`recruiterTermin.pill.${pill.key}`)}
            </span>
          </div>
        </SheetHeader>

        <p className="mt-3 text-sm text-muted-foreground">{ctx}</p>

        <div className="mt-4 space-y-3">
          {showTermin && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarCheck
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                {fmtSlot(iv.scheduledAt!)}
                <span className="font-normal text-muted-foreground">
                  · {t('recruiterTermin.duration', { min: iv.durationMinutes })}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <MeetingIcon
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">{meetingLabel}</span>
              </div>
              {iv.meetingType === 'onsite' && (
                <p
                  className={cn(
                    'mt-1.5 pl-6 text-xs',
                    iv.onsiteAddress ? 'text-muted-foreground' : 'text-destructive',
                  )}
                >
                  {iv.onsiteAddress || t('recruiterTermin.no_address')}
                </p>
              )}
            </div>
          )}

          {showProposed && (
            <div className="rounded-lg border p-3">
              <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
                {t('recruiterTermin.slots_title')}
              </p>
              {iv.proposedSlots.map((s) => {
                const over = new Date(s.datetime).getTime() < Date.now();
                return (
                  <div key={s.datetime} className="flex items-center gap-2 py-1 text-sm">
                    <ClockAlert
                      className={cn(
                        'h-4 w-4 shrink-0',
                        over ? 'text-muted-foreground/50' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span className={cn('flex-1', over && 'text-muted-foreground/60 line-through')}>
                      {fmtSlot(s.datetime)}
                    </span>
                    {over && (
                      <span className="text-[11px] text-muted-foreground/60">
                        {t('recruiterTermin.expired_tag')}
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
                {t('recruiterTermin.counter_title')}
              </p>
              {iv.counterSlots.map((s) => (
                <div key={s.datetime} className="py-1 text-sm font-medium">
                  {fmtSlot(s.datetime)}
                </div>
              ))}
            </div>
          )}

          {variant === 'cancelled' && (iv.cancellationReason || iv.noShowBy) && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
                {t('recruiterTermin.cancel_title')}
              </p>
              <p className="text-sm text-muted-foreground">
                {iv.cancellationReason ||
                  t(`recruiterTermin.no_show_by.${iv.noShowBy || 'unknown'}`)}
              </p>
            </div>
          )}

          {iv.candidateMessage && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" />
                {t('recruiterTermin.msg')}
              </p>
              <p className="text-sm italic">„{iv.candidateMessage}“</p>
            </div>
          )}

          {iv.notes && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <NotebookPen className="h-3.5 w-3.5" aria-hidden="true" />
                {t('recruiterTermin.notes')}
              </p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{iv.notes}</p>
            </div>
          )}

          {iv.feedback && variant !== 'debrief' && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-1 text-xs font-semibold text-muted-foreground">
                {t('recruiterTermin.client_feedback')}
              </p>
              <p className="whitespace-pre-line text-sm text-muted-foreground">{iv.feedback}</p>
            </div>
          )}

          {/* Debrief: der Recruiter-Eindruck. Landet in interview_feedback unter
              seiner evaluator_id — interviews.feedback gehört dem Kunden. */}
          {(variant === 'debrief' || variant === 'past') && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">
                {t('recruiterTermin.debrief_title')}
              </p>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('recruiterTermin.debrief_placeholder')}
                rows={3}
                className="text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RECOMMENDATIONS.map((r) => (
                  <Button
                    key={r.key}
                    type="button"
                    size="sm"
                    variant={recommendation === r.key ? 'default' : 'outline'}
                    className="h-7 text-xs"
                    onClick={() => setRecommendation(recommendation === r.key ? undefined : r.key)}
                  >
                    {t(`recruiterTermin.recommendation.${r.key}`)}
                  </Button>
                ))}
              </div>
              <Button
                size="sm"
                className="mt-2 w-full gap-1.5"
                disabled={!canSaveDebrief || submitFeedback.isPending}
                onClick={saveDebrief}
              >
                <Send className="h-3.5 w-3.5" />
                {myFeedback
                  ? t('recruiterTermin.debrief_update')
                  : t('recruiterTermin.debrief_save')}
              </Button>
            </div>
          )}

          {iv.potentialFee !== null && (
            <p className="text-xs text-muted-foreground">
              {t('recruiterTermin.fee', { amount: Math.round(iv.potentialFee / 1000) })}
            </p>
          )}
        </div>

        {/* Eine Primäraktion pro Zustand. Alles hier ist eine Aktion, die dem
            Recruiter tatsächlich offensteht — kein Schreibzugriff auf interviews. */}
        <div className="mt-5 flex flex-col gap-2">
          {variant === 'agenda' && iv.joinUrl && (
            <Button asChild className="w-full gap-1.5">
              <a href={iv.joinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t('recruiterTermin.action.join')}
              </a>
            </Button>
          )}

          {((variant === 'agenda' && !iv.joinUrl) ||
            variant === 'awaiting' ||
            variant === 'counter') &&
            (iv.candidatePhone ? (
              <Button asChild className="w-full gap-1.5">
                <a href={`tel:${iv.candidatePhone}`}>
                  <Phone className="h-4 w-4" />
                  {t('recruiterTermin.action.call')}
                </a>
              </Button>
            ) : iv.candidateEmail ? (
              <Button asChild className="w-full gap-1.5">
                <a href={`mailto:${iv.candidateEmail}`}>
                  <Mail className="h-4 w-4" />
                  {t('recruiterTermin.action.mail')}
                </a>
              </Button>
            ) : null)}

          <div className="flex gap-2">
            {iv.candidatePhone && variant !== 'awaiting' && variant !== 'counter' && (
              <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                <a href={`tel:${iv.candidatePhone}`}>
                  <Phone className="h-3.5 w-3.5" />
                  {t('recruiterTermin.action.call_short')}
                </a>
              </Button>
            )}
            {iv.candidateEmail && (
              <Button asChild variant="outline" size="sm" className="flex-1 gap-1.5">
                <a href={`mailto:${iv.candidateEmail}`}>
                  <Mail className="h-3.5 w-3.5" />
                  {t('recruiterTermin.action.mail_short')}
                </a>
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={goSubmission}>
              <FileText className="h-3.5 w-3.5" />
              {t('recruiterTermin.action.submission')}
            </Button>
            {iv.candidateId && (
              <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={goCandidate}>
                <User className="h-3.5 w-3.5" />
                {t('recruiterTermin.action.candidate')}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

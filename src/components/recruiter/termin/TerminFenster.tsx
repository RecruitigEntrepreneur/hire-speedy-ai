import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { intlLocale } from '@/i18n/languages';
import { meetingTypeLabel } from '@/components/interview/agenda/meetingType';
import type { RecruiterInterview } from '@/hooks/useRecruiterInterviewAgenda';
import type { RecruiterTerminVariant } from '@/components/interview/agenda/RecruiterTerminSheet';
import { PIPELINE_LABELS, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { Honorar } from '@/components/recruiter/Honorar';
import { buildIcs, downloadIcs } from '@/lib/ics';
import { cn } from '@/lib/utils';

const NS = ['recruiterInterviews', 'translation', 'interviews', 'recruiterSubmissions'];
const STUFEN: PipelineStageKey[] = ['submitted', 'in_review', 'interview_1', 'interview_2', 'offer', 'placed'];

/** „[Medizintechnik] Unternehmen“ → „Medizintechnik“: ohne offengelegte Firma nur die Branche, ohne Klammern. */
export const firmaOderBranche = (iv: Pick<RecruiterInterview, 'companyLabel' | 'companyRevealed'>): string | null => {
  if (iv.companyRevealed) return iv.companyLabel || null;
  const branche = /^\[(.+?)\]/.exec(iv.companyLabel ?? '')?.[1];
  return branche ?? null;
};

export interface TerminAufgabe { id: string; label: string }

interface Props {
  interview: RecruiterInterview | null;
  variant: RecruiterTerminVariant;
  /** Stufe der Vorstellung in der Pipeline; null, wenn der Prozess beendet ist. */
  stage: PipelineStageKey | null;
  /** Offene Aufgaben zu dieser Vorstellung; abgearbeitet wird unter „Aufgaben“. */
  aufgaben: TerminAufgabe[];
  onClose: () => void;
}

/**
 * Termin-Fenster des Headhunters (24.11.2026, Marko): nur ansehen. Oben wer und bei wem, der Stand
 * des Prozesses, ein Hinweis auf offene Aufgaben mit Link dorthin, dann das Interview, der Verlauf
 * und die Notizen. Dieselben Daten wie die Seite der Vorstellung (/recruiter/submissions/:id).
 */
export function TerminFenster({ interview: iv, variant, stage, aufgaben, onClose }: Props) {
  const { t, i18n } = useTranslation(NS);
  const lang = intlLocale(i18n.language);
  const submissionId = iv?.submissionId ?? null;

  const { data: mehr } = useQuery({
    queryKey: ['termin-fenster', submissionId],
    enabled: !!submissionId,
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: sub }, { data: log }] = await Promise.all([
        supabase.from('submissions').select('recruiter_notes, submitted_at').eq('id', submissionId!).maybeSingle(),
        supabase.from('candidate_activity_log').select('id, title, created_at').eq('related_submission_id', submissionId!).order('created_at', { ascending: false }).limit(6),
      ]);
      return { notes: sub?.recruiter_notes ?? null, submittedAt: sub?.submitted_at ?? null, log: log ?? [] };
    },
  });

  if (!iv) return null;

  const tag = (iso: string) => new Date(iso).toLocaleDateString(lang, { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit' });
  const lang_tag = (iso: string) => new Date(iso).toLocaleDateString(lang, { timeZone: 'Europe/Berlin', weekday: 'long', day: 'numeric', month: 'long' });
  const zeit = (iso: string) => new Date(iso).toLocaleTimeString(lang, { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
  const kurz = (iso: string) => `${new Date(iso).toLocaleDateString(lang, { timeZone: 'Europe/Berlin', weekday: 'short', day: '2-digit', month: '2-digit' })}, ${zeit(iso)}`;

  const firma = firmaOderBranche(iv);
  const beendet = variant === 'cancelled';
  const stufe = beendet ? -1 : stage ? STUFEN.indexOf(stage) : STUFEN.indexOf(iv.round >= 2 ? 'interview_2' : 'interview_1');
  const kommt = !!iv.scheduledAt && new Date(iv.scheduledAt).getTime() > Date.now();
  const stand =
    variant === 'cancelled' ? t(iv.status === 'no_show' ? 'recruiterInterviews.row.no_show' : 'recruiterInterviews.row.cancelled')
      : variant === 'awaiting' ? t('recruiterInterviews.window.noDate')
        : variant === 'counter' ? t('recruiterInterviews.row.counter')
          : variant === 'agenda' ? (iv.confirmed ? t('recruiterInterviews.window.confirmed') : t('recruiterInterviews.row.unconfirmed'))
            : t('recruiterInterviews.window.held');
  const zeile = 'flex items-baseline justify-between gap-3 py-1 text-sm';
  const kopf = 'mb-1 text-xs font-medium text-muted-foreground';
  const link = 'text-sm text-klick hover:underline';

  const insKalender = () => iv.scheduledAt && downloadIcs(
    `interview-${iv.candidateName.replace(/[^\w]+/g, '-')}`,
    buildIcs({
      title: `Interview · ${iv.candidateName} · ${iv.jobTitle}`,
      location: iv.onsiteAddress || iv.joinUrl || undefined,
      url: iv.joinUrl || undefined,
      start: new Date(iv.scheduledAt),
      durationMinutes: iv.durationMinutes,
    }),
  );

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 p-5 pb-0 text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">{iv.candidateName}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {iv.jobTitle}{firma && <> · <span className={cn(iv.companyRevealed && 'text-foreground')}>{firma}</span></>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-5">
          {/* Stand des Prozesses: dieselben sechs Stufen wie in der Pipeline */}
          <div>
            <div className="grid grid-cols-6 gap-1" aria-hidden="true">
              {STUFEN.map((k, i) => (
                <span key={k} className={cn('h-1 rounded-full', i < stufe ? 'bg-foreground' : i === stufe ? 'bg-klick' : 'bg-border')} />
              ))}
            </div>
            <div className="mt-1.5 grid grid-cols-6 gap-1 text-[11px] text-muted-foreground max-sm:hidden">
              {STUFEN.map((k, i) => <span key={k} className={cn('truncate', i === stufe && 'font-medium text-foreground')}>{PIPELINE_LABELS[k]}</span>)}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground sm:sr-only">
              {beendet ? t('recruiterInterviews.window.processEnded') : t('recruiterInterviews.window.step', { label: PIPELINE_LABELS[STUFEN[Math.max(stufe, 0)]], n: stufe + 1, total: STUFEN.length })}
            </p>
            {beendet && <p className="mt-1.5 text-xs text-muted-foreground max-sm:hidden">{t('recruiterInterviews.window.processEnded')}</p>}
          </div>

          {/* Offene Aufgaben in diesem Prozess: nur Hinweis, abgearbeitet wird unter „Aufgaben“ */}
          {aufgaben.length > 0 && (
            <div className="rounded-xl bg-secondary/60 px-4 py-3">
              <p className={kopf}>{t('recruiterInterviews.window.todo')}</p>
              {aufgaben.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-0.5 text-sm">
                  <span className="min-w-0 truncate">{a.label}</span>
                  <Link to={`/recruiter/influence?item=${a.id}`} className="shrink-0 whitespace-nowrap text-sm font-medium text-klick hover:underline">{t('recruiterInterviews.window.toTask')} ›</Link>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-5 border-t pt-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <div>
                <p className={kopf}>{t('recruiterInterviews.window.interview')}</p>
                {iv.scheduledAt ? (
                  <>
                    <p className="text-[17px] font-semibold leading-snug tracking-tight">{lang_tag(iv.scheduledAt)}, {zeit(iv.scheduledAt)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {[meetingTypeLabel(iv.meetingType), t('recruiterInterviews.row.duration', { min: iv.durationMinutes }), t('recruiterInterviews.window.round', { n: iv.round || 1 })].join(' · ')}
                      {' · '}<span className="text-foreground">{stand}</span>
                    </p>
                    {iv.onsiteAddress && <p className="mt-1.5 text-sm">{iv.onsiteAddress}{iv.onsiteContact && <span className="text-muted-foreground"> · {iv.onsiteContact}</span>}</p>}
                  </>
                ) : (
                  <p className="text-sm">{stand} <span className="text-muted-foreground">· {t('recruiterInterviews.window.askedOn', { date: tag(iv.createdAt) })}</span></p>
                )}
                {(variant === 'awaiting' || variant === 'counter') && (variant === 'counter' ? iv.counterSlots : iv.proposedSlots).length > 0 && (
                  <div className="mt-2 divide-y">
                    {(variant === 'counter' ? iv.counterSlots : iv.proposedSlots).map((s) => (
                      <div key={s.datetime} className={zeile}>
                        <span>{kurz(s.datetime)}</span>
                        {new Date(s.datetime).getTime() < Date.now() && <span className="text-xs text-destructive">{t('recruiterInterviews.window.expired')}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {variant === 'awaiting' && !iv.companyRevealed && <p className="mt-2 text-xs text-muted-foreground">{t('recruiterInterviews.window.companyLater')}</p>}
                {variant === 'cancelled' && iv.cancellationReason && <p className="mt-2 text-sm"><span className="text-muted-foreground">{t('recruiterInterviews.window.reason')}: </span>{iv.cancellationReason}</p>}
                {iv.notes && <p className="mt-2 text-sm"><span className="text-muted-foreground">{t('recruiterInterviews.window.note')}: </span>{iv.notes}</p>}
                {(variant === 'past' || variant === 'debrief') && (
                  <div className="mt-2 divide-y">
                    <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.debrief')}</span><span>{variant === 'debrief' ? t('recruiterInterviews.window.open') : t('recruiterInterviews.window.done')}</span></div>
                    <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.clientView')}</span><span className="min-w-0 truncate">{iv.feedback || t('recruiterInterviews.window.pending')}</span></div>
                  </div>
                )}
              </div>

              <div>
                <p className={kopf}>{t('recruiterInterviews.window.history')}</p>
                <div className="space-y-1 border-l pl-3 text-sm">
                  {(mehr?.log ?? []).map((e) => (
                    <p key={e.id} className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate">{e.title}</span><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{tag(e.created_at)}</span></p>
                  ))}
                  {mehr?.submittedAt && (
                    <p className="flex items-baseline justify-between gap-3"><span>{t('recruiterInterviews.window.submitted')}</span><span className="shrink-0 text-xs text-muted-foreground tabular-nums">{tag(mehr.submittedAt)}</span></p>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div>
                <p className={kopf}>{t('recruiterInterviews.window.glance')}</p>
                <div className="divide-y">
                  <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.company')}</span><span className="min-w-0 truncate text-right">{iv.companyRevealed ? iv.companyLabel : t('recruiterInterviews.window.notRevealed')}</span></div>
                  <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.job')}</span><Link to={`/recruiter/jobs/${iv.jobId}`} className={link}>{t('recruiterInterviews.window.briefing')} ›</Link></div>
                  <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.candidate')}</span><Link to={`/recruiter/candidates/${iv.candidateId}`} className={link}>{t('recruiterInterviews.window.profile')} ›</Link></div>
                  {iv.potentialFee ? (
                    <div className={zeile}><span className="text-muted-foreground">{t('recruiterInterviews.window.fee')}</span><span className="tabular-nums"><Honorar>{`${Math.round(iv.potentialFee).toLocaleString(lang)} €`}</Honorar></span></div>
                  ) : null}
                </div>
              </div>
              <div>
                <p className={kopf}>{t('recruiterInterviews.window.notes')}</p>
                <p className={cn('whitespace-pre-wrap text-sm', !mehr?.notes && 'text-muted-foreground')}>{mehr?.notes || t('recruiterInterviews.window.noNotes')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3.5">
          {kommt ? <button type="button" className="text-sm text-muted-foreground hover:text-foreground hover:underline" onClick={insKalender}>{t('recruiterInterviews.window.toCalendar')}</button> : <span />}
          <Link to={`/recruiter/submissions/${iv.submissionId}`} className={link}>{t('recruiterInterviews.window.fullPage')} ›</Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

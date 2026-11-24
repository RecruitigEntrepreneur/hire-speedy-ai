import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { term } from '@/lib/candidateTerms';
import { fmtDayMonth } from '@/lib/localeFormat';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Phone,
  Mail,
  Clock,
  Calendar,
  Video,
  User,
  Briefcase,
  Shield,
  Unlock,
  FileText,
  MapPin,
  ChevronRight,
  NotebookPen,
  Save,
  Loader2,
} from 'lucide-react';
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { earliestStart, mapNoticeText, NOTICE_OPTIONS, optionLabel } from '@/lib/candidateDossier';
import { ausZeile, kurzzeile } from '@/lib/nachgespraech';
import { isClosedStage, normalizeStage } from '@/lib/submissionStage';
import {
  HOUSEKEEPING,
  consentAt,
  interviewBadge,
  dateLabel,
  daysBetween,
  euro,
  interviewKind,
  processState,
  processSteps,
  remoteLabel,
  shortDate,
  slotLabel,
  slotsFrom,
  type Tone,
} from '@/lib/processWindow';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useUnifiedTaskInbox, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Stufen-Leiste mit Datum ───────────────────────────────────────

function StagePipeline({ steps }: { steps: ReturnType<typeof processSteps> }) {
  return (
    <div className="flex items-start gap-1 w-full">
      {steps.map((step) => (
        <div key={step.label} className="flex flex-col items-center flex-1 min-w-0">
          <div
            className={cn(
              'h-1.5 w-full rounded-full transition-all',
              // Apple-Stil (25.11.2026): Fortschritt blau, kein Grün
              step.state === 'current' && 'bg-klick',
              step.state === 'done' && 'bg-klick',
              step.state === 'todo' && 'bg-muted-foreground/15',
            )}
          />
          <span className={cn(
            'text-[9px] mt-1 leading-none truncate max-w-full',
            step.state === 'current' && 'text-foreground font-semibold',
            step.state === 'done' && 'text-muted-foreground',
            step.state === 'todo' && 'text-muted-foreground/50',
          )}>
            {step.label}
          </span>
          <span className="text-[9px] mt-0.5 leading-none text-muted-foreground tabular-nums h-2.5">
            {step.date ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <div className="text-right text-xs min-w-0">{children}</div>
    </div>
  );
}

function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-tight">
      {children}
      {right && <span className="ml-auto text-xs font-normal">{right}</span>}
    </div>
  );
}

const TONE: Record<Tone, string> = {
  // Ruhige Oberfläche (25.11.2026): keine Ampelfarben, die Wartezeit steht fett im Text
  wait: 'bg-card border-border text-foreground',
  client: 'bg-card border-border text-foreground',
  ok: 'bg-card border-border text-foreground',
  closed: 'bg-muted/40 border-border text-muted-foreground',
};

/**
 * Offene Aufgabe zu dieser Einreichung (14.10.2026). Erinnern, Nachfassen und
 * Antworten passieren nur in den Aufgaben; das Prozess-Fenster leitet dorthin.
 * Steht im Dialog-Inhalt, lädt also nur bei offenem Fenster.
 */
function OpenTaskCard({ submissionId, onOpen }: { submissionId: string; onOpen: (item: UnifiedTaskItem) => void }) {
  const { t } = useTranslation('processWindow');
  const { allItems, loading } = useUnifiedTaskInbox('all');
  if (loading) return null;
  const open = allItems.filter((i) => i.submissionId === submissionId);
  if (!open.length) return null;
  const item = open[0];
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3 border-t pt-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {open.length > 1 ? t('dialog.openTaskMore', { count: open.length - 1 }) : t('dialog.openTask')}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
      </div>
      <Button size="sm" className="shrink-0" onClick={() => onOpen(item)}>{t('dialog.toTask')}</Button>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────

interface SubmissionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
}

export function SubmissionDetailDialog({ open, onOpenChange, submissionId }: SubmissionDetailDialogProps) {
  const { t } = useTranslation('processWindow');
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [note, setNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['submission-detail-dialog', submissionId],
    queryFn: async () => {
      if (!submissionId) throw new Error('No submission ID');

      const { data: submission, error: subErr } = await supabase
        .from('submissions')
        .select(`
          *,
          candidates(id, full_name, email, phone, job_title, city, expected_salary, notice_period, availability_date)
        `)
        .eq('id', submissionId)
        .single();

      if (subErr) throw subErr;

      // Job über recruiter_jobs_view: gibt company_name nur frei, wenn der
      // Headhunter die Firma sehen darf (company_revealed der View).
      const { data: job } = await supabase
        .from('recruiter_jobs_view')
        .select('id, title, company_name, company_revealed, industry, location, remote_type, salary_min, salary_max')
        .eq('id', submission.job_id)
        .maybeSingle();

      const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('submission_id', submissionId)
        .is('superseded_by', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const interview = interviews?.[0] ?? null;

      const [{ data: activities }, { data: notes }, { data: siblings }, roles, nach] = await Promise.all([
        supabase
          .from('candidate_activity_log')
          .select('*')
          .eq('related_submission_id', submissionId)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('candidate_interview_notes')
          .select('change_motivation')
          .eq('candidate_id', submission.candidate_id)
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('submissions')
          .select('id, stage, status')
          .eq('candidate_id', submission.candidate_id)
          .neq('id', submissionId),
        // Funktion und Entscheider der Kundenseite, ohne Namen (Migration 20261014130000)
        interview
          ? (supabase.rpc as any)('recruiter_interview_attendee_roles', { p_interview_id: interview.id })
          : Promise.resolve({ data: [] }),
        // Nachgespräch, nur für den Headhunter (20.10.2026); fehlt die Tabelle noch, bleibt es leer
        (supabase as any)
          .from('interview_nachgespraeche')
          .select('*')
          .eq('submission_id', submissionId)
          .order('updated_at', { ascending: false })
          .limit(1),
      ]);

      const otherOpen = (siblings ?? []).filter((s) => {
        const st = normalizeStage(s.stage, s.status);
        return !isClosedStage(st) && st !== 'placed';
      }).length;

      return {
        submission,
        job,
        interview,
        activities: activities ?? [],
        changeMotivation: (notes?.[0] as any)?.change_motivation as string | null ?? null,
        otherOpen,
        attendees: ((roles as any)?.data ?? []) as { title: string | null; is_decision_maker: boolean }[],
        nachgespraech: (((nach as any)?.data ?? [])[0] ?? null) as Record<string, any> | null,
      };
    },
    enabled: !!submissionId && open,
  });

  useEffect(() => {
    if (!open) setNote('');
  }, [open]);

  if (!submissionId) return null;

  const submission = data?.submission as any;
  const candidate = submission?.candidates as any;
  const job = data?.job as any;
  const iv = data?.interview as any;
  const now = Date.now();
  const first = candidate?.full_name?.trim().split(/\s+/)[0] || t('dialog.candidate');

  const companyVisible = !!job?.company_revealed && !!job?.company_name;
  const companyDisplay = companyVisible ? job.company_name : formatSimpleAnonymousCompany(job?.industry);

  const state = submission ? processState(submission, iv, first, now) : null;
  const consentIso = submission ? consentAt(submission, iv) : null;
  const steps = submission ? processSteps(submission, iv) : [];
  const slots = iv ? slotsFrom(iv.proposed_slots, now) : [];
  const counterSlots = iv ? slotsFrom(iv.counter_slots, now) : [];

  const notice = mapNoticeText(candidate?.notice_period);
  const noticeLabel = optionLabel(NOTICE_OPTIONS, notice);
  const noticeText = noticeLabel ? term(noticeLabel) : noticeLabel;
  const startIso = candidate?.availability_date || earliestStart(notice, new Date());
  const salary = candidate?.expected_salary as number | null;
  const budgetMax = job?.salary_max as number | null;
  const overBudget = !!salary && !!budgetMax && salary > budgetMax;

  const activities = (data?.activities ?? []) as any[];
  const notes = activities.filter((a) => a.activity_type === 'note');

  // Verlauf: echte Prozess-Ereignisse, keine Aufgaben-Verwaltung
  const events: { time: string; title: string }[] = [];
  if (submission) {
    events.push({ time: submission.submitted_at, title: t('dialog.eventSubmitted') });
    if (iv?.created_at) {
      const n = slotsFrom(iv.proposed_slots, 0).length;
      events.push({ time: iv.created_at, title: n ? t('dialog.eventRequestedSlots', { count: n, first }) : t('dialog.eventRequested', { first }) });
    }
    if (consentIso) events.push({ time: consentIso, title: t('dialog.eventConsent', { first }) });
    if (iv?.cancelled_at) events.push({ time: iv.cancelled_at, title: t('dialog.eventCancelled') });
    for (const a of activities) {
      if (HOUSEKEEPING.includes(a.activity_type)) continue;
      // Titel aus dem Aktivitätslog: gespeichert, wie geschrieben
      events.push({ time: a.created_at, title: a.activity_type === 'note' ? t('dialog.eventNote', { text: a.title }) : a.title });
    }
  }
  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Zur Aufgabe: im Kandidatenprofil öffnet CandidateTaskWindow sie über ?aufgabe=
  const openTask = (item: UnifiedTaskItem) => {
    onOpenChange(false);
    navigate(`/recruiter/candidates/${candidate?.id ?? item.candidateId}?aufgabe=${encodeURIComponent(item.itemId)}`);
  };

  const handleSaveNote = async () => {
    const text = note.trim();
    if (!text || !candidate?.id) return;
    setSavingNote(true);
    // Notiz nur für den Headhunter: Aktivitätslog (RLS: nur er selbst), nicht
    // mehr recruiter_notes – das liest der Kunde.
    const saved = await logActivity(candidate.id, 'note', text.slice(0, 120), text, { source: 'prozess_fenster' }, submissionId);
    setSavingNote(false);
    if (!saved) {
      toast.error(t('dialog.noteError'));
      return;
    }
    setNote('');
    refetch();
  };

  const meetingLink = iv ? iv.teams_join_url || iv.google_meet_link || iv.meeting_link : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden sm:rounded-2xl">
        {isLoading || !submission || !state ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
            {/* LEFT: Ablauf */}
            <div className="flex-1 flex flex-col min-w-0 md:border-r">
              {/* Header */}
              <div className="p-5 pb-4 border-b space-y-3">
                {/* Kopf: Kandidat und Stufe, darunter Stelle, Firma und Dauer */}
                <div className="min-w-0 pr-6">
                  <h2 className="truncate text-lg font-semibold leading-tight tracking-tight">
                    {candidate?.full_name || t('dialog.unknown')}
                    <span className="font-normal text-muted-foreground"> · {state.phase}</span>
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[job?.title || t('dialog.unknownJob'), companyDisplay, t('dialog.inProcess', { count: daysBetween(submission.submitted_at, now) })].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <StagePipeline steps={steps} />

                {/* Wer ist am Zug */}
                <div className={cn('rounded-xl border px-3.5 py-3', TONE[state.tone])}>
                  <p className="text-sm font-semibold">{state.headline}</p>
                  {state.detail && <p className="mt-0.5 text-xs text-muted-foreground">{state.detail}</p>}
                  <OpenTaskCard submissionId={submissionId} onOpen={openTask} />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Details */}
                <div className="space-y-1.5">
                  <SectionTitle>{t('dialog.details')}</SectionTitle>
                  <div className="rounded-lg border bg-card px-3 py-1.5 divide-y">
                    <DetailRow label={t('dialog.phase')}>{state.phase}</DetailRow>
                    {state.turn && <DetailRow label={t('dialog.turn')}>{state.turn}</DetailRow>}
                    {state.deadline && Date.parse(state.deadline) > now && (
                      <DetailRow label={state.stage === 'interview_scheduled' ? t('dialog.appointment') : t('dialog.deadline')}>
                        <span className={cn(state.tone === 'wait' && 'font-semibold')}>{slotLabel(state.deadline)}</span>
                      </DetailRow>
                    )}
                    <DetailRow label={t('dialog.submitted')}>{dateLabel(submission.submitted_at)}</DetailRow>
                    {iv?.created_at && <DetailRow label={t('dialog.clientRequested')}>{dateLabel(iv.created_at)}</DetailRow>}
                    {iv?.created_at && <DetailRow label={t('dialog.invitationTo', { first })}>{t('dialog.invitationSent', { date: shortDate(iv.created_at) })}</DetailRow>}
                    {iv && (
                      <DetailRow label={t('dialog.consent')}>
                        {consentIso
                          ? t('dialog.consentGiven', { slot: slotLabel(consentIso) })
                          : state.stage === 'interview_requested'
                            ? t('dialog.consentOpen', { first })
                            : '—'}
                      </DetailRow>
                    )}
                    <DetailRow label={t('dialog.clientSees')}>
                      {submission.identity_unlocked ? t('dialog.clientSeesName') : t('dialog.clientSeesAnon')}
                    </DetailRow>
                    <DetailRow label={t('dialog.candidateSeesCompany', { first })}>
                      {submission.company_revealed ? t('dialog.yes') : t('dialog.afterConsent')}
                    </DetailRow>
                  </div>
                </div>

                {/* Interview */}
                {iv && (
                  <div className="space-y-1.5">
                    <SectionTitle
                      right={<span className="text-muted-foreground">{iv.status === 'pending_response' ? t('dialog.waitingFor', { first }) : interviewBadge(iv.status)}</span>}
                    >
                      {t('dialog.interview')}
                    </SectionTitle>
                    <div className="rounded-lg border bg-card px-3 py-1.5 divide-y">
                      <DetailRow label={t('dialog.kind')}>{interviewKind(iv)}</DetailRow>
                      {iv.client_message && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">{t('dialog.clientMessage')}</p>
                          <p className="text-xs italic mt-0.5">{t('dialog.quote', { text: iv.client_message })}</p>
                        </div>
                      )}
                      {(data?.attendees ?? []).length > 0 && (
                        <DetailRow label={t('dialog.attendees')}>
                          {data!.attendees.map((a) => (a.is_decision_maker ? t('dialog.decides', { title: a.title || t('dialog.noFunction') }) : a.title || t('dialog.noFunction'))).join(' · ')}
                        </DetailRow>
                      )}
                      {iv.status === 'pending_response' && slots.length > 0 && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">{t('dialog.proposedSlots')}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {slots.map((s) => (
                              <span key={s.iso} className={cn('text-[11px] rounded-md border px-1.5 py-0.5 tabular-nums', s.gone && 'line-through text-muted-foreground')}>
                                {slotLabel(s.iso)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {iv.status === 'pending_response' && (
                        <DetailRow label={t('dialog.otherTimes')}>{iv.allow_alternative ? t('dialog.allowed') : t('dialog.notPlanned')}</DetailRow>
                      )}
                      {iv.status === 'pending_response' && iv.response_token_expires_at && (
                        <DetailRow label={t('dialog.linkValid')}>{slotLabel(iv.response_token_expires_at)}</DetailRow>
                      )}
                      {iv.status === 'counter_proposed' && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">{t('dialog.counterFrom', { first })}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {counterSlots.map((s) => (
                              <span key={s.iso} className={cn('text-[11px] rounded-md border px-1.5 py-0.5 tabular-nums', s.gone && 'line-through text-muted-foreground')}>
                                {slotLabel(s.iso)}
                              </span>
                            ))}
                          </div>
                          {iv.candidate_message && <p className="text-xs italic mt-1">{t('dialog.quote', { text: iv.candidate_message })}</p>}
                        </div>
                      )}
                      {iv.status === 'scheduled' && iv.scheduled_at && (
                        <DetailRow label={t('dialog.appointment')}>{slotLabel(iv.scheduled_at)}</DetailRow>
                      )}
                      {iv.status === 'scheduled' && (iv.onsite_address || iv.location_note) && (
                        <DetailRow label={t('dialog.place')}>{iv.onsite_address || iv.location_note}</DetailRow>
                      )}
                      {iv.status === 'scheduled' && (
                        <DetailRow label={t('dialog.reminder24')}>{iv.reminder_24h_sent ? t('dialog.sent') : t('dialog.followsAuto')}</DetailRow>
                      )}
                      {iv.status === 'cancelled' && iv.cancellation_reason && (
                        <DetailRow label={t('dialog.reason')}>{iv.cancellation_reason}</DetailRow>
                      )}
                      {iv.status === 'declined' && iv.decline_reason && (
                        <DetailRow label={t('dialog.reason')}>{iv.decline_reason}</DetailRow>
                      )}
                    </div>
                    {iv.status === 'pending_response' && (
                      <p className="text-[11px] text-muted-foreground">{t('dialog.afterChoice')}</p>
                    )}
                    {iv.status === 'scheduled' && meetingLink && iv.scheduled_at && Date.parse(iv.scheduled_at) > now && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => window.open(meetingLink, '_blank')}>
                        <Video className="h-3 w-3" />{t('dialog.joinMeeting')}
                      </Button>
                    )}
                  </div>
                )}

                {/* Nachgespräch mit dem Kandidaten, nur für den Headhunter */}
                {data?.nachgespraech && (
                  <div className="space-y-1.5">
                    <SectionTitle>{t('dialog.nachTitle')}</SectionTitle>
                    <div className="rounded-lg border bg-card px-3 py-2 text-sm">
                      <p>
                        <span className="text-muted-foreground tabular-nums">{fmtDayMonth(data.nachgespraech.updated_at ?? data.nachgespraech.created_at)}</span>
                        {' · '}{kurzzeile(ausZeile(data.nachgespraech)) || t('dialog.nachRecorded')}
                      </p>
                      {data.nachgespraech.bedenken && <p className="mt-0.5 text-xs text-muted-foreground">{t('dialog.concerns', { text: data.nachgespraech.bedenken })}</p>}
                    </div>
                  </div>
                )}

                {/* Notizen nur für den Headhunter */}
                <div className="space-y-1.5">
                  <SectionTitle>{t('dialog.notesTitle')}</SectionTitle>
                  {notes.length > 0 && (
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {notes.map((n) => (
                        <p key={n.id} className="text-xs text-muted-foreground">
                          <span className="tabular-nums">{shortDate(n.created_at)}</span> · {n.description || n.title}
                        </p>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={t('dialog.notePlaceholder')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="text-sm min-h-[50px] resize-none"
                      rows={2}
                    />
                    {note.trim() && (
                      <Button size="sm" className="shrink-0 self-end" onClick={handleSaveNote} disabled={savingNote}>
                        {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sticky Action Bar */}
              <div className="border-t p-3 flex items-center gap-2 bg-card shrink-0">
                {candidate?.phone && (
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                    <a href={`tel:${candidate.phone}`}>
                      <Phone className="h-3.5 w-3.5" />
                      {t('dialog.call')}
                    </a>
                  </Button>
                )}
                {candidate?.email && (
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                    <a href={`mailto:${candidate.email}`}>
                      <Mail className="h-3.5 w-3.5" />
                      {t('dialog.mailTo', { first })}
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* RIGHT: Kandidat, Job, Verlauf */}
            <div className="w-full md:w-[300px] shrink-0 overflow-y-auto bg-card">
              <div className="p-4 space-y-4">
                {/* Kandidat */}
                <div className="space-y-2">
                  <SectionTitle>{t('dialog.candidate')}</SectionTitle>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{candidate?.full_name || t('dialog.unknown')}</p>
                    {candidate?.job_title && <p className="text-xs text-muted-foreground">{candidate.job_title}</p>}
                    {candidate?.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{candidate.city}</p>
                    )}
                    {candidate?.phone && <p className="text-xs text-muted-foreground">{candidate.phone}</p>}
                    {candidate?.email && <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>}
                    {candidate?.id && (
                      <button type="button" className="pt-0.5 text-xs font-medium text-klick hover:underline" onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${candidate.id}`); }}>
                        {t('dialog.openProfile')} ›
                      </button>
                    )}
                  </div>
                  <div className="rounded-lg border bg-card px-2.5 py-1 divide-y">
                    <DetailRow label={t('dialog.notice')}>{noticeText ?? '—'}</DetailRow>
                    <DetailRow label={t('dialog.earliestStart')}>{startIso ? dateLabel(startIso) : '—'}</DetailRow>
                    <DetailRow label={t('dialog.salaryWish')}>
                      {salary ? (
                        <span className={cn(overBudget && 'font-semibold')}>
                          {euro(salary)}
                          {overBudget && <span className="block text-[10px]">{t('dialog.overBudget', { max: euro(budgetMax!) })}</span>}
                        </span>
                      ) : '—'}
                    </DetailRow>
                    {data?.changeMotivation && (
                      <DetailRow label={t('dialog.changeReason')}><span className="line-clamp-2">{data.changeMotivation}</span></DetailRow>
                    )}
                    <DetailRow label={t('dialog.otherProcesses')}>
                      {data?.otherOpen ? (
                        <button
                          type="button"
                          className="font-medium text-klick hover:underline"
                          onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${candidate.id}`); }}
                        >
                          {t('dialog.running', { count: data.otherOpen })}
                        </button>
                      ) : t('dialog.none')}
                    </DetailRow>
                  </div>
                </div>

                <div className="border-t" />

                {/* Job */}
                <div className="space-y-2">
                  <SectionTitle>{t('dialog.job')}</SectionTitle>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{job?.title || t('dialog.unknown')}</p>
                    <p className="text-xs text-muted-foreground">{companyDisplay}</p>
                    {(job?.location || job?.remote_type) && (
                      <p className="text-xs text-muted-foreground">{[job?.location, remoteLabel(job?.remote_type)].filter(Boolean).join(' · ')}</p>
                    )}
                    {job?.id && (
                      <button type="button" className="pt-0.5 text-xs font-medium text-klick hover:underline" onClick={() => { onOpenChange(false); navigate(`/recruiter/jobs/${job.id}`); }}>
                        {t('dialog.openJob')} ›
                      </button>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Verlauf */}
                <div className="space-y-2">
                  <SectionTitle>{t('dialog.history')}</SectionTitle>
                  {events.length > 0 ? (
                    <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
                      {events.slice(0, 10).map((e, i) => (
                        <div key={`${e.time}-${i}`} className="contents">
                          <span className="text-muted-foreground tabular-nums">{shortDate(e.time)}</span>
                          <span className="line-clamp-2">{e.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('dialog.nothingYet')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { isClosedStage, normalizeStage } from '@/lib/submissionStage';
import {
  HOUSEKEEPING,
  consentAt,
  INTERVIEW_BADGE,
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
              'h-2 w-full rounded-full transition-all',
              step.state === 'current' && 'bg-primary',
              step.state === 'done' && 'bg-green-500',
              step.state === 'todo' && 'bg-muted-foreground/15',
            )}
          />
          <span className={cn(
            'text-[9px] mt-1 leading-none truncate max-w-full',
            step.state === 'current' && 'text-primary font-semibold',
            step.state === 'done' && 'text-green-600',
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

function SectionTitle({ icon: Icon, children, right }: { icon: React.ElementType; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
      <Icon className="h-3.5 w-3.5" />
      {children}
      {right && <span className="ml-auto normal-case tracking-normal">{right}</span>}
    </div>
  );
}

const TONE: Record<Tone, string> = {
  wait: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
  client: 'bg-muted/50 border-border text-foreground',
  ok: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
  closed: 'bg-muted/40 border-border text-muted-foreground',
};

const PRIORITY: Record<UnifiedTaskItem['priority'], { label: string; text: string; border: string }> = {
  critical: { label: 'Kritisch', text: 'text-destructive border-destructive/40', border: 'border-l-destructive' },
  high: { label: 'Hoch', text: 'text-amber-600 border-amber-500/40', border: 'border-l-amber-500' },
  medium: { label: 'Mittel', text: 'text-blue-600 border-blue-500/40', border: 'border-l-blue-500' },
  low: { label: 'Normal', text: 'text-muted-foreground border-border', border: 'border-l-muted-foreground' },
};

/**
 * Offene Aufgabe zu dieser Einreichung (14.10.2026). Erinnern, Nachfassen und
 * Antworten passieren nur in den Aufgaben; das Prozess-Fenster leitet dorthin.
 * Steht im Dialog-Inhalt, lädt also nur bei offenem Fenster.
 */
function OpenTaskCard({ submissionId, onOpen }: { submissionId: string; onOpen: (item: UnifiedTaskItem) => void }) {
  const { allItems, loading } = useUnifiedTaskInbox('all');
  if (loading) return null;
  const open = allItems.filter((i) => i.submissionId === submissionId);
  if (!open.length) return null;
  const item = open[0];
  const prio = PRIORITY[item.priority];
  return (
    <div className={cn('mt-2.5 flex items-center justify-between gap-3 rounded-md border border-l-[3px] bg-background px-3 py-2', prio.border)}>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">
          Offene Aufgabe{open.length > 1 ? ` · ${open.length - 1} weitere` : ''}
        </p>
        <p className="text-sm text-foreground flex items-center gap-1.5 min-w-0">
          <Badge variant="outline" className={cn('text-[9px] px-1.5 py-0 leading-4 shrink-0', prio.text)}>{prio.label}</Badge>
          <span className="truncate font-medium">{item.title}</span>
        </p>
      </div>
      <Button size="sm" className="h-7 text-xs gap-0.5 shrink-0" onClick={() => onOpen(item)}>
        Zur Aufgabe<ChevronRight className="h-3 w-3" />
      </Button>
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

      const [{ data: activities }, { data: notes }, { data: siblings }, roles] = await Promise.all([
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
  const first = candidate?.full_name?.trim().split(/\s+/)[0] || 'Kandidat';

  const companyVisible = !!job?.company_revealed && !!job?.company_name;
  const companyDisplay = companyVisible ? job.company_name : formatSimpleAnonymousCompany(job?.industry);

  const state = submission ? processState(submission, iv, first, now) : null;
  const consentIso = submission ? consentAt(submission, iv) : null;
  const steps = submission ? processSteps(submission, iv) : [];
  const slots = iv ? slotsFrom(iv.proposed_slots, now) : [];
  const counterSlots = iv ? slotsFrom(iv.counter_slots, now) : [];

  const notice = mapNoticeText(candidate?.notice_period);
  const noticeText = optionLabel(NOTICE_OPTIONS, notice);
  const startIso = candidate?.availability_date || earliestStart(notice, new Date());
  const salary = candidate?.expected_salary as number | null;
  const budgetMax = job?.salary_max as number | null;
  const overBudget = !!salary && !!budgetMax && salary > budgetMax;

  const activities = (data?.activities ?? []) as any[];
  const notes = activities.filter((a) => a.activity_type === 'note');

  // Verlauf: echte Prozess-Ereignisse, keine Aufgaben-Verwaltung
  const events: { time: string; title: string }[] = [];
  if (submission) {
    events.push({ time: submission.submitted_at, title: 'Eingereicht' });
    if (iv?.created_at) {
      const n = slotsFrom(iv.proposed_slots, 0).length;
      events.push({ time: iv.created_at, title: `Kunde hat Gespräch angefragt${n ? ` (${n} Zeiten)` : ''}, Einladung an ${first}` });
    }
    if (consentIso) events.push({ time: consentIso, title: `${first} hat zugesagt` });
    if (iv?.cancelled_at) events.push({ time: iv.cancelled_at, title: 'Anfrage zurückgezogen' });
    for (const a of activities) {
      if (HOUSEKEEPING.includes(a.activity_type)) continue;
      events.push({ time: a.created_at, title: a.activity_type === 'note' ? `Notiz: ${a.title}` : a.title });
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
      toast.error('Notiz konnte nicht gespeichert werden.');
      return;
    }
    setNote('');
    refetch();
  };

  const meetingLink = iv ? iv.teams_join_url || iv.google_meet_link || iv.meeting_link : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden">
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
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {companyVisible ? (
                      <Unlock className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <h2 className="font-semibold text-base leading-tight truncate">{companyDisplay}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{job?.title || 'Unbekannte Stelle'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {candidate?.full_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      seit {daysBetween(submission.submitted_at, now)} Tagen im Prozess
                    </span>
                  </div>
                </div>

                <StagePipeline steps={steps} />

                {/* Wer ist am Zug */}
                <div className={cn('p-3 rounded-lg border', TONE[state.tone])}>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Clock className="h-4 w-4 shrink-0" />
                    {state.headline}
                  </p>
                  {state.detail && <p className="text-xs mt-0.5 opacity-90">{state.detail}</p>}
                  <OpenTaskCard submissionId={submissionId} onOpen={openTask} />
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Details */}
                <div className="space-y-1.5">
                  <SectionTitle icon={FileText}>Details</SectionTitle>
                  <div className="rounded-lg border bg-card px-3 py-1.5 divide-y">
                    <DetailRow label="Phase">{state.phase}</DetailRow>
                    {state.turn && <DetailRow label="Am Zug">{state.turn}</DetailRow>}
                    {state.deadline && Date.parse(state.deadline) > now && (
                      <DetailRow label={state.stage === 'interview_scheduled' ? 'Termin' : 'Frist'}>
                        <span className={cn(state.tone === 'wait' && 'text-amber-600 font-medium')}>{slotLabel(state.deadline)}</span>
                      </DetailRow>
                    )}
                    <DetailRow label="Eingereicht">{dateLabel(submission.submitted_at)}</DetailRow>
                    {iv?.created_at && <DetailRow label="Kunde hat angefragt">{dateLabel(iv.created_at)}</DetailRow>}
                    {iv?.created_at && <DetailRow label={`Einladung an ${first}`}>{shortDate(iv.created_at)} verschickt</DetailRow>}
                    {iv && (
                      <DetailRow label="Zusage und Einwilligung">
                        {consentIso
                          ? `erteilt am ${slotLabel(consentIso)}`
                          : state.stage === 'interview_requested'
                            ? `offen, nur ${first} kann zusagen`
                            : '—'}
                      </DetailRow>
                    )}
                    <DetailRow label="Kunde sieht">
                      {submission.identity_unlocked ? 'Name und Kontakt' : 'anonymes Profil, Name nach Zusage'}
                    </DetailRow>
                    <DetailRow label={`${first} sieht die Firma`}>
                      {submission.company_revealed ? 'ja' : 'nach Zusage'}
                    </DetailRow>
                  </div>
                </div>

                {/* Interview */}
                {iv && (
                  <div className="space-y-1.5">
                    <SectionTitle
                      icon={Calendar}
                      right={
                        <Badge variant="outline" className={cn(
                          'text-[10px]',
                          iv.status === 'pending_response' && 'text-amber-600 border-amber-500/30',
                          iv.status === 'scheduled' && 'text-green-600 border-green-500/30',
                        )}>
                          {iv.status === 'pending_response' ? `Wartet auf ${first}` : INTERVIEW_BADGE[iv.status] ?? iv.status}
                        </Badge>
                      }
                    >
                      Interview
                    </SectionTitle>
                    <div className="rounded-lg border bg-card px-3 py-1.5 divide-y">
                      <DetailRow label="Art">{interviewKind(iv)}</DetailRow>
                      {iv.client_message && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">Nachricht vom Kunden</p>
                          <p className="text-xs italic mt-0.5">„{iv.client_message}“</p>
                        </div>
                      )}
                      {(data?.attendees ?? []).length > 0 && (
                        <DetailRow label="Teilnehmer beim Kunden">
                          {data!.attendees.map((a) => `${a.title || 'ohne Funktion'}${a.is_decision_maker ? ' (entscheidet)' : ''}`).join(' · ')}
                        </DetailRow>
                      )}
                      {iv.status === 'pending_response' && slots.length > 0 && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">Vorgeschlagene Zeiten</p>
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
                        <DetailRow label="Andere Zeiten vorschlagen">{iv.allow_alternative ? 'erlaubt' : 'nicht vorgesehen'}</DetailRow>
                      )}
                      {iv.status === 'pending_response' && iv.response_token_expires_at && (
                        <DetailRow label="Link gültig bis">{slotLabel(iv.response_token_expires_at)}</DetailRow>
                      )}
                      {iv.status === 'counter_proposed' && (
                        <div className="py-1.5 text-sm">
                          <p className="text-muted-foreground">Gegenvorschlag von {first}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {counterSlots.map((s) => (
                              <span key={s.iso} className={cn('text-[11px] rounded-md border px-1.5 py-0.5 tabular-nums', s.gone && 'line-through text-muted-foreground')}>
                                {slotLabel(s.iso)}
                              </span>
                            ))}
                          </div>
                          {iv.candidate_message && <p className="text-xs italic mt-1">„{iv.candidate_message}“</p>}
                        </div>
                      )}
                      {iv.status === 'scheduled' && iv.scheduled_at && (
                        <DetailRow label="Termin">{slotLabel(iv.scheduled_at)}</DetailRow>
                      )}
                      {iv.status === 'scheduled' && (iv.onsite_address || iv.location_note) && (
                        <DetailRow label="Ort">{iv.onsite_address || iv.location_note}</DetailRow>
                      )}
                      {iv.status === 'scheduled' && (
                        <DetailRow label="Erinnerung 24 h vorher">{iv.reminder_24h_sent ? 'gesendet' : 'folgt automatisch'}</DetailRow>
                      )}
                      {iv.status === 'cancelled' && iv.cancellation_reason && (
                        <DetailRow label="Grund">{iv.cancellation_reason}</DetailRow>
                      )}
                      {iv.status === 'declined' && iv.decline_reason && (
                        <DetailRow label="Grund">{iv.decline_reason}</DetailRow>
                      )}
                    </div>
                    {iv.status === 'pending_response' && (
                      <p className="text-[11px] text-muted-foreground">Nach der Terminwahl steht hier der Termin mit Link und Erinnerung.</p>
                    )}
                    {iv.status === 'scheduled' && meetingLink && iv.scheduled_at && Date.parse(iv.scheduled_at) > now && (
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => window.open(meetingLink, '_blank')}>
                        <Video className="h-3 w-3" />Meeting beitreten
                      </Button>
                    )}
                  </div>
                )}

                {/* Notizen nur für den Headhunter */}
                <div className="space-y-1.5">
                  <SectionTitle icon={NotebookPen}>Deine Notizen · nur für dich</SectionTitle>
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
                      placeholder="Notiz hinzufügen … (sieht der Kunde nicht)"
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
                      Anrufen
                    </a>
                  </Button>
                )}
                {candidate?.email && (
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                    <a href={`mailto:${candidate.email}`}>
                      <Mail className="h-3.5 w-3.5" />
                      Mail an {first}
                    </a>
                  </Button>
                )}
                <div className="flex-1" />
                {candidate?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${candidate.id}`); }}
                  >
                    <User className="h-3.5 w-3.5" />
                    Profil
                  </Button>
                )}
                {job?.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5"
                    onClick={() => { onOpenChange(false); navigate(`/recruiter/jobs/${job.id}`); }}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    Job
                  </Button>
                )}
              </div>
            </div>

            {/* RIGHT: Kandidat, Job, Verlauf */}
            <div className="w-full md:w-[300px] shrink-0 overflow-y-auto bg-muted/20">
              <div className="p-4 space-y-4">
                {/* Kandidat */}
                <div className="space-y-2">
                  <SectionTitle icon={User}>Kandidat</SectionTitle>
                  <div className="space-y-0.5">
                    <p className="font-medium text-sm">{candidate?.full_name || 'Unbekannt'}</p>
                    {candidate?.job_title && <p className="text-xs text-muted-foreground">{candidate.job_title}</p>}
                    {candidate?.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{candidate.city}</p>
                    )}
                    {candidate?.phone && <p className="text-xs text-muted-foreground">{candidate.phone}</p>}
                    {candidate?.email && <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>}
                  </div>
                  <div className="rounded-lg border bg-card px-2.5 py-1 divide-y">
                    <DetailRow label="Kündigungsfrist">{noticeText ?? '—'}</DetailRow>
                    <DetailRow label="Frühester Start">{startIso ? dateLabel(startIso) : '—'}</DetailRow>
                    <DetailRow label="Gehaltswunsch">
                      {salary ? (
                        <span className={cn(overBudget && 'text-amber-600')}>
                          {euro(salary)}
                          {overBudget && <span className="block text-[10px]">über Budget (bis {euro(budgetMax!)})</span>}
                        </span>
                      ) : '—'}
                    </DetailRow>
                    {data?.changeMotivation && (
                      <DetailRow label="Wechselgrund"><span className="line-clamp-2">{data.changeMotivation}</span></DetailRow>
                    )}
                    <DetailRow label="Weitere Prozesse">
                      {data?.otherOpen ? (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${candidate.id}`); }}
                        >
                          {data.otherOpen} laufend ›
                        </button>
                      ) : 'keine'}
                    </DetailRow>
                  </div>
                </div>

                <div className="border-t" />

                {/* Job */}
                <div className="space-y-2">
                  <SectionTitle icon={Briefcase}>Job</SectionTitle>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{job?.title || 'Unbekannt'}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {companyVisible ? <Unlock className="h-3 w-3 text-green-500" /> : <Shield className="h-3 w-3" />}
                      {companyDisplay}
                    </div>
                    {(job?.location || job?.remote_type) && (
                      <p className="text-xs text-muted-foreground">{[job?.location, remoteLabel(job?.remote_type)].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Verlauf */}
                <div className="space-y-2">
                  <SectionTitle icon={Clock}>Verlauf</SectionTitle>
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
                    <p className="text-xs text-muted-foreground">Noch nichts passiert.</p>
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

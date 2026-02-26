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
  Check,
  Clock,
  Calendar,
  Video,
  User,
  Briefcase,
  Shield,
  Unlock,
  Lock,
  ShieldCheck,
  FileText,
  MessageSquare,
  Send,
  TrendingUp,
  Save,
  Loader2,
} from 'lucide-react';
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Stage Pipeline ────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'new', label: 'Neu' },
  { key: 'submitted', label: 'Eingereicht' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview_requested', label: 'Angefr.' },
  { key: 'candidate_opted_in', label: 'Opt-In' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Angebot' },
  { key: 'hired', label: 'Eingestellt' },
];

function getStageIndex(stage: string | null): number {
  if (stage === 'interview_scheduled' || stage === 'interview_counter_proposed') return 5;
  if (stage === 'interview_declined') return 3;
  const idx = PIPELINE_STAGES.findIndex(s => s.key === stage);
  return idx >= 0 ? idx : 0;
}

function StagePipeline({ currentStage }: { currentStage: string | null }) {
  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="flex items-center gap-1 w-full">
      {PIPELINE_STAGES.map((stage, idx) => {
        const isActive = idx === currentIdx;
        const isPassed = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex flex-col items-center flex-1">
            <div
              className={cn(
                'h-2 w-full rounded-full transition-all',
                isActive && 'bg-primary',
                isPassed && 'bg-green-500',
                isFuture && 'bg-muted-foreground/15',
              )}
            />
            <span className={cn(
              'text-[9px] mt-1 leading-none',
              isActive && 'text-primary font-semibold',
              isPassed && 'text-green-600',
              isFuture && 'text-muted-foreground/50',
            )}>
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function TimelineItem({
  title,
  description,
  time,
  icon: Icon,
  iconColor,
  isLast,
}: {
  title: string;
  description?: string | null;
  time: string;
  icon: React.ElementType;
  iconColor: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('p-1.5 rounded-full border', iconColor)}>
          <Icon className="h-3 w-3" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>
      <div className={cn('pb-4 min-w-0 flex-1', isLast && 'pb-0')}>
        <p className="text-sm font-medium leading-tight">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">
          {format(new Date(time), 'd. MMM yyyy, HH:mm', { locale: de })}
        </p>
      </div>
    </div>
  );
}

function getActivityIcon(type: string): { icon: React.ElementType; color: string } {
  switch (type) {
    case 'submission_created':
    case 'candidate_submitted':
      return { icon: Send, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' };
    case 'interview_invitation_sent':
    case 'interview_scheduled':
      return { icon: Calendar, color: 'text-primary bg-primary/10 border-primary/20' };
    case 'opt_in_confirmed':
      return { icon: ShieldCheck, color: 'text-green-600 bg-green-500/10 border-green-500/20' };
    case 'alert_actioned':
    case 'task_completed':
      return { icon: Check, color: 'text-green-600 bg-green-500/10 border-green-500/20' };
    case 'stage_changed':
      return { icon: TrendingUp, color: 'text-violet-600 bg-violet-500/10 border-violet-500/20' };
    case 'note_added':
      return { icon: MessageSquare, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
    default:
      return { icon: Clock, color: 'text-muted-foreground bg-muted border-border' };
  }
}

// ── Main Dialog ───────────────────────────────────────────────────

interface SubmissionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submissionId: string | null;
}

export function SubmissionDetailDialog({ open, onOpenChange, submissionId }: SubmissionDetailDialogProps) {
  const navigate = useNavigate();
  const [recruiterNote, setRecruiterNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['submission-detail-dialog', submissionId],
    queryFn: async () => {
      if (!submissionId) throw new Error('No submission ID');

      const { data: submission, error: subErr } = await supabase
        .from('submissions')
        .select(`
          *,
          candidates(id, full_name, email, phone, job_title, city, experience_years, expected_salary, linkedin_url),
          jobs(id, title, company_name, industry)
        `)
        .eq('id', submissionId)
        .single();

      if (subErr) throw subErr;

      const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('submission_id', submissionId)
        .in('status', ['scheduled', 'pending_response'])
        .order('created_at', { ascending: false })
        .limit(1);

      const { data: activities } = await supabase
        .from('candidate_activity_log')
        .select('*')
        .eq('related_submission_id', submissionId)
        .order('created_at', { ascending: false })
        .limit(15);

      return {
        submission,
        activeInterview: interviews?.[0] || null,
        activities: activities || [],
      };
    },
    enabled: !!submissionId && open,
  });

  // Reset note on close
  useEffect(() => {
    if (!open) setRecruiterNote('');
  }, [open]);

  const handleSaveNote = async () => {
    if (!recruiterNote.trim() || !submissionId) return;
    setSavingNote(true);
    try {
      const existing = data?.submission?.recruiter_notes || '';
      const newNote = existing
        ? `${existing}\n\n[${format(new Date(), 'd.M.yyyy HH:mm')}] ${recruiterNote}`
        : `[${format(new Date(), 'd.M.yyyy HH:mm')}] ${recruiterNote}`;

      const { error } = await supabase
        .from('submissions')
        .update({ recruiter_notes: newNote })
        .eq('id', submissionId);

      if (error) throw error;
      setRecruiterNote('');
      refetch();
      toast.success('Notiz gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingNote(false);
    }
  };

  const handleConfirmOptIn = async () => {
    if (!submissionId) return;
    try {
      await supabase
        .from('submissions')
        .update({ stage: 'candidate_opted_in' })
        .eq('id', submissionId);

      // Also mark opt-in alert as done if one exists
      const { data: optInAlerts } = await supabase
        .from('influence_alerts')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('alert_type', 'opt_in_pending')
        .is('action_taken', null)
        .limit(1);

      if (optInAlerts?.[0]) {
        await supabase
          .from('influence_alerts')
          .update({ action_taken: 'opt_in_confirmed', action_taken_at: new Date().toISOString(), is_read: true })
          .eq('id', optInAlerts[0].id);
      }

      refetch();
      toast.success('Opt-In bestätigt');
    } catch {
      toast.error('Fehler beim Bestätigen');
    }
  };

  if (!submissionId) return null;

  const submission = data?.submission;
  const candidate = submission?.candidates as any;
  const job = submission?.jobs as any;
  const activeInterview = data?.activeInterview as any;
  const activities = data?.activities || [];

  const companyRevealed = !!submission?.company_revealed;
  const companyDisplay = companyRevealed
    ? job?.company_name
    : formatSimpleAnonymousCompany(job?.industry);

  const isAwaitingOptIn = submission?.stage === 'interview_requested';

  // Build timeline
  const timelineItems: { title: string; description?: string | null; time: string; type: string }[] = [];

  activities.forEach((a: any) => {
    timelineItems.push({ title: a.title, description: a.description, time: a.created_at, type: a.activity_type });
  });

  if (submission && !timelineItems.some(t => t.type === 'submission_created' || t.type === 'candidate_submitted')) {
    timelineItems.push({
      title: 'Kandidat eingereicht',
      description: `Für "${job?.title}" bei ${companyDisplay}`,
      time: submission.submitted_at,
      type: 'candidate_submitted',
    });
  }

  timelineItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const seen = new Set<string>();
  const uniqueTimeline = timelineItems.filter(item => {
    const key = `${item.title}::${item.time.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden">
        {isLoading || !submission ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
            {/* LEFT: Submission details */}
            <div className="flex-1 flex flex-col min-w-0 md:border-r">
              {/* Header */}
              <div className="p-5 pb-4 border-b space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {companyRevealed ? (
                        <Unlock className="h-4 w-4 text-green-600 shrink-0" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <h2 className="font-semibold text-base leading-tight truncate">{companyDisplay}</h2>
                      {submission.match_score && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          Match {submission.match_score}%
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{job?.title || 'Unbekannte Stelle'}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {candidate?.full_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(submission.submitted_at), { locale: de, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <StagePipeline currentStage={submission.stage} />

                {/* Opt-In CTA */}
                {isAwaitingOptIn && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Wartet auf Kandidaten-Opt-In</p>
                      <p className="text-xs text-muted-foreground">Kontaktieren Sie den Kandidaten.</p>
                    </div>
                    <Button size="sm" onClick={handleConfirmOptIn}>
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      Opt-In bestätigen
                    </Button>
                  </div>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Details Grid */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <FileText className="h-3.5 w-3.5" />
                    Details
                  </div>
                  <div className="rounded-lg border bg-card p-3 divide-y text-sm">
                    <DetailRow label="Match Score">
                      {submission.match_score ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${submission.match_score}%` }} />
                          </div>
                          <span className="text-xs font-medium">{submission.match_score}%</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Opt-In">
                      {submission.opt_in_response ? (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                          {submission.opt_in_response}
                        </Badge>
                      ) : isAwaitingOptIn ? (
                        <span className="text-xs text-amber-600 font-medium">ausstehend</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Firma sichtbar">
                      {companyRevealed ? (
                        <span className="text-xs text-green-600 flex items-center gap-1"><Unlock className="h-3 w-3" /> Ja</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Nein</span>
                      )}
                    </DetailRow>
                    <DetailRow label="Eingereicht">
                      <span className="text-xs">{format(new Date(submission.submitted_at), 'd. MMM yyyy', { locale: de })}</span>
                    </DetailRow>
                  </div>
                </div>

                {/* Interview */}
                {activeInterview && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Calendar className="h-3.5 w-3.5" />
                      Interview
                      <Badge variant="outline" className={cn(
                        'text-[10px] ml-auto',
                        activeInterview.status === 'pending_response' && 'text-amber-600 border-amber-500/30',
                        activeInterview.status === 'scheduled' && 'text-green-600 border-green-500/30',
                      )}>
                        {activeInterview.status === 'pending_response' ? 'Wartet' : 'Bestätigt'}
                      </Badge>
                    </div>
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <p className="text-muted-foreground">Format</p>
                          <p className="font-medium capitalize">{activeInterview.meeting_format || activeInterview.meeting_type || '—'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Dauer</p>
                          <p className="font-medium">{activeInterview.duration_minutes || '—'} Min</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-medium capitalize">{activeInterview.status?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      {activeInterview.scheduled_at && (
                        <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                          <Calendar className="h-4 w-4 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-700 dark:text-green-400">
                              {format(new Date(activeInterview.scheduled_at), 'EEEE, d. MMMM · HH:mm', { locale: de })}
                            </p>
                          </div>
                        </div>
                      )}
                      {(activeInterview.teams_join_url || activeInterview.google_meet_link || activeInterview.meeting_link) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => window.open(
                            activeInterview.teams_join_url || activeInterview.google_meet_link || activeInterview.meeting_link,
                            '_blank'
                          )}
                        >
                          <Video className="h-3.5 w-3.5 mr-1.5" />
                          Meeting beitreten
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Notizen
                  </div>
                  {submission.recruiter_notes && (
                    <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5 max-h-24 overflow-y-auto">
                      {submission.recruiter_notes}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Notiz hinzufügen..."
                      value={recruiterNote}
                      onChange={(e) => setRecruiterNote(e.target.value)}
                      className="text-sm min-h-[50px] resize-none"
                      rows={2}
                    />
                    {recruiterNote.trim() && (
                      <Button
                        size="sm"
                        className="shrink-0 self-end"
                        onClick={handleSaveNote}
                        disabled={savingNote}
                      >
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
                      Email
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

            {/* RIGHT: Context Panel */}
            <div className="w-full md:w-[300px] shrink-0 overflow-y-auto bg-muted/20">
              <div className="p-4 space-y-4">
                {/* Candidate */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <User className="h-3.5 w-3.5" />
                    Kandidat
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{candidate?.full_name || 'Unbekannt'}</p>
                    {candidate?.job_title && (
                      <p className="text-xs text-muted-foreground">{candidate.job_title}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {candidate?.city && (
                        <span className="flex items-center gap-1">
                          <span>📍</span>
                          {candidate.city}
                        </span>
                      )}
                      {candidate?.experience_years && (
                        <span>{candidate.experience_years}J Erfahrung</span>
                      )}
                      {candidate?.expected_salary && (
                        <span>Gehalt: {Math.round(candidate.expected_salary / 1000)}K</span>
                      )}
                    </div>
                    {candidate?.phone && (
                      <p className="text-xs text-muted-foreground">{candidate.phone}</p>
                    )}
                    {candidate?.email && (
                      <p className="text-xs text-muted-foreground truncate">{candidate.email}</p>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Job */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Briefcase className="h-3.5 w-3.5" />
                    Job
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium">{job?.title || 'Unbekannt'}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {companyRevealed ? (
                        <Unlock className="h-3 w-3 text-green-500" />
                      ) : (
                        <Shield className="h-3 w-3" />
                      )}
                      {companyDisplay}
                    </div>
                  </div>
                </div>

                <div className="border-t" />

                {/* Timeline */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Clock className="h-3.5 w-3.5" />
                    Timeline
                  </div>
                  {uniqueTimeline.length > 0 ? (
                    <div>
                      {uniqueTimeline.slice(0, 8).map((item, idx) => {
                        const iconInfo = getActivityIcon(item.type);
                        return (
                          <TimelineItem
                            key={`${item.time}-${idx}`}
                            title={item.title}
                            description={item.description}
                            time={item.time}
                            icon={iconInfo.icon}
                            iconColor={iconInfo.color}
                            isLast={idx === Math.min(uniqueTimeline.length, 8) - 1}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Noch keine Aktivitäten.</p>
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

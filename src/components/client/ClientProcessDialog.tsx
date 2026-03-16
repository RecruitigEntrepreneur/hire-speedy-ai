import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Star,
  Clock,
  Calendar,
  Briefcase,
  MapPin,
  User,
  FileText,
  MessageSquare,
  Send,
  TrendingUp,
  Save,
  Loader2,
  Check,
  ShieldCheck,
  ExternalLink,
  GraduationCap,
  DollarSign,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  city: string | null;
  expected_salary: number | null;
  current_salary: number | null;
  availability_date: string | null;
  notice_period: string | null;
  experience_years: number | null;
  skills: string[] | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  cv_url: string | null;
  summary: string | null;
  seniority: string | null;
}

interface Submission {
  id: string;
  stage: string;
  status: string | null;
  match_score: number | null;
  submitted_at: string;
  recruiter_notes: string | null;
  candidate: Candidate;
  recruiter?: {
    full_name: string | null;
    email: string;
  } | null;
}

interface ClientProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submission: Submission | null;
  jobTitle?: string;
  onScheduleInterview: (submission: Submission) => void;
  onReject: (submission: Submission) => void;
  onStageChange: (submissionId: string, newStage: string) => void;
}

// ── Stage Pipeline ─────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Eingereicht' },
  { key: 'screening', label: 'Screening' },
  { key: 'shortlisted', label: 'Shortlisted' },
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
          <Tooltip key={stage.key}>
            <TooltipTrigger asChild>
              <div className="flex flex-col items-center flex-1">
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
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {stage.label}
              {isActive && ' (aktuell)'}
              {isPassed && ' ✓'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ── Helper: Anonymous ID ───────────────────────────────────────────

function generateAnonymousId(submissionId: string, jobTitle?: string): string {
  const prefix = jobTitle?.slice(0, 2).toUpperCase() || 'XX';
  return `${prefix}-${submissionId.slice(0, 4).toUpperCase()}`;
}

// ── Helper: Activity Icons ─────────────────────────────────────────

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
    case 'stage_changed':
      return { icon: TrendingUp, color: 'text-violet-600 bg-violet-500/10 border-violet-500/20' };
    case 'note_added':
      return { icon: MessageSquare, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' };
    default:
      return { icon: Clock, color: 'text-muted-foreground bg-muted border-border' };
  }
}

// ── Helper Components ──────────────────────────────────────────────

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

// ── Main Dialog ────────────────────────────────────────────────────

export function ClientProcessDialog({
  open,
  onOpenChange,
  submission,
  jobTitle,
  onScheduleInterview,
  onReject,
  onStageChange,
}: ClientProcessDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [clientNote, setClientNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Fetch interviews + timeline for this submission
  const { data: extraData, isLoading: loadingExtra, refetch } = useQuery({
    queryKey: ['client-process-dialog', submission?.id],
    queryFn: async () => {
      if (!submission?.id) throw new Error('No submission');

      const [interviewsResult, activitiesResult] = await Promise.all([
        supabase
          .from('interviews')
          .select('*')
          .eq('submission_id', submission.id)
          .order('scheduled_at', { ascending: false }),
        supabase
          .from('candidate_activity_log')
          .select('*')
          .eq('related_submission_id', submission.id)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      return {
        interviews: interviewsResult.data || [],
        activities: activitiesResult.data || [],
      };
    },
    enabled: !!submission?.id && open,
  });

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setClientNote('');
      setActiveTab('overview');
    }
  }, [open]);

  const handleSaveNote = async () => {
    if (!clientNote.trim() || !submission) return;
    setSavingNote(true);
    try {
      const existing = submission.recruiter_notes || '';
      const newNote = existing
        ? `${existing}\n\n[Client ${format(new Date(), 'd.M.yyyy HH:mm')}] ${clientNote}`
        : `[Client ${format(new Date(), 'd.M.yyyy HH:mm')}] ${clientNote}`;

      const { error } = await supabase
        .from('submissions')
        .update({ recruiter_notes: newNote })
        .eq('id', submission.id);

      if (error) throw error;
      setClientNote('');
      refetch();
      toast.success('Notiz gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingNote(false);
    }
  };

  if (!submission) return null;

  const { candidate } = submission;
  const anonymousId = generateAnonymousId(submission.id, jobTitle);
  const score = submission.match_score || 0;
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-muted-foreground';

  const interviews = extraData?.interviews || [];
  const activities = extraData?.activities || [];

  // Build timeline
  const timelineItems: { title: string; description?: string | null; time: string; type: string }[] = [];
  activities.forEach((a: any) => {
    timelineItems.push({ title: a.title, description: a.description, time: a.created_at, type: a.activity_type });
  });
  if (!timelineItems.some(t => t.type === 'submission_created' || t.type === 'candidate_submitted')) {
    timelineItems.push({
      title: 'Kandidat eingereicht',
      description: `Für "${jobTitle}"`,
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

  const scheduledInterviews = interviews.filter((iv: any) =>
    iv.status === 'scheduled' || iv.status === 'pending_response'
  );
  const pastInterviews = interviews.filter((iv: any) =>
    iv.status === 'completed' || iv.status === 'cancelled'
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[85vh] p-0 gap-0 overflow-hidden">
        {loadingExtra && !extraData ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row h-full max-h-[85vh]">
            {/* LEFT: Main Content */}
            <div className="flex-1 flex flex-col min-w-0 md:border-r">
              {/* Header */}
              <div className="p-5 pb-4 border-b space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Star className="h-4 w-4 text-amber-500 shrink-0" />
                      <h2 className="font-mono font-bold text-lg leading-tight">{anonymousId}</h2>
                      {score > 0 && (
                        <Badge variant="outline" className={cn('text-xs shrink-0 font-bold', scoreColor)}>
                          Match {score}%
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] shrink-0"
                      >
                        {PIPELINE_STAGES.find(s => s.key === submission.stage)?.label || submission.stage}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {candidate.seniority || 'Kandidat'}
                      {candidate.experience_years ? ` · ${candidate.experience_years} Jahre Erfahrung` : ''}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {candidate.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {candidate.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(submission.submitted_at), { locale: de, addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>

                <StagePipeline currentStage={submission.stage} />
              </div>

              {/* Tabs */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                <TabsList className="w-full justify-start px-5 pt-2 pb-0 bg-transparent border-b rounded-none h-auto">
                  <TabsTrigger value="overview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-xs">
                    Übersicht
                  </TabsTrigger>
                  <TabsTrigger value="interview" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-xs">
                    Interview ({interviews.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 text-xs">
                    Notizen
                  </TabsTrigger>
                </TabsList>

                {/* Scrollable tab content */}
                <div className="flex-1 overflow-y-auto">
                  {/* ── Overview Tab ── */}
                  <TabsContent value="overview" className="mt-0 p-5 space-y-4">
                    {/* Skills */}
                    {candidate.skills && candidate.skills.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <Zap className="h-3.5 w-3.5" />
                          Skills
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {candidate.skills.map((skill, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Key Facts Grid */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <FileText className="h-3.5 w-3.5" />
                        Kennzahlen
                      </div>
                      <div className="rounded-lg border bg-card p-3 grid grid-cols-3 gap-4">
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Erfahrung</p>
                          <p className="text-sm font-medium">
                            {candidate.experience_years ? `${candidate.experience_years} Jahre` : '—'}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Seniority</p>
                          <p className="text-sm font-medium capitalize">{candidate.seniority || '—'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Gehaltsvorstellung</p>
                          <p className="text-sm font-medium">
                            {candidate.expected_salary ? `€${Math.round(candidate.expected_salary / 1000)}k` : '—'}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Standort</p>
                          <p className="text-sm font-medium">{candidate.city || '—'}</p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Verfügbarkeit</p>
                          <p className="text-sm font-medium">
                            {candidate.availability_date
                              ? format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })
                              : candidate.notice_period || '—'}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-[11px] text-muted-foreground">Match Score</p>
                          <div className="flex items-center gap-2">
                            {score > 0 ? (
                              <>
                                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-muted-foreground'
                                    )}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                                <span className={cn('text-sm font-bold', scoreColor)}>{score}%</span>
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recruiter Assessment */}
                    {candidate.summary && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <GraduationCap className="h-3.5 w-3.5" />
                          Recruiter-Einschätzung
                        </div>
                        <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
                          {candidate.summary}
                        </div>
                      </div>
                    )}

                    {/* Recruiter Notes (readonly) */}
                    {submission.recruiter_notes && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Recruiter-Notizen
                        </div>
                        <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5 max-h-24 overflow-y-auto">
                          {submission.recruiter_notes}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Interview Tab ── */}
                  <TabsContent value="interview" className="mt-0 p-5 space-y-4">
                    {/* Scheduled Interviews */}
                    {scheduledInterviews.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <Calendar className="h-3.5 w-3.5" />
                          Geplante Interviews
                        </div>
                        {scheduledInterviews.map((iv: any) => (
                          <div key={iv.id} className="rounded-lg border bg-card p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-green-600" />
                                <span className="text-sm font-medium">
                                  {iv.scheduled_at
                                    ? format(new Date(iv.scheduled_at), "EEEE, d. MMMM · HH:mm", { locale: de })
                                    : 'Termin ausstehend'}
                                </span>
                              </div>
                              <Badge variant="outline" className={cn(
                                'text-[10px]',
                                iv.status === 'scheduled' ? 'text-green-600 border-green-500/30' : 'text-amber-600 border-amber-500/30'
                              )}>
                                {iv.status === 'scheduled' ? 'Bestätigt' : 'Ausstehend'}
                              </Badge>
                            </div>
                            {iv.duration_minutes && (
                              <p className="text-xs text-muted-foreground">
                                Dauer: {iv.duration_minutes} Min · {iv.meeting_format || iv.meeting_type || 'Online'}
                              </p>
                            )}
                            {(iv.teams_join_url || iv.google_meet_link || iv.meeting_link) && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => window.open(
                                  iv.teams_join_url || iv.google_meet_link || iv.meeting_link,
                                  '_blank'
                                )}
                              >
                                Meeting beitreten
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Noch kein Interview geplant</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-3 text-xs"
                          onClick={() => onScheduleInterview(submission)}
                        >
                          <Calendar className="h-3.5 w-3.5 mr-1.5" />
                          Interview anfragen
                        </Button>
                      </div>
                    )}

                    {/* Past Interviews */}
                    {pastInterviews.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          <Clock className="h-3.5 w-3.5" />
                          Vergangene Interviews
                        </div>
                        {pastInterviews.map((iv: any) => (
                          <div key={iv.id} className="rounded-lg border bg-card p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">
                                {iv.scheduled_at
                                  ? format(new Date(iv.scheduled_at), 'd. MMM yyyy, HH:mm', { locale: de })
                                  : '—'}
                              </span>
                              <Badge variant={iv.status === 'completed' ? 'default' : 'secondary'} className="text-[10px]">
                                {iv.status === 'completed' ? 'Abgeschlossen' : 'Abgesagt'}
                              </Badge>
                            </div>
                            {iv.feedback && (
                              <p className="text-xs text-muted-foreground mt-2">{iv.feedback}</p>
                            )}
                            {iv.rating && (
                              <div className="flex items-center gap-1 mt-1.5 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star key={i} className={cn('h-3 w-3', i < iv.rating ? 'fill-current' : 'opacity-30')} />
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Notes Tab ── */}
                  <TabsContent value="notes" className="mt-0 p-5 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Ihre Notizen
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Interne Notizen zu diesem Kandidaten. Nur für Sie sichtbar.
                      </p>
                    </div>

                    {submission.recruiter_notes && (
                      <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-3 max-h-40 overflow-y-auto">
                        {submission.recruiter_notes}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Notiz hinzufügen..."
                        value={clientNote}
                        onChange={(e) => setClientNote(e.target.value)}
                        className="text-sm min-h-[60px] resize-none"
                        rows={3}
                      />
                      {clientNote.trim() && (
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
                  </TabsContent>
                </div>
              </Tabs>

              {/* Sticky Action Bar */}
              <div className="border-t p-3 flex items-center gap-2 bg-card shrink-0">
                <Button
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => onScheduleInterview(submission)}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Interview anfragen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                  onClick={() => onReject(submission)}
                >
                  Ablehnen
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={() => {
                    onOpenChange(false);
                    // Navigate to full candidate detail
                  }}
                >
                  Kandidatenprofil
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* RIGHT: Context Panel */}
            <div className="w-full md:w-[280px] shrink-0 overflow-y-auto bg-muted/20">
              <div className="p-4 space-y-4">
                {/* Candidate Quick Info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <User className="h-3.5 w-3.5" />
                    Kandidat
                  </div>
                  <div className="space-y-1.5">
                    <p className="font-mono font-semibold text-sm">{anonymousId}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {candidate.seniority && (
                        <span className="capitalize">{candidate.seniority}</span>
                      )}
                      {candidate.experience_years && (
                        <span>{candidate.experience_years}J Erfahrung</span>
                      )}
                      {candidate.city && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-2.5 w-2.5" />
                          {candidate.city}
                        </span>
                      )}
                    </div>
                    {candidate.expected_salary && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <DollarSign className="h-2.5 w-2.5" />
                        Gehaltsvorstellung: €{Math.round(candidate.expected_salary / 1000)}k
                      </p>
                    )}
                    {(candidate.availability_date || candidate.notice_period) && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {candidate.availability_date
                          ? `Ab ${format(new Date(candidate.availability_date), 'dd.MM.yyyy', { locale: de })}`
                          : `Kündigungsfrist: ${candidate.notice_period}`}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t" />

                {/* Match Details */}
                {score > 0 && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <Star className="h-3.5 w-3.5" />
                        Match
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-muted-foreground/15 overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-muted-foreground'
                            )}
                            style={{ width: `${score}%` }}
                          />
                        </div>
                        <span className={cn('text-lg font-bold', scoreColor)}>{score}%</span>
                      </div>
                    </div>
                    <div className="border-t" />
                  </>
                )}

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

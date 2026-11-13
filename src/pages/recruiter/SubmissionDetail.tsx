import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Shield,
  Unlock,
  Lock,
  Clock,
  Calendar,
  Video,
  Phone,
  Mail,
  FileText,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Check,
  Send,
  User,
  Briefcase,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  Loader2,
  Plus,
  Save,
} from 'lucide-react';
import { formatSimpleAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { format, formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/components/recruiter/termin/datum';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

// ─── Stage Pipeline ────────────────────────────────────────────────
// Anzeige je Stufe: recruiterSubmissions → detail.stages.<key>
const PIPELINE_STAGES = [
  { key: 'new' },
  { key: 'submitted' },
  { key: 'screening' },
  { key: 'interview_requested' },
  { key: 'candidate_opted_in' },
  { key: 'interview' },
  { key: 'offer' },
  { key: 'hired' },
] as const;

function getStageIndex(stage: string | null): number {
  // Map interview sub-stages
  if (stage === 'interview_scheduled' || stage === 'interview_counter_proposed') return 5;
  if (stage === 'interview_declined') return 3;
  const idx = PIPELINE_STAGES.findIndex(s => s.key === stage);
  return idx >= 0 ? idx : 0;
}

function FullStagePipeline({ currentStage }: { currentStage: string | null }) {
  const { t } = useTranslation('recruiterSubmissions');
  const currentIdx = getStageIndex(currentStage);

  return (
    <div className="flex items-center gap-1 w-full">
      {PIPELINE_STAGES.map((stage, idx) => {
        const isActive = idx === currentIdx;
        const isPassed = idx < currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={stage.key} className="flex items-center gap-1 flex-1">
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
                {t(`detail.stages.${stage.key}`)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper Components ─────────────────────────────────────────────

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
  const { t, i18n } = useTranslation('recruiterSubmissions');
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
          {format(new Date(time), t('detail.fmt.dateTime'), { locale: dateFnsLocale(i18n.language) })}
        </p>
      </div>
    </div>
  );
}

const ALERT_ICON_MAP: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertCircle, color: 'text-destructive bg-destructive/10 border-destructive/20' },
  high: { icon: AlertTriangle, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  medium: { icon: Clock, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  low: { icon: Clock, color: 'text-muted-foreground bg-muted border-border' },
};

// ─── Activity type to icon/color mapping ───────────────────────────
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

// ─── Main Component ────────────────────────────────────────────────

export default function SubmissionDetail() {
  const { t, i18n } = useTranslation('recruiterSubmissions');
  const locale = dateFnsLocale(i18n.language);
  const { submissionId } = useParams<{ submissionId: string }>();
  // ?interview=<id> kommt aus Agenda und Benachrichtigungen und benennt den
  // Termin, auf den geklickt wurde. Ohne ihn muss die Seite raten — bei
  // mehreren Interview-Zeilen pro Einreichung war das nachweislich der falsche.
  const [searchParams] = useSearchParams();
  const focusInterviewId = searchParams.get('interview');
  const [recruiterNote, setRecruiterNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // ── Fetch submission with all related data ──
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['submission-detail', submissionId],
    queryFn: async () => {
      if (!submissionId) throw new Error('No submission ID');

      // Fetch submission with candidate + job
      const { data: submission, error: subErr } = await supabase
        .from('submissions')
        .select(`
          *,
          candidates(id, full_name, email, phone, job_title, city, linkedin_url)
        `)
        .eq('id', submissionId)
        .single();

      if (subErr) throw subErr;

      // Job separat ueber recruiter_jobs_view: maskiert die Firmenidentitaet
      // und gibt company_name/description erst nach dem Reveal frei.
      if (submission?.job_id) {
        const { data: jobRow } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title, company_name, industry, description')
          .eq('id', submission.job_id)
          .maybeSingle();
        (submission as any).jobs = jobRow ?? null;
      }

      // Fetch interviews for this submission
      const { data: interviews } = await supabase
        .from('interviews')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      // Fetch activity log
      const { data: activities } = await supabase
        .from('candidate_activity_log')
        .select('*')
        .eq('related_submission_id', submissionId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch alerts for this submission
      const { data: alerts } = await supabase
        .from('influence_alerts')
        .select('*')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      return {
        submission,
        interviews: interviews || [],
        activities: activities || [],
        alerts: alerts || [],
      };
    },
    enabled: !!submissionId,
  });

  // ── Save recruiter note ──
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
      toast.success(t('detail.noteSaved'));
    } catch {
      toast.error(t('detail.saveFailed'));
    } finally {
      setSavingNote(false);
    }
  };

  // ── Mark alert done ──
  const handleMarkAlertDone = async (alertId: string) => {
    try {
      await supabase
        .from('influence_alerts')
        .update({ action_taken: 'marked_done', action_taken_at: new Date().toISOString(), is_read: true })
        .eq('id', alertId);
      refetch();
      toast.success(t('detail.done'));
    } catch {
      toast.error(t('detail.error'));
    }
  };

  // ── Loading / Error states ──
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data?.submission) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Link to=".." className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            {t('detail.back')}
          </Link>
          <p className="text-destructive">{t('detail.notFound')}</p>
        </div>
      </DashboardLayout>
    );
  }

  const { submission, interviews, activities, alerts } = data;
  const candidate = submission.candidates as any;
  // jobs wird oben zur Laufzeit aus recruiter_jobs_view angehaengt (Zeile 218) —
  // die Query-Typen kennen die Spalte deshalb nicht.
  const job = (submission as any).jobs;

  const companyRevealed = !!submission.company_revealed;
  const identityUnlocked = !!submission.identity_unlocked;
  const companyDisplay = companyRevealed
    ? job?.company_name
    : formatSimpleAnonymousCompany(job?.industry);

  // Vorrang hat immer der explizit adressierte Termin. Der find-Fallback greift
  // nur ohne Deeplink und kann bei mehreren Zeilen den falschen erwischen.
  const activeInterview =
    (focusInterviewId && interviews.find((iv: any) => iv.id === focusInterviewId)) ||
    interviews.find(
      (iv: any) => iv.status === 'pending_response' || iv.status === 'scheduled'
    );

  const pendingAlerts = alerts.filter((a: any) => !a.action_taken);
  const doneAlerts = alerts.filter((a: any) => !!a.action_taken);

  const isAwaitingOptIn = submission.stage === 'interview_requested';

  // Build combined timeline from activities + key submission events
  const timelineItems: { title: string; description?: string | null; time: string; type: string }[] = [];

  // Add activities
  activities.forEach((a: any) => {
    timelineItems.push({
      title: a.title,
      description: a.description,
      time: a.created_at,
      type: a.activity_type,
    });
  });

  // Add submission creation if no activity for it
  if (!timelineItems.some(t => t.type === 'submission_created' || t.type === 'candidate_submitted')) {
    timelineItems.push({
      title: t('detail.timeline.submitted'),
      description: t('detail.timeline.submittedFor', { job: job?.title, company: companyDisplay }),
      time: submission.submitted_at,
      type: 'candidate_submitted',
    });
  }

  // Add interview events from interview records
  interviews.forEach((iv: any) => {
    if (iv.status === 'pending_response' && !timelineItems.some(t => t.type === 'interview_invitation_sent' && t.time === iv.created_at)) {
      timelineItems.push({
        title: t('detail.timeline.inviteSent'),
        description: t('detail.timeline.inviteDesc', { format: iv.meeting_format || 'Video', minutes: iv.duration_minutes || 30, count: (iv.proposed_slots as any[])?.length || 0 }),
        time: iv.created_at,
        type: 'interview_invitation_sent',
      });
    }
    if (iv.status === 'scheduled' && iv.scheduled_at) {
      timelineItems.push({
        title: t('detail.timeline.confirmed'),
        description: t('detail.timeline.date', { date: format(new Date(iv.scheduled_at), t('detail.fmt.weekdayDateTime'), { locale }) }),
        time: iv.candidate_confirmed_at || iv.updated_at || iv.created_at,
        type: 'interview_scheduled',
      });
    }
  });

  // Add alert creations
  alerts.forEach((a: any) => {
    if (!timelineItems.some(t => t.time === a.created_at && t.title === a.title)) {
      timelineItems.push({
        title: t('detail.timeline.alert', { title: a.title }),
        description: a.message,
        time: a.created_at,
        type: 'alert_created',
      });
    }
  });

  // Sort by time descending
  timelineItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  // Deduplicate by keeping unique titles within same minute
  const seen = new Set<string>();
  const uniqueTimeline = timelineItems.filter(item => {
    const key = `${item.title}::${item.time.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // ── Render ──
  return (
    <DashboardLayout>
    <div className="space-y-4 pb-20">
      {/* Back link */}
      <Link
        to={candidate ? `/recruiter/candidates/${candidate.id}` : '/recruiter/submissions'}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {candidate?.full_name ? t('detail.backTo', { name: candidate.full_name }) : t('detail.backToCandidates')}
      </Link>

      {/* ── Header Card ── */}
      <Card>
        <CardContent className="p-4 md:p-5 space-y-4">
          {/* Top: Company + Job + Meta */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {companyRevealed ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1.5 text-green-600">
                        <Unlock className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('detail.unlockedTip')}</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>{t('detail.tripleBlind')}</TooltipContent>
                  </Tooltip>
                )}
                <h1 className="text-lg font-bold truncate">{companyDisplay}</h1>
                {submission.match_score && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {t('detail.match', { score: submission.match_score })}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{job?.title || t('detail.unknownJob')}</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {candidate?.full_name}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t('detail.submittedAgo', { time: formatDistanceToNow(new Date(submission.submitted_at), { locale, addSuffix: true }) })}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {candidate?.phone && (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={`tel:${candidate.phone}`}><Phone className="h-3.5 w-3.5" /></a>
                </Button>
              )}
              {candidate?.email && (
                <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                  <a href={`mailto:${candidate.email}`}><Mail className="h-3.5 w-3.5" /></a>
                </Button>
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" asChild>
                <Link to={`/recruiter/jobs/${job?.id}`}><Briefcase className="h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>

          {/* Stage Pipeline */}
          <FullStagePipeline currentStage={submission.stage} />

          {/* Opt-In CTA Banner */}
          {isAwaitingOptIn && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('detail.optIn.title')}</p>
                <p className="text-xs text-muted-foreground">{t('detail.optIn.text')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* ── Left Column: Details, Notes, Alerts ── */}
        <div className="space-y-4">
          {/* Details Card */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t('detail.rows.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 divide-y">
              <DetailRow label={t('detail.rows.status')}>
                <Badge variant="outline" className="text-xs">{submission.status || '—'}</Badge>
              </DetailRow>
              <DetailRow label={t('detail.rows.stage')}>
                <Badge variant="outline" className="text-xs">{submission.stage || 'new'}</Badge>
              </DetailRow>
              <DetailRow label={t('detail.rows.matchScore')}>
                {submission.match_score ? (
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${submission.match_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium">{submission.match_score}%</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </DetailRow>
              <DetailRow label={t('detail.rows.optIn')}>
                {submission.opt_in_response ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                    {submission.opt_in_response}
                  </Badge>
                ) : isAwaitingOptIn ? (
                  <span className="text-xs text-amber-600 font-medium">{t('detail.rows.pending')}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </DetailRow>
              <DetailRow label={t('detail.rows.companyVisible')}>
                {companyRevealed ? (
                  <span className="text-xs text-green-600 flex items-center gap-1"><Unlock className="h-3 w-3" /> {t('detail.rows.yes')}</span>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> {t('detail.rows.no')}</span>
                )}
              </DetailRow>
              <DetailRow label={t('detail.rows.identityUnlocked')}>
                {identityUnlocked ? (
                  <span className="text-xs text-green-600 flex items-center gap-1"><Unlock className="h-3 w-3" /> {t('detail.rows.yes')}</span>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> {t('detail.rows.no')}</span>
                )}
              </DetailRow>
              <DetailRow label={t('detail.rows.consent')}>
                {submission.consent_confirmed ? (
                  <span className="text-xs text-green-600">{t('detail.rows.confirmed')}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('detail.rows.pending')}</span>
                )}
              </DetailRow>
              <DetailRow label={t('detail.rows.submitted')}>
                <span className="text-xs">{format(new Date(submission.submitted_at), t('detail.fmt.dateTime'), { locale })}</span>
              </DetailRow>
              <DetailRow label={t('detail.rows.lastUpdate')}>
                <span className="text-xs">{format(new Date(submission.updated_at), t('detail.fmt.dateTime'), { locale })}</span>
              </DetailRow>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                {t('detail.notes.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* Existing recruiter notes */}
              {submission.recruiter_notes ? (
                <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5">
                  {submission.recruiter_notes}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">{t('detail.notes.none')}</p>
              )}

              {/* Add note */}
              <div className="flex gap-2">
                <Textarea
                  placeholder={t('detail.notes.placeholder')}
                  value={recruiterNote}
                  onChange={(e) => setRecruiterNote(e.target.value)}
                  className="text-xs min-h-[60px]"
                  rows={2}
                />
              </div>
              {recruiterNote.trim() && (
                <Button size="sm" onClick={handleSaveNote} disabled={savingNote} className="w-full">
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  {t('detail.notes.save')}
                </Button>
              )}

              {/* Client notes */}
              {submission.client_notes && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t('detail.notes.client')}</p>
                  <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5">
                    {typeof submission.client_notes === 'string'
                      ? (() => {
                          try {
                            const parsed = JSON.parse(submission.client_notes);
                            if (parsed.pending_interview_request) {
                              const req = parsed.pending_interview_request;
                              return (
                                <div className="space-y-1">
                                  <p className="font-medium">{t('detail.notes.request', { status: req.status })}</p>
                                  {req.client_message && <p>{req.client_message}</p>}
                                  {req.client_time_slots && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(req.client_time_slots as string[]).map((slot: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px]">
                                          {format(new Date(slot), t('detail.fmt.slotShort'), { locale })}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) as any;
                            }
                            return JSON.stringify(parsed, null, 2);
                          } catch {
                            return submission.client_notes;
                          }
                        })()
                      : String(submission.client_notes)
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerts Card */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {t('detail.alerts.title', { count: pendingAlerts.length })}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                {pendingAlerts.map((alert: any) => {
                  const config = ALERT_ICON_MAP[alert.priority] || ALERT_ICON_MAP.low;
                  const AlertIcon = config.icon;
                  return (
                    <div key={alert.id} className="flex items-start gap-2 p-2 rounded-md border">
                      <div className={cn('p-1 rounded', config.color.split(' ').slice(1).join(' '))}>
                        <AlertIcon className={cn('h-3.5 w-3.5', config.color.split(' ')[0])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{alert.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{alert.recommended_action}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-green-600 hover:text-green-700 shrink-0"
                        onClick={() => handleMarkAlertDone(alert.id)}
                      >
                        <Check className="h-3 w-3 mr-0.5" />
                        {t('detail.alerts.done')}
                      </Button>
                    </div>
                  );
                })}
                {doneAlerts.length > 0 && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {t('detail.alerts.doneCount', { count: doneAlerts.length })}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Right Column: Timeline + Interview ── */}
        <div className="space-y-4">
          {/* Interview Card (if exists) */}
          {activeInterview && (
            <Card className={cn(
              activeInterview.status === 'pending_response' && 'border-amber-500/30',
              activeInterview.status === 'scheduled' && 'border-green-500/30',
            )}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {t('detail.interview.title')}
                  <Badge variant="outline" className={cn(
                    'text-[10px] ml-auto',
                    activeInterview.status === 'pending_response' && 'text-amber-600 border-amber-500/30',
                    activeInterview.status === 'scheduled' && 'text-green-600 border-green-500/30',
                  )}>
                    {activeInterview.status === 'pending_response' ? t('detail.interview.waiting') : t('detail.interview.confirmed')}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t('detail.interview.format')}</p>
                    <p className="font-medium capitalize">{activeInterview.meeting_format || activeInterview.meeting_type || '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('detail.interview.duration')}</p>
                    <p className="font-medium">{t('detail.interview.minutes', { value: activeInterview.duration_minutes || '—' })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('detail.interview.status')}</p>
                    <p className="font-medium capitalize">{activeInterview.status?.replace(/_/g, ' ')}</p>
                  </div>
                </div>

                {/* Proposed slots */}
                {activeInterview.proposed_slots && (activeInterview.proposed_slots as any[]).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">{t('detail.interview.slots')}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeInterview.proposed_slots as any[]).map((slot: any, i: number) => (
                        <Badge
                          key={i}
                          variant={slot.status === 'selected' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(slot.datetime), t('detail.fmt.slot'), { locale })}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled time */}
                {activeInterview.scheduled_at && (
                  <div className="flex items-center gap-2 p-2.5 rounded-md bg-green-500/10 border border-green-500/20">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-green-700 dark:text-green-400">
                        {format(new Date(activeInterview.scheduled_at), t('detail.fmt.full'), { locale })}
                      </p>
                      <p className="text-xs text-muted-foreground">{t('detail.interview.scheduledMeta', { minutes: activeInterview.duration_minutes, format: activeInterview.meeting_format })}</p>
                    </div>
                  </div>
                )}

                {/* Client message */}
                {activeInterview.client_message && (
                  <div className="text-xs bg-muted/50 rounded-md p-2.5 border-l-2 border-primary/30">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{t('detail.interview.clientMessage')}</p>
                    <p className="italic">"{activeInterview.client_message}"</p>
                  </div>
                )}

                {/* Meeting link */}
                {(activeInterview.meeting_link || activeInterview.teams_join_url || activeInterview.google_meet_link) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.open(
                      activeInterview.teams_join_url || activeInterview.google_meet_link || activeInterview.meeting_link,
                      '_blank'
                    )}
                  >
                    <Video className="h-3.5 w-3.5 mr-1.5" />
                    {t('detail.interview.join')}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Timeline Card */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t('detail.timeline.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-2">
              {uniqueTimeline.length > 0 ? (
                <div>
                  {uniqueTimeline.map((item, idx) => {
                    const iconInfo = getActivityIcon(item.type);
                    return (
                      <TimelineItem
                        key={`${item.time}-${idx}`}
                        title={item.title}
                        description={item.description}
                        time={item.time}
                        icon={iconInfo.icon}
                        iconColor={iconInfo.color}
                        isLast={idx === uniqueTimeline.length - 1}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('detail.timeline.none')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

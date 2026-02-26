import { useParams, Link } from 'react-router-dom';
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
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

// ─── Stage Pipeline ────────────────────────────────────────────────
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
  // Map interview sub-stages
  if (stage === 'interview_scheduled' || stage === 'interview_counter_proposed') return 5;
  if (stage === 'interview_declined') return 3;
  const idx = PIPELINE_STAGES.findIndex(s => s.key === stage);
  return idx >= 0 ? idx : 0;
}

function FullStagePipeline({ currentStage }: { currentStage: string | null }) {
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
                {stage.label}
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
          {format(new Date(time), "d. MMM yyyy, HH:mm", { locale: de })}
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
  const { submissionId } = useParams<{ submissionId: string }>();
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
          candidates(id, full_name, email, phone, job_title, city, linkedin_url),
          jobs(id, title, company_name, industry, description)
        `)
        .eq('id', submissionId)
        .single();

      if (subErr) throw subErr;

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
      toast.success('Notiz gespeichert');
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSavingNote(false);
    }
  };

  // ── Handle opt-in confirm ──
  const handleConfirmOptIn = async () => {
    if (!submissionId) return;
    try {
      await supabase
        .from('submissions')
        .update({ stage: 'candidate_opted_in' })
        .eq('id', submissionId);

      // Mark related alert as actioned
      const optInAlert = data?.alerts?.find(
        a => a.alert_type === 'opt_in_pending' && !a.action_taken
      );
      if (optInAlert) {
        await supabase
          .from('influence_alerts')
          .update({ action_taken: 'opt_in_confirmed', action_taken_at: new Date().toISOString(), is_read: true })
          .eq('id', optInAlert.id);
      }

      refetch();
      toast.success('Opt-In bestätigt');
    } catch {
      toast.error('Fehler beim Bestätigen');
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
      toast.success('Erledigt');
    } catch {
      toast.error('Fehler');
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
            Zurück
          </Link>
          <p className="text-destructive">Einreichung nicht gefunden.</p>
        </div>
      </DashboardLayout>
    );
  }

  const { submission, interviews, activities, alerts } = data;
  const candidate = submission.candidates as any;
  const job = submission.jobs as any;

  const companyRevealed = !!submission.company_revealed;
  const identityUnlocked = !!submission.identity_unlocked;
  const companyDisplay = companyRevealed
    ? job?.company_name
    : formatSimpleAnonymousCompany(job?.industry);

  const activeInterview = interviews.find(
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
      title: 'Kandidat eingereicht',
      description: `Für "${job?.title}" bei ${companyDisplay}`,
      time: submission.submitted_at,
      type: 'candidate_submitted',
    });
  }

  // Add interview events from interview records
  interviews.forEach((iv: any) => {
    if (iv.status === 'pending_response' && !timelineItems.some(t => t.type === 'interview_invitation_sent' && t.time === iv.created_at)) {
      timelineItems.push({
        title: 'Interview-Einladung gesendet',
        description: `${iv.meeting_format || 'Video'} · ${iv.duration_minutes || 30} Min · ${(iv.proposed_slots as any[])?.length || 0} Terminvorschläge`,
        time: iv.created_at,
        type: 'interview_invitation_sent',
      });
    }
    if (iv.status === 'scheduled' && iv.scheduled_at) {
      timelineItems.push({
        title: 'Interview bestätigt',
        description: `Termin: ${format(new Date(iv.scheduled_at), 'EEE d. MMM, HH:mm', { locale: de })}`,
        time: iv.candidate_confirmed_at || iv.updated_at || iv.created_at,
        type: 'interview_scheduled',
      });
    }
  });

  // Add alert creations
  alerts.forEach((a: any) => {
    if (!timelineItems.some(t => t.time === a.created_at && t.title === a.title)) {
      timelineItems.push({
        title: `Alert: ${a.title}`,
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
        Zurück zu {candidate?.full_name || 'Kandidaten'}
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
                    <TooltipContent>Identitäten freigeschaltet</TooltipContent>
                  </Tooltip>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Triple-Blind aktiv</TooltipContent>
                  </Tooltip>
                )}
                <h1 className="text-lg font-bold truncate">{companyDisplay}</h1>
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
                  Eingereicht {formatDistanceToNow(new Date(submission.submitted_at), { locale: de, addSuffix: true })}
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
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Wartet auf Kandidaten-Opt-In</p>
                <p className="text-xs text-muted-foreground">Kontaktieren Sie den Kandidaten und holen Sie die Zustimmung ein.</p>
              </div>
              <Button size="sm" onClick={handleConfirmOptIn}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                Opt-In bestätigen
              </Button>
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
                Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 divide-y">
              <DetailRow label="Status">
                <Badge variant="outline" className="text-xs">{submission.status || '—'}</Badge>
              </DetailRow>
              <DetailRow label="Stage">
                <Badge variant="outline" className="text-xs">{submission.stage || 'new'}</Badge>
              </DetailRow>
              <DetailRow label="Match Score">
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
              <DetailRow label="Opt-In">
                {submission.opt_in_response ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                    {submission.opt_in_response}
                  </Badge>
                ) : isAwaitingOptIn ? (
                  <span className="text-xs text-amber-600 font-medium">⏳ ausstehend</span>
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
              <DetailRow label="Identität freigeschaltet">
                {identityUnlocked ? (
                  <span className="text-xs text-green-600 flex items-center gap-1"><Unlock className="h-3 w-3" /> Ja</span>
                ) : (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="h-3 w-3" /> Nein</span>
                )}
              </DetailRow>
              <DetailRow label="Consent">
                {submission.consent_confirmed ? (
                  <span className="text-xs text-green-600">✓ Bestätigt</span>
                ) : (
                  <span className="text-xs text-muted-foreground">⏳ ausstehend</span>
                )}
              </DetailRow>
              <DetailRow label="Eingereicht">
                <span className="text-xs">{format(new Date(submission.submitted_at), 'd. MMM yyyy, HH:mm', { locale: de })}</span>
              </DetailRow>
              <DetailRow label="Letztes Update">
                <span className="text-xs">{format(new Date(submission.updated_at), 'd. MMM yyyy, HH:mm', { locale: de })}</span>
              </DetailRow>
            </CardContent>
          </Card>

          {/* Notes Card */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notizen
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              {/* Existing recruiter notes */}
              {submission.recruiter_notes ? (
                <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5">
                  {submission.recruiter_notes}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Noch keine Recruiter-Notizen.</p>
              )}

              {/* Add note */}
              <div className="flex gap-2">
                <Textarea
                  placeholder="Notiz hinzufügen..."
                  value={recruiterNote}
                  onChange={(e) => setRecruiterNote(e.target.value)}
                  className="text-xs min-h-[60px]"
                  rows={2}
                />
              </div>
              {recruiterNote.trim() && (
                <Button size="sm" onClick={handleSaveNote} disabled={savingNote} className="w-full">
                  {savingNote ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                  Notiz speichern
                </Button>
              )}

              {/* Client notes */}
              {submission.client_notes && (
                <div className="pt-2 border-t">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Client Notizen</p>
                  <div className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-2.5">
                    {typeof submission.client_notes === 'string'
                      ? (() => {
                          try {
                            const parsed = JSON.parse(submission.client_notes);
                            if (parsed.pending_interview_request) {
                              const req = parsed.pending_interview_request;
                              return (
                                <div className="space-y-1">
                                  <p className="font-medium">Interview-Anfrage ({req.status})</p>
                                  {req.client_message && <p>{req.client_message}</p>}
                                  {req.client_time_slots && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {(req.client_time_slots as string[]).map((slot: string, i: number) => (
                                        <Badge key={i} variant="secondary" className="text-[10px]">
                                          {format(new Date(slot), 'd.M. HH:mm', { locale: de })}
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
                  Alerts ({pendingAlerts.length} offen)
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
                        Erledigt
                      </Button>
                    </div>
                  );
                })}
                {doneAlerts.length > 0 && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {doneAlerts.length} erledigte Alerts
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
                  Interview
                  <Badge variant="outline" className={cn(
                    'text-[10px] ml-auto',
                    activeInterview.status === 'pending_response' && 'text-amber-600 border-amber-500/30',
                    activeInterview.status === 'scheduled' && 'text-green-600 border-green-500/30',
                  )}>
                    {activeInterview.status === 'pending_response' ? 'Wartet auf Antwort' : 'Bestätigt'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
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

                {/* Proposed slots */}
                {activeInterview.proposed_slots && (activeInterview.proposed_slots as any[]).length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Terminvorschläge</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(activeInterview.proposed_slots as any[]).map((slot: any, i: number) => (
                        <Badge
                          key={i}
                          variant={slot.status === 'selected' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {format(new Date(slot.datetime), 'EEE d.M. HH:mm', { locale: de })}
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
                        {format(new Date(activeInterview.scheduled_at), 'EEEE, d. MMMM yyyy · HH:mm', { locale: de })}
                      </p>
                      <p className="text-xs text-muted-foreground">{activeInterview.duration_minutes} Minuten · {activeInterview.meeting_format}</p>
                    </div>
                  </div>
                )}

                {/* Client message */}
                {activeInterview.client_message && (
                  <div className="text-xs bg-muted/50 rounded-md p-2.5 border-l-2 border-primary/30">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Nachricht des Unternehmens</p>
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
                    Meeting beitreten
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
                Timeline
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
                <p className="text-xs text-muted-foreground">Noch keine Aktivitäten.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}

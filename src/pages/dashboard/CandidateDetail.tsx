import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Calendar,
  FileText,
  Linkedin,
  X,
  Clock,
  MessageSquare,
  Send,
  Lock,
  User,
  Scale,
  Briefcase,
  MapPin,
  Banknote,
  GraduationCap,
  Building2,
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { CandidateFitAssessmentCard } from '@/components/candidates/CandidateFitAssessmentCard';
import { CandidateExperienceTimeline } from '@/components/candidates/CandidateExperienceTimeline';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
import { PendingRequestStatus } from '@/components/interview/PendingRequestStatus';
import { StatePill } from '@/components/candidates/BewerberStatusPill';
import { primaryActionFor } from '@/components/candidates/BewerberPreviewPanel';
import { useSubmissionState } from '@/hooks/useSubmissionState';
import { useCandidateFitAssessment } from '@/hooks/useCandidateFitAssessment';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { useMyOrganization } from '@/hooks/useOrganization';
import { useTeamData } from '@/hooks/useTeamData';
import { cn } from '@/lib/utils';
import { candidateAnonCode } from '@/lib/anonymization';

// ============================================================================
// Helpers
// ============================================================================

const isPlaceholder = (val: string) => {
  const placeholders = ['Nicht angegeben', 'Ausstehend', 'Unbekannt', 'Flexibel',
    'Noch nicht besprochen', 'CV-Analyse ausstehend', 'Wird im Interview besprochen',
    'Wird basierend auf CV ermittelt', 'Präferenz noch nicht erfasst', 'Fachkraft',
    'Vom Kandidaten noch nicht freigegeben', 'Standort nicht angegeben'];
  return placeholders.some(p => val.includes(p));
};

function buildWorkModelLabel(workModel: string, remoteDays: number | null, relocation: boolean | null): string {
  const parts = [workModel];
  if (remoteDays && remoteDays > 0) parts.push(`${remoteDays}T Remote`);
  if (relocation === true) parts.push('umzugsbereit');
  return parts.join(', ');
}


// ============================================================================
// Key Fact Chip
// ============================================================================

function KeyFactChip({ icon: Icon, label, value, faded }: {
  icon: React.ElementType; label: string; value: string; faded?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", faded ? "text-muted-foreground/50" : "text-muted-foreground")} />
      <span className="text-muted-foreground text-sm">{label}:</span>
      <span className={cn("text-sm font-medium", faded ? "text-muted-foreground/50" : "text-foreground")}>
        {value || '–'}
      </span>
    </span>
  );
}


// ============================================================================
// Main Component
// ============================================================================

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: candidateView, loading, error, refetch } = useClientCandidateView(id);

  // Ein Zustand für die ganze Seite — gleiche Pillen-/Zuständigkeits-Logik wie die Inbox
  const { data: subState } = useSubmissionState(
    id,
    candidateView?.stage ?? null,
    candidateView?.status ?? null,
    null
  );

  // Fallback-Quelle für die Match-Pille: die Fit-Analyse hat oft einen Score,
  // wenn submissions.match_score (noch) leer ist — eine Zahl, eine Wahrheit im Kopf.
  const { assessment: fitAssessment } = useCandidateFitAssessment(id);

  // Team-Kontext: Viewer sind read-only; Mitgliederliste für @-Mentions
  const { organization: myOrg, myRole: myOrgRole } = useMyOrganization();
  const isViewer = myOrgRole === 'viewer';
  const teamQuery = useTeamData(myOrg?.id);
  const teamMembers = (teamQuery.data?.members ?? []).filter((m) => m.status === 'active');
  const memberName = (uid: string) => teamMembers.find((m) => m.user_id === uid)?.full_name ?? null;

  // DSGVO: Zugriff auf das Kandidatenprofil serverseitig protokollieren
  // (einmal pro Submission und Seitenaufruf, nicht pro Re-Render)
  const loggedAccessRef = useRef<string | null>(null);
  useEffect(() => {
    if (!id || !user || loggedAccessRef.current === id) return;
    loggedAccessRef.current = id;
    supabase
      .rpc('log_candidate_access', { _submission_id: id })
      .then(({ error: rpcError }) => {
        if (rpcError) console.warn('Zugriffs-Log nicht möglich:', rpcError.message);
      });
  }, [id, user]);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  // @-Mention-Vorschläge: greift auf das letzte "@..."-Fragment im Text
  const mentionMatch = newComment.match(/@([\wäöüÄÖÜß-]*)$/);
  const mentionSuggestions = mentionMatch
    ? teamMembers
        .filter(
          (m) =>
            m.user_id !== user?.id &&
            m.full_name &&
            m.full_name.toLowerCase().startsWith(mentionMatch[1].toLowerCase())
        )
        .slice(0, 5)
    : [];

  const applyMention = (fullName: string) => {
    setNewComment((prev) => prev.replace(/@([\wäöüÄÖÜß-]*)$/, `@${fullName} `));
  };

  // Erwähnte Namen im Kommentar farblich hervorheben
  const renderCommentContent = (text: string) => {
    const names = teamMembers.map((m) => m.full_name).filter(Boolean) as string[];
    if (!names.length) return text;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = text.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="font-medium text-primary">{part}</span>
      ) : (
        part
      )
    );
  };

  // Dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);

  // Job Requirements Query
  const { data: jobReqs } = useQuery({
    queryKey: ['job-requirements-fit', candidateView?.jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('skills, must_haves, nice_to_haves, salary_min, salary_max, experience_level, location, remote_policy, onsite_required')
        .eq('id', candidateView!.jobId)
        .single();
      if (error) throw error;
      return data as {
        skills: string[] | null;
        must_haves: string[] | null;
        nice_to_haves: string[] | null;
        salary_min: number | null;
        salary_max: number | null;
        experience_level: string | null;
        location: string | null;
        remote_policy: string | null;
        onsite_required: boolean | null;
      };
    },
    enabled: !!candidateView?.jobId,
  });

  // AI Summary for recommendation
  const { data: aiSummary } = useQuery({
    queryKey: ['client-summary-recommendation', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_client_summary')
        .select('recommendation, key_selling_points, change_motivation_status')
        .eq('submission_id', id!)
        .maybeSingle();
      return data as {
        recommendation: string;
        key_selling_points: string[];
        change_motivation_status: string;
      } | null;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (id && user) fetchComments();
  }, [id, user]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });
      if (!error && data) setComments(data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setCommentLoading(true);
    try {
      // @-Mentions auflösen: erwähnte Team-Mitglieder erhalten eine Benachrichtigung
      const mentionedIds = teamMembers
        .filter((m) => m.user_id !== user.id && m.full_name && newComment.includes(`@${m.full_name}`))
        .map((m) => m.user_id);

      let { error } = await supabase
        .from('candidate_comments')
        .insert({ submission_id: id, user_id: user.id, content: newComment, mentioned_user_ids: mentionedIds });
      if (error && /mentioned_user_ids/.test(error.message)) {
        // Fallback für noch nicht migrierte DB
        ({ error } = await supabase
          .from('candidate_comments')
          .insert({ submission_id: id, user_id: user.id, content: newComment }));
      }
      if (error) throw error;

      if (mentionedIds.length) {
        await supabase.from('notifications').insert(
          mentionedIds.map((uid) => ({
            user_id: uid,
            type: 'comment_mention',
            title: 'Sie wurden in einem Kommentar erwähnt',
            message: `${memberName(user.id) ?? 'Ein Teammitglied'} hat Sie in einem Kommentar zu einem Kandidaten (${candidateView?.jobTitle ?? 'Job'}) erwähnt.`,
            related_type: 'submission',
            related_id: id,
          }))
        );
      }

      setNewComment('');
      fetchComments();
      toast({ title: 'Notiz gespeichert' });
    } catch {
      toast({ title: 'Die Notiz konnte nicht gespeichert werden', variant: 'destructive' });
    } finally {
      setCommentLoading(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error
  if (error || !candidateView) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Kandidat nicht gefunden</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/candidates">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const {
    displayName, identityUnlocked, currentRole, experience, seniority,
    salaryRange, availability, region, workModel, topSkills,
    status, stage, jobTitle, jobId, recruiterNotes,
    email, phone, cvUrl, linkedinUrl,
    candidateId, submissionId, matchScore, fitLabel, dealProbability, motivationStatus,
    certifications, languageSkills, industryExperience, targetRoles,
    careerGoals, relocationWilling, remoteDaysPreferred,
    keySellingPoints,
  } = candidateView;

  const enrichedWorkModel = buildWorkModelLabel(workModel, remoteDaysPreferred, relocationWilling);
  const isTerminal = status === 'hired' || status === 'rejected' || status === 'client_rejected';
  const anonCode = candidateAnonCode(candidateId);
  const fmtSeniority = (s: string) => (s && /^[a-z]/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  const state = subState?.state ?? { key: 'wait_today', tone: 'neutral' as const, turn: 'me' as const };
  const primary = primaryActionFor(state.key);
  const PrimaryIcon = primary.icon;
  // Nur „wartet auf Kandidat" nutzt den Pending-Baustein; beim Gegenvorschlag
  // ist der Kunde am Zug und bekommt die Primäraktion „Vorschlag prüfen".
  const isPendingCandidate = state.key === 'wartet_kandidat';
  const headScore = matchScore > 0 ? matchScore : fitAssessment?.overall_score ?? 0;
  const showAgendaLink = ['geplant', 'feedback', 'feedback_nodate', 'interview_phase', 'opted_in'].includes(state.key);

  const ctxFor = (): string => {
    const k = state.key;
    if (k === 'wait_today' || k === 'wait_yesterday' || k === 'wait_days') return t('bewerber.detail.ctx.wait_new');
    if (k === 'wait_warn' || k === 'wait_crit') return t('bewerber.detail.ctx.wait_old', { days: (state.params as any)?.days ?? '' });
    if (k === 'archiv') return t('bewerber.detail.ctx.archiv');
    return t(`bewerber.detail.ctx.${k}`, state.params);
  };

  const runPrimary = () => {
    if (isViewer) return;
    if (primary.run === 'wizard') {
      setShowInterviewDialog(true);
      return;
    }
    // Beim Feedback-Zustand direkt das Formular dieses Kandidaten öffnen,
    // statt den Kunden nur auf die Interviews-Liste zu werfen.
    const isFeedback = state.key === 'feedback' || state.key === 'feedback_nodate';
    navigate(primary.run, isFeedback ? { state: { openFeedbackFor: submissionId } } : undefined);
  };

  // Verlauf: Einreichung, Interviews und Angebote chronologisch — das Gedächtnis der Bewerbung
  const verlauf: { when: string; label: string }[] = [];
  if (subState?.submittedAt) verlauf.push({ when: subState.submittedAt, label: t('bewerber.detail.verlauf_submitted') });
  for (const iv of subState?.interviews ?? []) {
    verlauf.push({ when: iv.createdAt, label: t('bewerber.detail.verlauf_iv_requested') });
    if (iv.scheduledAt) {
      const past = new Date(iv.scheduledAt).getTime() < Date.now();
      verlauf.push({
        when: iv.scheduledAt,
        label:
          past && (iv.status === 'scheduled' || iv.status === 'completed')
            ? t('bewerber.detail.verlauf_iv_completed')
            : t('bewerber.detail.verlauf_iv_scheduled', {
                time: format(new Date(iv.scheduledAt), 'HH:mm', { locale: de }),
              }),
      });
    }
    if (iv.cancelledAt) verlauf.push({ when: iv.cancelledAt, label: t('bewerber.detail.verlauf_iv_cancelled') });
    if (iv.status === 'declined') verlauf.push({ when: iv.createdAt, label: t('bewerber.detail.verlauf_iv_declined') });
  }
  for (const o of subState?.offers ?? []) {
    if (o.createdAt) verlauf.push({ when: o.createdAt, label: t('bewerber.detail.verlauf_offer_created') });
    if (o.sentAt) verlauf.push({ when: o.sentAt, label: t('bewerber.detail.verlauf_offer_sent') });
  }
  if (subState?.latestInterview?.status === 'pending_response') {
    verlauf.push({ when: new Date().toISOString(), label: t('bewerber.detail.verlauf_iv_pending') });
  }
  verlauf.sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());

  return (
    <DashboardLayout>
      {/* Back navigation */}
      <Link
        to="/dashboard/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t('bewerber.detail.back')}
      </Link>

      <div className="space-y-4 max-w-5xl">
        {/* ================================================================ */}
        {/* ZONE 1 — WER & WIE GUT (bleibt beim Scrollen sichtbar)           */}
        {/* ================================================================ */}
        <div className="sticky top-16 z-20">
          <div className="rounded-xl border bg-card shadow-md p-5">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  <AvatarFallback className={cn(
                    'text-lg font-semibold',
                    identityUnlocked
                      ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {identityUnlocked
                      ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                      : <User className="h-6 w-6" />}
                  </AvatarFallback>
                </Avatar>
                {!identityUnlocked && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 bg-muted rounded-full border-2 border-background flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-bold truncate">
                    {identityUnlocked ? displayName : anonCode}
                  </h1>
                  {!identityUnlocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                  {headScore > 0 && (
                    <span className={cn(
                      'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                      headScore >= 85 ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                    )}>
                      {t('bewerber.detail.match', { score: headScore })}
                    </span>
                  )}
                  <StatePill state={state} archiveKind={subState?.archiveKind} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{currentRole}</span>
                  <span className="text-border">·</span>
                  <span>für: {jobTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {identityUnlocked
                    ? t('bewerber.detail.unlocked_hint', { code: anonCode })
                    : t('bewerber.detail.locked_hint', { code: anonCode })}
                </p>
              </div>

              {/* Kontaktleiste — nur nach Freigabe; vorher erklärt die Hinweiszeile den Zustand */}
              {identityUnlocked && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {phone && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.href = `tel:${phone}`}>
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{phone}</TooltipContent>
                    </Tooltip>
                  )}
                  {email && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.location.href = `mailto:${email}`}>
                          <Mail className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{email}</TooltipContent>
                    </Tooltip>
                  )}
                  {linkedinUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(linkedinUrl, '_blank')}>
                          <Linkedin className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>LinkedIn</TooltipContent>
                    </Tooltip>
                  )}
                  {cvUrl ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(cvUrl, '_blank')}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('bewerber.detail.cv_open')}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t('bewerber.detail.cv_missing')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>

            {/* Fakten */}
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <KeyFactChip icon={GraduationCap} label="Seniorität" value={fmtSeniority(seniority)} faded={isPlaceholder(seniority)} />
              <KeyFactChip icon={Briefcase} label="Erfahrung" value={experience} faded={isPlaceholder(experience)} />
              <KeyFactChip icon={Banknote} label="Gehalt" value={salaryRange} faded={isPlaceholder(salaryRange)} />
              <KeyFactChip icon={Clock} label="Verfügbar" value={availability} faded={isPlaceholder(availability)} />
              <KeyFactChip icon={MapPin} label="Region" value={region} faded={isPlaceholder(region)} />
              <KeyFactChip icon={Globe} label="Arbeitsmodell" value={enrichedWorkModel} faded={isPlaceholder(workModel)} />
            </div>

            {/* Skills */}
            <div className="flex flex-wrap items-center gap-1 mt-3">
              {topSkills.slice(0, 8).map((skill: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  {skill}
                </Badge>
              ))}
              {topSkills.length > 8 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">+{topSkills.length - 8} weitere</span>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* ZONE 2 — WAS JETZT                                               */}
        {/* ================================================================ */}
        <div className={cn(
          'rounded-xl border p-4',
          state.tone === 'warn' ? 'bg-warning/10 border-warning/20' :
          state.tone === 'crit' ? 'bg-destructive/10 border-destructive/20' :
          'bg-muted/30'
        )}>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm flex-1 min-w-[240px]">{ctxFor()}</p>
            <div className="flex flex-wrap items-center gap-2">
              {isViewer && (
                <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" /> {t('bewerber.detail.readonly')}
                </Badge>
              )}
              {!isViewer && !isTerminal && (
                <>
                  {isPendingCandidate ? (
                    <PendingRequestStatus submissionId={submissionId} jobTitle={jobTitle} />
                  ) : (
                    <Button size="sm" onClick={runPrimary} className="gap-1.5">
                      <PrimaryIcon className="h-3.5 w-3.5" />
                      {t(primary.labelKey)}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setShowRejectDialog(true)}
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('bewerber.actions.reject')}
                  </Button>
                  {showAgendaLink && (
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                      <Link to="/dashboard/interviews">{t('bewerber.detail.agenda')}</Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground gap-1.5"
                    onClick={() => navigate('/dashboard/messages')}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t('bewerber.actions.ask_recruiter')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* ZONE 3+4 — PASSUNG (links) · WERDEGANG & PROFIL (rechts)         */}
        {/* Nebeneinander, damit der Werdegang ohne Scrollen sichtbar ist    */}
        {/* ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <CandidateFitAssessmentCard
            submissionId={submissionId}
            recruiterNotes={recruiterNotes}
            keySellingPoints={keySellingPoints}
          />

          <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                {t('bewerber.detail.career')}
                {!identityUnlocked && (
                  <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1 ml-auto">
                    <Lock className="h-3 w-3" />
                    {t('bewerber.detail.companies_after_optin')}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CandidateExperienceTimeline candidateId={candidateId} anonymized={!identityUnlocked} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('bewerber.detail.profile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {industryExperience.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.branchen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {industryExperience.map((ie, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">{ie}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {targetRoles.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.zielrollen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {targetRoles.map((tr, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">{tr}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {languageSkills.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.sprachen')}</p>
                  <div className="flex flex-wrap gap-1">
                    {languageSkills.map((ls, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal">
                        {ls.level ? `${ls.language} (${ls.level})` : ls.language}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {certifications.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.zertifikate')}</p>
                  <div className="flex flex-wrap gap-1">
                    {certifications.map((cert, idx) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-normal text-amber-600 border-amber-400/50">{cert}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {careerGoals && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{t('bewerber.detail.karriereziele')}</p>
                  <p className="text-xs text-muted-foreground">{careerGoals}</p>
                </div>
              )}
              {identityUnlocked ? (
                cvUrl ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(cvUrl, '_blank')}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    {t('bewerber.detail.cv_open')}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    {t('bewerber.detail.cv_missing')}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  {t('bewerber.detail.cv_locked')}
                </p>
              )}
            </CardContent>
          </Card>
          </div>
        </div>

        {/* ================================================================ */}
        {/* ZONE 5 — VERLAUF                                                 */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {t('bewerber.detail.verlauf')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verlauf.length === 0 ? (
              <p className="text-xs text-muted-foreground">–</p>
            ) : (
              <div className="space-y-2.5">
                {verlauf.map((e, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-muted-foreground/40 shrink-0" />
                    <div>
                      <span className="text-[11px] text-muted-foreground/70">
                        {format(new Date(e.when), 'dd.MM.yyyy', { locale: de })}
                      </span>
                      <p className="text-sm leading-tight">{e.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* NOTIZEN                                                          */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              {t('bewerber.notes.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Textarea
                placeholder={teamMembers.length > 1 ? 'Notiz hinzufügen … (@ erwähnt Teammitglieder)' : 'Notiz hinzufügen …'}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] text-sm"
              />
              {mentionSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-lg border bg-popover shadow-md">
                  {mentionSuggestions.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => applyMention(m.full_name!)}
                    >
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground">{m.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || commentLoading}
              size="sm"
              className="w-full"
            >
              {commentLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Speichern
            </Button>
            <p className="text-[10px] text-muted-foreground/60">{t('bewerber.notes.visibility')}</p>

            {comments.length > 0 && (
              <ScrollArea className="max-h-48">
                <div className="space-y-2 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-sm">{renderCommentContent(comment.content)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {memberName(comment.user_id) ? `${memberName(comment.user_id)} · ` : ''}
                        {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Footer-Hinweis nur solange die Identität gesperrt ist; EU-AI-Act-Hinweis steht in der Fit-Analyse */}
        {!identityUnlocked && (
          <p className="text-xs text-muted-foreground/60 text-center py-3">
            Anonymisiertes Profil — nach der Interview-Zusage werden Name, Kontakt und Lebenslauf freigeschaltet.
          </p>
        )}
      </div>

      {/* Dialogs */}
      <RejectionDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        submission={{
          id: submissionId,
          candidate: { id: candidateId, full_name: displayName, email: email || '' },
          job: { id: jobId, title: jobTitle, company_name: '' }
        }}
        onSuccess={() => { setShowRejectDialog(false); refetch(); }}
      />

      <ProfessionalInterviewWizard
        open={showInterviewDialog}
        onOpenChange={setShowInterviewDialog}
        submissionId={submissionId}
        candidateAnonymousId={displayName}
        jobTitle={jobTitle}
        onSuccess={() => { setShowInterviewDialog(false); refetch(); }}
      />
    </DashboardLayout>
  );
}

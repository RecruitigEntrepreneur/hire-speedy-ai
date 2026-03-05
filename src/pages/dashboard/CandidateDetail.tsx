import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { cn } from '@/lib/utils';

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

  const { data: candidateView, loading, error, refetch } = useClientCandidateView(id);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

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
      const { error } = await supabase
        .from('candidate_comments')
        .insert({ submission_id: id, user_id: user.id, content: newComment });
      if (error) throw error;
      setNewComment('');
      fetchComments();
      toast({ title: 'Kommentar hinzugefuegt' });
    } catch {
      toast({ title: 'Fehler beim Hinzufuegen', variant: 'destructive' });
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
            <Link to="/dashboard/candidates">Zurueck zur Uebersicht</Link>
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

  const getStatusLabel = (s: string | null): string => {
    const labels: Record<string, string> = {
      submitted: 'Eingereicht', screening: 'In Pruefung',
      interview_requested: 'Interview angefragt', candidate_opted_in: 'Opt-In erhalten',
      interview_scheduled: 'Interview geplant', interview: 'Interview-Phase',
      second_interview: 'Zweitgespraech', offer: 'Angebot',
      hired: 'Eingestellt', rejected: 'Abgelehnt',
      client_rejected: 'Abgelehnt', opt_in_declined: 'Opt-In abgelehnt',
    };
    return labels[s || 'submitted'] || 'Eingereicht';
  };

  const enrichedWorkModel = buildWorkModelLabel(workModel, remoteDaysPreferred, relocationWilling);
  const isTerminal = status === 'hired' || status === 'rejected' || status === 'client_rejected';

  return (
    <DashboardLayout>
      {/* Back navigation */}
      <Link
        to="/dashboard/candidates"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Zurueck zu Bewerbungen
      </Link>

      <div className="space-y-6 max-w-5xl">
        {/* ================================================================ */}
        {/* HERO CARD                                                        */}
        {/* ================================================================ */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-5">
            {/* Row 1: Avatar + Name/Meta + Match Score */}
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                  <AvatarFallback className={cn(
                    "text-lg font-semibold",
                    identityUnlocked
                      ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {identityUnlocked
                      ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                      : <User className="h-6 w-6" />
                    }
                  </AvatarFallback>
                </Avatar>
                {!identityUnlocked && (
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 bg-muted rounded-full border-2 border-background flex items-center justify-center">
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Name + Meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-xl md:text-2xl font-bold truncate flex items-center gap-2">
                      {displayName}
                      {!identityUnlocked && <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{currentRole}</span>
                      <span className="text-border">·</span>
                      <span>fuer: {jobTitle}</span>
                    </div>
                    <Badge variant="outline" className="mt-1.5 text-[10px] h-5">
                      {getStatusLabel(stage || status)}
                    </Badge>
                  </div>

                  {/* Match Score Badge */}
                  {matchScore > 0 && (
                    <div className={cn(
                      "flex flex-col items-center px-4 py-2 rounded-lg border shrink-0",
                      matchScore >= 85 ? "bg-emerald-500/10 border-emerald-500/30" :
                      matchScore >= 70 ? "bg-green-500/10 border-green-500/30" :
                      matchScore >= 50 ? "bg-amber-500/10 border-amber-500/30" :
                      "bg-red-500/10 border-red-500/30"
                    )}>
                      <span className={cn(
                        "text-2xl font-bold",
                        matchScore >= 85 ? "text-emerald-600" :
                        matchScore >= 70 ? "text-green-600" :
                        matchScore >= 50 ? "text-amber-600" : "text-red-600"
                      )}>
                        {matchScore}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">Match</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Row 2: Key Facts (inline) */}
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <KeyFactChip icon={GraduationCap} label="Senioritaet" value={seniority} faded={isPlaceholder(seniority)} />
              <KeyFactChip icon={Briefcase} label="Erfahrung" value={experience} faded={isPlaceholder(experience)} />
              <KeyFactChip icon={Banknote} label="Gehalt" value={salaryRange} faded={isPlaceholder(salaryRange)} />
              <KeyFactChip icon={Clock} label="Verfuegbar" value={availability} faded={isPlaceholder(availability)} />
              <KeyFactChip icon={MapPin} label="Region" value={region} faded={isPlaceholder(region)} />
              <KeyFactChip icon={Globe} label="Arbeitsmodell" value={enrichedWorkModel} faded={isPlaceholder(workModel)} />
            </div>

            {/* Row 3: Skills + Certifications + Languages */}
            <div className="flex flex-wrap items-center gap-1 mt-3">
              {topSkills.slice(0, 8).map((skill: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  {skill}
                </Badge>
              ))}
              {topSkills.length > 8 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">+{topSkills.length - 8}</span>
              )}
              {certifications.map((cert, idx) => (
                <Badge key={`cert-${idx}`} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-amber-600 border-amber-400/50">
                  {cert}
                </Badge>
              ))}
              {languageSkills.length > 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  {languageSkills.map(ls => ls.level ? `${ls.language}(${ls.level})` : ls.language).join(', ')}
                </span>
              )}
            </div>

            {/* Row 4: CTAs + Contact Buttons */}
            <div className="mt-4 pt-3 border-t flex flex-wrap items-center gap-2">
              {/* Stage-dependent CTAs */}
              {!isTerminal && (
                <>
                  {stage === 'interview_requested' ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                      <Clock className="h-3.5 w-3.5" />
                      Interview angefragt — Opt-In ausstehend
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setShowInterviewDialog(true)}
                      className="gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      {stage === 'candidate_opted_in' ? 'Interview planen' : 'Interview anfragen'}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRejectDialog(true)}
                    className="gap-1.5"
                  >
                    <X className="h-3.5 w-3.5" />
                    Ablehnen
                  </Button>
                </>
              )}
              {isTerminal && (
                <Badge variant={status === 'hired' ? 'default' : 'destructive'} className="text-xs">
                  {getStatusLabel(status)}
                </Badge>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Contact Buttons (locked/unlocked) */}
              {identityUnlocked ? (
                <div className="flex items-center gap-1.5">
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
                  {cvUrl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(cvUrl, '_blank')}>
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>CV oeffnen</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nach Opt-In verfuegbar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nach Opt-In verfuegbar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                        <Linkedin className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Nach Opt-In verfuegbar</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8 opacity-40 cursor-not-allowed" disabled>
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>CV nach Opt-In verfuegbar</TooltipContent>
                  </Tooltip>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1">
                    <Lock className="h-3 w-3" />
                    Kontakt nach Opt-In
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ================================================================ */}
        {/* INTELLIGENTE FIT-ANALYSE                                         */}
        {/* ================================================================ */}
        <CandidateFitAssessmentCard
          submissionId={submissionId}
          recruiterNotes={recruiterNotes}
          keySellingPoints={keySellingPoints}
        />

        {/* ================================================================ */}
        {/* KARRIERE-TIMELINE                                                */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Karriere-Stationen
              {!identityUnlocked && (
                <span className="text-[10px] font-normal text-muted-foreground flex items-center gap-1 ml-auto">
                  <Lock className="h-3 w-3" />
                  Firmennamen nach Opt-In
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CandidateExperienceTimeline candidateId={candidateId} anonymized={!identityUnlocked} />
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* PROFIL-DETAILS (if available)                                     */}
        {/* ================================================================ */}
        {(industryExperience.length > 0 || targetRoles.length > 0 || careerGoals) && (
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {industryExperience.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Branchen</p>
                    <div className="flex flex-wrap gap-1">
                      {industryExperience.map((ie, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-normal">{ie}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {targetRoles.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Zielrollen</p>
                    <div className="flex flex-wrap gap-1">
                      {targetRoles.map((tr, idx) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-normal">{tr}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {careerGoals && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Karriereziele</p>
                    <p className="text-xs text-muted-foreground">{careerGoals}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ================================================================ */}
        {/* NOTIZEN                                                          */}
        {/* ================================================================ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Notizen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Notiz hinzufuegen..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[60px] text-sm"
              />
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

            {comments.length > 0 && (
              <ScrollArea className="max-h-48">
                <div className="space-y-2 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="p-2.5 bg-muted/50 rounded-lg">
                      <p className="text-sm">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* ================================================================ */}
        {/* EU AI ACT FOOTER                                                 */}
        {/* ================================================================ */}
        <div className="text-xs text-muted-foreground/60 text-center py-3 space-y-1">
          {!identityUnlocked && (
            <p>Anonymisiertes Profil — Nach Interview-Zustimmung werden Name, Kontakt und CV freigeschaltet.</p>
          )}
          <p className="flex items-center justify-center gap-1">
            <Scale className="h-3 w-3" />
            Die KI-Einschaetzung auf dieser Seite wird gemaess EU AI Act (Verordnung 2024/1689) als Hochrisiko-KI-System betrieben.
          </p>
        </div>
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

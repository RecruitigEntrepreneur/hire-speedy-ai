import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { generateAnonymousId } from '@/lib/anonymization';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { JobEditDialog } from '@/components/jobs/JobEditDialog';
import { CandidateQuickView } from '@/components/candidates/CandidateQuickView';
import { JobExecutiveSummary } from '@/components/jobs/JobExecutiveSummary';
import { CandidateCompareView } from '@/components/candidates/CandidateCompareView';

// New modular components
import { ClientJobHero } from '@/components/client/ClientJobHero';
import { PipelineSnapshotCard } from '@/components/client/PipelineSnapshotCard';
import { TopCandidatesCard } from '@/components/client/TopCandidatesCard';
import { RecruiterActivityCard } from '@/components/client/RecruiterActivityCard';
import { UpcomingInterviewsCard } from '@/components/client/UpcomingInterviewsCard';
import { JobQualityScoreCard } from '@/components/client/JobQualityScoreCard';
import { NextStepsCard } from '@/components/client/NextStepsCard';
import { SellingPointsCard } from '@/components/client/SellingPointsCard';
import { CommunicationLogCard } from '@/components/client/CommunicationLogCard';


import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Circle,
  Clock,
  Loader2,
  Lock,
  Calendar,
  Sparkles,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog';
import { useMyOrganization } from '@/hooks/useOrganization';
import { resolveIntakeSubmitTarget, notifyApproversOfIntake, notifyCreatorOfDecision } from '@/lib/intakeApproval';
import { JobIntakeStudio } from '@/components/dashboard/JobIntakeStudio';
import { isMissingColumnError } from '@/lib/intakeCapture';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface JobSummary {
  key_facts: { icon: string; label: string; value: string }[];
  tasks_structured: { category: string; items: string[] }[];
  requirements_structured: {
    education: string[];
    experience: string[];
    tools: string[];
    soft_skills: string[];
    certifications: string[];
  };
  benefits_extracted: { icon: string; text: string }[];
  ai_insights: {
    role_type: string;
    ideal_profile: string;
    unique_selling_point: string;
    hiring_recommendation: string;
  };
  generated_at: string;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  briefing_notes?: string | null;
  rejection_reason?: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  status: string | null;
  created_at: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  fee_percentage: number | null;
  paused_at: string | null;
  skills: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  office_address: string | null;
  remote_policy: string | null;
  onsite_days_required: number | null;
  urgency: string | null;
  industry: string | null;
  job_summary: JobSummary | null;
  intake_completeness: number | null;
}

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
  recruiter: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Interview {
  id: string;
  scheduled_at: string;
  status: string;
  submission_id: string;
}

const REJECTION_REASONS = [
  'Qualifikation passt nicht',
  'Gehaltsvorstellung zu hoch',
  'Keine Kulturpassung',
  'Andere Kandidaten bevorzugt',
  'Position bereits besetzt',
  'Sonstiges',
];

export default function ClientJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { organization: myOrg, myRole: myOrgRole, isAdmin: isOrgAdmin } = useMyOrganization();
  const [job, setJob] = useState<Job | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [decidingIntake, setDecidingIntake] = useState(false);
  const [showReturnDialog, setShowReturnDialog] = useState(false);
  const [returnNoteDraft, setReturnNoteDraft] = useState('');
  const [editDialogTab, setEditDialogTab] = useState<string | undefined>(undefined);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showCandidateView, setShowCandidateView] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  
  // Multi-select for comparison
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  

  const handleRemoveFromCompare = (submissionId: string) => {
    setSelectedSubmissionIds(prev => prev.filter(id => id !== submissionId));
  };

  const generateSummary = async () => {
    if (!job) return;
    setIsGeneratingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-job-summary', {
        body: { jobId: job.id }
      });
      if (error) throw error;
      if (data?.summary) {
        setJob(prev => prev ? { ...prev, job_summary: data.summary } : null);
        toast({ title: 'Summary generiert', description: 'Die Executive Summary wurde erstellt.' });
      }
    } catch (error) {
      console.error('Error generating summary:', error);
      toast({ title: 'Fehler', description: 'Summary konnte nicht generiert werden.', variant: 'destructive' });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  useEffect(() => {
    if (id && user) {
      fetchJobData();
    }
  }, [id, user]);

  const fetchJobData = async () => {
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('client_id', user?.id)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        toast({ title: 'Job nicht gefunden', variant: 'destructive' });
        return;
      }

      setJob({
        ...jobData,
        job_summary: jobData.job_summary as unknown as JobSummary | null,
        intake_completeness: jobData.intake_completeness ?? null
      } as Job);

      // Triple-Blind: candidate data is read EXCLUSIVELY through the reveal-gated
      // server view client_candidate_view. It returns NULL for raw PII (name,
      // email, phone, cv, linkedin, exact city/experience) until identity_unlocked
      // and exposes only pre-anonymized region/experience/salary bands otherwise.
      // The view also filters itself to the logged-in client (client_id = auth.uid()).
      // No raw candidate PII reaches the network before opt-in.
      const { data: viewRows, error: submissionsError } = await supabase
        .from('client_candidate_view')
        .select('*')
        .eq('job_id', id);

      if (submissionsError) throw submissionsError;

      const transformedSubmissions: Submission[] = (viewRows || []).map((v: any) => {
        const identityUnlocked = v.identity_unlocked === true;
        return {
          id: v.submission_id,
          stage: v.stage ?? v.status ?? 'submitted',
          status: v.status ?? null,
          match_score: v.match_score ?? null,
          submitted_at: v.submitted_at,
          recruiter_notes: v.recruiter_notes ?? null,
          candidate: {
            id: v.candidate_id,
            // Klarname nur nach Opt-In; sonst anonyme Kennung
            full_name: identityUnlocked && v.full_name
              ? v.full_name
              : generateAnonymousId(v.submission_id),
            // Kontaktdaten sind in der View bis zum Opt-In NULL
            email: v.email ?? '',
            phone: v.phone ?? null,
            job_title: v.candidate_role ?? null,
            // company ist in der View nicht enthalten (gated -> nicht anzeigen)
            company: null,
            // exakte Stadt nur nach Opt-In, sonst grobe Region
            city: identityUnlocked ? (v.city ?? null) : (v.region_broad ?? null),
            // Roh-Gehalt liegt in der View nicht vor (nur salary_band); nicht anzeigen
            expected_salary: null,
            current_salary: null,
            availability_date: v.availability_date ?? null,
            notice_period: v.notice_period ?? null,
            // exakte Jahre nur nach Opt-In; Band wird in spezialisierten Cards genutzt
            experience_years: v.experience_years ?? null,
            skills: v.skills ?? null,
            linkedin_url: v.linkedin_url ?? null,
            // github/portfolio sind in der View nicht enthalten (gated -> nicht anzeigen)
            github_url: null,
            portfolio_url: null,
            cv_url: v.cv_url ?? null,
            // Bio ist serverseitig vor Opt-In gescrubbt
            summary: v.cv_ai_summary ?? null,
            seniority: v.seniority ?? null,
          },
          recruiter: null,
        };
      });

      setSubmissions(transformedSubmissions);

      const submissionIds = transformedSubmissions.map(s => s.id);
      if (submissionIds.length > 0) {
        const { data: interviewsData } = await supabase
          .from('interviews')
          .select('id, scheduled_at, status, submission_id')
          .in('submission_id', submissionIds)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true });

        setInterviews(interviewsData || []);
      }
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (submissionId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage })
        .eq('id', submissionId);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, stage: newStage } : s
      ));
      toast({ title: 'Status aktualisiert' });
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({ title: 'Fehler beim Aktualisieren', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          stage: 'rejected',
          status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'rejected', status: 'rejected' } : s
      ));
      setShowRejectDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
      toast({ title: 'Kandidat abgelehnt' });
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedSubmission || !interviewDate) return;
    try {
      const { error: interviewError } = await supabase
        .from('interviews')
        .insert({
          submission_id: selectedSubmission.id,
          scheduled_at: interviewDate,
          notes: interviewNotes,
          status: 'scheduled',
        });

      if (interviewError) throw interviewError;

      const { error: updateError } = await supabase
        .from('submissions')
        .update({ stage: 'interview' })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'interview' } : s
      ));
      setShowInterviewDialog(false);
      setSelectedSubmission(null);
      setInterviewDate('');
      setInterviewNotes('');
      fetchJobData();
      toast({ title: 'Interview geplant' });
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({ title: 'Fehler beim Planen', variant: 'destructive' });
    }
  };

  const openScheduleInterview = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowInterviewDialog(true);
  };

  const openRejectDialog = (submission: Submission) => {
    setSelectedSubmission(submission);
    setShowRejectDialog(true);
  };

  const handlePauseToggle = async () => {
    if (!job) return;
    try {
      const isPaused = !!job.paused_at;
      // Nur paused_at toggeln — vorher zwang "Reaktivieren" JEDEN Status auf
      // 'published' (Freigabe-Bypass: Entwurf → pausieren → reaktivieren = live).
      const { error } = await supabase
        .from('jobs')
        .update({ paused_at: isPaused ? null : new Date().toISOString() })
        .eq('id', job.id);

      if (error) throw error;
      
      toast({ title: isPaused ? 'Job reaktiviert' : 'Job pausiert' });
      fetchJobData();
    } catch (error) {
      console.error('Error toggling pause:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  // Calculate stats
  const totalSubmissions = submissions.length;
  const inProcess = submissions.filter(s => !['rejected', 'hired'].includes(s.stage || '')).length;
  const interviewed = submissions.filter(s => ['interview', 'second_interview', 'offer', 'hired'].includes(s.stage || '')).length;
  const hired = submissions.filter(s => s.stage === 'hired').length;
  const daysOpen = job ? Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const activeRecruiters = new Set(submissions.map(s => s.recruiter?.email).filter(Boolean)).size;
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklySubmissions = submissions.filter(s => new Date(s.submitted_at) > weekAgo).length;
  
  const lastSubmissionAt = submissions.length > 0 
    ? submissions.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0].submitted_at
    : null;

  // Phase detection
  const hasCandidates = totalSubmissions > 0;
  const hasInterviews = interviews.length > 0;
  const hasBenefits = !!((job as any)?.benefits && (job as any).benefits.length > 0) || !!(job?.job_summary?.benefits_extracted && job.job_summary.benefits_extracted.length > 0);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Job nicht gefunden</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard/jobs">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  // ---- Lebenszyklus-Phase: Entwurf/Freigabe/Zurückgegeben bekommen ein
  // eigenes, ehrliches Layout statt des Aktiv-Cockpits. ---------------------
  const reviewRejectionReason =
    job.status === 'draft'
      ? job.rejection_reason ||
        (job.briefing_notes?.startsWith('[ABGELEHNT]')
          ? job.briefing_notes.split('\n')[0].replace('[ABGELEHNT]', '').trim()
          : null)
      : null;

  // Interne Rückgabe-Notiz (Team-Freigabe) — getrennt von der Matchunt-Ablehnung
  const clientReturnNote: string | null =
    job.status === 'draft'
      ? (((job as unknown as Record<string, unknown>).client_approval_note as string | null) ?? null)
      : null;

  const phase =
    job.status === 'draft' ? (reviewRejectionReason || clientReturnNote ? 'returned' : 'draft')
    : job.status === 'pending_approval' ? 'review'
    : job.status === 'pending_client_approval' ? 'client_approval'
    : 'live';

  if (phase !== 'live') {
    const raw = job as unknown as Record<string, any>;
    const reife: number = raw.intake_completeness ?? 0;
    const isFreelanceJob = job.employment_type === 'freelance';
    const missing: string[] = [];
    if (!isFreelanceJob && !job.salary_min && !job.salary_max) missing.push('Gehaltsband');
    if (!job.location && job.remote_type !== 'remote') missing.push('Standort');
    const canSubmit = missing.length === 0 && reife >= 30;

    const submitForReview = async () => {
      setSubmittingReview(true);
      // Hiring Manager + aktivierte interne Freigabe → erst zu Admin/HR
      const target = await resolveIntakeSubmitTarget(user!.id);
      let { error } = await supabase
        .from('jobs')
        .update({ status: target.status, rejection_reason: null, rejected_at: null, client_approval_note: null } as any)
        .eq('id', job.id);
      if (error && isMissingColumnError(error)) {
        ({ error } = await supabase.from('jobs').update({ status: 'pending_approval' }).eq('id', job.id));
      }
      setSubmittingReview(false);
      if (error) {
        toast({ title: 'Einreichen fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (target.status === 'pending_client_approval' && target.organizationId) {
        await notifyApproversOfIntake(target.organizationId, job.id, job.title, user?.id);
        toast({ title: 'Zur internen Freigabe eingereicht — Admin/HR Ihres Teams wurden benachrichtigt.' });
      } else {
        toast({ title: 'Zur Prüfung eingereicht — wir benachrichtigen Sie, sobald die Stelle live ist.' });
      }
      fetchJobData();
    };

    const withdraw = async () => {
      const { error } = await supabase.from('jobs').update({ status: 'draft' }).eq('id', job.id);
      if (!error) {
        toast({ title: 'Zurückgezogen — die Stelle ist wieder ein Entwurf.' });
        fetchJobData();
      }
    };

    // Interne Freigabe: Admin/HR geben frei (→ Matchunt) oder geben mit Kommentar zurück
    const canApproveIntake = ['owner', 'admin', 'hr'].includes(myOrgRole ?? '');
    const jobCreatorId = (job as unknown as { client_id: string }).client_id;

    const approveIntake = async () => {
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'pending_approval',
          client_approved_by: user?.id ?? null,
          client_approved_at: new Date().toISOString(),
          client_approval_note: null,
        })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: 'Freigabe fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'approved');
      }
      toast({ title: 'Freigegeben — die Stelle geht jetzt an Matchunt zur Prüfung.' });
      fetchJobData();
    };

    const returnIntake = async () => {
      if (!returnNoteDraft.trim()) return;
      setDecidingIntake(true);
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'draft', client_approval_note: returnNoteDraft.trim() })
        .eq('id', job.id);
      setDecidingIntake(false);
      if (error) {
        toast({ title: 'Zurückgeben fehlgeschlagen', variant: 'destructive' });
        return;
      }
      if (jobCreatorId && jobCreatorId !== user?.id) {
        await notifyCreatorOfDecision(jobCreatorId, job.id, job.title, 'returned', returnNoteDraft.trim());
      }
      setShowReturnDialog(false);
      setReturnNoteDraft('');
      toast({ title: 'Zurückgegeben — der Fachbereich wurde benachrichtigt.' });
      fetchJobData();
    };

    const steps = phase === 'client_approval'
      ? ['Entwurf', 'Interne Freigabe', 'Prüfung Matchunt', 'Aktiv']
      : ['Entwurf', 'In Freigabe', 'Aktiv', 'Besetzt'];
    const stepIdx = phase === 'review' || phase === 'client_approval' ? 1 : 0;
    const flex: Record<string, string> = raw.intake_payload?.flexibility ?? {};
    const descriptor: string | null = raw.reveal_envelope?.descriptor ?? null;
    const flexLabel = (s: string) => (flex[s] === 'negotiable' ? 'verhandelbar' : flex[s] === 'flexible' ? 'flexibel' : 'fix');

    return (
      <DashboardLayout>
        <div className="mx-auto max-w-4xl space-y-4">
          <Link to="/dashboard/jobs" className="inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>

          {phase === 'returned' && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {reviewRejectionReason ? 'Aus der Prüfung zurückgegeben' : 'Vom Team zurückgegeben'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Grund: {reviewRejectionReason || clientReturnNote}
                </p>
              </div>
            </div>
          )}

          {/* Phasen-Hero */}
          <div className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold capitalize md:text-2xl">{job.title}</h1>
              {phase === 'review' ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> In Freigabe
                </Badge>
              ) : phase === 'client_approval' ? (
                <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-600">
                  <Clock className="h-3 w-3" /> Interne Freigabe
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary" className="text-xs">Entwurf</Badge>
                  <Badge variant="outline" className="border-primary/40 text-xs text-primary">Reife {reife} %</Badge>
                </>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {phase === 'review'
                ? `Eingereicht am ${new Date((raw.updated_at as string) || job.created_at).toLocaleDateString('de-DE')} — Prüfung i. d. R. unter 24 Std. Wir benachrichtigen Sie.`
                : phase === 'client_approval'
                ? `Eingereicht am ${new Date((raw.updated_at as string) || job.created_at).toLocaleDateString('de-DE')} — wartet auf interne Freigabe durch Admin/HR Ihres Teams.`
                : `zuletzt bearbeitet vor ${Math.max(0, Math.floor((Date.now() - new Date((raw.updated_at as string) || job.created_at).getTime()) / 86_400_000))} Tagen${job.location ? ` · ${job.location}` : ''}${job.remote_type ? ` · ${job.remote_type === 'remote' ? 'Remote' : job.remote_type === 'onsite' ? 'Vor Ort' : 'Hybrid'}` : ''}`}
            </p>

            {/* Status-Stepper (Kandidaten/Interviews sind Funnel, keine Status) */}
            <div className="mt-4 flex items-center gap-2 text-xs">
              {steps.map((s, i) => (
                <span key={s} className="flex flex-1 items-center gap-2 last:flex-none">
                  <span className={cn('flex items-center gap-1.5 whitespace-nowrap', i === stepIdx ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px]', i === stepIdx ? 'bg-primary text-primary-foreground' : i < stepIdx ? 'bg-primary/20 text-primary' : 'bg-muted')}>
                      {i + 1}
                    </span>
                    {s}
                  </span>
                  {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
                </span>
              ))}
            </div>

            {/* Aktionen je Phase */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              {phase === 'review' ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={withdraw}>
                  <XCircle className="h-4 w-4" /> Aus Prüfung zurückziehen
                </Button>
              ) : phase === 'client_approval' ? (
                canApproveIntake ? (
                  <>
                    <Button variant="hero" size="sm" className="gap-1.5" onClick={approveIntake} disabled={decidingIntake}>
                      {decidingIntake ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                      Freigeben & an Matchunt senden
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowReturnDialog(true)} disabled={decidingIntake}>
                      <XCircle className="h-4 w-4" /> Mit Kommentar zurückgeben
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-muted-foreground">
                      Admin/HR Ihres Teams wurden benachrichtigt und geben die Aufnahme frei.
                    </span>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={withdraw}>
                      <XCircle className="h-4 w-4" /> Zurückziehen
                    </Button>
                  </>
                )
              ) : (
                <>
                  <Button variant="hero" size="sm" className="gap-1.5" onClick={() => setStudioOpen(true)}>
                    <Sparkles className="h-4 w-4" /> Weiter im Studio
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={submitForReview} disabled={!canSubmit || submittingReview}>
                    {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Zur Prüfung einreichen
                  </Button>
                  {!canSubmit && (
                    <span className="text-xs text-muted-foreground">
                      {missing.length > 0 ? `es fehlen ${missing.join(' & ')}` : 'Briefing-Reife unter 30 %'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Briefing-Reife — die eine Score-Wahrheit */}
            <div className="rounded-xl border bg-card p-4">
              <p className="mb-2 flex items-center justify-between text-sm font-semibold">
                Briefing-Reife
                <span className="font-bold text-primary">{reife}/100</span>
              </p>
              <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${reife}%` }} />
              </div>
              {missing.map((m) => (
                <p key={m} className="mb-1.5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {m} fehlt
                </p>
              ))}
              {(job.must_haves?.length ?? 0) === 0 && (
                <p className="mb-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Circle className="mt-0.5 h-3 w-3 shrink-0" /> Muss-Kriterien definieren
                </p>
              )}
              {phase !== 'review' && phase !== 'client_approval' && (
                <Button variant="ghost" size="sm" className="mt-1 h-7 gap-1 px-2 text-xs text-primary" onClick={() => setStudioOpen(true)}>
                  Im Studio vervollständigen <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Das sehen die Recruiter (Triple-Blind-Vorschau) */}
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Lock className="h-4 w-4 text-muted-foreground" /> Das sehen die Recruiter
              </p>
              <p className="mb-2 text-sm italic text-muted-foreground">
                „{descriptor || [job.industry, job.location && `Region ${job.location}`].filter(Boolean).join(', ') || 'Anonymer Firmen-Descriptor noch offen'}"
              </p>
              {(job.must_haves?.length ?? 0) > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {(job.must_haves || []).slice(0, 6).map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px]">
                      {s} · {flexLabel(s)}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Firmen-Reveal: {raw.reveal_trigger === 'opt_in' ? 'beim Kandidaten-Opt-In' : raw.reveal_trigger === 'offer' ? 'erst beim Angebot' : 'nach dem 1. Interview'}
              </p>
            </div>
          </div>

          <JobIntakeStudio
            open={studioOpen}
            type={isFreelanceJob ? 'freelance' : 'full-time'}
            initialDraft={{ id: job.id, row: raw }}
            onOpenChange={(o) => {
              setStudioOpen(o);
              if (!o) fetchJobData();
            }}
          />

          {/* Interne Rückgabe mit Kommentar (Team-Freigabe) */}
          <Dialog open={showReturnDialog} onOpenChange={setShowReturnDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>An den Fachbereich zurückgeben</DialogTitle>
                <DialogDescription>
                  Die Aufnahme geht als Entwurf zurück. Ihr Kommentar wird dem Ersteller angezeigt.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={returnNoteDraft}
                onChange={(e) => setReturnNoteDraft(e.target.value)}
                placeholder="Was soll angepasst werden? (Pflichtfeld)"
                rows={4}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReturnDialog(false)}>
                  Abbrechen
                </Button>
                <Button onClick={returnIntake} disabled={!returnNoteDraft.trim() || decidingIntake}>
                  {decidingIntake && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Zurückgeben
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero Section */}
        <ClientJobHero
          job={job}
          stats={{
            totalSubmissions,
            inProcess,
            interviewed,
            hired,
            daysOpen,
            activeRecruiters,
          }}
          onEdit={() => setShowEditDialog(true)}
          onPauseToggle={handlePauseToggle}
          showStats={hasCandidates}
        />

        {/* Fachbereich einladen — kontextuell auf diesen Job gescoped */}
        {isOrgAdmin && myOrg && (
          <div className="flex justify-end">
            <InviteMemberDialog
              organizationId={myOrg.id}
              defaultRole="hiring_manager"
              defaultJobIds={[job.id]}
              trigger={
                <Button variant="outline" size="sm" className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Fachbereich einladen
                </Button>
              }
            />
          </div>
        )}

        {/* Phase-adaptive Bento Grid */}
        {!hasCandidates ? (
          /* PHASE 1: Draft / Fresh (0 candidates) */
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <JobQualityScoreCard
                job={job}
                hasBenefits={hasBenefits}
                onEditField={(tab) => { setEditDialogTab(tab); setShowEditDialog(true); }}
              />
              <NextStepsCard
                jobStatus={job.status}
                isPaused={!!job.paused_at}
                candidateCount={totalSubmissions}
                interviewCount={interviews.length}
                intakeCompleteness={job.intake_completeness || 0}
                onEditIntake={() => setShowEditDialog(true)}
                onViewPipeline={() => navigate(`/dashboard/command/${job.id}`)}
              />
              <SellingPointsCard
                job={job}
                hasBenefits={hasBenefits}
              />
            </div>

            {/* Executive Summary - Full Width */}
            <JobExecutiveSummary
              summary={job.job_summary}
              intakeCompleteness={job.intake_completeness || 0}
              isGenerating={isGeneratingSummary}
              onRefreshSummary={generateSummary}
              onEditIntake={() => setShowEditDialog(true)}
            />

            {/* Bottom: Communication Log + Recruiter Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CommunicationLogCard
                job={job}
                submissions={submissions}
                interviews={interviews}
              />
              <RecruiterActivityCard 
                activeRecruiters={activeRecruiters}
                totalSubmissions={totalSubmissions}
                lastSubmissionAt={lastSubmissionAt}
                weeklySubmissions={weeklySubmissions}
                onViewCandidates={() => navigate(`/dashboard/command/${job.id}`)}
              />
            </div>
          </>
        ) : (
          /* PHASE 2+: Active (1+ candidates) */
          <>
            {/* Top Candidates - Full Width, prominent */}
            <TopCandidatesCard 
              submissions={submissions}
              jobTitle={job.title}
              onCandidateClick={(submission) => {
                const fullSubmission = submissions.find(s => s.id === submission.id);
                if (fullSubmission) {
                  setSelectedSubmission(fullSubmission);
                  setShowCandidateView(true);
                }
              }}
              onViewAll={() => navigate(`/dashboard/command/${job.id}`)}
            />

            {/* Middle: Pipeline + Recruiter + Next Steps */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <PipelineSnapshotCard 
                jobId={job.id}
                submissions={submissions}
              />
              <RecruiterActivityCard 
                activeRecruiters={activeRecruiters}
                totalSubmissions={totalSubmissions}
                lastSubmissionAt={lastSubmissionAt}
                weeklySubmissions={weeklySubmissions}
                onViewCandidates={() => navigate(`/dashboard/command/${job.id}`)}
              />
              <NextStepsCard
                jobStatus={job.status}
                isPaused={!!job.paused_at}
                candidateCount={totalSubmissions}
                interviewCount={interviews.length}
                intakeCompleteness={job.intake_completeness || 0}
                onEditIntake={() => setShowEditDialog(true)}
                onViewPipeline={() => navigate(`/dashboard/command/${job.id}`)}
              />
            </div>

            {/* Executive Summary - Full Width */}
            <JobExecutiveSummary
              summary={job.job_summary}
              intakeCompleteness={job.intake_completeness || 0}
              isGenerating={isGeneratingSummary}
              onRefreshSummary={generateSummary}
              onEditIntake={() => setShowEditDialog(true)}
            />

            {/* Bottom: Communication Log + Interviews */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CommunicationLogCard
                job={job}
                submissions={submissions}
                interviews={interviews}
              />
              <UpcomingInterviewsCard 
                interviews={interviews}
                submissions={submissions.map(s => ({
                  id: s.id,
                  candidate: {
                    full_name: s.candidate.full_name,
                    seniority: s.candidate.seniority,
                  }
                }))}
                jobTitle={job.title}
                onViewInterview={(interview) => {
                  const fullSubmission = submissions.find(s => s.id === interview.submission_id);
                  if (fullSubmission) {
                    setSelectedSubmission(fullSubmission);
                    setShowCandidateView(true);
                  }
                }}
                onViewAll={() => navigate(`/dashboard/command/${job.id}`)}
              />
            </div>
          </>
        )}
      </div>

      {/* Edit Dialog */}
      <JobEditDialog 
        job={job}
        open={showEditDialog}
        onOpenChange={(open) => { setShowEditDialog(open); if (!open) setEditDialogTab(undefined); }}
        onSave={fetchJobData}
        initialTab={editDialogTab}
      />

      {/* Candidate Quick View */}
      <CandidateQuickView
        submission={selectedSubmission}
        open={showCandidateView}
        onOpenChange={setShowCandidateView}
        onStageChange={handleStageChange}
        onScheduleInterview={openScheduleInterview}
        onReject={openRejectDialog}
      />

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kandidat ablehnen</DialogTitle>
            <DialogDescription>
              {selectedSubmission?.candidate.full_name} wird für diese Position abgelehnt.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Grund der Absage</label>
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger>
                <SelectValue placeholder="Grund auswählen..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason}>
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Dialog */}
      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interview planen</DialogTitle>
            <DialogDescription>
              Interview mit Kandidat planen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Datum & Uhrzeit</label>
              <Input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notizen (optional)</label>
              <Textarea
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
                placeholder="z.B. Themen, Interviewer, Meeting-Link..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleScheduleInterview} disabled={!interviewDate}>
              Interview planen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Compare View Modal */}
      {compareOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed inset-4 z-50 overflow-auto rounded-lg border bg-background shadow-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background">
              <h2 className="text-lg font-semibold">Kandidatenvergleich</h2>
              <Button variant="ghost" size="sm" onClick={() => setCompareOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4">
              <CandidateCompareView 
                submissionIds={selectedSubmissionIds}
                onRemove={handleRemoveFromCompare}
                onClose={() => setCompareOpen(false)}
                onInterviewRequest={(submissionId) => {
                  const sub = submissions.find(s => s.id === submissionId);
                  if (sub) {
                    setSelectedSubmission(sub);
                    setShowInterviewDialog(true);
                    setCompareOpen(false);
                  }
                }}
                onReject={(submissionId) => {
                  const sub = submissions.find(s => s.id === submissionId);
                  if (sub) {
                    openRejectDialog(sub);
                    setCompareOpen(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

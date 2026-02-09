import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

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
import { CompanyInfoCard } from '@/components/client/CompanyInfoCard';

import { 
  Loader2,
  Calendar,
  X,
} from 'lucide-react';
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
  const [job, setJob] = useState<Job | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showEditDialog, setShowEditDialog] = useState(false);
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
      // Fetch job details
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

      // Fetch submissions with candidate info (without recruiter join due to FK constraint)
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          stage,
          status,
          match_score,
          submitted_at,
          recruiter_notes,
          recruiter_id,
          candidate:candidates!inner(
            id,
            full_name,
            email,
            phone,
            job_title,
            company,
            city,
            expected_salary,
            current_salary,
            availability_date,
            notice_period,
            experience_years,
            skills,
            linkedin_url,
            github_url,
            portfolio_url,
            cv_url,
            summary,
            seniority
          )
        `)
        .eq('job_id', id);

      if (submissionsError) throw submissionsError;
      
      const transformedSubmissions = (submissionsData || []).map((s: any) => ({
        ...s,
        candidate: s.candidate,
        recruiter: { email: s.recruiter_id, full_name: null },
      }));
      
      setSubmissions(transformedSubmissions);

      // Fetch interviews
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
      const { error } = await supabase
        .from('jobs')
        .update({ 
          paused_at: isPaused ? null : new Date().toISOString(),
          status: isPaused ? 'published' : job.status,
        })
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
  
  // Weekly submissions (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklySubmissions = submissions.filter(s => new Date(s.submitted_at) > weekAgo).length;
  
  // Last submission date
  const lastSubmissionAt = submissions.length > 0 
    ? submissions.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0].submitted_at
    : null;

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
        />

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Pipeline & Activity */}
          <div className="space-y-6">
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
          </div>

          {/* Center Column - Executive Summary */}
          <div className="lg:col-span-2 space-y-6">
            <JobExecutiveSummary
              summary={job.job_summary}
              intakeCompleteness={job.intake_completeness || 0}
              isGenerating={isGeneratingSummary}
              onRefreshSummary={generateSummary}
              onEditIntake={() => setShowEditDialog(true)}
            />
          </div>
        </div>

        {/* Top Candidates - Full Width */}
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

        {/* Bottom Row - Interviews & Company */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
          <CompanyInfoCard
            companyName={job.company_name}
            industry={job.industry}
            location={job.location}
          />
        </div>
      </div>

      {/* Edit Dialog */}
      <JobEditDialog 
        job={job}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={fetchJobData}
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

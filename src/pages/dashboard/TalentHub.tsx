import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { PipelineColumn, PipelineColumnSkeleton } from '@/components/pipeline/PipelineColumn';
import { ContextPanel } from '@/components/talent/ContextPanel';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { PIPELINE_STAGES, PipelineCandidate } from '@/hooks/useHiringPipeline';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { 
  Loader2,
  Briefcase,
  ChevronDown,
  Check,
  ArrowLeft,
  LayoutGrid
} from 'lucide-react';

interface TalentSubmission {
  id: string;
  status: string;
  stage: string;
  submitted_at: string;
  match_score: number | null;
  candidateId: string;
  candidateName: string;
  currentRole: string;
  jobId: string;
  jobTitle: string;
  email?: string;
  phone?: string;
}

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  notes: string | null;
  submission: {
    id: string;
    candidate: {
      full_name: string;
      email: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
}

interface Job {
  id: string;
  title: string;
}

export default function TalentHub() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  const [showGridView, setShowGridView] = useState(false);
  
  const [submissions, setSubmissions] = useState<TalentSubmission[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  
  usePageViewTracking('talent_hub');

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user, selectedJobId]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchJobs(),
        fetchSubmissions(),
        fetchInterviews()
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data);
      if (!selectedJobId && data.length > 0) {
        setSelectedJobId(data[0].id);
      }
    }
  };

  const fetchSubmissions = async () => {
    let query = supabase
      .from('submissions')
      .select(`
        id,
        status,
        stage,
        submitted_at,
        match_score,
        candidates!inner (
          id,
          full_name,
          job_title,
          email,
          phone
        ),
        jobs!inner (
          id,
          title
        )
      `)
      .order('submitted_at', { ascending: false });

    if (selectedJobId) {
      query = query.eq('job_id', selectedJobId);
    }

    const { data: submissionsData, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      return;
    }

    const talentSubmissions: TalentSubmission[] = (submissionsData || []).map((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;

      return {
        id: sub.id,
        status: sub.status,
        stage: sub.stage || sub.status,
        submitted_at: sub.submitted_at,
        match_score: sub.match_score,
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        currentRole: candidate.job_title || 'Nicht angegeben',
        jobId: job.id,
        jobTitle: job.title,
        email: candidate.email,
        phone: candidate.phone
      };
    });

    setSubmissions(talentSubmissions);
  };

  const fetchInterviews = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        *,
        submission:submissions(
          id,
          candidate:candidates(full_name, email),
          job:jobs(title, company_name)
        )
      `)
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      setInterviews(data as unknown as Interview[]);
    }
  };

  const handleMove = async (submissionId: string, newStage: string) => {
    setProcessing(true);
    try {
      const newStatus = newStage === 'interview_1' || newStage === 'interview_2' ? 'interview' : newStage;
      
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage, status: newStatus })
        .eq('id', submissionId);

      if (error) throw error;

      if (newStage === 'interview_1' || newStage === 'interview_2') {
        await supabase.from('interviews').insert({
          submission_id: submissionId,
          status: 'pending',
          notes: newStage === 'interview_2' ? 'Zweites Interview' : 'Erstes Interview'
        });
      }

      const stageLabel = PIPELINE_STAGES.find(s => s.key === newStage)?.label || newStage;
      toast.success(`Kandidat in "${stageLabel}" verschoben`);
      fetchSubmissions();
      fetchInterviews();
    } catch (error) {
      toast.error('Fehler beim Verschieben');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setRejectDialogOpen(true);
  };

  const handleRejectSuccess = () => {
    fetchSubmissions();
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId === 'all' ? undefined : jobId);
    setJobSelectorOpen(false);
  };

  const getCandidatesByStage = (stage: string) => {
    return submissions.filter(s => {
      const candidateStage = s.stage || s.status;
      return candidateStage === stage && s.status !== 'rejected';
    });
  };

  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = getCandidatesByStage(stage.key).length;
    return acc;
  }, {} as Record<string, number>);

  const newSubmissionsCount = stageCounts['submitted'] || 0;

  const pendingActions = useMemo(() => ({
    feedbackPending: 0,
    overdueInterviews: interviews.filter(i => {
      if (!i.scheduled_at || i.status === 'completed' || i.status === 'cancelled') return false;
      return new Date(i.scheduled_at) < new Date();
    }).length,
    newSubmissions: newSubmissionsCount
  }), [interviews, newSubmissionsCount]);

  if (loading && jobs.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        <SlaWarningBanner />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 pb-4">
          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            
            <div>
              <h1 className="text-xl font-semibold">Talent Hub</h1>
              {selectedJob && (
                <p className="text-sm text-muted-foreground">
                  {selectedJob.title}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Grid Toggle - Small, non-prominent */}
            <Button
              variant={showGridView ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowGridView(!showGridView)}
              title="Grid-Ansicht"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>

            {/* Job Filter - Prominent */}
            <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 min-w-[200px] justify-between font-medium"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="truncate">{selectedJob?.title || 'Job auswählen'}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-1" align="end">
                <div className="space-y-0.5">
                  {jobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Keine Jobs vorhanden
                    </p>
                  ) : (
                    <>
                      <button
                        onClick={() => handleSelectJob('all')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left transition-colors"
                      >
                        <span className="flex-1">Alle Jobs</span>
                        {!selectedJobId && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                      {jobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => handleSelectJob(job.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent text-left transition-colors"
                        >
                          <span className="flex-1 truncate">{job.title}</span>
                          {job.id === selectedJobId && (
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Main Content: Pipeline + Context Panel */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Pipeline Kanban - Main View */}
          <div className="flex-1 min-w-0">
            {!selectedJobId && jobs.length > 0 ? (
              <div className="flex items-center justify-center h-64 text-center">
                <div className="space-y-2">
                  <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                  <p className="text-muted-foreground">
                    Wähle einen Job, um die Pipeline zu sehen
                  </p>
                </div>
              </div>
            ) : (
              <TooltipProvider>
                <ScrollArea className="h-full">
                  <div className="flex gap-3 pb-4 min-h-[400px]">
                    {loading ? (
                      PIPELINE_STAGES.map((stage) => (
                        <PipelineColumnSkeleton key={stage.key} />
                      ))
                    ) : (
                      PIPELINE_STAGES.map((stage) => (
                        <PipelineColumn
                          key={stage.key}
                          stage={stage}
                          candidates={getCandidatesByStage(stage.key).map(s => {
                            const now = new Date();
                            const submittedAt = new Date(s.submitted_at);
                            const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
                            
                            return {
                              id: s.id,
                              submittedAt: s.submitted_at,
                              stage: s.stage,
                              status: s.status,
                              matchScore: s.match_score,
                              hoursInStage,
                              candidate: {
                                id: s.candidateId,
                                fullName: s.candidateName,
                                email: s.email || '',
                                phone: s.phone || null,
                                expectedSalary: null,
                                experienceYears: null
                              },
                              recruiter: null,
                              interviewScheduledAt: null,
                              offerStatus: null
                            } as PipelineCandidate;
                          })}
                          onMove={handleMove}
                          onReject={handleReject}
                          isProcessing={processing}
                        />
                      ))
                    )}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </TooltipProvider>
            )}
          </div>

          {/* Context Panel - Right Side */}
          <ContextPanel
            interviews={interviews}
            stageCounts={stageCounts}
            pendingActions={pendingActions}
          />
        </div>
      </div>

      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        submission={selectedSubmissionId ? { id: selectedSubmissionId } as any : null}
        onSuccess={handleRejectSuccess}
      />
    </DashboardLayout>
  );
}

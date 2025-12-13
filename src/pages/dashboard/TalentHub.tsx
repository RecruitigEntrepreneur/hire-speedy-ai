import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { PipelineColumn, PipelineColumnSkeleton } from '@/components/pipeline/PipelineColumn';
import { ClientCandidateCard } from '@/components/candidates/ClientCandidateCard';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { BottleneckSummary } from '@/components/pipeline/BottleneckSummary';
import { PIPELINE_STAGES, PipelineCandidate } from '@/hooks/useHiringPipeline';

import { usePageViewTracking, useEventTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

import { 
  Loader2,
  Users,
  Calendar,
  CheckCircle,
  Kanban,
  LayoutGrid,
  CalendarDays,
  Briefcase,
  ChevronDown,
  Check,
  User,
  ArrowLeft,
  Video,
  Phone,
  MapPin,
  Clock,
  XCircle
} from 'lucide-react';

type ViewMode = 'kanban' | 'cards' | 'calendar';

interface HardFacts {
  role_seniority: string;
  top_skills: string[];
  location_commute: string;
  work_model: string;
  salary_range: string;
  availability: string;
}

interface TalentSubmission {
  id: string;
  status: string;
  stage: string;
  submitted_at: string;
  match_score: number | null;
  candidateId: string;
  candidateName: string;
  currentRole: string;
  dealProbability: number;
  executiveSummary: string[];
  hardFacts: HardFacts;
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
  const initialView = (searchParams.get('view') as ViewMode) || 'kanban';
  
  const [viewMode, setViewMode] = useState<ViewMode>(initialView);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
  
  const [submissions, setSubmissions] = useState<TalentSubmission[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  
  const { trackAction } = useEventTracking();
  usePageViewTracking('talent_hub');

  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Fetch all data
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
      // Auto-select first job if none selected
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
          city,
          experience_years,
          skills,
          expected_salary,
          notice_period,
          remote_preference,
          availability_date,
          seniority,
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

    const submissionIds = (submissionsData || []).map(s => s.id);
    
    // Fetch summaries
    const { data: summaries } = await supabase
      .from('candidate_client_summary')
      .select('*')
      .in('submission_id', submissionIds);

    const summaryMap = new Map(summaries?.map(s => [s.submission_id, s]) || []);

    // Fetch health data
    const { data: healthData } = await supabase
      .from('deal_health')
      .select('*')
      .in('submission_id', submissionIds);

    const healthMap = new Map(healthData?.map(h => [h.submission_id, h]) || []);

    const talentSubmissions: TalentSubmission[] = (submissionsData || []).map((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const summary = summaryMap.get(sub.id);
      const health = healthMap.get(sub.id);

      const hardFacts: HardFacts = {
        role_seniority: `${candidate.seniority || ''} ${candidate.job_title || ''}`.trim() || 'Nicht angegeben',
        top_skills: (candidate.skills || []).slice(0, 5),
        location_commute: candidate.city || 'Nicht angegeben',
        work_model: getWorkModelLabel(candidate.remote_preference),
        salary_range: formatSalaryRange(candidate.expected_salary),
        availability: formatAvailability(candidate.notice_period, candidate.availability_date)
      };

      let executiveSummary: string[] = [];
      if (summary?.key_selling_points && Array.isArray(summary.key_selling_points)) {
        executiveSummary = summary.key_selling_points as string[];
      } else if (summary?.executive_summary) {
        executiveSummary = (summary.executive_summary as string).split('\n').filter(Boolean);
      }

      if (executiveSummary.length === 0) {
        executiveSummary = [
          `${candidate.experience_years || 0}+ Jahre Berufserfahrung`,
          `Aktuelle Rolle: ${candidate.job_title || 'Nicht angegeben'}`,
          `Standort: ${candidate.city || 'Nicht angegeben'}`
        ].filter(Boolean);
      }

      return {
        id: sub.id,
        status: sub.status,
        stage: sub.stage || sub.status, // Fallback to status if stage not set
        submitted_at: sub.submitted_at,
        match_score: sub.match_score,
        candidateId: candidate.id,
        candidateName: candidate.full_name,
        currentRole: candidate.job_title || 'Nicht angegeben',
        dealProbability: summary?.deal_probability || (health?.drop_off_probability ? 100 - health.drop_off_probability : 50),
        executiveSummary,
        hardFacts,
        jobId: job.id,
        jobTitle: job.title,
        email: candidate.email,
        phone: candidate.phone
      };
    });

    setSubmissions(talentSubmissions);
  };

  const fetchInterviews = async () => {
    let query = supabase
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

    const { data, error } = await query;

    if (!error && data) {
      setInterviews(data as unknown as Interview[]);
    }
  };

  // Actions
  const handleMove = async (submissionId: string, newStage: string) => {
    setProcessing(true);
    try {
      const newStatus = newStage === 'interview_1' || newStage === 'interview_2' ? 'interview' : newStage;
      
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage, status: newStatus })
        .eq('id', submissionId);

      if (error) throw error;

      // Create interview record for interview stages
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

  const handleRequestInterview = async (submissionId: string) => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ status: 'interview', stage: 'interview_1' })
        .eq('id', submissionId);

      if (!error) {
        await supabase.from('interviews').insert({
          submission_id: submissionId,
          status: 'pending',
        });
        toast.success('Interview angefragt');
        trackAction('request_interview', 'submission', submissionId);
        fetchSubmissions();
        fetchInterviews();
      } else {
        toast.error('Fehler beim Anfragen');
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleBookmark = (submissionId: string) => {
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(submissionId)) {
        newSet.delete(submissionId);
        toast.success('Lesezeichen entfernt');
      } else {
        newSet.add(submissionId);
        toast.success('Kandidat gemerkt');
      }
      return newSet;
    });
    trackAction('bookmark_candidate', 'submission', submissionId);
  };

  const handleSelectJob = (jobId: string) => {
    setSelectedJobId(jobId === 'all' ? undefined : jobId);
    setJobSelectorOpen(false);
  };

  const handleInterviewComplete = async (interview: Interview, hired: boolean) => {
    setProcessing(true);
    
    await supabase
      .from('interviews')
      .update({ status: hired ? 'completed' : 'cancelled' })
      .eq('id', interview.id);

    await supabase
      .from('submissions')
      .update({ 
        status: hired ? 'hired' : 'rejected',
        stage: hired ? 'hired' : 'rejected'
      })
      .eq('id', interview.submission.id);

    if (hired) {
      await supabase.from('placements').insert({
        submission_id: interview.submission.id,
        payment_status: 'pending',
      });
      toast.success('Kandidat eingestellt! Placement erstellt.');
    } else {
      toast.success('Interview abgeschlossen');
    }
    
    fetchAllData();
    setProcessing(false);
  };

  // Computed values
  const getCandidatesByStage = (stage: string) => {
    return submissions.filter(s => {
      // Handle legacy data where stage might not be set
      const candidateStage = s.stage || s.status;
      return candidateStage === stage && s.status !== 'rejected';
    });
  };

  const stageCounts = PIPELINE_STAGES.reduce((acc, stage) => {
    acc[stage.key] = getCandidatesByStage(stage.key).length;
    return acc;
  }, {} as Record<string, number>);

  const filterSubmissions = (status: string) => {
    if (status === 'all') return submissions.filter(s => s.status !== 'rejected');
    if (status === 'new') return submissions.filter(s => s.stage === 'submitted' || s.status === 'submitted');
    if (status === 'bookmarked') return submissions.filter(s => bookmarkedIds.has(s.id));
    if (status === 'interview') return submissions.filter(s => s.stage === 'interview_1' || s.stage === 'interview_2' || s.status === 'interview');
    return submissions.filter(s => s.status === status);
  };

  const newCount = filterSubmissions('new').length;
  const interviewCount = filterSubmissions('interview').length;
  const avgMatchScore = submissions.length > 0 
    ? Math.round(submissions.reduce((acc, s) => acc + (s.match_score || 0), 0) / submissions.length)
    : 0;

  const upcomingInterviews = interviews.filter(i => 
    i.status !== 'completed' && i.status !== 'cancelled'
  );

  // Map submissions to pipeline candidates format
  const pipelineCandidates = useMemo(() => {
    return submissions.map(s => ({
      id: s.id,
      submissionId: s.id,
      name: s.candidateName,
      role: s.currentRole,
      matchScore: s.match_score,
      status: s.status,
      stage: s.stage || s.status,
      submittedAt: s.submitted_at
    }));
  }, [submissions]);

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
      <div className="space-y-4">
        <SlaWarningBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            
            <div>
              <h1 className="text-2xl font-bold">Talent Hub</h1>
              <p className="text-muted-foreground text-sm">
                {submissions.length} Kandidaten insgesamt
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Job Filter */}
            <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  className="gap-2 min-w-[180px] justify-between"
                >
                  <Briefcase className="h-4 w-4" />
                  <span className="truncate">{selectedJob?.title || 'Alle Jobs'}</span>
                  <ChevronDown className="h-4 w-4 shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-1" align="end">
                <div className="space-y-0.5">
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
                </div>
              </PopoverContent>
            </Popover>

            {/* View Toggle */}
            <div className="flex items-center border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('kanban')}
                className="gap-1.5"
              >
                <Kanban className="h-4 w-4" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Karten</span>
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="gap-1.5"
              >
                <CalendarDays className="h-4 w-4" />
                <span className="hidden sm:inline">Kalender</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{submissions.filter(s => s.status !== 'rejected').length}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{newCount}</p>
                <p className="text-xs text-muted-foreground">Neu</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{interviewCount}</p>
                <p className="text-xs text-muted-foreground">Interviews</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgMatchScore}%</p>
                <p className="text-xs text-muted-foreground">Ø Match</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Bottleneck Summary for Kanban */}
        {viewMode === 'kanban' && pipelineCandidates.length > 0 && (
          <BottleneckSummary candidates={pipelineCandidates as any} />
        )}

        {/* KANBAN VIEW */}
        {viewMode === 'kanban' && (
          <TooltipProvider>
            <ScrollArea className="w-full">
              <div className={`flex gap-3 pb-4 ${submissions.length === 0 ? 'min-h-[200px]' : 'min-h-[400px]'}`}>
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

        {/* CARDS VIEW */}
        {viewMode === 'cards' && (
          <Tabs defaultValue="new" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="new" className="gap-1.5">
                Neu
                <Badge variant="secondary" className="ml-1 text-xs">{newCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="interview" className="gap-1.5">
                Interview
                <Badge variant="secondary" className="ml-1 text-xs">{interviewCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="bookmarked" className="gap-1.5">
                Gemerkt
                <Badge variant="secondary" className="ml-1 text-xs">{filterSubmissions('bookmarked').length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all">Alle</TabsTrigger>
            </TabsList>

            {['new', 'interview', 'bookmarked', 'all'].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4">
                {filterSubmissions(tab).length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <User className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Keine Kandidaten in dieser Kategorie</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filterSubmissions(tab).map((submission) => (
                      <ClientCandidateCard
                        key={submission.id}
                        submissionId={submission.id}
                        candidateId={submission.candidateId}
                        candidateName={submission.candidateName}
                        currentRole={submission.currentRole}
                        matchScore={submission.match_score}
                        dealProbability={submission.dealProbability}
                        status={submission.status}
                        hardFacts={submission.hardFacts}
                        executiveSummary={submission.executiveSummary}
                        jobTitle={submission.jobTitle}
                        onRequestInterview={() => handleRequestInterview(submission.id)}
                        onReject={() => handleReject(submission.id)}
                        onBookmark={() => handleBookmark(submission.id)}
                        isBookmarked={bookmarkedIds.has(submission.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* CALENDAR VIEW */}
        {viewMode === 'calendar' && (
          <div className="space-y-4">
            <Tabs defaultValue="calendar">
              <TabsList>
                <TabsTrigger value="calendar">
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Wochenansicht
                </TabsTrigger>
                <TabsTrigger value="list">
                  Anstehend ({upcomingInterviews.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="mt-4">
                <InterviewCalendarView 
                  interviews={interviews}
                  onSelectInterview={(interview) => setEditingInterview(interview)}
                />
              </TabsContent>

              <TabsContent value="list" className="mt-4">
                <div className="grid gap-4">
                  {upcomingInterviews.length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Keine anstehenden Interviews</p>
                      </CardContent>
                    </Card>
                  ) : (
                    upcomingInterviews.map((interview) => (
                      <Card key={interview.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">
                                  {interview.submission.candidate.full_name}
                                </h3>
                                <Badge variant={interview.status === 'scheduled' ? 'default' : 'outline'}>
                                  {interview.status === 'scheduled' ? 'Geplant' : 'Ausstehend'}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {interview.submission.job.title} bei {interview.submission.job.company_name}
                              </p>
                              
                              {interview.scheduled_at && (
                                <div className="flex items-center gap-4 text-sm mt-3">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                    {format(new Date(interview.scheduled_at), 'PPP', { locale: de })}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                    {format(new Date(interview.scheduled_at), 'HH:mm')} Uhr
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {interview.meeting_link && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                                    Meeting beitreten
                                  </a>
                                </Button>
                              )}
                              <Button 
                                variant="default" 
                                size="sm"
                                onClick={() => handleInterviewComplete(interview, true)}
                                disabled={processing}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Einstellen
                              </Button>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleInterviewComplete(interview, false)}
                                disabled={processing}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Absagen
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
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

// Helper functions
function getWorkModelLabel(preference: string | null): string {
  if (!preference) return 'Flexibel';
  const labels: Record<string, string> = {
    'remote': 'Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return labels[preference] || preference;
}

function formatSalaryRange(salary: number | null): string {
  if (!salary) return 'k.A.';
  return `€${(salary / 1000).toFixed(0)}k`;
}

function formatAvailability(noticePeriod: string | null, availabilityDate: string | null): string {
  if (availabilityDate) {
    const date = new Date(availabilityDate);
    return `Ab ${date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
  }
  if (noticePeriod) {
    return noticePeriod;
  }
  return 'Sofort';
}

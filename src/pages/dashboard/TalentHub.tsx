import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';

import { PipelineBar } from '@/components/talent/PipelineBar';
import { UrgentBanner } from '@/components/talent/UrgentBanner';
import { CandidateGrid } from '@/components/talent/CandidateGrid';
import { CandidateDetailPanel } from '@/components/talent/CandidateDetailPanel';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';

import { 
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { isPast, isToday } from 'date-fns';

interface Interview {
  id: string;
  scheduled_at: string | null;
  status: string | null;
  meeting_link: string | null;
  submission_id: string;
  candidateName: string;
  jobTitle: string;
}

interface Job {
  id: string;
  title: string;
}

// Extended candidate type for grid and detail panel
interface ExtendedTableCandidate {
  id: string;
  submissionId: string;
  name: string;
  currentRole: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  status: string;
  matchScore: number | null;
  submittedAt: string;
  email?: string;
  phone?: string;
  hoursInStage: number;
  company?: string;
  skills?: string[];
  experienceYears?: number;
  cvAiBullets?: string[];
  cvAiSummary?: string;
  noticePeriod?: string;
  availabilityDate?: string;
  exposeHighlights?: string[];
  currentSalary?: number;
  expectedSalary?: number;
  city?: string;
}

export default function TalentHub() {
  const { user } = useAuth();
  
  const [candidates, setCandidates] = useState<ExtendedTableCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [stageFilter, setStageFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<ExtendedTableCandidate | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  
  const [rejectSubmissionId, setRejectSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  
  usePageViewTracking('talent_hub');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchJobs(),
        fetchCandidates(),
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
    }
  };

  const fetchCandidates = async () => {
    const { data, error } = await supabase
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
          phone,
          company,
          skills,
          experience_years,
          cv_ai_bullets,
          cv_ai_summary,
          notice_period,
          availability_date,
          expose_highlights,
          current_salary,
          expected_salary,
          city
        ),
        jobs!inner (
          id,
          title
        )
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return;
    }

    const tableCandidates: ExtendedTableCandidate[] = [];

    (data || []).forEach((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const now = new Date();
      const submittedAt = new Date(sub.submitted_at);
      const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));

      // Extended table candidate with all fields for detail panel
      tableCandidates.push({
        id: candidate.id,
        submissionId: sub.id,
        name: candidate.full_name,
        currentRole: candidate.job_title || 'Nicht angegeben',
        jobId: job.id,
        jobTitle: job.title,
        stage: sub.stage || sub.status,
        status: sub.status,
        matchScore: sub.match_score,
        submittedAt: sub.submitted_at,
        email: candidate.email,
        phone: candidate.phone,
        hoursInStage,
        // Extended fields for detail panel
        company: candidate.company,
        skills: candidate.skills,
        experienceYears: candidate.experience_years,
        cvAiBullets: candidate.cv_ai_bullets,
        cvAiSummary: candidate.cv_ai_summary,
        noticePeriod: candidate.notice_period,
        availabilityDate: candidate.availability_date,
        exposeHighlights: candidate.expose_highlights,
        currentSalary: candidate.current_salary,
        expectedSalary: candidate.expected_salary,
        city: candidate.city
      });
    });

    setCandidates(tableCandidates);
  };

  const fetchInterviews = async () => {
    const { data, error } = await supabase
      .from('interviews')
      .select(`
        id,
        scheduled_at,
        status,
        meeting_link,
        submission_id,
        submission:submissions(
          id,
          candidate:candidates(full_name),
          job:jobs(title)
        )
      `)
      .order('scheduled_at', { ascending: true });

    if (!error && data) {
      const formattedInterviews: Interview[] = data.map((i: any) => ({
        id: i.id,
        scheduled_at: i.scheduled_at,
        status: i.status,
        meeting_link: i.meeting_link,
        submission_id: i.submission_id,
        candidateName: i.submission?.candidate?.full_name || 'Unbekannt',
        jobTitle: i.submission?.job?.title || 'Unbekannt'
      }));
      setInterviews(formattedInterviews);
    }
  };

  // Calculate stage counts
  const stageCounts = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
      return acc;
    }, {} as Record<string, number>);
  }, [candidates]);

  // Build urgent items
  const urgentItems = useMemo(() => {
    const items: { id: string; type: 'overdue' | 'interview_today' | 'waiting_long'; title: string; subtitle: string; submissionId: string; scheduledAt?: string; meetingLink?: string }[] = [];

    // Candidates waiting > 48h
    candidates
      .filter(c => c.stage === 'submitted' && c.status !== 'rejected' && c.hoursInStage >= 48)
      .slice(0, 5)
      .forEach(c => {
        items.push({
          id: `waiting-${c.submissionId}`,
          type: 'waiting_long',
          title: c.name,
          subtitle: c.jobTitle,
          submissionId: c.submissionId
        });
      });

    // Interviews today
    interviews
      .filter(i => i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status !== 'completed' && i.status !== 'cancelled')
      .forEach(i => {
        items.push({
          id: `interview-${i.id}`,
          type: 'interview_today',
          title: i.candidateName,
          subtitle: i.jobTitle,
          submissionId: i.submission_id,
          scheduledAt: i.scheduled_at!,
          meetingLink: i.meeting_link || undefined
        });
      });

    // Overdue interviews
    interviews
      .filter(i => i.scheduled_at && isPast(new Date(i.scheduled_at)) && i.status !== 'completed' && i.status !== 'cancelled' && !isToday(new Date(i.scheduled_at)))
      .forEach(i => {
        items.push({
          id: `overdue-${i.id}`,
          type: 'overdue',
          title: i.candidateName,
          subtitle: `${i.jobTitle} - Feedback ausstehend`,
          submissionId: i.submission_id,
          scheduledAt: i.scheduled_at!
        });
      });

    return items;
  }, [candidates, interviews]);

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
      
      setCandidates(prev => prev.map(c => 
        c.submissionId === submissionId 
          ? { ...c, stage: newStage, status: newStatus }
          : c
      ));
      
      if (selectedCandidate?.submissionId === submissionId) {
        setSelectedCandidate(prev => prev ? { ...prev, stage: newStage, status: newStatus } : null);
      }
      
      fetchInterviews();
    } catch (error) {
      toast.error('Fehler beim Verschieben');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = (submissionId: string) => {
    setRejectSubmissionId(submissionId);
    setRejectDialogOpen(true);
  };

  const handleRejectSuccess = () => {
    setCandidates(prev => prev.map(c => 
      c.submissionId === rejectSubmissionId 
        ? { ...c, status: 'rejected' }
        : c
    ));
    if (selectedCandidate?.submissionId === rejectSubmissionId) {
      setSelectedCandidate(null);
      setDetailOpen(false);
    }
  };

  const handleSelectCandidate = (candidate: ExtendedTableCandidate) => {
    setSelectedCandidate(candidate);
    setDetailOpen(true);
  };

  const handleToggleSelect = (submissionId: string) => {
    setSelectedIds(prev => 
      prev.includes(submissionId)
        ? prev.filter(id => id !== submissionId)
        : [...prev, submissionId]
    );
  };

  const handleSelectAll = () => {
    const visibleCandidates = candidates.filter(c => 
      c.status !== 'rejected' && 
      (stageFilter === 'all' || c.stage === stageFilter)
    );
    const allSelected = visibleCandidates.every(c => selectedIds.includes(c.submissionId));
    
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(visibleCandidates.map(c => c.submissionId));
    }
  };

  const handleUrgentItemClick = (submissionId: string) => {
    const candidate = candidates.find(c => c.submissionId === submissionId);
    if (candidate) {
      setSelectedCandidate(candidate);
      setDetailOpen(true);
    }
  };

  const totalActiveCandidates = candidates.filter(c => c.status !== 'rejected').length;

  if (loading) {
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
      <div className="h-full flex flex-col -m-6">
        <SlaWarningBanner />

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b bg-background">
          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Talent Hub</h1>
              <p className="text-xs text-muted-foreground">
                {totalActiveCandidates} aktive Kandidaten • {jobs.length} Jobs
              </p>
            </div>
          </div>
        </div>

        {/* Urgent Banner */}
        <UrgentBanner 
          items={urgentItems} 
          onItemClick={handleUrgentItemClick} 
        />

        {/* Pipeline Bar */}
        <PipelineBar
          stageCounts={stageCounts}
          activeStage={stageFilter}
          onStageClick={setStageFilter}
          totalCandidates={totalActiveCandidates}
        />

        {/* Candidate Grid */}
        <div className="flex-1 min-h-0">
          <CandidateGrid
            candidates={candidates}
            jobs={jobs}
            stageFilter={stageFilter}
            onSelect={handleSelectCandidate}
            onMove={handleMove}
            onReject={handleReject}
            isProcessing={processing}
          />
        </div>
      </div>

      {/* Detail Panel (Overlay) */}
      <CandidateDetailPanel
        candidate={selectedCandidate}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onMove={handleMove}
        onReject={handleReject}
        isProcessing={processing}
      />

      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        submission={rejectSubmissionId ? { id: rejectSubmissionId } as any : null}
        onSuccess={handleRejectSuccess}
      />
    </DashboardLayout>
  );
}

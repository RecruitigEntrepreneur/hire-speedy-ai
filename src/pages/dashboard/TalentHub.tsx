import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';

import { ActionQueue, ActionItem } from '@/components/talent/ActionQueue';
import { CandidateStream, StreamCandidate } from '@/components/talent/CandidateStream';
import { CandidateDetailPanel } from '@/components/talent/CandidateDetailPanel';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';

import { 
  Loader2,
  ArrowLeft,
  LayoutGrid,
  List
} from 'lucide-react';
import { isPast, differenceInHours, isToday } from 'date-fns';

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

export default function TalentHub() {
  const { user } = useAuth();
  
  const [candidates, setCandidates] = useState<StreamCandidate[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  const [selectedCandidate, setSelectedCandidate] = useState<StreamCandidate | null>(null);
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
          phone
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

    const streamCandidates: StreamCandidate[] = (data || []).map((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const now = new Date();
      const submittedAt = new Date(sub.submitted_at);
      const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));

      return {
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
        hoursInStage
      };
    });

    setCandidates(streamCandidates);
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

  // Build action items from data
  const actionItems = useMemo((): ActionItem[] => {
    const actions: ActionItem[] = [];

    // New candidates to review
    candidates
      .filter(c => c.stage === 'submitted' && c.status !== 'rejected')
      .slice(0, 10)
      .forEach(c => {
        const isUrgent = c.hoursInStage >= 48;
        const isHigh = c.hoursInStage >= 24;
        actions.push({
          id: `review-${c.submissionId}`,
          type: 'review_candidate',
          priority: isUrgent ? 'urgent' : isHigh ? 'high' : 'normal',
          title: c.name,
          subtitle: c.jobTitle,
          submissionId: c.submissionId,
          candidateId: c.id
        });
      });

    // Interviews to schedule
    interviews
      .filter(i => i.status === 'pending' && !i.scheduled_at)
      .forEach(i => {
        const candidate = candidates.find(c => c.submissionId === i.submission_id);
        actions.push({
          id: `schedule-${i.id}`,
          type: 'schedule_interview',
          priority: 'high',
          title: i.candidateName,
          subtitle: i.jobTitle,
          submissionId: i.submission_id,
          candidateId: candidate?.id || ''
        });
      });

    // Upcoming interviews today
    interviews
      .filter(i => i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status !== 'completed' && i.status !== 'cancelled')
      .forEach(i => {
        const candidate = candidates.find(c => c.submissionId === i.submission_id);
        actions.push({
          id: `join-${i.id}`,
          type: 'join_interview',
          priority: 'high',
          title: i.candidateName,
          subtitle: i.jobTitle,
          submissionId: i.submission_id,
          candidateId: candidate?.id || '',
          scheduledAt: i.scheduled_at!,
          meetingLink: i.meeting_link || undefined
        });
      });

    // Overdue interviews
    interviews
      .filter(i => i.scheduled_at && isPast(new Date(i.scheduled_at)) && i.status !== 'completed' && i.status !== 'cancelled')
      .forEach(i => {
        const candidate = candidates.find(c => c.submissionId === i.submission_id);
        actions.push({
          id: `overdue-${i.id}`,
          type: 'overdue',
          priority: 'urgent',
          title: i.candidateName,
          subtitle: `${i.jobTitle} - Feedback ausstehend`,
          submissionId: i.submission_id,
          candidateId: candidate?.id || '',
          scheduledAt: i.scheduled_at!
        });
      });

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, normal: 2 };
    return actions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
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
      
      // Update local state
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
    }
  };

  const handleSelectAction = (action: ActionItem) => {
    const candidate = candidates.find(c => c.submissionId === action.submissionId);
    if (candidate) {
      setSelectedCandidate(candidate);
    }
  };

  const handleSelectCandidate = (candidate: StreamCandidate) => {
    setSelectedCandidate(candidate);
  };

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
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <Link 
              to="/dashboard" 
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold">Talent Hub</h1>
              <p className="text-sm text-muted-foreground">
                {candidates.filter(c => c.status !== 'rejected').length} aktive Kandidaten • {jobs.length} Jobs
              </p>
            </div>
          </div>
        </div>

        {/* Three-Panel Layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left: Action Queue */}
          <div className="w-72 shrink-0 border-r">
            <ActionQueue
              actions={actionItems}
              onSelectAction={handleSelectAction}
              selectedId={selectedCandidate?.submissionId}
            />
          </div>

          {/* Middle: Candidate Stream */}
          <div className="flex-1 min-w-0 border-r">
            <CandidateStream
              candidates={candidates}
              jobs={jobs}
              selectedId={selectedCandidate?.submissionId}
              onSelect={handleSelectCandidate}
              onMove={handleMove}
              onReject={handleReject}
              isProcessing={processing}
            />
          </div>

          {/* Right: Detail Panel */}
          <div className="w-96 shrink-0">
            <CandidateDetailPanel
              candidate={selectedCandidate}
              onClose={() => setSelectedCandidate(null)}
              onMove={handleMove}
              onReject={handleReject}
              isProcessing={processing}
            />
          </div>
        </div>
      </div>

      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        submission={rejectSubmissionId ? { id: rejectSubmissionId } as any : null}
        onSuccess={handleRejectSuccess}
      />
    </DashboardLayout>
  );
}
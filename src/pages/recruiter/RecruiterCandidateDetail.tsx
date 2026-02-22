import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';

import { Candidate } from '@/components/candidates/CandidateCard';
import { AddActivityDialog } from '@/components/candidates/AddActivityDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';
import { CandidateInterviewTab } from '@/components/candidates/CandidateInterviewTab';
import { CandidatePlaybookPanel } from '@/components/candidates/CandidatePlaybookPanel';
import { CandidateHeroHeader } from '@/components/candidates/CandidateHeroHeader';
import { CandidateActionBar } from '@/components/candidates/CandidateActionBar';
import { CandidateMainContent } from '@/components/candidates/CandidateMainContent';
import { InterviewCardSlider } from '@/components/candidates/InterviewCardSlider';

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Neu', contacted: 'Kontaktiert', interview: 'Interview',
    offer: 'Angebot', placed: 'Platziert', rejected: 'Absage',
  };
  return labels[status] || status;
}

export default function RecruiterCandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTaskId = searchParams.get('task') || undefined;
  const alertId = searchParams.get('alert') || undefined;
  const playbookId = searchParams.get('playbook') || undefined;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Tab state from URL
  const activeTab = activeTaskId ? 'process' : (searchParams.get('tab') || 'overview');
  const handleTabChange = useCallback((tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [showFullInterview, setShowFullInterview] = useState(false);
  const [interviewSliderOpen, setInterviewSliderOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { getCandidateTags } = useCandidateTags();
  const candidateTags = candidate ? getCandidateTags(candidate.id) : [];

  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);

  const { data: submissions } = useQuery({
    queryKey: ['candidate-submissions-header', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, status, submitted_at, job:jobs(id, title)')
        .eq('candidate_id', id!)
        .eq('recruiter_id', user!.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; status: string; submitted_at: string; job: { id: string; title: string } }[];
    },
    enabled: !!id && !!user,
  });

  const { playbook } = useCoachingPlaybook(playbookId);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();

  useEffect(() => {
    if (alertId) {
      supabase
        .from('influence_alerts')
        .select('title')
        .eq('id', alertId)
        .single()
        .then(({ data }) => { if (data) setAlertTitle(data.title); });
    }
  }, [alertId]);

  useEffect(() => {
    if (!id || !user) return;
    const fetchCandidate = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', id)
        .eq('recruiter_id', user.id)
        .single();
      if (error || !data) {
        toast.error('Kandidat nicht gefunden');
        navigate('/recruiter/candidates');
        return;
      }
      setCandidate(data as unknown as Candidate);
      setLoading(false);
    };
    fetchCandidate();
  }, [id, user, navigate]);

  const extCandidate = candidate as any;

  // Load interview notes for readiness check
  const { data: interviewNotes } = useQuery({
    queryKey: ['candidate-interview-readiness', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_interview_notes')
        .select('change_motivation, would_recommend')
        .eq('candidate_id', id!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id,
  });

  const readiness = candidate ? getExposeReadiness({
    full_name: candidate.full_name,
    email: candidate.email,
    phone: candidate.phone,
    job_title: candidate.job_title,
    skills: candidate.skills,
    experience_years: candidate.experience_years,
    expected_salary: candidate.expected_salary,
    availability_date: extCandidate?.availability_date,
    notice_period: extCandidate?.notice_period,
    city: candidate.city,
    cv_ai_summary: extCandidate?.cv_ai_summary,
    cv_ai_bullets: extCandidate?.cv_ai_bullets,
    change_motivation: interviewNotes?.change_motivation,
    would_recommend: interviewNotes?.would_recommend,
  }) : null;

  const [currentStatus, setCurrentStatus] = useState(candidate?.candidate_status || 'new');
  useEffect(() => {
    if (candidate?.candidate_status) setCurrentStatus(candidate.candidate_status);
  }, [candidate?.candidate_status]);

  const handleAddActivity = async (activityType: string, title: string, description: string) => {
    if (!candidate) return;
    await logActivity(candidate.id, activityType as any, title, description);
    setAddActivityOpen(false);
    toast.success('Aktivität hinzugefügt');
  };

  const handleSaveCandidate = async (candidateData: Partial<Candidate>) => {
    if (!candidate) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from('candidates').update(candidateData as never).eq('id', candidate.id);
      if (error) throw error;
      toast.success('Kandidat aktualisiert');
      setFormDialogOpen(false);
      const { data } = await supabase.from('candidates').select('*').eq('id', candidate.id).single();
      if (data) setCandidate(data as unknown as Candidate);
    } catch { toast.error('Fehler beim Speichern'); } finally { setProcessing(false); }
  };

  const handleViewExpose = () => { if (candidate) window.open(`/expose/${candidate.id}`, '_blank'); };
  const handleStartInterview = () => setInterviewSliderOpen(true);
  const handleSubmitToJob = () => {
    handleTabChange('matching');
    setTimeout(() => {
      document.getElementById('job-matching-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  if (!candidate) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-muted-foreground">Kandidat nicht gefunden</p>
          <Button onClick={() => navigate('/recruiter/candidates')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Zurück zur Übersicht
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  if (showFullInterview) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setShowFullInterview(false)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <h1 className="text-2xl font-bold">Interview mit {candidate.full_name}</h1>
          </div>
          <CandidateInterviewTab candidate={candidate} onNotesUpdated={() => refetchActivities()} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24">
          <CandidateHeroHeader
            candidate={candidate}
            readiness={readiness}
            currentStatus={currentStatus}
            candidateId={candidate.id}
            activeTaskId={activeTaskId}
            onEdit={() => setFormDialogOpen(true)}
            onCvUpload={() => setCvUploadOpen(true)}
            onStartInterview={handleStartInterview}
          />

        {playbook && (
          <CandidatePlaybookPanel
            playbook={playbook}
            alertTitle={alertTitle}
            candidateName={candidate.full_name}
            companyName={extCandidate?.company}
          />
        )}

        <CandidateMainContent
          candidate={{
            id: candidate.id,
            full_name: candidate.full_name,
            email: candidate.email,
            phone: candidate.phone,
            job_title: candidate.job_title,
            seniority: candidate.seniority,
            experience_years: candidate.experience_years,
            city: candidate.city,
            expected_salary: candidate.expected_salary,
            salary_expectation_min: extCandidate?.salary_expectation_min,
            salary_expectation_max: extCandidate?.salary_expectation_max,
            current_salary: candidate.current_salary,
            notice_period: extCandidate?.notice_period,
            availability_date: extCandidate?.availability_date,
            remote_possible: candidate.remote_possible,
            remote_preference: extCandidate?.remote_preference,
            skills: candidate.skills,
            certifications: extCandidate?.certifications,
            target_roles: extCandidate?.target_roles,
            max_commute_minutes: extCandidate?.max_commute_minutes,
            commute_mode: extCandidate?.commute_mode,
            address_lat: extCandidate?.address_lat,
            address_lng: extCandidate?.address_lng,
            cv_ai_summary: extCandidate?.cv_ai_summary,
            cv_ai_bullets: extCandidate?.cv_ai_bullets,
          }}
          tags={candidateTags}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeTaskId={activeTaskId}
          activities={activities}
          activitiesLoading={activitiesLoading}
          onAddActivity={() => setAddActivityOpen(true)}
          onStartInterview={handleStartInterview}
        />
      </div>

      <CandidateActionBar
        onViewExpose={handleViewExpose}
        onStartInterview={handleStartInterview}
        onSubmitToJob={handleSubmitToJob}
        exposeReady={readiness?.isReady}
        currentStatus={currentStatus}
      />

      <AddActivityDialog open={addActivityOpen} onOpenChange={setAddActivityOpen} onSubmit={handleAddActivity} />
      <CvUploadDialog
        open={cvUploadOpen}
        onOpenChange={setCvUploadOpen}
        existingCandidateId={candidate?.id}
        onCandidateCreated={async () => {
          setCvUploadOpen(false);
          const { data } = await supabase.from('candidates').select('*').eq('id', candidate.id).single();
          if (data) setCandidate(data as unknown as Candidate);
        }}
      />
      <CandidateFormDialog open={formDialogOpen} onOpenChange={setFormDialogOpen} candidate={candidate} onSave={handleSaveCandidate} processing={processing} />
      <InterviewCardSlider open={interviewSliderOpen} onOpenChange={setInterviewSliderOpen} candidateId={candidate.id} candidateName={candidate.full_name} />
    </DashboardLayout>
  );
}

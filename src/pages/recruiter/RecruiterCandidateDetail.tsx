import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Loader2,
  User,
  BarChart3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
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

// New Tab Components
import { CandidateProfileTab } from '@/components/candidates/CandidateProfileTab';
import { CandidateProcessTab } from '@/components/candidates/CandidateProcessTab';
import { CandidateActionBar } from '@/components/candidates/CandidateActionBar';
import { InterviewCardSlider } from '@/components/candidates/InterviewCardSlider';

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Neu',
    contacted: 'Kontaktiert',
    interview: 'Interview',
    offer: 'Angebot',
    placed: 'Platziert',
    rejected: 'Absage',
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
  const initialTab = searchParams.get('tab') || 'profile';
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [showFullInterview, setShowFullInterview] = useState(false);
  const [interviewSliderOpen, setInterviewSliderOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);

  const { tags, getCandidateTags } = useCandidateTags();
  const candidateTags = candidate ? getCandidateTags(candidate.id) : [];

  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);
  
  // Fetch submissions for this candidate
  const { data: submissions } = useQuery({
    queryKey: ['candidate-submissions-header', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          job:jobs(id, title, company_name)
        `)
        .eq('candidate_id', id!)
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data as { id: string; status: string; submitted_at: string; job: { id: string; title: string; company_name: string } }[];
    },
    enabled: !!id
  });

  const activeSubmissions = submissions?.filter(s => !['rejected', 'hired'].includes(s.status)) || [];

  const statusLabels: Record<string, string> = {
    submitted: 'Eingereicht',
    accepted: 'Akzeptiert',
    rejected: 'Abgelehnt',
    interview: 'Interview',
    offer: 'Angebot',
    hired: 'Eingestellt',
  };

  // Load playbook if provided via URL
  const { playbook } = useCoachingPlaybook(playbookId);
  const [alertTitle, setAlertTitle] = useState<string | undefined>();

  // Fetch alert title if alertId is provided
  useEffect(() => {
    if (alertId) {
      supabase
        .from('influence_alerts')
        .select('title')
        .eq('id', alertId)
        .single()
        .then(({ data }) => {
          if (data) setAlertTitle(data.title);
        });
    }
  }, [alertId]);

  // Fetch candidate data
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

  // Compute readiness
  const extCandidate = candidate as any;
  const readiness = candidate ? getExposeReadiness({
    skills: candidate.skills,
    experience_years: candidate.experience_years,
    expected_salary: candidate.expected_salary,
    availability_date: extCandidate?.availability_date,
    notice_period: extCandidate?.notice_period,
    city: candidate.city,
    cv_ai_summary: extCandidate?.cv_ai_summary,
    cv_ai_bullets: extCandidate?.cv_ai_bullets,
  }) : null;

  const [currentStatus, setCurrentStatus] = useState(candidate?.candidate_status || 'new');

  useEffect(() => {
    if (candidate?.candidate_status) {
      setCurrentStatus(candidate.candidate_status);
    }
  }, [candidate?.candidate_status]);

  // Handle tab change with URL persistence
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', newTab);
    setSearchParams(newParams, { replace: true });
  };

  // Keyboard navigation for tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if ((e.key === '1' || e.key.toLowerCase() === 'p') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleTabChange('profile');
      } else if ((e.key === '2' || e.key.toLowerCase() === 'r') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleTabChange('process');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchParams]);

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!candidate) return;
      const { error } = await supabase
        .from('candidates')
        .update({ candidate_status: newStatus })
        .eq('id', candidate.id);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: async (newStatus) => {
      if (!candidate || !newStatus) return;
      setCurrentStatus(newStatus);
      await logActivity(
        candidate.id,
        'status_change',
        `Status geändert zu "${getStatusLabel(newStatus)}"`,
        undefined,
        { oldStatus: currentStatus, newStatus }
      );
      toast.success('Status aktualisiert');
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
    },
    onError: () => {
      toast.error('Fehler beim Aktualisieren des Status');
    },
  });

  const handleAddActivity = async (activityType: string, title: string, description: string) => {
    if (!candidate) return;
    await logActivity(
      candidate.id,
      activityType as 'call' | 'email' | 'note' | 'status_change' | 'playbook_used' | 'alert_actioned' | 'hubspot_import',
      title,
      description
    );
    setAddActivityOpen(false);
    toast.success('Aktivität hinzugefügt');
  };

  const handleExport = () => {
    if (!candidate) return;
    const exportData = { ...candidate, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${candidate.full_name.replace(/\s+/g, '_')}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Profil exportiert');
  };

  const handleSaveCandidate = async (candidateData: Partial<Candidate>) => {
    if (!candidate) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update(candidateData as never)
        .eq('id', candidate.id);
      if (error) throw error;
      toast.success('Kandidat aktualisiert');
      setFormDialogOpen(false);
      // Refetch candidate data
      const { data } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidate.id)
        .single();
      if (data) {
        setCandidate(data as unknown as Candidate);
      }
    } catch (error) {
      toast.error('Fehler beim Speichern');
    } finally {
      setProcessing(false);
    }
  };

  // Action Bar handlers
  const handleViewExpose = () => {
    if (candidate) {
      window.open(`/expose/${candidate.id}`, '_blank');
    }
  };

  const handleStartInterview = () => {
    setInterviewSliderOpen(true);
  };

  const handleSubmitToJob = () => {
    handleTabChange('process');
    // Scroll to matching section
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

  // Full Interview Mode (legacy - for detailed view)
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
          <CandidateInterviewTab 
            candidate={candidate} 
            onNotesUpdated={() => refetchActivities()}
          />
        </div>
      </DashboardLayout>
    );
  }

  // Format availability text
  const getAvailabilityText = () => {
    if (extCandidate?.availability_date) {
      const date = new Date(extCandidate.availability_date);
      if (date <= new Date()) return 'Sofort verfügbar';
      return `Ab ${date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
    }
    if (extCandidate?.notice_period) {
      const labels: Record<string, string> = {
        immediate: 'Sofort verfügbar',
        '2_weeks': '2 Wochen',
        '1_month': '1 Monat',
        '2_months': '2 Monate',
        '3_months': '3 Monate',
        '6_months': '6 Monate',
      };
      return labels[extCandidate.notice_period] || extCandidate.notice_period;
    }
    return null;
  };

  // Format salary range
  const getSalaryText = () => {
    const min = extCandidate?.salary_expectation_min;
    const max = extCandidate?.salary_expectation_max;
    if (min && max) return `${Math.round(min / 1000)}k - ${Math.round(max / 1000)}k €`;
    if (candidate?.expected_salary) return `${Math.round(candidate.expected_salary / 1000)}k €`;
    return null;
  };

  const availabilityText = getAvailabilityText();
  const salaryText = getSalaryText();

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24">
        {/* Hero Header */}
        <CandidateHeroHeader
          candidate={candidate}
          readiness={readiness}
          currentStatus={currentStatus}
          onStatusChange={(stage) => statusMutation.mutate(stage)}
          onEdit={() => setFormDialogOpen(true)}
          onCvUpload={() => setCvUploadOpen(true)}
          submissions={submissions || []}
          statusMutationPending={statusMutation.isPending}
          availabilityText={availabilityText}
          salaryText={salaryText}
        />

        {/* Playbook Panel (if from alert context) */}
        {playbook && (
          <CandidatePlaybookPanel
            playbook={playbook}
            alertTitle={alertTitle}
            candidateName={candidate.full_name}
            companyName={extCandidate?.company}
          />
        )}

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="process" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Prozess
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="mt-6">
            <CandidateProfileTab 
              candidate={{
                id: candidate.id,
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
                cv_ai_summary: extCandidate?.cv_ai_summary,
                cv_ai_bullets: extCandidate?.cv_ai_bullets,
              }}
              tags={candidateTags}
              onViewFullInterview={() => setInterviewSliderOpen(true)}
            />
          </TabsContent>

          {/* Process Tab */}
          <TabsContent value="process" className="mt-6">
            <div id="job-matching-section">
              <CandidateProcessTab 
                candidate={{
                  id: candidate.id,
                  full_name: candidate.full_name,
                  email: candidate.email,
                  phone: candidate.phone,
                  job_title: candidate.job_title,
                  skills: candidate.skills,
                  experience_years: candidate.experience_years,
                  expected_salary: candidate.expected_salary,
                  salary_expectation_min: extCandidate?.salary_expectation_min,
                  salary_expectation_max: extCandidate?.salary_expectation_max,
                  city: candidate.city,
                  seniority: candidate.seniority,
                  target_roles: extCandidate?.target_roles,
                  max_commute_minutes: extCandidate?.max_commute_minutes,
                  commute_mode: extCandidate?.commute_mode,
                  address_lat: extCandidate?.address_lat,
                  address_lng: extCandidate?.address_lng,
                  availability_date: extCandidate?.availability_date,
                  notice_period: extCandidate?.notice_period,
                  cv_ai_summary: extCandidate?.cv_ai_summary,
                  cv_ai_bullets: extCandidate?.cv_ai_bullets,
                }}
                activeTaskId={activeTaskId}
                activities={activities}
                activitiesLoading={activitiesLoading}
                onAddActivity={() => setAddActivityOpen(true)}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky Action Bar */}
      <CandidateActionBar
        onViewExpose={handleViewExpose}
        onStartInterview={handleStartInterview}
        onSubmitToJob={handleSubmitToJob}
        exposeReady={readiness?.isReady}
      />

      {/* Dialogs */}
      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        onSubmit={handleAddActivity}
      />

      <CvUploadDialog
        open={cvUploadOpen}
        onOpenChange={setCvUploadOpen}
        existingCandidateId={candidate?.id}
        onCandidateCreated={async () => {
          setCvUploadOpen(false);
          const { data } = await supabase
            .from('candidates')
            .select('*')
            .eq('id', candidate.id)
            .single();
          if (data) {
            setCandidate(data as unknown as Candidate);
          }
        }}
      />

      <CandidateFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        candidate={candidate}
        onSave={handleSaveCandidate}
        processing={processing}
      />

      {/* Interview Card Slider */}
      <InterviewCardSlider
        open={interviewSliderOpen}
        onOpenChange={setInterviewSliderOpen}
        candidateId={candidate.id}
        candidateName={candidate.full_name}
      />
    </DashboardLayout>
  );
}

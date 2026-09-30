import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCandidateDossier } from '@/hooks/useCandidateDossier';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';

import { Candidate } from '@/components/candidates/CandidateCard';
import { AddActivityDialog } from '@/components/candidates/AddActivityDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { CandidateInterviewTab } from '@/components/candidates/CandidateInterviewTab';
import { CandidatePlaybookPanel } from '@/components/candidates/CandidatePlaybookPanel';
import { CandidateHeroHeader } from '@/components/candidates/CandidateHeroHeader';
import { CandidateActionBar } from '@/components/candidates/CandidateActionBar';
import { CandidateMainContent } from '@/components/candidates/CandidateMainContent';
import { CandidateEditSheet, EditFocus } from '@/components/candidates/dossier/CandidateEditSheet';
import { CandidateInterviewDialog } from '@/components/candidates/dossier/CandidateInterviewDialog';
import { DossierFactsCard, DossierReadinessCard } from '@/components/candidates/dossier/DossierCards';
import { SubmitToJobDialog } from '@/components/candidates/dossier/SubmitToJobDialog';
import { CaptureDialog } from '@/components/candidates/dossier/CaptureDialog';
import { InterviewEntryCard } from '@/components/candidates/dossier/InterviewEntryCard';
import type { DossierForm } from '@/lib/candidateDossier';

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

  // (tabs removed)

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editFocus, setEditFocus] = useState<EditFocus | null>(null);
  const [showFullInterview, setShowFullInterview] = useState(false);
  const [interviewSliderOpen, setInterviewSliderOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitJobId, setSubmitJobId] = useState<string | null>(null);
  // Interview erfassen: schon geführt (einwerfen) oder aus dem Kopf
  const [captureMode, setCaptureMode] = useState<'import' | 'quick' | null>(null);
  const [sourcesRefresh, setSourcesRefresh] = useState(0);

  // Kandidatenakte: eine Quelle für Bearbeiten, Interview, Eckdaten und "Bereit zum Einreichen"
  const dossier = useCandidateDossier(id);

  const { getCandidateTags } = useCandidateTags();
  const candidateTags = candidate ? getCandidateTags(candidate.id) : [];

  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);

  const { data: submissions } = useQuery({
    queryKey: ['candidate-submissions-header', id],
    queryFn: async () => {
      // Kein jobs(...)-Join mehr: Recruiter lesen Jobs nur ueber
      // recruiter_jobs_view (reveal-gated).
      const { data, error } = await supabase
        .from('submissions')
        .select('id, status, submitted_at, job_id')
        .eq('candidate_id', id!)
        .eq('recruiter_id', user!.id)
        .order('submitted_at', { ascending: false });
      if (error) throw error;

      const jobIds = [...new Set((data || []).map((s: any) => s.job_id).filter(Boolean))] as string[];
      let jobsById: Record<string, { id: string; title: string }> = {};
      if (jobIds.length > 0) {
        const { data: jobRows } = await supabase
          .from('recruiter_jobs_view')
          .select('id, title')
          .in('id', jobIds);
        jobsById = Object.fromEntries((jobRows || []).map((j: any) => [j.id, j]));
      }

      return (data || []).map((s: any) => ({ ...s, job: jobsById[s.job_id] ?? null })) as {
        id: string; status: string; submitted_at: string; job: { id: string; title: string };
      }[];
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

  const readiness = dossier.loading ? null : {
    done: dossier.readiness.done,
    total: dossier.readiness.total,
    isReady: dossier.readiness.isReady,
    missing: dossier.readiness.missing.map((m) => m.label),
  };

  const refreshCandidate = async () => {
    if (!id) return;
    const { data } = await supabase.from('candidates').select('*').eq('id', id).single();
    if (data) setCandidate(data as unknown as Candidate);
  };

  const handleDossierSave = async (next: DossierForm) => {
    const result = await dossier.save(next);
    if (result.ok) {
      refreshCandidate();
      queryClient.invalidateQueries({ queryKey: ['candidate-interview-readiness', id] });
    }
    return result;
  };

  const openEdit = (focus: EditFocus | null = null) => {
    setEditFocus(focus);
    setFormDialogOpen(true);
  };

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

  const handleViewExpose = () => { if (candidate) window.open(`/expose/${candidate.id}`, '_blank'); };
  const handleStartInterview = () => setInterviewSliderOpen(true);

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
            onEdit={() => openEdit()}
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
          activities={activities}
          activitiesLoading={activitiesLoading}
          onAddActivity={() => setAddActivityOpen(true)}
          onStartInterview={handleStartInterview}
          onSubmitToJob={(jobId) => { setSubmitJobId(jobId ?? null); setSubmitOpen(true); }}
          onEditDossier={() => openEdit()}
          dossierSlot={
            dossier.loading ? undefined : (
              <div className="space-y-6">
                <InterviewEntryCard
                  candidateId={candidate.id}
                  hasInterview={dossier.hasNotes}
                  interviewDate={dossier.form.interview_date}
                  refreshKey={sourcesRefresh}
                  onImport={() => setCaptureMode('import')}
                  onLive={handleStartInterview}
                  onQuick={() => setCaptureMode('quick')}
                />
                <DossierReadinessCard
                  readiness={dossier.readiness}
                  firstName={candidate.full_name.split(' ')[0] || candidate.full_name}
                  onEdit={openEdit}
                  onStartInterview={handleStartInterview}
                  onViewExpose={handleViewExpose}
                  onSubmit={() => setSubmitOpen(true)}
                />
                <DossierFactsCard form={dossier.form} onEdit={openEdit} />
              </div>
            )
          }
        />
      </div>

      <CandidateActionBar
        onViewExpose={handleViewExpose}
        onStartInterview={handleStartInterview}
        onSubmitToJob={() => setSubmitOpen(true)}
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
          await refreshCandidate();
          dossier.reload();
        }}
      />
      <CandidateEditSheet
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        candidateName={candidate.full_name}
        form={dossier.form}
        onSave={handleDossierSave}
        focus={editFocus}
      />
      <SubmitToJobDialog
        open={submitOpen}
        onOpenChange={(o) => { setSubmitOpen(o); if (!o) setSubmitJobId(null); }}
        initialJobId={submitJobId}
        candidateId={candidate.id}
        candidateName={candidate.full_name}
        onSubmitted={() => {
          queryClient.invalidateQueries({ queryKey: ['candidate-submissions-header', id] });
          queryClient.invalidateQueries({ queryKey: ['candidate-active-processes', id] });
          refetchActivities();
        }}
      />
      <CandidateInterviewDialog
        open={interviewSliderOpen}
        onOpenChange={setInterviewSliderOpen}
        candidateId={candidate.id}
        form={dossier.form}
        pendingColumns={dossier.pendingColumns}
        onSave={handleDossierSave}
        onComplete={async () => { await dossier.markInterviewCompleted(); setSourcesRefresh((n) => n + 1); }}
      />
      <CaptureDialog
        open={captureMode !== null}
        onOpenChange={(o) => { if (!o) { setCaptureMode(null); setSourcesRefresh((n) => n + 1); } }}
        mode={captureMode ?? 'import'}
        candidateId={candidate.id}
        form={dossier.form}
        onSave={handleDossierSave}
        onEdit={openEdit}
        onSubmitToJob={() => setSubmitOpen(true)}
      />
    </DashboardLayout>
  );
}

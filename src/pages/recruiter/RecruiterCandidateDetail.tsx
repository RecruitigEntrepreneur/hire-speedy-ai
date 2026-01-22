import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  Edit,
  Download,
  RefreshCw,
  Plus,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';

import { Candidate } from '@/components/candidates/CandidateCard';
import { CandidateStatusDropdown } from '@/components/candidates/CandidateStatusDropdown';
import { AddActivityDialog } from '@/components/candidates/AddActivityDialog';
import { CvUploadDialog } from '@/components/candidates/CvUploadDialog';
import { CandidateTasksSection } from '@/components/candidates/CandidateTasksSection';
import { CandidateFormDialog } from '@/components/candidates/CandidateFormDialog';

// Layout components
import { CandidateKeyFactsCard } from '@/components/candidates/CandidateKeyFactsCard';
import { QuickInterviewSummary } from '@/components/candidates/QuickInterviewSummary';
import { CandidateJobMatchingV3 } from '@/components/candidates/CandidateJobMatchingV3';
import { ClientCandidateSummaryCard } from '@/components/candidates/ClientCandidateSummaryCard';
import { CandidateActivityTimeline } from '@/components/candidates/CandidateActivityTimeline';
import { CandidateJobsOverview } from '@/components/candidates/CandidateJobsOverview';
import { CandidateDocumentsManager } from '@/components/candidates/CandidateDocumentsManager';
import { CandidateInterviewTab } from '@/components/candidates/CandidateInterviewTab';

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
  const [searchParams] = useSearchParams();
  const activeTaskId = searchParams.get('task') || undefined;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [showFullInterview, setShowFullInterview] = useState(false);
  const [processing, setProcessing] = useState(false);

  const { tags, getCandidateTags } = useCandidateTags();
  const candidateTags = candidate ? getCandidateTags(candidate.id) : [];

  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);

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

  // Full Interview Mode
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/recruiter/candidates')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {candidate.full_name.split(' ').map((n) => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{candidate.full_name}</h1>
                {readiness && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant={readiness.badge.variant}
                        className={readiness.badge.color}
                      >
                        {readiness.badge.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">Profil-Vollständigkeit: {readiness.score}%</p>
                      {readiness.missingFields.length > 0 && (
                        <p className="text-xs">Fehlend: {readiness.missingFields.join(', ')}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {candidate.job_title || candidate.email}
              </p>
            </div>
            <CandidateStatusDropdown
              value={currentStatus}
              onChange={(val) => statusMutation.mutate(val)}
              disabled={statusMutation.isPending}
            />
          </div>
          
          {/* Quick Actions */}
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-2 flex-wrap">
              {candidate.phone && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = `tel:${candidate.phone}`}>
                      <Phone className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Anrufen</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = `mailto:${candidate.email}`}>
                    <Mail className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>E-Mail senden</TooltipContent>
              </Tooltip>
              {candidate.linkedin_url && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => window.open(candidate.linkedin_url!, '_blank')}>
                      <Linkedin className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>LinkedIn öffnen</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Profil exportieren</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setCvUploadOpen(true)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>CV aktualisieren</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setFormDialogOpen(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Profil bearbeiten</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {/* Tasks */}
        <CandidateTasksSection candidateId={candidate.id} activeTaskId={activeTaskId} />

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6">
          {/* LEFT COLUMN - Main Content */}
          <div className="space-y-6 min-w-0">
            {/* Key Facts */}
            <CandidateKeyFactsCard 
              candidate={{
                ...candidate,
                salary_expectation_min: extCandidate.salary_expectation_min,
                salary_expectation_max: extCandidate.salary_expectation_max,
                remote_preference: extCandidate.remote_preference,
                certifications: extCandidate.certifications,
              }} 
              tags={candidateTags} 
            />

            {/* Job Matching */}
            <CandidateJobMatchingV3 
              candidate={{
                id: candidate.id,
                skills: candidate.skills,
                experience_years: candidate.experience_years,
                expected_salary: candidate.expected_salary,
                salary_expectation_min: extCandidate.salary_expectation_min,
                salary_expectation_max: extCandidate.salary_expectation_max,
                city: candidate.city,
                seniority: candidate.seniority,
                target_roles: extCandidate.target_roles,
                job_title: candidate.job_title,
                full_name: candidate.full_name,
                max_commute_minutes: extCandidate.max_commute_minutes,
                commute_mode: extCandidate.commute_mode,
                address_lat: extCandidate.address_lat,
                address_lng: extCandidate.address_lng,
                email: candidate.email,
                phone: candidate.phone,
                availability_date: extCandidate.availability_date,
                notice_period: extCandidate.notice_period,
                cv_ai_summary: extCandidate.cv_ai_summary,
                cv_ai_bullets: extCandidate.cv_ai_bullets,
              }}
            />

            {/* Client Summary */}
            <ClientCandidateSummaryCard candidateId={candidate.id} />

            {/* Submissions */}
            <CandidateJobsOverview candidateId={candidate.id} />
          </div>

          {/* RIGHT COLUMN - Context & History */}
          <div className="space-y-6 min-w-0">
            {/* Interview Summary */}
            <QuickInterviewSummary 
              candidateId={candidate.id}
              onViewDetails={() => setShowFullInterview(true)}
            />

            {/* Documents */}
            <CandidateDocumentsManager candidateId={candidate.id} />

            {/* Activities */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Letzte Aktivitäten
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setAddActivityOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CandidateActivityTimeline
                activities={activities.slice(0, 5)}
                loading={activitiesLoading}
              />
              {activities.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  +{activities.length - 5} weitere Aktivitäten
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

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
          // Refetch candidate data
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
    </DashboardLayout>
  );
}

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
  MapPin,
  Briefcase,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';

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
import { CandidateStagePipeline } from '@/components/candidates/CandidateStagePipeline';
import { CandidatePlaybookPanel } from '@/components/candidates/CandidatePlaybookPanel';
import { SimilarCandidates } from '@/components/candidates/SimilarCandidates';

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
  const alertId = searchParams.get('alert') || undefined;
  const playbookId = searchParams.get('playbook') || undefined;
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
        '2_weeks': '2 Wochen Kündigungsfrist',
        '1_month': '1 Monat Kündigungsfrist',
        '2_months': '2 Monate Kündigungsfrist',
        '3_months': '3 Monate Kündigungsfrist',
        '6_months': '6 Monate Kündigungsfrist',
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
  const topSkills = candidate?.skills?.slice(0, 3) || [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Hero Header Card */}
        <div className="rounded-xl bg-gradient-to-br from-primary/5 via-background to-emerald/5 border shadow-sm overflow-hidden">
          {/* Back Button Row */}
          <div className="px-6 py-3 border-b bg-background/50">
            <Button variant="ghost" size="sm" onClick={() => navigate('/recruiter/candidates')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zu Kandidaten
            </Button>
          </div>
          
          {/* Main Hero Content */}
          <div className="p-6">
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Avatar */}
              <Avatar className="h-20 w-20 border-2 border-primary/20 shrink-0">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-semibold">
                  {candidate.full_name.split(' ').map((n) => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              {/* Info Block */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold truncate">{candidate.full_name}</h1>
                    <p className="text-lg text-muted-foreground truncate">
                      {candidate.job_title || 'Keine Position angegeben'}
                    </p>
                    
                    {/* Meta Row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {candidate.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {candidate.city}
                        </span>
                      )}
                      {availabilityText && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {availabilityText}
                        </span>
                      )}
                      {candidate.experience_years && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          {candidate.experience_years}+ Jahre
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <TooltipProvider delayDuration={300}>
                    <div className="flex items-center gap-2 shrink-0">
                      {candidate.phone && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => window.location.href = `tel:${candidate.phone}`}>
                              <Phone className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Anrufen</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => window.location.href = `mailto:${candidate.email}`}>
                            <Mail className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>E-Mail senden</TooltipContent>
                      </Tooltip>
                      {candidate.linkedin_url && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={() => window.open(candidate.linkedin_url!, '_blank')}>
                              <Linkedin className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>LinkedIn öffnen</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={handleExport}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Profil exportieren</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setCvUploadOpen(true)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>CV aktualisieren</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" onClick={() => setFormDialogOpen(true)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Profil bearbeiten</TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>
                
                {/* Badges Row */}
                <div className="flex flex-wrap gap-2 mt-4">
                  {readiness?.isReady && (
                    <Badge className="bg-success/10 text-success">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Exposé-Ready
                    </Badge>
                  )}
                  {!readiness?.isReady && readiness && (
                    <Badge variant="outline" className="text-warning border-warning/50">
                      {readiness.score}% vollständig
                    </Badge>
                  )}
                  {salaryText && (
                    <Badge variant="outline">{salaryText}</Badge>
                  )}
                  {topSkills.length > 0 && (
                    <Badge variant="secondary" className="font-normal">
                      {topSkills.join(', ')}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Rejected Alert or Stage Pipeline */}
          {currentStatus === 'rejected' ? (
            <div className="px-6 py-4 bg-destructive/10 border-t flex items-center justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">Kandidat abgesagt</span>
              </div>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => statusMutation.mutate('new')}
                disabled={statusMutation.isPending}
              >
                Reaktivieren
              </Button>
            </div>
          ) : (
            <div className="px-6 py-4 bg-muted/30 border-t">
              <CandidateStagePipeline
                currentStage={currentStatus}
                onStageChange={(stage) => statusMutation.mutate(stage)}
                disabled={statusMutation.isPending}
              />
            </div>
          )}
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
            {/* Coaching Playbook - Only show if we have one from alert context */}
            {playbook && (
              <CandidatePlaybookPanel
                playbook={playbook}
                alertTitle={alertTitle}
                candidateName={candidate.full_name}
                companyName={extCandidate?.company}
              />
            )}

            {/* Interview Summary */}
            <QuickInterviewSummary 
              candidateId={candidate.id}
              onViewDetails={() => setShowFullInterview(true)}
            />

            {/* Documents */}
            <CandidateDocumentsManager candidateId={candidate.id} />

            {/* Similar Candidates */}
            <SimilarCandidates candidateId={candidate.id} limit={5} />

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

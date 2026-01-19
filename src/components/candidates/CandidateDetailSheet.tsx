import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Mail,
  Phone,
  Linkedin,
  Edit,
  Download,
  RefreshCw,
  Plus,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { CandidateStatusDropdown } from './CandidateStatusDropdown';
import { AddActivityDialog } from './AddActivityDialog';
import { CvUploadDialog } from './CvUploadDialog';
import { CandidateTasksSection } from './CandidateTasksSection';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';

// New Components for 2-column layout
import { CandidateKeyFactsCard } from './CandidateKeyFactsCard';
import { QuickInterviewSummary } from './QuickInterviewSummary';
import { CandidateJobMatchingV3 } from './CandidateJobMatchingV3';
import { ClientCandidateSummaryCard } from './ClientCandidateSummaryCard';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { CandidateDocumentsManager } from './CandidateDocumentsManager';
import { CandidateInterviewTab } from './CandidateInterviewTab';

interface CandidateDetailSheetProps {
  candidate: Candidate | null;
  tags: CandidateTag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (candidate: Candidate) => void;
  onCandidateUpdated?: () => void;
}

export function CandidateDetailSheet({
  candidate,
  tags,
  open,
  onOpenChange,
  onEdit,
  onCandidateUpdated,
}: CandidateDetailSheetProps) {
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(candidate?.candidate_status || 'new');
  const [showFullInterview, setShowFullInterview] = useState(false);
  const queryClient = useQueryClient();
  
  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);

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

  if (!candidate) return null;

  const extCandidate = candidate as any;

  // Full Interview Mode
  if (showFullInterview) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setShowFullInterview(false)}>
                ← Zurück
              </Button>
              <h2 className="font-semibold">Interview mit {candidate.full_name}</h2>
            </div>
          </div>
          <ScrollArea className="flex-1 p-6">
            <CandidateInterviewTab 
              candidate={candidate} 
              onNotesUpdated={() => refetchActivities()}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          {/* Compact Header */}
          <div className="px-6 py-4 border-b shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg">
                    {candidate.full_name.split(' ').map((n) => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold">{candidate.full_name}</h2>
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
              
              {/* Quick Actions with Tooltips */}
              <TooltipProvider delayDuration={300}>
                <div className="flex items-center gap-2">
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
                      <Button variant="outline" size="sm" onClick={() => onEdit(candidate)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Profil bearbeiten</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>

            {/* Tasks */}
            <div className="mt-3">
              <CandidateTasksSection candidateId={candidate.id} />
            </div>
          </div>

          {/* 2-Column Layout */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* LEFT COLUMN (60%) - Main Content */}
            <ScrollArea className="flex-[3] min-w-0 border-r">
              <div className="p-4 space-y-4">
                {/* Key Facts */}
                <CandidateKeyFactsCard 
                  candidate={{
                    ...candidate,
                    salary_expectation_min: extCandidate.salary_expectation_min,
                    salary_expectation_max: extCandidate.salary_expectation_max,
                    remote_preference: extCandidate.remote_preference,
                    certifications: extCandidate.certifications,
                  }} 
                  tags={tags} 
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
                  }}
                />

                {/* Client Summary */}
                <ClientCandidateSummaryCard candidateId={candidate.id} />

                {/* Submissions */}
                <CandidateJobsOverview candidateId={candidate.id} />
              </div>
            </ScrollArea>

            {/* RIGHT COLUMN (40%) - Context & History */}
            <ScrollArea className="flex-[2] min-w-[320px]">
              <div className="p-4 space-y-4">
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
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        onSubmit={handleAddActivity}
      />

      <CvUploadDialog
        open={cvUploadOpen}
        onOpenChange={setCvUploadOpen}
        existingCandidateId={candidate?.id}
        onCandidateCreated={() => {
          setCvUploadOpen(false);
          queryClient.invalidateQueries({ queryKey: ['candidates'] });
          onCandidateUpdated?.();
        }}
      />
    </>
  );
}

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

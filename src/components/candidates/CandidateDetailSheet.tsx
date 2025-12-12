import { useState } from 'react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Phone,
  Linkedin,
  FileText,
  Edit,
  Download,
  Copy,
  Plus,
  User,
  Clock,
  Briefcase,
  StickyNote,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

import { Candidate } from './CandidateCard';
import { CandidateTag } from '@/hooks/useCandidateTags';
import { CandidateActivityTimeline } from './CandidateActivityTimeline';
import { CandidateJobsOverview } from './CandidateJobsOverview';
import { CandidateNotes } from './CandidateNotes';
import { CandidateOverviewTab } from './CandidateOverviewTab';
import { CandidateInterviewTab } from './CandidateInterviewTab';
import { CandidateStatusDropdown } from './CandidateStatusDropdown';
import { AddActivityDialog } from './AddActivityDialog';
import { CvUploadDialog } from './CvUploadDialog';
import { useCandidateActivityLog } from '@/hooks/useCandidateActivityLog';

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
  const [activeTab, setActiveTab] = useState('overview');
  const [addActivityOpen, setAddActivityOpen] = useState(false);
  const [cvUploadOpen, setCvUploadOpen] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(candidate?.candidate_status || 'new');
  const queryClient = useQueryClient();
  
  const { activities, loading: activitiesLoading, logActivity, refetch: refetchActivities } = useCandidateActivityLog(candidate?.id);

  // Update status mutation
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
    const exportData = {
      ...candidate,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${candidate.full_name.replace(/\s+/g, '_')}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Profil exportiert');
  };

  const handleDuplicate = async () => {
    if (!candidate) return;
    toast.info('Kandidat duplizieren ist noch nicht implementiert');
  };

  if (!candidate) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {candidate.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle className="text-xl mb-1">{candidate.full_name}</SheetTitle>
                  <p className="text-sm text-muted-foreground">
                    {candidate.job_title 
                      ? `${candidate.job_title}${candidate.company ? ` bei ${candidate.company}` : ''}`
                      : candidate.email}
                  </p>
                  <div className="mt-2">
                    <CandidateStatusDropdown
                      value={currentStatus}
                      onChange={(val) => statusMutation.mutate(val)}
                      disabled={statusMutation.isPending}
                    />
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onEdit(candidate)}>
                <Edit className="h-4 w-4 mr-2" />
                Bearbeiten
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 mt-4">
              {candidate.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.href = `tel:${candidate.phone}`}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Anrufen
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `mailto:${candidate.email}`}
              >
                <Mail className="h-4 w-4 mr-2" />
                E-Mail
              </Button>
              {candidate.linkedin_url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                >
                  <Linkedin className="h-4 w-4 mr-2" />
                  LinkedIn
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCvUploadOpen(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                CV parsen
              </Button>
            </div>
          </SheetHeader>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-5 shrink-0 mx-6 mt-4" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Übersicht</span>
              </TabsTrigger>
              <TabsTrigger value="interview" className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Interview</span>
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Aktivitäten</span>
              </TabsTrigger>
              <TabsTrigger value="submissions" className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                <span className="hidden sm:inline">Submissions</span>
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-1">
                <StickyNote className="h-4 w-4" />
                <span className="hidden sm:inline">Notizen</span>
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-6 pb-6">
              {/* Tab 1: Overview */}
              <TabsContent value="overview" className="mt-4 focus-visible:ring-0">
                <CandidateOverviewTab candidate={candidate} tags={tags} />
              </TabsContent>

              {/* Tab 2: Interview */}
              <TabsContent value="interview" className="mt-4 focus-visible:ring-0">
                <CandidateInterviewTab 
                  candidate={candidate} 
                  onNotesUpdated={() => refetchActivities()}
                />
              </TabsContent>

              {/* Tab 3: Activities */}
              <TabsContent value="activities" className="mt-4 focus-visible:ring-0">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Aktivitäten-Timeline</h3>
                  <Button size="sm" onClick={() => setAddActivityOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Aktivität hinzufügen
                  </Button>
                </div>
                <CandidateActivityTimeline
                  activities={activities}
                  loading={activitiesLoading}
                />
              </TabsContent>

              {/* Tab 4: Submissions */}
              <TabsContent value="submissions" className="mt-4 focus-visible:ring-0">
                <CandidateJobsOverview candidateId={candidate.id} />
              </TabsContent>

              {/* Tab 5: Notes */}
              <TabsContent value="notes" className="mt-4 focus-visible:ring-0">
                <CandidateNotes candidateId={candidate.id} />
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Add Activity Dialog */}
      <AddActivityDialog
        open={addActivityOpen}
        onOpenChange={setAddActivityOpen}
        onSubmit={handleAddActivity}
      />

      {/* CV Upload Dialog */}
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

import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { InterviewStatsCards } from '@/components/interview/InterviewStatsCards';
import { NextInterviewBanner } from '@/components/interview/NextInterviewBanner';
import { ModernInterviewCard } from '@/components/interview/ModernInterviewCard';
import { InterviewEmptyState } from '@/components/interview/InterviewEmptyState';
import { InterviewFeedbackForm } from '@/components/interview/InterviewFeedbackForm';
import { InterviewEditDialog } from '@/components/interview/InterviewEditDialog';
import { useInterviewKeyboardShortcuts } from '@/hooks/useInterviewKeyboardShortcuts';
import { Loader2, LayoutGrid, List, Search, Video, Phone, MapPin, X, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { isToday, isThisWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  notes: string | null;
  feedback: string | null;
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

type FilterType = 'today' | 'week' | 'feedback' | 'completed' | null;
type MeetingTypeFilter = 'all' | 'video' | 'phone' | 'onsite';

export default function ClientInterviews() {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [feedbackInterview, setFeedbackInterview] = useState<Interview | null>(null);
  
  // Filters
  const [statsFilter, setStatsFilter] = useState<FilterType>(null);
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<MeetingTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  useInterviewKeyboardShortcuts({
    onToggleView: () => setViewMode(prev => prev === 'list' ? 'calendar' : 'list'),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCloseDialog: () => {
      if (dialogOpen) setDialogOpen(false);
      else if (feedbackDialogOpen) setFeedbackDialogOpen(false);
    },
    enabled: true,
  });

  const handleOpenFeedback = (interview: Interview) => {
    setFeedbackInterview(interview);
    setFeedbackDialogOpen(true);
  };

  useEffect(() => {
    if (user) {
      fetchInterviews();
    }
  }, [user]);

  const fetchInterviews = async () => {
    const { data, error } = await supabase
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

    if (!error && data) {
      setInterviews(data as unknown as Interview[]);
    }
    setLoading(false);
  };

  const handleEdit = (interview: Interview) => {
    setEditingInterview(interview);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    scheduled_at: string;
    duration_minutes: number;
    meeting_type: string;
    meeting_link: string;
    notes: string;
  }) => {
    if (!editingInterview) return;
    setProcessing(true);

    const { error } = await supabase
      .from('interviews')
      .update({
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes,
        meeting_type: data.meeting_type,
        meeting_link: data.meeting_link,
        notes: data.notes,
        status: 'scheduled',
      })
      .eq('id', editingInterview.id);

    if (error) {
      toast.error('Fehler beim Speichern');
    } else {
      toast.success('Interview aktualisiert');
      setDialogOpen(false);
      fetchInterviews();
    }
    setProcessing(false);
  };

  const handleComplete = async (interview: Interview, hired: boolean) => {
    setProcessing(true);
    
    // Update interview status
    await supabase
      .from('interviews')
      .update({ status: hired ? 'completed' : 'cancelled' })
      .eq('id', interview.id);

    // Update submission status
    await supabase
      .from('submissions')
      .update({ status: hired ? 'hired' : 'rejected' })
      .eq('id', interview.submission.id);

    if (hired) {
      // Create placement record
      await supabase.from('placements').insert({
        submission_id: interview.submission.id,
        payment_status: 'pending',
      });
      toast.success('Kandidat eingestellt! Placement erstellt.');
    } else {
      toast.success('Interview abgesagt');
    }
    
    fetchInterviews();
    setProcessing(false);
  };

  const handleNoShow = async (interview: Interview, type: 'candidate' | 'client') => {
    setProcessing(true);
    
    await supabase
      .from('interviews')
      .update({ 
        status: 'no_show',
        notes: `${interview.notes || ''}\n\n[No-Show: ${type === 'candidate' ? 'Kandidat' : 'Kunde'} nicht erschienen]`.trim()
      })
      .eq('id', interview.id);

    toast.success(`No-Show gemeldet: ${type === 'candidate' ? 'Kandidat' : 'Kunde'} nicht erschienen`);
    fetchInterviews();
    setProcessing(false);
  };

  // Apply all filters
  const filteredInterviews = useMemo(() => {
    let result = [...interviews];

    // Stats filter
    if (statsFilter === 'today') {
      result = result.filter(i => 
        i.scheduled_at && isToday(new Date(i.scheduled_at)) && i.status !== 'completed' && i.status !== 'cancelled'
      );
    } else if (statsFilter === 'week') {
      result = result.filter(i => 
        i.scheduled_at && isThisWeek(new Date(i.scheduled_at), { weekStartsOn: 1 }) && i.status !== 'completed' && i.status !== 'cancelled'
      );
    } else if (statsFilter === 'feedback') {
      result = result.filter(i => i.status === 'completed' && !i.feedback);
    } else if (statsFilter === 'completed') {
      result = result.filter(i => i.status === 'completed');
    }

    // Meeting type filter
    if (meetingTypeFilter !== 'all') {
      result = result.filter(i => {
        if (meetingTypeFilter === 'video') {
          return i.meeting_type === 'video' || i.meeting_type === 'teams' || i.meeting_type === 'meet';
        }
        return i.meeting_type === meetingTypeFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(i => 
        i.submission.candidate.full_name.toLowerCase().includes(query) ||
        i.submission.job.title.toLowerCase().includes(query)
      );
    }

    return result;
  }, [interviews, statsFilter, meetingTypeFilter, searchQuery]);

  const upcomingInterviews = filteredInterviews.filter(i => 
    i.status !== 'completed' && i.status !== 'cancelled'
  );
  const pastInterviews = filteredInterviews.filter(i => 
    i.status === 'completed' || i.status === 'cancelled'
  );

  const hasActiveFilters = statsFilter !== null || meetingTypeFilter !== 'all' || searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setStatsFilter(null);
    setMeetingTypeFilter('all');
    setSearchQuery('');
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Interview Command Center
            </h1>
            <p className="text-muted-foreground mt-1">
              Alle Ihre Interviews auf einen Blick
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Keyboard Shortcuts Hint */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <div className="space-y-1 text-xs">
                    <p><kbd className="px-1 rounded bg-muted">L</kbd> Liste/Kalender wechseln</p>
                    <p><kbd className="px-1 rounded bg-muted">F</kbd> Suche fokussieren</p>
                    <p><kbd className="px-1 rounded bg-muted">Esc</kbd> Dialog schließen</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="glass-card rounded-lg p-1 flex items-center gap-1">
              <Button 
                variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('list')}
                className="gap-1.5"
              >
                <List className="h-4 w-4" />
                Liste
              </Button>
              <Button 
                variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="gap-1.5"
              >
                <LayoutGrid className="h-4 w-4" />
                Kalender
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards (clickable filters) */}
        <InterviewStatsCards 
          interviews={interviews}
          onFilterChange={setStatsFilter}
          activeFilter={statsFilter}
        />

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Meeting Type Filters */}
            <div className="flex items-center gap-1 glass-card rounded-lg p-1">
              <Button
                variant={meetingTypeFilter === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMeetingTypeFilter('all')}
              >
                Alle
              </Button>
              <Button
                variant={meetingTypeFilter === 'video' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMeetingTypeFilter('video')}
                className="gap-1.5"
              >
                <Video className="h-3.5 w-3.5" />
                Video
              </Button>
              <Button
                variant={meetingTypeFilter === 'phone' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMeetingTypeFilter('phone')}
                className="gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" />
                Telefon
              </Button>
              <Button
                variant={meetingTypeFilter === 'onsite' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMeetingTypeFilter('onsite')}
                className="gap-1.5"
              >
                <MapPin className="h-3.5 w-3.5" />
                Vor Ort
              </Button>
            </div>

            {/* Active Filters Badge */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFilters}
                className="gap-1.5 text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Kandidat oder Position..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Results Count */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {filteredInterviews.length} Ergebnis{filteredInterviews.length !== 1 ? 'se' : ''}
            </Badge>
            {statsFilter && (
              <Badge variant="outline">
                Filter: {statsFilter === 'today' ? 'Heute' : statsFilter === 'week' ? 'Diese Woche' : statsFilter === 'feedback' ? 'Feedback' : 'Abgeschlossen'}
              </Badge>
            )}
          </div>
        )}

        {/* Next Interview Banner */}
        <NextInterviewBanner 
          interviews={interviews}
          onReschedule={handleEdit}
        />

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="glass-card rounded-xl p-4">
            <InterviewCalendarView 
              interviews={filteredInterviews}
              onSelectInterview={(interview) => handleEdit(interview)}
            />
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <Tabs defaultValue="upcoming" className="space-y-6">
            <TabsList className="glass-card">
              <TabsTrigger value="upcoming" className="gap-1.5">
                Anstehend
                {upcomingInterviews.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
                    {upcomingInterviews.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="past" className="gap-1.5">
                Vergangen
                {pastInterviews.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground font-medium">
                    {pastInterviews.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upcoming" className="mt-6">
              {upcomingInterviews.length === 0 ? (
                <InterviewEmptyState type="upcoming" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingInterviews.map((interview) => (
                    <ModernInterviewCard
                      key={interview.id}
                      interview={interview}
                      onEdit={handleEdit}
                      onComplete={handleComplete}
                      onFeedback={handleOpenFeedback}
                      onNoShow={handleNoShow}
                      onQuickReschedule={handleEdit}
                      processing={processing}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="past" className="mt-6">
              {pastInterviews.length === 0 ? (
                <InterviewEmptyState type="past" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {pastInterviews.map((interview) => (
                    <ModernInterviewCard
                      key={interview.id}
                      interview={interview}
                      onEdit={handleEdit}
                      onComplete={handleComplete}
                      onFeedback={handleOpenFeedback}
                      processing={processing}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Professional Edit Dialog */}
      <InterviewEditDialog
        interview={editingInterview}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleSave}
        processing={processing}
      />

      {/* Feedback Dialog */}
      {feedbackInterview && (
        <InterviewFeedbackForm
          interviewId={feedbackInterview.id}
          candidateName={feedbackInterview.submission.candidate.full_name}
          open={feedbackDialogOpen}
          onOpenChange={setFeedbackDialogOpen}
          onSuccess={() => {
            fetchInterviews();
            setFeedbackDialogOpen(false);
          }}
        />
      )}
    </DashboardLayout>
  );
}

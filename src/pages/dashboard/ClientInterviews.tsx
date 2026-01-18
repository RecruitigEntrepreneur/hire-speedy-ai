import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InterviewCalendarView } from '@/components/interview/InterviewCalendarView';
import { InterviewStatsCards } from '@/components/interview/InterviewStatsCards';
import { NextInterviewBanner } from '@/components/interview/NextInterviewBanner';
import { ModernInterviewCard } from '@/components/interview/ModernInterviewCard';
import { InterviewEmptyState } from '@/components/interview/InterviewEmptyState';
import { InterviewFeedbackForm } from '@/components/interview/InterviewFeedbackForm';
import { Loader2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
  
  const [formData, setFormData] = useState({
    scheduled_at: '',
    duration_minutes: 60,
    meeting_type: 'video',
    meeting_link: '',
    notes: '',
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
    setFormData({
      scheduled_at: interview.scheduled_at ? format(new Date(interview.scheduled_at), "yyyy-MM-dd'T'HH:mm") : '',
      duration_minutes: interview.duration_minutes || 60,
      meeting_type: interview.meeting_type || 'video',
      meeting_link: interview.meeting_link || '',
      notes: interview.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingInterview) return;
    setProcessing(true);

    const { error } = await supabase
      .from('interviews')
      .update({
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null,
        duration_minutes: formData.duration_minutes,
        meeting_type: formData.meeting_type,
        meeting_link: formData.meeting_link,
        notes: formData.notes,
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const upcomingInterviews = interviews.filter(i => 
    i.status !== 'completed' && i.status !== 'cancelled'
  );
  const pastInterviews = interviews.filter(i => 
    i.status === 'completed' || i.status === 'cancelled'
  );

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
          <div className="flex items-center gap-2 glass-card rounded-lg p-1">
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

        {/* Stats Cards */}
        <InterviewStatsCards interviews={interviews} />

        {/* Next Interview Banner */}
        <NextInterviewBanner 
          interviews={interviews}
          onReschedule={handleEdit}
        />

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className="glass-card rounded-xl p-4">
            <InterviewCalendarView 
              interviews={interviews}
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

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Interview bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Datum & Uhrzeit</Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
            </div>
            <div>
              <Label>Dauer (Minuten)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label>Art des Interviews</Label>
              <Select
                value={formData.meeting_type}
                onValueChange={(value) => setFormData({ ...formData, meeting_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="phone">Telefon</SelectItem>
                  <SelectItem value="onsite">Vor Ort</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="meet">Google Meet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meeting-Link</Label>
              <Input
                placeholder="https://..."
                value={formData.meeting_link}
                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
              />
            </div>
            <div>
              <Label>Notizen</Label>
              <Textarea
                placeholder="Interne Notizen..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={processing}>
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

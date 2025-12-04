import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Loader2, Calendar, Video, Phone, MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

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
  
  const [formData, setFormData] = useState({
    scheduled_at: '',
    duration_minutes: 60,
    meeting_type: 'video',
    meeting_link: '',
    notes: '',
  });

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
      toast.success('Interview abgeschlossen');
    }
    
    fetchInterviews();
    setProcessing(false);
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Ausstehend', variant: 'outline' },
      scheduled: { label: 'Geplant', variant: 'default' },
      completed: { label: 'Abgeschlossen', variant: 'secondary' },
      cancelled: { label: 'Abgesagt', variant: 'destructive' },
    };
    const statusConfig = config[status || 'pending'] || config.pending;
    return <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>;
  };

  const getMeetingIcon = (type: string | null) => {
    switch (type) {
      case 'video': return <Video className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'onsite': return <MapPin className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DashboardLayout>
      </>
    );
  }

  const upcomingInterviews = interviews.filter(i => 
    i.status !== 'completed' && i.status !== 'cancelled'
  );
  const pastInterviews = interviews.filter(i => 
    i.status === 'completed' || i.status === 'cancelled'
  );

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Interviews</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Ihre geplanten Interviews
            </p>
          </div>

          {/* Upcoming Interviews */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Anstehende Interviews ({upcomingInterviews.length})</h2>
            <div className="grid gap-4">
              {upcomingInterviews.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Keine anstehenden Interviews</p>
                  </CardContent>
                </Card>
              ) : (
                upcomingInterviews.map((interview) => (
                  <Card key={interview.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">
                              {interview.submission.candidate.full_name}
                            </h3>
                            {getStatusBadge(interview.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {interview.submission.job.title} bei {interview.submission.job.company_name}
                          </p>
                          
                          {interview.scheduled_at && (
                            <div className="flex items-center gap-4 text-sm mt-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(interview.scheduled_at), 'PPP', { locale: de })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(interview.scheduled_at), 'HH:mm')} Uhr
                              </span>
                              <span className="flex items-center gap-1">
                                {getMeetingIcon(interview.meeting_type)}
                                {interview.meeting_type === 'video' ? 'Video' : 
                                 interview.meeting_type === 'phone' ? 'Telefon' : 'Vor Ort'}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {interview.meeting_link && (
                            <Button variant="outline" size="sm" asChild>
                              <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                                Meeting beitreten
                              </a>
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEdit(interview)}
                          >
                            Bearbeiten
                          </Button>
                          <Button 
                            variant="default" 
                            size="sm"
                            onClick={() => handleComplete(interview, true)}
                            disabled={processing}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Einstellen
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={() => handleComplete(interview, false)}
                            disabled={processing}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Absagen
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Past Interviews */}
          {pastInterviews.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Vergangene Interviews ({pastInterviews.length})</h2>
              <div className="grid gap-4">
                {pastInterviews.map((interview) => (
                  <Card key={interview.id} className="opacity-75">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {interview.submission.candidate.full_name}
                            </h3>
                            {getStatusBadge(interview.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {interview.submission.job.title}
                          </p>
                          {interview.scheduled_at && (
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(interview.scheduled_at), 'PPP', { locale: de })}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
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
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Speichern
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, User, Check, X, Calendar, FileText, Mail, Phone, Briefcase, Euro } from 'lucide-react';
import { toast } from 'sonner';

interface Submission {
  id: string;
  status: string;
  submitted_at: string;
  recruiter_notes: string | null;
  match_score: number | null;
  candidate: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    experience_years: number | null;
    current_salary: number | null;
    expected_salary: number | null;
    skills: string[] | null;
    summary: string | null;
    cv_url: string | null;
  };
  job: {
    id: string;
    title: string;
    company_name: string;
  };
}

export default function ClientCandidates() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        *,
        candidate:candidates(*),
        job:jobs(id, title, company_name)
      `)
      .order('submitted_at', { ascending: false });

    if (!error && data) {
      setSubmissions(data as unknown as Submission[]);
    }
    setLoading(false);
  };

  const handleAccept = async (submission: Submission) => {
    setProcessing(true);
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'accepted' })
      .eq('id', submission.id);

    if (error) {
      toast.error('Fehler beim Akzeptieren');
    } else {
      toast.success('Kandidat akzeptiert');
      fetchSubmissions();
    }
    setProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    setProcessing(true);
    
    const { error } = await supabase
      .from('submissions')
      .update({ 
        status: 'rejected',
        rejection_reason: rejectionReason 
      })
      .eq('id', selectedSubmission.id);

    if (error) {
      toast.error('Fehler beim Ablehnen');
    } else {
      toast.success('Kandidat abgelehnt');
      setRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedSubmission(null);
      fetchSubmissions();
    }
    setProcessing(false);
  };

  const handleScheduleInterview = async (submission: Submission) => {
    setProcessing(true);
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'interview' })
      .eq('id', submission.id);

    if (!error) {
      // Create interview record
      await supabase.from('interviews').insert({
        submission_id: submission.id,
        status: 'pending',
      });
      toast.success('Interview geplant - Details können in der Interview-Übersicht eingetragen werden');
      fetchSubmissions();
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      submitted: { label: 'Neu', variant: 'default' },
      accepted: { label: 'Akzeptiert', variant: 'secondary' },
      rejected: { label: 'Abgelehnt', variant: 'destructive' },
      interview: { label: 'Interview', variant: 'outline' },
      hired: { label: 'Eingestellt', variant: 'secondary' },
    };
    const config = statusConfig[status] || { label: status, variant: 'default' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const filterSubmissions = (status: string) => {
    if (status === 'all') return submissions;
    if (status === 'new') return submissions.filter(s => s.status === 'submitted');
    return submissions.filter(s => s.status === status);
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

  return (
    <>
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Eingereichte Kandidaten</h1>
            <p className="text-muted-foreground mt-1">
              Prüfen Sie die von Recruitern eingereichten Kandidaten
            </p>
          </div>

          <Tabs defaultValue="new" className="w-full">
            <TabsList>
              <TabsTrigger value="new">
                Neu ({filterSubmissions('new').length})
              </TabsTrigger>
              <TabsTrigger value="accepted">
                Akzeptiert ({filterSubmissions('accepted').length})
              </TabsTrigger>
              <TabsTrigger value="interview">
                Interview ({filterSubmissions('interview').length})
              </TabsTrigger>
              <TabsTrigger value="all">
                Alle ({submissions.length})
              </TabsTrigger>
            </TabsList>

            {['new', 'accepted', 'interview', 'all'].map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-6">
                <div className="grid gap-4">
                  {filterSubmissions(tab).length === 0 ? (
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <User className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Keine Kandidaten in dieser Kategorie</p>
                      </CardContent>
                    </Card>
                  ) : (
                    filterSubmissions(tab).map((submission) => (
                      <Card key={submission.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarFallback>
                                  {submission.candidate.full_name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-lg">{submission.candidate.full_name}</h3>
                                  {getStatusBadge(submission.status)}
                                  {submission.match_score && (
                                    <Badge variant="outline">{submission.match_score}% Match</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  für <span className="font-medium">{submission.job.title}</span> bei {submission.job.company_name}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {submission.candidate.email}
                                  </span>
                                  {submission.candidate.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {submission.candidate.phone}
                                    </span>
                                  )}
                                  {submission.candidate.experience_years && (
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="h-3 w-3" />
                                      {submission.candidate.experience_years} Jahre Erfahrung
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {submission.candidate.cv_url && (
                                <Button variant="outline" size="sm" asChild>
                                  <a href={submission.candidate.cv_url} target="_blank" rel="noopener noreferrer">
                                    <FileText className="h-4 w-4 mr-1" />
                                    CV
                                  </a>
                                </Button>
                              )}
                              {submission.status === 'submitted' && (
                                <>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => handleScheduleInterview(submission)}
                                    disabled={processing}
                                  >
                                    <Calendar className="h-4 w-4 mr-1" />
                                    Interview
                                  </Button>
                                  <Button 
                                    variant="default" 
                                    size="sm"
                                    onClick={() => handleAccept(submission)}
                                    disabled={processing}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Akzeptieren
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedSubmission(submission);
                                      setRejectDialogOpen(true);
                                    }}
                                    disabled={processing}
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Ablehnen
                                  </Button>
                                </>
                              )}
                              {submission.status === 'accepted' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleScheduleInterview(submission)}
                                  disabled={processing}
                                >
                                  <Calendar className="h-4 w-4 mr-1" />
                                  Interview planen
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Candidate Details */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {submission.candidate.expected_salary && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Gehaltsvorstellung</p>
                                  <p className="font-medium flex items-center gap-1">
                                    <Euro className="h-3 w-3" />
                                    {submission.candidate.expected_salary.toLocaleString()}
                                  </p>
                                </div>
                              )}
                              {submission.candidate.skills && submission.candidate.skills.length > 0 && (
                                <div className="col-span-2">
                                  <p className="text-xs text-muted-foreground mb-1">Skills</p>
                                  <div className="flex flex-wrap gap-1">
                                    {submission.candidate.skills.slice(0, 5).map((skill, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                                    ))}
                                    {submission.candidate.skills.length > 5 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{submission.candidate.skills.length - 5}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            {submission.recruiter_notes && (
                              <div className="mt-3">
                                <p className="text-xs text-muted-foreground">Recruiter Notizen</p>
                                <p className="text-sm mt-1">{submission.recruiter_notes}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kandidat ablehnen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bitte geben Sie einen Grund für die Ablehnung an. Dies hilft dem Recruiter bei zukünftigen Einreichungen.
              </p>
              <Textarea
                placeholder="Ablehnungsgrund..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Ablehnen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </>
  );
}

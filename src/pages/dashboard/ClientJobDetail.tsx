import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Briefcase, 
  MapPin, 
  Clock, 
  Users,
  DollarSign,
  Edit2,
  Save,
  X,
  Loader2,
  Calendar,
  Star,
  MessageSquare,
  ChevronRight,
  GripVertical,
  Building2,
  Globe,
  Percent,
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  status: string | null;
  created_at: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string | null;
  requirements: string | null;
  fee_percentage: number | null;
  paused_at: string | null;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  expected_salary: number | null;
  availability_date: string | null;
  experience_years: number | null;
  skills: string[] | null;
}

interface Submission {
  id: string;
  stage: string;
  status: string | null;
  match_score: number | null;
  submitted_at: string;
  recruiter_notes: string | null;
  candidate: Candidate;
  recruiter: {
    full_name: string | null;
    email: string;
  } | null;
}

const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Neu eingegangen', color: 'bg-blue-500' },
  { key: 'screening', label: 'In Prüfung', color: 'bg-yellow-500' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-500' },
  { key: 'second_interview', label: 'Zweitgespräch', color: 'bg-indigo-500' },
  { key: 'offer', label: 'Angebot', color: 'bg-orange-500' },
  { key: 'hired', label: 'Eingestellt', color: 'bg-green-500' },
  { key: 'rejected', label: 'Abgelehnt', color: 'bg-red-500' },
];

const REJECTION_REASONS = [
  'Qualifikation passt nicht',
  'Gehaltsvorstellung zu hoch',
  'Keine Kulturpassung',
  'Andere Kandidaten bevorzugt',
  'Position bereits besetzt',
  'Sonstiges',
];

export default function ClientJobDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [job, setJob] = useState<Job | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedJob, setEditedJob] = useState<Partial<Job>>({});
  const [saving, setSaving] = useState(false);
  
  // Dialog states
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');

  useEffect(() => {
    if (id && user) {
      fetchJobData();
    }
  }, [id, user]);

  const fetchJobData = async () => {
    try {
      // Fetch job details
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('client_id', user?.id)
        .maybeSingle();

      if (jobError) throw jobError;
      if (!jobData) {
        toast({ title: 'Job nicht gefunden', variant: 'destructive' });
        return;
      }

      setJob(jobData);
      setEditedJob(jobData);

      // Fetch submissions with candidate and recruiter info
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          stage,
          status,
          match_score,
          submitted_at,
          recruiter_notes,
          candidate:candidates!inner(
            id,
            full_name,
            email,
            phone,
            expected_salary,
            availability_date,
            experience_years,
            skills
          ),
          recruiter:profiles!submissions_recruiter_id_fkey(
            full_name,
            email
          )
        `)
        .eq('job_id', id);

      if (submissionsError) throw submissionsError;
      
      // Transform the data to match our interface
      const transformedSubmissions = (submissionsData || []).map((s: any) => ({
        ...s,
        candidate: s.candidate,
        recruiter: s.recruiter,
      }));
      
      setSubmissions(transformedSubmissions);
    } catch (error) {
      console.error('Error fetching job data:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveJob = async () => {
    if (!job) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          salary_min: editedJob.salary_min,
          salary_max: editedJob.salary_max,
          requirements: editedJob.requirements,
          remote_type: editedJob.remote_type,
        })
        .eq('id', job.id);

      if (error) throw error;
      
      setJob({ ...job, ...editedJob });
      setIsEditing(false);
      toast({ title: 'Job aktualisiert' });
    } catch (error) {
      console.error('Error updating job:', error);
      toast({ title: 'Fehler beim Speichern', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleStageChange = async (submissionId: string, newStage: string) => {
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ stage: newStage })
        .eq('id', submissionId);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, stage: newStage } : s
      ));
      toast({ title: 'Status aktualisiert' });
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({ title: 'Fehler beim Aktualisieren', variant: 'destructive' });
    }
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          stage: 'rejected',
          status: 'rejected',
          rejection_reason: rejectionReason 
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'rejected', status: 'rejected' } : s
      ));
      setShowRejectDialog(false);
      setSelectedSubmission(null);
      setRejectionReason('');
      toast({ title: 'Kandidat abgelehnt' });
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    }
  };

  const handleScheduleInterview = async () => {
    if (!selectedSubmission || !interviewDate) return;
    try {
      // Create interview
      const { error: interviewError } = await supabase
        .from('interviews')
        .insert({
          submission_id: selectedSubmission.id,
          scheduled_at: interviewDate,
          notes: interviewNotes,
          status: 'scheduled',
        });

      if (interviewError) throw interviewError;

      // Update submission stage
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ stage: 'interview' })
        .eq('id', selectedSubmission.id);

      if (updateError) throw updateError;
      
      setSubmissions(submissions.map(s => 
        s.id === selectedSubmission.id ? { ...s, stage: 'interview' } : s
      ));
      setShowInterviewDialog(false);
      setSelectedSubmission(null);
      setInterviewDate('');
      setInterviewNotes('');
      toast({ title: 'Interview geplant' });
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({ title: 'Fehler beim Planen', variant: 'destructive' });
    }
  };

  const getSubmissionsByStage = (stage: string) => {
    return submissions.filter(s => (s.stage || 'submitted') === stage);
  };

  const formatSalary = (amount: number | null) => {
    if (!amount) return '-';
    return `€${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold">Job nicht gefunden</h2>
            <Button asChild className="mt-4">
              <Link to="/dashboard/jobs">Zurück zur Übersicht</Link>
            </Button>
          </div>
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-6">
          {/* Back Link */}
          <Link 
            to="/dashboard/jobs" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Job-Übersicht
          </Link>

          {/* Job Header */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0">
                    <Briefcase className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{job.title}</CardTitle>
                    <p className="text-muted-foreground flex items-center gap-2 mt-1">
                      <Building2 className="h-4 w-4" />
                      {job.company_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    job.status === 'published' ? 'default' :
                    job.status === 'closed' ? 'destructive' :
                    job.paused_at ? 'secondary' : 'outline'
                  }>
                    {job.paused_at ? 'Pausiert' : job.status}
                  </Badge>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Abbrechen
                      </Button>
                      <Button size="sm" onClick={handleSaveJob} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Speichern
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Salary */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4" />
                    Gehalt
                  </label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={editedJob.salary_min || ''}
                        onChange={(e) => setEditedJob({ ...editedJob, salary_min: parseInt(e.target.value) || null })}
                        className="w-24"
                      />
                      <span className="self-center">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={editedJob.salary_max || ''}
                        onChange={(e) => setEditedJob({ ...editedJob, salary_max: parseInt(e.target.value) || null })}
                        className="w-24"
                      />
                    </div>
                  ) : (
                    <p className="font-medium">
                      {formatSalary(job.salary_min)} - {formatSalary(job.salary_max)}
                    </p>
                  )}
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4" />
                    Standort
                  </label>
                  <p className="font-medium">{job.location || '-'}</p>
                </div>

                {/* Remote Type */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                    <Globe className="h-4 w-4" />
                    Remote
                  </label>
                  {isEditing ? (
                    <Select 
                      value={editedJob.remote_type || ''} 
                      onValueChange={(v) => setEditedJob({ ...editedJob, remote_type: v })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="remote">Remote</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="onsite">Vor Ort</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium capitalize">{job.remote_type || '-'}</p>
                  )}
                </div>

                {/* Fee */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-2">
                    <Percent className="h-4 w-4" />
                    Vermittlungsfee
                  </label>
                  <p className="font-medium">{job.fee_percentage || 20}%</p>
                </div>
              </div>

              {/* Requirements (editable) */}
              {isEditing && (
                <div className="mt-6">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Anforderungen
                  </label>
                  <Textarea
                    value={editedJob.requirements || ''}
                    onChange={(e) => setEditedJob({ ...editedJob, requirements: e.target.value })}
                    rows={4}
                  />
                </div>
              )}

              {/* Stats Row */}
              <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-border">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{submissions.length}</span>
                  <span className="text-muted-foreground">Kandidaten</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">
                    {Math.floor((Date.now() - new Date(job.created_at).getTime()) / (1000 * 60 * 60 * 24))}
                  </span>
                  <span className="text-muted-foreground">Tage offen</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Erstellt am {formatDate(job.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kanban Pipeline */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Kandidaten-Pipeline</h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_STAGES.map((stage) => {
                const stageSubmissions = getSubmissionsByStage(stage.key);
                return (
                  <div 
                    key={stage.key}
                    className="flex-shrink-0 w-72"
                  >
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                        <h3 className="font-medium text-sm">{stage.label}</h3>
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {stageSubmissions.length}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 min-h-[200px]">
                        {stageSubmissions.map((submission) => (
                          <Card 
                            key={submission.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {submission.candidate.full_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {submission.recruiter?.full_name || 'Unbekannter Recruiter'}
                                  </p>
                                  
                                  <div className="flex items-center gap-2 mt-2">
                                    {submission.match_score && (
                                      <Badge variant="outline" className="text-xs">
                                        <Star className="h-3 w-3 mr-1" />
                                        {submission.match_score}%
                                      </Badge>
                                    )}
                                    {submission.candidate.expected_salary && (
                                      <span className="text-xs text-muted-foreground">
                                        €{submission.candidate.expected_salary.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  
                                  {submission.candidate.availability_date && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Verfügbar: {formatDate(submission.candidate.availability_date)}
                                    </p>
                                  )}
                                  
                                  {/* Actions */}
                                  {stage.key !== 'hired' && stage.key !== 'rejected' && (
                                    <div className="flex gap-1 mt-3">
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-xs h-7 flex-1"
                                        onClick={() => {
                                          setSelectedSubmission(submission);
                                          setShowInterviewDialog(true);
                                        }}
                                      >
                                        <Calendar className="h-3 w-3 mr-1" />
                                        Interview
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-xs h-7 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          setSelectedSubmission(submission);
                                          setShowRejectDialog(true);
                                        }}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  )}
                                  
                                  {/* Stage Change Dropdown */}
                                  <Select
                                    value={submission.stage || 'submitted'}
                                    onValueChange={(value) => handleStageChange(submission.id, value)}
                                  >
                                    <SelectTrigger className="mt-2 h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {PIPELINE_STAGES.map((s) => (
                                        <SelectItem key={s.key} value={s.key} className="text-xs">
                                          {s.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        
                        {stageSubmissions.length === 0 && (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            Keine Kandidaten
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kandidat ablehnen</DialogTitle>
              <DialogDescription>
                {selectedSubmission?.candidate.full_name} wird für diese Position abgelehnt.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block">Grund der Absage</label>
              <Select value={rejectionReason} onValueChange={setRejectionReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Grund auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
                Abbrechen
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason}>
                Ablehnen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Interview Dialog */}
        <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Interview planen</DialogTitle>
              <DialogDescription>
                Interview mit {selectedSubmission?.candidate.full_name} planen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Datum & Uhrzeit</label>
                <Input
                  type="datetime-local"
                  value={interviewDate}
                  onChange={(e) => setInterviewDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Notizen (optional)</label>
                <Textarea
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="z.B. Themen, Interviewer, Meeting-Link..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
                Abbrechen
              </Button>
              <Button onClick={handleScheduleInterview} disabled={!interviewDate}>
                Interview planen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </div>
  );
}
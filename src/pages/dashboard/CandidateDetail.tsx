import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
  Loader2,
  Mail,
  Phone,
  Briefcase,
  Euro,
  Calendar,
  FileText,
  ExternalLink,
  Linkedin,
  Video,
  X,
  Star,
  Clock,
  MessageSquare,
  Send,
  Sparkles,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  Archive,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Candidate {
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
  linkedin_url: string | null;
  video_url: string | null;
  availability_date: string | null;
  notice_period: string | null;
}

interface Job {
  id: string;
  title: string;
  company_name: string;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
}

interface Submission {
  id: string;
  status: string | null;
  stage: string | null;
  submitted_at: string;
  match_score: number | null;
  recruiter_notes: string | null;
  client_notes: string | null;
  rejection_reason: string | null;
  candidate: Candidate;
  job: Job;
  recruiter: {
    full_name: string | null;
    email: string;
  } | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
}

interface StatusChange {
  date: string;
  status: string;
  description: string;
}

const REJECTION_REASONS = [
  'Qualifikation passt nicht',
  'Gehaltsvorstellung zu hoch',
  'Keine Kulturpassung',
  'Andere Kandidaten bevorzugt',
  'Position bereits besetzt',
  'Sonstiges',
];

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  
  // Dialog states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (id && user) {
      fetchSubmission();
      fetchComments();
    }
  }, [id, user]);

  const fetchSubmission = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          *,
          candidate:candidates(*),
          job:jobs(id, title, company_name, requirements, salary_min, salary_max, must_haves, nice_to_haves),
          recruiter:profiles!submissions_recruiter_id_fkey(full_name, email)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: 'Kandidat nicht gefunden', variant: 'destructive' });
        return;
      }
      
      setSubmission(data as unknown as Submission);
    } catch (error) {
      console.error('Error fetching submission:', error);
      toast({ title: 'Fehler beim Laden', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const generateAiSummary = async () => {
    if (!submission) return;
    setAiLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('candidate-summary', {
        body: {
          candidate: submission.candidate,
          job: submission.job,
        },
      });

      if (error) throw error;
      setAiSummary(data.summary);
      toast({ title: 'AI-Analyse erstellt' });
    } catch (error: any) {
      console.error('Error generating AI summary:', error);
      if (error.message?.includes('429')) {
        toast({ title: 'Rate-Limit erreicht', description: 'Bitte versuche es später erneut.', variant: 'destructive' });
      } else {
        toast({ title: 'Fehler bei der AI-Analyse', variant: 'destructive' });
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setCommentLoading(true);
    
    try {
      const { error } = await supabase
        .from('candidate_comments')
        .insert({
          submission_id: id,
          user_id: user.id,
          content: newComment,
        });

      if (error) throw error;
      
      setNewComment('');
      fetchComments();
      toast({ title: 'Kommentar hinzugefügt' });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({ title: 'Fehler beim Hinzufügen', variant: 'destructive' });
    } finally {
      setCommentLoading(false);
    }
  };

  const handleReject = async () => {
    if (!submission) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ 
          status: 'rejected',
          stage: 'rejected',
          rejection_reason: rejectionReason,
        })
        .eq('id', submission.id);

      if (error) throw error;
      
      setShowRejectDialog(false);
      setRejectionReason('');
      toast({ title: 'Kandidat abgelehnt' });
      fetchSubmission();
    } catch (error) {
      console.error('Error rejecting:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleScheduleInterview = async () => {
    if (!submission || !interviewDate) return;
    setProcessing(true);
    
    try {
      // Create interview
      const { error: interviewError } = await supabase
        .from('interviews')
        .insert({
          submission_id: submission.id,
          scheduled_at: interviewDate,
          notes: interviewNotes,
          status: 'scheduled',
          meeting_type: 'video',
        });

      if (interviewError) throw interviewError;

      // Update submission stage
      const { error: updateError } = await supabase
        .from('submissions')
        .update({ stage: 'interview', status: 'interview' })
        .eq('id', submission.id);

      if (updateError) throw updateError;
      
      setShowInterviewDialog(false);
      setInterviewDate('');
      setInterviewNotes('');
      toast({ title: 'Interview geplant' });
      fetchSubmission();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({ title: 'Fehler beim Planen', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const handleMoveToTalentpool = async () => {
    if (!submission) return;
    setProcessing(true);
    
    try {
      const { error } = await supabase
        .from('submissions')
        .update({ stage: 'talentpool', status: 'talentpool' })
        .eq('id', submission.id);

      if (error) throw error;
      
      toast({ title: 'In Talentpool verschoben' });
      fetchSubmission();
    } catch (error) {
      console.error('Error moving to talentpool:', error);
      toast({ title: 'Fehler', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusTimeline = (): StatusChange[] => {
    if (!submission) return [];
    
    const timeline: StatusChange[] = [
      {
        date: submission.submitted_at,
        status: 'submitted',
        description: 'Kandidat eingereicht',
      },
    ];
    
    // Add more status changes based on current status
    if (submission.status === 'interview' || submission.status === 'hired' || submission.status === 'rejected') {
      timeline.push({
        date: submission.submitted_at, // Would need actual timestamp
        status: submission.stage || submission.status || 'unknown',
        description: getStatusDescription(submission.stage || submission.status || ''),
      });
    }
    
    return timeline;
  };

  const getStatusDescription = (status: string): string => {
    const descriptions: Record<string, string> = {
      submitted: 'Kandidat eingereicht',
      screening: 'In Prüfung',
      interview: 'Interview geplant',
      second_interview: 'Zweitgespräch',
      offer: 'Angebot gemacht',
      hired: 'Eingestellt',
      rejected: 'Abgelehnt',
      talentpool: 'Im Talentpool',
    };
    return descriptions[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-500',
      screening: 'bg-yellow-500',
      interview: 'bg-purple-500',
      second_interview: 'bg-indigo-500',
      offer: 'bg-orange-500',
      hired: 'bg-green-500',
      rejected: 'bg-red-500',
      talentpool: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!submission) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Kandidat nicht gefunden</h2>
          <Button asChild className="mt-4">
            <Link to="/dashboard/candidates">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const { candidate, job, recruiter } = submission;

  return (
    <DashboardLayout>
        <div className="space-y-6">
          {/* Back Link */}
          <Link 
            to="/dashboard/candidates" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Kandidaten-Übersicht
          </Link>

          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {candidate.full_name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{candidate.full_name}</h1>
                  <Badge className={getStatusColor(submission.stage || submission.status || 'submitted')}>
                    {getStatusDescription(submission.stage || submission.status || 'submitted')}
                  </Badge>
                  {submission.match_score && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {submission.match_score}% Match
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1">
                  für <span className="font-medium">{job.title}</span> bei {job.company_name}
                </p>
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {candidate.email}
                  </span>
                  {candidate.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            {submission.status !== 'hired' && submission.status !== 'rejected' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setShowInterviewDialog(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Interview planen
                </Button>
                <Button variant="outline" onClick={handleMoveToTalentpool} disabled={processing}>
                  <Archive className="h-4 w-4 mr-2" />
                  Talentpool
                </Button>
                <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                  <X className="h-4 w-4 mr-2" />
                  Ablehnen
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* CV Viewer */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Lebenslauf & Dokumente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {candidate.cv_url ? (
                      <Button variant="outline" asChild>
                        <a href={candidate.cv_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-4 w-4 mr-2" />
                          CV öffnen
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    ) : (
                      <p className="text-muted-foreground">Kein CV hochgeladen</p>
                    )}
                    {candidate.linkedin_url && (
                      <Button variant="outline" asChild>
                        <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                          <Linkedin className="h-4 w-4 mr-2" />
                          LinkedIn
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                    {candidate.video_url && (
                      <Button variant="outline" asChild>
                        <a href={candidate.video_url} target="_blank" rel="noopener noreferrer">
                          <Video className="h-4 w-4 mr-2" />
                          Video
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                    )}
                  </div>
                  
                  {/* PDF Preview if available */}
                  {candidate.cv_url && candidate.cv_url.endsWith('.pdf') && (
                    <div className="mt-4">
                      <iframe 
                        src={candidate.cv_url}
                        className="w-full h-[500px] border rounded-lg"
                        title="CV Preview"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Summary */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      AI-Analyse
                    </CardTitle>
                    {!aiSummary && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={generateAiSummary}
                        disabled={aiLoading}
                      >
                        {aiLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Analyse generieren
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {aiLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">AI analysiert Kandidat...</span>
                    </div>
                  ) : aiSummary ? (
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{aiSummary}</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Klicke auf "Analyse generieren" für eine AI-basierte Einschätzung des Kandidaten.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Skills */}
              {candidate.skills && candidate.skills.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Skills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Comments Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Interne Kommentare
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Add Comment */}
                  <div className="flex gap-2 mb-4">
                    <Textarea
                      placeholder="Kommentar hinzufügen..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={2}
                      className="flex-1"
                    />
                    <Button 
                      onClick={handleAddComment} 
                      disabled={commentLoading || !newComment.trim()}
                      size="icon"
                    >
                      {commentLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  
                  {/* Comments List */}
                  <div className="space-y-3">
                    {comments.length === 0 ? (
                      <p className="text-muted-foreground text-center py-4">
                        Noch keine Kommentare vorhanden.
                      </p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="border rounded-lg p-3">
                          <p className="text-sm">{comment.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {format(new Date(comment.created_at), 'PPp', { locale: de })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Erfahrung</p>
                    <p className="font-medium flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      {candidate.experience_years ? `${candidate.experience_years} Jahre` : 'Nicht angegeben'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Gehaltsvorstellung</p>
                    <p className="font-medium flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      {candidate.expected_salary 
                        ? `€${candidate.expected_salary.toLocaleString()}` 
                        : 'Nicht angegeben'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Aktuelles Gehalt</p>
                    <p className="font-medium flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      {candidate.current_salary 
                        ? `€${candidate.current_salary.toLocaleString()}` 
                        : 'Nicht angegeben'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Verfügbarkeit</p>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {candidate.availability_date 
                        ? format(new Date(candidate.availability_date), 'PP', { locale: de })
                        : candidate.notice_period || 'Nicht angegeben'}
                    </p>
                  </div>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Eingereicht am</p>
                    <p className="font-medium flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(submission.submitted_at), 'PPp', { locale: de })}
                    </p>
                  </div>
                  {recruiter && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-sm text-muted-foreground">Recruiter</p>
                        <p className="font-medium">{recruiter.full_name || recruiter.email}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Recruiter Notes */}
              {submission.recruiter_notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recruiter Notizen</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{submission.recruiter_notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Status Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Status-Verlauf</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getStatusTimeline().map((item, index) => (
                      <div key={index} className="flex gap-3">
                        <div className={`w-3 h-3 rounded-full mt-1.5 ${getStatusColor(item.status)}`} />
                        <div>
                          <p className="font-medium text-sm">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(item.date), 'PPp', { locale: de })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kandidat ablehnen</DialogTitle>
              <DialogDescription>
                {candidate.full_name} wird für diese Position abgelehnt.
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
              <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason || processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
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
                Interview mit {candidate.full_name} planen.
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
              <Button onClick={handleScheduleInterview} disabled={!interviewDate || processing}>
                {processing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Interview planen
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
  );
}
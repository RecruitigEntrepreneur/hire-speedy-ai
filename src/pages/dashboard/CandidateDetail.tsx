import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Shield,
  Lock,
  MapPin,
  Target,
  TrendingUp,
  CheckCircle2,
  User,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// Import professional components
import { ClientCandidateSummaryCard } from '@/components/candidates/ClientCandidateSummaryCard';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { useExposeData } from '@/hooks/useExposeData';
import { cn } from '@/lib/utils';

// Anonymization helper
function generateAnonymousId(id: string): string {
  return `Kandidat #${id.substring(0, 8).toUpperCase()}`;
}

function anonymizeRegion(city: string | null): string {
  if (!city) return 'Deutschland';
  // Map cities to regions
  const regionMap: Record<string, string> = {
    'München': 'Süddeutschland',
    'Berlin': 'Norddeutschland',
    'Hamburg': 'Norddeutschland',
    'Frankfurt': 'Rhein-Main',
    'Köln': 'Rheinland',
    'Düsseldorf': 'Rheinland',
    'Stuttgart': 'Süddeutschland',
  };
  return regionMap[city] || `${city} Area`;
}

function anonymizeExperience(years: number | null): string {
  if (!years) return 'Keine Angabe';
  if (years < 3) return '1-3 Jahre';
  if (years < 6) return '3-6 Jahre';
  if (years < 10) return '6-10 Jahre';
  return '10+ Jahre';
}

function formatSalary(salary: number | null): string {
  if (!salary) return 'Keine Angabe';
  const min = Math.floor(salary * 0.9 / 5000) * 5000;
  const max = Math.ceil(salary * 1.1 / 5000) * 5000;
  return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
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
  
  // Use the expose data hook for professional anonymized data
  const { data: exposeData, loading: exposeLoading, error: exposeError, generateExpose } = useExposeData(id);
  
  const [submission, setSubmission] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
          job:jobs(id, title, company_name, requirements, salary_min, salary_max, must_haves, nice_to_haves, industry)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        toast({ title: 'Kandidat nicht gefunden', variant: 'destructive' });
        return;
      }
      
      setSubmission(data);
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
      // Create interview - this triggers automatic opt-in email to candidate
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
      toast({ 
        title: 'Interview geplant', 
        description: 'Kandidat wird automatisch per E-Mail benachrichtigt und um Zustimmung gebeten.' 
      });
      fetchSubmission();
    } catch (error) {
      console.error('Error scheduling interview:', error);
      toast({ title: 'Fehler beim Planen', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  // Triple-Blind Status
  const identityUnlocked = submission?.identity_unlocked === true;
  const candidate = submission?.candidate;
  const job = submission?.job;

  // Display name based on Triple-Blind status
  const displayName = identityUnlocked && candidate?.full_name 
    ? candidate.full_name 
    : generateAnonymousId(id || '');

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      submitted: { label: 'Eingereicht', variant: 'secondary' },
      screening: { label: 'In Prüfung', variant: 'secondary' },
      interview: { label: 'Interview', variant: 'default' },
      second_interview: { label: 'Zweitgespräch', variant: 'default' },
      offer: { label: 'Angebot', variant: 'default' },
      hired: { label: 'Eingestellt', variant: 'default' },
      rejected: { label: 'Abgelehnt', variant: 'destructive' },
      talentpool: { label: 'Talentpool', variant: 'outline' },
    };
    const cfg = config[status || 'submitted'] || config.submitted;
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading || exposeLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 space-y-6">
              <Skeleton className="h-64" />
              <Skeleton className="h-48" />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!submission || !candidate) {
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Link */}
        <Link 
          to="/dashboard/candidates" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Kandidaten-Übersicht
        </Link>

        {/* Triple-Blind Banner */}
        {!identityUnlocked && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm">Triple-Blind Modus aktiv</p>
              <p className="text-sm text-muted-foreground">
                Persönliche Daten sind geschützt. Nach Interview-Anfrage erhält der Kandidat eine Opt-In Anfrage. 
                Bei Zustimmung werden alle Informationen freigegeben.
              </p>
            </div>
          </div>
        )}

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Anonymous Avatar */}
            <div className={cn(
              "h-16 w-16 rounded-full flex items-center justify-center text-lg font-semibold",
              identityUnlocked 
                ? "bg-primary/10 text-primary" 
                : "bg-muted text-muted-foreground"
            )}>
              {identityUnlocked && candidate.full_name ? (
                candidate.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
              ) : (
                <User className="h-7 w-7" />
              )}
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  {displayName}
                  {!identityUnlocked && <Lock className="h-5 w-5 text-muted-foreground" />}
                </h1>
                {getStatusBadge(submission.stage || submission.status)}
              </div>
              
              <p className="text-muted-foreground">
                für <span className="font-medium">{job?.title || 'Position'}</span>
              </p>
              
              {/* Match Score & Deal Health */}
              <div className="flex items-center gap-3 mt-2">
                {exposeData?.matchScore !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className={cn("font-semibold", getMatchScoreColor(exposeData.matchScore))}>
                      {exposeData.matchScore}% Match
                    </span>
                  </div>
                )}
                {exposeData?.dealHealthScore !== undefined && (
                  <DealHealthBadge 
                    score={exposeData.dealHealthScore} 
                    riskLevel={exposeData.dealHealthRisk as 'low' | 'medium' | 'high'} 
                    size="sm"
                  />
                )}
              </div>

              {/* Contact info - only when unlocked */}
              {identityUnlocked && (
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                  {candidate.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-4 w-4" />
                      {candidate.email}
                    </span>
                  )}
                  {candidate.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" />
                      {candidate.phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          
          {/* Actions */}
          {submission.status !== 'hired' && submission.status !== 'rejected' && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setShowInterviewDialog(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Interview anfragen
              </Button>
              <Button variant="destructive" onClick={() => setShowRejectDialog(true)}>
                <X className="h-4 w-4 mr-2" />
                Ablehnen
              </Button>
            </div>
          )}
        </div>

        {/* Main Content Grid - 60/40 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - 60% */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Hard Facts Grid */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Profil-Übersicht
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Experience */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Erfahrung</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      {anonymizeExperience(candidate.experience_years)}
                    </p>
                  </div>
                  
                  {/* Location */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Region</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {identityUnlocked ? (candidate.city || 'Nicht angegeben') : anonymizeRegion(candidate.city)}
                    </p>
                  </div>
                  
                  {/* Salary */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Gehalt</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      {formatSalary(candidate.expected_salary)}
                    </p>
                  </div>
                  
                  {/* Availability */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Verfügbarkeit</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {candidate.notice_period || candidate.availability_date 
                        ? (candidate.notice_period || format(new Date(candidate.availability_date), 'MMM yyyy', { locale: de }))
                        : 'Nicht angegeben'}
                    </p>
                  </div>
                  
                  {/* Work Model */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Arbeitsmodell</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {candidate.remote_preference === 'remote' ? 'Remote' 
                        : candidate.remote_preference === 'hybrid' ? 'Hybrid' 
                        : candidate.remote_preference === 'onsite' ? 'Vor Ort' 
                        : 'Flexibel'}
                    </p>
                  </div>
                  
                  {/* Seniority */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Level</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      {candidate.seniority || candidate.job_title || 'Nicht angegeben'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Skills Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Kompetenzen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(candidate.skills || []).map((skill: string, idx: number) => (
                    <Badge key={idx} variant="secondary" className="text-sm">
                      {skill}
                    </Badge>
                  ))}
                  {(!candidate.skills || candidate.skills.length === 0) && (
                    <p className="text-sm text-muted-foreground">Keine Skills angegeben</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Executive Summary from Expose Data */}
            {exposeData?.executiveSummary && exposeData.executiveSummary.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Zusammenfassung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {exposeData.executiveSummary.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Protected Information Section - When Locked */}
            {!identityUnlocked && (
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-5 w-5" />
                    Geschützte Informationen
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Folgende Daten werden nach Interview-Anfrage und Kandidaten-Zustimmung sichtbar:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <User className="h-4 w-4" /> Vollständiger Name
                    </li>
                    <li className="flex items-center gap-2">
                      <Mail className="h-4 w-4" /> E-Mail-Adresse
                    </li>
                    <li className="flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Telefonnummer
                    </li>
                    <li className="flex items-center gap-2">
                      <FileText className="h-4 w-4" /> Lebenslauf
                    </li>
                    <li className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" /> LinkedIn-Profil
                    </li>
                    <li className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> Bisherige Arbeitgeber
                    </li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Documents - Only When Unlocked */}
            {identityUnlocked && (candidate.cv_url || candidate.linkedin_url || candidate.video_url) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Dokumente & Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {candidate.cv_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.cv_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Lebenslauf öffnen
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  )}
                  {candidate.linkedin_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.linkedin_url} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  )}
                  {candidate.video_url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={candidate.video_url} target="_blank" rel="noopener noreferrer">
                        <Video className="h-4 w-4 mr-2" />
                        Video
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Comments Section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  Notizen & Kommentare
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add Comment */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Notiz hinzufügen..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
                <Button 
                  onClick={handleAddComment} 
                  disabled={!newComment.trim() || commentLoading}
                  className="w-full sm:w-auto"
                >
                  {commentLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Notiz speichern
                </Button>
                
                {/* Comments List */}
                {comments.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <ScrollArea className="max-h-64">
                      <div className="space-y-3">
                        {comments.map((comment) => (
                          <div key={comment.id} className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm">{comment.content}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - 40% - AI Analysis */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client Candidate Summary Card - The star of the show */}
            <ClientCandidateSummaryCard 
              candidateId={candidate.id}
              submissionId={id}
            />
            
            {/* Recruiter Notes (if any) */}
            {submission.recruiter_notes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Recruiter-Empfehlung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{submission.recruiter_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kandidat ablehnen</DialogTitle>
            <DialogDescription>
              Bitte wählen Sie einen Ablehnungsgrund aus.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={rejectionReason} onValueChange={setRejectionReason}>
              <SelectTrigger>
                <SelectValue placeholder="Ablehnungsgrund wählen" />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_REASONS.map((reason) => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject}
              disabled={!rejectionReason || processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Dialog */}
      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Interview anfragen</DialogTitle>
            <DialogDescription>
              Wählen Sie einen Termin für das Interview. Der Kandidat erhält automatisch eine Opt-In Anfrage per E-Mail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Termin</label>
              <Input
                type="datetime-local"
                value={interviewDate}
                onChange={(e) => setInterviewDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notizen (optional)</label>
              <Textarea
                placeholder="Zusätzliche Informationen zum Interview..."
                value={interviewNotes}
                onChange={(e) => setInterviewNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInterviewDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleScheduleInterview}
              disabled={!interviewDate || processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Interview anfragen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

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
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft,
  Loader2,
  Mail,
  Phone,
  Calendar,
  FileText,
  ExternalLink,
  Linkedin,
  X,
  Clock,
  MessageSquare,
  Send,
  Lock,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { ClientCandidateSummaryCard } from '@/components/candidates/ClientCandidateSummaryCard';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { cn } from '@/lib/utils';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const { data: candidateView, loading, error, refetch } = useClientCandidateView(id);
  
  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  
  // Dialogs
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);

  useEffect(() => {
    if (id && user) fetchComments();
  }, [id, user]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('candidate_comments')
        .select('*')
        .eq('submission_id', id)
        .order('created_at', { ascending: false });
      if (!error && data) setComments(data);
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
        .insert({ submission_id: id, user_id: user.id, content: newComment });
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

  // Loading
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </DashboardLayout>
    );
  }

  // Error
  if (error || !candidateView) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Kandidat nicht gefunden</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
          <Button asChild className="mt-4">
            <Link to="/dashboard/candidates">Zurück zur Übersicht</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const {
    displayName, identityUnlocked, currentRole, experience, seniority,
    salaryRange, availability, region, workModel, topSkills,
    status, stage, jobTitle, jobId, recruiterNotes,
    email, phone, cvUrl, linkedinUrl, hasInterview,
    candidateId, submissionId
  } = candidateView;

  // Helper: is value a semantic placeholder?
  const isPlaceholder = (val: string) => {
    const placeholders = ['Nicht angegeben', 'Ausstehend', 'Unbekannt', 'Flexibel',
      'Noch nicht besprochen', 'CV-Analyse ausstehend', 'Wird im Interview besprochen',
      'Wird basierend auf CV ermittelt', 'Präferenz noch nicht erfasst', 'Fachkraft',
      'Vom Kandidaten noch nicht freigegeben', 'Standort nicht angegeben'];
    return placeholders.some(p => val.includes(p));
  };

  const getStatusLabel = (s: string | null): string => {
    const labels: Record<string, string> = {
      submitted: 'Eingereicht',
      screening: 'In Prüfung',
      interview_requested: 'Interview angefragt',
      candidate_opted_in: 'Opt-In erhalten',
      interview_scheduled: 'Interview geplant',
      interview: 'Interview-Phase',
      second_interview: 'Zweitgespräch',
      offer: 'Angebot',
      hired: 'Eingestellt',
      rejected: 'Abgelehnt',
      client_rejected: 'Abgelehnt',
      opt_in_declined: 'Opt-In abgelehnt',
      talentpool: 'Talentpool',
    };
    return labels[s || 'submitted'] || 'Eingereicht';
  };

  // Profile fields config
  const profileFields = [
    { label: 'Aktuelle Rolle', value: currentRole },
    { label: 'Hintergrund', value: topSkills.length > 0 ? topSkills.slice(0, 3).join(', ') : null },
    { label: 'Seniorität', value: seniority },
    { label: 'Region', value: region },
    { label: 'Arbeitsmodell', value: workModel },
    { label: 'Verfügbarkeit', value: availability },
    { label: 'Erfahrung', value: experience },
    { label: 'Gehalt', value: salaryRange },
  ].filter(f => f.value);

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Back */}
        <Link 
          to="/dashboard/candidates" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zu Bewerbungen
        </Link>

        {/* ==================== 1. HEADER ==================== */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0",
              identityUnlocked 
                ? "bg-primary/10 text-primary" 
                : "bg-muted text-muted-foreground"
            )}>
              {identityUnlocked ? (
                displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
              ) : (
                <User className="h-6 w-6" />
              )}
            </div>
            
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                {displayName}
                {!identityUnlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                für <span className="font-medium text-foreground">{jobTitle}</span>
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {getStatusLabel(stage || status)}
                {stage === 'interview_requested' && ' · Opt-In ausstehend'}
              </p>
            </div>
          </div>

          {/* Actions */}
          {status !== 'hired' && status !== 'rejected' && status !== 'client_rejected' && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {stage === 'interview_requested' ? (
                <>
                  <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Interview angefragt
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowRejectDialog(true)}>
                    <X className="h-4 w-4 mr-1" />
                    Ablehnen
                  </Button>
                </>
              ) : stage === 'candidate_opted_in' ? (
                <>
                  <Button onClick={() => setShowInterviewDialog(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Interview planen
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectDialog(true)}>
                    <X className="h-4 w-4 mr-1" />
                    Ablehnen
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => setShowInterviewDialog(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Interview anfragen
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectDialog(true)}>
                    <X className="h-4 w-4 mr-1" />
                    Ablehnen
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ==================== 2. KI-EINSCHÄTZUNG (HERO) ==================== */}
        <ClientCandidateSummaryCard 
          candidateId={candidateId}
          submissionId={id}
        />

        {/* Recruiter Notes (if any) */}
        {recruiterNotes && (
          <div className="p-4 bg-muted/50 rounded-lg border">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Recruiter-Empfehlung</p>
            <p className="text-sm">{recruiterNotes}</p>
          </div>
        )}

        {/* ==================== 3. PROFIL + NOTIZEN (60/40) ==================== */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Profile */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profileFields.map((field) => {
                  const faded = isPlaceholder(field.value!);
                  return (
                    <div key={field.label} className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-muted-foreground shrink-0">{field.label}</span>
                      <span className={cn(
                        "text-sm text-right",
                        faded ? "text-muted-foreground/50" : "font-medium"
                      )}>
                        {field.value}
                      </span>
                    </div>
                  );
                })}

                {/* Skills as badges if present */}
                {topSkills.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div>
                      <span className="text-sm text-muted-foreground">Skills</span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {topSkills.slice(0, 8).map((skill: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-normal">
                            {skill}
                          </Badge>
                        ))}
                        {topSkills.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{topSkills.length - 8}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Notizen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Notiz hinzufügen..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
              </div>
              <Button 
                onClick={handleAddComment} 
                disabled={!newComment.trim() || commentLoading}
                size="sm"
                className="w-full"
              >
                {commentLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Speichern
              </Button>
              
              {comments.length > 0 && (
                <ScrollArea className="max-h-48">
                  <div className="space-y-2 pt-2">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-2.5 bg-muted/50 rounded-lg">
                        <p className="text-sm">{comment.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(comment.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ==================== 4. DOKUMENTE & KONTAKT (nur wenn unlocked) ==================== */}
        {identityUnlocked && (email || phone || cvUrl || linkedinUrl) && (
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-4 items-center">
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-sm hover:underline">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {email}
                  </a>
                )}
                {phone && (
                  <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-sm hover:underline">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {phone}
                  </a>
                )}
                {cvUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-4 w-4 mr-1.5" />
                      Lebenslauf
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </a>
                  </Button>
                )}
                {linkedinUrl && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                      <Linkedin className="h-4 w-4 mr-1.5" />
                      LinkedIn
                      <ExternalLink className="h-3 w-3 ml-1.5" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ==================== 5. ANONYMITÄTS-HINWEIS (dezent) ==================== */}
        {!identityUnlocked && (
          <p className="text-xs text-muted-foreground/60 text-center py-2">
            Anonymisiertes Profil — Nach Interview-Zustimmung werden Name, Kontakt und CV freigeschaltet.
          </p>
        )}
      </div>

      {/* Dialoge */}
      <RejectionDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        submission={{
          id: submissionId,
          candidate: { id: candidateId, full_name: displayName, email: email || '' },
          job: { id: jobId, title: jobTitle, company_name: '' }
        }}
        onSuccess={() => { setShowRejectDialog(false); refetch(); }}
      />

      <ProfessionalInterviewWizard
        open={showInterviewDialog}
        onOpenChange={setShowInterviewDialog}
        submissionId={submissionId}
        candidateAnonymousId={displayName}
        jobTitle={jobTitle}
        onSuccess={() => { setShowInterviewDialog(false); refetch(); }}
      />
    </DashboardLayout>
  );
}

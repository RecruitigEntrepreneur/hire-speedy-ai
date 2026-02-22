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
  Scale,
  Briefcase,
  MapPin,
  Banknote,
  GraduationCap,
  Globe,
  Target,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

import { ClientCandidateSummaryCard } from '@/components/candidates/ClientCandidateSummaryCard';
import { CandidateExperienceTimeline } from '@/components/candidates/CandidateExperienceTimeline';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { cn } from '@/lib/utils';

// Helper: is value a semantic placeholder?
const isPlaceholder = (val: string) => {
  const placeholders = ['Nicht angegeben', 'Ausstehend', 'Unbekannt', 'Flexibel',
    'Noch nicht besprochen', 'CV-Analyse ausstehend', 'Wird im Interview besprochen',
    'Wird basierend auf CV ermittelt', 'Präferenz noch nicht erfasst', 'Fachkraft',
    'Vom Kandidaten noch nicht freigegeben', 'Standort nicht angegeben'];
  return placeholders.some(p => val.includes(p));
};

// Build enriched work model label
function buildWorkModelLabel(workModel: string, remoteDays: number | null, relocation: boolean | null): string {
  const parts = [workModel];
  if (remoteDays && remoteDays > 0) parts.push(`${remoteDays}T Remote`);
  if (relocation === true) parts.push('umzugsbereit');
  return parts.join(', ');
}

// ============================================================================
// Sidebar Section Components
// ============================================================================
function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{label}</p>
      {children}
    </div>
  );
}

function SidebarField({ label, value, faded }: { label: string; value: string; faded?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-xs text-right", faded ? "text-muted-foreground/50" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

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
        <div className="flex gap-6">
          <div className="w-80 shrink-0 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="flex-1 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
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
    email, phone, cvUrl, linkedinUrl,
    candidateId, submissionId,
    certifications, languageSkills, industryExperience, targetRoles,
    careerGoals, relocationWilling, remoteDaysPreferred,
  } = candidateView;

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

  const enrichedWorkModel = buildWorkModelLabel(workModel, remoteDaysPreferred, relocationWilling);
  const hasSkills = topSkills.length > 0;
  const hasCerts = certifications.length > 0;
  const hasLanguages = languageSkills.length > 0;
  const hasContact = identityUnlocked && (email || phone || cvUrl || linkedinUrl);
  const hasCareerGoals = targetRoles.length > 0 || !!careerGoals;
  const isTerminal = status === 'hired' || status === 'rejected' || status === 'client_rejected';

  return (
    <DashboardLayout>
      {/* Back navigation */}
      <Link 
        to="/dashboard/candidates" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Zurück zu Bewerbungen
      </Link>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ==================== SIDEBAR ==================== */}
        <aside className="w-full lg:w-80 shrink-0 lg:sticky lg:top-0 lg:self-start space-y-1">
          {/* Header: Avatar + Name + Status */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
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
                <div className="min-w-0">
                  <h1 className="text-base font-bold flex items-center gap-1.5 truncate">
                    {displayName}
                    {!identityUnlocked && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    für {jobTitle}
                  </p>
                  <Badge variant="outline" className="mt-1.5 text-[10px] h-5">
                    {getStatusLabel(stage || status)}
                    {stage === 'interview_requested' && ' · Opt-In ausstehend'}
                  </Badge>
                </div>
              </div>

              {/* CTA Buttons */}
              {!isTerminal && (
                <div className="mt-4 space-y-2">
                  {stage === 'interview_requested' ? (
                    <>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                        <Clock className="h-3.5 w-3.5" />
                        Interview angefragt — Opt-In ausstehend
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRejectDialog(true)}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Ablehnen
                      </Button>
                    </>
                  ) : stage === 'candidate_opted_in' ? (
                    <>
                      <Button size="sm" className="w-full" onClick={() => setShowInterviewDialog(true)}>
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        Interview planen
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRejectDialog(true)}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Ablehnen
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" className="w-full" onClick={() => setShowInterviewDialog(true)}>
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        Interview anfragen
                      </Button>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setShowRejectDialog(true)}>
                        <X className="h-3.5 w-3.5 mr-1.5" />
                        Ablehnen
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar Data Sections */}
          <Card>
            <CardContent className="p-5 space-y-5">
              {/* Kompetenzen */}
              {(hasSkills || hasCerts || hasLanguages) && (
                <SidebarSection label="Kompetenzen">
                  {hasSkills && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {topSkills.slice(0, 8).map((skill: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                          {skill}
                        </Badge>
                      ))}
                      {topSkills.length > 8 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{topSkills.length - 8}</Badge>
                      )}
                    </div>
                  )}
                  {hasCerts && (
                    <div className="mt-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1">Zertifizierungen</p>
                      <div className="flex flex-wrap gap-1">
                        {certifications.map((cert, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                            {cert}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {hasLanguages && (
                    <div className="mt-2.5">
                      <p className="text-[10px] text-muted-foreground mb-1">Sprachen</p>
                      <p className="text-xs font-medium">
                        {languageSkills.map(ls => ls.level ? `${ls.language} (${ls.level})` : ls.language).join(', ')}
                      </p>
                    </div>
                  )}
                </SidebarSection>
              )}

              {(hasSkills || hasCerts || hasLanguages) && <Separator />}

              {/* Rahmenbedingungen */}
              <SidebarSection label="Rahmenbedingungen">
                <div className="space-y-1">
                  <SidebarField label="Region" value={region} faded={isPlaceholder(region)} />
                  <SidebarField label="Arbeitsmodell" value={enrichedWorkModel} faded={isPlaceholder(workModel)} />
                  <SidebarField label="Verfügbarkeit" value={availability} faded={isPlaceholder(availability)} />
                  <SidebarField label="Gehaltsband" value={salaryRange} faded={isPlaceholder(salaryRange)} />
                </div>
              </SidebarSection>

              {/* Kontakt (nur wenn unlocked) */}
              {hasContact && (
                <>
                  <Separator />
                  <SidebarSection label="Kontakt">
                    <div className="space-y-1.5">
                      {email && (
                        <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-xs hover:underline truncate">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          {email}
                        </a>
                      )}
                      {phone && (
                        <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-xs hover:underline">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          {phone}
                        </a>
                      )}
                      <div className="flex gap-1.5 mt-1">
                        {cvUrl && (
                          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" asChild>
                            <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3 w-3 mr-1" />
                              CV
                              <ExternalLink className="h-2.5 w-2.5 ml-1" />
                            </a>
                          </Button>
                        )}
                        {linkedinUrl && (
                          <Button variant="outline" size="sm" className="h-7 text-[10px] px-2" asChild>
                            <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                              <Linkedin className="h-3 w-3 mr-1" />
                              LinkedIn
                              <ExternalLink className="h-2.5 w-2.5 ml-1" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </SidebarSection>
                </>
              )}

              {/* Karriereziele */}
              {hasCareerGoals && (
                <>
                  <Separator />
                  <SidebarSection label="Karriereziele">
                    {targetRoles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {targetRoles.map((role, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] font-normal px-1.5 py-0">
                            <Target className="h-2.5 w-2.5 mr-0.5" />
                            {role}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {careerGoals && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{careerGoals}</p>
                    )}
                  </SidebarSection>
                </>
              )}
            </CardContent>
          </Card>
        </aside>

        {/* ==================== MAIN CONTENT ==================== */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* Quick-Facts Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <QuickFactTile icon={Briefcase} label="Rolle" value={currentRole} faded={isPlaceholder(currentRole)} />
            <QuickFactTile icon={GraduationCap} label="Seniorität" value={seniority} faded={isPlaceholder(seniority)} />
            <QuickFactTile icon={MapPin} label="Region" value={region} faded={isPlaceholder(region)} />
            <QuickFactTile icon={Banknote} label="Gehalt" value={salaryRange} faded={isPlaceholder(salaryRange)} />
            <QuickFactTile icon={Clock} label="Verfügbar" value={availability} faded={isPlaceholder(availability)} />
          </div>

          {/* Karriere-Timeline */}
          {identityUnlocked ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Karriere-Stationen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CandidateExperienceTimeline candidateId={candidateId} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Lock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  Karriere-Stationen werden nach Interview-Zustimmung sichtbar.
                </p>
              </CardContent>
            </Card>
          )}

          {/* KI-Einschätzung (compact) */}
          <ClientCandidateSummaryCard 
            candidateId={candidateId}
            submissionId={id}
            compact
          />

          {/* Recruiter Notes */}
          {recruiterNotes && (
            <div className="p-4 bg-muted/40 rounded-lg border-l-2 border-muted-foreground/20">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Recruiter-Empfehlung</p>
              <p className="text-sm">{recruiterNotes}</p>
            </div>
          )}

          {/* Notizen */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
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

          {/* Compliance Footer */}
          <div className="text-xs text-muted-foreground/60 text-center py-3 space-y-1">
            {!identityUnlocked && (
              <p>Anonymisiertes Profil — Nach Interview-Zustimmung werden Name, Kontakt und CV freigeschaltet.</p>
            )}
            <p className="flex items-center justify-center gap-1">
              <Scale className="h-3 w-3" />
              Die KI-Einschätzung auf dieser Seite wird gemäß EU AI Act (Verordnung 2024/1689) als Hochrisiko-KI-System betrieben.
            </p>
          </div>
        </main>
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

// ============================================================================
// Quick Fact Tile
// ============================================================================
function QuickFactTile({ 
  icon: Icon, 
  label, 
  value, 
  faded 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  faded?: boolean;
}) {
  return (
    <div className="bg-card border rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn("text-xs font-medium truncate", faded && "text-muted-foreground/50")}>
        {value}
      </p>
    </div>
  );
}

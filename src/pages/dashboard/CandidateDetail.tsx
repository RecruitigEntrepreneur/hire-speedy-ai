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
  Clock,
  MessageSquare,
  Send,
  Sparkles,
  Shield,
  Lock,
  MapPin,
  Target,
  TrendingUp,
  User,
  GraduationCap,
  Building2,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// Import professional components
import { ClientCandidateSummaryCard } from '@/components/candidates/ClientCandidateSummaryCard';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { useExposeData } from '@/hooks/useExposeData';
import { cn } from '@/lib/utils';

// Import Triple-Blind anonymization helpers
import { 
  generateAnonymousId, 
  anonymizeRegionBroad, 
  anonymizeExperience, 
  anonymizeSalary,
  getFitLabel,
  getMotivationStatus,
  explainMissingField,
} from '@/lib/anonymization';

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
  const { data: exposeData, loading: exposeLoading } = useExposeData(id);
  
  const [submission, setSubmission] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [clientSummary, setClientSummary] = useState<any>(null);
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
      fetchClientSummary();
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

  const fetchClientSummary = async () => {
    try {
      // Try to get summary by submission_id first
      const { data, error } = await supabase
        .from('candidate_client_summary')
        .select('*')
        .eq('submission_id', id)
        .maybeSingle();

      if (!error && data) {
        setClientSummary(data);
      }
    } catch (error) {
      console.error('Error fetching client summary:', error);
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
  const hasInterview = !!clientSummary?.change_motivation_status && clientSummary.change_motivation_status !== 'unbekannt';

  // Display name based on Triple-Blind status - NEVER show real name when locked
  const displayName = identityUnlocked && candidate?.full_name 
    ? candidate.full_name 
    : generateAnonymousId(id || '');

  // Get fit assessment from summary
  const fitLabel = getFitLabel(
    clientSummary?.recommendation_score || exposeData?.matchScore,
    clientSummary?.fit_assessment
  );

  // Get motivation status
  const motivationStatus = getMotivationStatus(clientSummary?.change_motivation_status);

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

        {/* ==================== 1. STATUS & AKTIONEN ==================== */}
        <Card className="border-l-4 border-l-primary">
          <CardContent className="py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Left: ID, Job, Status, Fit */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Anonymous Avatar */}
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center text-lg font-semibold shrink-0",
                  identityUnlocked 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {identityUnlocked && candidate.full_name ? (
                    candidate.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
                  ) : (
                    <User className="h-6 w-6" />
                  )}
                </div>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                      {displayName}
                      {!identityUnlocked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </h1>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    für <span className="font-medium text-foreground">{job?.title || 'Position'}</span>
                  </p>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(submission.stage || submission.status)}
                  
                  {/* Fit Assessment Badge */}
                  <Badge className={cn(fitLabel.bgClass, fitLabel.textClass, "border-0")}>
                    {fitLabel.label}
                  </Badge>
                </div>
              </div>
              
              {/* Right: Actions */}
              {submission.status !== 'hired' && submission.status !== 'rejected' && (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setShowInterviewDialog(true)}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Interview anfragen
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectDialog(true)}>
                    <X className="h-4 w-4 mr-2" />
                    Ablehnen
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Triple-Blind Info Banner */}
        {!identityUnlocked && (
          <div className="bg-muted/50 border rounded-lg p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">Anonymisiertes Profil</p>
              <p className="text-sm text-muted-foreground">
                Persönliche Daten sind zum Schutz des Kandidaten verborgen. 
                Nach Interview-Anfrage erhält der Kandidat eine Opt-In Anfrage. 
                Bei Zustimmung werden Name, Kontaktdaten und Lebenslauf freigeschaltet.
              </p>
            </div>
          </div>
        )}

        {/* Main Content Grid - 60/40 Split */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left Column - 60% */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* ==================== 2. PROFIL-SNAPSHOT ==================== */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  Profil-Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Role Archetype */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Rollen-Archetyp</p>
                    <p className="font-medium text-sm">
                      {clientSummary?.role_archetype || candidate.seniority || 'Fachkraft'}
                    </p>
                  </div>
                  
                  {/* Primary Domain */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Domäne</p>
                    <p className="font-medium text-sm">
                      {clientSummary?.primary_domain || 'Software Engineering'}
                    </p>
                  </div>
                  
                  {/* Region - Always anonymized to broad region */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Region</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {identityUnlocked 
                        ? (candidate.city || 'Nicht angegeben') 
                        : anonymizeRegionBroad(candidate.city)}
                    </p>
                  </div>
                  
                  {/* Seniority */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Seniorität</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      {candidate.seniority || explainMissingField('seniority', hasInterview)}
                    </p>
                  </div>
                  
                  {/* Work Model */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Arbeitsmodell</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {candidate.remote_preference === 'remote' ? 'Remote' 
                        : candidate.remote_preference === 'hybrid' ? 'Hybrid' 
                        : candidate.remote_preference === 'onsite' ? 'Vor Ort' 
                        : candidate.work_model || 'Flexibel'}
                    </p>
                  </div>
                  
                  {/* Availability */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Verfügbarkeit</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {candidate.notice_period || 
                       (candidate.availability_date 
                         ? format(new Date(candidate.availability_date), 'MMM yyyy', { locale: de })
                         : explainMissingField('availability', hasInterview))}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Salary & Experience Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Experience Range */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Erfahrung</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      {anonymizeExperience(candidate.experience_years)}
                    </p>
                  </div>
                  
                  {/* Salary Range */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Gehaltsband</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      {candidate.expected_salary 
                        ? anonymizeSalary(candidate.expected_salary)
                        : candidate.salary_expectation_min && candidate.salary_expectation_max
                          ? `€${(candidate.salary_expectation_min / 1000).toFixed(0)}k - €${(candidate.salary_expectation_max / 1000).toFixed(0)}k`
                          : explainMissingField('salary', hasInterview)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ==================== 3. FACHLICHER HINTERGRUND ==================== */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Fachlicher Hintergrund
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Primary Origin */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Primärer Ursprung</p>
                  <p className="font-medium">
                    {clientSummary?.primary_domain || 'Software Engineering'}
                  </p>
                </div>
                
                {/* Top 5 Core Competencies */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Kernkompetenzen (Top 5)</p>
                  <div className="flex flex-wrap gap-2">
                    {(candidate.skills || []).slice(0, 5).map((skill: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills && candidate.skills.length > 5 && (
                      <Badge variant="outline" className="text-sm">
                        +{candidate.skills.length - 5} weitere
                      </Badge>
                    )}
                    {(!candidate.skills || candidate.skills.length === 0) && (
                      <p className="text-sm text-muted-foreground">
                        {explainMissingField('skills', hasInterview)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ==================== 4. MATCHING-BEWERTUNG ==================== */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Matching-Bewertung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Score + Fit Label */}
                <div className="flex items-center gap-4">
                  {(clientSummary?.recommendation_score || exposeData?.matchScore) && (
                    <div className="text-3xl font-bold">
                      {clientSummary?.recommendation_score || exposeData?.matchScore}%
                    </div>
                  )}
                  <Badge className={cn(fitLabel.bgClass, fitLabel.textClass, "border-0 text-sm px-3 py-1")}>
                    {fitLabel.label}
                  </Badge>
                </div>

                {/* Executive Summary - Anonymized */}
                {clientSummary?.executive_summary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {clientSummary.executive_summary}
                  </p>
                )}

                {/* If no summary yet */}
                {!clientSummary?.executive_summary && exposeData?.executiveSummary && exposeData.executiveSummary.length > 0 && (
                  <ul className="space-y-2">
                    {exposeData.executiveSummary.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* ==================== 5. DEAL-FAKTOREN ==================== */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Deal-Faktoren
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Motivation Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Wechselmotivation</span>
                  <Badge className={cn(motivationStatus.bgClass, motivationStatus.textClass, "border-0")}>
                    {motivationStatus.label}
                  </Badge>
                </div>

                <Separator />

                {/* Risks & Strengths Summary */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Risks */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Risiken
                    </div>
                    {clientSummary?.risk_factors && Array.isArray(clientSummary.risk_factors) && clientSummary.risk_factors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {clientSummary.risk_factors.filter((r: any) => r.severity === 'high').length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {clientSummary.risk_factors.filter((r: any) => r.severity === 'high').length} hoch
                          </Badge>
                        )}
                        {clientSummary.risk_factors.filter((r: any) => r.severity === 'medium').length > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                            {clientSummary.risk_factors.filter((r: any) => r.severity === 'medium').length} mittel
                          </Badge>
                        )}
                        {clientSummary.risk_factors.filter((r: any) => r.severity === 'low').length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {clientSummary.risk_factors.filter((r: any) => r.severity === 'low').length} gering
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {explainMissingField('risks', hasInterview)}
                      </p>
                    )}
                  </div>

                  {/* Strengths */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Stärken
                    </div>
                    {clientSummary?.positive_factors && Array.isArray(clientSummary.positive_factors) && clientSummary.positive_factors.length > 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                        {clientSummary.positive_factors.length} identifiziert
                      </Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {explainMissingField('strengths', hasInterview)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Deal Health Badge */}
                {exposeData?.dealHealthScore !== undefined && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Deal-Gesundheit</span>
                      <DealHealthBadge 
                        score={exposeData.dealHealthScore} 
                        riskLevel={exposeData.dealHealthRisk as 'low' | 'medium' | 'high'} 
                        size="sm"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ==================== 6. ANONYMITÄTS-HINWEIS ==================== */}
            {!identityUnlocked && (
              <Card className="border-dashed border-muted-foreground/30">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium mb-2">Hinweis zur Anonymität</p>
                      <p className="text-sm text-muted-foreground mb-3">
                        Dieses Profil zeigt anonymisierte Daten zum Schutz des Kandidaten. 
                        Nach Interview-Anfrage und Kandidaten-Zustimmung werden freigeschaltet:
                      </p>
                      <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
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
                          <Building2 className="h-4 w-4" /> Arbeitgeber-Historie
                        </li>
                      </ul>
                    </div>
                  </div>
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
            
            {/* Recruiter Notes (anonymized) */}
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

            {/* Contact info card - Only When Unlocked */}
            {identityUnlocked && (candidate.email || candidate.phone) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Kontaktdaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {candidate.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${candidate.email}`} className="hover:underline">
                        {candidate.email}
                      </a>
                    </div>
                  )}
                  {candidate.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${candidate.phone}`} className="hover:underline">
                        {candidate.phone}
                      </a>
                    </div>
                  )}
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

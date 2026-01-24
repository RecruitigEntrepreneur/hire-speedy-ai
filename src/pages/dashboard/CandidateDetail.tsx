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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { MatchScoreBreakdown } from '@/components/matching/MatchScoreBreakdown';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { useClientCandidateView } from '@/hooks/useClientCandidateView';
import { useMatchScoreV31 } from '@/hooks/useMatchScoreV31';
import { cn } from '@/lib/utils';

// Import Triple-Blind anonymization helpers
import { 
  generateAnonymousId, 
  explainMissingField,
} from '@/lib/anonymization';

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  
  // ============================================================================
  // ZENTRALE DATENQUELLE: useClientCandidateView Hook
  // ============================================================================
  const { data: candidateView, loading, error, refetch } = useClientCandidateView(id);
  
  // Use V31 Match Score for detailed breakdown
  const { calculateSingleMatch, results: matchResults, loading: matchLoading } = useMatchScoreV31();
  const matchResult = matchResults[0] || null;
  
  // Comments (separate fetch as they're user-specific)
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  
  // Dialog states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);

  // Fetch comments
  useEffect(() => {
    if (id && user) {
      fetchComments();
    }
  }, [id, user]);

  // Fetch V31 match result when data is loaded
  useEffect(() => {
    if (candidateView?.candidateId && candidateView?.jobId) {
      calculateSingleMatch(candidateView.candidateId, candidateView.jobId, 'strict');
    }
  }, [candidateView?.candidateId, candidateView?.jobId]);

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

  // Loading state
  if (loading) {
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

  // Error or not found state
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

  // Destructure for cleaner code
  const {
    displayName,
    identityUnlocked,
    isAnonymized,
    currentRole,
    experience,
    seniority,
    salaryRange,
    availability,
    region,
    workModel,
    topSkills,
    matchScore,
    fitLabel,
    dealProbability,
    motivationStatus,
    status,
    stage,
    jobTitle,
    jobId,
    jobIndustry,
    executiveSummary,
    keySellingPoints,
    riskFactors,
    positiveFactors,
    recruiterNotes,
    email,
    phone,
    cvUrl,
    linkedinUrl,
    hasRequiredData,
    missingFields,
    canBePresented,
    hasInterview,
    candidateId,
    submissionId
  } = candidateView;

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
                  {identityUnlocked ? (
                    displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
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
                    für <span className="font-medium text-foreground">{jobTitle}</span>
                  </p>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(stage || status)}
                  
                  {/* Fit Assessment Badge */}
                  <Badge className={cn(fitLabel.bgClass, fitLabel.textClass, "border-0")}>
                    {fitLabel.label}
                  </Badge>
                </div>
              </div>
              
              {/* Right: Actions */}
              {status !== 'hired' && status !== 'rejected' && (
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

        {/* Readiness Warning Banner */}
        {!hasRequiredData && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription>
              <p className="font-medium text-amber-800 dark:text-amber-200">Profildaten unvollständig</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Fehlende Pflichtfelder: {missingFields.join(', ')}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Der Recruiter wurde benachrichtigt, diese Daten zu ergänzen.
              </p>
            </AlertDescription>
          </Alert>
        )}

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
                  {/* Role */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Aktuelle Rolle</p>
                    <p className="font-medium text-sm">{currentRole}</p>
                  </div>
                  
                  {/* Seniority */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Seniorität</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      {seniority}
                    </p>
                  </div>
                  
                  {/* Region */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Region</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      {region}
                    </p>
                  </div>
                  
                  {/* Work Model */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Arbeitsmodell</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {workModel}
                    </p>
                  </div>
                  
                  {/* Availability */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Verfügbarkeit</p>
                    <p className="font-medium flex items-center gap-1.5 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {availability}
                    </p>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Salary & Experience Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Experience */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Erfahrung</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      {experience}
                    </p>
                  </div>
                  
                  {/* Salary Range */}
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Gehaltsband</p>
                    <p className="font-medium flex items-center gap-1.5">
                      <Euro className="h-4 w-4 text-muted-foreground" />
                      {salaryRange}
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
                {/* Top Skills */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Kernkompetenzen (Top 5)</p>
                  <div className="flex flex-wrap gap-2">
                    {topSkills.slice(0, 5).map((skill: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {skill}
                      </Badge>
                    ))}
                    {topSkills.length > 5 && (
                      <Badge variant="outline" className="text-sm">
                        +{topSkills.length - 5} weitere
                      </Badge>
                    )}
                    {topSkills.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        {explainMissingField('skills', hasInterview)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ==================== 4. MATCH-EMPFEHLUNG (V3.1 = Single Source of Truth) ==================== */}
            <Card className="border-2 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Match-Empfehlung
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Loading state */}
                {matchLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Match wird berechnet...
                  </div>
                )}
                
                {/* V3.1 Match Result - THE SINGLE SOURCE OF TRUTH */}
                {matchResult && !matchLoading && (
                  <>
                    {/* Score + Policy Badge */}
                    <div className="flex items-center gap-4">
                      {/* Circular Score Display */}
                      <div className="relative w-20 h-20">
                        <svg className="w-20 h-20 -rotate-90">
                          <circle cx="40" cy="40" r="36" 
                            className="stroke-muted fill-none" 
                            strokeWidth="6" 
                          />
                          <circle cx="40" cy="40" r="36" 
                            className={cn(
                              "fill-none transition-all",
                              matchResult.policy === 'hot' && "stroke-emerald-500",
                              matchResult.policy === 'standard' && "stroke-primary",
                              matchResult.policy === 'maybe' && "stroke-amber-500",
                              matchResult.policy === 'hidden' && "stroke-destructive"
                            )}
                            strokeWidth="6"
                            strokeDasharray={`${matchResult.overall * 2.26} 226`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold">{matchResult.overall}%</span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Badge className={cn(
                          "text-sm px-3 py-1",
                          matchResult.policy === 'hot' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0",
                          matchResult.policy === 'standard' && "bg-primary/10 text-primary border-0",
                          matchResult.policy === 'maybe' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0",
                          matchResult.policy === 'hidden' && "bg-destructive/10 text-destructive border-0"
                        )}>
                          {matchResult.policy === 'hot' ? '🔥 Hot Match' : 
                           matchResult.policy === 'standard' ? '✓ Standard' : 
                           matchResult.policy === 'maybe' ? '? Prüfen' : '✗ Nicht geeignet'}
                        </Badge>
                        
                        {/* Must-Have Coverage */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Must-Haves:</span>
                          <div className="flex gap-1">
                            {[...Array(5)].map((_, i) => (
                              <div key={i} className={cn(
                                "w-2 h-2 rounded-full",
                                i < Math.round((matchResult.fit?.details?.skills?.matched?.length || 0) / 
                                  Math.max(1, (matchResult.fit?.details?.skills?.matched?.length || 0) + 
                                  (matchResult.fit?.details?.skills?.mustHaveMissing?.length || 0)) * 5) 
                                  ? "bg-primary" 
                                  : "bg-muted"
                              )} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* WARUM NICHT? - Prominent bei Ausschluss */}
                    {(matchResult.killed || matchResult.excluded) && (
                      <Alert className="border-destructive/50 bg-destructive/5">
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                        <AlertDescription>
                          <p className="font-medium text-destructive">Warum nicht geeignet:</p>
                          <p className="text-sm mt-1">
                            {matchResult.explainability?.whyNot || 
                             (matchResult.fit?.details?.skills?.mustHaveMissing?.length > 0 
                               ? `Fehlende Must-Have Skills: ${matchResult.fit.details.skills.mustHaveMissing.join(', ')}` 
                               : 'Kritische Anforderungen nicht erfüllt')}
                          </p>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {/* Qualitative AI Summary (without numbers) */}
                    {executiveSummary && !matchResult.killed && !matchResult.excluded && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground leading-relaxed">{executiveSummary}</p>
                      </div>
                    )}
                    
                    {/* V31 Match Score Breakdown */}
                    <div className="pt-4 border-t">
                      <MatchScoreBreakdown 
                        matchScore={matchResult.overall}
                        v31Result={matchResult}
                        compact={true}
                      />
                    </div>
                  </>
                )}
                
                {/* Fallback when V3.1 not available */}
                {!matchResult && !matchLoading && (
                  <div className="space-y-4">
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Match-Analyse für diese Position wird berechnet...
                      </AlertDescription>
                    </Alert>
                    {executiveSummary && (
                      <div className="p-3 bg-muted/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">{executiveSummary}</p>
                      </div>
                    )}
                  </div>
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
                    {riskFactors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {riskFactors.filter((r: any) => r.severity === 'high').length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {riskFactors.filter((r: any) => r.severity === 'high').length} hoch
                          </Badge>
                        )}
                        {riskFactors.filter((r: any) => r.severity === 'medium').length > 0 && (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0 text-xs">
                            {riskFactors.filter((r: any) => r.severity === 'medium').length} mittel
                          </Badge>
                        )}
                        {riskFactors.filter((r: any) => r.severity === 'low').length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {riskFactors.filter((r: any) => r.severity === 'low').length} gering
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
                    {positiveFactors.length > 0 ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-xs">
                        {positiveFactors.length} identifiziert
                      </Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {explainMissingField('strengths', hasInterview)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Deal Probability */}
                {dealProbability > 0 && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Deal-Wahrscheinlichkeit</span>
                      <Badge variant="outline" className="text-sm font-semibold">
                        {dealProbability}%
                      </Badge>
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
            {identityUnlocked && (cvUrl || linkedinUrl) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Dokumente & Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {cvUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={cvUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4 mr-2" />
                        Lebenslauf öffnen
                        <ExternalLink className="h-3 w-3 ml-2" />
                      </a>
                    </Button>
                  )}
                  {linkedinUrl && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="h-4 w-4 mr-2" />
                        LinkedIn
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
              candidateId={candidateId}
              submissionId={id}
            />
            
            {/* Recruiter Notes */}
            {recruiterNotes && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Recruiter-Empfehlung
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{recruiterNotes}</p>
                </CardContent>
              </Card>
            )}

            {/* Contact info card - Only When Unlocked */}
            {identityUnlocked && (email || phone) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Kontaktdaten
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a href={`mailto:${email}`} className="hover:underline">
                        {email}
                      </a>
                    </div>
                  )}
                  {phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a href={`tel:${phone}`} className="hover:underline">
                        {phone}
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ==================== DIALOGE ==================== */}
      
      {/* Professional Rejection Dialog */}
      <RejectionDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        submission={{
          id: submissionId,
          candidate: {
            id: candidateId,
            full_name: displayName,
            email: email || ''
          },
          job: {
            id: jobId,
            title: jobTitle,
            company_name: ''
          }
        }}
        onSuccess={() => {
          setShowRejectDialog(false);
          refetch();
        }}
      />

      {/* Professional Interview Dialog with Triple-Blind */}
      <InterviewRequestWithOptInDialog
        open={showInterviewDialog}
        onOpenChange={setShowInterviewDialog}
        submissionId={submissionId}
        candidateAnonymousId={displayName}
        jobTitle={jobTitle}
        jobIndustry={jobIndustry}
        onSuccess={() => {
          setShowInterviewDialog(false);
          refetch();
        }}
      />
    </DashboardLayout>
  );
}

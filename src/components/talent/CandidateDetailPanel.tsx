import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  X, 
  ChevronRight, 
  Mail, 
  Phone, 
  ExternalLink,
  Clock,
  Briefcase,
  MessageSquare,
  Target,
  Brain,
  Euro,
  Car,
  Users,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Calendar,
  MapPin,
  TrendingUp
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { useMatchScoreV2, MatchResultV2 } from '@/hooks/useMatchScoreV2';

interface CandidateDetailPanelProps {
  candidate: {
    id: string;
    submissionId: string;
    name: string;
    currentRole: string;
    jobId: string;
    jobTitle: string;
    stage: string;
    status: string;
    matchScore: number | null;
    submittedAt: string;
    email?: string;
    phone?: string;
    // Extended fields
    company?: string;
    skills?: string[];
    experienceYears?: number;
    cvAiBullets?: string[];
    cvAiSummary?: string;
    noticePeriod?: string;
    availabilityDate?: string;
    exposeHighlights?: string[];
    currentSalary?: number;
    expectedSalary?: number;
    city?: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  isProcessing?: boolean;
}

const factorConfig = {
  skills: { label: 'Skills', icon: Brain, color: 'text-blue-500' },
  experience: { label: 'Erfahrung', icon: Target, color: 'text-purple-500' },
  salary: { label: 'Gehalt', icon: Euro, color: 'text-green-500' },
  commute: { label: 'Pendel', icon: Car, color: 'text-orange-500' },
  culture: { label: 'Kultur', icon: Users, color: 'text-pink-500' },
};

function getScoreColor(score: number) {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
  if (score >= 40) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getProgressColor(score: number) {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-amber-500';
  if (score >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

function getDealLabel(probability: number) {
  if (probability >= 75) return { text: 'Hohe Chance', variant: 'default' as const };
  if (probability >= 50) return { text: 'Gute Chance', variant: 'secondary' as const };
  if (probability >= 30) return { text: 'Unsicher', variant: 'outline' as const };
  return { text: 'Niedrig', variant: 'destructive' as const };
}

export function CandidateDetailPanel({
  candidate,
  open,
  onClose,
  onMove,
  onReject,
  isProcessing
}: CandidateDetailPanelProps) {
  const { calculateMatch, loading: matchLoading } = useMatchScoreV2();
  const [matchResult, setMatchResult] = useState<MatchResultV2 | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Load match score when panel opens
  useEffect(() => {
    if (open && candidate?.id && candidate?.jobId) {
      setMatchResult(null);
      setMatchError(null);
      calculateMatch(candidate.id, candidate.jobId).then(result => {
        if (result) {
          setMatchResult(result);
        } else {
          setMatchError('Match-Analyse konnte nicht geladen werden');
        }
      });
    }
  }, [open, candidate?.id, candidate?.jobId]);

  if (!candidate) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageLabel = (stage: string) => {
    return PIPELINE_STAGES.find(s => s.key === stage)?.label || stage;
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const getPreviousStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex > 0 ? stages[currentIndex - 1] : null;
  };

  const nextStage = getNextStage(candidate.stage);
  const previousStage = getPreviousStage(candidate.stage);
  const dealLabel = matchResult ? getDealLabel(matchResult.dealProbability) : null;

  const formatSalary = (salary?: number) => {
    if (!salary) return null;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(salary);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] p-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                  {getInitials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h2 className="font-semibold text-lg truncate">{candidate.name}</h2>
                <p className="text-sm text-muted-foreground truncate">
                  {candidate.currentRole}
                  {candidate.experienceYears && ` • ${candidate.experienceYears} Jahre`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick badges */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              {getStageLabel(candidate.stage)}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de, addSuffix: true })}
            </span>
          </div>

          {/* Contact Buttons */}
          <div className="flex items-center gap-2 mt-3">
            {candidate.email && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`mailto:${candidate.email}`}>
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  E-Mail
                </a>
              </Button>
            )}
            {candidate.phone && (
              <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
                <a href={`tel:${candidate.phone}`}>
                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                  Anrufen
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs ml-auto" asChild>
              <Link to={`/dashboard/candidates/${candidate.submissionId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Vollprofil
              </Link>
            </Button>
          </div>
        </div>

        {/* Match Score Summary */}
        <div className="p-4 border-b bg-muted/30">
          {matchLoading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </div>
          ) : matchResult ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 font-bold",
                  getScoreColor(matchResult.overallScore)
                )}>
                  <span className="text-xl">{matchResult.overallScore}</span>
                  <span className="text-[10px] font-normal">Match</span>
                </div>
                
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Deal-Wahrscheinlichkeit</span>
                    <Badge variant={dealLabel?.variant}>{dealLabel?.text}</Badge>
                  </div>
                  <Progress value={matchResult.dealProbability} className="h-2" />
                  <span className="text-xs text-muted-foreground">
                    {matchResult.dealProbability}% Chance auf Vermittlung
                  </span>
                </div>
              </div>

              {/* Blockers Warning */}
              {matchResult.blockers.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-md border border-destructive/20">
                  <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-xs text-destructive font-medium">
                    {matchResult.blockers.length} kritische{matchResult.blockers.length > 1 ? ' Blocker' : 'r Blocker'}
                  </span>
                </div>
              )}

              {/* Warnings */}
              {matchResult.warnings.length > 0 && matchResult.blockers.length === 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    {matchResult.warnings.length} Hinweis{matchResult.warnings.length > 1 ? 'e' : ''} beachten
                  </span>
                </div>
              )}
            </div>
          ) : matchError ? (
            <div className="text-sm text-muted-foreground text-center py-2">
              {matchError}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {candidate.matchScore && (
                <Badge variant="outline" className="gap-1">
                  {candidate.matchScore}% Match
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Detaillierte Analyse wird geladen...
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {candidate.stage !== 'hired' && (
          <div className="p-4 border-b">
            <div className="flex gap-2">
              {nextStage && (
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => onMove(candidate.submissionId, nextStage)}
                  disabled={isProcessing}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  {getStageLabel(nextStage)}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={() => onReject(candidate.submissionId)}
                disabled={isProcessing}
              >
                <X className="h-4 w-4 mr-1" />
                Ablehnen
              </Button>
            </div>
            {previousStage && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground"
                onClick={() => onMove(candidate.submissionId, previousStage)}
                disabled={isProcessing}
              >
                ← Zurück zu {getStageLabel(previousStage)}
              </Button>
            )}
          </div>
        )}

        {/* Content Tabs */}
        <Tabs defaultValue="match" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 grid w-auto grid-cols-4">
            <TabsTrigger value="match" className="text-xs">Passung</TabsTrigger>
            <TabsTrigger value="profile" className="text-xs">Profil</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notizen</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* PASSUNG TAB */}
            <TabsContent value="match" className="p-4 mt-0 space-y-4">
              {matchLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))}
                </div>
              ) : matchResult ? (
                <>
                  {/* Factor Breakdown */}
                  <div className="space-y-3">
                    <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Faktor-Breakdown
                    </div>
                    
                    {Object.entries(matchResult.factors).map(([key, factor]) => {
                      const config = factorConfig[key as keyof typeof factorConfig];
                      if (!config) return null;
                      
                      const Icon = config.icon;
                      
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", config.color)} />
                              <span className="text-sm">{config.label}</span>
                              {factor.warning && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                              {factor.isBlocker && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Blocker</Badge>
                              )}
                            </div>
                            <span className={cn("text-sm font-medium", 
                              factor.score >= 70 ? 'text-green-600' : 
                              factor.score >= 50 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {factor.score}%
                            </span>
                          </div>
                          
                          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn("absolute h-full rounded-full transition-all", getProgressColor(factor.score))}
                              style={{ width: `${factor.score}%` }}
                            />
                          </div>
                          
                          {factor.aiReasoning && (
                            <p className="text-xs text-muted-foreground pl-6">
                              {factor.aiReasoning}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Blockers */}
                  {matchResult.blockers.length > 0 && (
                    <div className="space-y-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                      <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                        <XCircle className="h-4 w-4" />
                        Kritische Blocker
                      </div>
                      {matchResult.blockers.map((blocker, i) => (
                        <div key={i} className="text-xs text-destructive/80 pl-6">
                          <strong>{factorConfig[blocker.factor as keyof typeof factorConfig]?.label || blocker.factor}:</strong> {blocker.reason}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {matchResult.warnings.length > 0 && (
                    <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        Hinweise
                      </div>
                      {matchResult.warnings.map((warning, i) => (
                        <div key={i} className="text-xs text-amber-700 dark:text-amber-400 pl-6">
                          • {warning.message}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Recommendations */}
                  {matchResult.recommendations.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Empfehlungen
                      </div>
                      <ul className="space-y-1 pl-6">
                        {matchResult.recommendations.map((rec, i) => (
                          <li key={i} className="text-xs text-muted-foreground list-disc">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Keine Match-Analyse verfügbar
                </div>
              )}
            </TabsContent>

            {/* PROFIL TAB */}
            <TabsContent value="profile" className="p-4 mt-0 space-y-4">
              {/* Job Info */}
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Bewirbt sich für
                </p>
                <p className="font-medium text-sm">{candidate.jobTitle}</p>
              </div>

              {/* AI Short Profile */}
              {(candidate.cvAiBullets?.length || candidate.cvAiSummary) && (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Brain className="h-3.5 w-3.5" />
                    Kurzprofil (KI-generiert)
                  </p>
                  {candidate.cvAiBullets?.length ? (
                    <ul className="space-y-1.5">
                      {candidate.cvAiBullets.slice(0, 5).map((bullet, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  ) : candidate.cvAiSummary ? (
                    <p className="text-sm text-muted-foreground">{candidate.cvAiSummary}</p>
                  ) : null}
                </div>
              )}

              {/* Skills */}
              {candidate.skills?.length ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" />
                    Top-Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidate.skills.slice(0, 8).map((skill, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {candidate.skills.length > 8 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{candidate.skills.length - 8} weitere
                      </Badge>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Professional Context */}
              <div className="rounded-lg border p-3 space-y-3">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" />
                  Beruflicher Kontext
                </p>
                <div className="grid gap-2 text-sm">
                  {candidate.company && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Aktuell bei</span>
                      <span className="font-medium">{candidate.company}</span>
                    </div>
                  )}
                  {candidate.currentSalary && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Aktuelles Gehalt</span>
                      <span>{formatSalary(candidate.currentSalary)}</span>
                    </div>
                  )}
                  {candidate.expectedSalary && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Erwartung</span>
                      <span className="font-medium">{formatSalary(candidate.expectedSalary)}</span>
                    </div>
                  )}
                  {candidate.city && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Standort
                      </span>
                      <span>{candidate.city}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Availability */}
              <div className="rounded-lg border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Verfügbarkeit
                </p>
                <div className="grid gap-2 text-sm">
                  {candidate.noticePeriod && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Kündigungsfrist</span>
                      <span>{candidate.noticePeriod}</span>
                    </div>
                  )}
                  {candidate.availabilityDate && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Verfügbar ab</span>
                      <span>{format(new Date(candidate.availabilityDate), 'dd.MM.yyyy', { locale: de })}</span>
                    </div>
                  )}
                  {!candidate.noticePeriod && !candidate.availabilityDate && (
                    <span className="text-muted-foreground text-xs">Keine Angaben zur Verfügbarkeit</span>
                  )}
                </div>
              </div>

              {/* Interview Highlights */}
              {candidate.exposeHighlights?.length ? (
                <div className="rounded-lg border p-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Interview-Highlights
                  </p>
                  <ul className="space-y-1.5">
                    {candidate.exposeHighlights.slice(0, 3).map((highlight, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-green-500 mt-1">✓</span>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </TabsContent>

            {/* TIMELINE TAB */}
            <TabsContent value="timeline" className="p-4 mt-0">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="w-0.5 h-full bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium">Kandidat eingereicht</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(candidate.submittedAt), 'dd. MMM yyyy, HH:mm', { locale: de })}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center py-4">
                  Weitere Aktivitäten laden...
                </p>
              </div>
            </TabsContent>

            {/* NOTES TAB */}
            <TabsContent value="notes" className="p-4 mt-0">
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Keine Notizen vorhanden</p>
                <Button variant="outline" size="sm" className="mt-3">
                  Notiz hinzufügen
                </Button>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

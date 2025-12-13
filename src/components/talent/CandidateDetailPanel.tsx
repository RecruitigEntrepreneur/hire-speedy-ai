import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  TrendingUp,
  Check
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
  if (probability >= 75) return { text: 'Hoch', variant: 'default' as const, color: 'bg-green-500' };
  if (probability >= 50) return { text: 'Gut', variant: 'secondary' as const, color: 'bg-amber-500' };
  if (probability >= 30) return { text: 'Unsicher', variant: 'outline' as const, color: 'bg-orange-500' };
  return { text: 'Niedrig', variant: 'destructive' as const, color: 'bg-red-500' };
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
  const displayScore = matchResult?.overallScore ?? candidate.matchScore;

  const formatSalary = (salary?: number) => {
    if (!salary) return null;
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(salary);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-4xl w-[90vw] h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* COMPACT HEADER - Name, Match Score, Actions inline */}
        <div className="shrink-0 border-b">
          {/* Top row: Avatar, Name, Score, Actions */}
          <div className="p-4 flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(candidate.name)}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg leading-tight truncate">{candidate.name}</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {candidate.currentRole}
                    {candidate.company && ` @ ${candidate.company}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {candidate.experienceYears && (
                      <span>{candidate.experienceYears} Jahre</span>
                    )}
                    {candidate.city && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {candidate.city}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(candidate.submittedAt), { locale: de, addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Match Score Ring + Deal Badge */}
                <div className="flex items-center gap-2 shrink-0">
                  {matchLoading ? (
                    <Skeleton className="w-14 h-14 rounded-full" />
                  ) : displayScore ? (
                    <div className={cn(
                      "flex flex-col items-center justify-center w-14 h-14 rounded-full border-[3px] font-bold",
                      getScoreColor(displayScore)
                    )}>
                      <span className="text-lg leading-none">{displayScore}</span>
                      <span className="text-[9px] font-normal opacity-80">Match</span>
                    </div>
                  ) : null}
                  
                  {dealLabel && (
                    <div className="flex flex-col items-center gap-0.5">
                      <div className={cn("w-3 h-3 rounded-full", dealLabel.color)} />
                      <span className="text-[10px] text-muted-foreground">{dealLabel.text}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning/Blocker Badges inline */}
              {matchResult && (matchResult.blockers.length > 0 || matchResult.warnings.length > 0) && (
                <div className="flex items-center gap-2 mt-2">
                  {matchResult.blockers.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] gap-1 px-1.5 py-0">
                      <XCircle className="h-3 w-3" />
                      {matchResult.blockers.length} Blocker
                    </Badge>
                  )}
                  {matchResult.warnings.length > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0 border-amber-300 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      {matchResult.warnings.length} Hinweis{matchResult.warnings.length > 1 ? 'e' : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stage Pipeline - compact */}
          <div className="px-4 pb-2 flex items-center gap-1 overflow-x-auto">
            {PIPELINE_STAGES.map((stage, index) => {
              const currentStageIndex = PIPELINE_STAGES.findIndex(s => s.key === candidate.stage);
              const isActive = candidate.stage === stage.key;
              const isPast = currentStageIndex > index;
              
              return (
                <div key={stage.key} className="flex items-center shrink-0">
                  <div className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap",
                    isActive && "bg-primary text-primary-foreground font-medium",
                    isPast && "bg-muted text-muted-foreground",
                    !isActive && !isPast && "text-muted-foreground/50"
                  )}>
                    {isPast ? (
                      <Check className="h-3 w-3" />
                    ) : isActive ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />
                    ) : null}
                    {stage.label}
                  </div>
                  {index < PIPELINE_STAGES.length - 1 && (
                    <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground/30" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Actions Row - compact */}
          <div className="px-4 pb-3 flex items-center gap-2">
            {candidate.stage !== 'hired' && nextStage && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => onMove(candidate.submissionId, nextStage)}
                disabled={isProcessing}
              >
                <ChevronRight className="h-3.5 w-3.5 mr-1" />
                → {getStageLabel(nextStage)}
              </Button>
            )}
            {candidate.stage !== 'hired' && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onReject(candidate.submissionId)}
                disabled={isProcessing}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Ablehnen
              </Button>
            )}
            {previousStage && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => onMove(candidate.submissionId, previousStage)}
                disabled={isProcessing}
              >
                ← Zurück
              </Button>
            )}
            
            <div className="flex-1" />
            
            {/* Quick contact */}
            {candidate.email && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <a href={`mailto:${candidate.email}`} title="E-Mail senden">
                  <Mail className="h-4 w-4" />
                </a>
              </Button>
            )}
            {candidate.phone && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                <a href={`tel:${candidate.phone}`} title="Anrufen">
                  <Phone className="h-4 w-4" />
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link to={`/dashboard/candidates/${candidate.submissionId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Vollprofil
              </Link>
            </Button>
          </div>
        </div>

        {/* Content Tabs - flex-1 with proper height calculation */}
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-2 mb-0 grid w-auto grid-cols-3 shrink-0">
            <TabsTrigger value="overview" className="text-xs">Übersicht</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notizen</TabsTrigger>
          </TabsList>

          {/* ÜBERSICHT TAB - Kombiniert Passung + Profil */}
          <TabsContent value="overview" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {/* LINKE SPALTE (3/5) - Profil-Infos */}
                  <div className="md:col-span-3 space-y-4">
                    {/* Job Info */}
                    <div className="rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
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
                          <ul className="space-y-1">
                            {candidate.cvAiBullets.slice(0, 4).map((bullet, i) => (
                              <li key={i} className="text-sm flex items-start gap-2">
                                <span className="text-primary mt-0.5">•</span>
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
                          {candidate.skills.slice(0, 10).map((skill, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {candidate.skills.length > 10 && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              +{candidate.skills.length - 10}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : null}

                    {/* Professional Context + Availability combined */}
                    <div className="rounded-lg border p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        Kontext & Verfügbarkeit
                      </p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                        {candidate.company && (
                          <>
                            <span className="text-muted-foreground">Aktuell bei</span>
                            <span className="font-medium">{candidate.company}</span>
                          </>
                        )}
                        {candidate.currentSalary && (
                          <>
                            <span className="text-muted-foreground">Gehalt aktuell</span>
                            <span>{formatSalary(candidate.currentSalary)}</span>
                          </>
                        )}
                        {candidate.expectedSalary && (
                          <>
                            <span className="text-muted-foreground">Erwartung</span>
                            <span className="font-medium">{formatSalary(candidate.expectedSalary)}</span>
                          </>
                        )}
                        {candidate.noticePeriod && (
                          <>
                            <span className="text-muted-foreground">Kündigungsfrist</span>
                            <span>{candidate.noticePeriod}</span>
                          </>
                        )}
                        {candidate.availabilityDate && (
                          <>
                            <span className="text-muted-foreground">Verfügbar ab</span>
                            <span>{format(new Date(candidate.availabilityDate), 'dd.MM.yyyy', { locale: de })}</span>
                          </>
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
                        <ul className="space-y-1">
                          {candidate.exposeHighlights.slice(0, 3).map((highlight, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-green-500 mt-0.5">✓</span>
                              {highlight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>

                  {/* RECHTE SPALTE (2/5) - Match-Analyse */}
                  <div className="md:col-span-2 space-y-4">
                    {matchLoading ? (
                      <div className="space-y-3 p-3 rounded-lg border">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex items-center gap-2">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="h-3 w-16" />
                            <Skeleton className="h-2 w-20" />
                            <Skeleton className="h-3 w-8" />
                          </div>
                        ))}
                      </div>
                    ) : matchResult ? (
                      <>
                        {/* Compact Factor Breakdown */}
                        <div className="rounded-lg border p-3 space-y-2.5">
                          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Faktor-Breakdown
                          </div>
                          
                          {Object.entries(matchResult.factors).map(([key, factor]) => {
                            const config = factorConfig[key as keyof typeof factorConfig];
                            if (!config) return null;
                            
                            const Icon = config.icon;
                            
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <Icon className={cn("h-3.5 w-3.5 shrink-0", config.color)} />
                                <span className="text-xs w-16 shrink-0">{config.label}</span>
                                {factor.isBlocker && (
                                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                                )}
                                {factor.warning && !factor.isBlocker && (
                                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                )}
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-24">
                                  <div 
                                    className={cn("h-full rounded-full", getProgressColor(factor.score))}
                                    style={{ width: `${factor.score}%` }}
                                  />
                                </div>
                                <span className={cn(
                                  "text-xs font-medium w-8 text-right",
                                  factor.score >= 70 ? 'text-green-600' : 
                                  factor.score >= 50 ? 'text-amber-600' : 'text-red-600'
                                )}>
                                  {factor.score}%
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Blockers */}
                        {matchResult.blockers.length > 0 && (
                          <div className="space-y-1.5 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                            <div className="flex items-center gap-1.5 text-destructive font-medium text-xs">
                              <XCircle className="h-3.5 w-3.5" />
                              Blocker
                            </div>
                            {matchResult.blockers.map((blocker, i) => (
                              <p key={i} className="text-[11px] text-destructive/80 pl-5">
                                • {blocker.reason}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Warnings */}
                        {matchResult.warnings.length > 0 && (
                          <div className="space-y-1.5 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-xs">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Hinweise
                            </div>
                            {matchResult.warnings.map((warning, i) => (
                              <p key={i} className="text-[11px] text-amber-700 dark:text-amber-400 pl-5">
                                • {warning.message}
                              </p>
                            ))}
                          </div>
                        )}

                        {/* Recommendations */}
                        {matchResult.recommendations.length > 0 && (
                          <div className="rounded-lg border p-3 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Empfehlungen
                            </div>
                            {matchResult.recommendations.slice(0, 3).map((rec, i) => (
                              <p key={i} className="text-[11px] text-muted-foreground pl-5">
                                • {rec}
                              </p>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground rounded-lg border">
                        <Target className="h-6 w-6 mx-auto mb-1.5 opacity-50" />
                        Keine Match-Analyse
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* TIMELINE TAB */}
          <TabsContent value="timeline" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
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
            </ScrollArea>
          </TabsContent>

          {/* NOTES TAB */}
          <TabsContent value="notes" className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4">
                <div className="text-center py-8">
                  <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Keine Notizen vorhanden</p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Notiz hinzufügen
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

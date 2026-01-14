import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Brain, Target, Euro, Car, Users, AlertTriangle, 
  CheckCircle2, XCircle, TrendingUp, MessageSquare,
  ChevronDown, ChevronUp, MapPin, Clock, Briefcase, GraduationCap
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface FactorScore {
  score: number;
  weight: number;
  isBlocker: boolean;
  details: Record<string, unknown>;
  warning?: string;
  requiresConfirmation?: boolean;
  aiReasoning?: string;
}

interface BlockerInfo {
  factor: string;
  reason: string;
  severity: 'critical' | 'high';
}

interface WarningInfo {
  factor: string;
  message: string;
  severity: 'medium' | 'low';
  actionRequired?: boolean;
}

interface MatchResultV2 {
  overallScore: number;
  dealProbability: number;
  factors: {
    skills: FactorScore;
    experience: FactorScore;
    salary: FactorScore;
    commute: FactorScore;
    culture: FactorScore;
  };
  blockers: BlockerInfo[];
  warnings: WarningInfo[];
  recommendations: string[];
}

interface MatchScoreCardV2Props {
  result: MatchResultV2;
  compact?: boolean;
  onAskCandidate?: (factor: string) => void;
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

function formatSalary(value: number | undefined): string {
  if (!value) return 'k.A.';
  return new Intl.NumberFormat('de-DE', { 
    style: 'currency', 
    currency: 'EUR',
    maximumFractionDigits: 0 
  }).format(value);
}

// Detail renderers for each factor type
function SkillsDetails({ details }: { details: Record<string, unknown> }) {
  const matchedSkills = (details.matchedSkills as string[]) || [];
  const missingMustHaves = (details.missingMustHaves as string[]) || [];
  const transferableSkills = (details.transferableSkills as Array<{ from: string; to: string; transferability: number }>) || [];
  const niceToHaveMatched = (details.niceToHaveMatched as string[]) || [];
  const coverage = details.coverage as number | undefined;

  return (
    <div className="pl-6 pt-3 space-y-3 border-t border-dashed mt-2">
      {coverage !== undefined && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Must-Have Coverage:</span>
          <Badge variant={coverage >= 70 ? 'default' : 'destructive'} className="text-xs">
            {Math.round(coverage * 100)}%
          </Badge>
        </div>
      )}
      
      {matchedSkills.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-green-600 mb-1">
            <CheckCircle2 className="h-3 w-3" />
            Übereinstimmend ({matchedSkills.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {matchedSkills.map((skill, i) => (
              <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {transferableSkills.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mb-1">
            <TrendingUp className="h-3 w-3" />
            Transferierbar ({transferableSkills.length})
          </div>
          <div className="space-y-1">
            {transferableSkills.map((t, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                <Badge variant="outline" className="text-xs">{t.from}</Badge>
                <span>→</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{t.to}</Badge>
                <span className="text-blue-600 font-medium">({t.transferability}%)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {niceToHaveMatched.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
            Nice-to-Have ({niceToHaveMatched.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {niceToHaveMatched.map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {missingMustHaves.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-xs font-medium text-red-600 mb-1">
            <XCircle className="h-3 w-3" />
            Fehlende Must-Haves ({missingMustHaves.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {missingMustHaves.map((skill, i) => (
              <Badge key={i} variant="destructive" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExperienceDetails({ details }: { details: Record<string, unknown> }) {
  const candidateYears = details.candidateYears as number | undefined;
  const requiredMin = details.requiredMin as number | undefined;
  const requiredMax = details.requiredMax as number | undefined;
  const candidateSeniority = details.candidateSeniority as string | undefined;
  const requiredSeniority = details.requiredSeniority as string | undefined;
  const industryMatch = details.industryMatch as boolean | undefined;
  const relevantIndustries = (details.relevantIndustries as string[]) || [];

  const seniorityLabels: Record<string, string> = {
    junior: 'Junior',
    mid: 'Mid-Level',
    senior: 'Senior',
    lead: 'Lead',
    head: 'Head/Director'
  };

  return (
    <div className="pl-6 pt-3 space-y-3 border-t border-dashed mt-2">
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-1">
            <Briefcase className="h-3 w-3" />
            Kandidat
          </div>
          <div className="font-medium text-base">{candidateYears ?? 'k.A.'} Jahre</div>
          {candidateSeniority && (
            <Badge variant="outline" className="text-xs">
              {seniorityLabels[candidateSeniority] || candidateSeniority}
            </Badge>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-muted-foreground flex items-center gap-1">
            <Target className="h-3 w-3" />
            Gefordert
          </div>
          <div className="font-medium text-base">
            {requiredMin !== undefined && requiredMax !== undefined 
              ? `${requiredMin}-${requiredMax} Jahre`
              : requiredMin !== undefined 
                ? `${requiredMin}+ Jahre`
                : 'k.A.'}
          </div>
          {requiredSeniority && (
            <Badge variant="secondary" className="text-xs">
              {seniorityLabels[requiredSeniority] || requiredSeniority}
            </Badge>
          )}
        </div>
      </div>
      
      {relevantIndustries.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <GraduationCap className="h-3 w-3" />
            Branchen-Erfahrung
            {industryMatch && <CheckCircle2 className="h-3 w-3 text-green-500" />}
          </div>
          <div className="flex flex-wrap gap-1">
            {relevantIndustries.map((ind, i) => (
              <Badge key={i} variant={industryMatch ? 'default' : 'outline'} className="text-xs">
                {ind}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryDetails({ details }: { details: Record<string, unknown> }) {
  const candidateExpected = details.candidateExpected as number | undefined;
  const candidateMin = details.candidateMin as number | undefined;
  const jobMin = details.jobMin as number | undefined;
  const jobMax = details.jobMax as number | undefined;
  const gapPercent = details.gapPercent as number | undefined;
  const inRange = details.inRange as boolean | undefined;

  // Calculate position for visual scale
  const getPosition = (value: number, min: number, max: number) => {
    const range = max - min;
    const buffer = range * 0.2;
    const scaleMin = Math.max(0, min - buffer);
    const scaleMax = max + buffer;
    return ((value - scaleMin) / (scaleMax - scaleMin)) * 100;
  };

  const showScale = jobMin !== undefined && jobMax !== undefined && candidateExpected !== undefined;

  return (
    <div className="pl-6 pt-3 space-y-3 border-t border-dashed mt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Kandidat erwartet</div>
          <div className="font-semibold text-lg text-primary">{formatSalary(candidateExpected)}</div>
          {candidateMin && candidateMin !== candidateExpected && (
            <div className="text-xs text-muted-foreground">
              Minimum: {formatSalary(candidateMin)}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Job-Budget</div>
          <div className="font-semibold text-lg">
            {formatSalary(jobMin)} - {formatSalary(jobMax)}
          </div>
        </div>
      </div>
      
      {showScale && (
        <div className="space-y-1">
          <div className="relative h-3 bg-muted rounded-full overflow-visible">
            {/* Job range indicator */}
            <div 
              className="absolute h-full bg-green-200 rounded-full"
              style={{ 
                left: `${getPosition(jobMin!, jobMin!, jobMax!)}%`,
                width: `${getPosition(jobMax!, jobMin!, jobMax!) - getPosition(jobMin!, jobMin!, jobMax!)}%`
              }}
            />
            {/* Candidate position */}
            <div 
              className={cn(
                "absolute w-3 h-5 rounded -top-1 border-2 border-white shadow-md",
                inRange ? 'bg-green-500' : gapPercent && gapPercent > 20 ? 'bg-red-500' : 'bg-amber-500'
              )}
              style={{ left: `calc(${Math.min(100, Math.max(0, getPosition(candidateExpected!, jobMin!, jobMax!)))}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatSalary(jobMin)}</span>
            <span>{formatSalary(jobMax)}</span>
          </div>
        </div>
      )}
      
      {gapPercent !== undefined && gapPercent > 0 && (
        <Badge variant={gapPercent > 20 ? 'destructive' : gapPercent > 10 ? 'secondary' : 'outline'} className="text-xs">
          +{gapPercent.toFixed(0)}% über Budget
        </Badge>
      )}
      
      {inRange && (
        <Badge variant="default" className="text-xs bg-green-500">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Im Budget
        </Badge>
      )}
    </div>
  );
}

function CommuteDetails({ details }: { details: Record<string, unknown> }) {
  const actualTravelTime = details.actualTravelTime as number | undefined;
  const maxCommutePreference = details.maxCommutePreference as number | undefined;
  const distanceKm = details.distanceKm as number | undefined;
  const commuteMode = details.commuteMode as string | undefined;
  const candidateCity = details.candidateCity as string | undefined;
  const jobCity = details.jobCity as string | undefined;
  const isRemote = details.isRemote as boolean | undefined;
  const hasOverride = details.hasOverride as boolean | undefined;
  const overrideResponse = details.overrideResponse as string | undefined;

  const modeLabels: Record<string, string> = {
    car: 'Auto',
    public_transport: 'ÖPNV',
    bicycle: 'Fahrrad',
    walking: 'Zu Fuß'
  };

  return (
    <div className="pl-6 pt-3 space-y-3 border-t border-dashed mt-2">
      {isRemote ? (
        <Badge variant="default" className="bg-green-500 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Full Remote - keine Pendelzeit
        </Badge>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Von
              </div>
              <div className="font-medium">{candidateCity || 'k.A.'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Nach
              </div>
              <div className="font-medium">{jobCity || 'k.A.'}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 bg-muted/50 rounded-lg text-center">
              <div className="text-muted-foreground flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Fahrzeit
              </div>
              <div className={cn(
                "font-semibold text-sm",
                actualTravelTime && maxCommutePreference && actualTravelTime > maxCommutePreference 
                  ? 'text-red-600' 
                  : 'text-green-600'
              )}>
                {actualTravelTime ? `${actualTravelTime} Min` : 'k.A.'}
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg text-center">
              <div className="text-muted-foreground">Max. gewünscht</div>
              <div className="font-semibold text-sm">
                {maxCommutePreference ? `${maxCommutePreference} Min` : 'k.A.'}
              </div>
            </div>
            <div className="p-2 bg-muted/50 rounded-lg text-center">
              <div className="text-muted-foreground">Distanz</div>
              <div className="font-semibold text-sm">
                {distanceKm ? `${distanceKm.toFixed(1)} km` : 'k.A.'}
              </div>
            </div>
          </div>

          {commuteMode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Verkehrsmittel:</span>
              <Badge variant="outline" className="text-xs">
                {modeLabels[commuteMode] || commuteMode}
              </Badge>
            </div>
          )}
          
          {hasOverride && (
            <Badge 
              variant={overrideResponse === 'accepted' ? 'default' : overrideResponse === 'rejected' ? 'destructive' : 'secondary'}
              className="text-xs"
            >
              {overrideResponse === 'accepted' ? '✓ Längere Pendelzeit akzeptiert' : 
               overrideResponse === 'rejected' ? '✗ Abgelehnt' : 
               '? Bedingt akzeptiert'}
            </Badge>
          )}
        </>
      )}
    </div>
  );
}

function CultureDetails({ details }: { details: Record<string, unknown> }) {
  const factors = (details.factors as string[]) || [];
  const remoteMatch = details.remoteMatch as string | undefined;
  const workModelCandidate = details.workModelCandidate as string | undefined;
  const workModelJob = details.workModelJob as string | undefined;
  const companySizeMatch = details.companySizeMatch as boolean | undefined;
  const industryFit = details.industryFit as boolean | undefined;

  const workModelLabels: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Vor Ort',
    flexible: 'Flexibel'
  };

  return (
    <div className="pl-6 pt-3 space-y-3 border-t border-dashed mt-2">
      <div className="grid grid-cols-2 gap-3 text-xs">
        {workModelCandidate && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Kandidat präferiert</div>
            <Badge variant="outline" className="text-xs">
              {workModelLabels[workModelCandidate] || workModelCandidate}
            </Badge>
          </div>
        )}
        {workModelJob && (
          <div className="space-y-1">
            <div className="text-muted-foreground">Job bietet</div>
            <Badge variant="secondary" className="text-xs">
              {workModelLabels[workModelJob] || workModelJob}
            </Badge>
          </div>
        )}
      </div>

      {factors.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Kulturelle Faktoren</div>
          <div className="space-y-1">
            {factors.map((factor, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {companySizeMatch !== undefined && (
          <Badge variant={companySizeMatch ? 'default' : 'outline'} className="text-xs">
            {companySizeMatch ? '✓' : '○'} Unternehmensgröße
          </Badge>
        )}
        {industryFit !== undefined && (
          <Badge variant={industryFit ? 'default' : 'outline'} className="text-xs">
            {industryFit ? '✓' : '○'} Branche
          </Badge>
        )}
      </div>
      
      {remoteMatch && (
        <div className="text-xs text-muted-foreground italic">
          {remoteMatch}
        </div>
      )}
    </div>
  );
}

function FactorDetails({ factorKey, details }: { factorKey: string; details: Record<string, unknown> }) {
  switch (factorKey) {
    case 'skills':
      return <SkillsDetails details={details} />;
    case 'experience':
      return <ExperienceDetails details={details} />;
    case 'salary':
      return <SalaryDetails details={details} />;
    case 'commute':
      return <CommuteDetails details={details} />;
    case 'culture':
      return <CultureDetails details={details} />;
    default:
      return null;
  }
}

export function MatchScoreCardV2({ 
  result, 
  compact = false,
  onAskCandidate 
}: MatchScoreCardV2Props) {
  const [expanded, setExpanded] = useState(!compact);
  const [expandedFactors, setExpandedFactors] = useState<Set<string>>(new Set());
  const dealLabel = getDealLabel(result.dealProbability);

  const toggleFactor = (key: string) => {
    setExpandedFactors(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (compact && !expanded) {
    return (
      <div 
        className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(true)}
      >
        <div className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold text-lg",
          getScoreColor(result.overallScore)
        )}>
          {result.overallScore}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">Match-Score</span>
            {result.blockers.length > 0 && (
              <Badge variant="destructive" className="text-xs">
                {result.blockers.length} Blocker
              </Badge>
            )}
            {result.warnings.length > 0 && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                {result.warnings.length} Hinweise
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            Deal-Wahrscheinlichkeit: {result.dealProbability}%
          </div>
        </div>
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            KI Match-Analyse
          </CardTitle>
          {compact && (
            <Button variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              <ChevronUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Overall Score & Deal Probability */}
        <div className="flex items-center gap-6">
          <div className={cn(
            "flex flex-col items-center justify-center w-20 h-20 rounded-full border-4 font-bold",
            getScoreColor(result.overallScore)
          )}>
            <span className="text-2xl">{result.overallScore}</span>
            <span className="text-xs font-normal">Score</span>
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Deal-Wahrscheinlichkeit</span>
              <Badge variant={dealLabel.variant}>{dealLabel.text}</Badge>
            </div>
            <Progress 
              value={result.dealProbability} 
              className="h-3"
            />
            <span className="text-xs text-muted-foreground">
              {result.dealProbability}% Chance auf erfolgreiche Vermittlung
            </span>
          </div>
        </div>

        {/* Blockers */}
        {result.blockers.length > 0 && (
          <div className="space-y-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-center gap-2 text-destructive font-medium">
              <XCircle className="h-4 w-4" />
              Kritische Blocker
            </div>
            {result.blockers.map((blocker, i) => (
              <div key={i} className="text-sm text-destructive/80 pl-6">
                <strong>{factorConfig[blocker.factor as keyof typeof factorConfig]?.label || blocker.factor}:</strong> {blocker.reason}
              </div>
            ))}
          </div>
        )}

        {/* Factor Breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Faktor-Breakdown</div>
          
          {Object.entries(result.factors).map(([key, factor]) => {
            const config = factorConfig[key as keyof typeof factorConfig];
            if (!config) return null;
            
            const Icon = config.icon;
            const isExpanded = expandedFactors.has(key);
            const hasDetails = factor.details && Object.keys(factor.details).length > 0;
            
            return (
              <div 
                key={key} 
                className={cn(
                  "rounded-lg border transition-all",
                  hasDetails ? "cursor-pointer hover:border-primary/50" : "",
                  isExpanded ? "bg-muted/30 border-primary/30" : "bg-background"
                )}
              >
                <div 
                  className="p-3 space-y-2"
                  onClick={() => hasDetails && toggleFactor(key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <span className="text-sm font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(factor.weight * 100)}%)
                      </span>
                      
                      {factor.warning && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">{factor.warning}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      
                      {factor.isBlocker && (
                        <Badge variant="destructive" className="text-xs">Blocker</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold", 
                        factor.score >= 70 ? 'text-green-600' : 
                        factor.score >= 50 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        {factor.score}%
                      </span>
                      
                      {factor.requiresConfirmation && onAskCandidate && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAskCandidate(key);
                          }}
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Fragen
                        </Button>
                      )}
                      
                      {hasDetails && (
                        isExpanded 
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  
                  <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("absolute h-full rounded-full transition-all", getProgressColor(factor.score))}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                  
                  {factor.aiReasoning && !isExpanded && (
                    <p className="text-xs text-muted-foreground italic pl-6">
                      {factor.aiReasoning}
                    </p>
                  )}
                </div>
                
                {/* Expandable Details */}
                {isExpanded && hasDetails && (
                  <div className="px-3 pb-3">
                    <FactorDetails factorKey={key} details={factor.details} />
                    {factor.aiReasoning && (
                      <p className="text-xs text-muted-foreground italic mt-3 pt-2 border-t">
                        💡 {factor.aiReasoning}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="space-y-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
              <AlertTriangle className="h-4 w-4" />
              Hinweise
            </div>
            {result.warnings.map((warning, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 pl-6">
                <span>•</span>
                <span>{warning.message}</span>
                {warning.actionRequired && onAskCandidate && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-5 px-2 text-xs ml-auto"
                    onClick={() => onAskCandidate(warning.factor)}
                  >
                    Aktion
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Empfehlungen
            </div>
            <ul className="space-y-1 pl-6">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted-foreground list-disc">
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

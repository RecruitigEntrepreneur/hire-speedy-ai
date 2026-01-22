import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, Target, Euro, Car, Clock, AlertTriangle, 
  CheckCircle2, XCircle, TrendingUp, ChevronDown, ChevronUp,
  Flame, Sparkles, HelpCircle, Ban, Layers
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { V31MatchResult, PolicyTier } from '@/hooks/useMatchScoreV31';

interface MatchScoreCardV31Props {
  result: V31MatchResult;
  compact?: boolean;
  showExplainability?: boolean;
}

// Policy styling
const policyConfig: Record<PolicyTier, { 
  label: string; 
  icon: typeof Flame; 
  bgColor: string; 
  textColor: string;
  borderColor: string;
}> = {
  hot: { 
    label: 'Hot Match', 
    icon: Flame, 
    bgColor: 'bg-green-100 dark:bg-green-900/30', 
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-300 dark:border-green-700'
  },
  standard: { 
    label: 'Standard', 
    icon: Sparkles, 
    bgColor: 'bg-blue-100 dark:bg-blue-900/30', 
    textColor: 'text-blue-700 dark:text-blue-400',
    borderColor: 'border-blue-300 dark:border-blue-700'
  },
  maybe: { 
    label: 'Vielleicht', 
    icon: HelpCircle, 
    bgColor: 'bg-amber-100 dark:bg-amber-900/30', 
    textColor: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-300 dark:border-amber-700'
  },
  hidden: { 
    label: 'Ausgeschlossen', 
    icon: Ban, 
    bgColor: 'bg-red-100 dark:bg-red-900/30', 
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-300 dark:border-red-700'
  }
};

function getScoreColor(score: number) {
  if (score >= 85) return 'text-green-600 dark:text-green-400';
  if (score >= 75) return 'text-blue-600 dark:text-blue-400';
  if (score >= 65) return 'text-amber-600 dark:text-amber-400';
  if (score >= 50) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

function getProgressColor(score: number) {
  if (score >= 85) return 'bg-green-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 65) return 'bg-amber-500';
  if (score >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

function getCoverageVariant(coverage: number): "default" | "secondary" | "destructive" | "outline" {
  if (coverage >= 0.85) return 'default';
  if (coverage >= 0.70) return 'secondary';
  return 'destructive';
}

// Factor row component
function FactorRow({ 
  label, 
  score, 
  icon: Icon,
  iconColor,
  expanded,
  onToggle,
  children 
}: { 
  label: string; 
  score: number; 
  icon: typeof Brain;
  iconColor: string;
  expanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 -mx-1.5 transition-colors"
        onClick={onToggle}
      >
        <Icon className={cn("h-4 w-4", iconColor)} />
        <span className="text-sm flex-1">{label}</span>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-semibold", getScoreColor(score))}>
            {score}%
          </span>
          <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn("h-full rounded-full transition-all", getProgressColor(score))}
              style={{ width: `${score}%` }}
            />
          </div>
          {children && (
            expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {expanded && children && (
        <div className="pl-7 pr-2 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

// Skills detail component
function SkillsDetail({ details }: { details: V31MatchResult['fit']['details']['skills'] }) {
  const { matched, transferable, missing, mustHaveMissing } = details;

  return (
    <div className="space-y-2 text-xs">
      {matched.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-green-600 mb-1">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-medium">Match ({matched.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {matched.map((skill, i) => (
              <Badge key={i} variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs capitalize">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {transferable.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-blue-600 mb-1">
            <TrendingUp className="h-3 w-3" />
            <span className="font-medium">Transferierbar ({transferable.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {transferable.map((skill, i) => (
              <Badge key={i} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs capitalize">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      
      {mustHaveMissing.length > 0 && (
        <div>
          <div className="flex items-center gap-1 text-red-600 mb-1">
            <XCircle className="h-3 w-3" />
            <span className="font-medium">Fehlende Must-Haves ({mustHaveMissing.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {mustHaveMissing.map((skill, i) => (
              <Badge key={i} variant="destructive" className="text-xs capitalize">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {missing.length > 0 && mustHaveMissing.length === 0 && (
        <div>
          <div className="flex items-center gap-1 text-muted-foreground mb-1">
            <span className="font-medium">Sonstige fehlende ({missing.length})</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {missing.slice(0, 5).map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs capitalize">
                {skill}
              </Badge>
            ))}
            {missing.length > 5 && (
              <Badge variant="secondary" className="text-xs">+{missing.length - 5}</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Constraints detail component
function ConstraintsDetail({ breakdown, gateMultiplier, dealbreakers, domainMismatch }: { 
  breakdown: V31MatchResult['constraints']['breakdown'];
  gateMultiplier: number;
  dealbreakers: V31MatchResult['gates']['dealbreakers'];
  domainMismatch?: V31MatchResult['gates']['domainMismatch'];
}) {
  return (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-muted/50 rounded text-center">
          <Euro className="h-3 w-3 mx-auto mb-1 text-green-600" />
          <div className={cn("font-semibold", getScoreColor(breakdown.salary))}>
            {breakdown.salary}%
          </div>
          <div className="text-muted-foreground">Gehalt</div>
        </div>
        <div className="p-2 bg-muted/50 rounded text-center">
          <Car className="h-3 w-3 mx-auto mb-1 text-orange-600" />
          <div className={cn("font-semibold", getScoreColor(breakdown.commute))}>
            {breakdown.commute}%
          </div>
          <div className="text-muted-foreground">Pendel</div>
        </div>
        <div className="p-2 bg-muted/50 rounded text-center">
          <Clock className="h-3 w-3 mx-auto mb-1 text-purple-600" />
          <div className={cn("font-semibold", getScoreColor(breakdown.startDate))}>
            {breakdown.startDate}%
          </div>
          <div className="text-muted-foreground">Start</div>
        </div>
      </div>

      {/* Domain Mismatch Warning - Critical */}
      {domainMismatch?.isIncompatible && (
        <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
          <Ban className="h-4 w-4 text-red-600" />
          <div className="text-red-700 dark:text-red-400">
            <div className="font-medium">Technologie-Mismatch</div>
            <div className="text-xs opacity-80">
              {domainMismatch.candidateDomain} → {domainMismatch.jobDomain}
            </div>
          </div>
        </div>
      )}
      
      {domainMismatch && !domainMismatch.isIncompatible && (
        <div className="flex items-center gap-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <div className="text-orange-700 dark:text-orange-400">
            <div className="font-medium">Tech-Bereich abweichend</div>
            <div className="text-xs opacity-80">
              {domainMismatch.candidateDomain} → {domainMismatch.jobDomain}
            </div>
          </div>
        </div>
      )}

      {gateMultiplier < 0.95 && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-400">
            Dealbreaker reduzieren Score um {Math.round((1 - gateMultiplier) * 100)}%
          </span>
        </div>
      )}

      {(dealbreakers.salary < 1 || dealbreakers.startDate < 1 || dealbreakers.seniority < 1 || dealbreakers.workModel < 1 || dealbreakers.techDomain < 1) && (
        <div className="text-muted-foreground space-y-1">
          {dealbreakers.techDomain < 1 && (
            <div className="text-red-600 font-medium">• Tech-Domain: {Math.round(dealbreakers.techDomain * 100)}% Multiplier</div>
          )}
          {dealbreakers.salary < 1 && (
            <div>• Gehalt: {Math.round(dealbreakers.salary * 100)}% Multiplier</div>
          )}
          {dealbreakers.startDate < 1 && (
            <div>• Startdatum: {Math.round(dealbreakers.startDate * 100)}% Multiplier</div>
          )}
          {dealbreakers.seniority < 1 && (
            <div>• Seniority: {Math.round(dealbreakers.seniority * 100)}% Multiplier</div>
          )}
          {dealbreakers.workModel < 1 && (
            <div>• Arbeitsmodell: {Math.round(dealbreakers.workModel * 100)}% Multiplier</div>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchScoreCardV31({ result, compact = false, showExplainability = true }: MatchScoreCardV31Props) {
  const [expandedFactor, setExpandedFactor] = useState<string | null>(null);
  
  const policy = policyConfig[result.policy];
  const PolicyIcon = policy.icon;

  const toggleFactor = (factor: string) => {
    setExpandedFactor(expandedFactor === factor ? null : factor);
  };

  if (compact) {
    return (
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        policy.bgColor,
        policy.borderColor
      )}>
        <div className="flex flex-col items-center min-w-[50px]">
          <span className={cn("text-2xl font-bold", getScoreColor(result.overall))}>
            {result.overall ?? 0}%
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn(policy.bgColor, policy.textColor, "border-0")}>
              <PolicyIcon className="h-3 w-3 mr-1" />
              {policy.label}
            </Badge>
            <Badge variant={getCoverageVariant(result.mustHaveCoverage)} className="text-xs">
              {Math.round(result.mustHaveCoverage * 100)}% Coverage
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("border", policy.borderColor)}>
      <CardHeader className={cn("pb-3", policy.bgColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Score Circle */}
            <div className={cn(
              "w-14 h-14 rounded-full flex items-center justify-center border-2",
              policy.borderColor,
              "bg-background"
            )}>
              <span className={cn("text-xl font-bold", getScoreColor(result.overall))}>
                {result.overall ?? 0}
              </span>
            </div>
            
            {/* Policy Badge */}
            <div>
              <Badge variant="outline" className={cn(policy.bgColor, policy.textColor, "border-0 mb-1")}>
                <PolicyIcon className="h-3 w-3 mr-1" />
                {policy.label}
              </Badge>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Fit: {result.fit.score ?? 0}%</span>
                <span>•</span>
                <span>Constraints: {result.constraints.score ?? 0}%</span>
              </div>
            </div>
          </div>

          {/* Coverage Badge */}
          <Badge variant={getCoverageVariant(result.mustHaveCoverage)} className="text-sm">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {Math.round(result.mustHaveCoverage * 100)}% Must-Haves
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {/* Fit Factors */}
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Fit Score
          </div>
          
          <FactorRow
            label="Skills"
            score={result.fit.breakdown.skills}
            icon={Brain}
            iconColor="text-blue-500"
            expanded={expandedFactor === 'skills'}
            onToggle={() => toggleFactor('skills')}
          >
            <SkillsDetail details={result.fit.details.skills} />
          </FactorRow>

          <FactorRow
            label="Erfahrung"
            score={result.fit.breakdown.experience}
            icon={Target}
            iconColor="text-purple-500"
            expanded={expandedFactor === 'experience'}
            onToggle={() => toggleFactor('experience')}
          />

          <FactorRow
            label="Seniority"
            score={result.fit.breakdown.seniority}
            icon={TrendingUp}
            iconColor="text-indigo-500"
            expanded={expandedFactor === 'seniority'}
            onToggle={() => toggleFactor('seniority')}
          />
        </div>

        {/* Constraints */}
        <div className="space-y-1 pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Constraints
          </div>
          
          <FactorRow
            label="Rahmenbedingungen"
            score={result.constraints.score}
            icon={Euro}
            iconColor="text-green-500"
            expanded={expandedFactor === 'constraints'}
            onToggle={() => toggleFactor('constraints')}
          >
            <ConstraintsDetail 
              breakdown={result.constraints.breakdown}
              gateMultiplier={result.gateMultiplier}
              dealbreakers={result.gates.dealbreakers}
              domainMismatch={result.gates.domainMismatch}
            />
          </FactorRow>
        </div>

        {/* Explainability */}
        {showExplainability && (result.explainability.topReasons.length > 0 || result.explainability.topRisks.length > 0) && (
          <div className="pt-3 border-t space-y-2">
            {result.explainability.topReasons.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Stärken
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                  {result.explainability.topReasons.map((reason, i) => (
                    <li key={i}>• {reason}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {result.explainability.topRisks.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Risiken
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 pl-4">
                  {result.explainability.topRisks.map((risk, i) => (
                    <li key={i}>• {risk}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.explainability.nextAction && (
              <div className="text-xs text-primary font-medium pt-1">
                → {result.explainability.nextAction}
              </div>
            )}
          </div>
        )}

        {/* Why Not (for hidden/excluded) */}
        {result.explainability.whyNot && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400">
            <strong>Ausschlussgrund:</strong> {result.explainability.whyNot}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

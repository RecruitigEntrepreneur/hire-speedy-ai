import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Brain, Target, Euro, Car, Users, AlertTriangle, 
  CheckCircle2, XCircle, Info, TrendingUp, MessageSquare,
  ChevronDown, ChevronUp
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

export function MatchScoreCardV2({ 
  result, 
  compact = false,
  onAskCandidate 
}: MatchScoreCardV2Props) {
  const [expanded, setExpanded] = useState(!compact);
  const dealLabel = getDealLabel(result.dealProbability);

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
        <div className="space-y-3">
          <div className="text-sm font-medium text-muted-foreground">Faktor-Breakdown</div>
          
          {Object.entries(result.factors).map(([key, factor]) => {
            const config = factorConfig[key as keyof typeof factorConfig];
            if (!config) return null;
            
            const Icon = config.icon;
            
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className="text-sm">{config.label}</span>
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
                    <span className={cn("text-sm font-medium", 
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
                        onClick={() => onAskCandidate(key)}
                      >
                        <MessageSquare className="h-3 w-3 mr-1" />
                        Fragen
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn("absolute h-full rounded-full transition-all", getProgressColor(factor.score))}
                    style={{ width: `${factor.score}%` }}
                  />
                </div>
                
                {factor.aiReasoning && (
                  <p className="text-xs text-muted-foreground italic pl-6">
                    {factor.aiReasoning}
                  </p>
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

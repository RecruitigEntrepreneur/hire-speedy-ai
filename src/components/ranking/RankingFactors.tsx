import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Info, Target, Brain, Zap, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface RankingFactorsProps {
  matchScore: number | null;
  confidenceScore: number | null;
  readinessScore: number | null;
  closingProbability: number | null;
  overallScore: number;
  compact?: boolean;
}

const factors = [
  {
    key: 'match',
    label: 'Job Match',
    weight: 30,
    icon: Target,
    description: 'Übereinstimmung mit Jobanforderungen (Skills, Erfahrung, Gehalt)',
    getScore: (props: RankingFactorsProps) => props.matchScore,
  },
  {
    key: 'confidence',
    label: 'Kandidaten-Interesse',
    weight: 25,
    icon: Zap,
    description: 'Engagement und Reaktionsgeschwindigkeit des Kandidaten',
    getScore: (props: RankingFactorsProps) => props.confidenceScore,
  },
  {
    key: 'readiness',
    label: 'Interview-Bereitschaft',
    weight: 20,
    icon: Brain,
    description: 'Vorbereitung auf das Interview (Materialien angesehen, Profil recherchiert)',
    getScore: (props: RankingFactorsProps) => props.readinessScore,
  },
  {
    key: 'closing',
    label: 'Abschluss-Wahrscheinlichkeit',
    weight: 25,
    icon: TrendingUp,
    description: 'Wahrscheinlichkeit einer erfolgreichen Einstellung',
    getScore: (props: RankingFactorsProps) => props.closingProbability,
  },
];

export function RankingFactors(props: RankingFactorsProps) {
  const { overallScore, compact = false } = props;

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getProgressColor = (score: number | null) => {
    if (score === null) return 'bg-muted';
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Gesamt-Score</span>
          <span className={cn('text-lg font-bold', getScoreColor(overallScore))}>
            {overallScore}
          </span>
        </div>
        <Progress value={overallScore} className="h-2" />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {factors.map((factor) => {
            const score = factor.getScore(props);
            return (
              <TooltipProvider key={factor.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-center">
                      <factor.icon className="h-4 w-4 mx-auto text-muted-foreground" />
                      <span className={cn('text-xs font-medium', getScoreColor(score))}>
                        {score ?? '-'}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{factor.label}: {score ?? 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-lg">Ranking-Faktoren</span>
          <span className={cn('text-2xl font-bold', getScoreColor(overallScore))}>
            {overallScore}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.map((factor) => {
          const score = factor.getScore(props);
          const Icon = factor.icon;
          const contribution = score !== null ? Math.round((score * factor.weight) / 100) : 0;

          return (
            <div key={factor.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{factor.label}</span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">{factor.description}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {factor.weight}% Gewicht
                  </span>
                  <span className={cn('font-semibold', getScoreColor(score))}>
                    {score ?? 'N/A'}
                  </span>
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={score ?? 0} 
                  className="h-2"
                />
                {score !== null && (
                  <span className="absolute right-0 -top-5 text-xs text-muted-foreground">
                    +{contribution} Punkte
                  </span>
                )}
              </div>
            </div>
          );
        })}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Berechnung:</span>
            <span className="font-mono text-xs">
              Match×30% + Interesse×25% + Bereitschaft×20% + Abschluss×25%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

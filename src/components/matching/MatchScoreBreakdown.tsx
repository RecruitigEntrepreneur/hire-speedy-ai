import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Brain,
  Briefcase,
  Euro,
  Clock,
  MapPin,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { V31MatchResult } from '@/hooks/useMatchScoreV31';

interface SkillMatch {
  skill: string;
  status: 'exact' | 'partial' | 'missing';
  required: boolean;
}

interface BreakdownCategory {
  category: 'skills' | 'experience' | 'salary' | 'availability' | 'location';
  score: number;
  weight: number;
  label: string;
  details: string[];
  status: 'excellent' | 'good' | 'warning' | 'poor';
}

interface MatchScoreBreakdownProps {
  matchScore: number;
  breakdown?: BreakdownCategory[];
  skillMatches?: SkillMatch[];
  compact?: boolean;
  className?: string;
  /** V31 Match Result for detailed breakdown from the matching engine */
  v31Result?: V31MatchResult;
}

const categoryIcons = {
  skills: Brain,
  experience: Briefcase,
  salary: Euro,
  availability: Clock,
  location: MapPin,
};

const statusConfig = {
  excellent: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10', label: 'Exzellent' },
  good: { icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10', label: 'Gut' },
  warning: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10', label: 'Achtung' },
  poor: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Kritisch' },
};

// Helper to get status from score
function getStatusFromScore(score: number): 'excellent' | 'good' | 'warning' | 'poor' {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'warning';
  return 'poor';
}

// Map V31 result to breakdown categories
function mapV31ToBreakdown(result: V31MatchResult): BreakdownCategory[] {
  const { fit, constraints } = result;
  
  const categories: BreakdownCategory[] = [
    {
      category: 'skills',
      score: fit.breakdown.skills,
      weight: 35,
      label: 'Skills',
      details: [
        fit.details.skills.matched.length > 0 
          ? `${fit.details.skills.matched.length} exakte Matches` 
          : null,
        fit.details.skills.transferable.length > 0 
          ? `${fit.details.skills.transferable.length} transferierbare Skills` 
          : null,
        fit.details.skills.mustHaveMissing.length > 0 
          ? `${fit.details.skills.mustHaveMissing.length} fehlende Must-Haves` 
          : null,
      ].filter(Boolean) as string[],
      status: getStatusFromScore(fit.breakdown.skills),
    },
    {
      category: 'experience',
      score: fit.breakdown.experience,
      weight: 25,
      label: 'Erfahrung',
      details: [
        `Seniority-Match: ${fit.breakdown.seniority}%`,
        fit.breakdown.industry > 0 ? `Branchen-Erfahrung: ${fit.breakdown.industry}%` : null,
      ].filter(Boolean) as string[],
      status: getStatusFromScore(fit.breakdown.experience),
    },
    {
      category: 'salary',
      score: constraints.breakdown.salary,
      weight: 20,
      label: 'Gehalt',
      details: constraints.breakdown.salary < 80 
        ? ['Budget-Abweichung vorhanden'] 
        : ['Im Budgetrahmen'],
      status: getStatusFromScore(constraints.breakdown.salary),
    },
    {
      category: 'availability',
      score: constraints.breakdown.startDate,
      weight: 10,
      label: 'Verfügbarkeit',
      details: constraints.breakdown.startDate >= 80 
        ? ['Zeitlich passend'] 
        : ['Startdatum-Differenz'],
      status: getStatusFromScore(constraints.breakdown.startDate),
    },
    {
      category: 'location',
      score: constraints.breakdown.commute,
      weight: 10,
      label: 'Standort',
      details: constraints.breakdown.commute >= 80 
        ? ['Standort passt'] 
        : ['Pendeldistanz beachten'],
      status: getStatusFromScore(constraints.breakdown.commute),
    },
  ];
  
  return categories;
}

// Map V31 skill details to skill matches
function mapV31ToSkillMatches(result: V31MatchResult): SkillMatch[] {
  const { matched, transferable, missing, mustHaveMissing } = result.fit.details.skills;
  
  const skillMatches: SkillMatch[] = [
    ...matched.map(skill => ({ 
      skill, 
      status: 'exact' as const, 
      required: false 
    })),
    ...transferable.map(skill => ({ 
      skill, 
      status: 'partial' as const, 
      required: false 
    })),
    ...mustHaveMissing.map(skill => ({ 
      skill, 
      status: 'missing' as const, 
      required: true 
    })),
    ...missing.filter(s => !mustHaveMissing.includes(s)).map(skill => ({ 
      skill, 
      status: 'missing' as const, 
      required: false 
    })),
  ];
  
  return skillMatches.slice(0, 12); // Limit to 12 for UI
}

const defaultBreakdown: BreakdownCategory[] = [
  { category: 'skills', score: 85, weight: 40, label: 'Skills', details: ['React: Exakt', 'TypeScript: Exakt'], status: 'excellent' },
  { category: 'experience', score: 90, weight: 25, label: 'Erfahrung', details: ['5 Jahre (Anforderung: 4-7)'], status: 'excellent' },
  { category: 'salary', score: 75, weight: 20, label: 'Gehalt', details: ['€75k erwartet vs. €70k Budget'], status: 'warning' },
  { category: 'availability', score: 100, weight: 10, label: 'Verfügbarkeit', details: ['Sofort verfügbar'], status: 'excellent' },
  { category: 'location', score: 95, weight: 5, label: 'Standort', details: ['Berlin (Remote möglich)'], status: 'excellent' },
];

export function MatchScoreBreakdown({
  matchScore,
  breakdown,
  skillMatches,
  compact = false,
  className,
  v31Result,
}: MatchScoreBreakdownProps) {
  const [isOpen, setIsOpen] = useState(!compact);
  
  // Use V31 result if provided, otherwise fall back to props or defaults
  const effectiveBreakdown = v31Result 
    ? mapV31ToBreakdown(v31Result) 
    : (breakdown || defaultBreakdown);
  
  const effectiveSkillMatches = v31Result 
    ? mapV31ToSkillMatches(v31Result) 
    : skillMatches;
  
  const effectiveScore = v31Result ? v31Result.overall : matchScore;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-success';
    if (score >= 60) return 'bg-primary';
    if (score >= 40) return 'bg-warning';
    return 'bg-destructive';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Exzellent';
    if (score >= 70) return 'Gut';
    if (score >= 50) return 'Akzeptabel';
    return 'Schwach';
  };

  if (compact) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={className}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between p-3 h-auto">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex items-center justify-center w-12 h-12 rounded-full border-2 font-bold",
                effectiveScore >= 80 && "text-success border-success bg-success/10",
                effectiveScore >= 60 && effectiveScore < 80 && "text-primary border-primary bg-primary/10",
                effectiveScore < 60 && "text-warning border-warning bg-warning/10"
              )}>
                {effectiveScore}%
              </div>
              <div className="text-left">
                <p className="font-medium">Match Score</p>
                <p className="text-xs text-muted-foreground">{getScoreLabel(effectiveScore)}</p>
              </div>
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-3 pb-3">
          <div className="space-y-3 pt-2 border-t">
            {effectiveBreakdown.map((item) => {
              const Icon = categoryIcons[item.category];
              const StatusIcon = statusConfig[item.status].icon;
              
              return (
                <div key={item.category} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{item.label}</span>
                      <span className="text-xs text-muted-foreground">({item.weight}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon className={cn("h-3.5 w-3.5", statusConfig[item.status].color)} />
                      <span className={cn("font-medium", getScoreColor(item.score))}>{item.score}%</span>
                    </div>
                  </div>
                  <Progress 
                    value={item.score} 
                    className="h-1.5"
                  />
                  {item.details.length > 0 && (
                    <ul className="text-xs text-muted-foreground pl-5 space-y-0.5">
                      {item.details.map((detail, idx) => (
                        <li key={idx}>• {detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Match-Analyse
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn("text-2xl font-bold", getScoreColor(effectiveScore))}>
              {effectiveScore}%
            </span>
            <Badge variant="outline" className={cn(
              effectiveScore >= 80 && "border-success text-success",
              effectiveScore >= 60 && effectiveScore < 80 && "border-primary text-primary",
              effectiveScore < 60 && "border-warning text-warning"
            )}>
              {getScoreLabel(effectiveScore)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {effectiveBreakdown.map((item) => {
          const Icon = categoryIcons[item.category];
          const StatusIcon = statusConfig[item.status].icon;
          const statusCfg = statusConfig[item.status];
          
          return (
            <div key={item.category} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn("p-1.5 rounded", statusCfg.bg)}>
                    <Icon className={cn("h-4 w-4", statusCfg.color)} />
                  </div>
                  <div>
                    <span className="font-medium text-sm">{item.label}</span>
                    <span className="text-xs text-muted-foreground ml-1">({item.weight}% Gewicht)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("h-4 w-4", statusCfg.color)} />
                  <span className={cn("font-semibold", getScoreColor(item.score))}>{item.score}%</span>
                </div>
              </div>
              <Progress 
                value={item.score} 
                className="h-2"
              />
              {item.details.length > 0 && (
                <ul className="text-sm text-muted-foreground space-y-1 pl-1">
                  {item.details.map((detail, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-muted-foreground/50">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {/* Skill Matches Section */}
        {effectiveSkillMatches && effectiveSkillMatches.length > 0 && (
          <div className="pt-3 border-t">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-muted-foreground" />
              Skill-Details
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {effectiveSkillMatches.map((skill, idx) => (
                <Badge 
                  key={idx}
                  variant="outline"
                  className={cn(
                    "text-xs",
                    skill.status === 'exact' && "border-success text-success bg-success/5",
                    skill.status === 'partial' && "border-warning text-warning bg-warning/5",
                    skill.status === 'missing' && "border-destructive text-destructive bg-destructive/5"
                  )}
                >
                  {skill.status === 'exact' && <CheckCircle className="h-3 w-3 mr-1" />}
                  {skill.status === 'partial' && <AlertTriangle className="h-3 w-3 mr-1" />}
                  {skill.status === 'missing' && <XCircle className="h-3 w-3 mr-1" />}
                  {skill.skill}
                  {skill.required && <span className="ml-1 text-[10px]">*</span>}
                </Badge>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">* Muss-Anforderung</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

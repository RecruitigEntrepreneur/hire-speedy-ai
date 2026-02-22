import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Gauge, 
  Lightbulb, 
  DollarSign, 
  Gift, 
  Code2, 
  FileText,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface JobQualityScoreCardProps {
  job: {
    salary_min: number | null;
    salary_max: number | null;
    skills: string[] | null;
    description: string | null;
    requirements: string | null;
    intake_completeness: number | null;
    industry: string | null;
    remote_type: string | null;
    employment_type: string | null;
    location: string | null;
  };
  hasBenefits: boolean;
  onEditField: (tab: string) => void;
  className?: string;
}

function calculateQualityScore(params: {
  hasSalary: boolean;
  descLength: number;
  reqLength: number;
  hasSkills: boolean;
  hasBenefits: boolean;
  hasIndustry: boolean;
  hasRemoteType: boolean;
  hasEmploymentType: boolean;
  hasLocation: boolean;
  intakeCompleteness: number;
}): number {
  let score = 0;
  if (params.hasSalary) score += 20;
  if (params.descLength > 200) score += 15;
  else if (params.descLength > 50) score += 10;
  if (params.reqLength > 50) score += 10;
  if (params.hasSkills) score += 15;
  if (params.hasBenefits) score += 10;
  if (params.hasIndustry) score += 5;
  if (params.hasRemoteType) score += 5;
  if (params.hasEmploymentType) score += 5;
  if (params.hasLocation) score += 5;
  if (params.intakeCompleteness > 0) score += 10;
  return Math.round(Math.min(score, 100));
}

function getScoreConfig(score: number) {
  if (score >= 80) return { label: 'Exzellent', color: 'text-emerald-600', stroke: 'stroke-emerald-500', bg: 'bg-emerald-500/10' };
  if (score >= 60) return { label: 'Gut', color: 'text-blue-600', stroke: 'stroke-blue-500', bg: 'bg-blue-500/10' };
  if (score >= 40) return { label: 'Ausbaufähig', color: 'text-amber-600', stroke: 'stroke-amber-500', bg: 'bg-amber-500/10' };
  return { label: 'Basis', color: 'text-muted-foreground', stroke: 'stroke-muted-foreground', bg: 'bg-muted' };
}

export function JobQualityScoreCard({ job, hasBenefits, onEditField, className }: JobQualityScoreCardProps) {
  const hasSalary = !!(job.salary_min || job.salary_max);
  const hasSkills = !!(job.skills && job.skills.length > 0);
  const descLength = job.description?.length || 0;
  const reqLength = job.requirements?.length || 0;
  const intakeCompleteness = job.intake_completeness || 0;
  const hasIndustry = !!job.industry;
  const hasRemoteType = !!job.remote_type;
  const hasEmploymentType = !!job.employment_type;
  const hasLocation = !!job.location;

  const score = calculateQualityScore({
    hasSalary, descLength, reqLength, hasSkills, hasBenefits,
    hasIndustry, hasRemoteType, hasEmploymentType, hasLocation, intakeCompleteness,
  });
  const config = getScoreConfig(score);

  // Build improvement suggestions
  const suggestions: { icon: React.ReactNode; text: string; impact: string; tab: string }[] = [];
  if (!hasSalary) suggestions.push({ icon: <DollarSign className="h-4 w-4" />, text: 'Gehaltsrahmen ergänzen', impact: 'Hoher Impact', tab: 'conditions' });
  if (!hasSkills) suggestions.push({ icon: <Code2 className="h-4 w-4" />, text: 'Skills definieren', impact: 'Hoher Impact', tab: 'skills' });
  if (!hasBenefits) suggestions.push({ icon: <Gift className="h-4 w-4" />, text: 'Benefits beschreiben', impact: 'Mittlerer Impact', tab: 'basics' });
  if (descLength < 200) suggestions.push({ icon: <FileText className="h-4 w-4" />, text: 'Beschreibung erweitern', impact: 'Niedriger Impact', tab: 'basics' });

  // SVG circle params
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          Job-Qualität
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Circular Score */}
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="8" className="stroke-muted" />
              <circle
                cx="50" cy="50" r={radius} fill="none" strokeWidth="8"
                strokeLinecap="round"
                className={cn(config.stroke, 'transition-all duration-1000')}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold", config.color)}>{score}</span>
              <span className="text-[10px] text-muted-foreground">von 100</span>
            </div>
          </div>
          <div>
            <Badge className={cn(config.bg, config.color, 'border-0 mb-1')}>{config.label}</Badge>
            <p className="text-xs text-muted-foreground mt-1">
              {score >= 80
                ? 'Recruiter können diese Stelle optimal vermarkten.'
                : score >= 60
                  ? 'Gute Basis. Wenige Ergänzungen steigern die Sichtbarkeit.'
                  : 'Mehr Details helfen Recruitern, passende Kandidaten zu finden.'}
            </p>
          </div>
        </div>

        {/* Improvement Suggestions */}
        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Verbesserungsvorschläge
            </p>
            {suggestions.slice(0, 3).map((s, i) => (
              <div 
                key={i}
                onClick={() => onEditField(s.tab)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 cursor-pointer transition-all group"
              >
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                  {s.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{s.text}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{s.impact}</Badge>
              </div>
            ))}
          </div>
        )}

        {/* Recruiter-Checkliste */}
        <div className="space-y-1.5 pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">Recruiter-Checkliste</p>
          {[
            { label: 'Gehalt angegeben', ok: hasSalary, tab: 'conditions' },
            { label: 'Skills definiert', ok: hasSkills, tab: 'skills' },
            { label: 'Beschreibung vorhanden', ok: descLength > 50, tab: 'basics' },
            { label: 'Benefits beschrieben', ok: hasBenefits, tab: 'basics' },
            { label: 'Branche angegeben', ok: hasIndustry, tab: 'basics' },
            { label: 'Remote-Type gesetzt', ok: hasRemoteType, tab: 'conditions' },
            { label: 'Standort angegeben', ok: hasLocation, tab: 'basics' },
          ].map((item, i) => (
            <div 
              key={i} 
              className={`flex items-center gap-2 text-sm ${!item.ok ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              onClick={() => !item.ok && onEditField(item.tab)}
            >
              {item.ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[9px] text-muted-foreground">✕</span>
              )}
              <span className={item.ok ? 'text-foreground' : 'text-muted-foreground'}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* All good state */}
        {suggestions.length === 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <p className="text-sm">Alle wichtigen Felder ausgefüllt – optimale Sichtbarkeit!</p>
          </div>
        )}

        {suggestions.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => onEditField(suggestions[0]?.tab || 'basics')} className="w-full">
            Details ergänzen
            <ArrowRight className="h-3.5 w-3.5 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

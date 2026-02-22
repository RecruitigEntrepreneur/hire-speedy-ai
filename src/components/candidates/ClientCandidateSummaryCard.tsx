import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useClientCandidateSummary } from '@/hooks/useClientCandidateSummary';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ClientCandidateSummaryCardProps {
  candidateId: string;
  submissionId?: string;
  className?: string;
  compact?: boolean;
}

export function ClientCandidateSummaryCard({ candidateId, submissionId, className, compact = false }: ClientCandidateSummaryCardProps) {
  const { summary, loading, generating, generateSummary } = useClientCandidateSummary(candidateId, submissionId);
  const hasTriedGenerate = useRef(false);
  const [expanded, setExpanded] = useState(false);

  // Auto-generate ONLY if no summary exists at all
  useEffect(() => {
    if (!loading && !summary && !generating && candidateId && !hasTriedGenerate.current) {
      hasTriedGenerate.current = true;
      generateSummary({ silent: true });
    }
  }, [loading, summary, generating, candidateId, generateSummary]);

  useEffect(() => {
    hasTriedGenerate.current = false;
  }, [candidateId]);

  const handleRefresh = () => {
    generateSummary({ force: true });
  };

  if (loading || (!summary && generating)) {
    return (
      <Card className={className}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">KI-Einschätzung</span>
            {generating && (
              <Badge variant="secondary" className="ml-auto gap-1 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Wird erstellt...
              </Badge>
            )}
          </div>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">KI-Einschätzung</span>
          </div>
          <p className="text-sm text-muted-foreground text-center py-3">
            Analyse konnte nicht erstellt werden.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRecommendationConfig = (rec: string) => {
    switch (rec) {
      case 'strong_yes':
        return { border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Starke Empfehlung', sublabel: 'Ausgezeichnete Passung', icon: ThumbsUp };
      case 'yes':
        return { border: 'border-green-500', text: 'text-green-700 dark:text-green-400', label: 'Empfehlung', sublabel: 'Gute Passung', icon: ThumbsUp };
      case 'maybe':
        return { border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'Mit Vorbehalt', sublabel: 'Teilweise passend', icon: Minus };
      case 'no':
        return { border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-400', label: 'Nicht empfohlen', sublabel: 'Geringe Passung', icon: ThumbsDown };
      case 'strong_no':
        return { border: 'border-red-500', text: 'text-red-700 dark:text-red-400', label: 'Nicht geeignet', sublabel: 'Keine Passung', icon: ThumbsDown };
      default:
        return { border: 'border-muted', text: 'text-muted-foreground', label: 'Keine Bewertung', sublabel: '', icon: Minus };
    }
  };

  const getJobHopperLabel = () => {
    const { concern_level, avg_tenure_months } = summary.job_hopper_analysis;
    const years = (avg_tenure_months / 12).toFixed(1);
    switch (concern_level) {
      case 'high': return { label: 'Jobhopper', sub: `Ø ${years}J`, cls: 'text-destructive' };
      case 'medium': return { label: 'Wechselfreudig', sub: `Ø ${years}J`, cls: 'text-amber-600 dark:text-amber-400' };
      default: return { label: 'Stabil', sub: `Ø ${years}J`, cls: 'text-emerald-600 dark:text-emerald-400' };
    }
  };

  const recConfig = getRecommendationConfig(summary.recommendation);
  const RecIcon = recConfig.icon;
  const jobHopper = getJobHopperLabel();

  const highRisks = summary.risk_factors.filter(r => r.severity === 'high');
  const mediumRisks = summary.risk_factors.filter(r => r.severity === 'medium');
  const lowRisks = summary.risk_factors.filter(r => r.severity === 'low');
  const highStrengths = summary.positive_factors.filter(f => f.strength === 'high');
  const otherStrengths = summary.positive_factors.filter(f => f.strength !== 'high');

  // ============================================================================
  // COMPACT MODE: Collapsible card
  // ============================================================================
  if (compact) {
    return (
      <Card className={className}>
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CardContent className="p-5">
            {/* Always visible: Header + Badge + Summary preview */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border-2 shrink-0',
                  recConfig.border, recConfig.text
                )}>
                  <RecIcon className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">{recConfig.label}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm leading-relaxed line-clamp-2">
                    {summary.executive_summary}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      {summary.positive_factors.length} Stärken
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      {summary.risk_factors.length} Risiken
                    </span>
                    <span className={cn("text-[10px]", jobHopper.cls)}>
                      {jobHopper.label} ({jobHopper.sub})
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                  disabled={generating}
                  className="h-7 w-7 p-0"
                >
                  {generating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3 w-3" />
                  )}
                </Button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </div>

            {/* Expandable details */}
            <CollapsibleContent className="mt-4 space-y-4">
              {/* Key Selling Points */}
              {summary.key_selling_points.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kernargumente</p>
                  <ul className="space-y-1">
                    {summary.key_selling_points.map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strengths & Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span className="text-xs font-medium">Stärken</span>
                    <Badge variant="outline" className="h-4 px-1 text-[10px]">{summary.positive_factors.length}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {highStrengths.slice(0, 2).map((f, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/40">
                        <p className="text-xs font-medium">{f.factor}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{f.detail}</p>
                      </div>
                    ))}
                    {otherStrengths.slice(0, 1).map((f, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/30">
                        <p className="text-xs font-medium">{f.factor}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{f.detail}</p>
                      </div>
                    ))}
                    {summary.positive_factors.length === 0 && (
                      <p className="text-xs text-muted-foreground">Keine identifiziert</p>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-xs font-medium">Risiken</span>
                    {highRisks.length > 0 && (
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">{highRisks.length} hoch</Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {highRisks.slice(0, 2).map((r, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/40">
                        <p className="text-xs font-medium">{r.factor}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.detail}</p>
                      </div>
                    ))}
                    {mediumRisks.slice(0, 1).map((r, idx) => (
                      <div key={idx} className="p-2 rounded bg-muted/30">
                        <p className="text-xs font-medium">{r.factor}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{r.detail}</p>
                      </div>
                    ))}
                    {summary.risk_factors.length === 0 && (
                      <p className="text-xs text-muted-foreground">Keine identifiziert</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Change Motivation */}
              {summary.change_motivation_summary && (
                <div className="p-3 bg-muted/30 rounded-lg">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Wechselmotivation</p>
                  <p className="text-sm text-muted-foreground">{summary.change_motivation_summary}</p>
                </div>
              )}

              {/* Meta + Disclaimer */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3" />
                    <span>
                      {summary.generated_at && format(new Date(summary.generated_at), 'dd.MM.yyyy', { locale: de })}
                      {summary.model_version && ` · ${summary.model_version}`}
                    </span>
                  </div>
                  <span>{jobHopper.label} ({jobHopper.sub})</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
                  Hinweis gemäß EU AI Act: Diese Einschätzung wurde automatisiert erstellt und dient ausschließlich als Entscheidungshilfe.
                </p>
              </div>
            </CollapsibleContent>
          </CardContent>
        </Collapsible>
      </Card>
    );
  }

  // ============================================================================
  // FULL MODE (default, unchanged behavior)
  // ============================================================================
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Recommendation Banner */}
        <div className="p-4 bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <span className="font-semibold text-sm">KI-gestützte Einschätzung</span>
              {summary.generated_at && (
                <span className="text-xs text-muted-foreground">
                  Automatisiert erstellt am {format(new Date(summary.generated_at), 'dd.MM.yyyy', { locale: de })}
                  {summary.model_version && ` · Modell: ${summary.model_version}`}
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={generating} className="h-7 px-2 text-xs">
              {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RefreshCcw className="h-3 w-3 mr-1" />Aktualisieren</>}
            </Button>
          </div>
          
          <div className={cn('mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-semibold', recConfig.border, recConfig.text)}>
            <RecIcon className="h-5 w-5" />
            <div>
              <div className="text-sm">{recConfig.label}</div>
              {recConfig.sublabel && <div className="text-xs opacity-75">{recConfig.sublabel}</div>}
            </div>
          </div>
        </div>

        <div className="p-4 border-b">
          <p className="text-sm leading-relaxed">{summary.executive_summary}</p>
        </div>

        <div className="p-4 border-b bg-muted/20">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border">
              <span className={cn("text-xs font-medium", jobHopper.cls)}>{jobHopper.label}</span>
              <span className="text-xs text-muted-foreground">{jobHopper.sub}</span>
            </div>
            {summary.key_selling_points.slice(0, 3).map((point, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 border">
                <span className="text-xs font-medium">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {summary.change_motivation_summary && (
          <div className="p-4 border-b bg-muted/20">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-medium">Wechselmotivation</span>
                <p className="text-sm text-muted-foreground mt-0.5">{summary.change_motivation_summary}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-sm">Stärken</span>
              <Badge variant="outline" className="h-5 px-1.5 text-xs">{summary.positive_factors.length}</Badge>
            </div>
            <div className="space-y-2">
              {highStrengths.slice(0, 2).map((f, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{f.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{f.detail}</p>
                  </div>
                </div>
              ))}
              {otherStrengths.slice(0, 2).map((f, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{f.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{f.detail}</p>
                  </div>
                </div>
              ))}
              {summary.positive_factors.length === 0 && <p className="text-sm text-muted-foreground">Keine Stärken identifiziert</p>}
            </div>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-sm">Risiken</span>
              {highRisks.length > 0 && <Badge variant="destructive" className="h-5 px-1.5 text-xs">{highRisks.length} hoch</Badge>}
              {mediumRisks.length > 0 && <Badge variant="outline" className="h-5 px-1.5 text-xs border-amber-500/50 text-amber-600 bg-amber-500/10">{mediumRisks.length} mittel</Badge>}
            </div>
            <div className="space-y-2">
              {highRisks.slice(0, 2).map((r, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/40">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{r.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                  </div>
                </div>
              ))}
              {mediumRisks.slice(0, 2).map((r, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{r.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                  </div>
                </div>
              ))}
              {lowRisks.slice(0, 1).map((r, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{r.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{r.detail}</p>
                  </div>
                </div>
              ))}
              {summary.risk_factors.length === 0 && <p className="text-sm text-muted-foreground">Keine Risiken identifiziert</p>}
            </div>
          </div>
        </div>

        <div className="p-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground/70 text-center">
            Hinweis gemäß EU AI Act: Diese Einschätzung wurde automatisiert erstellt und dient ausschließlich als Entscheidungshilfe. Die finale Personalentscheidung obliegt Ihnen.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

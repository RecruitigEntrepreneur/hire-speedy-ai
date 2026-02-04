import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Loader2
} from 'lucide-react';
import { useClientCandidateSummary } from '@/hooks/useClientCandidateSummary';
import { cn } from '@/lib/utils';

interface ClientCandidateSummaryCardProps {
  candidateId: string;
  submissionId?: string;
  className?: string;
}

export function ClientCandidateSummaryCard({ candidateId, submissionId, className }: ClientCandidateSummaryCardProps) {
  const { summary, loading, generating, generateSummary } = useClientCandidateSummary(candidateId, submissionId);
  const hasTriedGenerate = useRef(false);

  // Auto-generate summary if none exists
  useEffect(() => {
    if (!loading && !summary && !generating && candidateId && !hasTriedGenerate.current) {
      hasTriedGenerate.current = true;
      generateSummary();
    }
  }, [loading, summary, generating, candidateId, generateSummary]);

  // Reset the ref when candidateId changes
  useEffect(() => {
    hasTriedGenerate.current = false;
  }, [candidateId]);

  if (loading || (!summary && generating)) {
    return (
      <Card className={className}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">KI-Einschätzung</span>
            {generating && (
              <Badge variant="secondary" className="ml-auto gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Wird erstellt...
              </Badge>
            )}
          </div>
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">KI-Einschätzung</span>
          </div>
          <p className="text-sm text-muted-foreground text-center py-4">
            Analyse konnte nicht erstellt werden.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRecommendationConfig = (rec: string) => {
    switch (rec) {
      case 'strong_yes':
        return { 
          gradient: 'from-emerald-500 to-emerald-600', 
          bg: 'bg-emerald-500/10',
          text: 'text-emerald-700 dark:text-emerald-400', 
          label: 'Starke Empfehlung', 
          sublabel: 'Ausgezeichnete Passung',
          icon: ThumbsUp 
        };
      case 'yes':
        return { 
          gradient: 'from-green-500 to-green-600', 
          bg: 'bg-green-500/10',
          text: 'text-green-700 dark:text-green-400', 
          label: 'Empfehlung', 
          sublabel: 'Gute Passung',
          icon: ThumbsUp 
        };
      case 'maybe':
        return { 
          gradient: 'from-amber-500 to-amber-600', 
          bg: 'bg-amber-500/10',
          text: 'text-amber-700 dark:text-amber-400', 
          label: 'Mit Vorbehalt', 
          sublabel: 'Teilweise passend',
          icon: Minus 
        };
      case 'no':
        return { 
          gradient: 'from-orange-500 to-orange-600', 
          bg: 'bg-orange-500/10',
          text: 'text-orange-700 dark:text-orange-400', 
          label: 'Nicht empfohlen', 
          sublabel: 'Geringe Passung',
          icon: ThumbsDown 
        };
      case 'strong_no':
        return { 
          gradient: 'from-red-500 to-red-600', 
          bg: 'bg-red-500/10',
          text: 'text-red-700 dark:text-red-400', 
          label: 'Nicht geeignet', 
          sublabel: 'Keine Passung',
          icon: ThumbsDown 
        };
      default:
        return { 
          gradient: 'from-muted to-muted', 
          bg: 'bg-muted',
          text: 'text-muted-foreground', 
          label: 'Keine Bewertung', 
          sublabel: '',
          icon: Minus 
        };
    }
  };

  const getJobHopperBadge = () => {
    const { concern_level, avg_tenure_months } = summary.job_hopper_analysis;
    const years = (avg_tenure_months / 12).toFixed(1);
    
    switch (concern_level) {
      case 'high':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <div>
              <div className="text-xs font-medium text-destructive">Jobhopper</div>
              <div className="text-xs text-muted-foreground">Ø {years} Jahre</div>
            </div>
          </div>
        );
      case 'medium':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="h-4 w-4 text-amber-600" />
            <div>
              <div className="text-xs font-medium text-amber-700 dark:text-amber-400">Wechselfreudig</div>
              <div className="text-xs text-muted-foreground">Ø {years} Jahre</div>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Stabil</div>
              <div className="text-xs text-muted-foreground">Ø {years} Jahre</div>
            </div>
          </div>
        );
    }
  };

  const recConfig = getRecommendationConfig(summary.recommendation);
  const RecIcon = recConfig.icon;

  const highRisks = summary.risk_factors.filter(r => r.severity === 'high');
  const mediumRisks = summary.risk_factors.filter(r => r.severity === 'medium');
  const lowRisks = summary.risk_factors.filter(r => r.severity === 'low');
  
  const highStrengths = summary.positive_factors.filter(f => f.strength === 'high');
  const otherStrengths = summary.positive_factors.filter(f => f.strength !== 'high');

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* Recommendation Banner */}
        <div className={cn('p-4', recConfig.bg)}>
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm">KI-Einschätzung</span>
          </div>
          
          {/* Large Recommendation Badge */}
          <div className={cn(
            'mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r text-white font-semibold shadow-lg',
            recConfig.gradient
          )}>
            <RecIcon className="h-5 w-5" />
            <div>
              <div className="text-sm">{recConfig.label}</div>
              {recConfig.sublabel && (
                <div className="text-xs opacity-90">{recConfig.sublabel}</div>
              )}
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="p-4 border-b">
          <p className="text-sm leading-relaxed text-foreground">
            {summary.executive_summary}
          </p>
        </div>

        {/* Key Insights Row */}
        <div className="p-4 border-b bg-muted/30">
          <div className="flex flex-wrap gap-2">
            {getJobHopperBadge()}
            {summary.key_selling_points.slice(0, 3).map((point, idx) => (
              <div 
                key={idx} 
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/10"
              >
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{point}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change Motivation */}
        {summary.change_motivation_summary && (
          <div className="p-4 border-b bg-blue-500/5">
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Wechselmotivation</span>
                <p className="text-sm text-muted-foreground mt-0.5">{summary.change_motivation_summary}</p>
              </div>
            </div>
          </div>
        )}

        {/* Strengths & Risks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
          {/* Strengths Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="font-medium text-sm">Stärken</span>
              <Badge variant="outline" className="h-5 px-1.5 text-xs border-emerald-500/50 text-emerald-600 bg-emerald-500/10">
                {summary.positive_factors.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {highStrengths.slice(0, 2).map((factor, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{factor.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{factor.detail}</p>
                  </div>
                </div>
              ))}
              {otherStrengths.slice(0, 2).map((factor, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{factor.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{factor.detail}</p>
                  </div>
                </div>
              ))}
              {summary.positive_factors.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Stärken identifiziert</p>
              )}
            </div>
          </div>

          {/* Risks Column */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="font-medium text-sm">Risiken</span>
              {highRisks.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {highRisks.length} hoch
                </Badge>
              )}
              {mediumRisks.length > 0 && (
                <Badge variant="outline" className="h-5 px-1.5 text-xs border-amber-500/50 text-amber-600 bg-amber-500/10">
                  {mediumRisks.length} mittel
                </Badge>
              )}
            </div>
            <div className="space-y-2">
              {highRisks.slice(0, 2).map((risk, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{risk.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{risk.detail}</p>
                  </div>
                </div>
              ))}
              {mediumRisks.slice(0, 2).map((risk, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{risk.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{risk.detail}</p>
                  </div>
                </div>
              ))}
              {lowRisks.slice(0, 1).map((risk, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{risk.factor}</span>
                    <p className="text-xs text-muted-foreground truncate">{risk.detail}</p>
                  </div>
                </div>
              ))}
              {summary.risk_factors.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Risiken identifiziert</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

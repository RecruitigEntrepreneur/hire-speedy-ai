import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Sparkles, 
  RefreshCw, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Briefcase,
  Target,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Loader2
} from 'lucide-react';
import { useClientCandidateSummary, RiskFactor, PositiveFactor } from '@/hooks/useClientCandidateSummary';
import { cn } from '@/lib/utils';

interface ClientCandidateSummaryCardProps {
  candidateId: string;
  submissionId?: string;
  className?: string;
}

export function ClientCandidateSummaryCard({ candidateId, submissionId, className }: ClientCandidateSummaryCardProps) {
  const { summary, loading, generating, generateSummary } = useClientCandidateSummary(candidateId, submissionId);
  const [risksOpen, setRisksOpen] = useState(false);
  const [strengthsOpen, setStrengthsOpen] = useState(false);
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
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Analyse
            {generating && (
              <Badge variant="secondary" className="ml-auto gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Wird erstellt...
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI-Analyse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Analyse konnte nicht erstellt werden.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'strong_yes':
        return { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-600', label: 'Starke Empfehlung', icon: ThumbsUp };
      case 'yes':
        return { bg: 'bg-green-500/10 border-green-500/30', text: 'text-green-600', label: 'Empfehlung', icon: ThumbsUp };
      case 'maybe':
        return { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-600', label: 'Mit Vorbehalt', icon: Minus };
      case 'no':
        return { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-600', label: 'Nicht empfohlen', icon: ThumbsDown };
      case 'strong_no':
        return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-600', label: 'Nicht geeignet', icon: ThumbsDown };
      default:
        return { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Keine Bewertung', icon: Minus };
    }
  };

  const getJobHopperBadge = () => {
    const { concern_level, avg_tenure_months } = summary.job_hopper_analysis;
    const years = (avg_tenure_months / 12).toFixed(1);
    
    switch (concern_level) {
      case 'high':
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Jobhopper (Ø {years}J)
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600 bg-amber-500/10">
            <Clock className="h-3 w-3" />
            Wechselfreudig (Ø {years}J)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1 border-emerald-500/50 text-emerald-600 bg-emerald-500/10">
            <CheckCircle2 className="h-3 w-3" />
            Stabil (Ø {years}J)
          </Badge>
        );
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <div className="w-2 h-2 rounded-full bg-red-500" />;
      case 'medium':
        return <div className="w-2 h-2 rounded-full bg-amber-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-blue-500" />;
    }
  };

  const getStrengthIcon = (strength: string) => {
    switch (strength) {
      case 'high':
        return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
      case 'medium':
        return <div className="w-2 h-2 rounded-full bg-green-500" />;
      default:
        return <div className="w-2 h-2 rounded-full bg-teal-500" />;
    }
  };

  const recStyle = getRecommendationStyle(summary.recommendation);
  const RecIcon = recStyle.icon;

  const highRisks = summary.risk_factors.filter(r => r.severity === 'high').length;
  const mediumRisks = summary.risk_factors.filter(r => r.severity === 'medium').length;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className={cn('border-b', recStyle.bg)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            KI-Einschätzung
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Score removed - V3.1 Match Engine is the single source of truth */}
            <Badge className={cn('gap-1', recStyle.bg, recStyle.text, 'border')}>
              <RecIcon className="h-3 w-3" />
              {recStyle.label}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Executive Summary */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm leading-relaxed">{summary.executive_summary}</p>
        </div>

        {/* Key Selling Points & Jobhopper Badge */}
        <div className="flex flex-wrap gap-2 items-center">
          {getJobHopperBadge()}
          {summary.key_selling_points.slice(0, 3).map((point, idx) => (
            <Badge key={idx} variant="outline" className="gap-1">
              <Target className="h-3 w-3" />
              {point}
            </Badge>
          ))}
        </div>

        {/* Change Motivation */}
        {summary.change_motivation_summary && (
          <div className="flex items-start gap-2 p-2 bg-blue-500/5 rounded-lg border border-blue-500/20">
            <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <span className="text-xs font-medium text-blue-600">Wechselmotivation</span>
              <p className="text-sm text-muted-foreground">{summary.change_motivation_summary}</p>
            </div>
          </div>
        )}

        {/* Risk Factors */}
        <Collapsible open={risksOpen} onOpenChange={setRisksOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 hover:bg-red-500/5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="font-medium">Risikofaktoren</span>
                {highRisks > 0 && (
                  <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                    {highRisks} hoch
                  </Badge>
                )}
                {mediumRisks > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-xs border-amber-500/50 text-amber-600">
                    {mediumRisks} mittel
                  </Badge>
                )}
              </div>
              <ChevronDown className={cn('h-4 w-4 transition-transform', risksOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {summary.risk_factors.map((risk, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-sm">
                {getSeverityIcon(risk.severity)}
                <div>
                  <span className="font-medium">{risk.factor}</span>
                  <p className="text-muted-foreground text-xs">{risk.detail}</p>
                </div>
              </div>
            ))}
            {summary.risk_factors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Keine Risikofaktoren identifiziert</p>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Positive Factors */}
        <Collapsible open={strengthsOpen} onOpenChange={setStrengthsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 hover:bg-emerald-500/5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">Stärken</span>
                <Badge variant="outline" className="h-5 px-1.5 text-xs border-emerald-500/50 text-emerald-600">
                  {summary.positive_factors.length}
                </Badge>
              </div>
              <ChevronDown className={cn('h-4 w-4 transition-transform', strengthsOpen && 'rotate-180')} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {summary.positive_factors.map((factor, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 bg-muted/30 rounded text-sm">
                {getStrengthIcon(factor.strength)}
                <div>
                  <span className="font-medium">{factor.factor}</span>
                  <p className="text-muted-foreground text-xs">{factor.detail}</p>
                </div>
              </div>
            ))}
            {summary.positive_factors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Keine Stärken identifiziert</p>
            )}
          </CollapsibleContent>
        </Collapsible>

      </CardContent>
    </Card>
  );
}

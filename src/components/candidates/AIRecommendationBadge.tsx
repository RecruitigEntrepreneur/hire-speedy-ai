import { useState, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, Copy, Check, AlertTriangle, Zap, Target, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMatchRecommendation, MatchRecommendation } from '@/hooks/useMatchRecommendation';
import { V31MatchResult } from '@/hooks/useMatchScoreV31';
import { toast } from 'sonner';

interface AIRecommendationBadgeProps {
  candidateId: string;
  jobId: string;
  matchResult?: V31MatchResult;
  compact?: boolean;
  autoLoad?: boolean;
  className?: string;
}

export function AIRecommendationBadge({
  candidateId,
  jobId,
  matchResult,
  compact = false,
  autoLoad = false,
  className,
}: AIRecommendationBadgeProps) {
  const { recommendation, loading, error, generateRecommendation, getCachedRecommendation, clearError } = useMatchRecommendation();
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Try to load cached recommendation on mount
  useEffect(() => {
    if (autoLoad && !hasLoaded) {
      getCachedRecommendation(candidateId, jobId).then((cached) => {
        setHasLoaded(true);
        if (!cached && autoLoad) {
          // No cache, generate new
          generateRecommendation(candidateId, jobId, matchResult);
        }
      });
    }
  }, [candidateId, jobId, autoLoad, hasLoaded, getCachedRecommendation, generateRecommendation, matchResult]);

  const handleGenerate = async () => {
    clearError();
    await generateRecommendation(candidateId, jobId, matchResult, true);
  };

  const handleCopyRecommendation = () => {
    if (!recommendation) return;
    
    const text = `${recommendation.recommendation_text}\n\n→ ${recommendation.action_recommendation}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Empfehlung kopiert');
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-700 border-green-200';
      case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getConfidenceLabel = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'Hohe Sicherheit';
      case 'medium': return 'Mittlere Sicherheit';
      case 'low': return 'Geringe Sicherheit';
      default: return confidence;
    }
  };

  // Not loaded yet state - show button to generate
  if (!hasLoaded && !loading && !recommendation) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setHasLoaded(true);
          generateRecommendation(candidateId, jobId, matchResult);
        }}
        className={cn("gap-2 text-xs", className)}
      >
        <Sparkles className="h-3 w-3" />
        AI-Empfehlung laden
      </Button>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-2 p-3 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
          <span className="text-xs text-violet-600 font-medium">AI analysiert...</span>
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn("p-3 rounded-lg bg-red-50 border border-red-100", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleGenerate} className="h-6 px-2">
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // No recommendation yet
  if (!recommendation) {
    return null;
  }

  // Compact mode - just show the recommendation text inline
  if (compact) {
    return (
      <div className={cn("group", className)}>
        <div className="flex items-start gap-2 p-2 rounded-lg bg-gradient-to-r from-violet-50/50 to-purple-50/50 border border-violet-100/50">
          <Sparkles className="h-3.5 w-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground leading-relaxed line-clamp-2">
              {recommendation.recommendation_text}
            </p>
            <p className="text-xs font-medium text-violet-600 mt-1">
              → {recommendation.action_recommendation}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full mode - expandable with all details
  return (
    <div className={cn(
      "rounded-lg border overflow-hidden transition-all duration-300",
      "bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100",
      className
    )}>
      {/* Header - always visible */}
      <div 
        className="p-3 cursor-pointer hover:bg-violet-100/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Sparkles className="h-4 w-4 text-violet-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">
                {recommendation.recommendation_text}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Zap className="h-3 w-3 text-violet-500" />
                <span className="text-xs font-medium text-violet-700">
                  {recommendation.action_recommendation}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", getConfidenceColor(recommendation.confidence))}>
              {getConfidenceLabel(recommendation.confidence)}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <div className={cn(
        "overflow-hidden transition-all duration-300",
        expanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-3 pb-3 space-y-3 border-t border-violet-100/50 pt-3">
          {/* Match Points */}
          {recommendation.key_match_points.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-700">Was passt</span>
              </div>
              <ul className="space-y-1">
                {recommendation.key_match_points.map((point, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-green-500 mt-1">✓</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risks */}
          {recommendation.key_risks.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Risiken</span>
              </div>
              <ul className="space-y-1">
                {recommendation.key_risks.map((risk, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-amber-500 mt-1">⚠</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negotiation Hints */}
          {recommendation.negotiation_hints.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Verhandlungstipps</span>
              </div>
              <ul className="space-y-1">
                {recommendation.negotiation_hints.map((hint, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-blue-500 mt-1">💡</span>
                    {hint}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-violet-100/50">
            <span className="text-[10px] text-muted-foreground">
              Generiert: {new Date(recommendation.generated_at).toLocaleDateString('de-DE', { 
                day: '2-digit', 
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyRecommendation();
                }}
                className="h-6 px-2 text-xs"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleGenerate();
                }}
                className="h-6 px-2 text-xs"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

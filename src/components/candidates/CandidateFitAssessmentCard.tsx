import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Brain,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Scale,
} from 'lucide-react';
import {
  useCandidateFitAssessment,
  type CandidateFitAssessment,
  type RequirementAssessment,
  type FitVerdict,
} from '@/hooks/useCandidateFitAssessment';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

// ============================================================================
// Config
// ============================================================================

function getVerdictConfig(verdict: FitVerdict) {
  switch (verdict) {
    case 'strong_fit':
      return { bg: 'bg-emerald-500/10', border: 'border-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', label: 'Passt sehr gut', icon: CheckCircle2 };
    case 'good_fit':
      return { bg: 'bg-green-500/10', border: 'border-green-500', text: 'text-green-700 dark:text-green-400', label: 'Passt gut', icon: CheckCircle2 };
    case 'partial_fit':
      return { bg: 'bg-amber-500/10', border: 'border-amber-500', text: 'text-amber-700 dark:text-amber-400', label: 'Passt teilweise', icon: AlertTriangle };
    case 'weak_fit':
      return { bg: 'bg-orange-500/10', border: 'border-orange-500', text: 'text-orange-700 dark:text-orange-400', label: 'Passt kaum', icon: XCircle };
    case 'no_fit':
      return { bg: 'bg-red-500/10', border: 'border-red-500', text: 'text-red-700 dark:text-red-400', label: 'Passt nicht', icon: XCircle };
  }
}

function getRequirementIcon(verdict: RequirementAssessment['verdict']) {
  switch (verdict) {
    case 'fulfilled':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    case 'partially_fulfilled':
    case 'inferred_from_experience':
      return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    case 'trainable':
      return <TrendingUp className="h-4 w-4 text-blue-500 shrink-0" />;
    case 'gap':
      return <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
  }
}

function getVerdictLabel(verdict: RequirementAssessment['verdict']) {
  switch (verdict) {
    case 'fulfilled': return 'Erfuellt';
    case 'partially_fulfilled': return 'Teilweise';
    case 'inferred_from_experience': return 'Abgeleitet';
    case 'trainable': return 'Trainierbar';
    case 'gap': return 'Luecke';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

function RequirementRow({ req }: { req: RequirementAssessment }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="mt-0.5">{getRequirementIcon(req.verdict)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium">{req.requirement}</span>
          {req.requirement_type === 'nice_to_have' && (
            <span className="text-[10px] text-muted-foreground">(Nice-to-have)</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{req.reasoning}</p>
        {req.evidence.length > 0 && req.verdict !== 'gap' && (
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">
            Evidence: {req.evidence.slice(0, 2).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface CandidateFitAssessmentCardProps {
  submissionId: string;
  recruiterNotes?: string | null;
  keySellingPoints?: string[];
  className?: string;
}

export function CandidateFitAssessmentCard({
  submissionId,
  recruiterNotes,
  keySellingPoints,
  className,
}: CandidateFitAssessmentCardProps) {
  const { assessment, loading, generating, generateAssessment } = useCandidateFitAssessment(submissionId);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // ── Loading ──
  if (loading || (!assessment && generating)) {
    return (
      <Card className={className}>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Intelligente Fit-Analyse</span>
            {generating && (
              <Badge variant="secondary" className="ml-auto gap-1 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Wird analysiert...
              </Badge>
            )}
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // ── No assessment — offer manual generation as fallback ──
  if (!assessment) {
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">Intelligente Fit-Analyse</span>
          </div>
          <p className="text-sm text-muted-foreground text-center py-3">
            Analyse wird vorbereitet oder steht noch aus.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => generateAssessment({ force: true })}
            disabled={generating}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : <Brain className="h-3.5 w-3.5 mr-2" />}
            Analyse jetzt starten
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Categorize requirements ──
  const fulfilled = assessment.requirement_assessments.filter(r => r.verdict === 'fulfilled');
  const partial = assessment.requirement_assessments.filter(r => r.verdict === 'partially_fulfilled' || r.verdict === 'inferred_from_experience');
  const trainable = assessment.requirement_assessments.filter(r => r.verdict === 'trainable');
  const gaps = assessment.requirement_assessments.filter(r => r.verdict === 'gap');
  const mustHaveGaps = gaps.filter(r => r.requirement_type === 'must_have');

  const verdictConfig = getVerdictConfig(assessment.overall_verdict);
  const VerdictIcon = verdictConfig.icon;

  const isFit = assessment.overall_verdict === 'strong_fit' || assessment.overall_verdict === 'good_fit';
  const isNoFit = assessment.overall_verdict === 'weak_fit' || assessment.overall_verdict === 'no_fit';
  const isPartial = assessment.overall_verdict === 'partial_fit';

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-0">
        {/* ── Verdict Header ── */}
        <div className={cn('p-5 border-b', verdictConfig.bg)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className={cn(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 shrink-0',
                verdictConfig.border, verdictConfig.text,
              )}>
                <VerdictIcon className="h-4 w-4" />
                <span className="text-sm font-bold">{verdictConfig.label}</span>
                <span className="text-sm font-bold">{assessment.overall_score}%</span>
              </div>
              {assessment.verdict_confidence !== 'high' && (
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {assessment.verdict_confidence === 'medium' ? 'Mittlere Sicherheit' : 'Geringe Datenbasis'}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => generateAssessment({ force: true })}
              disabled={generating}
              className="h-7 w-7 p-0 shrink-0"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* Executive Summary */}
          <p className="text-sm leading-relaxed mt-3">{assessment.executive_summary}</p>
        </div>

        {/* ── Recruiter Notes (if any) ── */}
        {(recruiterNotes || (keySellingPoints && keySellingPoints.length > 0)) && (
          <div className="px-5 py-3 border-b bg-muted/20">
            {recruiterNotes && (
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Recruiter:</span>
                <p className="text-sm text-muted-foreground">{recruiterNotes}</p>
              </div>
            )}
            {keySellingPoints && keySellingPoints.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keySellingPoints.map((point, idx) => (
                  <div key={idx} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 border text-[11px]">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Requirements Assessment (core section) ── */}
        <div className="p-5 space-y-4">
          {/* What fits */}
          {fulfilled.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Erfuellt ({fulfilled.length})
              </p>
              <div className="divide-y divide-border/50">
                {fulfilled.map((req, idx) => <RequirementRow key={idx} req={req} />)}
              </div>
            </div>
          )}

          {/* Partial / Inferred */}
          {partial.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Teilweise / Abgeleitet ({partial.length})
              </p>
              <div className="divide-y divide-border/50">
                {partial.map((req, idx) => <RequirementRow key={idx} req={req} />)}
              </div>
            </div>
          )}

          {/* Trainable */}
          {trainable.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                Trainierbar ({trainable.length})
              </p>
              <div className="divide-y divide-border/50">
                {trainable.map((req, idx) => <RequirementRow key={idx} req={req} />)}
              </div>
            </div>
          )}

          {/* Gaps */}
          {gaps.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                Luecken ({gaps.length})
                {mustHaveGaps.length > 0 && (
                  <Badge variant="destructive" className="text-[9px] h-4 px-1">{mustHaveGaps.length} Must-Have</Badge>
                )}
              </p>
              <div className="divide-y divide-border/50">
                {gaps.map((req, idx) => <RequirementRow key={idx} req={req} />)}
              </div>
            </div>
          )}

          {/* Rejection reasoning for no-fit */}
          {isNoFit && assessment.rejection_reasoning && (
            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-1">Begruendung</p>
              <p className="text-sm text-muted-foreground">{assessment.rejection_reasoning}</p>
            </div>
          )}
        </div>

        {/* ── Bonus Qualifications ── */}
        {assessment.bonus_qualifications.length > 0 && (
          <div className="px-5 pb-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
              Zusatzqualifikationen
            </p>
            <div className="space-y-1">
              {assessment.bonus_qualifications.slice(0, 3).map((bq, idx) => (
                <div key={idx} className="flex items-start gap-2 py-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{bq.qualification}</span>
                    <p className="text-xs text-muted-foreground">{bq.potential_value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Expandable Details ── */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <div className="border-t px-5 py-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs text-muted-foreground gap-1">
                {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? 'Weniger Details' : 'Mehr Details'}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-4">
              {/* Gap Analysis with trainability */}
              {assessment.gap_analysis.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Luecken-Analyse</p>
                  <div className="space-y-2">
                    {assessment.gap_analysis.map((gap, idx) => (
                      <div key={idx} className={cn(
                        'p-2.5 rounded-lg border',
                        gap.deal_breaker ? 'border-red-500/30 bg-red-500/5' : 'bg-muted/30',
                      )}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{gap.requirement}</span>
                          <Badge variant="outline" className={cn('text-[9px] h-4 px-1',
                            gap.gap_severity === 'critical' ? 'border-red-500/50 text-red-600' :
                            gap.gap_severity === 'significant' ? 'border-amber-500/50 text-amber-600' :
                            'border-muted-foreground/30',
                          )}>
                            {gap.gap_severity === 'critical' ? 'Kritisch' : gap.gap_severity === 'significant' ? 'Erheblich' : 'Gering'}
                          </Badge>
                          {gap.deal_breaker && <Badge variant="destructive" className="text-[9px] h-4 px-1">Dealbreaker</Badge>}
                        </div>
                        {gap.trainability_assessment && (
                          <p className="text-xs text-muted-foreground mt-1">{gap.trainability_assessment}</p>
                        )}
                        {gap.mitigation_suggestion && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">Mitigation: {gap.mitigation_suggestion}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Implicit Competencies */}
              {assessment.implicit_competencies.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Implizite Kompetenzen (aus Erfahrung abgeleitet)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {assessment.implicit_competencies.slice(0, 6).map((ic, idx) => (
                      <div key={idx} className="group relative">
                        <Badge variant="outline" className="text-[10px] font-normal cursor-help">
                          {ic.competency}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Career Trajectory */}
              {assessment.career_trajectory?.trajectory_summary && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Karriere-Trajektorie</p>
                  <p className="text-sm text-muted-foreground">{assessment.career_trajectory.trajectory_summary}</p>
                  {assessment.career_trajectory.career_stage_fit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Karrierestufe: {assessment.career_trajectory.career_stage_fit}
                    </p>
                  )}
                </div>
              )}

              {/* Motivation Fit */}
              {assessment.motivation_fit && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Motivation & Retention</p>
                  <p className="text-sm text-muted-foreground">{assessment.motivation_fit.alignment_summary}</p>
                  {assessment.motivation_fit.retention_prediction && (
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="text-muted-foreground">Retention:</span>
                      <Badge variant="outline" className={cn('text-[10px]',
                        assessment.motivation_fit.retention_prediction === 'high' ? 'text-emerald-600 border-emerald-500/50' :
                        assessment.motivation_fit.retention_prediction === 'medium' ? 'text-amber-600 border-amber-500/50' :
                        'text-red-600 border-red-500/50',
                      )}>
                        {assessment.motivation_fit.retention_prediction === 'high' ? 'Hoch' :
                         assessment.motivation_fit.retention_prediction === 'medium' ? 'Mittel' : 'Niedrig'}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              {/* Dimension Scores */}
              {assessment.dimension_scores && (
                <div>
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dimensionen</p>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { key: 'technical', label: 'Tech' },
                      { key: 'experience', label: 'Erf.' },
                      { key: 'leadership', label: 'Senior.' },
                      { key: 'cultural', label: 'Kultur' },
                      { key: 'growth_potential', label: 'Potenzial' },
                    ].map(({ key, label }) => {
                      const score = (assessment.dimension_scores as any)?.[key] as number | undefined;
                      if (score === undefined || score === 0) return null;
                      return (
                        <div key={key} className="text-center">
                          <div className={cn(
                            'text-lg font-bold',
                            score >= 75 ? 'text-emerald-600' : score >= 50 ? 'text-amber-600' : 'text-red-500',
                          )}>
                            {score}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Footer ── */}
        <div className="px-5 py-2.5 border-t bg-muted/20">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3 w-3" />
              <span>
                KI-Fit-Analyse
                {assessment.generated_at && ` · ${format(new Date(assessment.generated_at), 'dd.MM.yyyy', { locale: de })}`}
                {assessment.generation_time_ms && ` · ${(assessment.generation_time_ms / 1000).toFixed(1)}s`}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Scale className="h-3 w-3" />
              EU AI Act
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

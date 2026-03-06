/**
 * Fit Assessment Normalizer
 *
 * Central mapping layer that translates the Edge Function schema (Gemini output)
 * into the frontend display types. When the Edge Function schema changes,
 * only this file needs to be updated.
 *
 * Edge Function (Gemini) → Normalizer → Frontend Display Types
 */

import type {
  CandidateFitAssessment,
  RequirementAssessment,
  BonusQualification,
  GapItem,
  CareerTrajectory,
  ImplicitCompetency,
  MotivationFit,
  DimensionScores,
  FitVerdict,
  ConfidenceLevel,
} from '@/hooks/useCandidateFitAssessment';

// ============================================================================
// Edge Function (raw) types — what Gemini actually returns
// ============================================================================

interface RawRequirementAssessment {
  requirement: string;
  status: 'met' | 'partially_met' | 'not_met' | 'insufficient_data';
  evidence: string;
  score: number;
  // Optional fields that may come from newer versions
  requirement_type?: string;
  reasoning?: string;
  confidence?: string;
  verdict?: string; // If already normalized
}

interface RawBonusQualification {
  qualification: string;
  present: boolean;
  evidence: string;
  // Optional fields from newer versions
  relevance?: string;
  potential_value?: string;
}

interface RawGapItem {
  gap: string;
  severity: 'critical' | 'moderate' | 'minor';
  mitigation: string;
  // Optional fields from newer versions
  requirement?: string;
  gap_severity?: string;
  is_trainable?: boolean;
  trainability_assessment?: string;
  mitigation_suggestion?: string;
  deal_breaker?: boolean;
}

interface RawCareerTrajectory {
  direction: 'upward' | 'lateral' | 'pivoting' | 'unclear';
  consistency: 'high' | 'medium' | 'low';
  explanation: string;
  // Optional fields from newer versions
  trajectory_type?: string;
  trajectory_summary?: string;
  growth_velocity?: string;
  implied_competencies?: string[];
  career_stage_fit?: string;
}

interface RawImplicitCompetency {
  competency: string;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  // Optional fields from newer versions
  inferred_from?: string;
  relevance_to_role?: string;
}

interface RawMotivationFit {
  score: number;
  assessment: string;
  key_drivers?: string[];
  concerns?: string[];
  // Optional fields from newer versions
  alignment_score?: number;
  alignment_summary?: string;
  motivational_match_points?: string[];
  motivational_risk_points?: string[];
  retention_prediction?: string;
  retention_reasoning?: string;
}

interface RawDimensionScores {
  technical_fit?: number;
  experience_fit?: number;
  seniority_fit?: number;
  location_fit?: number;
  salary_fit?: number;
  culture_fit?: number;
  // Optional fields from newer versions (already normalized)
  technical?: number;
  experience?: number;
  leadership?: number;
  cultural?: number;
  growth_potential?: number;
}

// ============================================================================
// Mapping functions
// ============================================================================

function normalizeStatus(status: string): RequirementAssessment['verdict'] {
  switch (status) {
    case 'met':
    case 'fulfilled':
      return 'fulfilled';
    case 'partially_met':
    case 'partially_fulfilled':
      return 'partially_fulfilled';
    case 'inferred_from_experience':
      return 'inferred_from_experience';
    case 'trainable':
      return 'trainable';
    case 'not_met':
    case 'insufficient_data':
    case 'gap':
    default:
      return 'gap';
  }
}

function normalizeRequirementAssessments(raw: any[]): RequirementAssessment[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((r: any) => ({
    requirement: r.requirement || '',
    requirement_type: r.requirement_type || 'inferred',
    verdict: r.verdict ? r.verdict as RequirementAssessment['verdict'] : normalizeStatus(r.status || 'gap'),
    confidence: (r.confidence as ConfidenceLevel) || 'medium',
    evidence: Array.isArray(r.evidence)
      ? r.evidence
      : typeof r.evidence === 'string' && r.evidence
        ? [r.evidence]
        : [],
    evidence_source: r.evidence_source,
    reasoning: r.reasoning || (typeof r.evidence === 'string' ? r.evidence : ''),
    score: typeof r.score === 'number' ? r.score : 50,
  }));
}

function normalizeBonusQualifications(raw: any[]): BonusQualification[] {
  if (!Array.isArray(raw)) return [];

  // Filter: only show qualifications where present === true (or if 'present' field doesn't exist, include all)
  return raw
    .filter((bq: any) => bq.present === true || bq.present === undefined)
    .map((bq: any) => ({
      qualification: bq.qualification || '',
      relevance: (bq.relevance as BonusQualification['relevance']) || 'medium',
      evidence: typeof bq.evidence === 'string' ? bq.evidence : '',
      potential_value: bq.potential_value || bq.evidence || '',
    }));
}

function normalizeGapSeverity(severity: string): GapItem['gap_severity'] {
  switch (severity) {
    case 'critical':
      return 'critical';
    case 'moderate':
    case 'significant':
      return 'significant';
    case 'minor':
    default:
      return 'minor';
  }
}

function normalizeGapAnalysis(raw: any[]): GapItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((g: any) => ({
    requirement: g.requirement || g.gap || '',
    gap_severity: g.gap_severity
      ? g.gap_severity as GapItem['gap_severity']
      : normalizeGapSeverity(g.severity || 'minor'),
    is_trainable: g.is_trainable ?? false,
    trainability_assessment: g.trainability_assessment || '',
    mitigation_suggestion: g.mitigation_suggestion || g.mitigation || '',
    deal_breaker: g.deal_breaker ?? (g.severity === 'critical'),
  }));
}

function normalizeTrajectoryType(direction: string): CareerTrajectory['trajectory_type'] {
  switch (direction) {
    case 'upward':
    case 'ascending':
      return 'ascending';
    case 'lateral':
      return 'lateral';
    case 'pivoting':
      return 'pivoting';
    case 'specialist_deepening':
      return 'specialist_deepening';
    case 'declining':
      return 'declining';
    case 'unclear':
    case 'mixed':
    default:
      return 'mixed';
  }
}

function normalizeGrowthVelocity(consistency: string): CareerTrajectory['growth_velocity'] {
  switch (consistency) {
    case 'high':
    case 'fast':
      return 'fast';
    case 'low':
    case 'slow':
      return 'slow';
    case 'medium':
    case 'normal':
    default:
      return 'normal';
  }
}

function normalizeCareerTrajectory(raw: any): CareerTrajectory {
  if (!raw || typeof raw !== 'object') {
    return {
      trajectory_type: 'mixed',
      trajectory_summary: '',
      growth_velocity: 'normal',
      implied_competencies: [],
      career_stage_fit: '',
    };
  }

  return {
    trajectory_type: raw.trajectory_type
      ? raw.trajectory_type as CareerTrajectory['trajectory_type']
      : normalizeTrajectoryType(raw.direction || 'unclear'),
    trajectory_summary: raw.trajectory_summary || raw.explanation || '',
    growth_velocity: raw.growth_velocity
      ? raw.growth_velocity as CareerTrajectory['growth_velocity']
      : normalizeGrowthVelocity(raw.consistency || 'medium'),
    implied_competencies: raw.implied_competencies || [],
    career_stage_fit: raw.career_stage_fit || '',
  };
}

function normalizeImplicitCompetencies(raw: any[]): ImplicitCompetency[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((ic: any) => ({
    competency: ic.competency || '',
    inferred_from: ic.inferred_from || ic.evidence || '',
    confidence: (ic.confidence as ConfidenceLevel) || 'medium',
    relevance_to_role: ic.relevance_to_role || '',
  }));
}

function normalizeRetentionPrediction(score: number): MotivationFit['retention_prediction'] {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function normalizeMotivationFit(raw: any): MotivationFit | null {
  if (!raw || typeof raw !== 'object') return null;

  const alignmentScore = raw.alignment_score ?? raw.score ?? 0;

  return {
    alignment_score: alignmentScore,
    alignment_summary: raw.alignment_summary || raw.assessment || '',
    motivational_match_points: raw.motivational_match_points || raw.key_drivers || [],
    motivational_risk_points: raw.motivational_risk_points || raw.concerns || [],
    retention_prediction: raw.retention_prediction
      ? raw.retention_prediction as MotivationFit['retention_prediction']
      : normalizeRetentionPrediction(alignmentScore),
    retention_reasoning: raw.retention_reasoning || raw.assessment || '',
  };
}

function normalizeDimensionScores(raw: any): DimensionScores {
  if (!raw || typeof raw !== 'object') {
    return { technical: 0, experience: 0, leadership: 0, cultural: 0, growth_potential: 0 };
  }

  return {
    technical: raw.technical ?? raw.technical_fit ?? 0,
    experience: raw.experience ?? raw.experience_fit ?? 0,
    leadership: raw.leadership ?? raw.seniority_fit ?? 0,
    cultural: raw.cultural ?? raw.culture_fit ?? 0,
    growth_potential: raw.growth_potential ?? raw.location_fit ?? 0,
  };
}

// ============================================================================
// Main normalizer — takes raw DB row, returns display-ready assessment
// ============================================================================

export function normalizeAssessment(data: any): CandidateFitAssessment {
  return {
    id: data.id,
    submission_id: data.submission_id,
    candidate_id: data.candidate_id,
    job_id: data.job_id,
    overall_verdict: data.overall_verdict as FitVerdict,
    overall_score: data.overall_score ?? 0,
    executive_summary: data.executive_summary || '',
    verdict_confidence: (data.verdict_confidence as ConfidenceLevel) || 'medium',
    requirement_assessments: normalizeRequirementAssessments(data.requirement_assessments),
    bonus_qualifications: normalizeBonusQualifications(data.bonus_qualifications),
    gap_analysis: normalizeGapAnalysis(data.gap_analysis),
    career_trajectory: normalizeCareerTrajectory(data.career_trajectory),
    implicit_competencies: normalizeImplicitCompetencies(data.implicit_competencies),
    motivation_fit: normalizeMotivationFit(data.motivation_fit),
    dimension_scores: normalizeDimensionScores(data.dimension_scores),
    rejection_reasoning: data.rejection_reasoning || null,
    model_used: data.model_used || '',
    prompt_version: data.prompt_version || '',
    generation_time_ms: data.generation_time_ms || null,
    generated_at: data.generated_at || '',
    created_at: data.created_at || '',
  };
}

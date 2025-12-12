import { useMemo } from 'react';

interface CandidateData {
  skills?: string[] | null;
  experience_years?: number | null;
  expected_salary?: number | null;
  availability_date?: string | null;
  notice_period?: string | null;
  city?: string | null;
  cv_ai_summary?: string | null;
  cv_ai_bullets?: unknown[] | null;
}

interface ReadinessResult {
  isReady: boolean;
  score: number; // 0-100
  missingFields: string[];
  level: 'ready' | 'partial' | 'incomplete';
  badge: {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    color: string;
  };
}

export function useExposeReadiness(candidate: CandidateData | null): ReadinessResult {
  return useMemo(() => {
    if (!candidate) {
      return {
        isReady: false,
        score: 0,
        missingFields: ['Alle Daten fehlen'],
        level: 'incomplete',
        badge: { label: 'Unvollständig', variant: 'destructive', color: 'text-destructive' },
      };
    }

    const checks = [
      { field: 'Skills', valid: candidate.skills && candidate.skills.length >= 3 },
      { field: 'Erfahrung', valid: candidate.experience_years != null && candidate.experience_years > 0 },
      { field: 'Gehalt', valid: candidate.expected_salary != null && candidate.expected_salary > 0 },
      { field: 'Verfügbarkeit', valid: !!(candidate.availability_date || candidate.notice_period) },
      { field: 'Standort', valid: !!candidate.city },
      { field: 'CV Summary', valid: !!candidate.cv_ai_summary },
      { field: 'CV Highlights', valid: candidate.cv_ai_bullets && candidate.cv_ai_bullets.length > 0 },
    ];

    const validCount = checks.filter(c => c.valid).length;
    const score = Math.round((validCount / checks.length) * 100);
    const missingFields = checks.filter(c => !c.valid).map(c => c.field);

    if (score >= 85) {
      return {
        isReady: true,
        score,
        missingFields,
        level: 'ready',
        badge: { label: 'Exposé-Ready', variant: 'default', color: 'text-emerald-600' },
      };
    }

    if (score >= 50) {
      return {
        isReady: false,
        score,
        missingFields,
        level: 'partial',
        badge: { label: 'Teilweise', variant: 'secondary', color: 'text-amber-600' },
      };
    }

    return {
      isReady: false,
      score,
      missingFields,
      level: 'incomplete',
      badge: { label: 'Unvollständig', variant: 'outline', color: 'text-muted-foreground' },
    };
  }, [candidate]);
}

// Simple function version for non-hook usage
export function getExposeReadiness(candidate: CandidateData | null): ReadinessResult {
  if (!candidate) {
    return {
      isReady: false,
      score: 0,
      missingFields: ['Alle Daten fehlen'],
      level: 'incomplete',
      badge: { label: 'Unvollständig', variant: 'destructive', color: 'text-destructive' },
    };
  }

  const checks = [
    { field: 'Skills', valid: candidate.skills && candidate.skills.length >= 3 },
    { field: 'Erfahrung', valid: candidate.experience_years != null && candidate.experience_years > 0 },
    { field: 'Gehalt', valid: candidate.expected_salary != null && candidate.expected_salary > 0 },
    { field: 'Verfügbarkeit', valid: !!(candidate.availability_date || candidate.notice_period) },
    { field: 'Standort', valid: !!candidate.city },
    { field: 'CV Summary', valid: !!candidate.cv_ai_summary },
    { field: 'CV Highlights', valid: candidate.cv_ai_bullets && candidate.cv_ai_bullets.length > 0 },
  ];

  const validCount = checks.filter(c => c.valid).length;
  const score = Math.round((validCount / checks.length) * 100);
  const missingFields = checks.filter(c => !c.valid).map(c => c.field);

  if (score >= 85) {
    return {
      isReady: true,
      score,
      missingFields,
      level: 'ready',
      badge: { label: 'Exposé-Ready', variant: 'default', color: 'text-emerald-600' },
    };
  }

  if (score >= 50) {
    return {
      isReady: false,
      score,
      missingFields,
      level: 'partial',
      badge: { label: 'Teilweise', variant: 'secondary', color: 'text-amber-600' },
    };
  }

  return {
    isReady: false,
    score,
    missingFields,
    level: 'incomplete',
    badge: { label: 'Unvollständig', variant: 'outline', color: 'text-muted-foreground' },
  };
}

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MatchAnalysis {
  skillMatch: number;
  experienceMatch: number;
  salaryMatch: number;
  matchedSkills: string[];
  missingMustHaves: string[];
  overallAssessment: string;
  strengthPoints: string[];
  concernPoints: string[];
}

interface MatchResult {
  overallScore: number;
  analysis: MatchAnalysis;
  weights: {
    skills: number;
    experience: number;
    salary: number;
    location: number;
  };
}

export function useMatchScore() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateMatch = async (candidateId: string, jobId: string): Promise<MatchResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('calculate-match', {
        body: { candidateId, jobId },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return data as MatchResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der Berechnung';
      setError(errorMessage);
      console.error('Match calculation error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getMatchColor = (score: number): string => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-red-600';
  };

  const getMatchBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getMatchLabel = (score: number): string => {
    if (score >= 90) return 'Ausgezeichnet';
    if (score >= 80) return 'Sehr gut';
    if (score >= 70) return 'Gut';
    if (score >= 60) return 'Befriedigend';
    if (score >= 50) return 'Ausreichend';
    return 'Gering';
  };

  return {
    calculateMatch,
    getMatchColor,
    getMatchBadgeVariant,
    getMatchLabel,
    loading,
    error,
  };
}

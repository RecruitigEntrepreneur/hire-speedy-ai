import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FactorScore {
  score: number;
  weight: number;
  isBlocker: boolean;
  details: Record<string, unknown>;
  warning?: string;
  requiresConfirmation?: boolean;
  aiReasoning?: string;
}

interface BlockerInfo {
  factor: string;
  reason: string;
  severity: 'critical' | 'high';
}

interface WarningInfo {
  factor: string;
  message: string;
  severity: 'medium' | 'low';
  actionRequired?: boolean;
}

interface MatchResultV2 {
  overallScore: number;
  dealProbability: number;
  factors: {
    skills: FactorScore;
    experience: FactorScore;
    salary: FactorScore;
    commute: FactorScore;
    culture: FactorScore;
  };
  blockers: BlockerInfo[];
  warnings: WarningInfo[];
  recommendations: string[];
}

export function useMatchScoreV2() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateMatch = async (candidateId: string, jobId: string): Promise<MatchResultV2 | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('calculate-match-v2', {
        body: { candidateId, jobId },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      return data as MatchResultV2;
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
    if (score >= 40) return 'text-orange-600';
    return 'text-red-600';
  };

  const getMatchBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    if (score >= 40) return 'outline';
    return 'destructive';
  };

  const getMatchLabel = (score: number): string => {
    if (score >= 90) return 'Ausgezeichnet';
    if (score >= 80) return 'Sehr gut';
    if (score >= 70) return 'Gut';
    if (score >= 60) return 'Befriedigend';
    if (score >= 50) return 'Ausreichend';
    if (score >= 40) return 'Mäßig';
    return 'Gering';
  };

  const getDealProbabilityLabel = (probability: number): string => {
    if (probability >= 75) return 'Hohe Erfolgswahrscheinlichkeit';
    if (probability >= 50) return 'Gute Chancen';
    if (probability >= 30) return 'Unsichere Prognose';
    return 'Niedriges Placement-Potenzial';
  };

  return {
    calculateMatch,
    getMatchColor,
    getMatchBadgeVariant,
    getMatchLabel,
    getDealProbabilityLabel,
    loading,
    error,
  };
}

export type { MatchResultV2, FactorScore, BlockerInfo, WarningInfo };

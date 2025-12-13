import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type GateResult = 'pass' | 'warn' | 'fail';

export interface V3MatchResult {
  version: string;
  gates: {
    salary: GateResult;
    commute: GateResult;
    workAuth: GateResult;
    availability: GateResult;
    overallGate: GateResult;
  };
  fitScore: number;
  fitFactors: {
    skills: { score: number; matched: string[]; missing: string[]; transferable: string[] };
    experience: { score: number; years: number; levelMatch: boolean; gap: number };
    industry: { score: number; industries: string[] };
  };
  constraintScore: number;
  constraintFactors: {
    salary: { score: number; gap: number; negotiable: boolean };
    commute: { score: number; minutes: number; confirmed?: boolean };
    startDate: { score: number; daysUntil: number };
  };
  overallMatch: number;
  dealProbability: number;
  explainability: {
    topReasons: string[];
    topRisks: string[];
    nextAction: string;
    whyNot?: string;
  };
}

export interface NormalizedSkill {
  original: string;
  canonical: string;
  category: string | null;
  confidence: number;
  matchType: 'exact' | 'alias' | 'fuzzy' | 'ai';
}

export function useMatchScoreV3() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<V3MatchResult | null>(null);

  const calculateMatch = useCallback(async (
    candidateId: string,
    jobId: string,
    submissionId?: string
  ): Promise<V3MatchResult | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('calculate-match-v3', {
        body: { candidateId, jobId, submissionId }
      });

      if (fnError) throw fnError;

      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Fehler bei Match-Berechnung';
      setError(message);
      console.error('V3 Match error:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const normalizeSkills = useCallback(async (skills: string[]): Promise<NormalizedSkill[]> => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('normalize-skills', {
        body: { skills }
      });

      if (fnError) throw fnError;
      return data?.normalized || [];
    } catch (err) {
      console.error('Skill normalization error:', err);
      return skills.map(s => ({
        original: s,
        canonical: s,
        category: null,
        confidence: 20,
        matchType: 'fuzzy' as const
      }));
    }
  }, []);

  const trackOutcome = useCallback(async (
    submissionId: string,
    outcome: 'hired' | 'rejected' | 'withdrew' | 'expired',
    stage: string,
    rejectionReason?: string,
    rejectionCategory?: 'skills' | 'experience' | 'salary' | 'culture' | 'availability' | 'other'
  ): Promise<boolean> => {
    try {
      const { error: fnError } = await supabase.functions.invoke('track-match-outcome', {
        body: { submissionId, outcome, stage, rejectionReason, rejectionCategory }
      });

      if (fnError) throw fnError;
      return true;
    } catch (err) {
      console.error('Track outcome error:', err);
      return false;
    }
  }, []);

  const getCalibrationStats = useCallback(async (version = 'v3') => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('track-match-outcome?action=calibrate', {
        body: {}
      });

      if (fnError) throw fnError;
      return data;
    } catch (err) {
      console.error('Calibration stats error:', err);
      return null;
    }
  }, []);

  // Helper functions
  const getGateColor = (gate: GateResult) => {
    switch (gate) {
      case 'pass': return 'text-green-600';
      case 'warn': return 'text-amber-600';
      case 'fail': return 'text-red-600';
    }
  };

  const getGateBgColor = (gate: GateResult) => {
    switch (gate) {
      case 'pass': return 'bg-green-100';
      case 'warn': return 'bg-amber-100';
      case 'fail': return 'bg-red-100';
    }
  };

  const getGateLabel = (gate: GateResult) => {
    switch (gate) {
      case 'pass': return 'OK';
      case 'warn': return 'Prüfen';
      case 'fail': return 'Kritisch';
    }
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Sehr gut';
    if (score >= 70) return 'Gut';
    if (score >= 50) return 'Mittel';
    if (score >= 30) return 'Schwach';
    return 'Unpassend';
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-green-500';
    if (score >= 50) return 'text-amber-500';
    if (score >= 30) return 'text-orange-500';
    return 'text-red-500';
  };

  return {
    loading,
    error,
    result,
    calculateMatch,
    normalizeSkills,
    trackOutcome,
    getCalibrationStats,
    // Helpers
    getGateColor,
    getGateBgColor,
    getGateLabel,
    getScoreLabel,
    getScoreColor
  };
}

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { V31MatchResult } from './useMatchScoreV31';

export interface MatchRecommendation {
  id?: string;
  candidate_id: string;
  job_id: string;
  match_score: number | null;
  recommendation_text: string;
  action_recommendation: string;
  confidence: 'high' | 'medium' | 'low';
  key_match_points: string[];
  key_risks: string[];
  negotiation_hints: string[];
  generated_at: string;
  model_version?: string;
}

interface UseMatchRecommendationReturn {
  recommendation: MatchRecommendation | null;
  loading: boolean;
  error: string | null;
  generateRecommendation: (
    candidateId: string,
    jobId: string,
    matchResult?: V31MatchResult,
    forceRefresh?: boolean
  ) => Promise<MatchRecommendation | null>;
  getCachedRecommendation: (candidateId: string, jobId: string) => Promise<MatchRecommendation | null>;
  clearError: () => void;
}

// Cache for prefetched recommendations
const recommendationCache = new Map<string, MatchRecommendation>();

export function useMatchRecommendation(): UseMatchRecommendationReturn {
  const [recommendation, setRecommendation] = useState<MatchRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCacheKey = (candidateId: string, jobId: string) => `${candidateId}-${jobId}`;

  /**
   * Get cached recommendation from local cache or database
   */
  const getCachedRecommendation = useCallback(async (
    candidateId: string,
    jobId: string
  ): Promise<MatchRecommendation | null> => {
    const cacheKey = getCacheKey(candidateId, jobId);
    
    // Check local cache first
    if (recommendationCache.has(cacheKey)) {
      const cached = recommendationCache.get(cacheKey)!;
      setRecommendation(cached);
      return cached;
    }

    // Check database cache
    try {
      const { data, error: fetchError } = await supabase
        .from('match_recommendations')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('job_id', jobId)
        .single();

      if (fetchError || !data) {
        return null;
      }

      const rec: MatchRecommendation = {
        id: data.id,
        candidate_id: data.candidate_id,
        job_id: data.job_id,
        match_score: data.match_score,
        recommendation_text: data.recommendation_text,
        action_recommendation: data.action_recommendation,
        confidence: data.confidence as 'high' | 'medium' | 'low',
        key_match_points: (data.key_match_points as string[]) || [],
        key_risks: (data.key_risks as string[]) || [],
        negotiation_hints: (data.negotiation_hints as string[]) || [],
        generated_at: data.generated_at,
        model_version: data.model_version,
      };

      // Update local cache
      recommendationCache.set(cacheKey, rec);
      setRecommendation(rec);
      return rec;
    } catch (err) {
      console.error('Error fetching cached recommendation:', err);
      return null;
    }
  }, []);

  /**
   * Generate a new AI recommendation (or get from cache)
   */
  const generateRecommendation = useCallback(async (
    candidateId: string,
    jobId: string,
    matchResult?: V31MatchResult,
    forceRefresh: boolean = false
  ): Promise<MatchRecommendation | null> => {
    const cacheKey = getCacheKey(candidateId, jobId);

    // Check local cache first (unless forcing refresh)
    if (!forceRefresh && recommendationCache.has(cacheKey)) {
      const cached = recommendationCache.get(cacheKey)!;
      setRecommendation(cached);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-match-recommendation', {
        body: {
          candidateId,
          jobId,
          matchResult: matchResult ? {
            overall: matchResult.overall,
            fit: matchResult.fit,
            constraints: matchResult.constraints,
            explainability: matchResult.explainability,
          } : undefined,
          forceRefresh,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const rec: MatchRecommendation = {
        id: data.recommendation.id,
        candidate_id: data.recommendation.candidate_id,
        job_id: data.recommendation.job_id,
        match_score: data.recommendation.match_score,
        recommendation_text: data.recommendation.recommendation_text,
        action_recommendation: data.recommendation.action_recommendation,
        confidence: data.recommendation.confidence,
        key_match_points: data.recommendation.key_match_points || [],
        key_risks: data.recommendation.key_risks || [],
        negotiation_hints: data.recommendation.negotiation_hints || [],
        generated_at: data.recommendation.generated_at,
        model_version: data.recommendation.model_version,
      };

      // Update local cache
      recommendationCache.set(cacheKey, rec);
      setRecommendation(rec);
      return rec;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der Empfehlungs-Generierung';
      setError(errorMessage);
      console.error('Error generating recommendation:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    recommendation,
    loading,
    error,
    generateRecommendation,
    getCachedRecommendation,
    clearError,
  };
}

/**
 * Prefetch recommendations for multiple jobs (called on hover)
 */
export async function prefetchRecommendations(
  candidateId: string,
  jobIds: string[]
): Promise<void> {
  try {
    const { data } = await supabase
      .from('match_recommendations')
      .select('*')
      .eq('candidate_id', candidateId)
      .in('job_id', jobIds);

    if (data) {
      data.forEach((rec) => {
        const cacheKey = `${rec.candidate_id}-${rec.job_id}`;
        recommendationCache.set(cacheKey, {
          id: rec.id,
          candidate_id: rec.candidate_id,
          job_id: rec.job_id,
          match_score: rec.match_score,
          recommendation_text: rec.recommendation_text,
          action_recommendation: rec.action_recommendation,
          confidence: rec.confidence as 'high' | 'medium' | 'low',
          key_match_points: (rec.key_match_points as string[]) || [],
          key_risks: (rec.key_risks as string[]) || [],
          negotiation_hints: (rec.negotiation_hints as string[]) || [],
          generated_at: rec.generated_at,
          model_version: rec.model_version,
        });
      });
    }
  } catch (err) {
    console.error('Error prefetching recommendations:', err);
  }
}

/**
 * Clear recommendation from cache (e.g., when candidate is updated)
 */
export function invalidateRecommendationCache(candidateId: string, jobId?: string): void {
  if (jobId) {
    recommendationCache.delete(`${candidateId}-${jobId}`);
  } else {
    // Clear all recommendations for this candidate
    for (const key of recommendationCache.keys()) {
      if (key.startsWith(candidateId)) {
        recommendationCache.delete(key);
      }
    }
  }
}

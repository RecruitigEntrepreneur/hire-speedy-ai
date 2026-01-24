import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export type PolicyTier = 'hot' | 'standard' | 'maybe' | 'hidden';

// Enhanced reason with categorization (Phase 5)
export interface EnhancedReason {
  text: string;
  impact: 'high' | 'medium' | 'low';
  category: 'skills' | 'experience' | 'salary' | 'availability' | 'location' | 'domain';
}

// Enhanced risk with mitigation (Phase 5)
export interface EnhancedRisk {
  text: string;
  severity: 'critical' | 'warning' | 'info';
  mitigatable: boolean;
  mitigation?: string;
  category: 'skills' | 'salary' | 'timing' | 'seniority' | 'domain';
}

// Recruiter action recommendation (Phase 5)
export interface RecruiterAction {
  recommendation: 'proceed' | 'review' | 'skip';
  priority: 'high' | 'medium' | 'low';
  nextSteps: string[];
  talkingPoints?: string[];
}

export interface V31MatchResult {
  version: string;
  jobId: string;
  overall: number;
  killed: boolean;
  excluded: boolean;
  mustHaveCoverage: number;
  gateMultiplier: number;
  policy: PolicyTier;
  gates: {
    hardKills: {
      visa: boolean;
      language: boolean;
      onsite: boolean;
      license: boolean;
      techDomain: boolean;
    };
    dealbreakers: {
      salary: number;
      startDate: number;
      seniority: number;
      workModel: number;
      techDomain: number;
    };
    multiplier: number;
    domainMismatch?: {
      candidateDomain: string;
      jobDomain: string;
      isIncompatible: boolean;
    };
  };
  fit: {
    score: number;
    breakdown: {
      skills: number;
      experience: number;
      seniority: number;
      industry: number;
    };
    details: {
      skills: {
        matched: string[];
        transferable: string[];
        missing: string[];
        mustHaveMissing: string[];
      };
    };
  };
  constraints: {
    score: number;
    breakdown: {
      salary: number;
      commute: number;
      startDate: number;
    };
  };
  explainability: {
    topReasons: string[];
    topRisks: string[];
    whyNot?: string;
    nextAction: string;
    // Enhanced fields (Phase 5)
    enhancedReasons?: EnhancedReason[];
    enhancedRisks?: EnhancedRisk[];
    recruiterAction?: RecruiterAction;
  };
}

export interface BatchMatchResponse {
  results: V31MatchResult[];
  candidateId: string;
  mode: string;
  configProfile: string;
}

// ============================================
// HOOK
// ============================================

export function useMatchScoreV31() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<V31MatchResult[]>([]);

  /**
   * Calculate match scores for a candidate against multiple jobs (batch)
   */
  const calculateBatchMatch = useCallback(async (
    candidateId: string,
    jobIds: string[],
    mode: 'preview' | 'strict' | 'admin' = 'strict',
    configProfile: 'tech' | 'finance' | 'sales' | 'default' = 'default'
  ): Promise<V31MatchResult[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('calculate-match-v3-1', {
        body: { candidateId, jobIds, mode, configProfile },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      const response = data as BatchMatchResponse;
      setResults(response.results);
      return response.results;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der Berechnung';
      setError(errorMessage);
      console.error('V3.1 Match calculation error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calculate match for a single candidate-job pair
   */
  const calculateSingleMatch = useCallback(async (
    candidateId: string,
    jobId: string,
    mode: 'preview' | 'strict' | 'admin' = 'strict'
  ): Promise<V31MatchResult | null> => {
    const results = await calculateBatchMatch(candidateId, [jobId], mode);
    return results[0] || null;
  }, [calculateBatchMatch]);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const getPolicyColor = (policy: PolicyTier): string => {
    switch (policy) {
      case 'hot': return 'text-green-600';
      case 'standard': return 'text-blue-600';
      case 'maybe': return 'text-amber-600';
      case 'hidden': return 'text-red-600';
    }
  };

  const getPolicyBgColor = (policy: PolicyTier): string => {
    switch (policy) {
      case 'hot': return 'bg-green-100';
      case 'standard': return 'bg-blue-100';
      case 'maybe': return 'bg-amber-100';
      case 'hidden': return 'bg-red-100';
    }
  };

  const getPolicyLabel = (policy: PolicyTier): string => {
    switch (policy) {
      case 'hot': return 'Hot Match';
      case 'standard': return 'Standard';
      case 'maybe': return 'Vielleicht';
      case 'hidden': return 'Ausgeschlossen';
    }
  };

  const getPolicyIcon = (policy: PolicyTier): string => {
    switch (policy) {
      case 'hot': return '🔥';
      case 'standard': return '✓';
      case 'maybe': return '?';
      case 'hidden': return '✗';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 85) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 65) return 'text-amber-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number): string => {
    if (score >= 85) return 'bg-green-100';
    if (score >= 75) return 'bg-blue-100';
    if (score >= 65) return 'bg-amber-100';
    if (score >= 50) return 'bg-orange-100';
    return 'bg-red-100';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Ausgezeichnet';
    if (score >= 85) return 'Sehr gut';
    if (score >= 75) return 'Gut';
    if (score >= 65) return 'Befriedigend';
    if (score >= 50) return 'Ausreichend';
    return 'Gering';
  };

  const getCoverageLabel = (coverage: number): string => {
    const percent = Math.round(coverage * 100);
    if (percent >= 85) return 'Vollständig';
    if (percent >= 70) return 'Ausreichend';
    if (percent >= 50) return 'Teilweise';
    return 'Unzureichend';
  };

  const getCoverageColor = (coverage: number): string => {
    if (coverage >= 0.85) return 'text-green-600';
    if (coverage >= 0.70) return 'text-blue-600';
    if (coverage >= 0.50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getMultiplierLabel = (multiplier: number): string => {
    if (multiplier >= 0.95) return 'Keine Einschränkungen';
    if (multiplier >= 0.7) return 'Leichte Einschränkungen';
    if (multiplier >= 0.4) return 'Deutliche Einschränkungen';
    return 'Schwere Einschränkungen';
  };

  const getMultiplierColor = (multiplier: number): string => {
    if (multiplier >= 0.95) return 'text-green-600';
    if (multiplier >= 0.7) return 'text-amber-600';
    if (multiplier >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  /**
   * Filter results by policy tier
   */
  const filterByPolicy = useCallback((
    results: V31MatchResult[],
    allowedPolicies: PolicyTier[]
  ): V31MatchResult[] => {
    return results.filter(r => allowedPolicies.includes(r.policy));
  }, []);

  /**
   * Get hot matches only
   */
  const getHotMatches = useCallback((results: V31MatchResult[]): V31MatchResult[] => {
    return filterByPolicy(results, ['hot']);
  }, [filterByPolicy]);

  /**
   * Get standard and hot matches
   */
  const getStandardMatches = useCallback((results: V31MatchResult[]): V31MatchResult[] => {
    return filterByPolicy(results, ['hot', 'standard']);
  }, [filterByPolicy]);

  /**
   * Get all visible matches (includes maybe for admin)
   */
  const getVisibleMatches = useCallback((
    results: V31MatchResult[],
    isAdmin: boolean = false
  ): V31MatchResult[] => {
    const policies: PolicyTier[] = isAdmin 
      ? ['hot', 'standard', 'maybe'] 
      : ['hot', 'standard'];
    return filterByPolicy(results, policies);
  }, [filterByPolicy]);

  /**
   * Sort results by score (descending) and policy tier
   */
  const sortByRelevance = useCallback((results: V31MatchResult[]): V31MatchResult[] => {
    const policyOrder: Record<PolicyTier, number> = {
      'hot': 0,
      'standard': 1,
      'maybe': 2,
      'hidden': 3
    };
    
    return [...results].sort((a, b) => {
      // First by policy tier
      const policyDiff = policyOrder[a.policy] - policyOrder[b.policy];
      if (policyDiff !== 0) return policyDiff;
      
      // Then by overall score
      return b.overall - a.overall;
    });
  }, []);

  return {
    // State
    loading,
    error,
    results,
    
    // Core functions
    calculateBatchMatch,
    calculateSingleMatch,
    
    // Filtering
    filterByPolicy,
    getHotMatches,
    getStandardMatches,
    getVisibleMatches,
    sortByRelevance,
    
    // Policy utilities
    getPolicyColor,
    getPolicyBgColor,
    getPolicyLabel,
    getPolicyIcon,
    
    // Score utilities
    getScoreColor,
    getScoreBgColor,
    getScoreLabel,
    
    // Coverage utilities
    getCoverageLabel,
    getCoverageColor,
    
    // Multiplier utilities
    getMultiplierLabel,
    getMultiplierColor,
  };
}

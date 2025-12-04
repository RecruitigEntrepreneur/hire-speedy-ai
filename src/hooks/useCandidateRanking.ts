import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CandidateRanking {
  submission_id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  full_name: string;
  match_score: number | null;
  confidence_score: number | null;
  interview_readiness_score: number | null;
  closing_probability: number | null;
  engagement_level: string | null;
  overall_rank_score: number;
  rank_position: number;
}

export function useCandidateRanking(jobId?: string) {
  const [rankings, setRankings] = useState<CandidateRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Query the candidate_rankings view
      const { data, error: fetchError } = await supabase
        .from('candidate_rankings')
        .select('*')
        .eq('job_id', jobId)
        .order('rank_position', { ascending: true });

      if (fetchError) throw fetchError;

      setRankings((data as CandidateRanking[]) || []);
    } catch (err) {
      console.error('Error fetching rankings:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Rankings');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const getTopCandidates = (count: number = 5) => {
    return rankings.slice(0, count);
  };

  const getCandidateRank = (submissionId: string) => {
    return rankings.find(r => r.submission_id === submissionId);
  };

  return {
    rankings,
    loading,
    error,
    refetch: fetchRankings,
    getTopCandidates,
    getCandidateRank,
  };
}

export function useCandidateRankings(jobIds: string[]) {
  const [rankingsByJob, setRankingsByJob] = useState<Record<string, CandidateRanking[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (jobIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchAllRankings = async () => {
      try {
        const { data, error } = await supabase
          .from('candidate_rankings')
          .select('*')
          .in('job_id', jobIds)
          .order('rank_position', { ascending: true });

        if (error) throw error;

        // Group by job_id
        const grouped: Record<string, CandidateRanking[]> = {};
        (data as CandidateRanking[] || []).forEach(ranking => {
          if (!grouped[ranking.job_id]) {
            grouped[ranking.job_id] = [];
          }
          grouped[ranking.job_id].push(ranking);
        });

        setRankingsByJob(grouped);
      } catch (err) {
        console.error('Error fetching rankings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllRankings();
  }, [jobIds.join(',')]);

  return { rankingsByJob, loading };
}

export function useSubmissionRank(submissionId?: string) {
  const [rank, setRank] = useState<CandidateRanking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    const fetchRank = async () => {
      try {
        const { data, error } = await supabase
          .from('candidate_rankings')
          .select('*')
          .eq('submission_id', submissionId)
          .maybeSingle();

        if (error) throw error;
        setRank(data as CandidateRanking | null);
      } catch (err) {
        console.error('Error fetching submission rank:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRank();
  }, [submissionId]);

  return { rank, loading };
}

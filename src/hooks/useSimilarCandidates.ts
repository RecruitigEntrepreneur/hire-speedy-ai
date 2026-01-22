import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SimilarCandidate {
  id: string;
  full_name: string;
  job_title: string | null;
  skills: string[] | null;
  city: string | null;
  similarity: number;
}

export function useSimilarCandidates(candidateId: string | null, limit: number = 5) {
  return useQuery({
    queryKey: ['similar-candidates', candidateId, limit],
    queryFn: async (): Promise<SimilarCandidate[]> => {
      if (!candidateId) return [];
      
      // First, get the source candidate's embedding
      const { data: sourceCandidate, error: sourceError } = await supabase
        .from('candidates')
        .select('embedding')
        .eq('id', candidateId)
        .single();
      
      if (sourceError || !sourceCandidate?.embedding) {
        console.log('No embedding found for candidate:', candidateId);
        return [];
      }
      
      // Use the RPC function to find similar candidates
      const { data, error } = await supabase.rpc('find_similar_candidates', {
        source_embedding: sourceCandidate.embedding,
        exclude_id: candidateId,
        limit_count: limit
      });
      
      if (error) {
        console.error('Error finding similar candidates:', error);
        return [];
      }
      
      return (data || []) as SimilarCandidate[];
    },
    enabled: !!candidateId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useHybridCandidateSearch(
  jobId: string | null,
  options?: {
    keywordSkills?: string[];
    salaryMax?: number;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: ['hybrid-candidate-search', jobId, options],
    queryFn: async () => {
      if (!jobId) return [];
      
      // Get job's embedding
      const { data: job, error: jobError } = await supabase
        .from('jobs')
        .select('embedding, must_haves')
        .eq('id', jobId)
        .single();
      
      if (jobError || !job?.embedding) {
        console.log('No embedding found for job:', jobId);
        return [];
      }
      
      // Use hybrid search
      const { data, error } = await supabase.rpc('search_candidates_hybrid', {
        query_embedding: job.embedding,
        keyword_skills: options?.keywordSkills || job.must_haves || [],
        salary_max: options?.salaryMax || null,
        limit_count: options?.limit || 20
      });
      
      if (error) {
        console.error('Error in hybrid search:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!jobId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

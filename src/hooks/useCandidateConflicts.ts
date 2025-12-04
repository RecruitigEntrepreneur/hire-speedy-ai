import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CandidateConflict {
  id: string;
  candidate_id: string;
  conflict_type: string;
  severity: string;
  resolved: boolean;
  resolution_notes: string | null;
  submission_a_id: string;
  submission_b_id: string;
  created_at: string;
}

export function useCandidateConflicts(candidateId: string) {
  return useQuery({
    queryKey: ['candidate-conflicts', candidateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_conflicts')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CandidateConflict[];
    },
    enabled: !!candidateId
  });
}

export function useResolveConflict() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ conflictId, resolutionNotes }: { conflictId: string; resolutionNotes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('candidate_conflicts')
        .update({ 
          resolved: true, 
          resolution_notes: resolutionNotes || 'Marked as resolved',
          resolved_by: user?.id
        })
        .eq('id', conflictId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-conflicts'] });
      toast.success('Konflikt als gelöst markiert');
    },
    onError: (error: any) => {
      toast.error('Fehler: ' + error.message);
    }
  });
}

export function useDetectConflicts() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ candidateId, submissionId }: { candidateId: string; submissionId: string }) => {
      const { data, error } = await supabase.functions.invoke('detect-candidate-conflicts', {
        body: { candidate_id: candidateId, submission_id: submissionId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['candidate-conflicts'] });
      if (data?.conflicts_found > 0) {
        toast.warning(`${data.conflicts_found} potenzielle Konflikte gefunden`);
      }
    },
    onError: (error: any) => {
      console.error('Error detecting conflicts:', error);
    }
  });
}

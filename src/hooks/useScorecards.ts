import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ScorecardCriterion {
  id: string;
  name: string;
  description?: string;
  weight: number;
  category: 'technical' | 'soft_skills' | 'experience' | 'culture';
}

export interface JobScorecard {
  id: string;
  job_id: string;
  name: string;
  description?: string;
  criteria: ScorecardCriterion[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScorecardScore {
  criterion_id: string;
  score: number;
  notes?: string;
}

export interface ScorecardEvaluation {
  id: string;
  interview_id: string;
  scorecard_id: string;
  evaluator_id: string;
  scores: ScorecardScore[];
  total_score: number;
  notes?: string;
  created_at: string;
}

export function useScorecards(jobId?: string) {
  const queryClient = useQueryClient();

  const { data: scorecards, isLoading } = useQuery({
    queryKey: ['scorecards', jobId],
    queryFn: async () => {
      if (!jobId) return [];

      const { data, error } = await supabase
        .from('job_scorecards')
        .select('*')
        .eq('job_id', jobId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      
      return data.map(sc => ({
        ...sc,
        criteria: (sc.criteria as unknown as ScorecardCriterion[]) || [],
      })) as JobScorecard[];
    },
    enabled: !!jobId,
  });

  const createScorecard = useMutation({
    mutationFn: async ({ 
      jobId, 
      name, 
      description, 
      criteria,
      isDefault = false,
    }: { 
      jobId: string; 
      name: string; 
      description?: string; 
      criteria: ScorecardCriterion[];
      isDefault?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('job_scorecards')
        .insert([{
          job_id: jobId,
          name,
          description,
          criteria: criteria as unknown as Record<string, unknown>[],
          is_default: isDefault,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecards'] });
      toast.success('Scorecard erstellt');
    },
    onError: (error) => {
      toast.error('Fehler beim Erstellen der Scorecard');
      console.error(error);
    },
  });

  const updateScorecard = useMutation({
    mutationFn: async ({ 
      id, 
      name, 
      description, 
      criteria,
      isDefault,
    }: { 
      id: string; 
      name?: string; 
      description?: string; 
      criteria?: ScorecardCriterion[];
      isDefault?: boolean;
    }) => {
      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (criteria !== undefined) updates.criteria = criteria as unknown as Record<string, unknown>[];
      if (isDefault !== undefined) updates.is_default = isDefault;

      const { data, error } = await supabase
        .from('job_scorecards')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecards'] });
      toast.success('Scorecard aktualisiert');
    },
    onError: (error) => {
      toast.error('Fehler beim Aktualisieren der Scorecard');
      console.error(error);
    },
  });

  const deleteScorecard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('job_scorecards')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecards'] });
      toast.success('Scorecard gelöscht');
    },
    onError: (error) => {
      toast.error('Fehler beim Löschen der Scorecard');
      console.error(error);
    },
  });

  return {
    scorecards,
    isLoading,
    createScorecard,
    updateScorecard,
    deleteScorecard,
  };
}

export function useScorecardEvaluations(interviewId?: string) {
  const queryClient = useQueryClient();

  const { data: evaluations, isLoading } = useQuery({
    queryKey: ['scorecard-evaluations', interviewId],
    queryFn: async () => {
      if (!interviewId) return [];

      const { data, error } = await supabase
        .from('scorecard_evaluations')
        .select('*')
        .eq('interview_id', interviewId);

      if (error) throw error;

      return data.map(ev => ({
        ...ev,
        scores: (ev.scores as unknown as ScorecardScore[]) || [],
        total_score: Number(ev.total_score) || 0,
      })) as ScorecardEvaluation[];
    },
    enabled: !!interviewId,
  });

  const submitEvaluation = useMutation({
    mutationFn: async ({ 
      interviewId, 
      scorecardId, 
      scores,
      notes,
    }: { 
      interviewId: string; 
      scorecardId: string; 
      scores: ScorecardScore[];
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Calculate weighted total score
      const totalScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length * 20;

      const { data, error } = await supabase
        .from('scorecard_evaluations')
        .upsert([{
          interview_id: interviewId,
          scorecard_id: scorecardId,
          evaluator_id: user.id,
          scores: scores as unknown as Record<string, unknown>[],
          total_score: totalScore,
          notes,
        }], {
          onConflict: 'interview_id,scorecard_id,evaluator_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scorecard-evaluations'] });
      toast.success('Bewertung gespeichert');
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern der Bewertung');
      console.error(error);
    },
  });

  return {
    evaluations,
    isLoading,
    submitEvaluation,
  };
}

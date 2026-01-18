import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface FeedbackData {
  technical_skills?: number;
  communication?: number;
  culture_fit?: number;
  motivation?: number;
  problem_solving?: number;
  overall_rating?: number;
  pros?: string[];
  cons?: string[];
  recommendation?: 'hire' | 'next_round' | 'reject' | 'undecided';
  notes?: string;
}

export interface InterviewFeedback extends FeedbackData {
  id: string;
  interview_id: string;
  evaluator_id: string;
  created_at: string;
  updated_at: string;
}

export function useInterviewFeedback(interviewId?: string) {
  const queryClient = useQueryClient();

  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ['interview-feedback', interviewId],
    queryFn: async () => {
      if (!interviewId) return [];
      
      const { data, error } = await supabase
        .from('interview_feedback')
        .select('*')
        .eq('interview_id', interviewId);
      
      if (error) throw error;
      return data as InterviewFeedback[];
    },
    enabled: !!interviewId,
  });

  const { data: myFeedback } = useQuery({
    queryKey: ['my-interview-feedback', interviewId],
    queryFn: async () => {
      if (!interviewId) return null;
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('interview_feedback')
        .select('*')
        .eq('interview_id', interviewId)
        .eq('evaluator_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as InterviewFeedback | null;
    },
    enabled: !!interviewId,
  });

  const submitFeedback = useMutation({
    mutationFn: async ({ interviewId, feedback }: { interviewId: string; feedback: FeedbackData }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('interview_feedback')
        .upsert({
          interview_id: interviewId,
          evaluator_id: user.id,
          ...feedback,
        }, {
          onConflict: 'interview_id,evaluator_id',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-feedback'] });
      queryClient.invalidateQueries({ queryKey: ['my-interview-feedback'] });
      toast.success('Feedback gespeichert');
    },
    onError: (error) => {
      toast.error('Fehler beim Speichern des Feedbacks');
      console.error(error);
    },
  });

  const getAverageScores = () => {
    if (!feedbacks || feedbacks.length === 0) return null;

    const categories = ['technical_skills', 'communication', 'culture_fit', 'motivation', 'problem_solving', 'overall_rating'] as const;
    const averages: Record<string, number> = {};

    categories.forEach(category => {
      const scores = feedbacks
        .map(f => f[category])
        .filter((s): s is number => s !== null && s !== undefined);
      
      if (scores.length > 0) {
        averages[category] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    });

    return averages;
  };

  const getRecommendationSummary = () => {
    if (!feedbacks || feedbacks.length === 0) return null;

    const recommendations = feedbacks
      .map(f => f.recommendation)
      .filter((r): r is NonNullable<typeof r> => r !== null && r !== undefined);

    return {
      hire: recommendations.filter(r => r === 'hire').length,
      next_round: recommendations.filter(r => r === 'next_round').length,
      reject: recommendations.filter(r => r === 'reject').length,
      undecided: recommendations.filter(r => r === 'undecided').length,
      total: recommendations.length,
    };
  };

  return {
    feedbacks,
    myFeedback,
    isLoading,
    submitFeedback,
    getAverageScores,
    getRecommendationSummary,
  };
}

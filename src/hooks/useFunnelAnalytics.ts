import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FunnelMetrics {
  id: string;
  entity_type: string;
  entity_id: string | null;
  period_start: string;
  period_end: string;
  total_submissions: number;
  submissions_to_opt_in: number;
  opt_in_to_interview: number;
  interview_to_offer: number;
  offer_to_placement: number;
  opt_in_rate: number;
  interview_rate: number;
  offer_rate: number;
  acceptance_rate: number;
  avg_time_to_opt_in_hours: number;
  avg_time_to_interview_days: number;
  avg_time_to_offer_days: number;
  avg_time_to_fill_days: number;
  avg_match_score: number;
  avg_candidate_score: number;
  drop_offs_by_stage: Record<string, number>;
  drop_off_reasons: Record<string, number>;
  calculated_at: string;
}

export interface LeaderboardEntry {
  id: string;
  recruiter_id: string;
  period: string;
  period_start: string;
  placements: number;
  submissions: number;
  conversion_rate: number;
  avg_time_to_fill: number;
  avg_candidate_score: number;
  total_revenue: number;
  rank_position: number;
  rank_change: number;
  calculated_at: string;
  recruiter_name?: string;
}

export function useFunnelMetrics(
  entityType: 'job' | 'client' | 'recruiter' | 'platform',
  entityId?: string,
  periodDays: number = 30
) {
  return useQuery({
    queryKey: ['funnel-metrics', entityType, entityId, periodDays],
    queryFn: async () => {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);
      
      let query = supabase
        .from('funnel_metrics')
        .select('*')
        .eq('entity_type', entityType)
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .order('calculated_at', { ascending: false })
        .limit(1);

      if (entityId) {
        query = query.eq('entity_id', entityId);
      } else {
        query = query.is('entity_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data?.[0] as FunnelMetrics | null;
    },
  });
}

export function useRecruiterLeaderboard(period: 'weekly' | 'monthly' | 'quarterly' = 'monthly') {
  return useQuery({
    queryKey: ['recruiter-leaderboard', period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recruiter_leaderboard')
        .select(`
          *,
          profiles!recruiter_leaderboard_recruiter_id_fkey(full_name)
        `)
        .eq('period', period)
        .order('rank_position', { ascending: true })
        .limit(20);

      if (error) {
        // If the join fails, try without it
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('recruiter_leaderboard')
          .select('*')
          .eq('period', period)
          .order('rank_position', { ascending: true })
          .limit(20);

        if (fallbackError) throw fallbackError;
        return fallbackData as LeaderboardEntry[];
      }

      return data?.map((entry: any) => ({
        ...entry,
        recruiter_name: entry.profiles?.full_name || 'Unknown Recruiter',
      })) as LeaderboardEntry[];
    },
  });
}

export function useCalculateAnalytics() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      action: 'calculate_funnel' | 'calculate_leaderboard' | 'calculate_all';
      entity_type?: string;
      entity_id?: string;
      period_days?: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('calculate-analytics', {
        body: params,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funnel-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-leaderboard'] });
    },
  });
}

export function useConversionTrends(
  entityType: 'job' | 'client' | 'recruiter' | 'platform',
  entityId?: string,
  periodDays: number = 90
) {
  return useQuery({
    queryKey: ['conversion-trends', entityType, entityId, periodDays],
    queryFn: async () => {
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - periodDays);

      let query = supabase
        .from('funnel_metrics')
        .select('*')
        .eq('entity_type', entityType)
        .gte('period_start', periodStart.toISOString().split('T')[0])
        .order('period_start', { ascending: true });

      if (entityId) {
        query = query.eq('entity_id', entityId);
      } else {
        query = query.is('entity_id', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as FunnelMetrics[];
    },
  });
}

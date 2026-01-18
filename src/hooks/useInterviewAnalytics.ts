import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface InterviewMetrics {
  totalInterviews: number;
  completedInterviews: number;
  cancelledInterviews: number;
  noShowRate: number;
  avgTimeToInterview: number;
  avgInterviewRounds: number;
  feedbackRate: number;
  interviewToOfferRate: number;
}

export interface InterviewerStats {
  evaluatorId: string;
  evaluatorName?: string;
  interviewCount: number;
  avgRating: number;
  feedbackCount: number;
  noShowCount: number;
}

export interface TimeSlotStats {
  dayOfWeek: number;
  hour: number;
  count: number;
}

export interface FunnelStep {
  stage: string;
  count: number;
  conversionRate: number;
}

export function useInterviewAnalytics(dateRange?: { start: Date; end: Date }) {
  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = dateRange?.end || new Date();

  const { data: overviewMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['interview-metrics', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: interviews, error } = await supabase
        .from('interviews')
        .select('id, status, scheduled_at, no_show_reported, created_at, submission_id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      const total = interviews?.length || 0;
      const completed = interviews?.filter(i => i.status === 'completed').length || 0;
      const cancelled = interviews?.filter(i => i.status === 'cancelled').length || 0;
      const noShows = interviews?.filter(i => i.no_show_reported).length || 0;

      // Get feedback count
      const { count: feedbackCount } = await supabase
        .from('interview_feedback')
        .select('*', { count: 'exact', head: true })
        .in('interview_id', interviews?.map(i => i.id) || []);

      // Calculate avg time to interview (from submission to first interview)
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, submitted_at')
        .in('id', interviews?.map(i => i.submission_id).filter(Boolean) || []);

      let avgDays = 0;
      if (submissions && interviews) {
        const times = interviews
          .filter(i => i.submission_id && i.scheduled_at)
          .map(i => {
            const sub = submissions.find(s => s.id === i.submission_id);
            if (!sub) return null;
            return (new Date(i.scheduled_at!).getTime() - new Date(sub.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
          })
          .filter((t): t is number => t !== null && t > 0);
        
        avgDays = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      }

      return {
        totalInterviews: total,
        completedInterviews: completed,
        cancelledInterviews: cancelled,
        noShowRate: total > 0 ? (noShows / total) * 100 : 0,
        avgTimeToInterview: avgDays,
        avgInterviewRounds: 1.5, // Would need more complex query
        feedbackRate: total > 0 ? ((feedbackCount || 0) / total) * 100 : 0,
        interviewToOfferRate: 15, // Placeholder
      } as InterviewMetrics;
    },
  });

  const { data: interviewerStats, isLoading: statsLoading } = useQuery({
    queryKey: ['interviewer-stats', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: feedback, error } = await supabase
        .from('interview_feedback')
        .select('evaluator_id, overall_rating, interview_id')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Group by evaluator
      const evaluatorMap = new Map<string, { ratings: number[]; count: number }>();
      
      feedback?.forEach(f => {
        const existing = evaluatorMap.get(f.evaluator_id) || { ratings: [], count: 0 };
        existing.count += 1;
        if (f.overall_rating) existing.ratings.push(f.overall_rating);
        evaluatorMap.set(f.evaluator_id, existing);
      });

      const stats: InterviewerStats[] = [];
      evaluatorMap.forEach((value, key) => {
        stats.push({
          evaluatorId: key,
          interviewCount: value.count,
          avgRating: value.ratings.length > 0 
            ? value.ratings.reduce((a, b) => a + b, 0) / value.ratings.length 
            : 0,
          feedbackCount: value.count,
          noShowCount: 0,
        });
      });

      return stats.sort((a, b) => b.interviewCount - a.interviewCount);
    },
  });

  const { data: timeSlotStats, isLoading: timeSlotsLoading } = useQuery({
    queryKey: ['interview-timeslots', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: interviews, error } = await supabase
        .from('interviews')
        .select('scheduled_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .not('scheduled_at', 'is', null);

      if (error) throw error;

      const slotMap = new Map<string, number>();
      
      interviews?.forEach(i => {
        if (i.scheduled_at) {
          const date = new Date(i.scheduled_at);
          const key = `${date.getDay()}-${date.getHours()}`;
          slotMap.set(key, (slotMap.get(key) || 0) + 1);
        }
      });

      const stats: TimeSlotStats[] = [];
      slotMap.forEach((count, key) => {
        const [day, hour] = key.split('-').map(Number);
        stats.push({ dayOfWeek: day, hour, count });
      });

      return stats;
    },
  });

  const { data: weeklyTrend, isLoading: trendLoading } = useQuery({
    queryKey: ['interview-trend', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: interviews, error } = await supabase
        .from('interviews')
        .select('created_at, status')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by week
      const weekMap = new Map<string, { total: number; completed: number; cancelled: number }>();
      
      interviews?.forEach(i => {
        const date = new Date(i.created_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const existing = weekMap.get(weekKey) || { total: 0, completed: 0, cancelled: 0 };
        existing.total += 1;
        if (i.status === 'completed') existing.completed += 1;
        if (i.status === 'cancelled') existing.cancelled += 1;
        weekMap.set(weekKey, existing);
      });

      return Array.from(weekMap.entries())
        .map(([week, data]) => ({ week, ...data }))
        .sort((a, b) => a.week.localeCompare(b.week));
    },
  });

  return {
    overviewMetrics,
    interviewerStats,
    timeSlotStats,
    weeklyTrend,
    isLoading: metricsLoading || statsLoading || timeSlotsLoading || trendLoading,
  };
}

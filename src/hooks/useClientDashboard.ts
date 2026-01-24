import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface DashboardStats {
  activeJobs: number;
  totalCandidates: number;
  pendingInterviews: number;
  placements: number;
  newCandidatesLast7Days: number;
}

export interface UnifiedAction {
  id: string;
  type: 'review_candidate' | 'schedule_interview' | 'give_feedback' | 'make_offer' | 'respond_to_question';
  urgency: 'critical' | 'warning' | 'normal';
  waitingHours: number;
  title: string;
  subtitle: string;
  jobId?: string;
  jobTitle?: string;
  submissionId?: string;
  candidateId?: string;
  candidateAnonymousId?: string;
  interviewId?: string;
  offerId?: string;
  createdAt: string;
}

export interface JobStats {
  id: string;
  title: string;
  companyName: string;
  status: string;
  createdAt: string;
  activeRecruiters: number;
  totalCandidates: number;
  newCandidates: number;
  shortlisted: number;
  interviews: number;
  offers: number;
  placed: number;
  topCandidate?: {
    anonymousId: string;
    matchScore: number;
    submissionId: string;
    experienceYears: number;
    availability: string;
  };
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface HealthConfig {
  level: 'excellent' | 'good' | 'warning' | 'critical';
  score: number;
  label: string;
  message: string;
}

export interface ClientDashboardData {
  stats: DashboardStats;
  actions: UnifiedAction[];
  liveJobs: JobStats[];
  activity: ActivityItem[];
  healthScore: HealthConfig;
}

export function useClientDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['client-dashboard', user?.id],
    queryFn: async (): Promise<ClientDashboardData> => {
      const { data, error } = await supabase.functions.invoke('client-dashboard-data');
      
      if (error) {
        console.error('Dashboard data error:', error);
        throw error;
      }
      
      return data as ClientDashboardData;
    },
    enabled: !!user,
    staleTime: 30_000, // 30 seconds
    refetchInterval: 60_000, // 1 minute auto-refresh
    refetchOnWindowFocus: true,
  });
}

// Helper to get urgency stats
export function getActionStats(actions: UnifiedAction[]) {
  return {
    critical: actions.filter(a => a.urgency === 'critical').length,
    warning: actions.filter(a => a.urgency === 'warning').length,
    normal: actions.filter(a => a.urgency === 'normal').length,
    total: actions.length,
    byType: {
      review_candidate: actions.filter(a => a.type === 'review_candidate').length,
      schedule_interview: actions.filter(a => a.type === 'schedule_interview').length,
      give_feedback: actions.filter(a => a.type === 'give_feedback').length,
      make_offer: actions.filter(a => a.type === 'make_offer').length,
      respond_to_question: actions.filter(a => a.type === 'respond_to_question').length,
    },
  };
}

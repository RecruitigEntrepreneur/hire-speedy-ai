import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface ClientTask {
  id: string;
  type: 'decision' | 'interview' | 'offer';
  title: string;
  description: string;
  urgency: 'critical' | 'warning' | 'normal';
  submissionId?: string;
  jobId?: string;
  candidateName?: string;
  jobTitle?: string;
  hoursWaiting?: number;
  createdAt: string;
}

export interface ClientTaskStats {
  pendingDecisions: number;
  pendingInterviews: number;
  pendingOffers: number;
  criticalCount: number;
}

export function useClientTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [stats, setStats] = useState<ClientTaskStats>({
    pendingDecisions: 0,
    pendingInterviews: 0,
    pendingOffers: 0,
    criticalCount: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    try {
      const taskList: ClientTask[] = [];
      const now = new Date();

      // 1. Pending candidate decisions (submissions with status 'submitted')
      const { data: pendingSubmissions } = await supabase
        .from('submissions')
        .select(`
          id,
          submitted_at,
          candidate:candidates(id, full_name),
          job:jobs!inner(id, title, client_id)
        `)
        .eq('jobs.client_id', user.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: true });

      if (pendingSubmissions) {
        pendingSubmissions.forEach((sub: any) => {
          const submittedAt = new Date(sub.submitted_at);
          const hoursWaiting = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
          
          let urgency: 'critical' | 'warning' | 'normal' = 'normal';
          if (hoursWaiting >= 24) urgency = 'critical';
          else if (hoursWaiting >= 12) urgency = 'warning';

          taskList.push({
            id: `decision-${sub.id}`,
            type: 'decision',
            title: `${sub.candidate?.full_name || 'Kandidat'} wartet auf Entscheidung`,
            description: `Für ${sub.job?.title || 'Job'}`,
            urgency,
            submissionId: sub.id,
            jobId: sub.job?.id,
            candidateName: sub.candidate?.full_name,
            jobTitle: sub.job?.title,
            hoursWaiting,
            createdAt: sub.submitted_at,
          });
        });
      }

      // 2. Pending interviews (status 'pending' or unscheduled)
      const { data: pendingInterviews } = await supabase
        .from('interviews')
        .select(`
          id,
          status,
          scheduled_at,
          created_at,
          submission:submissions!inner(
            id,
            candidate:candidates(id, full_name),
            job:jobs!inner(id, title, client_id)
          )
        `)
        .eq('submission.job.client_id', user.id)
        .or('status.eq.pending,scheduled_at.is.null');

      if (pendingInterviews) {
        pendingInterviews.forEach((interview: any) => {
          const createdAt = new Date(interview.created_at);
          const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          
          let urgency: 'critical' | 'warning' | 'normal' = 'normal';
          if (hoursWaiting >= 48) urgency = 'critical';
          else if (hoursWaiting >= 24) urgency = 'warning';

          // Different message based on whether scheduled or not
          const needsScheduling = !interview.scheduled_at;
          const title = needsScheduling 
            ? `Interview terminieren: ${interview.submission?.candidate?.full_name || 'Kandidat'}`
            : `Interview bestätigen: ${interview.submission?.candidate?.full_name || 'Kandidat'}`;

          taskList.push({
            id: `interview-${interview.id}`,
            type: 'interview',
            title,
            description: `Für ${interview.submission?.job?.title || 'Job'}`,
            urgency,
            submissionId: interview.submission?.id,
            jobId: interview.submission?.job?.id,
            candidateName: interview.submission?.candidate?.full_name,
            jobTitle: interview.submission?.job?.title,
            hoursWaiting,
            createdAt: interview.created_at,
          });
        });
      }

      // 3. Pending offers
      const { data: pendingOffers } = await supabase
        .from('offers')
        .select(`
          id,
          status,
          created_at,
          submission:submissions!inner(
            id,
            candidate:candidates(id, full_name),
            job:jobs!inner(id, title, client_id)
          )
        `)
        .eq('submission.job.client_id', user.id)
        .in('status', ['draft', 'pending']);

      if (pendingOffers) {
        pendingOffers.forEach((offer: any) => {
          const createdAt = new Date(offer.created_at);
          const hoursWaiting = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
          
          let urgency: 'critical' | 'warning' | 'normal' = 'normal';
          if (hoursWaiting >= 72) urgency = 'critical';
          else if (hoursWaiting >= 48) urgency = 'warning';

          taskList.push({
            id: `offer-${offer.id}`,
            type: 'offer',
            title: `Angebot prüfen: ${offer.submission?.candidate?.full_name || 'Kandidat'}`,
            description: `Für ${offer.submission?.job?.title || 'Job'}`,
            urgency,
            submissionId: offer.submission?.id,
            jobId: offer.submission?.job?.id,
            candidateName: offer.submission?.candidate?.full_name,
            jobTitle: offer.submission?.job?.title,
            hoursWaiting,
            createdAt: offer.created_at,
          });
        });
      }

      // Sort by urgency (critical first) then by hours waiting
      taskList.sort((a, b) => {
        const urgencyOrder = { critical: 0, warning: 1, normal: 2 };
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
        }
        return (b.hoursWaiting || 0) - (a.hoursWaiting || 0);
      });

      setTasks(taskList);
      setStats({
        pendingDecisions: taskList.filter(t => t.type === 'decision').length,
        pendingInterviews: taskList.filter(t => t.type === 'interview').length,
        pendingOffers: taskList.filter(t => t.type === 'offer').length,
        criticalCount: taskList.filter(t => t.urgency === 'critical').length,
      });
    } catch (error) {
      console.error('Error fetching client tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { tasks, stats, loading, refetch: fetchTasks };
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface UnifiedTaskItem {
  itemType: 'alert' | 'task';
  itemId: string;
  recruiterId: string;
  title: string;
  description: string | null;
  recommendedAction: string | null;
  taskCategory: string;
  sortPriority: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  submissionId: string | null;
  candidateId: string | null;
  jobId: string | null;
  playbookId: string | null;
  createdAt: string;
  dueAt: string | null;
  isRead: boolean;
  isArchived: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  snoozedUntil: string | null;
  impactScore: number;
  candidateName: string | null;
  candidatePhone: string | null;
  candidateEmail: string | null;
  jobTitle: string | null;
  companyName: string | null;
}

export type TaskFilter = 'all' | 'opt_in' | 'follow_up' | 'interview' | 'manual' | 'other';

const FILTER_CATEGORIES: Record<TaskFilter, string[]> = {
  all: [],
  opt_in: ['opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'],
  follow_up: ['follow_up_needed', 'ghosting_risk', 'engagement_drop', 'no_activity'],
  interview: ['interview_prep_missing', 'interview_reminder'],
  manual: ['call', 'email', 'follow_up', 'meeting', 'other'],
  other: ['salary_mismatch', 'salary_negotiation', 'closing_opportunity', 'culture_concern', 'document_missing', 'client_feedback_positive', 'client_feedback_negative'],
};

const ALERT_PRIORITY_MAP: Record<string, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

const TASK_PRIORITY_TO_ALERT: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
  urgent: 'critical',
  high: 'high',
  normal: 'medium',
  low: 'low',
};

function mapAlertToItem(alert: any): UnifiedTaskItem {
  // Handle nested joins: submissions → candidates, jobs
  const submission = alert.submissions;
  const candidate = submission?.candidates;
  const job = submission?.jobs;

  return {
    itemType: 'alert',
    itemId: alert.id,
    recruiterId: alert.recruiter_id,
    title: alert.title,
    description: alert.message || null,
    recommendedAction: alert.recommended_action || null,
    taskCategory: alert.alert_type,
    sortPriority: ALERT_PRIORITY_MAP[alert.priority] ?? 4,
    priority: alert.priority || 'medium',
    submissionId: alert.submission_id,
    candidateId: submission?.candidate_id || null,
    jobId: submission?.job_id || null,
    playbookId: alert.playbook_id || null,
    createdAt: alert.created_at,
    dueAt: alert.expires_at || null,
    isRead: alert.is_read ?? false,
    isArchived: alert.is_dismissed ?? false,
    isCompleted: alert.action_taken != null,
    completedAt: alert.action_taken_at || null,
    snoozedUntil: alert.snoozed_until || null,
    impactScore: alert.impact_score ?? 50,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: job?.company_name || null,
  };
}

function mapTaskToItem(task: any): UnifiedTaskItem {
  const candidate = task.candidates;
  const job = task.jobs;
  const normalizedPriority = TASK_PRIORITY_TO_ALERT[task.priority] || 'medium';

  return {
    itemType: 'task',
    itemId: task.id,
    recruiterId: task.recruiter_id,
    title: task.title,
    description: task.description || null,
    recommendedAction: null,
    taskCategory: task.task_type || 'other',
    sortPriority: ALERT_PRIORITY_MAP[normalizedPriority] ?? 3,
    priority: normalizedPriority,
    submissionId: task.submission_id || null,
    candidateId: task.candidate_id || null,
    jobId: task.job_id || null,
    playbookId: task.playbook_id || null,
    createdAt: task.created_at,
    dueAt: task.due_at || null,
    isRead: false,
    isArchived: task.status === 'cancelled',
    isCompleted: task.status === 'completed',
    completedAt: task.completed_at || null,
    snoozedUntil: null,
    impactScore: 50,
    candidateName: candidate?.full_name || null,
    candidatePhone: candidate?.phone || null,
    candidateEmail: candidate?.email || null,
    jobTitle: job?.title || null,
    companyName: job?.company_name || null,
  };
}

export function useUnifiedTaskInbox(filter: TaskFilter = 'all') {
  const { user } = useAuth();
  const [items, setItems] = useState<UnifiedTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      const now = new Date().toISOString();

      // Query 1: influence_alerts with nested submission → candidate + job
      const alertsQuery = supabase
        .from('influence_alerts')
        .select(`
          *,
          submissions(
            candidate_id,
            job_id,
            candidates(full_name, phone, email),
            jobs(title, company_name)
          )
        `)
        .eq('recruiter_id', user.id)
        .eq('is_dismissed', false)
        .is('action_taken', null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('created_at', { ascending: false });

      // Query 2: recruiter_tasks with nested candidate + job
      const tasksQuery = supabase
        .from('recruiter_tasks')
        .select(`
          *,
          candidates(full_name, phone, email),
          jobs(title, company_name)
        `)
        .eq('recruiter_id', user.id)
        .not('status', 'in', '("completed","cancelled")')
        .order('created_at', { ascending: false });

      // Execute both in parallel
      const [alertsResult, tasksResult] = await Promise.all([alertsQuery, tasksQuery]);

      if (alertsResult.error) {
        console.error('Error fetching alerts:', alertsResult.error);
      }
      if (tasksResult.error) {
        console.error('Error fetching tasks:', tasksResult.error);
      }

      // Map alerts
      const alertItems: UnifiedTaskItem[] = (alertsResult.data || [])
        .map(mapAlertToItem)
        .filter(item => {
          // Filter out snoozed items (if snoozed_until column exists)
          if (item.snoozedUntil && new Date(item.snoozedUntil) > new Date()) {
            return false;
          }
          return true;
        });

      // Map tasks
      const taskItems: UnifiedTaskItem[] = (tasksResult.data || []).map(mapTaskToItem);

      // Merge + sort: by sortPriority ASC, then by createdAt DESC
      const merged = [...alertItems, ...taskItems].sort((a, b) => {
        if (a.sortPriority !== b.sortPriority) return a.sortPriority - b.sortPriority;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setItems(merged);
    } catch (err) {
      console.error('Unified inbox fetch error:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchItems();

    if (user) {
      // Subscribe to both source tables for realtime updates
      const alertChannel = supabase
        .channel('unified-inbox-alerts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'influence_alerts',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      const taskChannel = supabase
        .channel('unified-inbox-tasks')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recruiter_tasks',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => { fetchItems(); }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(alertChannel);
        supabase.removeChannel(taskChannel);
      };
    }
  }, [user, fetchItems]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;

    const categories = FILTER_CATEGORIES[filter];
    if (!categories.length) return items;

    // For 'manual' filter: show only tasks (not alerts)
    if (filter === 'manual') {
      return items.filter(i => i.itemType === 'task');
    }

    return items.filter(i => categories.includes(i.taskCategory));
  }, [items, filter]);

  // Counts per filter
  const filterCounts = useMemo(() => {
    const counts: Record<TaskFilter, number> = {
      all: items.length,
      opt_in: 0,
      follow_up: 0,
      interview: 0,
      manual: 0,
      other: 0,
    };

    items.forEach(item => {
      if (item.itemType === 'task') {
        counts.manual++;
      } else if (FILTER_CATEGORIES.opt_in.includes(item.taskCategory)) {
        counts.opt_in++;
      } else if (FILTER_CATEGORIES.follow_up.includes(item.taskCategory)) {
        counts.follow_up++;
      } else if (FILTER_CATEGORIES.interview.includes(item.taskCategory)) {
        counts.interview++;
      } else {
        counts.other++;
      }
    });

    return counts;
  }, [items]);

  const urgentItems = useMemo(
    () => filteredItems.filter(i => i.priority === 'critical'),
    [filteredItems]
  );
  const openItems = useMemo(
    () => filteredItems.filter(i => i.priority !== 'critical'),
    [filteredItems]
  );

  // Actions
  const markDone = async (itemType: 'alert' | 'task', itemId: string) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({
          action_taken: 'completed',
          action_taken_at: new Date().toISOString(),
          is_read: true,
        })
        .eq('id', itemId);
    } else {
      await supabase
        .from('recruiter_tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const snooze = async (itemType: 'alert' | 'task', itemId: string, until: Date) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({ snoozed_until: until.toISOString() } as any)
        .eq('id', itemId);
    } else {
      // For tasks, we shift the due_at
      await supabase
        .from('recruiter_tasks')
        .update({ due_at: until.toISOString() })
        .eq('id', itemId);
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const dismiss = async (itemType: 'alert' | 'task', itemId: string) => {
    if (itemType === 'alert') {
      await supabase
        .from('influence_alerts')
        .update({ is_dismissed: true })
        .eq('id', itemId);
    } else {
      await supabase
        .from('recruiter_tasks')
        .update({ status: 'cancelled' })
        .eq('id', itemId);
    }

    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  return {
    items: filteredItems,
    allItems: items,
    urgentItems,
    openItems,
    loading,
    error,
    refetch: fetchItems,
    markDone,
    snooze,
    dismiss,
    filterCounts,
    pendingCount: items.length,
    urgentCount: items.filter(i => i.priority === 'critical').length,
  };
}

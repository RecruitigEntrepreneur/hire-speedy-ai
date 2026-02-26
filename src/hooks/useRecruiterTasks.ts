import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface RecruiterTask {
  id: string;
  recruiter_id: string;
  title: string;
  description: string | null;
  task_type: 'call' | 'email' | 'follow_up' | 'meeting' | 'other';
  candidate_id: string | null;
  submission_id: string | null;
  job_id: string | null;
  due_at: string | null;
  reminder_at: string | null;
  reminder_sent: boolean;
  status: 'pending' | 'completed' | 'cancelled';
  completed_at: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  source: 'manual' | 'system' | 'sequence' | 'sla';
  related_alert_id: string | null;
  playbook_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  task_type?: RecruiterTask['task_type'];
  candidate_id?: string;
  submission_id?: string;
  job_id?: string;
  due_at?: string;
  reminder_at?: string;
  priority?: RecruiterTask['priority'];
  source?: RecruiterTask['source'];
  related_alert_id?: string;
  playbook_id?: string;
}

export function useRecruiterTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<RecruiterTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('recruiter_tasks')
        .select('*')
        .eq('recruiter_id', user.id)
        .neq('status', 'cancelled')
        .order('due_at', { ascending: true, nullsFirst: false });

      if (fetchError) throw fetchError;
      setTasks((data || []) as RecruiterTask[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Aufgaben');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTasks();

    if (user) {
      const channel = supabase
        .channel('recruiter-tasks-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recruiter_tasks',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => {
            fetchTasks();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchTasks]);

  const createTask = async (input: CreateTaskInput): Promise<RecruiterTask | null> => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('recruiter_tasks')
        .insert({
          recruiter_id: user.id,
          title: input.title,
          description: input.description || null,
          task_type: input.task_type || 'other',
          candidate_id: input.candidate_id || null,
          submission_id: input.submission_id || null,
          job_id: input.job_id || null,
          due_at: input.due_at || null,
          reminder_at: input.reminder_at || null,
          priority: input.priority || 'normal',
          source: input.source || 'manual',
          related_alert_id: input.related_alert_id || null,
          playbook_id: input.playbook_id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as RecruiterTask;
    } catch (err) {
      console.error('Error creating task:', err);
      return null;
    }
  };

  const completeTask = async (taskId: string) => {
    const { error } = await supabase
      .from('recruiter_tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    if (!error) {
      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString() }
            : t
        )
      );
    }
  };

  const updateTask = async (taskId: string, updates: Partial<CreateTaskInput>) => {
    const { error } = await supabase
      .from('recruiter_tasks')
      .update(updates as any)
      .eq('id', taskId);

    if (!error) {
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, ...updates } as RecruiterTask : t))
      );
    }
  };

  const deleteTask = async (taskId: string) => {
    const { error } = await supabase
      .from('recruiter_tasks')
      .update({ status: 'cancelled' })
      .eq('id', taskId);

    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return {
    tasks,
    pendingTasks,
    completedTasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    completeTask,
    updateTask,
    deleteTask,
  };
}

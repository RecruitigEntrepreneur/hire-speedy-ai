import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface InfluenceAlert {
  id: string;
  submission_id: string;
  recruiter_id: string;
  alert_type: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  recommended_action: string;
  playbook_id: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  action_taken: string | null;
  action_taken_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useInfluenceAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<InfluenceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('influence_alerts')
        .select('*')
        .eq('recruiter_id', user.id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAlerts((data || []) as InfluenceAlert[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden der Alerts');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();

    // Realtime subscription
    if (user) {
      const channel = supabase
        .channel('influence-alerts-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'influence_alerts',
            filter: `recruiter_id=eq.${user.id}`,
          },
          () => {
            fetchAlerts();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchAlerts]);

  const markAsRead = async (alertId: string) => {
    const { error } = await supabase
      .from('influence_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, is_read: true } : a));
    }
  };

  const dismiss = async (alertId: string) => {
    const { error } = await supabase
      .from('influence_alerts')
      .update({ is_dismissed: true })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    }
  };

  const takeAction = async (alertId: string, action: string) => {
    const { error } = await supabase
      .from('influence_alerts')
      .update({ 
        action_taken: action, 
        action_taken_at: new Date().toISOString(),
        is_read: true 
      })
      .eq('id', alertId);

    if (!error) {
      setAlerts(prev => prev.map(a => 
        a.id === alertId 
          ? { ...a, action_taken: action, action_taken_at: new Date().toISOString(), is_read: true } 
          : a
      ));
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;
  const criticalCount = alerts.filter(a => a.priority === 'critical').length;
  const highCount = alerts.filter(a => a.priority === 'high').length;

  return {
    alerts,
    loading,
    error,
    refetch: fetchAlerts,
    markAsRead,
    dismiss,
    takeAction,
    unreadCount,
    criticalCount,
    highCount,
  };
}

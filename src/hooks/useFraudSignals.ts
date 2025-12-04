import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FraudSignal {
  id: string;
  signal_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence_score: number;
  user_id: string | null;
  candidate_id: string | null;
  submission_id: string | null;
  job_id: string | null;
  details: Record<string, any>;
  evidence: string[];
  status: 'pending' | 'investigating' | 'confirmed' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  notes: string | null;
  auto_action_taken: string | null;
  created_at: string;
}

export function useFraudSignals(filters?: {
  status?: string;
  severity?: string;
  signal_type?: string;
}) {
  const [signals, setSignals] = useState<FraudSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSignals = async () => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('fraud_signals')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.signal_type) {
        query = query.eq('signal_type', filters.signal_type);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setSignals((data as FraudSignal[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const updateSignal = async (signalId: string, updates: {
    status?: string;
    action_taken?: string;
    notes?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('fraud_signals')
        .update({
          ...updates,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', signalId);

      if (error) throw error;
      await fetchSignals();
      return true;
    } catch (err) {
      console.error('Error updating fraud signal:', err);
      return false;
    }
  };

  const runFraudCheck = async (params: {
    trigger: 'candidate_submission' | 'profile_change' | 'suspicious_login' | 'batch_scan';
    candidate_id?: string;
    submission_id?: string;
    user_id?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('fraud-detection', {
        body: params,
      });

      if (error) throw error;
      await fetchSignals();
      return data;
    } catch (err) {
      console.error('Error running fraud check:', err);
      return null;
    }
  };

  useEffect(() => {
    fetchSignals();
  }, [filters?.status, filters?.severity, filters?.signal_type]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'low': return 'text-blue-600';
      case 'medium': return 'text-amber-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getSeverityBgColor = (severity: string): string => {
    switch (severity) {
      case 'low': return 'bg-blue-100';
      case 'medium': return 'bg-amber-100';
      case 'high': return 'bg-orange-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-muted';
    }
  };

  const getSignalTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      duplicate_candidate: 'Duplikat-Kandidat',
      velocity_abuse: 'Velocity-Missbrauch',
      data_inconsistency: 'Daten-Inkonsistenz',
      circumvention_attempt: 'Umgehungsversuch',
      suspicious_ip: 'Verdächtige IP',
      cv_similarity: 'CV-Ähnlichkeit',
      suspicious_login: 'Verdächtige Anmeldung',
      suspicious_profile_changes: 'Verdächtige Profiländerungen',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'Ausstehend',
      investigating: 'In Prüfung',
      confirmed: 'Bestätigt',
      dismissed: 'Abgelehnt',
    };
    return labels[status] || status;
  };

  const pendingCount = signals.filter(s => s.status === 'pending').length;
  const criticalCount = signals.filter(s => s.severity === 'critical' && s.status === 'pending').length;

  return {
    signals,
    loading,
    error,
    fetchSignals,
    updateSignal,
    runFraudCheck,
    getSeverityColor,
    getSeverityBgColor,
    getSignalTypeLabel,
    getStatusLabel,
    pendingCount,
    criticalCount,
  };
}

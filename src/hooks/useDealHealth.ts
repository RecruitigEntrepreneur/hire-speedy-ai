import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DealHealth {
  id: string;
  submission_id: string;
  health_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  drop_off_probability: number;
  days_since_last_activity: number;
  bottleneck: string | null;
  bottleneck_user_id: string | null;
  bottleneck_days: number;
  ai_assessment: string;
  recommended_actions: string[];
  risk_factors: string[];
  calculated_at: string;
}

export function useDealHealth(submissionId?: string) {
  const [health, setHealth] = useState<DealHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    if (!submissionId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('deal_health')
        .select('*')
        .eq('submission_id', submissionId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      setHealth(data as DealHealth | null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const calculateHealth = async () => {
    if (!submissionId) return null;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('deal-health', {
        body: { submission_id: submissionId },
      });

      if (fnError) throw fnError;
      setHealth(data as DealHealth);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei Berechnung');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [submissionId]);

  const getRiskColor = (level: string): string => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-amber-600';
      case 'high': return 'text-orange-600';
      case 'critical': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBgColor = (level: string): string => {
    switch (level) {
      case 'low': return 'bg-green-100';
      case 'medium': return 'bg-amber-100';
      case 'high': return 'bg-orange-100';
      case 'critical': return 'bg-red-100';
      default: return 'bg-muted';
    }
  };

  const getHealthLabel = (score: number): string => {
    if (score >= 80) return 'Sehr gut';
    if (score >= 60) return 'Gut';
    if (score >= 40) return 'Kritisch';
    return 'Gefährdet';
  };

  return {
    health,
    loading,
    error,
    fetchHealth,
    calculateHealth,
    getRiskColor,
    getRiskBgColor,
    getHealthLabel,
  };
}

export function useDealHealthList() {
  const [healthData, setHealthData] = useState<DealHealth[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('deal_health')
        .select('*')
        .order('health_score', { ascending: true });

      setHealthData((data as DealHealth[]) || []);
    } catch (err) {
      console.error('Error fetching deal health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  return { healthData, loading, refetch: fetchAll };
}

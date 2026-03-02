import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type TrustLevel = 'bronze' | 'silver' | 'gold' | 'suspended';

export interface RecruiterTrustLevel {
  id: string;
  recruiter_id: string;
  trust_level: TrustLevel;
  placements_hired: number;
  total_activations: number;
  activations_with_submission: number;
  activation_ratio: number;
  active_count: number;
  max_active_slots: number;
  previous_level: string | null;
  level_changed_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}

interface NextLevelRequirement {
  label: string;
  current: number;
  target: number;
  met: boolean;
}

export interface TrustLevelInfo {
  level: TrustLevel;
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const TRUST_LEVEL_INFO: Record<TrustLevel, TrustLevelInfo> = {
  bronze: {
    level: 'bronze',
    label: 'Bronze',
    emoji: '🟤',
    color: 'text-amber-700',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
  },
  silver: {
    level: 'silver',
    label: 'Silber',
    emoji: '🔵',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
  gold: {
    level: 'gold',
    label: 'Gold',
    emoji: '⭐',
    color: 'text-amber-500',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/20',
  },
  suspended: {
    level: 'suspended',
    label: 'Gesperrt',
    emoji: '🚫',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
};

export function useRecruiterTrustLevel() {
  const { user } = useAuth();
  const [trustLevel, setTrustLevel] = useState<RecruiterTrustLevel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrustLevel = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Try to get existing trust level
      let { data, error } = await (supabase
        .from('recruiter_trust_levels' as any)
        .select('*')
        .eq('recruiter_id', user.id)
        .maybeSingle() as any);

      if (error) throw error;

      // If no row exists, create one via RPC
      if (!data) {
        const { data: created, error: createErr } = await (supabase
          .rpc('ensure_trust_level_exists', { p_recruiter_id: user.id }) as any);
        if (createErr) throw createErr;
        data = created;
      }

      setTrustLevel(data as RecruiterTrustLevel);
    } catch (err) {
      // Table may not exist yet — fall back to default bronze level
      console.warn('Trust level table not available, using defaults:', err);
      setTrustLevel({
        id: 'default',
        recruiter_id: user.id,
        trust_level: 'bronze',
        placements_hired: 0,
        total_activations: 0,
        activations_with_submission: 0,
        activation_ratio: 0,
        active_count: 0,
        max_active_slots: 5,
        previous_level: null,
        level_changed_at: null,
        suspended_at: null,
        suspended_reason: null,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTrustLevel();
  }, [fetchTrustLevel]);

  const getLevelInfo = (level?: TrustLevel): TrustLevelInfo => {
    return TRUST_LEVEL_INFO[level || trustLevel?.trust_level || 'bronze'];
  };

  const canActivate = trustLevel
    ? trustLevel.trust_level !== 'suspended' && trustLevel.active_count < trustLevel.max_active_slots
    : false;

  const slotsRemaining = trustLevel
    ? trustLevel.max_active_slots - trustLevel.active_count
    : 0;

  // Calculate requirements for next level
  const getNextLevelRequirements = (): { nextLevel: TrustLevel; requirements: NextLevelRequirement[] } | null => {
    if (!trustLevel) return null;

    if (trustLevel.trust_level === 'gold' || trustLevel.trust_level === 'suspended') return null;

    if (trustLevel.trust_level === 'bronze') {
      return {
        nextLevel: 'silver',
        requirements: [
          { label: 'Placements (hired)', current: trustLevel.placements_hired, target: 3, met: trustLevel.placements_hired >= 3 },
          { label: 'Aktivierungs-Rate', current: Math.round(trustLevel.activation_ratio * 100), target: 50, met: trustLevel.activation_ratio >= 0.5 },
        ],
      };
    }

    // silver → gold
    return {
      nextLevel: 'gold',
      requirements: [
        { label: 'Placements (hired)', current: trustLevel.placements_hired, target: 10, met: trustLevel.placements_hired >= 10 },
        { label: 'Aktivierungs-Rate', current: Math.round(trustLevel.activation_ratio * 100), target: 60, met: trustLevel.activation_ratio >= 0.6 },
      ],
    };
  };

  return {
    trustLevel,
    loading,
    refetch: fetchTrustLevel,
    getLevelInfo,
    canActivate,
    slotsRemaining,
    getNextLevelRequirements,
    TRUST_LEVEL_INFO,
  };
}

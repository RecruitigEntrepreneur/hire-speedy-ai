import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMember {
  id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'hr' | 'hiring_manager' | 'viewer' | 'finance';
  status: 'active' | 'inactive' | 'pending';
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  /** Nur für Org-Admins befüllt (Service-Role-Daten) */
  last_sign_in_at: string | null;
  assigned_jobs: { id: string; title: string }[];
}

export interface TeamData {
  members: TeamMember[];
  caller_role: string | null;
  is_admin: boolean;
}

/** Team-Liste inkl. Profil, letztem Login und Job-Zuweisungen (team-data Edge Function). */
export function useTeamData(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['team-data', organizationId],
    queryFn: async (): Promise<TeamData> => {
      const { data, error } = await supabase.functions.invoke('team-data', {
        body: { organization_id: organizationId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      return data as TeamData;
    },
    enabled: !!organizationId,
  });
}

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useMemo } from 'react';

export interface PermissionDefinition {
  id: string;
  name: string;
  description: string | null;
  category: 'jobs' | 'candidates' | 'offers' | 'billing' | 'team';
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    'view_jobs', 'manage_jobs', 'view_candidates', 'review_candidates',
    'schedule_interviews', 'create_offers', 'approve_offers',
    'view_billing', 'manage_billing', 'manage_team'
  ],
  admin: [
    'view_jobs', 'manage_jobs', 'view_candidates', 'review_candidates',
    'schedule_interviews', 'create_offers', 'approve_offers',
    'view_billing', 'manage_billing', 'manage_team'
  ],
  hiring_manager: [
    'view_jobs', 'manage_jobs', 'view_candidates', 'review_candidates',
    'schedule_interviews', 'create_offers'
  ],
  viewer: ['view_jobs', 'view_candidates'],
  finance: ['view_jobs', 'view_billing', 'manage_billing'],
};

export function usePermissionDefinitions() {
  return useQuery({
    queryKey: ['permission-definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_definitions')
        .select('*')
        .order('category');

      if (error) throw error;
      return data as PermissionDefinition[];
    },
  });
}

export function useUserPermissions(organizationId: string | undefined) {
  const { user } = useAuth();

  const { data: membership, isLoading } = useQuery({
    queryKey: ['user-org-membership', organizationId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('role, permissions')
        .eq('organization_id', organizationId!)
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!organizationId && !!user,
  });

  const permissions = useMemo(() => {
    if (!membership) return [];
    
    // Combine role-based and custom permissions
    const rolePerms = ROLE_PERMISSIONS[membership.role] || [];
    const customPerms = (membership.permissions as string[]) || [];
    
    return [...new Set([...rolePerms, ...customPerms])];
  }, [membership]);

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (perms: string[]): boolean => {
    return perms.some(p => permissions.includes(p));
  };

  const hasAllPermissions = (perms: string[]): boolean => {
    return perms.every(p => permissions.includes(p));
  };

  const isOrgAdmin = membership?.role === 'owner' || membership?.role === 'admin';

  return {
    membership,
    permissions,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isOrgAdmin,
    role: membership?.role,
  };
}

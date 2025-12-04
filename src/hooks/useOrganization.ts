import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface Organization {
  id: string;
  name: string;
  type: 'client' | 'agency';
  owner_id: string;
  settings: Record<string, any>;
  logo_url: string | null;
  billing_email: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'hiring_manager' | 'viewer' | 'finance';
  permissions: string[];
  status: 'active' | 'inactive' | 'pending';
  invited_by: string | null;
  invited_at: string | null;
  joined_at: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function useOrganization() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: organizations, isLoading: loadingOrgs } = useQuery({
    queryKey: ['organizations', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Organization[];
    },
    enabled: !!user,
  });

  const { data: memberships, isLoading: loadingMemberships } = useQuery({
    queryKey: ['organization-memberships', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user!.id)
        .eq('status', 'active');

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createOrganization = useMutation({
    mutationFn: async (data: { name: string; type: 'client' | 'agency'; billing_email?: string }) => {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.name,
          type: data.type,
          owner_id: user!.id,
          billing_email: data.billing_email,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as owner member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user!.id,
          role: 'owner',
          permissions: ['view_jobs', 'manage_jobs', 'view_candidates', 'review_candidates', 'schedule_interviews', 'create_offers', 'approve_offers', 'view_billing', 'manage_billing', 'manage_team'],
          status: 'active',
          joined_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      return org;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });
      toast.success('Organisation erstellt');
    },
    onError: (error) => {
      console.error('Error creating organization:', error);
      toast.error('Fehler beim Erstellen der Organisation');
    },
  });

  const updateOrganization = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Organization> & { id: string }) => {
      const { error } = await supabase
        .from('organizations')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      toast.success('Organisation aktualisiert');
    },
    onError: (error) => {
      console.error('Error updating organization:', error);
      toast.error('Fehler beim Aktualisieren');
    },
  });

  return {
    organizations,
    memberships,
    isLoading: loadingOrgs || loadingMemberships,
    createOrganization,
    updateOrganization,
  };
}

export function useOrganizationMembers(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: members, isLoading } = useQuery({
    queryKey: ['organization-members', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as OrganizationMember[];
    },
    enabled: !!organizationId,
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...data }: Partial<OrganizationMember> & { id: string }) => {
      const { error } = await supabase
        .from('organization_members')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', organizationId] });
      toast.success('Mitglied aktualisiert');
    },
    onError: (error) => {
      console.error('Error updating member:', error);
      toast.error('Fehler beim Aktualisieren');
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('organization_members')
        .update({ status: 'inactive' })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members', organizationId] });
      toast.success('Mitglied entfernt');
    },
    onError: (error) => {
      console.error('Error removing member:', error);
      toast.error('Fehler beim Entfernen');
    },
  });

  return {
    members,
    isLoading,
    updateMember,
    removeMember,
  };
}

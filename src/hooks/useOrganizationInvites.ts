import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  permissions: string[];
  token: string;
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

export function useOrganizationInvites(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: invites, isLoading } = useQuery({
    queryKey: ['organization-invites', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*')
        .eq('organization_id', organizationId!)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrganizationInvite[];
    },
    enabled: !!organizationId,
  });

  const sendInvite = useMutation({
    mutationFn: async (data: {
      organization_id: string;
      email: string;
      role: string;
      permissions?: string[];
    }) => {
      const { data: result, error } = await supabase.functions.invoke('organization-invite', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites', organizationId] });
      toast.success('Einladung gesendet');
    },
    onError: (error) => {
      console.error('Error sending invite:', error);
      toast.error(error.message || 'Fehler beim Senden der Einladung');
    },
  });

  const cancelInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from('organization_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-invites', organizationId] });
      toast.success('Einladung zurückgezogen');
    },
    onError: (error) => {
      console.error('Error canceling invite:', error);
      toast.error('Fehler beim Zurückziehen');
    },
  });

  const acceptInvite = useMutation({
    mutationFn: async (token: string) => {
      const { data: result, error } = await supabase.functions.invoke('accept-invite', {
        body: { token },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });
      toast.success(`Erfolgreich beigetreten: ${data.organization_name}`);
    },
    onError: (error) => {
      console.error('Error accepting invite:', error);
      toast.error(error.message || 'Fehler beim Annehmen der Einladung');
    },
  });

  return {
    invites,
    isLoading,
    sendInvite,
    cancelInvite,
    acceptInvite,
  };
}

export function useInviteByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['invite-by-token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_invites')
        .select('*, organizations(name, logo_url)')
        .eq('token', token!)
        .is('accepted_at', null)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

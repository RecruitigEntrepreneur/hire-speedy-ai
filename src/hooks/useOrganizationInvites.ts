import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: string;
  job_ids: string[];
  expires_at: string;
  invited_by: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface SendInviteResult {
  success: boolean;
  email_sent: boolean;
  invite_url: string;
  invite: Pick<OrganizationInvite, 'id' | 'email' | 'role' | 'job_ids' | 'expires_at'>;
}

export interface ValidatedInvite {
  valid: boolean;
  reason?: 'not_found' | 'already_used' | 'revoked' | 'expired';
  email?: string;
  role?: string;
  job_count?: number;
  expires_at?: string;
  organization_name?: string | null;
  organization_logo?: string | null;
  account_exists?: boolean;
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
        .is('revoked_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as OrganizationInvite[];
    },
    enabled: !!organizationId,
  });

  const sendInvite = useMutation({
    mutationFn: async (data: {
      organization_id: string;
      email: string;
      role: string;
      job_ids?: string[];
    }): Promise<SendInviteResult> => {
      const { data: result, error } = await supabase.functions.invoke('organization-invite', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result as SendInviteResult;
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
    mutationFn: async (params: { token: string; password?: string; full_name?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('accept-invite', {
        body: params,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization-memberships'] });
      queryClient.invalidateQueries({ queryKey: ['my-organization'] });
      if (data?.organization_name) {
        toast.success(`Erfolgreich beigetreten: ${data.organization_name}`);
      }
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

/**
 * Öffentlicher Token-Check über die validate-invite Edge Function.
 * (Der frühere Direkt-Lookup auf organization_invites war ein Token-Leak
 * und ist durch RLS nicht mehr möglich.)
 */
export function useValidateInvite(token: string | undefined) {
  return useQuery({
    queryKey: ['validate-invite', token],
    queryFn: async (): Promise<ValidatedInvite> => {
      const { data, error } = await supabase.functions.invoke('validate-invite', {
        body: { token },
      });
      // Bei 4xx liefert invoke einen error, aber wir wollen den Grund anzeigen
      if (error && !data) {
        return { valid: false, reason: 'not_found' };
      }
      return data as ValidatedInvite;
    },
    enabled: !!token,
    retry: false,
  });
}

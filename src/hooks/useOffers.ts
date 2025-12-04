import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Offer {
  id: string;
  submission_id: string;
  job_id: string;
  candidate_id: string;
  client_id: string;
  recruiter_id: string;
  position_title: string;
  salary_offered: number;
  salary_currency: string;
  bonus_amount?: number;
  equity_percentage?: number;
  benefits: string[];
  start_date?: string;
  contract_type: string;
  probation_months: number;
  remote_policy?: string;
  location?: string;
  custom_terms?: string;
  original_salary?: number;
  counter_offer_salary?: number;
  counter_offer_at?: string;
  counter_offer_notes?: string;
  negotiation_rounds: number;
  status: string;
  sent_at?: string;
  viewed_at?: string;
  expires_at?: string;
  decision_at?: string;
  rejection_reason?: string;
  candidate_signature?: string;
  candidate_signed_at?: string;
  access_token?: string;
  created_at: string;
  updated_at: string;
  candidates?: {
    id: string;
    full_name: string;
    email: string;
  };
  jobs?: {
    id: string;
    title: string;
    company_name: string;
  };
}

export interface CreateOfferData {
  submission_id: string;
  salary_offered: number;
  salary_currency?: string;
  bonus_amount?: number;
  equity_percentage?: number;
  benefits?: string[];
  start_date?: string;
  contract_type?: string;
  probation_months?: number;
  remote_policy?: string;
  location?: string;
  custom_terms?: string;
  expires_in_days?: number;
}

export function useOffers(clientId?: string) {
  return useQuery({
    queryKey: ['offers', clientId],
    queryFn: async () => {
      let query = supabase
        .from('offers')
        .select(`
          *,
          candidates(id, full_name, email),
          jobs(id, title, company_name)
        `)
        .order('created_at', { ascending: false });

      if (clientId) {
        query = query.eq('client_id', clientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Offer[];
    },
    enabled: !!clientId,
  });
}

export function useOfferByToken(accessToken: string) {
  return useQuery({
    queryKey: ['offer', 'token', accessToken],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offers')
        .select(`
          *,
          candidates(id, full_name, email),
          jobs(id, title, company_name)
        `)
        .eq('access_token', accessToken)
        .maybeSingle();

      if (error) throw error;
      return data as Offer | null;
    },
    enabled: !!accessToken,
  });
}

export function useOfferEvents(offerId: string) {
  return useQuery({
    queryKey: ['offer-events', offerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_events')
        .select('*')
        .eq('offer_id', offerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!offerId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateOfferData) => {
      const { data: result, error } = await supabase.functions.invoke('create-offer', {
        body: data,
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      toast({
        title: 'Angebot erstellt',
        description: 'Das Angebot wurde erfolgreich erstellt.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useSendOffer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ offerId, customMessage }: { offerId: string; customMessage?: string }) => {
      const { data: result, error } = await supabase.functions.invoke('send-offer', {
        body: { offer_id: offerId, custom_message: customMessage },
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast({
        title: 'Angebot gesendet',
        description: 'Das Angebot wurde an den Kandidaten gesendet.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useProcessOfferResponse() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      access_token: string;
      action: 'view' | 'accept' | 'reject' | 'counter_offer';
      signature?: string;
      rejection_reason?: string;
      counter_offer_salary?: number;
      counter_offer_notes?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('process-offer-response', {
        body: data,
      });

      if (error) throw error;
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['offer', 'token', variables.access_token] });
      
      if (variables.action === 'accept') {
        toast({
          title: '🎉 Angebot angenommen!',
          description: 'Herzlichen Glückwunsch zu Ihrer neuen Stelle!',
        });
      } else if (variables.action === 'reject') {
        toast({
          title: 'Angebot abgelehnt',
          description: 'Das Unternehmen wurde informiert.',
        });
      } else if (variables.action === 'counter_offer') {
        toast({
          title: 'Gegenangebot gesendet',
          description: 'Das Unternehmen wird über Ihr Gegenangebot informiert.',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ offerId, updates }: { offerId: string; updates: Partial<Offer> }) => {
      const { data, error } = await supabase
        .from('offers')
        .update(updates)
        .eq('id', offerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offers'] });
      toast({
        title: 'Angebot aktualisiert',
        description: 'Das Angebot wurde erfolgreich aktualisiert.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

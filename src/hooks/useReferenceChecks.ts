import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface ReferenceRequest {
  id: string;
  submission_id: string;
  candidate_id: string;
  reference_name: string;
  reference_email: string;
  reference_phone: string | null;
  reference_company: string | null;
  reference_position: string | null;
  relationship: 'manager' | 'colleague' | 'report' | 'client' | null;
  access_token: string;
  requested_by: string;
  requested_at: string;
  expires_at: string | null;
  reminder_sent_at: string | null;
  responded_at: string | null;
  status: 'pending' | 'completed' | 'declined' | 'expired';
  created_at: string;
  candidates?: {
    full_name: string;
    email: string;
  };
  reference_responses?: ReferenceResponse[];
}

export interface ReferenceResponse {
  id: string;
  request_id: string;
  overall_performance: number | null;
  technical_skills: number | null;
  communication: number | null;
  teamwork: number | null;
  reliability: number | null;
  leadership: number | null;
  strengths: string[] | null;
  areas_for_improvement: string[] | null;
  notable_achievements: string | null;
  working_style: string | null;
  would_rehire: boolean | null;
  recommendation_level: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no' | null;
  additional_comments: string | null;
  ai_summary: string | null;
  ai_risk_flags: Array<{ flag: string; severity: string; category: string }>;
  created_at: string;
}

export function useReferenceRequests(candidateId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['reference-requests', candidateId || user?.id],
    queryFn: async () => {
      let query = supabase
        .from('reference_requests')
        .select(`
          *,
          candidates (
            full_name,
            email
          ),
          reference_responses (*)
        `)
        .eq('requested_by', user!.id)
        .order('created_at', { ascending: false });

      if (candidateId) {
        query = query.eq('candidate_id', candidateId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ReferenceRequest[];
    },
    enabled: !!user,
  });

  const requestReference = useMutation({
    mutationFn: async (data: {
      submission_id: string;
      candidate_id: string;
      reference_name: string;
      reference_email: string;
      reference_phone?: string;
      reference_company?: string;
      reference_position?: string;
      relationship?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('request-reference', {
        body: data,
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-requests'] });
      toast.success('Referenzanfrage gesendet');
    },
    onError: (error) => {
      console.error('Error requesting reference:', error);
      toast.error(error.message || 'Fehler beim Senden der Anfrage');
    },
  });

  return {
    requests,
    isLoading,
    requestReference,
  };
}

export function useReferenceByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['reference-by-token', token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_requests')
        .select(`
          *,
          candidates (
            full_name
          )
        `)
        .eq('access_token', token!)
        .eq('status', 'pending')
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

export function useSubmitReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token, ...data }: {
      token: string;
      overall_performance?: number;
      technical_skills?: number;
      communication?: number;
      teamwork?: number;
      reliability?: number;
      leadership?: number;
      strengths?: string[];
      areas_for_improvement?: string[];
      notable_achievements?: string;
      working_style?: string;
      would_rehire?: boolean;
      recommendation_level?: string;
      additional_comments?: string;
    }) => {
      // Get request by token
      const { data: request, error: requestError } = await supabase
        .from('reference_requests')
        .select('id')
        .eq('access_token', token)
        .eq('status', 'pending')
        .single();

      if (requestError || !request) {
        throw new Error('Invalid or expired reference request');
      }

      // Create response
      const { data: response, error: responseError } = await supabase
        .from('reference_responses')
        .insert({
          request_id: request.id,
          ...data,
        })
        .select()
        .single();

      if (responseError) throw responseError;

      // Update request status
      await supabase
        .from('reference_requests')
        .update({
          status: 'completed',
          responded_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      // Trigger AI analysis
      try {
        await supabase.functions.invoke('analyze-reference', {
          body: { response_id: response.id },
        });
      } catch (e) {
        console.error('Error triggering analysis:', e);
      }

      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-requests'] });
      toast.success('Referenz erfolgreich eingereicht');
    },
    onError: (error) => {
      console.error('Error submitting reference:', error);
      toast.error(error.message || 'Fehler beim Einreichen');
    },
  });
}

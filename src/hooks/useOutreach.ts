import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OutreachLead {
  id: string;
  company_name: string;
  company_website?: string;
  industry?: string;
  company_size?: string;
  contact_name: string;
  contact_role?: string;
  contact_email: string;
  country?: string;
  city?: string;
  segment: string;
  priority: string;
  status: string;
  score: number;
  last_contacted_at?: string;
  last_replied_at?: string;
  created_at: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  description?: string;
  target_segment: string;
  goal: string;
  tonality: string;
  sender_name: string;
  sender_email: string;
  is_active: boolean;
  is_paused: boolean;
  stats: { sent: number; opened: number; clicked: number; replied: number; converted: number };
  created_at: string;
}

export interface OutreachEmail {
  id: string;
  lead_id: string;
  campaign_id?: string;
  subject: string;
  body: string;
  status: string;
  confidence_level?: string;
  sequence_step: number;
  sent_at?: string;
  opened_at?: string;
  replied_at?: string;
  created_at: string;
  lead?: OutreachLead;
  campaign?: OutreachCampaign;
}

export interface OutreachConversation {
  id: string;
  lead_id: string;
  subject?: string;
  status: string;
  intent?: string;
  sentiment?: string;
  message_count: number;
  last_message_at?: string;
  lead?: OutreachLead;
}

export function useOutreachLeads() {
  return useQuery({
    queryKey: ['outreach-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OutreachLead[];
    }
  });
}

export function useOutreachCampaigns() {
  return useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(campaign => ({
        ...campaign,
        stats: (campaign.stats as any) || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 }
      })) as OutreachCampaign[];
    }
  });
}

export function useOutreachEmails(status?: string) {
  return useQuery({
    queryKey: ['outreach-emails', status],
    queryFn: async () => {
      let query = supabase
        .from('outreach_emails')
        .select('*, lead:outreach_leads(*), campaign:outreach_campaigns(*)')
        .order('created_at', { ascending: false });
      
      if (status) query = query.eq('status', status);
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map(email => ({
        ...email,
        campaign: email.campaign ? {
          ...email.campaign,
          stats: ((email.campaign as any).stats as any) || { sent: 0, opened: 0, clicked: 0, replied: 0, converted: 0 }
        } : undefined
      })) as OutreachEmail[];
    }
  });
}

export function useOutreachConversations() {
  return useQuery({
    queryKey: ['outreach-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_conversations')
        .select('*, lead:outreach_leads(*)')
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data as OutreachConversation[];
    }
  });
}

export function useOutreachStats() {
  return useQuery({
    queryKey: ['outreach-stats'],
    queryFn: async () => {
      const [leads, emails, campaigns, conversations] = await Promise.all([
        supabase.from('outreach_leads').select('id, status', { count: 'exact' }),
        supabase.from('outreach_emails').select('id, status, opened_at, replied_at', { count: 'exact' }),
        supabase.from('outreach_campaigns').select('stats'),
        supabase.from('outreach_conversations').select('id, intent', { count: 'exact' })
      ]);

      const totalSent = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.sent || 0), 0) || 0;
      const totalOpened = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.opened || 0), 0) || 0;
      const totalReplied = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.replied || 0), 0) || 0;

      return {
        totalLeads: leads.count || 0,
        totalEmails: emails.count || 0,
        totalSent,
        totalOpened,
        totalReplied,
        openRate: totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : 0,
        replyRate: totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(1) : 0,
        conversations: conversations.count || 0
      };
    }
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: Partial<OutreachCampaign>) => {
      const { data, error } = await supabase
        .from('outreach_campaigns')
        .insert(campaign as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success('Kampagne erstellt');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useApproveEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      const { error: updateError } = await supabase
        .from('outreach_emails')
        .update({ status: 'approved' })
        .eq('id', emailId);
      if (updateError) throw updateError;

      const { error: queueError } = await supabase
        .from('outreach_send_queue')
        .insert({ email_id: emailId, scheduled_at: new Date().toISOString() });
      if (queueError) throw queueError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
      toast.success('E-Mail freigegeben und in Queue eingereiht');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useGenerateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, campaignId }: { leadId: string; campaignId: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-outreach-email', {
        body: { lead_id: leadId, campaign_id: campaignId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
      toast.success('E-Mail generiert');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

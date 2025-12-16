import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface HiringSignal {
  title?: string;
  url?: string;
  location?: string;
  date?: string;
}

export interface JobChangeData {
  prev_company?: string;
  prev_title?: string;
  new_company?: string;
  new_title?: string;
  date?: string;
}

export interface LocationMoveData {
  from_country?: string;
  from_state?: string;
  to_country?: string;
  to_state?: string;
  move_date?: string;
}

export interface OutreachLead {
  id: string;
  
  // Basis
  contact_name: string;
  contact_email: string;
  company_name: string;
  
  // Person erweitert
  first_name?: string | null;
  last_name?: string | null;
  contact_role?: string | null;
  seniority?: string | null;
  department?: string | null;
  education?: string | null;
  
  // Telefon
  contact_phone?: string | null;
  mobile_phone?: string | null;
  direct_phone?: string | null;
  office_phone?: string | null;
  
  // LinkedIn
  personal_linkedin_url?: string | null;
  contact_linkedin?: string | null;
  
  // E-Mail-Qualität
  email_quality?: string | null;
  email_validation_status?: string | null;
  email_verification_status?: string | null;
  email_validated?: boolean | null;
  
  // Unternehmen
  company_alias?: string | null;
  company_type?: string | null;
  company_description?: string | null;
  company_website?: string | null;
  company_domain?: string | null;
  company_linkedin_url?: string | null;
  company_headcount?: number | null;
  company_size?: string | null;
  company_founded_year?: number | null;
  company_industries?: any | null;
  company_technologies?: any | null;
  company_financials?: string | null;
  revenue_range?: string | null;
  industry?: string | null;
  
  // Firmen-Adresse
  company_address_line?: string | null;
  company_city?: string | null;
  company_zip?: string | null;
  company_state?: string | null;
  company_country?: string | null;
  
  // HQ
  hq_name?: string | null;
  hq_address_line?: string | null;
  hq_city?: string | null;
  hq_zip?: string | null;
  hq_state?: string | null;
  hq_country?: string | null;
  
  // Location (Legacy)
  city?: string | null;
  country?: string | null;
  region?: string | null;
  
  // Hiring-Signale (KRITISCH FÜR OUTREACH!)
  hiring_signals?: any | null;
  hiring_volume?: string | null;
  open_positions_estimate?: number | null;
  recruiting_challenges?: any | null;
  
  // Wechsel-Signale
  job_change_data?: any | null;
  location_move_data?: any | null;
  
  // Meta
  segment: string;
  priority: string;
  status: string;
  score: number;
  lead_source?: string | null;
  list_name?: string | null;
  profile_id?: string | null;
  sid?: string | null;
  tags?: any | null;
  custom_attributes?: any | null;
  language?: string | null;
  notes?: string | null;
  
  // System
  is_suppressed?: boolean | null;
  suppression_reason?: string | null;
  duplicate_of?: string | null;
  has_replied?: boolean | null;
  reply_sentiment?: string | null;
  
  // Timestamps
  created_at: string;
  updated_at?: string | null;
  last_contacted_at?: string | null;
  last_replied_at?: string | null;
  converted_at?: string | null;
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
  used_variables?: string[];
  generation_prompt?: string;
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

// ============ LEADS ============

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

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lead: Partial<OutreachLead>) => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .insert({
          company_name: lead.company_name!,
          contact_name: lead.contact_name!,
          contact_email: lead.contact_email!,
          contact_role: lead.contact_role,
          company_website: lead.company_website,
          industry: lead.industry,
          company_size: lead.company_size,
          country: lead.country,
          city: lead.city,
          segment: lead.segment || 'unknown',
          priority: lead.priority || 'medium',
          status: 'new',
          score: lead.score || 50,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      toast.success('Lead erstellt');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutreachLead> & { id: string }) => {
      const { error } = await supabase
        .from('outreach_leads')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      toast.success('Lead aktualisiert');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outreach_leads')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-stats'] });
      toast.success('Lead gelöscht');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

// ============ CAMPAIGNS ============

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

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<OutreachCampaign> & { id: string }) => {
      const { error } = await supabase
        .from('outreach_campaigns')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success('Kampagne aktualisiert');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useToggleCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('outreach_campaigns')
        .update({ is_active: isActive, is_paused: !isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success('Kampagnenstatus geändert');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outreach_campaigns')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      toast.success('Kampagne gelöscht');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

// ============ EMAILS ============

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

export function useRejectEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from('outreach_emails')
        .update({ status: 'rejected' })
        .eq('id', emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
      toast.success('E-Mail abgelehnt');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useRegenerateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emailId: string) => {
      // Get the email to find lead and campaign
      const { data: email, error: fetchError } = await supabase
        .from('outreach_emails')
        .select('lead_id, campaign_id, sequence_step')
        .eq('id', emailId)
        .single();
      
      if (fetchError) throw fetchError;

      // Delete the old email
      await supabase.from('outreach_emails').delete().eq('id', emailId);

      // Generate a new one
      const { error } = await supabase.functions.invoke('generate-outreach-email', {
        body: { 
          lead_id: email.lead_id, 
          campaign_id: email.campaign_id,
          sequence_step: email.sequence_step
        }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-emails'] });
      toast.success('E-Mail wird neu generiert');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

export function useGenerateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, campaignId }: { leadId: string; campaignId: string }) => {
      const { data, error } = await supabase.functions.invoke('generate-outreach-email', {
        body: { lead_id: leadId, campaign_id: campaignId, sequence_step: 1 }
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

// ============ SEQUENCES ============

export function useStartSequence() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, campaignId }: { leadId: string; campaignId: string }) => {
      // Check if sequence already exists
      const { data: existing } = await supabase
        .from('outreach_sequences')
        .select('id')
        .eq('lead_id', leadId)
        .eq('campaign_id', campaignId)
        .single();

      if (existing) {
        throw new Error('Sequenz existiert bereits für diesen Lead');
      }

      const { error } = await supabase
        .from('outreach_sequences')
        .insert({
          lead_id: leadId,
          campaign_id: campaignId,
          current_step: 1,
          status: 'active',
          next_send_at: new Date().toISOString(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-sequences'] });
      toast.success('Sequenz gestartet');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

// ============ CONVERSATIONS ============

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

// ============ QUEUE STATUS ============

export interface QueueItem {
  id: string;
  email_id: string;
  status: string;
  scheduled_at: string;
  sent_at?: string;
  attempts: number;
  error_message?: string;
  email?: {
    subject: string;
    lead?: {
      contact_name: string;
      company_name: string;
    };
  };
}

export function useQueueStatus() {
  return useQuery({
    queryKey: ['outreach-queue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_send_queue')
        .select('*, email:outreach_emails(subject, lead:outreach_leads(contact_name, company_name))')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as unknown as QueueItem[];
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

export function useRetryQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('outreach_send_queue')
        .update({ status: 'pending', attempts: 0, error_message: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-queue'] });
      toast.success('Versuch wird wiederholt');
    },
    onError: (err: any) => toast.error(err.message)
  });
}

// ============ STATS ============

export function useOutreachStats() {
  return useQuery({
    queryKey: ['outreach-stats'],
    queryFn: async () => {
      const [leads, emails, campaigns, conversations, pendingReview, queue] = await Promise.all([
        supabase.from('outreach_leads').select('id, status', { count: 'exact' }),
        supabase.from('outreach_emails').select('id, status, opened_at, replied_at', { count: 'exact' }),
        supabase.from('outreach_campaigns').select('stats'),
        supabase.from('outreach_conversations').select('id, intent', { count: 'exact' }),
        supabase.from('outreach_emails').select('id', { count: 'exact' }).eq('status', 'review'),
        supabase.from('outreach_send_queue').select('status')
      ]);

      const totalSent = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.sent || 0), 0) || 0;
      const totalOpened = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.opened || 0), 0) || 0;
      const totalReplied = campaigns.data?.reduce((acc, c) => acc + ((c.stats as any)?.replied || 0), 0) || 0;

      const newLeads = leads.data?.filter(l => l.status === 'new').length || 0;
      const contactedLeads = leads.data?.filter(l => l.status === 'contacted').length || 0;
      const repliedLeads = leads.data?.filter(l => l.status === 'replied').length || 0;

      const queuePending = queue.data?.filter(q => q.status === 'pending').length || 0;
      const queueProcessing = queue.data?.filter(q => q.status === 'processing').length || 0;
      const queueCompleted = queue.data?.filter(q => q.status === 'completed').length || 0;
      const queueFailed = queue.data?.filter(q => q.status === 'failed').length || 0;

      return {
        totalLeads: leads.count || 0,
        newLeads,
        contactedLeads,
        repliedLeads,
        totalEmails: emails.count || 0,
        pendingReview: pendingReview.count || 0,
        totalSent,
        totalOpened,
        totalReplied,
        openRate: totalSent > 0 ? (totalOpened / totalSent * 100).toFixed(1) : '0',
        replyRate: totalSent > 0 ? (totalReplied / totalSent * 100).toFixed(1) : '0',
        conversations: conversations.count || 0,
        queuePending,
        queueProcessing,
        queueCompleted,
        queueFailed
      };
    }
  });
}

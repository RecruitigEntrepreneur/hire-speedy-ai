import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CompanyOutreachUpdate {
  id: string;
  outreach_status?: string;
  warm_score?: number;
  best_entry_point_id?: string;
  last_activity_at?: string;
  company_notes?: string;
  platform_fit?: string[];
}

export interface ContactOutreachUpdate {
  id: string;
  decision_level?: string;
  functional_area?: string;
  contact_outreach_status?: string;
  is_primary_contact?: boolean;
  engagement_score?: number;
}

// Update company outreach fields
export function useUpdateCompanyOutreach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CompanyOutreachUpdate) => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .update({
          ...updates,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-company'] });
      toast.success('Unternehmen aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Update contact outreach fields
export function useUpdateContactOutreach() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ContactOutreachUpdate) => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-company'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      toast.success('Kontakt aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Get work queue (companies to work on)
export function useWorkQueue() {
  return useQuery({
    queryKey: ['outreach-work-queue'],
    queryFn: async () => {
      // Get companies with high priority that need attention
      const { data: companies, error } = await supabase
        .from('outreach_companies')
        .select('*')
        .in('outreach_status', ['unberührt', 'in_kontakt'])
        .or('hiring_activity.eq.hot,hiring_activity.eq.active')
        .order('warm_score', { ascending: false })
        .order('priority_score', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get lead counts for each company
      const companyIds = companies?.map(c => c.id) || [];
      
      if (companyIds.length === 0) return [];

      const { data: leads, error: leadsError } = await supabase
        .from('outreach_leads')
        .select('company_id, contact_outreach_status, decision_level')
        .in('company_id', companyIds);

      if (leadsError) throw leadsError;

      // Aggregate lead info
      const leadInfoMap = new Map<string, {
        total: number;
        unkontaktiert: number;
        entscheider_unkontaktiert: number;
        geantwortet: number;
      }>();

      companyIds.forEach(id => {
        leadInfoMap.set(id, {
          total: 0,
          unkontaktiert: 0,
          entscheider_unkontaktiert: 0,
          geantwortet: 0,
        });
      });

      leads?.forEach(lead => {
        if (!lead.company_id) return;
        const info = leadInfoMap.get(lead.company_id);
        if (!info) return;

        info.total++;
        if (lead.contact_outreach_status === 'nicht_kontaktiert') {
          info.unkontaktiert++;
          if (lead.decision_level === 'entscheider') {
            info.entscheider_unkontaktiert++;
          }
        }
        if (lead.contact_outreach_status === 'geantwortet') {
          info.geantwortet++;
        }
      });

      return companies?.map(company => ({
        ...company,
        lead_info: leadInfoMap.get(company.id) || {
          total: 0,
          unkontaktiert: 0,
          entscheider_unkontaktiert: 0,
          geantwortet: 0,
        },
      })) || [];
    },
  });
}

// Calculate and update warm score for a company
export function useCalculateWarmScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      // Get all leads for this company
      const { data: leads, error: leadsError } = await supabase
        .from('outreach_leads')
        .select('contact_outreach_status, engagement_score')
        .eq('company_id', companyId);

      if (leadsError) throw leadsError;

      // Calculate warm score based on lead engagement
      let warmScore = 0;
      
      leads?.forEach(lead => {
        switch (lead.contact_outreach_status) {
          case 'geantwortet':
            warmScore += 30;
            break;
          case 'geöffnet':
            warmScore += 15;
            break;
          case 'kontaktiert':
            warmScore += 5;
            break;
        }
        warmScore += (lead.engagement_score || 0) / 10;
      });

      // Cap at 100
      warmScore = Math.min(100, Math.round(warmScore));

      // Update company
      const { data, error } = await supabase
        .from('outreach_companies')
        .update({ warm_score: warmScore })
        .eq('id', companyId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-company'] });
    },
  });
}

// Get outreach stats
export function useOutreachStats() {
  return useQuery({
    queryKey: ['outreach-stats'],
    queryFn: async () => {
      const { data: companies, error } = await supabase
        .from('outreach_companies')
        .select('outreach_status, warm_score');

      if (error) throw error;

      const stats = {
        total: companies?.length || 0,
        unberührt: 0,
        in_kontakt: 0,
        qualifiziert: 0,
        deal_gewonnen: 0,
        verloren: 0,
        warm: 0, // warm_score > 30
      };

      companies?.forEach(c => {
        const status = (c.outreach_status || 'unberührt') as keyof typeof stats;
        if (status in stats && typeof stats[status] === 'number') {
          (stats[status] as number)++;
        }
        if ((c.warm_score || 0) > 30) {
          stats.warm++;
        }
      });

      return stats;
    },
  });
}

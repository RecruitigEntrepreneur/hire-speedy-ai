import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface LiveJob {
  title: string;
  location?: string | null;
  department?: string | null;
  url?: string | null;
  posted_date?: string | null;
}

export interface LeadWithCareerData {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_role?: string | null;
  company_domain?: string | null;
  company_website?: string | null;
  career_page_url?: string | null;
  career_page_status?: string | null;
  live_jobs?: LiveJob[] | null;
  live_jobs_count?: number | null;
  career_crawled_at?: string | null;
  hiring_activity?: string | null;
  status: string;
}

// Fetch leads with career data
export function useLeadsWithCareerData() {
  return useQuery({
    queryKey: ['leads-career-data'],
    queryFn: async (): Promise<LeadWithCareerData[]> => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('id, company_name, contact_name, contact_email, contact_role, company_domain, company_website, career_page_url, career_page_status, live_jobs, live_jobs_count, career_crawled_at, hiring_activity, status')
        .order('live_jobs_count', { ascending: false, nullsFirst: false });

      if (error) throw error;
      
      // Map the data to handle JSON types properly
      return (data || []).map(lead => ({
        id: lead.id,
        company_name: lead.company_name,
        contact_name: lead.contact_name,
        contact_email: lead.contact_email,
        contact_role: lead.contact_role,
        company_domain: lead.company_domain,
        company_website: lead.company_website,
        career_page_url: lead.career_page_url,
        career_page_status: lead.career_page_status,
        live_jobs: (Array.isArray(lead.live_jobs) ? lead.live_jobs : []) as unknown as LiveJob[],
        live_jobs_count: lead.live_jobs_count,
        career_crawled_at: lead.career_crawled_at,
        hiring_activity: lead.hiring_activity,
        status: lead.status
      }));
    },
  });
}

// Crawl single career page
export function useCrawlCareerPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.functions.invoke('crawl-career-page', {
        body: { lead_id: leadId }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['leads-career-data'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      
      if (data.success) {
        if (data.career_page_status === 'found') {
          toast.success(`${data.live_jobs_count} Stellen gefunden`);
        } else if (data.career_page_status === 'not_found') {
          toast.info('Keine Karriereseite gefunden');
        }
      } else {
        toast.error(data.error || 'Crawl fehlgeschlagen');
      }
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    }
  });
}

// Crawl multiple career pages
export function useCrawlCareerPagesBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadIds, forceRefresh = false }: { leadIds: string[]; forceRefresh?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('crawl-career-pages-bulk', {
        body: { lead_ids: leadIds, force_refresh: forceRefresh }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads-career-data'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      
      toast.success(`${data.processed}/${data.total} Karriereseiten gecrawlt`);
    },
    onError: (error) => {
      toast.error(`Bulk-Crawl fehlgeschlagen: ${error.message}`);
    }
  });
}

// Get hiring activity stats
export function useHiringActivityStats() {
  return useQuery({
    queryKey: ['hiring-activity-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_leads')
        .select('hiring_activity');

      if (error) throw error;

      const stats = {
        hot: 0,
        active: 0,
        low: 0,
        none: 0,
        unknown: 0,
        pending: 0,
        total: data?.length || 0
      };

      data?.forEach(lead => {
        const activity = lead.hiring_activity || 'unknown';
        if (activity === 'hot') stats.hot++;
        else if (activity === 'active') stats.active++;
        else if (activity === 'low') stats.low++;
        else if (activity === 'none') stats.none++;
        else if (activity === 'unknown') stats.unknown++;
        
        // Count leads that haven't been crawled
        if (!lead.hiring_activity || lead.hiring_activity === 'unknown') {
          stats.pending++;
        }
      });

      return stats;
    },
  });
}

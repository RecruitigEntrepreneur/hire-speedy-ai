import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface LiveJob {
  title: string;
  location?: string;
  department?: string;
  url?: string;
  type?: string;
  // Extended job details
  description?: string;
  requirements?: string[];
  nice_to_haves?: string[];
  tech_stack?: string[];
  experience_level?: string;
  salary_range?: string;
  benefits?: string[];
  remote_policy?: string;
  posted_at?: string;
  scraped_at?: string;
}

export interface NewsItem {
  title: string;
  url: string;
  date?: string;
  summary?: string;
  source?: string;
}

export interface OutreachCompany {
  id: string;
  domain: string;
  name: string;
  website?: string | null;
  linkedin_url?: string | null;
  description?: string | null;
  industry?: string | null;
  headcount?: number | null;
  founded_year?: number | null;
  founding_year?: number | null;
  technologies?: Json;
  city?: string | null;
  country?: string | null;
  address?: string | null;
  career_page_url?: string | null;
  career_page_status?: string | null;
  live_jobs?: Json;
  live_jobs_count?: number | null;
  hiring_activity?: string | null;
  career_crawled_at?: string | null;
  recent_news?: Json;
  news_crawled_at?: string | null;
  company_updates?: Json;
  priority_score?: number | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Company-First fields
  outreach_status?: string | null;
  warm_score?: number | null;
  best_entry_point_id?: string | null;
  last_activity_at?: string | null;
  company_notes?: string | null;
  platform_fit?: string[] | null;
  // Intelligence fields
  revenue_range?: string | null;
  revenue_trend?: string | null;
  employee_growth?: string | null;
  intelligence_score?: number | null;
  last_enriched_at?: string | null;
  social_linkedin?: string | null;
  social_twitter?: string | null;
  // Extended intelligence fields
  cloud_provider?: string | null;
  development_tools?: Json;
  kununu_score?: number | null;
  kununu_reviews?: number | null;
  glassdoor_score?: number | null;
  glassdoor_reviews?: number | null;
  key_executives?: Json;
  funding_total?: string | null;
  funding_stage?: string | null;
  funding_date?: string | null;
  awards?: Json;
  remote_policy?: string | null;
  company_culture?: Json;
  // Crawl source tracking
  crawl_sources?: Json;
}

export interface CompanyWithLeads extends OutreachCompany {
  leads_count: number;
}

// Extract domain from email
export function extractDomainFromEmail(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

// Fetch all companies
export function useOutreachCompanies() {
  return useQuery({
    queryKey: ['outreach-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .select('*')
        .order('priority_score', { ascending: false });

      if (error) throw error;
      return (data || []) as OutreachCompany[];
    },
  });
}

// Fetch companies with lead counts
export function useCompaniesWithLeadCounts() {
  return useQuery({
    queryKey: ['outreach-companies-with-leads'],
    queryFn: async () => {
      // Get all companies
      const { data: companies, error: companiesError } = await supabase
        .from('outreach_companies')
        .select('*')
        .order('priority_score', { ascending: false });

      if (companiesError) throw companiesError;

      // Get lead counts per company
      const { data: leadCounts, error: leadsError } = await supabase
        .from('outreach_leads')
        .select('company_id')
        .not('company_id', 'is', null);

      if (leadsError) throw leadsError;

      // Count leads per company
      const countMap = new Map<string, number>();
      leadCounts?.forEach((lead) => {
        if (lead.company_id) {
          countMap.set(lead.company_id, (countMap.get(lead.company_id) || 0) + 1);
        }
      });

      return (companies || []).map((company) => ({
        ...company,
        leads_count: countMap.get(company.id) || 0,
      })) as CompanyWithLeads[];
    },
  });
}

// Fetch single company with leads
export function useCompanyWithLeads(companyId: string | null) {
  return useQuery({
    queryKey: ['outreach-company', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data: company, error: companyError } = await supabase
        .from('outreach_companies')
        .select('*')
        .eq('id', companyId)
        .single();

      if (companyError) throw companyError;

      const { data: leads, error: leadsError } = await supabase
        .from('outreach_leads')
        .select('*')
        .eq('company_id', companyId);

      if (leadsError) throw leadsError;

      return {
        company: company as OutreachCompany,
        leads: leads || [],
      };
    },
    enabled: !!companyId,
  });
}

// Create company
export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: { domain: string; name: string; website?: string }) => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .insert(company)
        .select()
        .single();

      if (error) throw error;
      return data as OutreachCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      toast.success('Unternehmen erstellt');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Update company
export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; website?: string; industry?: string; city?: string }) => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as OutreachCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      toast.success('Unternehmen aktualisiert');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Delete company
export function useDeleteCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      // First unlink all leads
      await supabase
        .from('outreach_leads')
        .update({ company_id: null })
        .eq('company_id', companyId);

      const { error } = await supabase
        .from('outreach_companies')
        .delete()
        .eq('id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-leads'] });
      toast.success('Unternehmen gelöscht');
    },
    onError: (error: Error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });
}

// Crawl company data (jobs + news)
export function useCrawlCompanyData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string) => {
      // First get company data for proper crawl parameters
      const { data: company, error: fetchError } = await supabase
        .from('outreach_companies')
        .select('domain, name')
        .eq('id', companyId)
        .single();

      if (fetchError || !company) {
        throw new Error('Unternehmen nicht gefunden');
      }

      // Multi-source crawl with all parameters
      const { data, error } = await supabase.functions.invoke('crawl-company-data', {
        body: { 
          company_id: companyId,
          domain: company.domain,
          company_name: company.name,
          crawl_news: true,
          crawl_extended: true,
          crawl_all_sources: true
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-company'] });
      queryClient.invalidateQueries({ queryKey: ['company-leads'] });
      const jobCount = data?.data?.live_jobs_count || 0;
      const newsCount = data?.data?.recent_news?.length || 0;
      const contactsCount = data?.data?.key_executives?.length || 0;
      toast.success(`Crawl abgeschlossen`, {
        description: `${jobCount} Jobs, ${newsCount} News, ${contactsCount} Kontakte gefunden`
      });
    },
    onError: (error: Error) => {
      toast.error(`Crawl-Fehler: ${error.message}`);
    },
  });
}

// Bulk crawl companies
export function useCrawlCompaniesBulk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyIds: string[]) => {
      const results = [];
      
      for (const companyId of companyIds) {
        try {
          const { data, error } = await supabase.functions.invoke('crawl-company-data', {
            body: { company_id: companyId },
          });
          
          if (error) {
            results.push({ companyId, success: false, error: error.message });
          } else {
            results.push({ companyId, success: true, data });
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err: any) {
          results.push({ companyId, success: false, error: err.message });
        }
      }
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      const successful = results.filter(r => r.success).length;
      toast.success(`${successful}/${results.length} Unternehmen gecrawlt`);
    },
    onError: (error: Error) => {
      toast.error(`Bulk-Crawl-Fehler: ${error.message}`);
    },
  });
}

// Get or create company from email domain
export function useGetOrCreateCompanyFromEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, companyName }: { email: string; companyName: string }) => {
      const domain = extractDomainFromEmail(email);
      
      if (!domain) {
        throw new Error('Ungültige E-Mail-Adresse');
      }

      // Check if company exists
      const { data: existing, error: fetchError } = await supabase
        .from('outreach_companies')
        .select('id')
        .eq('domain', domain)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        return existing.id;
      }

      // Create new company
      const { data: newCompany, error: createError } = await supabase
        .from('outreach_companies')
        .insert({
          domain,
          name: companyName,
          website: `https://${domain}`,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      return newCompany.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
    },
  });
}

// Company stats
export function useCompanyStats() {
  return useQuery({
    queryKey: ['outreach-company-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outreach_companies')
        .select('hiring_activity, status');

      if (error) throw error;

      const stats = {
        total: data?.length || 0,
        hot: 0,
        active: 0,
        low: 0,
        none: 0,
        unknown: 0,
      };

      data?.forEach((company) => {
        const activity = company.hiring_activity as keyof typeof stats;
        if (activity && activity in stats) {
          stats[activity]++;
        } else {
          stats.unknown++;
        }
      });

      return stats;
    },
  });
}

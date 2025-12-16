import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnrichmentResult {
  name: string;
  description?: string;
  industry?: string;
  city?: string;
  country?: string;
  headcount?: number;
  founding_year?: number;
  technologies?: string[];
  social_linkedin?: string;
  social_twitter?: string;
  revenue_range?: string;
  employee_growth?: string;
}

interface CompanyInsight {
  id: string;
  type: 'hiring' | 'funding' | 'management' | 'expansion' | 'news' | 'tech';
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  weight: number;
  outreach_angle?: string;
  relevant_roles?: string[];
}

// Normalize domain from any input
function normalizeDomain(input: string): string {
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  return domain;
}

// Create company from domain only - AI does the rest
export function useCreateCompanyFromDomain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (domain: string): Promise<{ id: string; name: string; data: EnrichmentResult }> => {
      const normalizedDomain = normalizeDomain(domain);
      
      if (!normalizedDomain || !normalizedDomain.includes('.')) {
        throw new Error('Ungültige Domain');
      }

      // Check if company already exists
      const { data: existing } = await supabase
        .from('outreach_companies')
        .select('id, name')
        .eq('domain', normalizedDomain)
        .maybeSingle();

      if (existing) {
        throw new Error(`Unternehmen "${existing.name}" existiert bereits`);
      }

      // Call enrichment edge function
      const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('enrich-company-from-domain', {
        body: { domain: normalizedDomain }
      });

      if (enrichError) throw enrichError;
      if (!enrichResult?.success) throw new Error(enrichResult?.error || 'Enrichment fehlgeschlagen');

      const enrichData: EnrichmentResult = enrichResult.data;

      // Create company with enriched data
      const { data: newCompany, error: createError } = await supabase
        .from('outreach_companies')
        .insert({
          domain: normalizedDomain,
          name: enrichData.name,
          website: `https://${normalizedDomain}`,
          description: enrichData.description,
          industry: enrichData.industry,
          city: enrichData.city,
          headcount: enrichData.headcount,
          founding_year: enrichData.founding_year,
          technologies: enrichData.technologies || [],
          social_linkedin: enrichData.social_linkedin,
          social_twitter: enrichData.social_twitter,
          revenue_range: enrichData.revenue_range,
          employee_growth: enrichData.employee_growth,
          outreach_status: 'neu',
          warm_score: 0,
          last_enriched_at: new Date().toISOString(),
        })
        .select('id, name')
        .single();

      if (createError) throw createError;

      // Trigger job/news crawl in background
      supabase.functions.invoke('crawl-company-data', {
        body: { company_id: newCompany.id, domain: normalizedDomain, company_name: newCompany.name }
      }).catch(err => console.error('Background crawl error:', err));

      return { 
        id: newCompany.id, 
        name: newCompany.name,
        data: enrichData 
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
      toast.success(`"${result.name}" wurde angelegt`, {
        description: 'Jobs & News werden im Hintergrund geladen...'
      });
    },
    onError: (error: Error) => {
      toast.error('Fehler beim Anlegen', { description: error.message });
    },
  });
}

// Generate insights for a company
export function useGenerateCompanyInsights() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyId: string): Promise<{ score: number; insights: CompanyInsight[] }> => {
      const { data, error } = await supabase.functions.invoke('generate-company-insights', {
        body: { company_id: companyId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Insight-Generierung fehlgeschlagen');

      return {
        score: data.intelligence_score,
        insights: data.insights,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-companies'] });
    },
  });
}

// Fetch company intelligence history
export function useCompanyIntelligence(companyId: string | null) {
  return {
    data: null,
    isLoading: false,
  };
}

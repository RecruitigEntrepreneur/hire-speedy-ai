import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EnrichmentResult {
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  tech_environment: string[];
  hiring_urgency: string;
  normalized_skills: string[];
  company_insights: {
    live_jobs_count: number | null;
    career_page_url: string | null;
    linkedin_url: string | null;
    recent_news: string | null;
  };
}

interface JobDataForEnrichment {
  title: string;
  company_name: string;
  description: string | null;
  skills: string[];
  location: string | null;
  remote_type: string | null;
}

export function useJobEnrichment() {
  const [enriching, setEnriching] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract domain from company name or website
  const extractCompanyDomain = (companyName: string): string | null => {
    // Common domain patterns
    const cleanName = companyName
      .toLowerCase()
      .replace(/\s+(gmbh|ag|se|inc|ltd|llc|corp|co\.?|kg|ohg)\.?$/i, '')
      .replace(/[^a-z0-9]/g, '');
    
    if (cleanName.length < 3) return null;
    return `${cleanName}.com`;
  };

  const enrichJobData = async (jobData: JobDataForEnrichment): Promise<EnrichmentResult | null> => {
    setEnriching(true);
    setError(null);

    try {
      const companyDomain = extractCompanyDomain(jobData.company_name);
      
      console.log('Starting job enrichment for:', jobData.company_name, 'Domain:', companyDomain);

      const { data, error: fnError } = await supabase.functions.invoke('enrich-job-data', {
        body: { 
          jobData,
          companyDomain 
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const result = data.data as EnrichmentResult;
      setEnrichmentData(result);
      
      // Show success with details
      const enrichedFields = [];
      if (result.industry) enrichedFields.push('Industrie');
      if (result.company_size_band) enrichedFields.push('Größe');
      if (result.funding_stage) enrichedFields.push('Funding');
      if (result.tech_environment.length > 0) enrichedFields.push(`${result.tech_environment.length} Tech-Skills`);
      
      if (enrichedFields.length > 0) {
        toast.success(`Angereichert: ${enrichedFields.join(', ')}`);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der Anreicherung';
      setError(errorMessage);
      console.error('Job enrichment error:', err);
      // Don't show error toast - enrichment is optional
      return null;
    } finally {
      setEnriching(false);
    }
  };

  const clearEnrichment = () => {
    setEnrichmentData(null);
    setError(null);
  };

  return {
    enrichJobData,
    enriching,
    enrichmentData,
    error,
    clearEnrichment,
  };
}

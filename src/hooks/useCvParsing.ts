import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedCVData {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  skills: string[];
  experience_years: number | null;
  current_salary: number | null;
  expected_salary: number | null;
  notice_period: string | null;
  summary: string | null;
  languages: string[];
  education: string[];
  work_experience: Array<{
    company: string;
    title: string;
    duration: string;
    description: string;
  }>;
}

export function useCvParsing() {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCV = async (cvText: string, cvUrl?: string): Promise<ParsedCVData | null> => {
    setParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-cv', {
        body: { cvText, cvUrl },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('CV erfolgreich analysiert');
      return data.data as ParsedCVData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der CV-Analyse';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('CV parsing error:', err);
      return null;
    } finally {
      setParsing(false);
    }
  };

  return {
    parseCV,
    parsing,
    error,
  };
}

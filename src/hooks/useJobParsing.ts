import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedJobData {
  title: string;
  company_name: string;
  description: string | null;
  requirements: string | null;
  location: string | null;
  remote_type: string | null;
  employment_type: string | null;
  experience_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];
}

export function useJobParsing() {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseJobUrl = async (jobUrl: string): Promise<ParsedJobData | null> => {
    setParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-job-url', {
        body: { jobUrl },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Stellenanzeige erfolgreich analysiert');
      return data.data as ParsedJobData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Importieren der Stellenanzeige';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Job parsing error:', err);
      return null;
    } finally {
      setParsing(false);
    }
  };

  const parseJobText = async (jobText: string): Promise<ParsedJobData | null> => {
    setParsing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-job-url', {
        body: { jobText },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('Stellenanzeige erfolgreich analysiert');
      return data.data as ParsedJobData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der Analyse';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Job text parsing error:', err);
      return null;
    } finally {
      setParsing(false);
    }
  };

  return {
    parseJobUrl,
    parseJobText,
    parsing,
    error,
  };
}

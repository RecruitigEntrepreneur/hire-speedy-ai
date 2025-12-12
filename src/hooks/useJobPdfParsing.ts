import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ParsedJobProfile {
  title: string;
  company: string;
  description: string;
  requirements: string[];
  nice_to_have: string[];
  technical_skills: string[];
  soft_skills: string[];
  experience_years_min: number | null;
  experience_years_max: number | null;
  salary_min: number | null;
  salary_max: number | null;
  location: string;
  remote_policy: 'remote' | 'hybrid' | 'onsite' | 'flexible';
  employment_type: 'full-time' | 'part-time' | 'contract' | 'freelance';
  benefits: string[];
  company_culture: string;
  industry: string;
  seniority_level: 'junior' | 'mid' | 'senior' | 'lead' | 'principal' | 'director';
  team_info: string;
  application_process: string;
  ai_summary: string;
}

export function useJobPdfParsing() {
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadAndParsePdf = async (file: File): Promise<ParsedJobProfile | null> => {
    setError(null);
    setUploading(true);

    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('job-documents')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Upload fehlgeschlagen: ${uploadError.message}`);
      }

      setUploading(false);
      setParsing(true);

      // Call edge function to parse
      const { data, error: parseError } = await supabase.functions.invoke('parse-job-pdf', {
        body: { pdfPath: filePath }
      });

      if (parseError) {
        throw new Error(`Analyse fehlgeschlagen: ${parseError.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.data as ParsedJobProfile;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      return null;
    } finally {
      setUploading(false);
      setParsing(false);
    }
  };

  const parseJobText = async (text: string): Promise<ParsedJobProfile | null> => {
    setError(null);
    setParsing(true);

    try {
      const { data, error: parseError } = await supabase.functions.invoke('parse-job-pdf', {
        body: { jobText: text }
      });

      if (parseError) {
        throw new Error(`Analyse fehlgeschlagen: ${parseError.message}`);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data.data as ParsedJobProfile;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(message);
      return null;
    } finally {
      setParsing(false);
    }
  };

  return {
    uploadAndParsePdf,
    parseJobText,
    uploading,
    parsing,
    error,
    isLoading: uploading || parsing
  };
}

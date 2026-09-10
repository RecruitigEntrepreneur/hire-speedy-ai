import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedJobData {
  // Basis-Felder
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
  /** Contracting: der Tagessatz stand vorher nirgends und landete im
   *  schlimmsten Fall als Jahresgehalt in salary_min. */
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  skills: string[];
  must_haves: string[];
  nice_to_haves: string[];

  // Vom Parser eingeordnet und gegen skill_synonyms kanonisiert.
  // must_haves/nice_to_haves enthalten dadurch nur noch matchbare Skillnamen;
  // Sprachen, Zertifikate und Erfahrungsjahre stehen in eigenen Feldern statt
  // als unerfüllbare Muss-Kriterien in der Skill-Liste.
  requirements_classified?: {
    text: string;
    kind: 'technology' | 'method' | 'domain' | 'language'
        | 'certification' | 'education' | 'experience' | 'soft';
    skill?: string | null;
    required?: boolean;
    min_years?: number | null;
    language_code?: string | null;
    language_level?: string | null;
  }[];
  required_languages?: { code: string; minLevel: string }[];
  required_certifications?: string[];
  experience_min?: number | null;
  
  // Team & Struktur
  team_size: number | null;
  reports_to: string | null;
  department_structure: string | null;
  
  // Arbeitsweise
  core_hours: string | null;
  remote_days: number | null;
  overtime_policy: string | null;
  daily_routine: string | null;
  /** Einer der vier Chips aus dem Katalog-Slot task_focus. */
  task_focus?: string | null;
  
  // Kultur & Benefits
  company_culture: string | null;
  benefits_extracted: string[];
  unique_selling_points: string[];
  career_path: string | null;
  
  // Dringlichkeit
  hiring_urgency: 'standard' | 'urgent' | 'hot' | null;
  vacancy_reason: string | null;
  hiring_deadline_weeks: number | null;
  
  // Industrie & Firma (falls erkennbar)
  industry: string | null;
  company_size_estimate: string | null;
  /* Seit 09.09.2026 im Parser-Schema. Vorher fragte niemand danach, und in
     einer Messung mit einer Anzeige, die zu jedem Katalogfeld etwas sagte,
     kamen 22 von 39 Feldern nicht an.

     OPTIONAL, obwohl parse-job-url sie ausnahmslos liefert: Dieselbe Form
     entsteht auch aus dem PDF- und Text-Import (applyParsedJobProfile in
     CreateJob.tsx), und dort gibt es diese Angaben schlicht nicht. Sie
     pflichtig zu fuehren hiess, dem Aufrufer 23 Nullen abzuverlangen, die
     nichts bedeuten. Alle Leser rechnen ohnehin mit Abwesenheit
     (`?? []`, `Array.isArray`). */
  salary_months?: number | null;
  bonus_percent?: number | null;
  bonus_basis?: string[] | null;
  contract_limitation?: string | null;
  time_tracking_method?: string | null;
  works_council?: boolean | null;
  works_council_meeting_schedule?: string | null;
  contract_creation_days?: number | null;
  contract_sent_digitally?: boolean | null;
  negative_impact_if_unfilled?: string | null;
  task_breakdown?: { bereich: string; anteil: number }[] | null;
  decision_makers?: string[] | null;
  success_profile?: string | null;
  failure_profile?: string | null;
  position_advantages?: string[] | null;
  career_example?: string | null;
  contract_sensitive_topics?: string[] | null;
  industry_opportunities?: string | null;
  industry_challenges?: string | null;
  candidates_in_pipeline?: number | null;
  candidates_dropped_reason?: string | null;
  visa_sponsorship?: boolean | null;
  /** Was die Anzeige ausdruecklich als nachschulbar bezeichnet. */
  trainable_skills?: string[] | null;
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

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ExtractedIntakeData {
  team_size?: number;
  team_avg_age?: string;
  core_hours?: string;
  overtime_policy?: string;
  remote_days?: number;
  company_culture?: string;
  career_path?: string;
  success_profile?: string;
  failure_profile?: string;
  vacancy_reason?: string;
  hiring_deadline_weeks?: number;
  candidates_in_pipeline?: number;
  decision_makers?: string[];
  works_council?: boolean;
  daily_routine?: string;
  must_have_criteria?: string[];
  nice_to_have_criteria?: string[];
  trainable_skills?: string[];
  hiring_urgency?: 'standard' | 'urgent' | 'hot';
  unique_selling_points?: string[];
  position_advantages?: string[];
  reports_to?: string;
  department_structure?: string;
  bonus_structure?: string;
  industry_challenges?: string;
  industry_opportunities?: string;
  salary_min?: number;
  salary_max?: number;
}

export interface IntakeExtractionResult {
  extracted_data: ExtractedIntakeData;
  completeness: number;
  fields_found: number;
  total_fields: number;
}

export function useIntakeBriefing() {
  const [analyzing, setAnalyzing] = useState(false);
  const [lastResult, setLastResult] = useState<IntakeExtractionResult | null>(null);

  const analyzeBriefing = async (
    briefingText: string,
    existingData?: Partial<ExtractedIntakeData>
  ): Promise<IntakeExtractionResult | null> => {
    if (!briefingText || briefingText.trim().length < 20) {
      toast.error('Bitte geben Sie mehr Details ein (min. 20 Zeichen)');
      return null;
    }

    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('extract-intake-briefing', {
        body: {
          briefing_text: briefingText,
          existing_data: existingData
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      const result = data as IntakeExtractionResult;
      setLastResult(result);

      const fieldsFound = result.fields_found || 0;
      if (fieldsFound > 0) {
        toast.success(`${fieldsFound} Felder automatisch erkannt!`);
      } else {
        toast.info('Keine strukturierten Daten erkannt. Bitte ergänzen Sie die Details manuell.');
      }

      return result;

    } catch (error) {
      console.error('Error analyzing briefing:', error);
      toast.error('Fehler bei der Analyse. Bitte versuchen Sie es erneut.');
      return null;
    } finally {
      setAnalyzing(false);
    }
  };

  return {
    analyzeBriefing,
    analyzing,
    lastResult
  };
}

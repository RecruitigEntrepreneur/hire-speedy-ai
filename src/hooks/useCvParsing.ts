import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ParsedExperience {
  company_name: string;
  job_title: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string;
}

export interface ParsedEducation {
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  graduation_year: number | null;
  grade: string | null;
}

export interface ParsedSkill {
  name: string;
  category: string | null;
  level: string | null;
}

export interface ParsedLanguage {
  language: string;
  proficiency: string;
}

export interface ParsedCVData {
  // Stammdaten
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  website_url: string | null;
  
  // Beruflicher Hintergrund
  current_title: string | null;
  current_company: string | null;
  experience_years: number | null;
  seniority: string | null;
  
  // AI-Zusammenfassung
  cv_ai_summary: string | null;
  cv_ai_bullets: string[];
  
  // Strukturierte Daten
  experiences: ParsedExperience[];
  educations: ParsedEducation[];
  skills: ParsedSkill[];
  languages: ParsedLanguage[];
  
  // Gehalt & Verfügbarkeit
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  current_salary: number | null;
  notice_period: string | null;
  availability_from: string | null;
  relocation_ready: boolean;
  remote_preference: string | null;
  
  // Präferenzen
  target_roles: string[];
  target_industries: string[];
  target_employment_type: string | null;
}

export function useCvParsing() {
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const saveParsedCandidate = async (
    parsedData: ParsedCVData,
    cvRawText: string,
    recruiterId: string,
    existingCandidateId?: string
  ): Promise<string | null> => {
    setSaving(true);
    setError(null);

    try {
      // Prepare candidate data
      const candidateData = {
        full_name: parsedData.full_name || 'Unbekannt',
        email: parsedData.email || `unknown-${Date.now()}@placeholder.com`,
        phone: parsedData.phone,
        linkedin_url: parsedData.linkedin_url,
        city: parsedData.location,
        portfolio_url: parsedData.portfolio_url,
        github_url: parsedData.github_url,
        website_url: parsedData.website_url,
        job_title: parsedData.current_title,
        company: parsedData.current_company,
        experience_years: parsedData.experience_years,
        seniority: parsedData.seniority,
        cv_ai_summary: parsedData.cv_ai_summary,
        cv_ai_bullets: parsedData.cv_ai_bullets,
        summary: parsedData.cv_ai_summary,
        current_salary: parsedData.current_salary,
        expected_salary: parsedData.salary_expectation_max,
        salary_expectation_min: parsedData.salary_expectation_min,
        salary_expectation_max: parsedData.salary_expectation_max,
        notice_period: parsedData.notice_period,
        availability_date: parsedData.availability_from,
        relocation_willing: parsedData.relocation_ready,
        remote_preference: parsedData.remote_preference,
        remote_possible: parsedData.remote_preference === 'remote' || parsedData.remote_preference === 'hybrid',
        target_roles: parsedData.target_roles,
        target_industries: parsedData.target_industries,
        target_employment_type: parsedData.target_employment_type,
        cv_raw_text: cvRawText,
        cv_parsed_at: new Date().toISOString(),
        cv_parser_version: 'v2',
        import_source: 'cv_upload',
        skills: parsedData.skills.map(s => s.name),
        recruiter_id: recruiterId,
      };

      let candidateId: string;

      if (existingCandidateId) {
        // Update existing candidate
        const { error: updateError } = await supabase
          .from('candidates')
          .update(candidateData)
          .eq('id', existingCandidateId);

        if (updateError) throw updateError;
        candidateId = existingCandidateId;

        // Delete existing related data for re-import
        await Promise.all([
          supabase.from('candidate_experiences').delete().eq('candidate_id', candidateId),
          supabase.from('candidate_educations').delete().eq('candidate_id', candidateId),
          supabase.from('candidate_languages').delete().eq('candidate_id', candidateId),
          supabase.from('candidate_skills').delete().eq('candidate_id', candidateId),
        ]);
      } else {
        // Create new candidate
        const { data: newCandidate, error: insertError } = await supabase
          .from('candidates')
          .insert(candidateData)
          .select('id')
          .single();

        if (insertError) throw insertError;
        candidateId = newCandidate.id;
      }

      // Insert experiences
      if (parsedData.experiences.length > 0) {
        const experiencesData = parsedData.experiences.map((exp, index) => ({
          candidate_id: candidateId,
          company_name: exp.company_name,
          job_title: exp.job_title,
          location: exp.location,
          start_date: exp.start_date,
          end_date: exp.end_date,
          is_current: exp.is_current,
          description: exp.description,
          sort_order: index,
        }));

        const { error: expError } = await supabase
          .from('candidate_experiences')
          .insert(experiencesData);

        if (expError) console.error('Error inserting experiences:', expError);
      }

      // Insert educations
      if (parsedData.educations.length > 0) {
        const educationsData = parsedData.educations.map((edu, index) => ({
          candidate_id: candidateId,
          institution: edu.institution,
          degree: edu.degree,
          field_of_study: edu.field_of_study,
          graduation_year: edu.graduation_year,
          grade: edu.grade,
          sort_order: index,
        }));

        const { error: eduError } = await supabase
          .from('candidate_educations')
          .insert(educationsData);

        if (eduError) console.error('Error inserting educations:', eduError);
      }

      // Insert languages
      if (parsedData.languages.length > 0) {
        const languagesData = parsedData.languages.map(lang => ({
          candidate_id: candidateId,
          language: lang.language,
          proficiency: lang.proficiency,
        }));

        const { error: langError } = await supabase
          .from('candidate_languages')
          .insert(languagesData);

        if (langError) console.error('Error inserting languages:', langError);
      }

      // Insert structured skills
      if (parsedData.skills.length > 0) {
        const skillsData = parsedData.skills.map(skill => ({
          candidate_id: candidateId,
          skill_name: skill.name,
          category: skill.category,
          level: skill.level,
        }));

        const { error: skillError } = await supabase
          .from('candidate_skills')
          .insert(skillsData);

        if (skillError) console.error('Error inserting skills:', skillError);
      }

      toast.success(existingCandidateId ? 'Kandidat aktualisiert' : 'Kandidat erstellt');
      return candidateId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Speichern';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Save error:', err);
      return null;
    } finally {
      setSaving(false);
    }
  };

  return {
    parseCV,
    saveParsedCandidate,
    parsing,
    saving,
    error,
  };
}

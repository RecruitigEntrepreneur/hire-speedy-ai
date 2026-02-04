import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper function to normalize partial dates to valid YYYY-MM-DD format
const normalizeDate = (dateStr: string | null | undefined): string | null => {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim();
  
  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // YYYY-MM format → YYYY-MM-01
  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }
  
  // YYYY format → YYYY-01-01
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01-01`;
  }
  
  // German/English month names: "Juni 2023", "Jun 2023", "June 2023"
  const monthMap: Record<string, string> = {
    'januar': '01', 'jan': '01', 'january': '01',
    'februar': '02', 'feb': '02', 'february': '02',
    'märz': '03', 'mär': '03', 'mar': '03', 'march': '03',
    'april': '04', 'apr': '04',
    'mai': '05', 'may': '05',
    'juni': '06', 'jun': '06', 'june': '06',
    'juli': '07', 'jul': '07', 'july': '07',
    'august': '08', 'aug': '08',
    'september': '09', 'sep': '09', 'sept': '09',
    'oktober': '10', 'okt': '10', 'oct': '10', 'october': '10',
    'november': '11', 'nov': '11',
    'dezember': '12', 'dez': '12', 'dec': '12', 'december': '12'
  };
  
  // Match "Month Year" pattern
  const monthYearMatch = trimmed.toLowerCase().match(/^(\w+)\s+(\d{4})$/);
  if (monthYearMatch) {
    const month = monthMap[monthYearMatch[1]];
    const year = monthYearMatch[2];
    if (month && year) {
      return `${year}-${month}-01`;
    }
  }
  
  // Match "MM/YYYY" or "MM.YYYY" pattern
  const slashDotMatch = trimmed.match(/^(\d{1,2})[./](\d{4})$/);
  if (slashDotMatch) {
    const month = slashDotMatch[1].padStart(2, '0');
    const year = slashDotMatch[2];
    return `${year}-${month}-01`;
  }
  
  // Fallback: return null if not parseable
  console.warn(`Could not parse date: ${dateStr}`);
  return null;
};

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
  const [extractingPdf, setExtractingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extractTextFromPdf = async (pdfPath: string): Promise<string | null> => {
    setExtractingPdf(true);
    setError(null);

    try {
      console.log('Extracting text from PDF:', pdfPath);
      
      const { data, error: fnError } = await supabase.functions.invoke('parse-pdf', {
        body: { pdfPath },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast.success('PDF-Text extrahiert');
      return data.text as string;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Fehler bei der PDF-Verarbeitung';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('PDF extraction error:', err);
      return null;
    } finally {
      setExtractingPdf(false);
    }
  };

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
    existingCandidateId?: string,
    cvFileInfo?: { fileName: string; fileUrl: string; fileSize: number; mimeType: string }
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

      // Insert experiences with normalized dates
      if (parsedData.experiences.length > 0) {
        console.log(`Inserting ${parsedData.experiences.length} experiences for candidate ${candidateId}`);
        
        const experiencesData = parsedData.experiences.map((exp, index) => ({
          candidate_id: candidateId,
          company_name: exp.company_name,
          job_title: exp.job_title,
          location: exp.location,
          start_date: normalizeDate(exp.start_date),
          end_date: normalizeDate(exp.end_date),
          is_current: exp.is_current,
          description: exp.description,
          sort_order: index,
        }));

        console.log('Experience dates normalized:', experiencesData.map(e => ({
          company: e.company_name,
          start: e.start_date,
          end: e.end_date
        })));

        const { error: expError } = await supabase
          .from('candidate_experiences')
          .insert(experiencesData);

        if (expError) {
          console.error('Error inserting experiences:', expError);
        } else {
          console.log('Experiences inserted successfully');
        }
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

      // Save CV document to candidate_documents table
      if (cvFileInfo) {
        // Mark previous versions as not current
        await supabase
          .from('candidate_documents')
          .update({ is_current: false })
          .eq('candidate_id', candidateId)
          .eq('document_type', 'cv');

        // Get current max version
        const { data: existingDocs } = await supabase
          .from('candidate_documents')
          .select('version')
          .eq('candidate_id', candidateId)
          .eq('document_type', 'cv')
          .order('version', { ascending: false })
          .limit(1);

        const newVersion = (existingDocs?.[0]?.version || 0) + 1;

        // Insert new CV document
        const { error: docError } = await supabase
          .from('candidate_documents')
          .insert({
            candidate_id: candidateId,
            document_type: 'cv',
            version: newVersion,
            file_name: cvFileInfo.fileName,
            file_url: cvFileInfo.fileUrl,
            file_size: cvFileInfo.fileSize,
            mime_type: cvFileInfo.mimeType,
            is_current: true,
            uploaded_by: recruiterId,
          });

        if (docError) console.error('Error inserting document:', docError);
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
    extractTextFromPdf,
    saveParsedCandidate,
    parsing,
    extractingPdf,
    saving,
    error,
  };
}

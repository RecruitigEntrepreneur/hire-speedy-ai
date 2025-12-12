import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HardFacts {
  role_seniority: string;
  top_skills: string[];
  location_commute: string;
  work_model: string;
  salary_range: string;
  availability: string;
}

interface ExposeData {
  candidateId: string;
  submissionId: string;
  candidateName: string;
  isAnonymized: boolean;
  identityUnlocked: boolean;
  currentRole: string;
  matchScore: number;
  dealProbability: number;
  dealHealthScore: number;
  dealHealthRisk: string;
  dealHealthReason: string;
  status: string;
  executiveSummary: string[];
  hardFacts: HardFacts;
  experienceYears: number;
}

export function useExposeData(submissionId: string | undefined) {
  const [data, setData] = useState<ExposeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) {
      setLoading(false);
      return;
    }

    fetchExposeData();
  }, [submissionId]);

  const fetchExposeData = async () => {
    if (!submissionId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch submission with related data
      const { data: submission, error: subError } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          match_score,
          identity_unlocked,
          candidates!inner (
            id,
            full_name,
            job_title,
            city,
            experience_years,
            skills,
            expected_salary,
            notice_period,
            remote_preference,
            availability_date,
            seniority
          ),
          jobs!inner (
            id,
            title,
            location,
            remote_days,
            salary_max
          )
        `)
        .eq('id', submissionId)
        .single();

      if (subError) throw subError;

      // Fetch client summary if exists
      const { data: summary } = await supabase
        .from('candidate_client_summary')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      // Fetch deal health
      const { data: health } = await supabase
        .from('deal_health')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      // Build expose data
      const candidate = submission.candidates;
      const job = submission.jobs;

      // Generate hard facts from available data or use summary
      const summaryHardFacts = summary?.hard_facts as unknown as HardFacts | null;
      const hardFacts: HardFacts = summaryHardFacts && summaryHardFacts.role_seniority ? summaryHardFacts : {
        role_seniority: `${candidate.seniority || ''} ${candidate.job_title || ''}`.trim() || 'Nicht angegeben',
        top_skills: (candidate.skills || []).slice(0, 5),
        location_commute: candidate.city || 'Nicht angegeben',
        work_model: getWorkModelLabel(candidate.remote_preference),
        salary_range: formatSalaryRange(candidate.expected_salary),
        availability: formatAvailability(candidate.notice_period, candidate.availability_date)
      };

      // Parse executive summary
      let executiveSummary: string[] = [];
      if (summary?.key_selling_points && Array.isArray(summary.key_selling_points)) {
        executiveSummary = summary.key_selling_points as string[];
      } else if (summary?.executive_summary) {
        executiveSummary = summary.executive_summary.split('\n').filter(Boolean);
      }

      // Ensure we have at least some summary points
      if (executiveSummary.length === 0) {
        executiveSummary = [
          `${candidate.experience_years || 0}+ Jahre Berufserfahrung`,
          `Aktuelle Rolle: ${candidate.job_title || 'Nicht angegeben'}`,
          `Standort: ${candidate.city || 'Nicht angegeben'}`,
          `Verfügbar: ${formatAvailability(candidate.notice_period, candidate.availability_date)}`
        ];
      }

      // Triple-Blind: Check if identity is unlocked
      const identityUnlocked = submission.identity_unlocked === true;

      const exposeData: ExposeData = {
        candidateId: candidate.id,
        submissionId: submission.id,
        candidateName: candidate.full_name,
        isAnonymized: !identityUnlocked, // Triple-Blind by default
        identityUnlocked,
        currentRole: candidate.job_title || 'Nicht angegeben',
        matchScore: submission.match_score || 0,
        dealProbability: summary?.deal_probability || health?.drop_off_probability ? 100 - (health?.drop_off_probability || 50) : 50,
        dealHealthScore: health?.health_score || 50,
        dealHealthRisk: health?.risk_level || 'medium',
        dealHealthReason: health?.ai_assessment || '',
        status: submission.status,
        executiveSummary,
        hardFacts,
        experienceYears: candidate.experience_years || 0
      };

      setData(exposeData);
    } catch (err) {
      console.error('Error fetching expose data:', err);
      setError('Fehler beim Laden der Kandidatendaten');
    } finally {
      setLoading(false);
    }
  };

  const generateExpose = async () => {
    if (!submissionId) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('client-candidate-summary', {
        body: { submission_id: submissionId }
      });

      if (error) throw error;

      // Refetch data
      await fetchExposeData();
    } catch (err) {
      console.error('Error generating expose:', err);
      setError('Fehler beim Generieren des Exposés');
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, refetch: fetchExposeData, generateExpose };
}

// Helper functions
function getWorkModelLabel(preference: string | null): string {
  if (!preference) return 'Nicht angegeben';
  const labels: Record<string, string> = {
    'remote': 'Full Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return labels[preference] || preference;
}

function formatSalaryRange(salary: number | null): string {
  if (!salary) return 'Nicht angegeben';
  const min = Math.round(salary * 0.9 / 1000) * 1000;
  const max = Math.round(salary * 1.1 / 1000) * 1000;
  return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
}

function formatAvailability(noticePeriod: string | null, availabilityDate: string | null): string {
  if (availabilityDate) {
    const date = new Date(availabilityDate);
    return `Ab ${date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
  }
  if (noticePeriod) {
    return `${noticePeriod} Kündigungsfrist`;
  }
  return 'Nicht angegeben';
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface MatchedJob {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  urgency: string | null;
  match_score: number;
  match_details: {
    skillMatch: number;
    experienceMatch: number;
    salaryMatch: number;
    locationMatch: number;
  };
}

interface CandidateForMatching {
  id: string;
  skills: string[] | null;
  experience_years: number | null;
  expected_salary: number | null;
  salary_expectation_min: number | null;
  salary_expectation_max: number | null;
  city: string | null;
  seniority: string | null;
  target_roles: string[] | null;
  job_title: string | null;
}

export function useJobMatching(candidate: CandidateForMatching | null) {
  const [matchedJobs, setMatchedJobs] = useState<MatchedJob[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const calculateMatchScore = useCallback((job: any, candidate: CandidateForMatching): { score: number; details: MatchedJob['match_details'] } => {
    let skillMatch = 0;
    let experienceMatch = 0;
    let salaryMatch = 100;
    let locationMatch = 100;

    // Skill matching
    const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
    const jobSkills = [
      ...(job.skills || []),
      ...(job.must_haves || []),
      ...(job.nice_to_haves || []),
    ].map((s: string) => s.toLowerCase());

    if (jobSkills.length > 0 && candidateSkills.length > 0) {
      const matchedSkills = candidateSkills.filter(s => 
        jobSkills.some(js => js.includes(s) || s.includes(js))
      );
      skillMatch = Math.min(100, Math.round((matchedSkills.length / jobSkills.length) * 100));
    } else if (candidateSkills.length > 0) {
      skillMatch = 50; // Some skills exist, but no job skills to compare
    }

    // Experience matching
    const candidateExp = candidate.experience_years || 0;
    const expLevel = job.experience_level || '';
    const jobMinExp = expLevel === 'senior' ? 5 : expLevel === 'mid' ? 3 : expLevel === 'junior' ? 0 : 2;
    if (candidateExp >= jobMinExp) {
      experienceMatch = 100;
    } else if (candidateExp >= jobMinExp - 2) {
      experienceMatch = 70;
    } else {
      experienceMatch = 30;
    }

    // Salary matching
    const candidateSalary = candidate.expected_salary || candidate.salary_expectation_max;
    const jobSalaryMax = job.salary_max;
    if (candidateSalary && jobSalaryMax) {
      if (candidateSalary <= jobSalaryMax) {
        salaryMatch = 100;
      } else if (candidateSalary <= jobSalaryMax * 1.15) {
        salaryMatch = 70;
      } else {
        salaryMatch = 40;
      }
    }

    // Location matching (simplified)
    const candidateLocation = (candidate.city || '').toLowerCase();
    const jobLocation = (job.location || '').toLowerCase();
    if (candidateLocation && jobLocation) {
      if (candidateLocation.includes(jobLocation) || jobLocation.includes(candidateLocation)) {
        locationMatch = 100;
      } else if (job.remote_type === 'remote' || job.remote_type === 'hybrid') {
        locationMatch = 80;
      } else {
        locationMatch = 50;
      }
    }

    // Weighted overall score
    const score = Math.round(
      skillMatch * 0.35 +
      experienceMatch * 0.25 +
      salaryMatch * 0.25 +
      locationMatch * 0.15
    );

    return {
      score,
      details: { skillMatch, experienceMatch, salaryMatch, locationMatch }
    };
  }, []);

  const fetchMatchingJobs = useCallback(async () => {
    if (!candidate || !user) return;

    const candidateId = candidate.id;

    setLoading(true);
    try {
      // Fetch existing submissions for this candidate
      const { data: existingSubmissions } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('candidate_id', candidateId);

      const submittedJobIds = new Set((existingSubmissions || []).map(s => s.job_id));

      // Fetch all published jobs
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, title, company_name, location, salary_min, salary_max, urgency, skills, must_haves, nice_to_haves, experience_level, remote_type, status')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate match scores for each job and filter out already submitted
      const jobsWithScores: MatchedJob[] = (jobs || [])
        .filter(job => !submittedJobIds.has(job.id)) // Exclude already submitted jobs
        .map(job => {
          const { score, details } = calculateMatchScore(job, candidate);
          return {
            id: job.id,
            title: job.title,
            company_name: job.company_name || 'Unbekanntes Unternehmen',
            location: job.location,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            urgency: job.urgency,
            match_score: score,
            match_details: details,
          };
        })
        .filter(job => job.match_score >= 50) // Only show jobs with 50%+ match
        .sort((a, b) => b.match_score - a.match_score)
        .slice(0, 3); // Top 3 jobs (max)

      setMatchedJobs(jobsWithScores);
    } catch (error) {
      console.error('Error fetching matching jobs:', error);
    } finally {
      setLoading(false);
    }
  }, [candidate, user, calculateMatchScore]);

  useEffect(() => {
    fetchMatchingJobs();
  }, [fetchMatchingJobs]);

  const getMatchLabel = (score: number): string => {
    if (score >= 85) return 'Perfekt';
    if (score >= 70) return 'Sehr gut';
    if (score >= 55) return 'Gut';
    return 'Möglich';
  };

  const getMatchColor = (score: number): string => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-emerald-600';
    if (score >= 55) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  const getMatchBadgeVariant = (score: number): 'default' | 'secondary' | 'outline' => {
    if (score >= 70) return 'default';
    if (score >= 55) return 'secondary';
    return 'outline';
  };

  return {
    matchedJobs,
    loading,
    refetch: fetchMatchingJobs,
    getMatchLabel,
    getMatchColor,
    getMatchBadgeVariant,
  };
}

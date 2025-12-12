import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Interview {
  id: string;
  scheduled_at: string;
  candidate_name: string;
  anonymous_id: string;
  meeting_link?: string;
  status: string;
}

export interface SubmissionExpose {
  id: string;
  candidate_id: string;
  status: string;
  stage: string;
  match_score: number | null;
  submitted_at: string;
  candidate: {
    full_name: string;
    job_title: string | null;
    skills: string[] | null;
    experience_years: number | null;
    city: string | null;
    work_model: string | null;
    availability_date: string | null;
  };
  deal_probability?: number;
}

export interface JobCommandData {
  job: {
    id: string;
    title: string;
    company_name: string;
    location: string | null;
    remote_type: string | null;
    status: string;
    created_at: string;
    deadline: string | null;
    urgency: string | null;
  };
  stats: {
    new: number;
    screening: number;
    interview: number;
    offer: number;
    total: number;
  };
  upcomingInterviews: Interview[];
  pendingActions: number;
  submissions: SubmissionExpose[];
}

export function useJobCommandData() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobCommandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch jobs
      const { data: jobsData, error: jobsError } = await supabase
        .from('jobs')
        .select('id, title, company_name, location, remote_type, status, created_at, deadline, urgency')
        .eq('client_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (jobsError) throw jobsError;

      if (!jobsData?.length) {
        setJobs([]);
        setLoading(false);
        return;
      }

      // Fetch submissions for all jobs
      const jobIds = jobsData.map(j => j.id);
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select(`
          id,
          job_id,
          candidate_id,
          status,
          stage,
          match_score,
          submitted_at,
          candidates (
            full_name,
            job_title,
            skills,
            experience_years,
            city,
            work_model,
            availability_date
          )
        `)
        .in('job_id', jobIds)
        .neq('status', 'rejected');

      if (submissionsError) throw submissionsError;

      // Fetch upcoming interviews
      const { data: interviewsData, error: interviewsError } = await supabase
        .from('interviews')
        .select(`
          id,
          scheduled_at,
          status,
          meeting_link,
          submission_id,
          submissions!inner (
            job_id,
            candidates (
              full_name
            )
          )
        `)
        .in('submissions.job_id', jobIds)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (interviewsError) throw interviewsError;

      // Fetch deal probabilities from client summaries
      const candidateIds = submissionsData?.map(s => s.candidate_id) || [];
      const { data: summariesData } = await supabase
        .from('candidate_client_summary')
        .select('candidate_id, deal_probability')
        .in('candidate_id', candidateIds);

      const dealProbMap = new Map(
        summariesData?.map(s => [s.candidate_id, s.deal_probability]) || []
      );

      // Build command data for each job
      const commandData: JobCommandData[] = jobsData.map(job => {
        const jobSubmissions = (submissionsData || [])
          .filter(s => s.job_id === job.id)
          .map(s => ({
            id: s.id,
            candidate_id: s.candidate_id,
            status: s.status,
            stage: s.stage,
            match_score: s.match_score,
            submitted_at: s.submitted_at,
            candidate: {
              full_name: (s.candidates as any)?.full_name || 'Unbekannt',
              job_title: (s.candidates as any)?.job_title || null,
              skills: (s.candidates as any)?.skills || null,
              experience_years: (s.candidates as any)?.experience_years || null,
              city: (s.candidates as any)?.city || null,
              work_model: (s.candidates as any)?.work_model || null,
              availability_date: (s.candidates as any)?.availability_date || null,
            },
            deal_probability: dealProbMap.get(s.candidate_id) || null,
          }));

        const jobInterviews = (interviewsData || [])
          .filter((i: any) => i.submissions?.job_id === job.id)
          .map((i: any) => ({
            id: i.id,
            scheduled_at: i.scheduled_at,
            candidate_name: i.submissions?.candidates?.full_name || 'Unbekannt',
            anonymous_id: `${(job.company_name || 'XX').substring(0, 2).toUpperCase()}-${i.id.substring(0, 4).toUpperCase()}`,
            meeting_link: i.meeting_link,
            status: i.status,
          }));

        // Count pending actions (submissions waiting > 48h without stage change)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const pendingActions = jobSubmissions.filter(
          s => s.stage === 'new' && new Date(s.submitted_at) < twoDaysAgo
        ).length;

        return {
          job,
          stats: {
            new: jobSubmissions.filter(s => s.stage === 'new' || s.stage === 'submitted').length,
            screening: jobSubmissions.filter(s => s.stage === 'screening').length,
            interview: jobSubmissions.filter(s => s.stage === 'interview').length,
            offer: jobSubmissions.filter(s => s.stage === 'offer').length,
            total: jobSubmissions.length,
          },
          upcomingInterviews: jobInterviews,
          pendingActions,
          submissions: jobSubmissions as SubmissionExpose[],
        };
      });

      setJobs(commandData);
    } catch (err) {
      console.error('Error fetching command data:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateSubmissionStage = async (submissionId: string, newStage: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ stage: newStage, updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (!error) {
      await fetchData();
    }
    return { error };
  };

  const rejectSubmission = async (submissionId: string, reason?: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ 
        status: 'rejected', 
        stage: 'rejected',
        client_notes: reason || 'Abgelehnt',
        updated_at: new Date().toISOString() 
      })
      .eq('id', submissionId);

    if (!error) {
      await fetchData();
    }
    return { error };
  };

  return {
    jobs,
    loading,
    error,
    refetch: fetchData,
    updateSubmissionStage,
    rejectSubmission,
  };
}

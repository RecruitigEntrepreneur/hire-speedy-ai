import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface PipelineCandidate {
  id: string;
  submittedAt: string;
  stage: string;
  status: string;
  matchScore: number | null;
  hoursInStage: number;
  candidate: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    expectedSalary: number | null;
    experienceYears: number | null;
  };
  recruiter: {
    fullName: string | null;
    email: string;
  } | null;
  interviewScheduledAt: string | null;
  offerStatus: string | null;
}

export interface PipelineJob {
  id: string;
  title: string;
  companyName: string;
  status: string;
}

// Professional muted color palette for pipeline stages
export const PIPELINE_STAGES = [
  { key: 'submitted', label: 'Neu', color: 'border-slate-400', dotColor: 'bg-slate-400', textColor: 'text-slate-600' },
  { key: 'accepted', label: 'Shortlist', color: 'border-blue-400', dotColor: 'bg-blue-400', textColor: 'text-blue-600' },
  { key: 'interview', label: 'Interview', color: 'border-indigo-400', dotColor: 'bg-indigo-400', textColor: 'text-indigo-600' },
  { key: 'offer', label: 'Angebot', color: 'border-violet-400', dotColor: 'bg-violet-400', textColor: 'text-violet-600' },
  { key: 'hired', label: 'Eingestellt', color: 'border-emerald-500', dotColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
] as const;

export function useHiringPipeline(jobId?: string) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [candidates, setCandidates] = useState<PipelineCandidate[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(jobId);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from('jobs')
      .select('id, title, company_name, status')
      .eq('client_id', user.id)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (data) {
      setJobs(data.map(j => ({
        id: j.id,
        title: j.title,
        companyName: j.company_name || '',
        status: j.status || 'draft',
      })));
      
      // Auto-select first job if none selected
      if (!selectedJobId && data.length > 0) {
        setSelectedJobId(data[0].id);
      }
    }
  }, [user, selectedJobId]);

  const fetchCandidates = useCallback(async () => {
    if (!user || !selectedJobId) {
      setCandidates([]);
      setLoading(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('submissions')
        .select(`
          id,
          submitted_at,
          stage,
          status,
          match_score,
          candidate:candidates(id, full_name, email, phone, expected_salary, experience_years),
          recruiter:profiles!submissions_recruiter_id_fkey(full_name, email)
        `)
        .eq('job_id', selectedJobId)
        .neq('status', 'rejected')
        .order('submitted_at', { ascending: false });

      if (data) {
        const now = new Date();
        
        // Fetch interview data for candidates
        const submissionIds = data.map((s: any) => s.id);
        const { data: interviews } = await supabase
          .from('interviews')
          .select('submission_id, scheduled_at')
          .in('submission_id', submissionIds);
        
        const interviewMap = new Map();
        interviews?.forEach((i: any) => {
          interviewMap.set(i.submission_id, i.scheduled_at);
        });

        // Fetch offer data
        const { data: offers } = await supabase
          .from('offers')
          .select('submission_id, status')
          .in('submission_id', submissionIds);
        
        const offerMap = new Map();
        offers?.forEach((o: any) => {
          offerMap.set(o.submission_id, o.status);
        });

        const mapped: PipelineCandidate[] = data.map((sub: any) => {
          const stage = sub.stage || sub.status || 'submitted';
          const submittedAt = new Date(sub.submitted_at);
          
          return {
            id: sub.id,
            submittedAt: sub.submitted_at,
            stage,
            status: sub.status || 'submitted',
            matchScore: sub.match_score,
            hoursInStage: Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60)),
            candidate: {
              id: sub.candidate?.id,
              fullName: sub.candidate?.full_name || 'Unbekannt',
              email: sub.candidate?.email || '',
              phone: sub.candidate?.phone,
              expectedSalary: sub.candidate?.expected_salary,
              experienceYears: sub.candidate?.experience_years,
            },
            recruiter: sub.recruiter ? {
              fullName: sub.recruiter.full_name,
              email: sub.recruiter.email,
            } : null,
            interviewScheduledAt: interviewMap.get(sub.id) || null,
            offerStatus: offerMap.get(sub.id) || null,
          };
        });

        setCandidates(mapped);
      }
    } catch (error) {
      console.error('Error fetching pipeline candidates:', error);
    } finally {
      setLoading(false);
    }
  }, [user, selectedJobId]);

  const moveCandidate = async (submissionId: string, newStage: string) => {
    // Optimistic update
    setCandidates(prev => prev.map(c => 
      c.id === submissionId ? { ...c, stage: newStage, status: newStage } : c
    ));

    const { error } = await supabase
      .from('submissions')
      .update({ stage: newStage, status: newStage })
      .eq('id', submissionId);

    if (error) {
      // Revert on error
      fetchCandidates();
      throw error;
    }

    // Create interview record if moving to interview
    if (newStage === 'interview') {
      await supabase.from('interviews').insert({
        submission_id: submissionId,
        status: 'pending',
      });
    }
  };

  const rejectCandidate = async (submissionId: string, reason?: string) => {
    setCandidates(prev => prev.filter(c => c.id !== submissionId));

    const { error } = await supabase
      .from('submissions')
      .update({ 
        stage: 'rejected', 
        status: 'rejected',
        rejection_reason: reason 
      })
      .eq('id', submissionId);

    if (error) {
      fetchCandidates();
      throw error;
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (selectedJobId) {
      setLoading(true);
      fetchCandidates();
    }
  }, [selectedJobId, fetchCandidates]);

  const getCandidatesByStage = (stage: string) => {
    return candidates.filter(c => (c.stage || 'submitted') === stage);
  };

  return {
    jobs,
    candidates,
    selectedJobId,
    setSelectedJobId,
    loading,
    moveCandidate,
    rejectCandidate,
    getCandidatesByStage,
    refetch: fetchCandidates,
  };
}

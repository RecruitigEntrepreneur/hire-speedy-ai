import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { CandidateInboxCard, CandidateCardData } from '@/components/dashboard/CandidateInboxCard';
import { Search, Filter, ArrowUpDown, Users } from 'lucide-react';

interface Job {
  id: string;
  title: string;
}

export default function ClientCandidatesOverview() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateCardData[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [stageFilter, setStageFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'waiting'>('waiting');

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [jobsRes, subsRes] = await Promise.all([
        supabase.from('jobs').select('id, title').eq('status', 'published').order('created_at', { ascending: false }),
        supabase.from('submissions').select(`
          id, status, stage, submitted_at,
          candidates!inner (id, full_name, job_title, experience_years, city),
          jobs!inner (id, title)
        `).order('submitted_at', { ascending: false }),
      ]);

      if (jobsRes.data) setJobs(jobsRes.data);

      const entries: CandidateCardData[] = [];
      (subsRes.data || []).forEach((sub: any) => {
        const candidate = sub.candidates;
        const job = sub.jobs;
        const now = new Date();
        const submittedAt = new Date(sub.submitted_at);
        const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
        entries.push({
          id: candidate.id,
          submissionId: sub.id,
          name: `PR-${candidate.id.slice(0, 6).toUpperCase()}`,
          currentRole: candidate.job_title || 'Nicht angegeben',
          jobId: job.id,
          jobTitle: job.title,
          stage: sub.stage || sub.status,
          status: sub.status,
          submittedAt: sub.submitted_at,
          hoursInStage,
          city: candidate.city,
          experienceYears: candidate.experience_years,
        });
      });
      setCandidates(entries);
    } finally {
      setLoading(false);
    }
  };

  const stageCounts = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
      return acc;
    }, {} as Record<string, number>);
  }, [candidates]);

  const activeCount = useMemo(() =>
    candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length
  , [candidates]);

  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => {
        if (c.status === 'rejected' || c.status === 'hired') return false;
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        if (jobFilter !== 'all' && c.jobId !== jobFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return c.name.toLowerCase().includes(s) || c.currentRole.toLowerCase().includes(s) || c.jobTitle.toLowerCase().includes(s);
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest': return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          case 'waiting': return b.hoursInStage - a.hoursInStage;
          default: return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
      });
  }, [candidates, stageFilter, jobFilter, search, sortBy]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-36" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Bewerbungen</h1>
          <span className="text-sm text-muted-foreground">{activeCount} eingegangen</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Suche nach ID, Rolle..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="h-9 w-40">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Alle Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Jobs</SelectItem>
              {jobs.map(job => <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-9 w-36">
              <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="waiting">Wartezeit</SelectItem>
              <SelectItem value="newest">Neueste</SelectItem>
              <SelectItem value="oldest">Älteste</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stage Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b pb-3">
          <Button variant={stageFilter === 'all' ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setStageFilter('all')}>
            Alle ({activeCount})
          </Button>
          {PIPELINE_STAGES.slice(0, 5).map(stage => {
            const count = stageCounts[stage.key] || 0;
            if (count === 0) return null;
            return (
              <Button key={stage.key} variant={stageFilter === stage.key ? 'default' : 'ghost'} size="sm" className="h-7 text-xs" onClick={() => setStageFilter(stage.key)}>
                {stage.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Grid */}
        {filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground">
              {search || stageFilter !== 'all' || jobFilter !== 'all' ? 'Keine Kandidaten gefunden' : 'Noch keine Kandidaten vorhanden'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCandidates.map(candidate => (
              <CandidateInboxCard key={candidate.submissionId} candidate={candidate} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

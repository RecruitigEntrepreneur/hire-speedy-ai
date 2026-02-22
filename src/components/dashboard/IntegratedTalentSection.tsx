import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { 
  Users,
  Search,
  Filter,
  ArrowUpDown,
  ChevronRight,
  MapPin,
  Briefcase,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  title: string;
}

interface CandidateEntry {
  id: string;
  submissionId: string;
  name: string;
  currentRole: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  status: string;
  submittedAt: string;
  hoursInStage: number;
  city?: string;
  experienceYears?: number;
}

interface IntegratedTalentSectionProps {
  onActionComplete?: () => void;
}

export function IntegratedTalentSection({ onActionComplete }: IntegratedTalentSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [candidates, setCandidates] = useState<CandidateEntry[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [stageFilter, setStageFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'waiting'>('waiting');

  useEffect(() => {
    if (user) {
      fetchAllData();
    }
  }, [user]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchJobs(), fetchCandidates()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data);
    }
  };

  const fetchCandidates = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select(`
        id,
        status,
        stage,
        submitted_at,
        candidates!inner (
          id,
          full_name,
          job_title,
          experience_years,
          city
        ),
        jobs!inner (
          id,
          title
        )
      `)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
      return;
    }

    const entries: CandidateEntry[] = [];

    (data || []).forEach((sub: any) => {
      const candidate = sub.candidates;
      const job = sub.jobs;
      const now = new Date();
      const submittedAt = new Date(sub.submitted_at);
      const hoursInStage = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60));
      const anonymousId = `PR-${candidate.id.slice(0, 6).toUpperCase()}`;

      entries.push({
        id: candidate.id,
        submissionId: sub.id,
        name: anonymousId,
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
  };

  // Stage counts
  const stageCounts = useMemo(() => {
    return PIPELINE_STAGES.reduce((acc, stage) => {
      acc[stage.key] = candidates.filter(c => c.stage === stage.key && c.status !== 'rejected').length;
      return acc;
    }, {} as Record<string, number>);
  }, [candidates]);

  const activeCount = useMemo(() => 
    candidates.filter(c => c.status !== 'rejected' && c.status !== 'hired').length
  , [candidates]);

  // Filtered and sorted
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter(c => {
        if (c.status === 'rejected' || c.status === 'hired') return false;
        if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
        if (jobFilter !== 'all' && c.jobId !== jobFilter) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            c.name.toLowerCase().includes(s) ||
            c.currentRole.toLowerCase().includes(s) ||
            c.jobTitle.toLowerCase().includes(s)
          );
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
          case 'waiting':
            return b.hoursInStage - a.hoursInStage;
          case 'newest':
          default:
            return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
        }
      });
  }, [candidates, stageFilter, jobFilter, search, sortBy]);

  const getInitials = (name: string) => {
    if (name.startsWith('PR-')) return name.slice(3, 5).toUpperCase();
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeCount === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-1">Alles erledigt!</h3>
          <p className="text-sm text-muted-foreground">
            Keine ausstehenden Kandidaten. Ihre Recruiter arbeiten für Sie.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-semibold">Bewerbungen</h2>
          <span className="text-sm text-muted-foreground">
            {activeCount} eingegangen
          </span>
        </div>

        {/* Stage Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-4 border-b pb-3">
          <Button
            variant={stageFilter === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setStageFilter('all')}
          >
            Alle ({activeCount})
          </Button>
          {PIPELINE_STAGES.slice(0, 5).map(stage => {
            const count = stageCounts[stage.key] || 0;
            if (count === 0) return null;
            return (
              <Button
                key={stage.key}
                variant={stageFilter === stage.key ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setStageFilter(stage.key)}
              >
                {stage.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suche nach ID, Rolle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          <Select value={jobFilter} onValueChange={setJobFilter}>
            <SelectTrigger className="h-9 w-40">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Alle Jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Jobs</SelectItem>
              {jobs.map(job => (
                <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
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

        {/* Candidate List */}
        {filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground">
              {search || stageFilter !== 'all' || jobFilter !== 'all'
                ? 'Keine Kandidaten gefunden'
                : 'Noch keine Kandidaten vorhanden'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredCandidates.map(candidate => (
              <Link
                key={candidate.submissionId}
                to={`/dashboard/candidates/${candidate.submissionId}`}
                className="flex items-center gap-3 px-3 py-3 rounded-lg border border-transparent hover:bg-muted/50 hover:border-border transition-colors group"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                    {getInitials(candidate.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {candidate.currentRole}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                      {candidate.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span className="truncate">→ {candidate.jobTitle}</span>
                    {candidate.city && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <MapPin className="h-3 w-3" />
                          {candidate.city}
                        </span>
                      </>
                    )}
                    {candidate.experienceYears && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Briefcase className="h-3 w-3" />
                          {candidate.experienceYears}J
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>{formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}</span>
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

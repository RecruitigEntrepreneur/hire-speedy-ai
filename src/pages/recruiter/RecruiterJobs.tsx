import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Briefcase,
  Loader2,
  Flame,
  Sparkles,
  Euro,
  CheckCircle,
  Star,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  TrendingUp,
  Clock,
  Calendar,
  ExternalLink,
  Lock,
  Unlock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { JobActionCard } from '@/components/recruiter/JobActionCard';
import { JobPreviewPanel } from '@/components/recruiter/JobPreviewPanel';
import { ActivationConfirmDialog, SlotLimitDialog } from '@/components/recruiter/ActivationConfirmDialog';
import { TrustLevelBadge } from '@/components/recruiter/TrustLevelBadge';
import { useJobSubmissionStats } from '@/hooks/useJobSubmissionStats';
import { useRecruiterTrustLevel } from '@/hooks/useRecruiterTrustLevel';
import { useJobActivation } from '@/hooks/useJobActivation';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CompanyProfile {
  logo_url: string | null;
  website: string | null;
  headcount: number | null;
  industry: string | null;
}

interface Job {
  id: string;
  client_id: string;
  title: string;
  company_name: string;
  description?: string;
  location: string;
  remote_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number | null;
  salary_max: number | null;
  recruiter_fee_percentage: number;
  skills: string[];
  created_at: string;
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  hiring_urgency: string | null;
  tech_environment: string[] | null;
}

type TabKey = 'all' | 'urgent' | 'new' | 'top' | 'revealed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const calculateEarning = (
  salaryMin: number | null,
  salaryMax: number | null,
  feePercentage: number | null,
): number | null => {
  if (!feePercentage || (!salaryMin && !salaryMax)) return null;
  const avg = salaryMin && salaryMax
    ? (salaryMin + salaryMax) / 2
    : salaryMin || salaryMax;
  if (!avg) return null;
  return Math.round(avg * (feePercentage / 100));
};

const formatEuroShort = (n: number) => {
  if (n >= 1000) return `€${Math.round(n / 1000)}k`;
  return `€${n}`;
};

// ─── Stage Pipeline (like CandidateActiveProcesses) ─────────────────────────

const STAGE_ORDER = ['submitted', 'screening', 'interview', 'offer', 'hired'] as const;

const STAGE_CONFIG: Record<string, { label: string; shortLabel: string; dotColor: string; className: string }> = {
  new:                  { label: 'Neu',                shortLabel: 'Neu',       dotColor: 'bg-muted-foreground',   className: 'bg-muted text-muted-foreground' },
  submitted:            { label: 'Eingereicht',        shortLabel: 'Einger.',   dotColor: 'bg-blue-500',           className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  screening:            { label: 'Screening',          shortLabel: 'Screen.',   dotColor: 'bg-violet-500',         className: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  shortlisted:          { label: 'Shortlisted',        shortLabel: 'Short.',    dotColor: 'bg-indigo-500',         className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  interview_requested:  { label: 'Interview angefragt', shortLabel: 'Angefr.',  dotColor: 'bg-amber-500',          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  candidate_opted_in:   { label: 'Opt-In erteilt',     shortLabel: 'Opt-In',    dotColor: 'bg-cyan-500',           className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' },
  interview:            { label: 'Interview',          shortLabel: 'Interv.',   dotColor: 'bg-amber-500',          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  interview_scheduled:  { label: 'Interview geplant',  shortLabel: 'Geplant',   dotColor: 'bg-green-500',          className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  offer:                { label: 'Angebot',            shortLabel: 'Angebot',   dotColor: 'bg-emerald-500',        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  hired:                { label: 'Eingestellt',        shortLabel: 'Eingest.',  dotColor: 'bg-green-600',          className: 'bg-green-500/10 text-green-700 border-green-500/30' },
};

function getStageInfo(stage: string | null) {
  return STAGE_CONFIG[stage || 'new'] || STAGE_CONFIG.new;
}

function getStageIndex(stage: string | null): number {
  const idx = STAGE_ORDER.indexOf((stage || 'submitted') as any);
  return idx >= 0 ? idx : 0;
}

function MiniStagePipeline({ currentStage }: { currentStage: string | null }) {
  const currentIndex = getStageIndex(currentStage);

  return (
    <div className="flex items-center gap-0.5">
      {STAGE_ORDER.map((stage) => {
        const config = getStageInfo(stage);
        const stageIdx = getStageIndex(stage);
        const isActive = stage === currentStage || (
          (currentStage?.startsWith('interview') || currentStage === 'candidate_opted_in') && stage === 'interview'
        );
        const isPassed = stageIdx < currentIndex;

        return (
          <Tooltip key={stage}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  isActive ? 'w-5' : 'w-2.5',
                  isActive ? config.dotColor :
                  isPassed ? 'bg-green-400' :
                  'bg-muted-foreground/20'
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {config.label}
              {isActive && ' (aktuell)'}
              {isPassed && ' ✓'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

interface ActiveJobSubmission {
  id: string;
  job_id: string;
  stage: string | null;
  status: string;
  submitted_at: string;
  company_revealed: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RecruiterJobs() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, CompanyProfile>>({});
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());
  const [revealedCompanyNames, setRevealedCompanyNames] = useState<Map<string, string>>(new Map());

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeJobSubmissions, setActiveJobSubmissions] = useState<ActiveJobSubmission[]>([]);

  // Activation dialogs
  const [activationDialogJobId, setActivationDialogJobId] = useState<string | null>(null);
  const [slotLimitOpen, setSlotLimitOpen] = useState(false);

  // Active jobs scroll ref
  const activeScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkActiveScroll = useCallback(() => {
    const el = activeScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    checkActiveScroll();
    const el = activeScrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkActiveScroll, { passive: true });
      const ro = new ResizeObserver(checkActiveScroll);
      ro.observe(el);
      return () => { el.removeEventListener('scroll', checkActiveScroll); ro.disconnect(); };
    }
  }, [checkActiveScroll]);

  // Hook for submission stats
  const jobIds = useMemo(() => jobs.map(j => j.id), [jobs]);
  const { stats: submissionStats, kpis, computeKpis } = useJobSubmissionStats(jobIds);

  // Trust level & job activations (DB-based, replaces localStorage)
  const { trustLevel, refetch: refetchTrust, getLevelInfo, canActivate } = useRecruiterTrustLevel();
  const { isActivated, activateJob, activatedJobIds, refetch: refetchActivations } = useJobActivation(jobIds);
  const activeJobIds = useMemo(() => new Set(activatedJobIds), [activatedJobIds]);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (user) fetchRevealedJobs();
  }, [user]);

  useEffect(() => {
    if (jobs.length > 0) {
      computeKpis(jobs, revealedJobIds);
    }
  }, [jobs, revealedJobIds]);

  const fetchJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data);

        const clientIds = [...new Set(data.map(j => j.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: profiles } = await supabase
            .from('company_profiles')
            .select('user_id, logo_url, website, headcount, industry')
            .in('user_id', clientIds);

          if (profiles) {
            const map: Record<string, CompanyProfile> = {};
            profiles.forEach(p => {
              map[p.user_id] = { logo_url: p.logo_url, website: p.website, headcount: p.headcount, industry: p.industry };
            });
            setCompanyProfiles(map);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRevealedJobs = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('submissions')
        .select('job_id, jobs(company_name)')
        .eq('recruiter_id', user.id)
        .eq('company_revealed', true);

      if (data) {
        const ids = new Set<string>();
        const names = new Map<string, string>();
        data.forEach((s: any) => {
          ids.add(s.job_id);
          if (s.jobs?.company_name) names.set(s.job_id, s.jobs.company_name);
        });
        setRevealedJobIds(ids);
        setRevealedCompanyNames(names);
      }
    } catch (err) {
      console.error('Error fetching revealed jobs:', err);
    }
  };

  // Fetch submissions for active jobs (for pipeline display)
  useEffect(() => {
    if (!user || activeJobIds.size === 0) {
      setActiveJobSubmissions([]);
      return;
    }
    const fetchActiveSubmissions = async () => {
      try {
        const { data } = await supabase
          .from('submissions')
          .select('id, job_id, stage, status, submitted_at, company_revealed')
          .eq('recruiter_id', user.id)
          .in('job_id', [...activeJobIds])
          .not('status', 'in', '("rejected","withdrawn","client_rejected","expired")');
        if (data) setActiveJobSubmissions(data as ActiveJobSubmission[]);
      } catch (err) {
        console.error('Error fetching active job submissions:', err);
      }
    };
    fetchActiveSubmissions();
  }, [user, activeJobIds]);

  // ─── Actions ────────────────────────────────────────────────────────────

  const handleActivateClick = useCallback((jobId: string) => {
    if (isActivated(jobId)) return; // Already activated, irreversible
    if (!canActivate) {
      setSlotLimitOpen(true);
      return;
    }
    setActivationDialogJobId(jobId);
  }, [isActivated, canActivate]);

  const handleConfirmActivation = useCallback(async () => {
    if (!activationDialogJobId || !trustLevel) return;
    const result = await activateJob(activationDialogJobId, trustLevel.trust_level);
    if (result.success) {
      refetchTrust();
    }
    setActivationDialogJobId(null);
  }, [activationDialogJobId, trustLevel, activateJob, refetchTrust]);

  // Combined reveal: submission-based OR activation-based
  const isJobRevealed = useCallback((jobId: string): boolean => {
    return revealedJobIds.has(jobId) || isActivated(jobId);
  }, [revealedJobIds, isActivated]);

  const getRevealedCompanyName = useCallback((jobId: string): string | undefined => {
    return revealedCompanyNames.get(jobId) || (isActivated(jobId) ? jobs.find(j => j.id === jobId)?.company_name : undefined);
  }, [revealedCompanyNames, isActivated, jobs]);

  const closePreview = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────────────────

  const oneWeekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const industries = useMemo(() => {
    const set = new Set(jobs.map(j => j.industry).filter(Boolean) as string[]);
    return [...set].sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    let result = jobs.filter(job => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        job.skills?.some(s => s.toLowerCase().includes(q)) ||
        job.industry?.toLowerCase().includes(q);
      const matchesRemote = remoteFilter === 'all' || job.remote_type === remoteFilter;
      const matchesLevel = levelFilter === 'all' || job.experience_level === levelFilter;
      const matchesIndustry = industryFilter === 'all' || job.industry === industryFilter;

      if (activeTab === 'urgent') return matchesSearch && matchesRemote && matchesLevel && matchesIndustry && job.hiring_urgency === 'urgent';
      if (activeTab === 'new') return matchesSearch && matchesRemote && matchesLevel && matchesIndustry && new Date(job.created_at) >= oneWeekAgo;
      if (activeTab === 'revealed') return matchesSearch && matchesRemote && matchesLevel && matchesIndustry && revealedJobIds.has(job.id);

      return matchesSearch && matchesRemote && matchesLevel && matchesIndustry;
    });

    if (activeTab === 'top') {
      result = [...result].sort((a, b) => {
        const ea = calculateEarning(a.salary_min, a.salary_max, a.recruiter_fee_percentage) || 0;
        const eb = calculateEarning(b.salary_min, b.salary_max, b.recruiter_fee_percentage) || 0;
        return eb - ea;
      });
    }

    return result;
  }, [jobs, searchQuery, remoteFilter, levelFilter, industryFilter, activeTab, revealedJobIds, oneWeekAgo]);

  const myActiveJobsData = useMemo(() => {
    return jobs
      .filter(j => activeJobIds.has(j.id))
      .map(j => {
        const stats = submissionStats[j.id];
        const mySubs = activeJobSubmissions.filter(s => s.job_id === j.id);
        // Pick the submission that's furthest in the pipeline
        const bestSub = mySubs.length > 0
          ? mySubs.reduce((best, s) => getStageIndex(s.stage) > getStageIndex(best.stage) ? s : best, mySubs[0])
          : null;
        return {
          id: j.id,
          title: j.title,
          location: j.location,
          industry: j.industry,
          companySize: j.company_size_band,
          fundingStage: j.funding_stage,
          techEnvironment: j.tech_environment,
          remoteType: j.remote_type,
          hiringUrgency: j.hiring_urgency,
          earning: calculateEarning(j.salary_min, j.salary_max, j.recruiter_fee_percentage),
          submittedCount: stats?.submissionCount || 0,
          stage: bestSub?.stage || null,
          submittedAt: bestSub?.submitted_at || null,
          companyRevealed: bestSub?.company_revealed || revealedJobIds.has(j.id),
          companyName: revealedCompanyNames.get(j.id) || j.company_name,
        };
      });
  }, [jobs, activeJobIds, submissionStats, activeJobSubmissions, revealedJobIds, revealedCompanyNames]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
  const isPanelOpen = !!selectedJob;

  const tabCounts = useMemo(() => ({
    all: jobs.length,
    urgent: jobs.filter(j => j.hiring_urgency === 'urgent').length,
    new: jobs.filter(j => new Date(j.created_at) >= oneWeekAgo).length,
    top: jobs.length,
    revealed: revealedJobIds.size,
  }), [jobs, revealedJobIds, oneWeekAgo]);

  const urgentCount = tabCounts.urgent;

  // Smart greeting: extract first name from full_name or email
  const rawName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';
  const firstName = rawName.split(/[\s.]+/)[0]; // "Marko Benko" → "Marko", "marko.benko" → "marko"
  const capitalizedName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : '';

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Guten Morgen';
    if (hour < 17) return 'Hallo';
    return 'Guten Abend';
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const tabs: { key: TabKey; label: string; icon?: React.ReactNode; count: number }[] = [
    { key: 'all', label: 'Alle', count: tabCounts.all },
    { key: 'urgent', label: 'Dringend', icon: <Flame className="h-3 w-3" />, count: tabCounts.urgent },
    { key: 'new', label: 'Neu', icon: <Sparkles className="h-3 w-3" />, count: tabCounts.new },
    { key: 'top', label: 'Top', icon: <Euro className="h-3 w-3" />, count: tabCounts.top },
    { key: 'revealed', label: 'Enthüllt', icon: <CheckCircle className="h-3 w-3" />, count: tabCounts.revealed },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl">
        {/* ── Hero: Compact KPI Strip + Process Cards ── */}
        <div className="shrink-0 py-3 space-y-3">
          {/* KPI Strip — one line */}
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold truncate">
                {getGreeting()}{capitalizedName ? `, ${capitalizedName}` : ''}
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {urgentCount > 0
                    ? `· ${urgentCount} dringende Jobs warten`
                    : '· Finde deinen nächsten Top-Kandidaten'
                  }
                </span>
              </h1>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10">
                <span className="text-xs font-bold text-emerald-600 tabular-nums">{formatEuroShort(kpis.totalPotential)}</span>
                <span className="text-[10px] text-muted-foreground">Potenzial</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50">
                <span className="text-xs font-bold tabular-nums">{jobs.length}</span>
                <span className="text-[10px] text-muted-foreground">Jobs</span>
              </div>
              <div className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md',
                urgentCount > 0 ? 'bg-destructive/10' : 'bg-muted/50',
              )}>
                <span className={cn('text-xs font-bold tabular-nums', urgentCount > 0 && 'text-destructive')}>{urgentCount}</span>
                <span className="text-[10px] text-muted-foreground">Dringend</span>
              </div>
            </div>
          </div>

          {/* Active Jobs — Horizontal Process Cards */}
          {myActiveJobsData.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Meine aktiven Jobs ({myActiveJobsData.length})
                </span>
              </div>

              <div className="relative">
                {canScrollLeft && (
                  <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none rounded-l-lg" />
                )}
                {canScrollRight && (
                  <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none rounded-r-lg" />
                )}

                <div
                  ref={activeScrollRef}
                  className="flex gap-2 overflow-x-auto pb-1 -mb-1"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {myActiveJobsData.map((job) => {
                    const stageInfo = getStageInfo(job.stage);
                    const timeSince = job.submittedAt
                      ? formatDistanceToNow(new Date(job.submittedAt), { locale: de, addSuffix: true })
                      : null;

                    const anonLabel = job.companyRevealed
                      ? job.companyName
                      : formatAnonymousCompany({
                          industry: job.industry,
                          companySize: job.companySize,
                          fundingStage: job.fundingStage,
                          techStack: job.techEnvironment,
                          location: job.location,
                          urgency: job.hiringUrgency,
                          remoteType: job.remoteType,
                        });

                    return (
                      <div
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={cn(
                          'shrink-0 w-56 rounded-lg border p-2.5 transition-all hover:shadow-sm group cursor-pointer',
                          'hover:border-muted-foreground/30'
                        )}
                      >
                        {/* Row 1: Company + link */}
                        <div className="flex items-center gap-1.5 min-w-0">
                          {job.companyRevealed
                            ? <Unlock className="h-3 w-3 text-green-500 shrink-0" />
                            : <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                          }
                          <span className="text-xs font-medium truncate flex-1">{anonLabel}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); navigate(`/recruiter/jobs/${job.id}`); }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* Row 2: Job title */}
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {job.title}
                        </p>

                        {/* Row 3: Stage pipeline + badge */}
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <MiniStagePipeline currentStage={job.stage} />
                          <Badge
                            variant="outline"
                            className={cn('shrink-0 text-[9px] px-1.5 py-0 leading-4', stageInfo.className)}
                          >
                            {stageInfo.shortLabel}
                          </Badge>
                        </div>

                        {/* Row 4: Context info */}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 truncate">
                            <Clock className="h-2.5 w-2.5 shrink-0" />
                            {timeSince || 'Noch nicht eingereicht'}
                          </span>
                          <span className="text-[10px] font-semibold text-emerald-500 tabular-nums shrink-0">
                            {job.earning ? formatEuroShort(job.earning) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Filters + Tabs ── */}
        <div className="shrink-0 space-y-2 pb-3 border-b border-border/30">
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={remoteFilter} onValueChange={setRemoteFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Remote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="onsite">Vor Ort</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="c-level">C-Level</SelectItem>
              </SelectContent>
            </Select>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="Branche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {industries.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex gap-1 flex-wrap">
            {tabs.map(tab => (
              <Button
                key={tab.key}
                variant={activeTab === tab.key ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  'h-7 text-xs gap-1',
                  activeTab !== tab.key && 'text-muted-foreground',
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.icon}
                {tab.label}
                <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5 py-0 h-4">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>
        </div>

        {/* ── Main: Feed + Panel (fixed height, independent scroll) ── */}
        <div className="flex gap-4 flex-1 min-h-0 pt-3">
          {/* Feed — scrolls independently */}
          <div
            className={cn(
              'overflow-y-auto space-y-2 pr-1 transition-all duration-300',
              isPanelOpen ? 'w-1/2' : 'w-full',
            )}
          >
            {filteredJobs.length === 0 ? (
              <Card className="border-border/30 bg-card">
                <CardContent className="py-12 text-center">
                  <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <h3 className="mt-3 font-semibold">Keine Jobs gefunden</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || remoteFilter !== 'all'
                      ? 'Passe deine Filter an'
                      : 'Bald verfügbar'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map(job => {
                const stats = submissionStats[job.id];
                const earning = calculateEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);
                return (
                  <JobActionCard
                    key={job.id}
                    job={job}
                    earning={earning}
                    isRevealed={isJobRevealed(job.id)}
                    revealedCompanyName={getRevealedCompanyName(job.id)}
                    profile={companyProfiles[job.client_id]}
                    isSelected={selectedJobId === job.id}
                    isActive={isActivated(job.id)}
                    recruiterCount={stats?.recruiterCount || 0}
                    pipelinePercent={stats ? Math.round((stats.submissionCount / 10) * 100) : 0}
                    submittedCount={stats?.submissionCount || 0}
                    onSelect={() => setSelectedJobId(job.id)}
                    onToggleActive={(e) => { e.stopPropagation(); handleActivateClick(job.id); }}
                  />
                );
              })
            )}
          </div>

          {/* Panel — scrolls independently, 50% width */}
          {isPanelOpen && selectedJob && (
            <div className="hidden lg:block w-1/2 overflow-hidden">
              <Card className="border-border/30 shadow-sm h-full">
                <CardContent className="p-0 h-full">
                  <JobPreviewPanel
                    job={selectedJob}
                    earning={calculateEarning(selectedJob.salary_min, selectedJob.salary_max, selectedJob.recruiter_fee_percentage)}
                    isRevealed={isJobRevealed(selectedJob.id)}
                    revealedCompanyName={getRevealedCompanyName(selectedJob.id)}
                    profile={companyProfiles[selectedJob.client_id]}
                    isActive={isActivated(selectedJob.id)}
                    onToggleActive={() => handleActivateClick(selectedJob.id)}
                    onClose={closePreview}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Activation Confirm Dialog */}
      {activationDialogJobId && (() => {
        const dialogJob = jobs.find(j => j.id === activationDialogJobId);
        if (!dialogJob || !trustLevel) return null;
        return (
          <ActivationConfirmDialog
            open={true}
            onOpenChange={(open) => { if (!open) setActivationDialogJobId(null); }}
            jobTitle={dialogJob.title}
            anonymousLabel={formatAnonymousCompany({
              industry: dialogJob.industry,
              companySize: dialogJob.company_size_band,
              fundingStage: dialogJob.funding_stage,
              techStack: dialogJob.tech_environment,
              location: dialogJob.location,
              urgency: dialogJob.hiring_urgency,
              remoteType: dialogJob.remote_type,
            })}
            activeCount={trustLevel.active_count}
            maxSlots={trustLevel.max_active_slots}
            levelInfo={getLevelInfo()}
            onConfirm={handleConfirmActivation}
          />
        );
      })()}

      {/* Slot Limit Dialog */}
      {trustLevel && (
        <SlotLimitDialog
          open={slotLimitOpen}
          onOpenChange={setSlotLimitOpen}
          activeCount={trustLevel.active_count}
          maxSlots={trustLevel.max_active_slots}
          levelInfo={getLevelInfo()}
        />
      )}
    </DashboardLayout>
  );
}

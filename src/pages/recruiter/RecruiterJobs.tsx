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
import { useRecruiterPending } from '@/components/verification/RecruiterAccessGate';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import i18n from '@/i18n';
import { useRecruiterPipeline, PIPELINE_LABELS, type PipelineStageKey } from '@/hooks/useRecruiterPipeline';
import { intlLocale } from '@/i18n/languages';
import { JobActionCard } from '@/components/recruiter/JobActionCard';
import { JobPreviewPanel } from '@/components/recruiter/JobPreviewPanel';
import { ActivationConfirmDialog, SlotLimitDialog, type ConfirmResult } from '@/components/recruiter/ActivationConfirmDialog';
import { VorstellenFenster } from '@/components/recruiter/vorstellen/VorstellenFenster';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useJobSubmissionStats } from '@/hooks/useJobSubmissionStats';
import { MySearchesList } from '@/components/recruiter/search/MySearchesList';
import { useJobActivation } from '@/hooks/useJobActivation';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { verdienstJeTag } from '@/lib/recruiterContracting';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation, Trans } from 'react-i18next';
import { dateFnsLocale } from '@/components/recruiter/search/dateLocale';
import { Honorar } from '@/components/recruiter/Honorar';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Job {
  id: string;
  title: string;
  // Nur nach dem Reveal befuellt — recruiter_jobs_view liefert sonst null.
  company_name: string | null;
  /** Wie company_name erst nach dem Reveal befuellt (client_companies.logo_url). */
  company_logo_url?: string | null;
  description?: string | null;
  location: string;
  remote_type: string;
  employment_type: string;
  experience_level: string;
  salary_min: number | null;
  salary_max: number | null;
  recruiter_fee_percentage: number;
  skills: string[];
  created_at: string;
  updated_at?: string | null;
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  hiring_urgency: string | null;
  tech_environment: string[] | null;
  company_revealed?: boolean | null;
  paused_at?: string | null;
  pause_until?: string | null;
  pause_reason?: string | null;
}

type TabKey = 'all' | 'urgent' | 'new' | 'top' | 'mine';
type SortKey = 'newest' | 'fee';

const TOP_TAB_LIMIT = 10;

/** Filter als ruhige Textknöpfe; gesetzte Filter heben sich ab. */
const FILTER_TRIGGER = 'h-9 w-auto gap-1 rounded-full border bg-card px-3.5 text-sm text-muted-foreground shadow-none hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>span]:truncate';
const FILTER_ACTIVE = 'font-medium text-foreground';

const LEVEL_FILTER_LABELS: Record<string, string> = { junior: 'Junior', mid: 'Mid', senior: 'Senior', lead: 'Lead', 'c-level': 'C-Level' };

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

// Ausgeschrieben statt „€61k“ (24.11.2026)
const formatEuroShort = (n: number) => `${Math.round(n).toLocaleString(intlLocale(i18n.language))} €`;

// ─── Stufen der Leiste „Daran arbeitest du“ ─────────────────────────────────
// Dieselben sechs Stufen wie Pipeline und Termin-Fenster (24.11.2026). Vorher kannte die Leiste
// Stufen wie „Interview geführt“ nicht und zeigte dann „Neu“ mit nur einem Strich.
const PIPE_ORDER: PipelineStageKey[] = ['submitted', 'in_review', 'interview_1', 'interview_2', 'offer', 'placed'];

function MiniStagePipeline({ currentStage }: { currentStage: PipelineStageKey | null }) {
  const idx = currentStage ? PIPE_ORDER.indexOf(currentStage) : -1;
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {PIPE_ORDER.map((k, i) => (
        <span key={k} className={cn('h-1.5 w-4 rounded-full', i <= idx ? 'bg-klick' : 'bg-muted-foreground/20')} />
      ))}
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
  const pending = useRecruiterPending();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('recruiterJobs');

  // Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());

  // UI State
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [industryFilter, setIndustryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const pipeline = useRecruiterPipeline();
  const [activeJobSubmissions, setActiveJobSubmissions] = useState<ActiveJobSubmission[]>([]);

  // Activation dialogs
  const [activationDialogJobId, setActivationDialogJobId] = useState<string | null>(null);
  const [slotLimitOpen, setSlotLimitOpen] = useState(false);

  // Quick-submit dialog (after activation or from success step)
  const [submitDialogJob, setSubmitDialogJob] = useState<{ jobId: string; title: string; candidateId?: string } | null>(null);

  // Viewport: Preview-Panel inline (lg+) vs. Sheet (mobile)
  const [isLgUp, setIsLgUp] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsLgUp(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

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

  // Suchen („Ich suche“): Plätze für alle gleich, die Datenbank zählt sie.
  const { isSearching, activateJob, activatedJobIds, capacity, refetch: refetchActivations } = useJobActivation(jobIds);
  const activeJobIds = useMemo(() => new Set(activatedJobIds), [activatedJobIds]);
  const effectiveActiveCount = capacity.used;
  const effectiveCanActivate = capacity.used < capacity.limit;

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
      // recruiter_jobs_view statt jobs: maskiert die Firmenidentitaet
      // serverseitig und liefert company_name erst nach dem Reveal.
      const { data, error } = await supabase
        .from('recruiter_jobs_view')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setJobs(data as unknown as Job[]);
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
      // Kein Join auf jobs mehr: den Firmennamen liefert recruiter_jobs_view
      // selbst — und zwar nur dann, wenn dieser Recruiter den Reveal hat.
      const { data } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('recruiter_id', user.id)
        .eq('company_revealed', true);

      if (data) {
        setRevealedJobIds(new Set(data.map(s => s.job_id)));
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
    if (pending) return; // Vertrag noch nicht gegengezeichnet: nur Ansehen
    if (isSearching(jobId)) return; // Sucht schon (beenden geht in „Meine Suchen“)
    const job = jobs.find(j => j.id === jobId);
    if (job?.paused_at) return; // Pausierte Stelle: kein „Ich suche“
    if (!effectiveCanActivate) {
      setSlotLimitOpen(true);
      return;
    }
    setActivationDialogJobId(jobId);
  }, [pending, isSearching, effectiveCanActivate, jobs]);

  // Rundgang (lib/recruiterTour.ts): Die Bühne öffnet „Aktiv suchen“ für die Beispielstelle selbst,
  // auch nach Neuladen oder Zurück. Einmal je Adresse, sobald die Stelle in der Liste steht.
  const tourState = useLocation().state as { tour?: string; jobId?: string } | null;
  const tourOpened = useRef<string | null>(null);
  useEffect(() => {
    const id = tourState?.tour === 'activate' ? tourState.jobId : undefined;
    if (!id || tourOpened.current === id || !jobs.some(j => j.id === id)) return;
    tourOpened.current = id;
    setActivationDialogJobId(id);
  }, [tourState, jobs]);

  const handleConfirmActivation = useCallback(async (): Promise<ConfirmResult> => {
    if (!activationDialogJobId) return { ok: false, error: t('list.noJobChosen') };
    const res = await activateJob(activationDialogJobId);
    if (res.success && res.result) {
      fetchJobs(); // Firmenname kommt ab „Ich suche“ aus der View
      return { ok: true, result: res.result };
    }
    return { ok: false, error: res.error || t('list.failed') };
  }, [activationDialogJobId, activateJob, t]);

  // Firmenname ab „Ich suche“ (View: company_revealed) oder wie früher nach Opt-in.
  const isJobRevealed = useCallback((jobId: string): boolean => {
    return revealedJobIds.has(jobId) || !!jobs.find(j => j.id === jobId)?.company_revealed;
  }, [revealedJobIds, jobs]);

  const getRevealedCompanyName = useCallback((jobId: string): string | undefined => {
    return jobs.find(j => j.id === jobId)?.company_name ?? undefined;
  }, [jobs]);

  const closePreview = useCallback(() => {
    setSelectedJobId(null);
  }, []);

  // ─── Filtering ──────────────────────────────────────────────────────────

  const newSince = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d;
  }, []);

  const industries = useMemo(() => {
    const set = new Set(jobs.map(j => j.industry).filter(Boolean) as string[]);
    return [...set].sort();
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const result = jobs.filter(job => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        job.title.toLowerCase().includes(q) ||
        job.skills?.some(s => s.toLowerCase().includes(q)) ||
        job.industry?.toLowerCase().includes(q);
      const matchesRemote = remoteFilter === 'all' || job.remote_type === remoteFilter;
      const matchesLevel = levelFilter === 'all' || job.experience_level === levelFilter;
      const matchesIndustry = industryFilter === 'all' || job.industry === industryFilter;

      if (activeTab === 'urgent') return matchesSearch && matchesRemote && matchesLevel && matchesIndustry && job.hiring_urgency === 'urgent';
      if (activeTab === 'new') return matchesSearch && matchesRemote && matchesLevel && matchesIndustry && new Date(job.created_at) >= newSince;

      return matchesSearch && matchesRemote && matchesLevel && matchesIndustry;
    });

    const earningOf = (j: Job) => calculateEarning(j.salary_min, j.salary_max, j.recruiter_fee_percentage) || 0;

    if (activeTab === 'top') {
      return [...result].sort((a, b) => earningOf(b) - earningOf(a)).slice(0, TOP_TAB_LIMIT);
    }

    // Dringende Jobs immer gepinnt, danach gewählte Sortierung
    return [...result].sort((a, b) => {
      const ua = a.hiring_urgency === 'urgent' ? 1 : 0;
      const ub = b.hiring_urgency === 'urgent' ? 1 : 0;
      if (ua !== ub) return ub - ua;
      if (sortBy === 'fee') return earningOf(b) - earningOf(a);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [jobs, searchQuery, remoteFilter, levelFilter, industryFilter, activeTab, newSince, sortBy]);

  const myActiveJobsData = useMemo(() => {
    return jobs
      .filter(j => activeJobIds.has(j.id))
      .map(j => {
        const stats = submissionStats[j.id];
        const mySubs = activeJobSubmissions.filter(s => s.job_id === j.id);
        // Die Vorstellung, die am weitesten ist; beendete (abgesagt, zurückgezogen) zählen nicht
        const rang = (id: string) => (pipeline?.stageOf[id] ? PIPE_ORDER.indexOf(pipeline.stageOf[id]) : -1);
        const laufend = mySubs.filter(x => rang(x.id) >= 0);
        const bestSub = laufend.length > 0 ? laufend.reduce((best, x) => (rang(x.id) > rang(best.id) ? x : best), laufend[0]) : null;
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
          stage: bestSub ? pipeline!.stageOf[bestSub.id] : null,
          hatVorstellung: mySubs.length > 0,
          submittedAt: bestSub?.submitted_at || null,
          companyRevealed: bestSub?.company_revealed || revealedJobIds.has(j.id) || !!j.company_revealed,
          // Kommt aus recruiter_jobs_view und ist ohne Reveal bereits null.
          companyName: j.company_name,
        };
      });
  }, [jobs, activeJobIds, submissionStats, activeJobSubmissions, revealedJobIds, pipeline]);

  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
  const isPanelOpen = !!selectedJob;

  const tabCounts = useMemo(() => ({
    all: jobs.length,
    urgent: jobs.filter(j => j.hiring_urgency === 'urgent').length,
    new: jobs.filter(j => new Date(j.created_at) >= newSince).length,
    top: Math.min(TOP_TAB_LIMIT, jobs.length),
    mine: activatedJobIds.length,
  }), [jobs, activatedJobIds, newSince]);

  const urgentCount = tabCounts.urgent;

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

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: t('list.tabs.all'), count: tabCounts.all },
    { key: 'urgent', label: t('list.tabs.urgent'), count: tabCounts.urgent },
    { key: 'new', label: t('list.tabs.new'), count: tabCounts.new },
    { key: 'top', label: t('list.tabs.top'), count: tabCounts.top },
    { key: 'mine', label: t('list.tabs.mine'), count: tabCounts.mine },
  ];

  return (
    <DashboardLayout>
      {/* Am Handy scrollt die ganze Seite (keine Liste im Kasten), ab md feste Höhe mit eigenem Scrollen */}
      <div className="flex flex-col max-w-7xl md:h-[calc(100vh-4rem)]">
        {/* ── Hero: Compact KPI Strip + Process Cards ── */}
        <div className="shrink-0 py-3 space-y-3">
          {/* Kopf: Titel und eine ruhige Zeile statt drei bunter Pillen (19.10.2026).
              Farbe nur mit Bedeutung: Rot dringend, Grün Geld. */}
          <div>
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {/* Seitentitel wie im Menü statt einer zweiten Begrüßung neben der Übersicht (17.11.2026) */}
              {t('list.pageTitle')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('list.openJobs', { count: jobs.length })}
              {urgentCount > 0 && <> · <span className="text-destructive">{t('list.urgentCount', { count: urgentCount })}</span></>}
              {kpis.totalPotential > 0 && <> · <Trans t={t} i18nKey="list.potentialFee" components={{ fee: <span><Honorar>{formatEuroShort(kpis.totalPotential)}</Honorar></span> }} /></>}
            </p>
          </div>

          {/* Active Jobs — Horizontal Process Cards */}
          {myActiveJobsData.length > 0 && (
            <div className="space-y-1.5">
              <h2 className="text-[15px] font-semibold tracking-tight">
                {t('list.myActiveJobs')} <span className="font-normal text-muted-foreground">{myActiveJobsData.length}</span>
              </h2>

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
                    const timeSince = job.submittedAt
                      ? formatDistanceToNow(new Date(job.submittedAt), { locale: dateFnsLocale(i18n.language), addSuffix: true })
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
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedJobId(job.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter') setSelectedJobId(job.id); }}
                        className="w-56 shrink-0 cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:bg-accent/30"
                      >
                        {/* Stelle zuerst, darunter die Firma (ohne Schloss; verdeckt steht nur die Umschreibung) */}
                        <p className="truncate text-sm font-medium">{job.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{anonLabel}</p>
                        <div className="mt-2.5"><MiniStagePipeline currentStage={job.stage} /></div>
                        <p className="mt-1.5 truncate text-xs text-muted-foreground">
                          {job.stage && timeSince
                            ? `${PIPELINE_LABELS[job.stage]} · ${t('list.submittedAgo', { when: timeSince })}`
                            : job.hatVorstellung ? t('list.noneRunning') : t('list.notSubmittedYet')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Filter + Reiter ── (19.10.2026: Filter ohne Rahmen, Reiter unterstrichen statt
            schwarzer Knopf mit Symbolen — gleiche Reihenfolge wie vorher) */}
        <div className="shrink-0 space-y-3 pb-0" data-tour="jobs.filters">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('list.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 rounded-full pl-9 text-sm"
              />
            </div>
            <Select value={remoteFilter} onValueChange={setRemoteFilter}>
              <SelectTrigger className={cn(FILTER_TRIGGER, remoteFilter !== 'all' && FILTER_ACTIVE)}>
                <SelectValue>{remoteFilter === 'all' ? t('list.filter.remote') : t(`list.remote.${remoteFilter}`, { defaultValue: remoteFilter })}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.filter.remoteAll')}</SelectItem>
                <SelectItem value="remote">{t('list.remote.remote')}</SelectItem>
                <SelectItem value="hybrid">{t('list.remote.hybrid')}</SelectItem>
                <SelectItem value="onsite">{t('list.remote.onsite')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className={cn(FILTER_TRIGGER, levelFilter !== 'all' && FILTER_ACTIVE)}>
                <SelectValue>{levelFilter === 'all' ? t('list.filter.level') : LEVEL_FILTER_LABELS[levelFilter]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('list.filter.levelAll')}</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="c-level">C-Level</SelectItem>
              </SelectContent>
            </Select>
            {industries.length > 0 && (
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className={cn(FILTER_TRIGGER, 'max-w-[220px]', industryFilter !== 'all' && FILTER_ACTIVE)}>
                  <SelectValue>{industryFilter === 'all' ? t('list.filter.industry') : industryFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('list.filter.industryAll')}</SelectItem>
                  {industries.map(ind => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className={cn(FILTER_TRIGGER, 'ml-auto border-0 bg-transparent px-2')}>
                <SelectValue placeholder={t('list.sort.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">{t('list.sort.newest')}</SelectItem>
                <SelectItem value="fee">{t('list.sort.fee')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reiter als Pillen wie beim Kunden (24.11.2026); leere Reiter erscheinen nicht */}
          <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={t('list.tabsAria')}>
            {tabs.filter(tab => tab.key === 'all' || tab.count > 0 || activeTab === tab.key).map(tab => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.key}
                className={cn(
                  'h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-xs font-medium transition-colors',
                  activeTab === tab.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label} <span className="font-normal tabular-nums">{tab.count}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Main: Feed + Panel (fixed height, independent scroll) ── */}
        <div className="flex gap-4 flex-1 min-h-0 pt-4">
          {/* Feed — scrolls independently */}
          <div
            className={cn(
              'space-y-2 transition-all duration-300 md:overflow-y-auto md:pr-1',
              isPanelOpen ? 'w-full lg:w-1/2' : 'w-full',
            )}
          >
            {activeTab === 'mine' ? (
              <MySearchesList onSubmit={(jobId, title) => setSubmitDialogJob({ jobId, title })} />
            ) : filteredJobs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/30" />
                  <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{t('list.empty.title')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || remoteFilter !== 'all'
                      ? t('list.empty.adjust')
                      : t('list.empty.soon')}
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredJobs.map((job, index) => {
                const earning = calculateEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage);
                return (
                  <JobActionCard
                    key={job.id}
                    job={job}
                    earning={earning}
                    isRevealed={isJobRevealed(job.id)}
                    revealedCompanyName={getRevealedCompanyName(job.id)}
                    isSelected={selectedJobId === job.id}
                    tourId={index === 0 ? 'jobs.firstCard' : undefined}
                    isActive={isSearching(job.id)}
                    pausedUntil={job.paused_at ? (job.pause_until ?? job.paused_at) : null}
                    onSelect={() => {
                      if (selectedJobId === job.id) {
                        navigate(`/recruiter/jobs/${job.id}`);
                      } else {
                        setSelectedJobId(job.id);
                      }
                    }}
                    onToggleActive={(e) => { e.stopPropagation(); handleActivateClick(job.id); }}
                  />
                );
              })
            )}
          </div>

          {/* Panel — scrolls independently, 50% width */}
          {isPanelOpen && selectedJob && (
            <div className="hidden lg:block w-1/2 overflow-hidden" data-tour="jobs.preview">
              <Card className="h-full">
                <CardContent className="p-0 h-full">
                  <JobPreviewPanel
                    job={selectedJob}
                    earning={calculateEarning(selectedJob.salary_min, selectedJob.salary_max, selectedJob.recruiter_fee_percentage)}
                    isRevealed={isJobRevealed(selectedJob.id)}
                    revealedCompanyName={getRevealedCompanyName(selectedJob.id)}
                    isActive={isSearching(selectedJob.id)}
                    pausedUntil={selectedJob.paused_at ? (selectedJob.pause_until ?? selectedJob.paused_at) : null}
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
        if (!dialogJob) return null;
        return (
          <ActivationConfirmDialog
            open={true}
            onOpenChange={(open) => { if (!open) setActivationDialogJobId(null); }}
            jobId={dialogJob.id}
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
            earning={calculateEarning(dialogJob.salary_min, dialogJob.salary_max, dialogJob.recruiter_fee_percentage)}
            earningPerDay={verdienstJeTag(dialogJob)}
            hiringUrgency={dialogJob.hiring_urgency}
            activeCount={effectiveActiveCount}
            maxSlots={capacity.limit}
            onConfirm={handleConfirmActivation}
            onSubmitCandidate={(candidateId) => {
              setActivationDialogJobId(null);
              setSubmitDialogJob({ jobId: dialogJob.id, title: dialogJob.title, candidateId });
            }}
            onGoToJob={() => {
              setActivationDialogJobId(null);
              navigate(`/recruiter/jobs/${dialogJob.id}`);
            }}
          />
        );
      })()}

      {/* Alle Plätze belegt */}
      <SlotLimitDialog
        open={slotLimitOpen}
        onOpenChange={setSlotLimitOpen}
        activeCount={effectiveActiveCount}
        maxSlots={capacity.limit}
        onShowMine={() => setActiveTab('mine')}
      />

      {/* Mobile: Preview als Sheet statt verstecktem Panel */}
      <Sheet open={isPanelOpen && !isLgUp} onOpenChange={(o) => { if (!o) closePreview(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0">
          {selectedJob && (
            <div className="h-full overflow-hidden pt-8">
              <JobPreviewPanel
                job={selectedJob}
                earning={calculateEarning(selectedJob.salary_min, selectedJob.salary_max, selectedJob.recruiter_fee_percentage)}
                isRevealed={isJobRevealed(selectedJob.id)}
                revealedCompanyName={getRevealedCompanyName(selectedJob.id)}
                isActive={isSearching(selectedJob.id)}
                pausedUntil={selectedJob.paused_at ? (selectedJob.pause_until ?? selectedJob.paused_at) : null}
                onToggleActive={() => handleActivateClick(selectedJob.id)}
                onClose={closePreview}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Schnell-Vorstellen (aus dem Erfolgsschritt der Aktivierung): neuer Einreichungsweg */}
      <VorstellenFenster
        open={!!submitDialogJob}
        onOpenChange={(o) => { if (!o) setSubmitDialogJob(null); }}
        jobId={submitDialogJob?.jobId ?? null}
        candidate={submitDialogJob?.candidateId ? { id: submitDialogJob.candidateId, name: '' } : null}
        onSubmitted={() => { fetchRevealedJobs(); refetchActivations(); }}
      />
    </DashboardLayout>
  );
}

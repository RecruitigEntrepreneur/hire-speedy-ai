import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Briefcase,
  MapPin,
  Building2,
  Clock,
  Edit2,
  Zap,
  Pause,
  Play,
  Users,
  Star,
  ArrowLeft,
  ArrowRight,
  Factory,
  Monitor,
  ExternalLink,
} from 'lucide-react';
import { getJobHealthStatus } from '@/lib/jobPipelineStatus';
import { cn } from '@/lib/utils';
import { useRef, useState, useEffect } from 'react';

// ─── Types ──────────────────────────────────────────────────────

interface JobStats {
  totalSubmissions: number;
  inProcess: number;
  interviewed: number;
  hired: number;
  daysOpen: number;
  activeRecruiters: number;
}

interface Candidate {
  id: string;
  full_name: string;
  seniority: string | null;
  experience_years: number | null;
  skills: string[] | null;
}

interface Submission {
  id: string;
  match_score: number | null;
  stage: string;
  candidate: Candidate;
}

interface ClientJobHeroProps {
  job: {
    id: string;
    title: string;
    company_name: string;
    location: string | null;
    remote_type: string | null;
    employment_type?: string | null;
    industry?: string | null;
    salary_min: number | null;
    salary_max: number | null;
    status: string | null;
    paused_at: string | null;
    created_at: string;
  };
  stats: JobStats;
  submissions?: Submission[];
  onEdit: () => void;
  onPauseToggle: () => void;
  onBoost?: () => void;
  onCandidateClick?: (submission: Submission) => void;
  onViewAllCandidates?: () => void;
  showStats?: boolean;
}

// ─── Helpers ────────────────────────────────────────────────────

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'Vor Ort',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  fulltime: 'Vollzeit',
  'full-time': 'Vollzeit',
  parttime: 'Teilzeit',
  'part-time': 'Teilzeit',
  contract: 'Freelance',
  internship: 'Praktikum',
};

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return `€${(min / 1000).toFixed(0)}k – €${(max / 1000).toFixed(0)}k`;
  if (min) return `Ab €${(min / 1000).toFixed(0)}k`;
  return `Bis €${(max! / 1000).toFixed(0)}k`;
}

function generateAnonymousId(submissionId: string, jobTitle?: string): string {
  const prefix = jobTitle?.slice(0, 2).toUpperCase() || 'XX';
  return `${prefix}-${submissionId.slice(0, 4).toUpperCase()}`;
}

// ─── Stage Pipeline (matching aktive Prozesse pattern) ──────────

const STAGE_ORDER = [
  'new', 'submitted', 'screening', 'shortlisted',
  'interview_requested', 'candidate_opted_in',
  'interview', 'offer', 'hired',
] as const;

const STAGE_CONFIG: Record<string, { label: string; shortLabel: string; className: string; dotColor: string }> = {
  new:                  { label: 'Neu',                shortLabel: 'Neu',       className: 'bg-muted text-muted-foreground',                        dotColor: 'bg-muted-foreground' },
  submitted:            { label: 'Eingereicht',        shortLabel: 'Einger.',   className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',       dotColor: 'bg-blue-500' },
  screening:            { label: 'Screening',          shortLabel: 'Screen.',   className: 'bg-violet-500/10 text-violet-600 border-violet-500/20', dotColor: 'bg-violet-500' },
  shortlisted:          { label: 'Shortlisted',        shortLabel: 'Short.',    className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', dotColor: 'bg-indigo-500' },
  interview_requested:  { label: 'Interview angefragt', shortLabel: 'Angefr.',  className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',   dotColor: 'bg-amber-500' },
  candidate_opted_in:   { label: 'Opt-In erteilt',     shortLabel: 'Opt-In',    className: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',      dotColor: 'bg-cyan-500' },
  interview:            { label: 'Interview',          shortLabel: 'Interv.',   className: 'bg-amber-500/10 text-amber-600 border-amber-500/20',   dotColor: 'bg-amber-500' },
  interview_scheduled:  { label: 'Interview geplant',  shortLabel: 'Geplant',   className: 'bg-green-500/10 text-green-600 border-green-500/20',   dotColor: 'bg-green-500' },
  client_review:        { label: 'Client Review',      shortLabel: 'Review',    className: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', dotColor: 'bg-indigo-500' },
  offer:                { label: 'Angebot',            shortLabel: 'Angebot',   className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dotColor: 'bg-emerald-500' },
  hired:                { label: 'Eingestellt',        shortLabel: 'Eingest.',  className: 'bg-green-500/10 text-green-700 border-green-500/30',   dotColor: 'bg-green-600' },
};

function getStageInfo(stage: string | null) {
  return STAGE_CONFIG[stage || 'new'] || STAGE_CONFIG.new;
}

function getStageIndex(stage: string | null): number {
  const idx = STAGE_ORDER.indexOf((stage || 'new') as any);
  return idx >= 0 ? idx : 0;
}

function MiniStagePipeline({ currentStage }: { currentStage: string | null }) {
  const currentIndex = getStageIndex(currentStage);
  const keyStages = ['submitted', 'screening', 'interview', 'offer', 'hired'];

  return (
    <div className="flex items-center gap-0.5">
      {keyStages.map((stage) => {
        const stageConfig = getStageInfo(stage);
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
                  isActive ? stageConfig.dotColor :
                  isPassed ? 'bg-green-400' :
                  'bg-muted-foreground/20'
                )}
              />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {stageConfig.label}
              {isActive && ' (aktuell)'}
              {isPassed && ' \u2713'}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────

export function ClientJobHero({
  job, stats, submissions = [], onEdit, onPauseToggle, onBoost,
  onCandidateClick, onViewAllCandidates, showStats = true
}: ClientJobHeroProps) {
  const isPaused = !!job.paused_at;
  const healthStatus = getJobHealthStatus(
    stats.totalSubmissions,
    stats.interviewed,
    stats.activeRecruiters,
    stats.daysOpen,
    isPaused
  );

  const salary = formatSalary(job.salary_min, job.salary_max);

  // Top candidates for the inline strip
  const topCandidates = submissions
    .filter(s => !['rejected', 'hired'].includes(s.stage || ''))
    .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
    .slice(0, 6);

  const hasCandidates = topCandidates.length > 0;

  // Horizontal scroll state (matching aktive Prozesse pattern)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true });
      const ro = new ResizeObserver(checkScroll);
      ro.observe(el);
      return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect(); };
    }
  }, []);

  useEffect(() => {
    if (topCandidates.length > 0) {
      setTimeout(checkScroll, 50);
    }
  }, [topCandidates.length]);

  return (
    <div className="space-y-4">
      {/* Back Link */}
      <Link
        to="/dashboard/jobs"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Job-Übersicht
      </Link>

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-accent/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />

        <div className="relative p-6 md:p-8">
          {/* ── Row 1: Title + Status ──────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0 shadow-navy">
              <Briefcase className="h-7 w-7 md:h-8 md:w-8 text-primary-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">{job.title}</h1>
                <Badge
                  variant="outline"
                  className={cn(healthStatus.color.bg, healthStatus.color.text, healthStatus.color.border, 'gap-1 text-[10px]')}
                >
                  {healthStatus.label}
                </Badge>
              </div>

              {/* ── Row 2: Meta + Tags inline ──────────────────── */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {job.company_name}
                </span>
                {salary && (
                  <span className="font-medium text-foreground">{salary}</span>
                )}
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {job.location}
                  </span>
                )}
                {job.industry && (
                  <Badge variant="secondary" className="font-normal gap-1 text-[11px] h-5 px-1.5">
                    <Factory className="h-3 w-3" />
                    {job.industry}
                  </Badge>
                )}
                {job.remote_type && (
                  <Badge variant="secondary" className="font-normal gap-1 text-[11px] h-5 px-1.5">
                    <Monitor className="h-3 w-3" />
                    {REMOTE_LABELS[job.remote_type] || job.remote_type}
                  </Badge>
                )}
                {job.employment_type && (
                  <Badge variant="secondary" className="font-normal gap-1 text-[11px] h-5 px-1.5">
                    <Briefcase className="h-3 w-3" />
                    {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
                  </Badge>
                )}
                <span className="flex items-center gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  {stats.daysOpen}d offen
                </span>
              </div>
            </div>

            {/* Status Badge + Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={
                  job.status === 'published' && !isPaused ? 'default' :
                  job.status === 'closed' ? 'destructive' :
                  isPaused ? 'secondary' : 'outline'
                }
                className="h-7 px-3"
              >
                {isPaused ? 'Pausiert' :
                 job.status === 'published' ? 'Aktiv' :
                 job.status === 'closed' ? 'Geschlossen' : 'Entwurf'}
              </Badge>
            </div>
          </div>

          {/* ── Row 3: Stats inline + Actions ──────────────────── */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{stats.totalSubmissions}</span>
                <span className="text-muted-foreground">Kand.</span>
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold">{stats.inProcess}</span>
                <span className="text-muted-foreground ml-1">Bearb.</span>
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold">{stats.interviewed}</span>
                <span className="text-muted-foreground ml-1">Interv.</span>
              </span>
              <span className="text-border">|</span>
              <span className={cn(stats.hired > 0 && 'text-emerald-500')}>
                <span className="font-semibold">{stats.hired}</span>
                <span className="text-muted-foreground ml-1">Eingest.</span>
              </span>
              <span className="text-border">|</span>
              <span>
                <span className="font-semibold">{stats.activeRecruiters}</span>
                <span className="text-muted-foreground ml-1">Recruiter</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={onEdit} variant="outline" size="sm" className="h-8">
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Bearbeiten
              </Button>
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link to={`/dashboard/command/${job.id}`}>
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  Pipeline
                </Link>
              </Button>
              {job.status === 'published' && !isPaused && onBoost && (
                <Button onClick={onBoost} variant="outline" size="sm" className="h-8 text-amber-600 border-amber-200 hover:bg-amber-50 hover:border-amber-300">
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Boost
                </Button>
              )}
              <Button onClick={onPauseToggle} variant="ghost" size="sm" className="h-8">
                {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* ── Row 4: Candidate Process Cards (aktive Prozesse style) ── */}
          {showStats && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Top Kandidaten{hasCandidates ? ` (${topCandidates.length})` : ''}
                  </span>
                </div>
                {hasCandidates && onViewAllCandidates && (
                  <Button variant="ghost" size="sm" onClick={onViewAllCandidates} className="text-xs h-6 px-2">
                    Alle vergleichen
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>

              {hasCandidates ? (
                <div className="relative">
                  {/* Left fade */}
                  {canScrollLeft && (
                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card to-transparent z-10 pointer-events-none rounded-l-lg" />
                  )}
                  {/* Right fade */}
                  {canScrollRight && (
                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-card to-transparent z-10 pointer-events-none rounded-r-lg" />
                  )}

                  <div
                    ref={scrollRef}
                    className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mb-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {topCandidates.map((submission, index) => {
                      const anonymousId = generateAnonymousId(submission.id, job.title);
                      const isTop = index === 0;
                      const score = submission.match_score || 0;
                      const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-muted-foreground';
                      const stageInfo = getStageInfo(submission.stage);

                      return (
                        <div
                          key={submission.id}
                          onClick={() => onCandidateClick?.(submission)}
                          className={cn(
                            'shrink-0 w-52 rounded-lg border p-2.5 transition-all hover:shadow-sm group cursor-pointer',
                            isTop ? 'border-amber-500/30 bg-amber-500/5' : 'hover:border-muted-foreground/30'
                          )}
                        >
                          {/* Row 1: Anonymous ID + Match Score */}
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isTop && (
                              <Star className="h-3 w-3 text-amber-500 shrink-0" />
                            )}
                            <span className="text-xs font-mono font-semibold truncate flex-1">{anonymousId}</span>
                            {score > 0 && (
                              <span className={cn('text-xs font-bold shrink-0', scoreColor)}>
                                {score}%
                              </span>
                            )}
                            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </div>
                          </div>

                          {/* Row 2: Seniority + Experience */}
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {submission.candidate.seniority || 'Kandidat'}
                            {submission.candidate.experience_years ? ` · ${submission.candidate.experience_years}J Erfahrung` : ''}
                          </p>

                          {/* Row 3: Stage pipeline + badge */}
                          <div className="flex items-center justify-between gap-2 mt-2">
                            <MiniStagePipeline currentStage={submission.stage} />
                            <Badge
                              variant="outline"
                              className={cn('shrink-0 text-[9px] px-1.5 py-0 leading-4', stageInfo.className)}
                            >
                              {stageInfo.shortLabel}
                            </Badge>
                          </div>

                          {/* Row 4: Skills */}
                          {submission.candidate.skills && submission.candidate.skills.length > 0 && (
                            <div className="mt-1.5 flex gap-1 overflow-hidden">
                              {submission.candidate.skills.slice(0, 2).map((skill, i) => (
                                <Badge key={i} variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                                  {skill}
                                </Badge>
                              ))}
                              {submission.candidate.skills.length > 2 && (
                                <span className="text-[9px] text-muted-foreground">
                                  +{submission.candidate.skills.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="flex items-center gap-3 p-3 rounded-lg bg-background/40 border border-border/50">
                  <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Star className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">Kandidaten werden gesucht</p>
                    <p className="text-[11px] text-muted-foreground">
                      {stats.activeRecruiters > 0
                        ? `${stats.activeRecruiters} Recruiter aktiv — Erste Kandidaten werden bald eingereicht`
                        : 'Sobald Recruiter Kandidaten einreichen, erscheinen hier die besten Matches'
                      }
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

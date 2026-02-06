import { useState, useEffect } from 'react';
import { useMatchScoreV31, V31MatchResult } from '@/hooks/useMatchScoreV31';
import { MatchScoreCardV31 } from './MatchScoreCardV31';
import { CommuteConfirmationDialog } from './CommuteConfirmationDialog';
import { AIRecommendationBadge } from './AIRecommendationBadge';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Zap,
  MapPin,
  Euro,
  RefreshCw,
  Loader2,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Flame,
  Sparkles,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { getExposeReadiness } from '@/hooks/useExposeReadiness';
import { prefetchRecommendations } from '@/hooks/useMatchRecommendation';
import { formatSimpleAnonymousCompany, formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';

interface CandidateJobMatchingV3Props {
  candidate: {
    id: string;
    full_name: string;
    skills: string[] | null;
    experience_years: number | null;
    expected_salary: number | null;
    salary_expectation_min: number | null;
    salary_expectation_max: number | null;
    city: string | null;
    seniority: string | null;
    target_roles: string[] | null;
    job_title: string | null;
    max_commute_minutes: number | null;
    commute_mode: string | null;
    address_lat: number | null;
    address_lng: number | null;
    email?: string;
    phone?: string;
    availability_date?: string | null;
    notice_period?: string | null;
    cv_ai_summary?: string | null;
    cv_ai_bullets?: unknown[] | null;
  };
  onSubmissionCreated?: () => void;
}

interface JobInfo {
  id: string;
  title: string;
  industry: string | null;
  company_size_band: string | null;
  funding_stage: string | null;
  tech_environment: string[] | null;
  location: string | null;
  salary_max: number | null;
  salary_min: number | null;
  remote_type: string | null;
}
export function CandidateJobMatchingV3({ candidate, onSubmissionCreated }: CandidateJobMatchingV3Props) {
  const { 
    calculateBatchMatch, 
    loading: matchLoading,
    sortByRelevance,
    getPolicyColor,
    getPolicyLabel,
    getPolicyIcon,
  } = useMatchScoreV31();
  
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [matchResults, setMatchResults] = useState<V31MatchResult[]>([]);
  const [revealedMap, setRevealedMap] = useState<Map<string, string>>(new Map());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [commuteDialog, setCommuteDialog] = useState<{
    open: boolean;
    job: JobInfo | null;
    travelTime: number;
  }>({ open: false, job: null, travelTime: 0 });
  const { user } = useAuth();

  // Check readiness for submission
  const readiness = getExposeReadiness({
    skills: candidate.skills,
    experience_years: candidate.experience_years,
    expected_salary: candidate.expected_salary,
    availability_date: candidate.availability_date,
    notice_period: candidate.notice_period,
    city: candidate.city,
    cv_ai_summary: candidate.cv_ai_summary,
    cv_ai_bullets: candidate.cv_ai_bullets,
  });

  // Load jobs and calculate matches on mount
  useEffect(() => {
    async function loadJobsAndMatches() {
      setJobsLoading(true);
      try {
        // Fetch published jobs WITHOUT company_name (Triple-Blind) + revealed submissions in parallel
        const [jobsRes, revealedRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('id, title, industry, company_size_band, funding_stage, tech_environment, location, salary_max, salary_min, remote_type')
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('submissions')
            .select('job_id, jobs(company_name)')
            .eq('recruiter_id', user!.id)
            .eq('company_revealed', true)
        ]);

        if (jobsRes.error) throw jobsRes.error;
        
        const fetchedJobs = jobsRes.data || [];
        setJobs(fetchedJobs);

        // Build revealed map: job_id → company_name (only for revealed submissions)
        const map = new Map<string, string>();
        revealedRes.data?.forEach((s: any) => {
          if (s.jobs?.company_name) {
            map.set(s.job_id, s.jobs.company_name);
          }
        });
        setRevealedMap(map);

        if (fetchedJobs.length > 0) {
          // Calculate batch matches - use 'preview' mode to show more results
          const results = await calculateBatchMatch(
            candidate.id,
            fetchedJobs.map(j => j.id),
            'preview'
          );
          setMatchResults(sortByRelevance(results));
        }
      } catch (error) {
        console.error('Error loading jobs:', error);
        toast.error('Fehler beim Laden der Jobs');
      } finally {
        setJobsLoading(false);
      }
    }

    if (candidate.id) {
      loadJobsAndMatches();
    }
  }, [candidate.id]);

  const handleRefresh = async () => {
    if (jobs.length === 0) return;
    
    const results = await calculateBatchMatch(
      candidate.id,
      jobs.map(j => j.id),
      'preview'
    );
    setMatchResults(sortByRelevance(results));
    toast.success('Matches aktualisiert');
  };

  const getJobInfo = (jobId: string): JobInfo | undefined => {
    return jobs.find(j => j.id === jobId);
  };

  // Triple-Blind: Display helper – show real name only if revealed, otherwise anonymized
  const getJobDisplayName = (jobId: string, job: JobInfo): string => {
    const revealedName = revealedMap.get(jobId);
    if (revealedName) return revealedName;

    return formatAnonymousCompany({
      industry: job.industry,
      companySize: job.company_size_band,
      fundingStage: job.funding_stage,
      techStack: job.tech_environment,
      location: job.location,
      remoteType: job.remote_type,
    });
  };

  const handleSubmitToJob = async (job: JobInfo, result: V31MatchResult) => {
    if (!user) return;
    
    // Check readiness before allowing submission
    if (!readiness.isReady) {
      toast.error(`Profil unvollständig. Fehlend: ${readiness.missingFields.join(', ')}`);
      return;
    }
    
    // Check for commute warnings
    if (result.constraints.breakdown.commute < 50 && result.gates.dealbreakers.workModel === 1) {
      setCommuteDialog({
        open: true,
        job,
        travelTime: candidate.max_commute_minutes || 45,
      });
      return;
    }

    await doSubmit(job, result);
  };

  const doSubmit = async (job: JobInfo, result: V31MatchResult) => {
    if (!user) return;
    
    setSubmitting(job.id);
    try {
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('job_id', job.id)
        .maybeSingle();

      if (existing) {
        toast.info('Kandidat wurde bereits für diesen Job eingereicht');
        setSubmitting(null);
        return;
      }

      const { error } = await supabase
        .from('submissions')
        .insert({
          candidate_id: candidate.id,
          job_id: job.id,
          recruiter_id: user.id,
          status: 'submitted',
          match_score: result.overall,
        });

      if (error) throw error;

      toast.success(`${candidate.full_name} wurde für "${job.title}" eingereicht`);
      onSubmissionCreated?.();
    } catch (error) {
      console.error('Error creating submission:', error);
      toast.error('Fehler beim Einreichen');
    } finally {
      setSubmitting(null);
    }
  };

  const handleCommuteResponse = async (response: 'yes' | 'conditional' | 'no') => {
    if (response === 'yes' && commuteDialog.job) {
      const result = matchResults.find(r => r.jobId === commuteDialog.job?.id);
      if (result) {
        await doSubmit(commuteDialog.job, result);
      }
    }
    setCommuteDialog({ open: false, job: null, travelTime: 0 });
  };

  // Filter visible matches (hot + standard + maybe, exclude only hidden)
  const visibleMatches = matchResults.filter(r => r.policy === 'hot' || r.policy === 'standard' || r.policy === 'maybe');
  const hotMatches = matchResults.filter(r => r.policy === 'hot');
  const standardMatches = matchResults.filter(r => r.policy === 'standard');
  const maybeMatches = matchResults.filter(r => r.policy === 'maybe');
  const hiddenMatches = matchResults.filter(r => r.policy === 'hidden');

  if (jobsLoading || matchLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            KI-Matching V3.1
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (visibleMatches.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              KI-Matching V3.1
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={matchLoading}>
              <RefreshCw className={cn("h-4 w-4", matchLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <div>
              <p className="text-sm font-medium">Keine passenden Jobs gefunden</p>
              <p className="text-xs">
                {maybeMatches.length > 0 
                  ? `${maybeMatches.length} Jobs mit niedrigerem Score vorhanden`
                  : 'Bitte prüfen Sie die Kandidaten-Skills und -Präferenzen'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              KI-Matching V3.1
              <Badge variant="secondary" className="text-xs">
                {visibleMatches.length} Matches
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={matchLoading}>
              <RefreshCw className={cn("h-4 w-4", matchLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Readiness Warning */}
          {!readiness.isReady && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                <Lock className="h-4 w-4" />
                Profil unvollständig ({readiness.score}%)
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                Fehlend: {readiness.missingFields.join(', ')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Vervollständigen Sie das Profil, um Kandidaten einzureichen.
              </p>
            </div>
          )}

          {/* Hot Matches Section */}
          {hotMatches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
                <Flame className="h-4 w-4" />
                Hot Matches ({hotMatches.length})
              </div>
              <div className="space-y-2">
                {hotMatches.map(result => {
                  const job = getJobInfo(result.jobId);
                  if (!job) return null;
                  
                  return (
                    <JobMatchRow
                      key={result.jobId}
                      job={job}
                      result={result}
                      expanded={expandedJob === result.jobId}
                      onToggle={() => setExpandedJob(expandedJob === result.jobId ? null : result.jobId)}
                      onSubmit={() => handleSubmitToJob(job, result)}
                      submitting={submitting === result.jobId}
                      isReady={readiness.isReady}
                      candidateId={candidate.id}
                      getJobDisplayName={getJobDisplayName}
                      getPolicyColor={getPolicyColor}
                      getPolicyLabel={getPolicyLabel}
                      getPolicyIcon={getPolicyIcon}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Standard Matches Section */}
          {standardMatches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
                Standard Matches ({standardMatches.length})
              </div>
              <div className="space-y-2">
                {standardMatches.map(result => {
                  const job = getJobInfo(result.jobId);
                  if (!job) return null;
                  
                  return (
                    <JobMatchRow
                      key={result.jobId}
                      job={job}
                      result={result}
                      expanded={expandedJob === result.jobId}
                      onToggle={() => setExpandedJob(expandedJob === result.jobId ? null : result.jobId)}
                      onSubmit={() => handleSubmitToJob(job, result)}
                      submitting={submitting === result.jobId}
                      isReady={readiness.isReady}
                      candidateId={candidate.id}
                      getJobDisplayName={getJobDisplayName}
                      getPolicyColor={getPolicyColor}
                      getPolicyLabel={getPolicyLabel}
                      getPolicyIcon={getPolicyIcon}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Maybe Matches Section */}
          {maybeMatches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                Weitere Optionen ({maybeMatches.length})
              </div>
              <div className="space-y-2">
                {maybeMatches.map(result => {
                  const job = getJobInfo(result.jobId);
                  if (!job) return null;
                  
                  return (
                    <JobMatchRow
                      key={result.jobId}
                      job={job}
                      result={result}
                      expanded={expandedJob === result.jobId}
                      onToggle={() => setExpandedJob(expandedJob === result.jobId ? null : result.jobId)}
                      onSubmit={() => handleSubmitToJob(job, result)}
                      submitting={submitting === result.jobId}
                      isReady={readiness.isReady}
                      candidateId={candidate.id}
                      getJobDisplayName={getJobDisplayName}
                      getPolicyColor={getPolicyColor}
                      getPolicyLabel={getPolicyLabel}
                      getPolicyIcon={getPolicyIcon}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Hidden Matches Info */}
          {hiddenMatches.length > 0 && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              +{hiddenMatches.length} weitere Jobs mit sehr niedrigem Score
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commute Confirmation Dialog */}
      {commuteDialog.job && (
        <CommuteConfirmationDialog
          open={commuteDialog.open}
          onOpenChange={(open) => setCommuteDialog(prev => ({ ...prev, open }))}
          candidate={{
            id: candidate.id,
            full_name: candidate.full_name,
            max_commute_minutes: candidate.max_commute_minutes || 30,
            email: candidate.email,
            phone: candidate.phone,
          }}
          job={{
            id: commuteDialog.job.id,
            title: commuteDialog.job.title,
            company_name: getJobDisplayName(commuteDialog.job.id, commuteDialog.job),
            location: commuteDialog.job.location || '',
          }}
          travelTime={commuteDialog.travelTime}
          onResponse={handleCommuteResponse}
        />
      )}
    </>
  );
}

// Job Match Row Component
function JobMatchRow({
  job,
  result,
  expanded,
  onToggle,
  onSubmit,
  submitting,
  isReady,
  candidateId,
  getJobDisplayName,
  getPolicyColor,
  getPolicyLabel,
  getPolicyIcon,
}: {
  job: JobInfo;
  result: V31MatchResult;
  expanded: boolean;
  onToggle: () => void;
  onSubmit: () => void;
  submitting: boolean;
  isReady: boolean;
  candidateId: string;
  getJobDisplayName: (jobId: string, job: JobInfo) => string;
  getPolicyColor: (policy: V31MatchResult['policy']) => string;
  getPolicyLabel: (policy: V31MatchResult['policy']) => string;
  getPolicyIcon: (policy: V31MatchResult['policy']) => string;
}) {
  const [hovered, setHovered] = useState(false);

  // Prefetch recommendation on hover
  useEffect(() => {
    if (hovered && candidateId && job.id) {
      prefetchRecommendations(candidateId, [job.id]);
    }
  }, [hovered, candidateId, job.id]);

  // Calculate must-have coverage visual (5 dots)
  const coverageDots = Math.round(result.mustHaveCoverage * 5);

  return (
    <div className="space-y-0">
      <div 
        className={cn(
          "group relative flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer",
          result.policy === 'hot' 
            ? "bg-gradient-to-r from-green-50/80 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/10 border-green-200 dark:border-green-800 hover:border-green-400 hover:shadow-md hover:shadow-green-100" 
            : result.policy === 'standard'
            ? "bg-gradient-to-r from-blue-50/50 to-indigo-50/30 dark:from-blue-900/10 dark:to-indigo-900/5 border-blue-100 dark:border-blue-800 hover:border-blue-300 hover:shadow-sm"
            : "bg-background hover:border-primary/50 hover:shadow-sm"
        )}
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Score Ring */}
        <div className="relative flex-shrink-0">
          <svg className="w-14 h-14" viewBox="0 0 48 48">
            {/* Background circle */}
            <circle 
              className="text-muted stroke-current" 
              strokeWidth="3" 
              fill="transparent" 
              r="18" cx="24" cy="24" 
            />
            {/* Progress circle */}
            <circle 
              className={cn(
                "stroke-current transition-all duration-500",
                result.policy === 'hot' ? 'text-green-500' :
                result.policy === 'standard' ? 'text-blue-500' :
                result.policy === 'maybe' ? 'text-amber-500' : 'text-muted-foreground'
              )}
              strokeWidth="3" 
              fill="transparent" 
              r="18" cx="24" cy="24"
              strokeDasharray={`${(result.overall / 100) * 113} 113`}
              strokeLinecap="round"
              transform="rotate(-90 24 24)"
              style={{
                filter: result.policy === 'hot' ? 'drop-shadow(0 0 6px rgba(34, 197, 94, 0.4))' : 'none'
              }}
            />
            <text 
              x="24" y="26" 
              textAnchor="middle" 
              className={cn(
                "text-sm font-bold fill-current",
                getPolicyColor(result.policy)
              )}
            >
              {result.overall}
            </text>
          </svg>
          {/* Policy icon */}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs">
            {getPolicyIcon(result.policy)}
          </span>
        </div>

        {/* Job Info */}
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
            {job.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {/* Triple-Blind: Show revealed name or anonymized company */}
            <span className="font-medium text-muted-foreground">
              {getJobDisplayName(job.id, job)}
            </span>
            {(job.salary_min || job.salary_max) && (
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                {job.salary_min ? `${Math.round(job.salary_min / 1000)}k - ` : ''}
                {job.salary_max ? `${Math.round(job.salary_max / 1000)}k` : ''}
              </span>
            )}
          </div>
          
          {/* Must-Have Coverage Mini Bar */}
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-2 h-2 rounded-sm transition-colors",
                    i < coverageDots 
                      ? result.mustHaveCoverage >= 0.85 ? "bg-green-500" 
                        : result.mustHaveCoverage >= 0.7 ? "bg-blue-500" 
                        : "bg-amber-500"
                      : "bg-muted"
                  )} 
                />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {Math.round(result.mustHaveCoverage * 100)}% Must-Haves
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant={result.policy === 'hot' ? 'default' : 'secondary'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSubmit();
                    }}
                    disabled={submitting || !isReady}
                    className={cn(
                      "shrink-0 transition-all",
                      result.policy === 'hot' && "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : !isReady ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Gesperrt</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        <span className="hidden sm:inline">Einreichen</span>
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!isReady && (
                <TooltipContent>
                  Profil unvollständig - bitte vervollständigen
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <Button 
            size="sm" 
            variant="ghost" 
            className={cn(
              "shrink-0 h-8 w-8 p-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Expanded Details with Animation */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-in-out",
        expanded ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="pt-2 pb-1 px-2 space-y-3">
          {/* AI Recommendation Badge */}
          <AIRecommendationBadge
            candidateId={candidateId}
            jobId={job.id}
            matchResult={result}
            autoLoad={expanded}
            compact={false}
          />
          
          {/* Detailed Match Score Card */}
          <MatchScoreCardV31 result={result} showExplainability={true} compact={true} />
        </div>
      </div>
    </div>
  );
}

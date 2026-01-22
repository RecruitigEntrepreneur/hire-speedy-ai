import { useState, useEffect } from 'react';
import { useMatchScoreV31, V31MatchResult } from '@/hooks/useMatchScoreV31';
import { MatchScoreCardV31 } from './MatchScoreCardV31';
import { CommuteConfirmationDialog } from './CommuteConfirmationDialog';
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
  company_name: string;
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
        // Fetch published jobs
        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('id, title, company_name, location, salary_max, salary_min, remote_type')
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(50);

        if (jobsError) throw jobsError;
        
        const fetchedJobs = jobsData || [];
        setJobs(fetchedJobs);

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
            company_name: commuteDialog.job.company_name,
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
  getPolicyColor: (policy: V31MatchResult['policy']) => string;
  getPolicyLabel: (policy: V31MatchResult['policy']) => string;
  getPolicyIcon: (policy: V31MatchResult['policy']) => string;
}) {
  return (
    <div className="space-y-2">
      <div 
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
          result.policy === 'hot' 
            ? "bg-green-50/50 dark:bg-green-900/10 border-green-200 dark:border-green-800 hover:border-green-400" 
            : "bg-background hover:border-primary/50"
        )}
        onClick={onToggle}
      >
        {/* Score Circle */}
        <div className="flex flex-col items-center min-w-[50px]">
          <span className={cn("text-lg font-bold", getPolicyColor(result.policy))}>
            {result.overall ?? 0}%
          </span>
          <span className="text-xs">{getPolicyIcon(result.policy)}</span>
        </div>

        {/* Job Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{job.title}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            <span className="truncate">{job.company_name}</span>
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            {job.salary_max && (
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                {Math.round(job.salary_max / 1000)}k
              </span>
            )}
          </div>
          {/* Coverage Badge */}
          <div className="mt-1">
            <Badge 
              variant={result.mustHaveCoverage >= 0.85 ? 'default' : result.mustHaveCoverage >= 0.7 ? 'secondary' : 'destructive'} 
              className="text-xs"
            >
              {Math.round(result.mustHaveCoverage * 100)}% Must-Have Coverage
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="shrink-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
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
                    className="shrink-0"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : !isReady ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Gesperrt
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        Einreichen
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
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="ml-4 mr-4">
          <MatchScoreCardV31 result={result} showExplainability={true} />
        </div>
      )}
    </div>
  );
}

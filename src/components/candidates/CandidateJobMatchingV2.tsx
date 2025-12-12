import { useState } from 'react';
import { useJobMatching, MatchedJob } from '@/hooks/useJobMatching';
import { useMatchScoreV2 } from '@/hooks/useMatchScoreV2';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MatchScoreCardV2 } from './MatchScoreCardV2';
import { CommuteConfirmationDialog } from './CommuteConfirmationDialog';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface CandidateJobMatchingV2Props {
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
  };
  onSubmissionCreated?: () => void;
}

export function CandidateJobMatchingV2({ candidate, onSubmissionCreated }: CandidateJobMatchingV2Props) {
  const { matchedJobs, loading: jobsLoading, refetch } = useJobMatching(candidate);
  const { calculateMatch, loading: matchLoading, getMatchLabel, getMatchColor, getMatchBadgeVariant } = useMatchScoreV2();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [matchResults, setMatchResults] = useState<Record<string, any>>({});
  const [commuteDialog, setCommuteDialog] = useState<{
    open: boolean;
    job: MatchedJob | null;
    travelTime: number;
  }>({ open: false, job: null, travelTime: 0 });
  const { user } = useAuth();

  const handleExpandJob = async (job: MatchedJob) => {
    if (expandedJob === job.id) {
      setExpandedJob(null);
      return;
    }

    setExpandedJob(job.id);
    
    // Calculate detailed match if not cached
    if (!matchResults[job.id]) {
      const result = await calculateMatch(candidate.id, job.id);
      if (result) {
        setMatchResults(prev => ({ ...prev, [job.id]: result }));
      }
    }
  };

  const handleSubmitToJob = async (job: MatchedJob) => {
    if (!user) return;
    
    // Check if commute confirmation is needed
    const result = matchResults[job.id];
    if (result?.factors?.commute?.requiresConfirmation) {
      setCommuteDialog({
        open: true,
        job,
        travelTime: result.factors.commute.details?.actualTravelTime || 0,
      });
      return;
    }

    await doSubmit(job);
  };

  const doSubmit = async (job: MatchedJob) => {
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

      const matchResult = matchResults[job.id];
      const { error } = await supabase
        .from('submissions')
        .insert({
          candidate_id: candidate.id,
          job_id: job.id,
          recruiter_id: user.id,
          status: 'submitted',
          match_score: matchResult?.overallScore || job.match_score,
        });

      if (error) throw error;

      toast.success(`${candidate.full_name} wurde für "${job.title}" eingereicht`);
      await refetch();
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
      await doSubmit(commuteDialog.job);
    }
    setCommuteDialog({ open: false, job: null, travelTime: 0 });
  };

  if (jobsLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Passende Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
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

  if (matchedJobs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              Passende Jobs
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertTriangle className="h-5 w-5" />
            <p className="text-sm">Keine passenden offenen Jobs gefunden.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              {matchedJobs.length} passende Jobs
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={refetch}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {matchedJobs.map((job) => (
            <div key={job.id} className="space-y-2">
              <div 
                className="flex items-center gap-3 p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => handleExpandJob(job)}
              >
                {/* Match Score */}
                <div className="flex flex-col items-center min-w-[50px]">
                  <span className={`text-lg font-bold ${getMatchColor(job.match_score)}`}>
                    {matchResults[job.id]?.overallScore ?? job.match_score}%
                  </span>
                  <Badge variant={getMatchBadgeVariant(job.match_score)} className="text-xs">
                    {getMatchLabel(job.match_score)}
                  </Badge>
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
                </div>

                {/* Expand/Collapse & Submit */}
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0"
                  >
                    {expandedJob === job.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSubmitToJob(job);
                    }}
                    disabled={submitting === job.id}
                    className="shrink-0"
                  >
                    {submitting === job.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-3 w-3 mr-1" />
                        Einreichen
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded Match Details */}
              {expandedJob === job.id && matchResults[job.id] && (
                <div className="ml-4 mr-4">
                  <MatchScoreCardV2 
                    result={matchResults[job.id]} 
                    compact={false}
                    onAskCandidate={() => setCommuteDialog({
                      open: true,
                      job,
                      travelTime: matchResults[job.id]?.factors?.commute?.details?.actualTravelTime || 0,
                    })}
                  />
                </div>
              )}

              {expandedJob === job.id && !matchResults[job.id] && matchLoading && (
                <div className="ml-4 mr-4 p-4 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
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

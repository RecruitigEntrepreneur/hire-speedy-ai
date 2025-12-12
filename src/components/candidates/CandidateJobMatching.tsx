import { useState } from 'react';
import { useJobMatching, MatchedJob } from '@/hooks/useJobMatching';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
  ChevronRight,
  RefreshCw,
  Loader2,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface CandidateJobMatchingProps {
  candidate: {
    id: string;
    skills: string[] | null;
    experience_years: number | null;
    expected_salary: number | null;
    salary_expectation_min: number | null;
    salary_expectation_max: number | null;
    city: string | null;
    seniority: string | null;
    target_roles: string[] | null;
    job_title: string | null;
    full_name: string;
  };
  onSubmissionCreated?: () => void;
}

export function CandidateJobMatching({ candidate, onSubmissionCreated }: CandidateJobMatchingProps) {
  const { matchedJobs, loading, refetch, getMatchLabel, getMatchColor, getMatchBadgeVariant } = useJobMatching(candidate);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const { user } = useAuth();

  const handleSubmitToJob = async (job: MatchedJob) => {
    if (!user) return;
    
    setSubmitting(job.id);
    try {
      // Check if already submitted
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

      // Create submission
      const { error } = await supabase
        .from('submissions')
        .insert({
          candidate_id: candidate.id,
          job_id: job.id,
          recruiter_id: user.id,
          status: 'submitted',
          match_score: job.match_score,
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

  if (loading) {
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
          <TooltipProvider key={job.id}>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background border hover:border-primary/50 transition-colors">
              {/* Match Score */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center min-w-[50px]">
                    <span className={`text-lg font-bold ${getMatchColor(job.match_score)}`}>
                      {job.match_score}%
                    </span>
                    <Badge variant={getMatchBadgeVariant(job.match_score)} className="text-xs">
                      {getMatchLabel(job.match_score)}
                    </Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="w-64">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Skills</span>
                      <span>{job.match_details.skillMatch}%</span>
                    </div>
                    <Progress value={job.match_details.skillMatch} className="h-1" />
                    <div className="flex justify-between">
                      <span>Erfahrung</span>
                      <span>{job.match_details.experienceMatch}%</span>
                    </div>
                    <Progress value={job.match_details.experienceMatch} className="h-1" />
                    <div className="flex justify-between">
                      <span>Gehalt</span>
                      <span>{job.match_details.salaryMatch}%</span>
                    </div>
                    <Progress value={job.match_details.salaryMatch} className="h-1" />
                    <div className="flex justify-between">
                      <span>Standort</span>
                      <span>{job.match_details.locationMatch}%</span>
                    </div>
                    <Progress value={job.match_details.locationMatch} className="h-1" />
                  </div>
                </TooltipContent>
              </Tooltip>

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

              {/* Action Button */}
              <Button
                size="sm"
                variant="default"
                onClick={() => handleSubmitToJob(job)}
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
          </TooltipProvider>
        ))}
      </CardContent>
    </Card>
  );
}

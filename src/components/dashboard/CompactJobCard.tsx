import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { JobStats } from '@/hooks/useClientDashboard';
import { 
  Users, 
  Calendar, 
  Gift, 
  Star,
  ArrowRight,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CompactJobCardProps {
  job: JobStats;
  onActionComplete?: () => void;
}

export function CompactJobCard({ job, onActionComplete }: CompactJobCardProps) {
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);

  const pipelineSteps = [
    { filled: job.newCandidates > 0 || job.totalCandidates > 0 },
    { filled: job.shortlisted > 0 },
    { filled: job.interviews > 0 },
    { filled: job.offers > 0 },
  ];

  return (
    <>
      <Card className="group hover:shadow-md transition-all border-border/50 hover:border-primary/30">
        <CardContent className="p-4">
          {/* Main Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Job Info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <Link 
                  to={`/dashboard/jobs/${job.id}`}
                  className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1"
                >
                  {job.title}
                </Link>
                {job.companyName && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{job.companyName}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{job.totalCandidates}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{job.interviews}</span>
              </div>
              <div className="flex items-center gap-1">
                <Gift className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{job.offers}</span>
              </div>
            </div>

            {/* Pipeline Dots */}
            <div className="flex items-center gap-1 shrink-0">
              {pipelineSteps.map((step, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-2 w-2 rounded-full transition-colors",
                    step.filled ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Arrow */}
            <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
              <Link to={`/dashboard/jobs/${job.id}`}>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {/* Top Candidate Row (if exists) */}
          {job.topCandidate && (
            <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Star className="h-4 w-4 text-warning shrink-0" />
                <span className="text-sm font-medium truncate">
                  Top: {job.topCandidate.anonymousId}
                </span>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-xs shrink-0",
                    job.topCandidate.matchScore >= 85 
                      ? "bg-success/10 text-success border-success/30" 
                      : "bg-primary/10 text-primary border-primary/30"
                  )}
                >
                  {job.topCandidate.matchScore}%
                </Badge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setInterviewDialogOpen(true)}
                  className="h-7 text-xs"
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Interview
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  asChild
                  className="h-7 text-xs"
                >
                  <Link to={`/dashboard/candidates/${job.topCandidate.submissionId}`}>
                    Profil
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* New Candidates Badge */}
          {job.newCandidates > 0 && (
            <div className="absolute top-2 right-2">
              <Badge className="bg-primary text-primary-foreground text-xs">
                {job.newCandidates} Neu
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interview Dialog for Top Candidate */}
      {job.topCandidate && (
        <InterviewRequestWithOptInDialog
          open={interviewDialogOpen}
          onOpenChange={setInterviewDialogOpen}
          submissionId={job.topCandidate.submissionId}
          candidateAnonymousId={job.topCandidate.anonymousId}
          jobTitle={job.title}
          onSuccess={() => {
            setInterviewDialogOpen(false);
            onActionComplete?.();
          }}
        />
      )}
    </>
  );
}

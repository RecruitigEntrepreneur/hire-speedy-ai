import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecruiterActivityIndicator } from '@/components/dashboard/RecruiterActivityIndicator';
import { JobStats } from '@/hooks/useClientDashboard';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { 
  UserCheck, 
  Calendar, 
  Gift,
  ArrowRight,
  Briefcase,
  Star,
  Clock,
  TrendingUp
} from 'lucide-react';

interface EnhancedLiveJobCardProps {
  job: JobStats;
  onActionComplete?: () => void;
}

export function EnhancedLiveJobCard({ job, onActionComplete }: EnhancedLiveJobCardProps) {
  const navigate = useNavigate();
  const [interviewDialog, setInterviewDialog] = useState<{
    open: boolean;
    submissionId: string;
    candidateAnonymousId: string;
  } | null>(null);

  const handleRequestInterview = () => {
    if (!job.topCandidate) return;
    setInterviewDialog({
      open: true,
      submissionId: job.topCandidate.submissionId,
      candidateAnonymousId: job.topCandidate.anonymousId,
    });
  };

  return (
    <>
      <Card className="border-border/50 hover:border-primary/30 hover:shadow-md transition-all">
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Link 
                  to={`/dashboard/jobs/${job.id}`}
                  className="font-semibold hover:text-primary transition-colors line-clamp-1"
                >
                  {job.title}
                </Link>
                {job.companyName && (
                  <p className="text-xs text-muted-foreground">{job.companyName}</p>
                )}
              </div>
            </div>
            {job.newCandidates > 0 && (
              <Badge variant="default" className="bg-primary text-primary-foreground">
                {job.newCandidates} Neu
              </Badge>
            )}
          </div>

          {/* Live Recruiter Activity */}
          <div className="mb-3">
            <RecruiterActivityIndicator activeRecruiters={job.activeRecruiters} />
          </div>

          {/* Pipeline Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <UserCheck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{job.totalCandidates}</span>
              <span className="text-muted-foreground text-xs">Gesamt</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{job.interviews}</span>
              <span className="text-muted-foreground text-xs">Interviews</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{job.offers}</span>
              <span className="text-muted-foreground text-xs">Angebote</span>
            </div>
          </div>

          {/* Pipeline Mini-View */}
          <div className="flex items-center gap-1 mb-4">
            <PipelineStep label="Neu" count={job.newCandidates} color="bg-slate-400" />
            <PipelineConnector />
            <PipelineStep label="Shortlist" count={job.shortlisted} color="bg-blue-400" />
            <PipelineConnector />
            <PipelineStep label="Interview" count={job.interviews} color="bg-indigo-400" />
            <PipelineConnector />
            <PipelineStep label="Angebot" count={job.offers} color="bg-violet-400" />
          </div>

          {/* Top Candidate Preview */}
          {job.topCandidate && (
            <div className="p-3 rounded-lg bg-success/5 border border-success/20 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Top-Kandidat</span>
                  <Badge variant="outline" className="text-xs">
                    {job.topCandidate.anonymousId}
                  </Badge>
                </div>
                <Badge className="bg-success/20 text-success border-success/30">
                  {job.topCandidate.matchScore}% Match
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {job.topCandidate.experienceYears}J Erfahrung
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {job.topCandidate.availability}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button 
                  size="sm" 
                  className="flex-1 h-7 text-xs"
                  onClick={handleRequestInterview}
                >
                  Interview anfragen
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => navigate(`/dashboard/candidates/${job.topCandidate?.submissionId}`)}
                >
                  Profil ansehen
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={`/dashboard/jobs/${job.id}`}>
                Alle Kandidaten
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Interview Dialog */}
      {interviewDialog && (
        <InterviewRequestWithOptInDialog
          open={interviewDialog.open}
          onOpenChange={(open) => !open && setInterviewDialog(null)}
          submissionId={interviewDialog.submissionId}
          candidateAnonymousId={interviewDialog.candidateAnonymousId}
          jobTitle={job.title}
          onSuccess={() => {
            setInterviewDialog(null);
            onActionComplete?.();
          }}
        />
      )}
    </>
  );
}

function PipelineStep({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 text-center">
      <div className={`h-1.5 rounded-full ${color} ${count === 0 ? 'opacity-30' : ''}`} />
      <p className="text-[10px] text-muted-foreground mt-1">{count}</p>
    </div>
  );
}

function PipelineConnector() {
  return <div className="w-2 h-0.5 bg-border" />;
}

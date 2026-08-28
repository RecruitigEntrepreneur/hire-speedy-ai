import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CompactExposeCard } from '@/components/expose/CompactExposeCard';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { generateAnonymousId } from '@/lib/anonymization';
import { Users, ArrowUpRight, Inbox } from 'lucide-react';
import { toast } from 'sonner';

interface CandidateSubmission {
  id: string;
  candidate: {
    id: string;
    job_title: string;
    skills: string[];
    // Triple-Blind: anonymisierte Anzeigewerte aus der reveal-gated View.
    experience_band: string;
    region_broad: string;
    notice_period: string;
    availability_date: string;
  };
  job: {
    id: string;
    title: string;
    industry?: string;
  };
  matchScore: number;
  dealProbability: number;
}

export function ExposeQuickDecisionWidget({ maxCandidates = 4 }: { maxCandidates?: number }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<CandidateSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<CandidateSubmission | null>(null);

  useEffect(() => {
    if (user) {
      fetchNewSubmissions();
    }
  }, [user]);

  const fetchNewSubmissions = async () => {
    try {
      // Triple-Blind: reveal-gated View lesen statt rohe candidates/submissions.
      // Die View filtert serverseitig auf den eingeloggten Client (client_id = auth.uid())
      // und liefert PII vor Opt-In als NULL bzw. anonymisiert (region_broad/experience_band).
      const { data, error } = await supabase
        .from('client_candidate_view')
        .select(`
          submission_id,
          candidate_id,
          job_id,
          job_title,
          job_industry,
          status,
          match_score,
          candidate_role,
          skills,
          experience_band,
          region_broad,
          notice_period,
          availability_date
        `)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(maxCandidates);

      if (error) throw error;

      // Fetch deal health for submissions
      const submissionIds = (data || []).map((s: any) => s.submission_id);
      const { data: healthData } = await supabase
        .from('deal_health')
        .select('submission_id, drop_off_probability')
        .in('submission_id', submissionIds);

      const healthMap = new Map((healthData || []).map(h => [h.submission_id, h.drop_off_probability]));

      const formatted: CandidateSubmission[] = (data || []).map((sub: any) => ({
        id: sub.submission_id,
        candidate: {
          id: sub.candidate_id,
          job_title: sub.candidate_role || 'Nicht angegeben',
          skills: sub.skills || [],
          experience_band: sub.experience_band || '',
          region_broad: sub.region_broad || '',
          notice_period: sub.notice_period || '',
          availability_date: sub.availability_date || ''
        },
        job: {
          id: sub.job_id,
          title: sub.job_title,
          industry: sub.job_industry
        },
        matchScore: sub.match_score || 0,
        dealProbability: 100 - (healthMap.get(sub.submission_id) || 50)
      }));

      setSubmissions(formatted);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestInterview = (submission: CandidateSubmission) => {
    setSelectedSubmission(submission);
    setInterviewDialogOpen(true);
  };

  const handleReject = (submission: CandidateSubmission) => {
    setSelectedSubmission(submission);
    setRejectionDialogOpen(true);
  };

  const handleAskQuestion = (submission: CandidateSubmission) => {
    toast.info('Rückfrage-Funktion wird implementiert');
  };

  const handleRejectionSubmit = async (reason: string, details: string) => {
    if (!selectedSubmission) return;
    
    try {
      await supabase
        .from('submissions')
        // stage ist die Wahrheit; status leitet der Trigger ab. Frueher stand
        // hier nur status='rejected' — genau dadurch blieb die stage auf einem
        // aktiven Wert stehen und 16 Submissions widersprachen sich.
        .update({
          stage: 'client_rejected',
          rejection_reason: reason,
          rejection_details: details
        })
        .eq('id', selectedSubmission.id);

      toast.success('Kandidat abgelehnt');
      fetchNewSubmissions();
    } catch (error) {
      console.error('Error rejecting candidate:', error);
      toast.error('Fehler beim Ablehnen');
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Neue Kandidaten – Schnellentscheidung
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/candidates">
                Alle anzeigen
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {submissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Keine neuen Kandidaten</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Recruiter werden bald passende Kandidaten einreichen
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {submissions.map(submission => (
                <CompactExposeCard
                  key={submission.id}
                  submissionId={submission.id}
                  currentRole={submission.candidate.job_title}
                  matchScore={submission.matchScore}
                  dealProbability={submission.dealProbability}
                  topSkills={submission.candidate.skills}
                  // Triple-Blind: bereits serverseitig anonymisierte Werte aus der View.
                  // experienceYears entfällt (View liefert experience_band als String);
                  // region_broad wird statt der exakten Stadt durchgereicht.
                  location={submission.candidate.region_broad}
                  availability={submission.candidate.notice_period || submission.candidate.availability_date}
                  onRequestInterview={() => handleRequestInterview(submission)}
                  onReject={() => handleReject(submission)}
                  onAskQuestion={() => handleAskQuestion(submission)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interview Request Dialog */}
      {selectedSubmission && (
        <InterviewRequestWithOptInDialog
          open={interviewDialogOpen}
          onOpenChange={setInterviewDialogOpen}
          submissionId={selectedSubmission.id}
          candidateAnonymousId={generateAnonymousId(selectedSubmission.id)}
          jobTitle={selectedSubmission.job.title}
          jobIndustry={selectedSubmission.job.industry || 'IT'}
          onSuccess={fetchNewSubmissions}
        />
      )}

      {/* Rejection Dialog */}
      {selectedSubmission && (
        <RejectionDialog
          open={rejectionDialogOpen}
          onOpenChange={setRejectionDialogOpen}
          submission={{
            id: selectedSubmission.id,
            candidate: {
              id: selectedSubmission.candidate.id,
              full_name: generateAnonymousId(selectedSubmission.id),
              email: ''
            },
            job: {
              id: selectedSubmission.job.id,
              title: selectedSubmission.job.title,
              company_name: ''
            }
          }}
          onSuccess={() => {
            fetchNewSubmissions();
            setRejectionDialogOpen(false);
          }}
        />
      )}
    </>
  );
}
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { CompactExposeCard } from '@/components/expose/CompactExposeCard';
import { InterviewRequestWithOptInDialog } from '@/components/dialogs/InterviewRequestWithOptInDialog';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { generateAnonymousId } from '@/lib/anonymization';
import { useMatchScoreV3 } from '@/hooks/useMatchScoreV3';
import { Users, ArrowUpRight, Inbox, Clock, Calendar, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface PendingSubmission {
  id: string;
  status: string;
  submittedAt: string;
  hoursWaiting: number;
  candidate: {
    id: string;
    job_title: string;
    skills: string[];
    experience_years: number;
    city: string;
    notice_period: string;
  };
  job: {
    id: string;
    title: string;
    industry?: string;
  };
  matchScore: number;
  dealProbability: number;
}

export function PendingDecisionsWidget({ maxItems = 6 }: { maxItems?: number }) {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('new');
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<PendingSubmission | null>(null);
  const { getScoreColor } = useMatchScoreV3();

  useEffect(() => {
    if (user) {
      fetchPendingSubmissions();
    }
  }, [user]);

  const fetchPendingSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          match_score,
          v3_match_result,
          candidates!inner (
            id,
            job_title,
            skills,
            experience_years,
            city,
            notice_period
          ),
          jobs!inner (
            id,
            title,
            client_id
          )
        `)
        .eq('jobs.client_id', user?.id)
        .in('status', ['submitted', 'accepted', 'interview'])
        .order('submitted_at', { ascending: false })
        .limit(maxItems * 3);

      if (error) throw error;

      const now = new Date();
      const formatted: PendingSubmission[] = (data || []).map((sub: any) => {
        // Use V3 match result if available
        const v3Result = sub.v3_match_result as any;
        const matchScore = v3Result?.total_score ?? sub.match_score ?? 0;
        const dealProbability = v3Result?.explainability?.deal_probability ?? Math.round(matchScore * 0.9);
        
        return {
          id: sub.id,
          status: sub.status,
          submittedAt: sub.submitted_at,
          hoursWaiting: Math.floor((now.getTime() - new Date(sub.submitted_at).getTime()) / (1000 * 60 * 60)),
          candidate: {
            id: sub.candidates.id,
            job_title: sub.candidates.job_title || 'Nicht angegeben',
            skills: sub.candidates.skills || [],
            experience_years: sub.candidates.experience_years || 0,
            city: sub.candidates.city || '',
            notice_period: sub.candidates.notice_period || '',
          },
          job: {
            id: sub.jobs.id,
            title: sub.jobs.title,
          },
          matchScore,
          dealProbability,
        };
      });

      setSubmissions(formatted);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestInterview = (submission: PendingSubmission) => {
    setSelectedSubmission(submission);
    setInterviewDialogOpen(true);
  };

  const handleReject = (submission: PendingSubmission) => {
    setSelectedSubmission(submission);
    setRejectionDialogOpen(true);
  };

  const handleAskQuestion = () => {
    toast.info('Rückfrage-Funktion wird implementiert');
  };

  const newSubmissions = submissions.filter(s => s.status === 'submitted');
  const awaitingFeedback = submissions.filter(s => s.status === 'accepted');
  const interviewScheduled = submissions.filter(s => s.status === 'interview');

  const getFilteredSubmissions = () => {
    switch (activeTab) {
      case 'new': return newSubmissions.slice(0, maxItems);
      case 'feedback': return awaitingFeedback.slice(0, maxItems);
      case 'interview': return interviewScheduled.slice(0, maxItems);
      default: return [];
    }
  };

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full mb-4" />
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
              Ausstehende Entscheidungen
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/talent">
                Alle anzeigen
                <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-4">
              <TabsTrigger value="new" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Neu ({newSubmissions.length})
              </TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Feedback ({awaitingFeedback.length})
              </TabsTrigger>
              <TabsTrigger value="interview" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Interview ({interviewScheduled.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-0">
              {getFilteredSubmissions().length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">Keine Kandidaten in dieser Kategorie</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getFilteredSubmissions().map(submission => (
                    <div key={submission.id} className="relative">
                      {submission.hoursWaiting >= 24 && (
                        <Badge 
                          variant="destructive" 
                          className="absolute -top-2 -right-2 z-10 text-xs"
                        >
                          {submission.hoursWaiting}h
                        </Badge>
                      )}
                      <CompactExposeCard
                        submissionId={submission.id}
                        currentRole={submission.candidate.job_title}
                        matchScore={submission.matchScore}
                        dealProbability={submission.dealProbability}
                        topSkills={submission.candidate.skills}
                        experienceYears={submission.candidate.experience_years}
                        location={submission.candidate.city}
                        availability={submission.candidate.notice_period}
                        onRequestInterview={() => handleRequestInterview(submission)}
                        onReject={() => handleReject(submission)}
                        onAskQuestion={handleAskQuestion}
                      />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedSubmission && (
        <>
          <InterviewRequestWithOptInDialog
            open={interviewDialogOpen}
            onOpenChange={setInterviewDialogOpen}
            submissionId={selectedSubmission.id}
            candidateAnonymousId={generateAnonymousId(selectedSubmission.id)}
            jobTitle={selectedSubmission.job.title}
            jobIndustry={selectedSubmission.job.industry || 'IT'}
            onSuccess={fetchPendingSubmissions}
          />
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
              fetchPendingSubmissions();
              setRejectionDialogOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}

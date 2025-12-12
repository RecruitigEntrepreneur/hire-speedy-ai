import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { usePageViewTracking, useEventTracking } from '@/hooks/useEventTracking';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { CandidateExpose } from '@/components/expose/CandidateExpose';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { ClientNotificationCenter } from '@/components/notifications/ClientNotificationCenter';

interface HardFacts {
  role_seniority: string;
  top_skills: string[];
  location_commute: string;
  work_model: string;
  salary_range: string;
  availability: string;
}

interface ExposeSubmission {
  id: string;
  status: string;
  submitted_at: string;
  match_score: number | null;
  candidateId: string;
  candidateName: string;
  currentRole: string;
  dealProbability: number;
  dealHealthScore: number;
  dealHealthRisk: string;
  dealHealthReason: string;
  executiveSummary: string[];
  hardFacts: HardFacts;
  jobId: string;
  jobTitle: string;
}

export default function ClientCandidates() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<ExposeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  
  const { trackAction } = useEventTracking();
  usePageViewTracking('client_candidates');

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      // Fetch submissions with candidates and jobs
      const { data: submissionsData, error: subError } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          submitted_at,
          match_score,
          candidates!inner (
            id,
            full_name,
            job_title,
            city,
            experience_years,
            skills,
            expected_salary,
            notice_period,
            remote_preference,
            availability_date,
            seniority
          ),
          jobs!inner (
            id,
            title
          )
        `)
        .order('submitted_at', { ascending: false });

      if (subError) throw subError;

      // Fetch client summaries
      const submissionIds = (submissionsData || []).map(s => s.id);
      const { data: summaries } = await supabase
        .from('candidate_client_summary')
        .select('*')
        .in('submission_id', submissionIds);

      const summaryMap = new Map(summaries?.map(s => [s.submission_id, s]) || []);

      // Fetch deal health data
      const { data: healthData } = await supabase
        .from('deal_health')
        .select('*')
        .in('submission_id', submissionIds);

      const healthMap = new Map(healthData?.map(h => [h.submission_id, h]) || []);

      // Transform to ExposeSubmission format
      const exposeSubmissions: ExposeSubmission[] = (submissionsData || []).map((sub: any) => {
        const candidate = sub.candidates;
        const job = sub.jobs;
        const summary = summaryMap.get(sub.id);
        const health = healthMap.get(sub.id);

        // Build hard facts
        const hardFacts: HardFacts = {
          role_seniority: `${candidate.seniority || ''} ${candidate.job_title || ''}`.trim() || 'Nicht angegeben',
          top_skills: (candidate.skills || []).slice(0, 5),
          location_commute: candidate.city || 'Nicht angegeben',
          work_model: getWorkModelLabel(candidate.remote_preference),
          salary_range: formatSalaryRange(candidate.expected_salary),
          availability: formatAvailability(candidate.notice_period, candidate.availability_date)
        };

        // Parse executive summary
        let executiveSummary: string[] = [];
        if (summary?.key_selling_points && Array.isArray(summary.key_selling_points)) {
          executiveSummary = summary.key_selling_points as string[];
        } else if (summary?.executive_summary) {
          executiveSummary = (summary.executive_summary as string).split('\n').filter(Boolean);
        }

        // Fallback summary points
        if (executiveSummary.length === 0) {
          executiveSummary = [
            `${candidate.experience_years || 0}+ Jahre Berufserfahrung`,
            `Aktuelle Rolle: ${candidate.job_title || 'Nicht angegeben'}`,
            `Standort: ${candidate.city || 'Nicht angegeben'}`,
            formatAvailability(candidate.notice_period, candidate.availability_date)
          ].filter(Boolean);
        }

        return {
          id: sub.id,
          status: sub.status,
          submitted_at: sub.submitted_at,
          match_score: sub.match_score,
          candidateId: candidate.id,
          candidateName: candidate.full_name,
          currentRole: candidate.job_title || 'Nicht angegeben',
          dealProbability: summary?.deal_probability || (health?.drop_off_probability ? 100 - health.drop_off_probability : 50),
          dealHealthScore: health?.health_score || 50,
          dealHealthRisk: health?.risk_level || 'medium',
          dealHealthReason: health?.ai_assessment || '',
          executiveSummary,
          hardFacts,
          jobId: job.id,
          jobTitle: job.title
        };
      });

      setSubmissions(exposeSubmissions);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Fehler beim Laden der Kandidaten');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestInterview = async (submissionId: string) => {
    const { error } = await supabase
      .from('submissions')
      .update({ status: 'interview' })
      .eq('id', submissionId);

    if (!error) {
      await supabase.from('interviews').insert({
        submission_id: submissionId,
        status: 'pending',
      });
      toast.success('Interview angefragt');
      trackAction('request_interview', 'submission', submissionId);
      fetchSubmissions();
    } else {
      toast.error('Fehler beim Anfragen');
    }
  };

  const handleReject = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setRejectDialogOpen(true);
  };

  const handleAskQuestion = async (submissionId: string) => {
    toast.info('Rückfrage-Feature wird noch implementiert');
    trackAction('ask_question', 'submission', submissionId);
  };

  const handleBookmark = (submissionId: string) => {
    setBookmarkedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(submissionId)) {
        newSet.delete(submissionId);
        toast.success('Lesezeichen entfernt');
      } else {
        newSet.add(submissionId);
        toast.success('Kandidat gemerkt');
      }
      return newSet;
    });
    trackAction('bookmark_candidate', 'submission', submissionId);
  };

  const handleRejectSuccess = () => {
    fetchSubmissions();
  };

  const filterSubmissions = (status: string) => {
    if (status === 'all') return submissions;
    if (status === 'new') return submissions.filter(s => s.status === 'submitted');
    if (status === 'bookmarked') return submissions.filter(s => bookmarkedIds.has(s.id));
    return submissions.filter(s => s.status === status);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* SLA Warnings */}
        <SlaWarningBanner />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Kandidaten-Exposés</h1>
              <p className="text-muted-foreground mt-1">
                Vergleichen Sie Kandidaten und treffen Sie Entscheidungen
              </p>
            </div>

            <Tabs defaultValue="new" className="w-full">
              <TabsList>
                <TabsTrigger value="new">
                  Neu ({filterSubmissions('new').length})
                </TabsTrigger>
                <TabsTrigger value="interview">
                  Interview ({filterSubmissions('interview').length})
                </TabsTrigger>
                <TabsTrigger value="bookmarked">
                  Gemerkt ({filterSubmissions('bookmarked').length})
                </TabsTrigger>
                <TabsTrigger value="all">
                  Alle ({submissions.length})
                </TabsTrigger>
              </TabsList>

              {['new', 'interview', 'bookmarked', 'all'].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-6">
                  <div className="grid gap-4">
                    {filterSubmissions(tab).length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                          <User className="h-12 w-12 text-muted-foreground mb-4" />
                          <p className="text-muted-foreground">Keine Kandidaten in dieser Kategorie</p>
                        </CardContent>
                      </Card>
                    ) : (
                      filterSubmissions(tab).map((submission) => (
                        <CandidateExpose
                          key={submission.id}
                          candidateId={submission.candidateId}
                          candidateName={submission.candidateName}
                          currentRole={submission.currentRole}
                          matchScore={submission.match_score || 0}
                          dealProbability={submission.dealProbability}
                          dealHealthScore={submission.dealHealthScore}
                          dealHealthRisk={submission.dealHealthRisk}
                          dealHealthReason={submission.dealHealthReason}
                          status={submission.status}
                          executiveSummary={submission.executiveSummary}
                          hardFacts={submission.hardFacts}
                          onRequestInterview={() => handleRequestInterview(submission.id)}
                          onReject={() => handleReject(submission.id)}
                          onAskQuestion={() => handleAskQuestion(submission.id)}
                          onBookmark={() => handleBookmark(submission.id)}
                          isBookmarked={bookmarkedIds.has(submission.id)}
                        />
                      ))
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ClientNotificationCenter />
          </div>
        </div>
      </div>

      {/* Rejection Dialog */}
      <RejectionDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        submission={selectedSubmissionId ? { id: selectedSubmissionId } as any : null}
        onSuccess={handleRejectSuccess}
      />
    </DashboardLayout>
  );
}

// Helper functions
function getWorkModelLabel(preference: string | null): string {
  if (!preference) return 'Nicht angegeben';
  const labels: Record<string, string> = {
    'remote': 'Full Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return labels[preference] || preference;
}

function formatSalaryRange(salary: number | null): string {
  if (!salary) return 'Nicht angegeben';
  const min = Math.round(salary * 0.9 / 1000) * 1000;
  const max = Math.round(salary * 1.1 / 1000) * 1000;
  return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
}

function formatAvailability(noticePeriod: string | null, availabilityDate: string | null): string {
  if (availabilityDate) {
    const date = new Date(availabilityDate);
    return `Ab ${date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
  }
  if (noticePeriod) {
    return `${noticePeriod} Kündigungsfrist`;
  }
  return 'Nicht angegeben';
}

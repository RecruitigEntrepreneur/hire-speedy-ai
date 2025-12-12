import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, Users, Calendar, CheckCircle, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { usePageViewTracking, useEventTracking } from '@/hooks/useEventTracking';
import { RejectionDialog } from '@/components/rejection/RejectionDialog';
import { ClientCandidateCard } from '@/components/candidates/ClientCandidateCard';
import { SlaWarningBanner } from '@/components/sla/SlaWarningBanner';
import { ClientNotificationCenter } from '@/components/notifications/ClientNotificationCenter';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  email?: string;
  phone?: string;
}

export default function ClientCandidates() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<ExposeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const { trackAction } = useEventTracking();
  usePageViewTracking('client_candidates');

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
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
            seniority,
            email,
            phone
          ),
          jobs!inner (
            id,
            title
          )
        `)
        .order('submitted_at', { ascending: false });

      if (subError) throw subError;

      const submissionIds = (submissionsData || []).map(s => s.id);
      const { data: summaries } = await supabase
        .from('candidate_client_summary')
        .select('*')
        .in('submission_id', submissionIds);

      const summaryMap = new Map(summaries?.map(s => [s.submission_id, s]) || []);

      const { data: healthData } = await supabase
        .from('deal_health')
        .select('*')
        .in('submission_id', submissionIds);

      const healthMap = new Map(healthData?.map(h => [h.submission_id, h]) || []);

      const exposeSubmissions: ExposeSubmission[] = (submissionsData || []).map((sub: any) => {
        const candidate = sub.candidates;
        const job = sub.jobs;
        const summary = summaryMap.get(sub.id);
        const health = healthMap.get(sub.id);

        const hardFacts: HardFacts = {
          role_seniority: `${candidate.seniority || ''} ${candidate.job_title || ''}`.trim() || 'Nicht angegeben',
          top_skills: (candidate.skills || []).slice(0, 5),
          location_commute: candidate.city || 'Nicht angegeben',
          work_model: getWorkModelLabel(candidate.remote_preference),
          salary_range: formatSalaryRange(candidate.expected_salary),
          availability: formatAvailability(candidate.notice_period, candidate.availability_date)
        };

        let executiveSummary: string[] = [];
        if (summary?.key_selling_points && Array.isArray(summary.key_selling_points)) {
          executiveSummary = summary.key_selling_points as string[];
        } else if (summary?.executive_summary) {
          executiveSummary = (summary.executive_summary as string).split('\n').filter(Boolean);
        }

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
          jobTitle: job.title,
          email: candidate.email,
          phone: candidate.phone
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

  // Stats
  const newCount = filterSubmissions('new').length;
  const interviewCount = filterSubmissions('interview').length;
  const avgMatchScore = submissions.length > 0 
    ? Math.round(submissions.reduce((acc, s) => acc + (s.match_score || 0), 0) / submissions.length)
    : 0;

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
        <SlaWarningBanner />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Kandidaten</h1>
            <p className="text-muted-foreground text-sm">
              {submissions.length} Kandidaten insgesamt
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{submissions.length}</p>
                <p className="text-xs text-muted-foreground">Gesamt</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <User className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{newCount}</p>
                <p className="text-xs text-muted-foreground">Neu</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Calendar className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{interviewCount}</p>
                <p className="text-xs text-muted-foreground">Interviews</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgMatchScore}%</p>
                <p className="text-xs text-muted-foreground">Ø Match</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="new" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="new" className="gap-1.5">
              Neu
              <Badge variant="secondary" className="ml-1 text-xs">{newCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="interview" className="gap-1.5">
              Interview
              <Badge variant="secondary" className="ml-1 text-xs">{interviewCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="bookmarked" className="gap-1.5">
              Gemerkt
              <Badge variant="secondary" className="ml-1 text-xs">{filterSubmissions('bookmarked').length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">Alle</TabsTrigger>
          </TabsList>

          {['new', 'interview', 'bookmarked', 'all'].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              {filterSubmissions(tab).length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <User className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Keine Kandidaten in dieser Kategorie</p>
                  </CardContent>
                </Card>
              ) : (
                <div className={cn(
                  "gap-4",
                  viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" 
                    : "flex flex-col"
                )}>
                  {filterSubmissions(tab).map((submission) => (
                    <ClientCandidateCard
                      key={submission.id}
                      submissionId={submission.id}
                      candidateId={submission.candidateId}
                      candidateName={submission.candidateName}
                      currentRole={submission.currentRole}
                      matchScore={submission.match_score}
                      dealProbability={submission.dealProbability}
                      status={submission.status}
                      hardFacts={submission.hardFacts}
                      executiveSummary={submission.executiveSummary}
                      jobTitle={submission.jobTitle}
                      onRequestInterview={() => handleRequestInterview(submission.id)}
                      onReject={() => handleReject(submission.id)}
                      onBookmark={() => handleBookmark(submission.id)}
                      isBookmarked={bookmarkedIds.has(submission.id)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

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
  if (!preference) return 'Flexibel';
  const labels: Record<string, string> = {
    'remote': 'Remote',
    'hybrid': 'Hybrid',
    'onsite': 'Vor Ort',
    'flexible': 'Flexibel'
  };
  return labels[preference] || preference;
}

function formatSalaryRange(salary: number | null): string {
  if (!salary) return 'k.A.';
  return `€${(salary / 1000).toFixed(0)}k`;
}

function formatAvailability(noticePeriod: string | null, availabilityDate: string | null): string {
  if (availabilityDate) {
    const date = new Date(availabilityDate);
    return `Ab ${date.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' })}`;
  }
  if (noticePeriod) {
    return noticePeriod;
  }
  return 'Sofort';
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PowerThreeActions } from '@/components/influence/PowerThreeActions';
import { PerformanceIntel } from '@/components/influence/PerformanceIntel';
import { TeamLeaderboard } from '@/components/influence/TeamLeaderboard';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import { InfluenceScoreBadge } from '@/components/influence/InfluenceScoreBadge';
import { useInfluenceAlerts } from '@/hooks/useInfluenceAlerts';
import { useCandidateBehaviors } from '@/hooks/useCandidateBehavior';
import { useRecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  jobs: { title: string; company_name: string };
  candidates: { full_name: string; email: string; phone: string | null };
}

export default function RecruiterInfluence() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { alerts, loading: alertsLoading, takeAction } = useInfluenceAlerts();
  const { score, loading: scoreLoading } = useRecruiterInfluenceScore();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [selectedPlaybookId, setSelectedPlaybookId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<{ name: string; company: string } | null>(null);

  const { playbook } = useCoachingPlaybook(selectedPlaybookId || undefined);

  const submissionIds = submissions.map(s => s.id);
  const { behaviors, loading: behaviorsLoading } = useCandidateBehaviors(submissionIds);

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          job_id,
          candidate_id,
          status,
          jobs (title, company_name),
          candidates (full_name, email, phone)
        `)
        .eq('recruiter_id', user?.id)
        .in('status', ['submitted', 'reviewing', 'interview_scheduled', 'interviewed', 'shortlisted', 'offer'])
        .order('updated_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setSubmissions(data as any);
      }
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const candidateMap = submissions.reduce((acc, sub) => {
    acc[sub.id] = {
      name: sub.candidates?.full_name || '',
      email: sub.candidates?.email || '',
      phone: sub.candidates?.phone || undefined,
    };
    return acc;
  }, {} as Record<string, { name: string; email: string; phone?: string }>);

  const handleOpenPlaybook = (playbookId: string) => {
    const alert = alerts.find(a => a.playbook_id === playbookId);
    if (alert) {
      const candidate = candidateMap[alert.submission_id];
      const submission = submissions.find(s => s.id === alert.submission_id);
      setSelectedCandidate({
        name: candidate?.name || '[Name]',
        company: submission?.jobs?.company_name || '[Firma]',
      });
    }
    setSelectedPlaybookId(playbookId);
  };

  const handleMarkDone = async (alertId: string) => {
    await takeAction(alertId, 'completed');
  };

  const handleSelectCandidate = (submissionId: string) => {
    const submission = submissions.find(s => s.id === submissionId);
    if (submission) {
      navigate(`/recruiter/candidates?id=${submission.candidate_id}`);
    }
  };

  const isLoading = loadingSubmissions || alertsLoading || behaviorsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Minimalist Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Target className="h-6 w-6 text-primary" />
              Influence Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" />
              Die 3 Hebel für deinen nächsten Deal
            </p>
          </div>
          {!scoreLoading && score && (
            <InfluenceScoreBadge score={score.influence_score} size="lg" />
          )}
        </div>

        {/* Zone 1 + Zone 3: Main Area */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* THE POWER 3 - Takes 3/5 width */}
          <div className="lg:col-span-3">
            <PowerThreeActions
              submissions={submissions}
              behaviors={behaviors}
              alerts={alerts}
              loading={isLoading}
              onOpenPlaybook={handleOpenPlaybook}
              onMarkDone={handleMarkDone}
              onSelectCandidate={handleSelectCandidate}
            />
          </div>
          
          {/* PERFORMANCE INTEL - Takes 2/5 width */}
          <div className="lg:col-span-2">
            <PerformanceIntel score={score} loading={scoreLoading} />
          </div>
        </div>

        {/* Zone 3: LEADERBOARD */}
        <TeamLeaderboard limit={5} />

        {/* Playbook Viewer */}
        <PlaybookViewer
          playbook={playbook}
          open={!!selectedPlaybookId}
          onClose={() => {
            setSelectedPlaybookId(null);
            setSelectedCandidate(null);
          }}
          candidateName={selectedCandidate?.name}
          companyName={selectedCandidate?.company}
        />
      </div>
    </DashboardLayout>
  );
}

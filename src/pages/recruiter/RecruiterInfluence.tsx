import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ActionCenterPanel } from '@/components/influence/ActionCenterPanel';
import { CandidatePipelineCard } from '@/components/influence/CandidatePipelineCard';
import { CandidateScoreCard } from '@/components/influence/CandidateScoreCard';
import { CandidateEngagementPanel } from '@/components/influence/CandidateEngagementPanel';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import { InfluenceScoreBadge } from '@/components/influence/InfluenceScoreBadge';
import { useInfluenceAlerts } from '@/hooks/useInfluenceAlerts';
import { useCandidateBehaviors } from '@/hooks/useCandidateBehavior';
import { useRecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Target, 
  TrendingUp, 
  Users, 
  Calendar,
  CheckCircle,
  Clock,
  Zap
} from 'lucide-react';

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
  const { alerts, loading: alertsLoading, markAsRead, dismiss, takeAction } = useInfluenceAlerts();
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
        .in('status', ['submitted', 'reviewing', 'interview_scheduled', 'interviewed', 'offer'])
        .order('updated_at', { ascending: false })
        .limit(20);

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

  const alertSubmissionIds = new Set(alerts.map(a => a.submission_id));

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

  // Stats
  const avgConfidence = submissions.length > 0
    ? Math.round(Object.values(behaviors).reduce((sum, b) => sum + (b?.confidence_score || 50), 0) / Math.max(Object.keys(behaviors).length, 1))
    : 0;

  const avgReadiness = submissions.length > 0
    ? Math.round(Object.values(behaviors).reduce((sum, b) => sum + (b?.interview_readiness_score || 50), 0) / Math.max(Object.keys(behaviors).length, 1))
    : 0;

  const avgClosing = submissions.length > 0
    ? Math.round(Object.values(behaviors).reduce((sum, b) => sum + (b?.closing_probability || 50), 0) / Math.max(Object.keys(behaviors).length, 1))
    : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                Influence Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Führe deine Kandidaten zum Erfolg
              </p>
            </div>
            {!scoreLoading && score && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Dein Influence Score:</span>
                <InfluenceScoreBadge score={score.influence_score} size="lg" />
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/10 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgConfidence}%</p>
                    <p className="text-xs text-muted-foreground">Ø Confidence</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Calendar className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgReadiness}%</p>
                    <p className="text-xs text-muted-foreground">Ø Readiness</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{avgClosing}%</p>
                    <p className="text-xs text-muted-foreground">Ø Closing</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Zap className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{alerts.length}</p>
                    <p className="text-xs text-muted-foreground">Offene Aktionen</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Action Center - Takes 2 columns */}
            <div className="lg:col-span-2">
              <ActionCenterPanel
                alerts={alerts}
                loading={alertsLoading}
                onMarkDone={handleMarkDone}
                onDismiss={dismiss}
                onOpenPlaybook={handleOpenPlaybook}
                maxAlerts={5}
                candidateMap={candidateMap}
              />
            </div>

            {/* Influence Score Details */}
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    Deine Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {scoreLoading ? (
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </div>
                  ) : score ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Alerts bearbeitet</span>
                        <span className="font-medium">{score.alerts_actioned}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Playbooks genutzt</span>
                        <span className="font-medium">{score.playbooks_used}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Placements beeinflusst</span>
                        <span className="font-medium">{score.total_influenced_placements}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Opt-In Beschleunigung</span>
                        <Badge variant={score.opt_in_acceleration_rate > 0 ? 'default' : 'secondary'}>
                          {score.opt_in_acceleration_rate > 0 ? '+' : ''}{score.opt_in_acceleration_rate}%
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Noch keine Daten vorhanden
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Candidate Pipeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Kandidaten-Pipeline
                </CardTitle>
                <Badge variant="outline">{submissions.length} aktiv</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSubmissions ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-48" />
                  ))}
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Keine aktiven Kandidaten in der Pipeline</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {submissions.map(sub => (
                    <CandidatePipelineCard
                      key={sub.id}
                      submissionId={sub.id}
                      candidateName={sub.candidates?.full_name || 'Unbekannt'}
                      candidateEmail={sub.candidates?.email}
                      candidatePhone={sub.candidates?.phone || undefined}
                      jobTitle={sub.jobs?.title || 'Unbekannt'}
                      behavior={behaviors[sub.id]}
                      hasAlerts={alertSubmissionIds.has(sub.id)}
                      onOpenPlaybook={() => {
                        // Find first playbook for this submission's alerts
                        const alert = alerts.find(a => a.submission_id === sub.id && a.playbook_id);
                        if (alert?.playbook_id) {
                          handleOpenPlaybook(alert.playbook_id);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

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

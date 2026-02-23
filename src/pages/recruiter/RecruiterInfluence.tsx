import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PerformanceIntel } from '@/components/influence/PerformanceIntel';
import { TeamLeaderboard } from '@/components/influence/TeamLeaderboard';
import { PlaybookViewer } from '@/components/influence/PlaybookViewer';
import { InfluenceScoreBadge } from '@/components/influence/InfluenceScoreBadge';
import { CompactTaskList } from '@/components/influence/CompactTaskList';
import { useInfluenceAlerts } from '@/hooks/useInfluenceAlerts';
import { useRecruiterInfluenceScore } from '@/hooks/useRecruiterInfluenceScore';
import { useCoachingPlaybook } from '@/hooks/useCoachingPlaybook';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { CheckSquare, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'opt_in' | 'follow_up' | 'interview' | 'other';

interface Submission {
  id: string;
  job_id: string;
  candidate_id: string;
  status: string;
  jobs: { title: string; company_name: string };
  candidates: { full_name: string; email: string; phone: string | null };
}

const FILTER_CATEGORIES: Record<string, string[]> = {
  opt_in: ['opt_in_pending', 'opt_in_pending_24h', 'opt_in_pending_48h'],
  follow_up: ['follow_up_needed', 'no_activity', 'engagement_drop', 'ghosting_risk'],
  interview: ['interview_prep_missing', 'interview_reminder'],
};

function getFilterCategory(alertType: string): string {
  for (const [category, types] of Object.entries(FILTER_CATEGORIES)) {
    if (types.includes(alertType)) return category;
  }
  return 'other';
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
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [completedOpen, setCompletedOpen] = useState(false);

  const { playbook } = useCoachingPlaybook(selectedPlaybookId || undefined);

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
      jobTitle: sub.jobs?.title || undefined,
      companyName: sub.jobs?.company_name || undefined,
    };
    return acc;
  }, {} as Record<string, { name: string; email: string; phone?: string; jobTitle?: string; companyName?: string }>);

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

  const handleSelectCandidate = (submissionId: string, alertId?: string) => {
    const submission = submissions.find(s => s.id === submissionId);
    if (submission) {
      // Check if alert has a playbook — open it
      if (alertId) {
        const alert = alerts.find(a => a.id === alertId);
        if (alert?.playbook_id) {
          handleOpenPlaybook(alert.playbook_id);
          return;
        }
      }
      navigate(`/recruiter/candidates/${submission.candidate_id}`);
    }
  };

  // Filter alerts
  const pendingAlerts = alerts.filter(a => !a.action_taken);
  const filteredAlerts = activeFilter === 'all'
    ? pendingAlerts
    : pendingAlerts.filter(a => getFilterCategory(a.alert_type) === activeFilter);

  const completedAlerts = alerts.filter(a => a.action_taken).slice(0, 5);

  // Filter counts
  const filterCounts = pendingAlerts.reduce((acc, a) => {
    const cat = getFilterCategory(a.alert_type);
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const isLoading = loadingSubmissions || alertsLoading;

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: `Alle (${pendingAlerts.length})` },
    { key: 'opt_in', label: `Opt-In (${filterCounts.opt_in || 0})` },
    { key: 'follow_up', label: `Follow-up (${filterCounts.follow_up || 0})` },
    { key: 'interview', label: `Interview (${filterCounts.interview || 0})` },
    { key: 'other', label: `Sonstige (${filterCounts.other || 0})` },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CheckSquare className="h-6 w-6 text-primary" />
              Aufgaben & Einfluss
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Offene Aufgaben und Einflussübersicht
            </p>
          </div>
          {!scoreLoading && score && (
            <InfluenceScoreBadge score={score.influence_score} size="lg" />
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <Button
              key={f.key}
              variant={activeFilter === f.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setActiveFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {/* Main Grid: Tasks (2/3) + Sidebar (1/3) */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tasks */}
          <div className="lg:col-span-2">
            <CompactTaskList
              alerts={filteredAlerts}
              loading={isLoading}
              onMarkDone={handleMarkDone}
              onViewCandidate={handleSelectCandidate}
              candidateMap={candidateMap}
              maxItems={999}
              showViewAll={false}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <PerformanceIntel score={score} loading={scoreLoading} />
            <TeamLeaderboard limit={3} />

            {/* Completed tasks */}
            {completedAlerts.length > 0 && (
              <Card>
                <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          Erledigt
                          <Badge variant="secondary" className="text-[10px]">{completedAlerts.length}</Badge>
                        </span>
                        <ChevronDown className={cn("h-4 w-4 transition-transform", completedOpen && "rotate-180")} />
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-2">
                      {completedAlerts.map(alert => {
                        const candidate = candidateMap[alert.submission_id];
                        return (
                          <div key={alert.id} className="flex items-center justify-between text-sm py-1">
                            <span className="truncate font-medium">{candidate?.name || 'Kandidat'}</span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                              {formatDistanceToNow(new Date(alert.action_taken_at || alert.created_at), { addSuffix: true, locale: de })}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}
          </div>
        </div>

        {/* Playbook Viewer (Sheet) */}
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

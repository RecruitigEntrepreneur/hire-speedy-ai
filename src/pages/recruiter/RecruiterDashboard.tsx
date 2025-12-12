import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Briefcase, 
  Users, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  MapPin,
  Activity,
  AlertTriangle,
  Upload,
  User
} from 'lucide-react';
import { BehaviorScoreBadge } from '@/components/behavior/BehaviorScoreBadge';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { RecruiterVerificationBanner } from '@/components/verification/RecruiterVerificationBanner';
import { CompactTaskList } from '@/components/influence/CompactTaskList';
import { useInfluenceAlerts } from '@/hooks/useInfluenceAlerts';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { CandidateDetailSheet } from '@/components/candidates/CandidateDetailSheet';
import { Candidate } from '@/components/candidates/CandidateCard';
import { useCandidateTags } from '@/hooks/useCandidateTags';
import { toast } from 'sonner';

interface DashboardStats {
  openJobs: number;
  myCandidates: number;
  submissions: number;
  earnings: number;
}

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    openJobs: 0,
    myCandidates: 0,
    submissions: 0,
    earnings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [behaviorScore, setBehaviorScore] = useState<any>(null);
  const [criticalDeals, setCriticalDeals] = useState<any[]>([]);
  const [dealCandidateMap, setDealCandidateMap] = useState<Record<string, { name: string; jobTitle: string; company: string }>>({});
  const [candidateMap, setCandidateMap] = useState<Record<string, { name: string; email: string; phone?: string; candidateId?: string; candidateData?: Candidate }>>({});
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  
  // Candidate Detail Sheet state
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [candidateSheetOpen, setCandidateSheetOpen] = useState(false);
  
  const { alerts, loading: alertsLoading, takeAction, dismiss } = useInfluenceAlerts();
  const { logActivity } = useActivityLogger();
  const { getCandidateTags } = useCandidateTags();
  
  usePageViewTracking('recruiter_dashboard');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchCandidateMapForAlerts();
    }
  }, [user, alerts]);

  const fetchDashboardData = async () => {
    try {
      // Fetch published jobs available to recruiters
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!jobsError && jobs) {
        setRecentJobs(jobs);
        setStats(prev => ({
          ...prev,
          openJobs: jobs.length,
        }));
      }

      // Fetch my candidates count
      const { count: candidatesCount } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user?.id);

      if (candidatesCount !== null) {
        setStats(prev => ({
          ...prev,
          myCandidates: candidatesCount,
        }));
      }

      // Fetch my submissions count
      const { count: submissionsCount } = await supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('recruiter_id', user?.id);

      if (submissionsCount !== null) {
        setStats(prev => ({
          ...prev,
          submissions: submissionsCount,
        }));
      }

      // Fetch behavior score
      const { data: scoreData } = await supabase
        .from('user_behavior_scores')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (scoreData) {
        setBehaviorScore(scoreData);
      }

      // Fetch critical deals for my submissions with candidate info
      const { data: mySubmissions } = await supabase
        .from('submissions')
        .select('id, candidate_id, job_id')
        .eq('recruiter_id', user?.id);
      
      if (mySubmissions && mySubmissions.length > 0) {
        const { data: healthData } = await supabase
          .from('deal_health')
          .select('*')
          .in('submission_id', mySubmissions.map(s => s.id))
          .in('risk_level', ['high', 'critical'])
          .limit(3);
        
        if (healthData && healthData.length > 0) {
          setCriticalDeals(healthData);
          
          // Fetch candidate and job info for these deals
          const submissionIds = healthData.map(d => d.submission_id);
          const { data: submissionsWithDetails } = await supabase
            .from('submissions')
            .select('id, candidates(full_name), jobs(title, company_name)')
            .in('id', submissionIds);
          
          if (submissionsWithDetails) {
            const dealMap: Record<string, { name: string; jobTitle: string; company: string }> = {};
            submissionsWithDetails.forEach((s: any) => {
              dealMap[s.id] = {
                name: s.candidates?.full_name || 'Kandidat',
                jobTitle: s.jobs?.title || 'Position',
                company: s.jobs?.company_name || '',
              };
            });
            setDealCandidateMap(dealMap);
          }
        }
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCandidateMapForAlerts = async () => {
    if (!alerts.length) return;
    
    // Get submission IDs from alerts
    const submissionIds = alerts.map(a => a.submission_id);
    
    // Fetch submissions with candidates
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, candidate_id, candidates(id, full_name, email, phone, experience_years, expected_salary, current_salary, skills, summary, cv_url, linkedin_url, availability_date, notice_period, created_at, recruiter_id)')
      .in('id', submissionIds);
    
    if (submissions) {
      const map: Record<string, { name: string; email: string; phone?: string; candidateId?: string; candidateData?: Candidate }> = {};
      submissions.forEach((s: any) => {
        if (s.candidates) {
          map[s.id] = {
            name: s.candidates.full_name,
            email: s.candidates.email,
            phone: s.candidates.phone || undefined,
            candidateId: s.candidates.id,
            candidateData: s.candidates as Candidate,
          };
        }
      });
      setCandidateMap(map);
    }
  };

  const handleMarkDone = async (alertId: string) => {
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      await takeAction(alertId, 'marked_done');
      
      // Get candidate from submission
      const { data: submission } = await supabase
        .from('submissions')
        .select('candidate_id')
        .eq('id', alert.submission_id)
        .single();
      
      if (submission?.candidate_id) {
        await logActivity(
          submission.candidate_id,
          'alert_actioned',
          `Alert erledigt: ${alert.title}`,
          alert.message,
          { alert_type: alert.alert_type, priority: alert.priority },
          alert.submission_id,
          alert.id
        );
      }
      
      toast.success('Alert als erledigt markiert');
    }
  };

  const handleOpenPlaybook = (id: string) => {
    toast.info('Playbook wird geöffnet...');
    // Playbook viewing can be implemented with a dedicated page/dialog
  };

  const handleViewCandidate = async (submissionId: string) => {
    const candidateInfo = candidateMap[submissionId];
    if (candidateInfo?.candidateData) {
      setSelectedCandidate(candidateInfo.candidateData);
      setCandidateSheetOpen(true);
    } else if (candidateInfo?.candidateId) {
      // Fetch full candidate data if not in map
      const { data: candidate } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateInfo.candidateId)
        .single();
      
      if (candidate) {
        setSelectedCandidate(candidate as Candidate);
        setCandidateSheetOpen(true);
      }
    }
  };

  const handleViewDealCandidate = async (submissionId: string) => {
    // Fetch candidate for this submission
    const { data: submission } = await supabase
      .from('submissions')
      .select('candidate_id, candidates(*)')
      .eq('id', submissionId)
      .single();
    
    if (submission?.candidates) {
      setSelectedCandidate(submission.candidates as unknown as Candidate);
      setCandidateSheetOpen(true);
    }
  };

  const handleEditCandidate = (candidate: Candidate) => {
    // Navigate to candidates page with edit mode
    navigate('/recruiter/candidates');
  };

  const statCards = [
    {
      title: 'Open Jobs',
      value: stats.openJobs,
      icon: <Briefcase className="h-5 w-5" />,
      color: 'bg-navy/10 text-navy',
    },
    {
      title: 'My Candidates',
      value: stats.myCandidates,
      icon: <Users className="h-5 w-5" />,
      color: 'bg-emerald/10 text-emerald',
    },
    {
      title: 'Submissions',
      value: stats.submissions,
      icon: <FileText className="h-5 w-5" />,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Total Earnings',
      value: `€${stats.earnings.toLocaleString()}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'bg-amber-100 text-amber-600',
    },
  ];

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `From €${min.toLocaleString()}`;
    return `Up to €${max?.toLocaleString()}`;
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Verification Banner */}
          <RecruiterVerificationBanner />
          
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Find jobs and submit candidates</p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/recruiter/jobs">
                <Briefcase className="mr-2 h-4 w-4" />
                Browse Open Jobs
              </Link>
            </Button>
          </div>

          {/* Behavior Score & Critical Deals */}
          {(behaviorScore || criticalDeals.length > 0) && (
            <div className="grid gap-4 md:grid-cols-2">
              {behaviorScore && (
                <Card className="border-border/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Dein Performance Score</p>
                        <p className="text-2xl font-bold mt-1">
                          {Math.round(100 - (behaviorScore.risk_score || 0))}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          SLA: {Math.round((behaviorScore.sla_compliance_rate || 0) * 100)}% | 
                          Response: {behaviorScore.avg_response_time_hours?.toFixed(1) || '0'}h
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald/10 text-emerald">
                        <Activity className="h-6 w-6" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {criticalDeals.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <p className="font-medium">Deals brauchen Aufmerksamkeit</p>
                    </div>
                    <div className="space-y-2">
                      {criticalDeals.map((deal) => {
                        const dealInfo = dealCandidateMap[deal.submission_id];
                        return (
                          <button
                            key={deal.id}
                            onClick={() => handleViewDealCandidate(deal.submission_id)}
                            className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium truncate">
                                  {dealInfo?.name || 'Kandidat'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground ml-6 truncate">
                                {dealInfo?.jobTitle}{dealInfo?.company ? ` @ ${dealInfo.company}` : ''}
                              </p>
                              {deal.bottleneck && (
                                <p className="text-xs text-destructive ml-6 mt-0.5">
                                  {deal.bottleneck}
                                </p>
                              )}
                            </div>
                            <DealHealthBadge 
                              score={deal.health_score || 0} 
                              riskLevel={deal.risk_level || 'medium'} 
                              size="sm"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Compact Task List */}
          {alerts.length > 0 && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <CompactTaskList
                  alerts={alerts}
                  loading={alertsLoading}
                  onMarkDone={handleMarkDone}
                  onViewCandidate={handleViewCandidate}
                  candidateMap={candidateMap}
                  maxItems={5}
                  showViewAll={true}
                  onViewAll={() => navigate('/recruiter/influence')}
                />
              </CardContent>
            </Card>
          )}

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Card key={stat.title} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-3xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.color}`}>
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Available Jobs */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Available Jobs</CardTitle>
                <CardDescription>Latest opportunities for your candidates</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/recruiter/jobs">
                  View all
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No jobs available</h3>
                  <p className="text-muted-foreground">Check back later for new opportunities.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/recruiter/jobs/${job.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-emerald/30 hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-gradient-navy flex items-center justify-center">
                          <Briefcase className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-medium">{job.title}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{job.company_name}</span>
                            {job.location && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {job.location}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-medium text-emerald">
                            {job.recruiter_fee_percentage}% Fee
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatSalary(job.salary_min, job.salary_max)}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <Link to="/recruiter/candidates/new">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald/10 text-emerald group-hover:bg-emerald group-hover:text-success-foreground transition-colors">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Add Candidate</h3>
                    <p className="text-sm text-muted-foreground">Upload a new candidate</p>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group" onClick={() => setHubspotDialogOpen(true)}>
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-orange-100 text-orange-600 group-hover:bg-orange-600 group-hover:text-primary-foreground transition-colors">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">HubSpot Import</h3>
                  <p className="text-sm text-muted-foreground">Kontakte importieren</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <Link to="/recruiter/submissions">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-primary-foreground transition-colors">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">My Submissions</h3>
                    <p className="text-sm text-muted-foreground">Track candidate status</p>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <Link to="/recruiter/earnings">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-primary-foreground transition-colors">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">View Earnings</h3>
                    <p className="text-sm text-muted-foreground">Track your payouts</p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>

        {/* Dialogs */}
        <HubSpotImportDialog
          open={hubspotDialogOpen}
          onOpenChange={setHubspotDialogOpen}
          onImportComplete={() => {
            toast.success('Kandidaten erfolgreich importiert');
          }}
        />

        {/* Candidate Detail Sheet */}
        <CandidateDetailSheet
          candidate={selectedCandidate}
          tags={selectedCandidate ? getCandidateTags(selectedCandidate.id) : []}
          open={candidateSheetOpen}
          onOpenChange={setCandidateSheetOpen}
          onEdit={handleEditCandidate}
        />
      </div>
    </DashboardLayout>
  );
}

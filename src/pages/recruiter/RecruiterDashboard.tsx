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
  FileText,
  Activity,
  Upload,
  ArrowUpRight,
  Loader2,
  Lock,
  CheckCircle,
  MapPin,
  Building2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl, formatHeadcount } from '@/lib/companyLogo';

import { usePageViewTracking } from '@/hooks/useEventTracking';
import { RecruiterVerificationBanner } from '@/components/verification/RecruiterVerificationBanner';
import { CompactTaskList } from '@/components/influence/CompactTaskList';
import { useInfluenceAlerts } from '@/hooks/useInfluenceAlerts';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { HubSpotImportDialog } from '@/components/candidates/HubSpotImportDialog';
import { Candidate } from '@/components/candidates/CandidateCard';
import { toast } from 'sonner';
import { SubmissionsPipeline, PipelineSubmission } from '@/components/recruiter/SubmissionsPipeline';

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
  const [candidateMap, setCandidateMap] = useState<Record<string, { name: string; email: string; phone?: string; candidateId?: string; jobTitle?: string; companyName?: string }>>({});
  const [hubspotDialogOpen, setHubspotDialogOpen] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<PipelineSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [revealedJobIds, setRevealedJobIds] = useState<Set<string>>(new Set());
  const [companyProfiles, setCompanyProfiles] = useState<Record<string, { logo_url: string | null; website: string | null; headcount: number | null; industry: string | null }>>({});
  
  const { alerts, loading: alertsLoading, takeAction, dismiss } = useInfluenceAlerts();
  const { logActivity } = useActivityLogger();
  
  usePageViewTracking('recruiter_dashboard');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      fetchRecentSubmissions();
      fetchCandidateMapForAlerts();
      fetchRevealedJobs();
    }
  }, [user, alerts]);

  const fetchRevealedJobs = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('job_id')
        .eq('recruiter_id', user.id)
        .eq('company_revealed', true);

      if (!error && data) {
        setRevealedJobIds(new Set(data.map(s => s.job_id)));
      }
    } catch (error) {
      console.error('Error fetching revealed jobs:', error);
    }
  };

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
        
        // Fetch company profiles for all client_ids
        const clientIds = [...new Set(jobs.map(j => j.client_id).filter(Boolean))];
        if (clientIds.length > 0) {
          const { data: profiles } = await supabase
            .from('company_profiles')
            .select('user_id, logo_url, website, headcount, industry')
            .in('user_id', clientIds);
          
          if (profiles) {
            const profileMap: Record<string, { logo_url: string | null; website: string | null; headcount: number | null; industry: string | null }> = {};
            profiles.forEach(p => {
              profileMap[p.user_id] = {
                logo_url: p.logo_url,
                website: p.website,
                headcount: p.headcount,
                industry: p.industry,
              };
            });
            setCompanyProfiles(profileMap);
          }
        }
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


    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSubmissions = async () => {
    try {
      setSubmissionsLoading(true);
      
      // Fetch recent submissions
      const { data: submissions, error } = await supabase
        .from('submissions')
        .select('id, status, stage, match_score, updated_at, recruiter_notes, candidate_id, job_id')
        .eq('recruiter_id', user?.id)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      if (submissions && submissions.length > 0) {
        const candidateIds = submissions.map(s => s.candidate_id);
        const jobIds = submissions.map(s => s.job_id);
        const submissionIds = submissions.map(s => s.id);

        // Fetch related data separately to avoid TypeScript deep instantiation
        const candidatesRes = await supabase
          .from('candidates')
          .select('id, full_name, email, phone, job_title')
          .in('id', candidateIds);
          
        const jobsRes = await supabase
          .from('jobs')
          .select('id, title, company_name, salary_min, salary_max, recruiter_fee_percentage')
          .in('id', jobIds);
          
        // Fetch alerts for submissions
        let alertData: { submission_id: string }[] = [];
        for (const sid of submissionIds) {
          const res = await supabase
            .from('influence_alerts')
            .select('submission_id')
            .match({ submission_id: sid, status: 'active' });
          if (res.data) alertData = [...alertData, ...res.data];
        }

        // Fetch scheduled interviews
        let interviewData: { submission_id: string; scheduled_at: string }[] = [];
        for (const sid of submissionIds) {
          const res = await supabase
            .from('interviews')
            .select('submission_id, scheduled_at')
            .match({ submission_id: sid, status: 'scheduled' });
          if (res.data) interviewData = [...interviewData, ...res.data];
        }

        // Build lookup maps
        const candidateMap: Record<string, any> = {};
        candidatesRes.data?.forEach(c => { candidateMap[c.id] = c; });

        const jobMap: Record<string, any> = {};
        jobsRes.data?.forEach(j => { jobMap[j.id] = j; });

        const alertCountMap: Record<string, number> = {};
        alertData.forEach(a => {
          alertCountMap[a.submission_id] = (alertCountMap[a.submission_id] || 0) + 1;
        });

        const interviewMap: Record<string, string> = {};
        interviewData.forEach(i => {
          if (!interviewMap[i.submission_id]) {
            interviewMap[i.submission_id] = i.scheduled_at;
          }
        });

        const mappedSubmissions: PipelineSubmission[] = submissions.map((s) => {
          const job = jobMap[s.job_id];
          const potentialEarning = job 
            ? calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage)
            : null;
          
          return {
            id: s.id,
            status: s.status,
            stage: s.stage,
            match_score: s.match_score,
            updated_at: s.updated_at,
            recruiter_notes: s.recruiter_notes,
            candidate: candidateMap[s.candidate_id] ? {
              id: candidateMap[s.candidate_id].id,
              full_name: candidateMap[s.candidate_id].full_name,
              email: candidateMap[s.candidate_id].email,
              phone: candidateMap[s.candidate_id].phone,
              job_title: candidateMap[s.candidate_id].job_title,
            } : {
              id: s.candidate_id,
              full_name: 'Unknown',
              email: '',
              phone: null,
              job_title: null,
            },
            job: job ? {
              id: job.id,
              title: job.title,
              company_name: job.company_name,
              salary_min: job.salary_min,
              salary_max: job.salary_max,
              recruiter_fee_percentage: job.recruiter_fee_percentage,
            } : {
              id: s.job_id,
              title: 'Unknown Job',
              company_name: null,
              salary_min: null,
              salary_max: null,
              recruiter_fee_percentage: null,
            },
            alert_count: alertCountMap[s.id] || 0,
            interview_date: interviewMap[s.id] || null,
            potential_earning: potentialEarning,
          };
        });

        setRecentSubmissions(mappedSubmissions);
      } else {
        setRecentSubmissions([]);
      }
    } catch (error) {
      console.error('Error fetching recent submissions:', error);
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const fetchCandidateMapForAlerts = async () => {
    if (!alerts.length) return;
    
    // Get submission IDs from alerts
    const submissionIds = alerts.map(a => a.submission_id);
    
    // Fetch submissions with candidates and jobs
    const { data: submissions } = await supabase
      .from('submissions')
      .select('id, candidate_id, job_id, company_revealed, candidates(id, full_name, email, phone, experience_years, expected_salary, current_salary, skills, summary, cv_url, linkedin_url, availability_date, notice_period, created_at, recruiter_id), jobs(title, company_name, industry)')
      .in('id', submissionIds);
    
    if (submissions) {
      const map: Record<string, { name: string; email: string; phone?: string; candidateId?: string; candidateData?: Candidate; jobTitle?: string; companyName?: string }> = {};
      submissions.forEach((s: any) => {
        if (s.candidates) {
          map[s.id] = {
            name: s.candidates.full_name,
            email: s.candidates.email,
            phone: s.candidates.phone || undefined,
            candidateId: s.candidates.id,
            candidateData: s.candidates as Candidate,
            jobTitle: s.jobs?.title || undefined,
            // Triple-Blind: Only pass company name if revealed
            companyName: s.company_revealed ? (s.jobs?.company_name || undefined) : (s.jobs?.industry ? `[${s.jobs.industry}]` : undefined),
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

  const handleViewCandidate = async (submissionId: string, alertId?: string) => {
    const candidateInfo = candidateMap[submissionId];
    if (candidateInfo?.candidateId) {
      // Navigate to candidate detail page with task context
      const taskParam = alertId ? `?task=${alertId}` : '';
      navigate(`/recruiter/candidates/${candidateInfo.candidateId}${taskParam}`);
    }
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
      color: 'bg-primary/10 text-primary',
    },
    {
      title: 'Total Earnings',
      value: `€${stats.earnings.toLocaleString()}`,
      icon: <DollarSign className="h-5 w-5" />,
      color: 'bg-amber-500/10 text-amber-600',
    },
  ];

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return 'Not specified';
    if (min && max) return `€${min.toLocaleString()} - €${max.toLocaleString()}`;
    if (min) return `From €${min.toLocaleString()}`;
    return `Up to €${max?.toLocaleString()}`;
  };

  const calculatePotentialEarning = (
    salaryMin: number | null, 
    salaryMax: number | null, 
    feePercentage: number | null
  ): number | null => {
    if (!feePercentage || (!salaryMin && !salaryMax)) return null;
    const avgSalary = salaryMin && salaryMax 
      ? (salaryMin + salaryMax) / 2 
      : salaryMin || salaryMax;
    if (!avgSalary) return null;
    return Math.round(avgSalary * (feePercentage / 100));
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

          {/* Behavior Score */}
          {behaviorScore && (
            <Card className="border-border/50 max-w-md">
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
                  {recentJobs.map((job) => {
                    const profile = companyProfiles[job.client_id];
                    
                    return (
                      <Link
                        key={job.id}
                        to={`/recruiter/jobs/${job.id}`}
                        className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-emerald/30 hover:bg-accent/50 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          {revealedJobIds.has(job.id) ? (
                            // Revealed: Show company logo
                            <div className="h-10 w-10 rounded-lg overflow-hidden bg-background border border-border/50 flex items-center justify-center">
                              <img 
                                src={getCompanyLogoUrl(
                                  profile?.logo_url,
                                  profile?.website,
                                  job.company_name
                                )}
                                alt={job.company_name}
                                className="h-8 w-8 object-contain"
                                onError={(e) => {
                                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(job.company_name)}&background=1e3a5f&color=fff&size=96&bold=true`;
                                }}
                              />
                            </div>
                          ) : (
                            // Anonymous: Show briefcase icon
                            <div className="h-10 w-10 rounded-lg bg-gradient-navy flex items-center justify-center">
                              <Briefcase className="h-5 w-5 text-primary-foreground" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{job.title}</h4>
                              {revealedJobIds.has(job.id) && (
                                <Badge variant="outline" className="text-xs border-emerald/30 text-emerald">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Enthüllt
                                </Badge>
                              )}
                            </div>
                            {revealedJobIds.has(job.id) ? (
                              // Revealed: Show full company details
                              <div>
                                <p className="text-sm font-medium text-foreground">{job.company_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  {formatHeadcount(profile?.headcount) && (
                                    <span className="flex items-center gap-1">
                                      <Building2 className="h-3 w-3" />
                                      {formatHeadcount(profile?.headcount)}
                                    </span>
                                  )}
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {job.location}
                                  </span>
                                  <span className="capitalize">{job.remote_type}</span>
                                </div>
                              </div>
                            ) : (
                              // Anonymous: Show anonymized company info
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Lock className="h-3 w-3" />
                                  {formatAnonymousCompany({
                                    industry: job.industry,
                                    companySize: job.company_size_band,
                                    fundingStage: job.funding_stage,
                                    techStack: job.tech_environment,
                                    location: job.location,
                                    urgency: job.hiring_urgency,
                                    remoteType: job.remote_type,
                                  })}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <p className="font-medium text-emerald">
                            {job.recruiter_fee_percentage}% Fee
                          </p>
                          {calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage) && (
                            <p className="text-sm font-semibold text-emerald">
                              ~€{calculatePotentialEarning(job.salary_min, job.salary_max, job.recruiter_fee_percentage)?.toLocaleString()}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatSalary(job.salary_min, job.salary_max)}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Talent Pipeline */}
          <SubmissionsPipeline 
            submissions={recentSubmissions} 
            loading={submissionsLoading} 
          />

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
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-primary-foreground transition-colors">
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
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
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
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 group-hover:bg-amber-500 group-hover:text-primary-foreground transition-colors">
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
      </div>
    </DashboardLayout>
  );
}

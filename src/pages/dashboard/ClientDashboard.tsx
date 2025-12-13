import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationStatusBanner } from '@/components/verification/VerificationStatusBanner';
import { ClientTaskWidget } from '@/components/dashboard/ClientTaskWidget';
import { LiveJobCard } from '@/components/dashboard/LiveJobCard';
import { RecruitingHealthScore } from '@/components/dashboard/RecruitingHealthScore';
import { PendingDecisionsWidget } from '@/components/dashboard/PendingDecisionsWidget';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { useJobStats } from '@/hooks/useJobStats';
import { usePageViewTracking } from '@/hooks/useEventTracking';
import { toast } from 'sonner';
import { 
  Briefcase, 
  Users, 
  Calendar, 
  TrendingUp, 
  Plus, 
  ArrowUpRight,
  Loader2,
  Zap
} from 'lucide-react';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalCandidates: number;
  pendingInterviews: number;
  placements: number;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalJobs: 0,
    activeJobs: 0,
    totalCandidates: 0,
    pendingInterviews: 0,
    placements: 0,
  });
  const [loading, setLoading] = useState(true);
  const { jobs: liveJobs, loading: jobsLoading } = useJobStats(5);
  
  usePageViewTracking('client_dashboard');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch all jobs count
      const { count: totalJobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user?.id);

      // Fetch active jobs count
      const { count: activeJobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('client_id', user?.id)
        .eq('status', 'published');

      // Fetch submissions count
      const { count: submissionsCount } = await supabase
        .from('submissions')
        .select('*, jobs!inner(*)', { count: 'exact', head: true })
        .eq('jobs.client_id', user?.id);

      // Fetch pending interviews count
      const { count: interviewsCount } = await supabase
        .from('interviews')
        .select('*, submission:submissions!inner(job:jobs!inner(client_id))', { count: 'exact', head: true })
        .eq('submission.job.client_id', user?.id)
        .eq('status', 'pending');

      // Fetch placements count
      const { count: placementsCount } = await supabase
        .from('submissions')
        .select('*, jobs!inner(*)', { count: 'exact', head: true })
        .eq('jobs.client_id', user?.id)
        .eq('status', 'hired');

      setStats({
        totalJobs: totalJobsCount || 0,
        activeJobs: activeJobsCount || 0,
        totalCandidates: submissionsCount || 0,
        pendingInterviews: interviewsCount || 0,
        placements: placementsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBoostJob = (jobId: string) => {
    // TODO: Implement boost feature
    toast.info('Job Boost Feature kommt bald!');
  };

  const statCards = [
    {
      title: 'Aktive Jobs',
      value: stats.activeJobs,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-success/10 text-success',
      link: '/dashboard/jobs',
    },
    {
      title: 'Kandidaten',
      value: stats.totalCandidates,
      icon: <Users className="h-5 w-5" />,
      color: 'bg-primary/10 text-primary',
      link: '/dashboard/candidates',
    },
    {
      title: 'Interviews',
      value: stats.pendingInterviews,
      icon: <Calendar className="h-5 w-5" />,
      color: 'bg-warning/10 text-warning',
      link: '/dashboard/interviews',
    },
    {
      title: 'Einstellungen',
      value: stats.placements,
      icon: <Briefcase className="h-5 w-5" />,
      color: 'bg-chart-2/10 text-chart-2',
      link: '/dashboard/placements',
    },
  ];

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
      <div className="space-y-6">
        {/* Verification Banner */}
        <VerificationStatusBanner />

        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Ihr Recruiting auf einen Blick.</p>
          </div>
          <Button variant="hero" asChild>
            <Link to="/dashboard/jobs/new">
              <Plus className="mr-2 h-4 w-4" />
              Neuen Job erstellen
            </Link>
          </Button>
        </div>

        {/* Recruiting Health Score - Ampellogik */}
        <RecruitingHealthScore 
          activeJobs={stats.activeJobs}
          totalCandidates={stats.totalCandidates}
          pendingInterviews={stats.pendingInterviews}
          placements={stats.placements}
        />

        {/* Consolidated Pending Decisions Widget */}
        <PendingDecisionsWidget maxItems={6} />

        {/* Task Widget */}
        <ClientTaskWidget maxTasks={5} />

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Link key={stat.title} to={stat.link}>
              <Card className="border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl ${stat.color}`}>
                      {stat.icon}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Two Column Layout: Live Jobs + New Candidates */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Live Recruiting Engine */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="h-5 w-5 text-warning" />
                Live Recruiting Engine
              </h2>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/jobs">
                  Alle Jobs
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            
            {jobsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-48 w-full" />
                ))}
              </div>
            ) : liveJobs.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Briefcase className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-muted-foreground">Keine aktiven Jobs</h3>
                  <p className="text-sm text-muted-foreground/70 mb-4">Erstellen Sie Ihren ersten Job</p>
                  <Button variant="hero" size="sm" asChild>
                    <Link to="/dashboard/jobs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Job erstellen
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {liveJobs.map((job) => (
                  <LiveJobCard 
                    key={job.id} 
                    job={job} 
                    onBoost={handleBoostJob}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <ActivityFeed limit={8} />
        </div>

        {/* Quick Actions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Schnellaktionen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link to="/dashboard/jobs/new" className="group">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Plus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Job erstellen</h3>
                    <p className="text-xs text-muted-foreground">In 60 Sekunden online</p>
                  </div>
                </div>
              </Link>

              <Link to="/dashboard/candidates" className="group">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all">
                  <div className="p-3 rounded-xl bg-success/10 text-success group-hover:bg-success group-hover:text-success-foreground transition-colors">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Kandidaten prüfen</h3>
                    <p className="text-xs text-muted-foreground">Alle Einreichungen</p>
                  </div>
                </div>
              </Link>

              <Link to="/dashboard/interviews" className="group">
                <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all">
                  <div className="p-3 rounded-xl bg-warning/10 text-warning group-hover:bg-warning group-hover:text-warning-foreground transition-colors">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-medium">Interviews verwalten</h3>
                    <p className="text-xs text-muted-foreground">Termine & Feedback</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

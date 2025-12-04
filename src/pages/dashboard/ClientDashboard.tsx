import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Briefcase, 
  Users, 
  Calendar, 
  TrendingUp, 
  Plus, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

interface DashboardStats {
  totalJobs: number;
  activeJobs: number;
  totalCandidates: number;
  pendingInterviews: number;
  placements: number;
}

interface RecentActivity {
  id: string;
  type: 'submission' | 'interview' | 'placement';
  message: string;
  time: string;
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
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      // Fetch jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!jobsError && jobs) {
        setRecentJobs(jobs);
        setStats(prev => ({
          ...prev,
          totalJobs: jobs.length,
          activeJobs: jobs.filter(j => j.status === 'published').length,
        }));
      }

      // Fetch submissions count
      const { count: submissionsCount } = await supabase
        .from('submissions')
        .select('*, jobs!inner(*)', { count: 'exact', head: true })
        .eq('jobs.client_id', user?.id);

      if (submissionsCount !== null) {
        setStats(prev => ({
          ...prev,
          totalCandidates: submissionsCount,
        }));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      icon: <Briefcase className="h-5 w-5" />,
      color: 'bg-navy/10 text-navy',
    },
    {
      title: 'Active Jobs',
      value: stats.activeJobs,
      icon: <TrendingUp className="h-5 w-5" />,
      color: 'bg-emerald/10 text-emerald',
    },
    {
      title: 'Total Candidates',
      value: stats.totalCandidates,
      icon: <Users className="h-5 w-5" />,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      title: 'Pending Interviews',
      value: stats.pendingInterviews,
      icon: <Calendar className="h-5 w-5" />,
      color: 'bg-amber-100 text-amber-600',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <DashboardLayout>
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DashboardLayout>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <DashboardLayout>
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Welcome back! Here's your hiring overview.</p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/dashboard/jobs/new">
                <Plus className="mr-2 h-4 w-4" />
                Post New Job
              </Link>
            </Button>
          </div>

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

          {/* Recent Jobs */}
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Jobs</CardTitle>
                <CardDescription>Your latest job postings</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/jobs">
                  View all
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {recentJobs.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">No jobs yet</h3>
                  <p className="text-muted-foreground">Post your first job to start receiving candidates.</p>
                  <Button variant="hero" className="mt-4" asChild>
                    <Link to="/dashboard/jobs/new">
                      <Plus className="mr-2 h-4 w-4" />
                      Post Your First Job
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentJobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/dashboard/jobs/${job.id}`}
                      className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-gradient-navy flex items-center justify-center">
                          <Briefcase className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <div>
                          <h4 className="font-medium">{job.title}</h4>
                          <p className="text-sm text-muted-foreground">{job.company_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`status-badge ${
                          job.status === 'published' ? 'status-published' : 'status-draft'
                        }`}>
                          {job.status}
                        </span>
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
              <Link to="/dashboard/jobs/new">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-navy/10 text-navy group-hover:bg-navy group-hover:text-primary-foreground transition-colors">
                    <Plus className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Post a Job</h3>
                    <p className="text-sm text-muted-foreground">Upload in 60 seconds</p>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <Link to="/dashboard/candidates">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-emerald/10 text-emerald group-hover:bg-emerald group-hover:text-success-foreground transition-colors">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Review Candidates</h3>
                    <p className="text-sm text-muted-foreground">See all submissions</p>
                  </div>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <Link to="/dashboard/interviews">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-primary-foreground transition-colors">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Schedule Interviews</h3>
                    <p className="text-sm text-muted-foreground">Manage your calendar</p>
                  </div>
                </CardContent>
              </Link>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}

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
  DollarSign, 
  TrendingUp, 
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Loader2,
  FileText,
  MapPin
} from 'lucide-react';

interface DashboardStats {
  openJobs: number;
  myCandidates: number;
  submissions: number;
  earnings: number;
}

export default function RecruiterDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    openJobs: 0,
    myCandidates: 0,
    submissions: 0,
    earnings: 0,
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

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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
              <p className="text-muted-foreground">Find jobs and submit candidates</p>
            </div>
            <Button variant="hero" asChild>
              <Link to="/recruiter/jobs">
                <Briefcase className="mr-2 h-4 w-4" />
                Browse Open Jobs
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
        </div>
      </DashboardLayout>
    </div>
  );
}

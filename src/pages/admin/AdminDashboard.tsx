import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  Users, 
  Briefcase,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  UserCheck,
  Activity
} from 'lucide-react';

interface AdminStats {
  totalClients: number;
  totalRecruiters: number;
  totalJobs: number;
  activeJobs: number;
  totalPlacements: number;
  totalRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalClients: 0,
    totalRecruiters: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalPlacements: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Fetch user counts by role
      const { data: clientsData } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'client');

      const { data: recruitersData } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'recruiter');

      // Fetch job counts
      const { data: jobsData, count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact' });

      const activeJobsCount = jobsData?.filter(j => j.status === 'published').length || 0;

      // Fetch placements count
      const { count: placementsCount } = await supabase
        .from('placements')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalClients: 0, // Will be counted from user_roles
        totalRecruiters: 0,
        totalJobs: jobsCount || 0,
        activeJobs: activeJobsCount,
        totalPlacements: placementsCount || 0,
        totalRevenue: 0,
      });

      // Fetch recent activity
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityData) {
        setRecentActivity(activityData);
      }

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Clients',
      value: stats.totalClients,
      icon: <Building2 className="h-5 w-5" />,
      color: 'bg-navy/10 text-navy',
      link: '/admin/clients',
    },
    {
      title: 'Total Recruiters',
      value: stats.totalRecruiters,
      icon: <Users className="h-5 w-5" />,
      color: 'bg-emerald/10 text-emerald',
      link: '/admin/recruiters',
    },
    {
      title: 'Active Jobs',
      value: `${stats.activeJobs}/${stats.totalJobs}`,
      icon: <Briefcase className="h-5 w-5" />,
      color: 'bg-blue-100 text-blue-600',
      link: '/admin/jobs',
    },
    {
      title: 'Total Placements',
      value: stats.totalPlacements,
      icon: <UserCheck className="h-5 w-5" />,
      color: 'bg-amber-100 text-amber-600',
      link: '/admin/placements',
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">Platform overview and management</p>
          </div>

          {/* Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat) => (
              <Link key={stat.title} to={stat.link}>
                <Card className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-3xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className={`p-3 rounded-xl ${stat.color} group-hover:scale-110 transition-transform`}>
                        {stat.icon}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Revenue Card */}
          <Card className="border-border/50 bg-gradient-to-br from-navy to-navy-dark text-primary-foreground">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-foreground/70">Platform Revenue</p>
                  <p className="text-4xl font-bold mt-2">€{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-sm text-primary-foreground/70 mt-1">Total platform fees collected</p>
                </div>
                <div className="p-4 rounded-2xl bg-primary-foreground/10">
                  <TrendingUp className="h-8 w-8" />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest platform events</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/activity">
                    View all
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">No recent activity</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.slice(0, 5).map((activity) => (
                      <div key={activity.id} className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common administrative tasks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/recruiters">
                    <Users className="mr-2 h-4 w-4" />
                    Verify Recruiters
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/jobs">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Review Jobs
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/payments">
                    <DollarSign className="mr-2 h-4 w-4" />
                    Process Payments
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/placements">
                    <UserCheck className="mr-2 h-4 w-4" />
                    Manage Placements
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    </div>
  );
}

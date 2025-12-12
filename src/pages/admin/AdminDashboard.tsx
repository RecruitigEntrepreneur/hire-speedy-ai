import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFraudSignals } from '@/hooks/useFraudSignals';
import { useDealHealthList } from '@/hooks/useDealHealth';
import { FraudAlertBanner } from '@/components/fraud/FraudAlertBanner';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { 
  Building2, 
  Users, 
  Briefcase,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Loader2,
  UserCheck,
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  Calendar,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { format, startOfWeek, startOfMonth, startOfYear, isAfter, subDays } from 'date-fns';

interface AdminStats {
  totalClients: number;
  totalRecruiters: number;
  activeRecruiters: number;
  totalJobs: number;
  activeJobs: number;
  totalPlacements: number;
  placementsThisWeek: number;
  placementsThisMonth: number;
  totalRevenue: number;
  revenueThisWeek: number;
  revenueThisMonth: number;
  revenueThisYear: number;
  openPayouts: number;
  openPayoutsAmount: number;
  newCandidates: number;
}

interface Warning {
  type: 'error' | 'warning' | 'info';
  title: string;
  description: string;
  count?: number;
  link?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalClients: 0,
    totalRecruiters: 0,
    activeRecruiters: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalPlacements: 0,
    placementsThisWeek: 0,
    placementsThisMonth: 0,
    totalRevenue: 0,
    revenueThisWeek: 0,
    revenueThisMonth: 0,
    revenueThisYear: 0,
    openPayouts: 0,
    openPayoutsAmount: 0,
    newCandidates: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  
  const { pendingCount, criticalCount } = useFraudSignals();
  const { healthData: criticalDeals } = useDealHealthList();

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);
      const yearStart = startOfYear(now);

      // Fetch user counts by role
      const { data: clientsData, count: clientsCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact' })
        .eq('role', 'client');

      const { data: recruitersData, count: recruitersCount } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact' })
        .eq('role', 'recruiter');

      const verifiedRecruiters = recruitersData?.filter(r => r.verified).length || 0;

      // Fetch job counts
      const { data: jobsData, count: jobsCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact' });

      const activeJobsCount = jobsData?.filter(j => j.status === 'published' && !j.paused_at).length || 0;

      // Fetch placements with revenue
      const { data: placementsData } = await supabase
        .from('placements')
        .select('*');

      const placementsThisWeek = placementsData?.filter(p => 
        p.created_at && isAfter(new Date(p.created_at), weekStart)
      ).length || 0;

      const placementsThisMonth = placementsData?.filter(p => 
        p.created_at && isAfter(new Date(p.created_at), monthStart)
      ).length || 0;

      const totalRevenue = placementsData?.reduce((sum, p) => sum + (Number(p.platform_fee) || 0), 0) || 0;
      
      const revenueThisWeek = placementsData?.filter(p => 
        p.created_at && isAfter(new Date(p.created_at), weekStart)
      ).reduce((sum, p) => sum + (Number(p.platform_fee) || 0), 0) || 0;

      const revenueThisMonth = placementsData?.filter(p => 
        p.created_at && isAfter(new Date(p.created_at), monthStart)
      ).reduce((sum, p) => sum + (Number(p.platform_fee) || 0), 0) || 0;

      const revenueThisYear = placementsData?.filter(p => 
        p.created_at && isAfter(new Date(p.created_at), yearStart)
      ).reduce((sum, p) => sum + (Number(p.platform_fee) || 0), 0) || 0;

      // Open payouts
      const openPayouts = placementsData?.filter(p => p.payment_status === 'pending') || [];
      const openPayoutsAmount = openPayouts.reduce((sum, p) => sum + (Number(p.recruiter_payout) || 0), 0);

      // New candidates (last 7 days, unprocessed)
      const { data: newSubmissions } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', 'submitted')
        .gte('submitted_at', subDays(now, 7).toISOString());

      // Fetch warnings
      const warningsArray: Warning[] = [];

      // Check for duplicate candidates
      const { data: candidates } = await supabase
        .from('candidates')
        .select('email, full_name');

      const emailCounts: Record<string, number> = {};
      candidates?.forEach(c => {
        if (c.email) {
          emailCounts[c.email.toLowerCase()] = (emailCounts[c.email.toLowerCase()] || 0) + 1;
        }
      });
      const duplicateEmails = Object.values(emailCounts).filter(count => count > 1).length;
      if (duplicateEmails > 0) {
        warningsArray.push({
          type: 'warning',
          title: 'Doppelte Kandidaten',
          description: `${duplicateEmails} Kandidaten mit gleicher E-Mail gefunden`,
          count: duplicateEmails,
          link: '/admin/candidates'
        });
      }

      // Check for inactive jobs
      const inactiveJobs = jobsData?.filter(j => {
        if (j.status !== 'published') return false;
        const lastActivity = j.updated_at || j.created_at;
        return lastActivity && !isAfter(new Date(lastActivity), subDays(now, 14));
      }).length || 0;
      
      if (inactiveJobs > 0) {
        warningsArray.push({
          type: 'info',
          title: 'Inaktive Jobs',
          description: `${inactiveJobs} Jobs ohne Aktivität > 14 Tage`,
          count: inactiveJobs,
          link: '/admin/jobs'
        });
      }

      // Check for unverified recruiters
      const unverifiedRecruiters = recruitersData?.filter(r => !r.verified).length || 0;
      if (unverifiedRecruiters > 0) {
        warningsArray.push({
          type: 'warning',
          title: 'Nicht verifizierte Recruiter',
          description: `${unverifiedRecruiters} Recruiter warten auf Freigabe`,
          count: unverifiedRecruiters,
          link: '/admin/recruiters'
        });
      }

      // Check for open invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('status', 'pending');

      if (invoices && invoices.length > 0) {
        warningsArray.push({
          type: 'error',
          title: 'Offene Rechnungen',
          description: `${invoices.length} Rechnungen ausstehend`,
          count: invoices.length,
          link: '/admin/payments'
        });
      }

      setWarnings(warningsArray);

      setStats({
        totalClients: clientsCount || 0,
        totalRecruiters: recruitersCount || 0,
        activeRecruiters: verifiedRecruiters,
        totalJobs: jobsCount || 0,
        activeJobs: activeJobsCount,
        totalPlacements: placementsData?.length || 0,
        placementsThisWeek,
        placementsThisMonth,
        totalRevenue,
        revenueThisWeek,
        revenueThisMonth,
        revenueThisYear,
        openPayouts: openPayouts.length,
        openPayoutsAmount,
        newCandidates: newSubmissions?.length || 0,
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
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Control Center</h1>
            <p className="text-muted-foreground">Live Platform-Übersicht</p>
          </div>

          {/* Fraud Alert Banner */}
          {pendingCount > 0 && (
            <FraudAlertBanner 
              pendingCount={pendingCount} 
              criticalCount={criticalCount}
              onViewAlerts={() => window.location.href = '/admin/fraud'}
            />
          )}

          {/* Critical Deals Widget */}
          {criticalDeals.filter(d => d.risk_level === 'critical' || d.risk_level === 'high').length > 0 && (
            <Link to="/admin/deal-health">
              <Card className="border-amber-500/50 bg-amber-500/5 hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Kritische Deals ({criticalDeals.filter(d => d.risk_level === 'critical' || d.risk_level === 'high').length})
                    <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {criticalDeals
                      .filter(d => d.risk_level === 'critical' || d.risk_level === 'high')
                      .slice(0, 5)
                      .map((deal) => (
                        <div key={deal.id} className="flex items-center justify-between p-2 rounded-lg bg-background">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium truncate max-w-[200px]">
                              {deal.bottleneck ? deal.bottleneck.replace(/_/g, ' ') : 'Kein Bottleneck'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {deal.days_since_last_activity} Tage inaktiv
                            </span>
                          </div>
                          <DealHealthBadge 
                            score={deal.health_score} 
                            riskLevel={deal.risk_level} 
                            size="sm"
                          />
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    Klicken für vollständige Übersicht →
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Warnings */}
          {warnings.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Warnungen ({warnings.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  {warnings.map((warning, idx) => (
                    <Link key={idx} to={warning.link || '#'}>
                      <div className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                        warning.type === 'error' ? 'border-destructive/50 bg-destructive/10' :
                        warning.type === 'warning' ? 'border-yellow-500/50 bg-yellow-500/10' :
                        'border-blue-500/50 bg-blue-500/10'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertCircle className={`h-4 w-4 ${
                            warning.type === 'error' ? 'text-destructive' :
                            warning.type === 'warning' ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                          <span className="font-medium text-sm">{warning.title}</span>
                          {warning.count && (
                            <Badge variant="secondary" className="ml-auto">{warning.count}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{warning.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Main Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link to="/admin/clients">
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Kunden</p>
                      <p className="text-3xl font-bold mt-1">{stats.totalClients}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600 group-hover:scale-110 transition-transform">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/recruiters">
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Recruiter</p>
                      <p className="text-3xl font-bold mt-1">{stats.activeRecruiters}/{stats.totalRecruiters}</p>
                      <p className="text-xs text-muted-foreground">verifiziert</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 group-hover:scale-110 transition-transform">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/jobs">
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Aktive Jobs</p>
                      <p className="text-3xl font-bold mt-1">{stats.activeJobs}/{stats.totalJobs}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-purple-100 text-purple-600 group-hover:scale-110 transition-transform">
                      <Briefcase className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link to="/admin/candidates">
              <Card className="border-border/50 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Neue Kandidaten</p>
                      <p className="text-3xl font-bold mt-1">{stats.newCandidates}</p>
                      <p className="text-xs text-muted-foreground">letzte 7 Tage</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-100 text-amber-600 group-hover:scale-110 transition-transform">
                      <FileText className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Revenue & Placements */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/50 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-primary-foreground/80">Platform Revenue</p>
                  <TrendingUp className="h-5 w-5" />
                </div>
                <p className="text-4xl font-bold">€{stats.totalRevenue.toLocaleString()}</p>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-primary-foreground/60">Diese Woche</p>
                    <p className="font-semibold">€{stats.revenueThisWeek.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-primary-foreground/60">Dieser Monat</p>
                    <p className="font-semibold">€{stats.revenueThisMonth.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-primary-foreground/60">Dieses Jahr</p>
                    <p className="font-semibold">€{stats.revenueThisYear.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-muted-foreground">Placements & Payouts</p>
                  <UserCheck className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold">{stats.totalPlacements}</p>
                    <p className="text-sm text-muted-foreground">Gesamt Placements</p>
                    <div className="mt-2 flex gap-4 text-xs">
                      <span className="text-emerald-600">+{stats.placementsThisWeek} Woche</span>
                      <span className="text-blue-600">+{stats.placementsThisMonth} Monat</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{stats.openPayouts}</p>
                    <p className="text-sm text-muted-foreground">Offene Payouts</p>
                    <p className="mt-2 text-xs text-amber-600">
                      €{stats.openPayoutsAmount.toLocaleString()} ausstehend
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Activity */}
            <Card className="border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Letzte Aktivität</CardTitle>
                  <CardDescription>Aktuelle Platform-Events</CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/activity">
                    Alle anzeigen
                    <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm text-muted-foreground">Keine Aktivität</p>
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
                            {format(new Date(activity.created_at), 'dd.MM.yyyy HH:mm')}
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
                <CardTitle>Schnellzugriff</CardTitle>
                <CardDescription>Häufige Aktionen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/recruiters">
                    <Users className="mr-2 h-4 w-4" />
                    Recruiter verifizieren
                    {stats.totalRecruiters - stats.activeRecruiters > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {stats.totalRecruiters - stats.activeRecruiters}
                      </Badge>
                    )}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/candidates">
                    <FileText className="mr-2 h-4 w-4" />
                    Kandidaten prüfen
                    {stats.newCandidates > 0 && (
                      <Badge variant="secondary" className="ml-auto">{stats.newCandidates}</Badge>
                    )}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/interviews">
                    <Calendar className="mr-2 h-4 w-4" />
                    Interviews verwalten
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/payments">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payouts freigeben
                    {stats.openPayouts > 0 && (
                      <Badge variant="secondary" className="ml-auto">{stats.openPayouts}</Badge>
                    )}
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <Link to="/admin/jobs">
                    <Briefcase className="mr-2 h-4 w-4" />
                    Jobs verwalten
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
  );
}
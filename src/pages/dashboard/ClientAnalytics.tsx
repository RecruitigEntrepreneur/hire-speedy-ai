import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FunnelChart } from '@/components/analytics/FunnelChart';
import { ConversionRateCard } from '@/components/analytics/ConversionRateCard';
import { DropOffAnalysis } from '@/components/analytics/DropOffAnalysis';
import { MetricCard } from '@/components/analytics/MetricCard';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { useFunnelMetrics, useCalculateAnalytics } from '@/hooks/useFunnelAnalytics';
import { useAuth } from '@/lib/auth';
import { Users, Briefcase, UserCheck, Clock, TrendingUp, Award, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientAnalytics() {
  const { user } = useAuth();
  const [periodDays, setPeriodDays] = useState(30);

  const { data: clientMetrics, isLoading: metricsLoading } = useFunnelMetrics(
    'client',
    user?.id,
    periodDays
  );
  const calculateAnalytics = useCalculateAnalytics();

  const handleRefresh = async () => {
    if (!user?.id) return;
    try {
      await calculateAnalytics.mutateAsync({
        action: 'calculate_funnel',
        entity_type: 'client',
        entity_id: user.id,
        period_days: periodDays,
      });
      toast.success('Analytics updated successfully');
    } catch (error) {
      toast.error('Failed to update analytics');
    }
  };

  const handleExport = () => {
    toast.info('Export functionality coming soon');
  };

  // Calculate overall conversion
  const overallConversion = clientMetrics?.total_submissions && clientMetrics?.offer_to_placement
    ? ((clientMetrics.offer_to_placement / clientMetrics.total_submissions) * 100).toFixed(1)
    : '0';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Your Hiring Analytics</h1>
            <p className="text-muted-foreground">
              Track your recruitment performance and conversion rates
            </p>
          </div>
          <PeriodSelector
            value={periodDays}
            onChange={setPeriodDays}
            onRefresh={handleRefresh}
            onExport={handleExport}
            isRefreshing={calculateAnalytics.isPending}
          />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Submissions"
            value={clientMetrics?.total_submissions || 0}
            icon={Users}
            description="Candidates received"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Interviews"
            value={clientMetrics?.opt_in_to_interview || 0}
            icon={Briefcase}
            description="Completed interviews"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Placements"
            value={clientMetrics?.offer_to_placement || 0}
            icon={UserCheck}
            description="Successful hires"
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Avg. Time to Fill"
            value={clientMetrics?.avg_time_to_fill_days?.toFixed(0) || 'N/A'}
            icon={Clock}
            description="days"
            isLoading={metricsLoading}
          />
        </div>

        {/* Conversion Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Conversion Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{clientMetrics?.total_submissions || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Submitted</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-cyan-600">{clientMetrics?.submissions_to_opt_in || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Opted In</p>
                <p className="text-xs text-cyan-600 mt-1">{clientMetrics?.opt_in_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{clientMetrics?.opt_in_to_interview || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Interviewed</p>
                <p className="text-xs text-emerald-600 mt-1">{clientMetrics?.interview_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{clientMetrics?.interview_to_offer || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Offered</p>
                <p className="text-xs text-amber-600 mt-1">{clientMetrics?.offer_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{clientMetrics?.offer_to_placement || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">Placed</p>
                <p className="text-xs text-green-600 mt-1">{clientMetrics?.acceptance_rate?.toFixed(0) || 0}%</p>
              </div>
            </div>

            {/* Overall Conversion */}
            <div className="mt-6 p-4 bg-primary/5 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                <span className="text-4xl font-bold text-primary">{overallConversion}%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall Submission-to-Hire Rate</p>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConversionRateCard
            title="Opt-In Rate"
            value={clientMetrics?.opt_in_rate || 0}
            description="Submission → Opt-In"
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Interview Rate"
            value={clientMetrics?.interview_rate || 0}
            description="Opt-In → Interview"
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Offer Rate"
            value={clientMetrics?.offer_rate || 0}
            description="Interview → Offer"
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Acceptance Rate"
            value={clientMetrics?.acceptance_rate || 0}
            description="Offer → Placement"
            isLoading={metricsLoading}
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          <FunnelChart metrics={clientMetrics || null} isLoading={metricsLoading} />
          <DropOffAnalysis metrics={clientMetrics || null} isLoading={metricsLoading} />
        </div>

        {/* Time Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_opt_in_hours?.toFixed(0) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Hours to Opt-In</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_interview_days?.toFixed(0) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Days to Interview</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_offer_days?.toFixed(0) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Days to Offer</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {clientMetrics?.avg_time_to_fill_days?.toFixed(0) || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground">Total Days to Fill</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Score */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Average Match Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">
                  {clientMetrics?.avg_match_score?.toFixed(0) || 0}
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${clientMetrics?.avg_match_score || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average candidate-job fit score
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Average Candidate Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-primary">
                  {clientMetrics?.avg_candidate_score?.toFixed(0) || 0}
                </div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${clientMetrics?.avg_candidate_score || 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Average candidate quality score
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

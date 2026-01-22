import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FunnelChart } from '@/components/analytics/FunnelChart';
import { ConversionRateCard } from '@/components/analytics/ConversionRateCard';
import { RecruiterLeaderboardComponent } from '@/components/analytics/RecruiterLeaderboardComponent';
import { DropOffAnalysis } from '@/components/analytics/DropOffAnalysis';
import { MetricCard } from '@/components/analytics/MetricCard';
import { PeriodSelector } from '@/components/analytics/PeriodSelector';
import { MLHealthWidget } from '@/components/admin/MLHealthWidget';
import { EmbeddingHealthWidget } from '@/components/admin/EmbeddingHealthWidget';
import { useFunnelMetrics, useRecruiterLeaderboard, useCalculateAnalytics } from '@/hooks/useFunnelAnalytics';
import { Users, Briefcase, UserCheck, Clock, TrendingUp, Award } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAnalytics() {
  const [periodDays, setPeriodDays] = useState(30);

  const { data: platformMetrics, isLoading: metricsLoading } = useFunnelMetrics('platform', undefined, periodDays);
  const { data: leaderboard, isLoading: leaderboardLoading } = useRecruiterLeaderboard('monthly');
  const calculateAnalytics = useCalculateAnalytics();

  const handleRefresh = async () => {
    try {
      await calculateAnalytics.mutateAsync({
        action: 'calculate_all',
        period_days: periodDays,
      });
      toast.success('Analytics updated successfully');
    } catch (error) {
      toast.error('Failed to update analytics');
    }
  };

  const handleExport = () => {
    // TODO: Implement CSV export
    toast.info('Export functionality coming soon');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Platform Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive hiring funnel and performance metrics
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            title="Submissions"
            value={platformMetrics?.total_submissions || 0}
            icon={Users}
            trend={23}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Opt-Ins"
            value={platformMetrics?.submissions_to_opt_in || 0}
            icon={UserCheck}
            trend={-5}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Interviews"
            value={platformMetrics?.opt_in_to_interview || 0}
            icon={Briefcase}
            trend={15}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Offers"
            value={platformMetrics?.interview_to_offer || 0}
            icon={Award}
            trend={10}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Placements"
            value={platformMetrics?.offer_to_placement || 0}
            icon={TrendingUp}
            trend={33}
            isLoading={metricsLoading}
          />
          <MetricCard
            title="Avg. Time to Fill"
            value={platformMetrics?.avg_time_to_fill_days?.toFixed(0) || 'N/A'}
            icon={Clock}
            description="days"
            isLoading={metricsLoading}
          />
        </div>

        {/* Conversion Rates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConversionRateCard
            title="Opt-In Rate"
            value={platformMetrics?.opt_in_rate || 0}
            previousValue={30}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Interview Rate"
            value={platformMetrics?.interview_rate || 0}
            previousValue={25}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Offer Rate"
            value={platformMetrics?.offer_rate || 0}
            previousValue={60}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title="Acceptance Rate"
            value={platformMetrics?.acceptance_rate || 0}
            previousValue={75}
            isLoading={metricsLoading}
          />
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          <FunnelChart metrics={platformMetrics || null} isLoading={metricsLoading} />
          <DropOffAnalysis metrics={platformMetrics || null} isLoading={metricsLoading} />
        </div>

        {/* ML & Vector Health */}
        <div className="grid lg:grid-cols-2 gap-6">
          <MLHealthWidget />
          <EmbeddingHealthWidget />
        </div>

        {/* Leaderboard */}
        <RecruiterLeaderboardComponent
          entries={leaderboard || []}
          isLoading={leaderboardLoading}
          showRevenue
        />
      </div>
    </DashboardLayout>
  );
}

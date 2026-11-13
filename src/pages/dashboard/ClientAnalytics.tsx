import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('clientDashboard');
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
      toast.success(t('analytics.updated'));
    } catch (error) {
      toast.error(t('analytics.updateFailed'));
    }
  };

  const handleExport = () => {
    toast.info(t('analytics.exportSoon'));
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
            <h1 className="text-3xl font-bold">{t('analytics.title')}</h1>
            <p className="text-muted-foreground">
              {t('analytics.subtitle')}
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
            title={t('analytics.totalSubmissions')}
            value={clientMetrics?.total_submissions || 0}
            icon={Users}
            description={t('analytics.candidatesReceived')}
            isLoading={metricsLoading}
          />
          <MetricCard
            title={t('analytics.interviews')}
            value={clientMetrics?.opt_in_to_interview || 0}
            icon={Briefcase}
            description={t('analytics.completedInterviews')}
            isLoading={metricsLoading}
          />
          <MetricCard
            title={t('analytics.placements')}
            value={clientMetrics?.offer_to_placement || 0}
            icon={UserCheck}
            description={t('analytics.successfulHires')}
            isLoading={metricsLoading}
          />
          <MetricCard
            title={t('analytics.avgTimeToFill')}
            value={clientMetrics?.avg_time_to_fill_days?.toFixed(0) || t('analytics.na')}
            icon={Clock}
            description={t('analytics.days')}
            isLoading={metricsLoading}
          />
        </div>

        {/* Conversion Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              {t('analytics.conversionOverview')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{clientMetrics?.total_submissions || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('analytics.stage.submitted')}</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-cyan-600">{clientMetrics?.submissions_to_opt_in || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('analytics.stage.optedIn')}</p>
                <p className="text-xs text-cyan-600 mt-1">{clientMetrics?.opt_in_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-emerald-600">{clientMetrics?.opt_in_to_interview || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('analytics.stage.interviewed')}</p>
                <p className="text-xs text-emerald-600 mt-1">{clientMetrics?.interview_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-amber-600">{clientMetrics?.interview_to_offer || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('analytics.stage.offered')}</p>
                <p className="text-xs text-amber-600 mt-1">{clientMetrics?.offer_rate?.toFixed(0) || 0}%</p>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{clientMetrics?.offer_to_placement || 0}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('analytics.stage.placed')}</p>
                <p className="text-xs text-green-600 mt-1">{clientMetrics?.acceptance_rate?.toFixed(0) || 0}%</p>
              </div>
            </div>

            {/* Overall Conversion */}
            <div className="mt-6 p-4 bg-primary/5 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                <span className="text-4xl font-bold text-primary">{overallConversion}%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t('analytics.overallRate')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Rates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ConversionRateCard
            title={t('analytics.optInRate')}
            value={clientMetrics?.opt_in_rate || 0}
            description={t('analytics.optInFlow')}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title={t('analytics.interviewRate')}
            value={clientMetrics?.interview_rate || 0}
            description={t('analytics.interviewFlow')}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title={t('analytics.offerRate')}
            value={clientMetrics?.offer_rate || 0}
            description={t('analytics.offerFlow')}
            isLoading={metricsLoading}
          />
          <ConversionRateCard
            title={t('analytics.acceptanceRate')}
            value={clientMetrics?.acceptance_rate || 0}
            description={t('analytics.acceptanceFlow')}
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
              {t('analytics.timeMetrics')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_opt_in_hours?.toFixed(0) || t('analytics.na')}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.hoursToOptIn')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_interview_days?.toFixed(0) || t('analytics.na')}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.daysToInterview')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {clientMetrics?.avg_time_to_offer_days?.toFixed(0) || t('analytics.na')}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.daysToOffer')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {clientMetrics?.avg_time_to_fill_days?.toFixed(0) || t('analytics.na')}
                </p>
                <p className="text-xs text-muted-foreground">{t('analytics.daysToFill')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quality Score */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.avgMatch')}</CardTitle>
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
                    {t('analytics.avgMatchLead')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('analytics.avgCandidate')}</CardTitle>
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
                    {t('analytics.avgCandidateLead')}
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

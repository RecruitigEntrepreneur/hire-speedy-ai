import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationList } from "@/components/integrations/IntegrationList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Settings2, History, Shield, Calendar, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useTranslation } from "react-i18next";
import { fmtDate, fmtTime } from "@/lib/localeFormat";

interface Integration {
  id: string;
  provider: string;
  status: string | null;
  sync_candidates: boolean | null;
  sync_jobs: boolean | null;
  last_synced_at: string | null;
  error_message: string | null;
}

interface SyncLog {
  id: string;
  integration_id: string;
  sync_type: string;
  status: string | null;
  records_processed: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export default function IntegrationSettings() {
  const { t } = useTranslation('clientSettings');
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchOrganization();
  }, [user]);

  const fetchOrganization = async () => {
    if (!user) return;

    try {
      // Get user's organization
      const { data: membership } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (membership) {
        setOrganizationId(membership.organization_id);
        await fetchIntegrations(membership.organization_id);
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchIntegrations = async (orgId: string) => {
    try {
      const { data: integrationsData } = await supabase
        .from('integrations')
        .select('id, provider, status, sync_candidates, sync_jobs, last_synced_at, error_message')
        .eq('organization_id', orgId);

      if (integrationsData) {
        setIntegrations(integrationsData);

        // Fetch sync logs for these integrations
        const integrationIds = integrationsData.map(i => i.id);
        if (integrationIds.length > 0) {
          const { data: logsData } = await supabase
            .from('integration_sync_log')
            .select('*')
            .in('integration_id', integrationIds)
            .order('started_at', { ascending: false })
            .limit(50);

          if (logsData) {
            setSyncLogs(logsData);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching integrations:", error);
    }
  };

  const handleRefresh = () => {
    if (organizationId) {
      fetchIntegrations(organizationId);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!organizationId) {
    return (
      <DashboardLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('integrations.noOrg')}</AlertTitle>
          <AlertDescription>
            {t('integrations.noOrgLead')}
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('integrations.title')}</h1>
          <p className="text-muted-foreground">
            {t('integrations.subtitle')}
          </p>
        </div>

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              {t('integrations.tabCalendar')}
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Settings2 className="h-4 w-4" />
              {t('integrations.tabAts')}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              {t('integrations.tabHistory')}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              {t('integrations.tabSecurity')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {t('integrations.mailTitle')}
                </CardTitle>
                <CardDescription>
                  {t('integrations.mailLead')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-800 dark:text-green-300">
                        {t('integrations.mailActive')}
                      </h4>
                      <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                        {t('integrations.mailActiveLead')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <h5 className="text-sm font-medium">{t('integrations.howTitle')}</h5>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      {t('integrations.how1')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      {t('integrations.how2')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      {t('integrations.how3')}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      {t('integrations.how4')}
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationList
              integrations={integrations}
              organizationId={organizationId}
              onRefresh={handleRefresh}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>{t('integrations.historyTitle')}</CardTitle>
                <CardDescription>
                  {t('integrations.historyLead')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {t('integrations.historyEmpty')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <p className="font-medium text-sm">{log.sync_type}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.started_at && `${fmtDate(log.started_at)}, ${fmtTime(log.started_at)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${
                            log.status === 'completed' ? 'text-green-600' : 
                            log.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                            {log.status === 'completed' ? t('integrations.success') :
                             log.status === 'failed' ? t('integrations.failed') : log.status}
                          </span>
                          {log.records_processed !== null && (
                            <p className="text-xs text-muted-foreground">
                              {t('integrations.records', { count: log.records_processed })}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>{t('integrations.securityTitle')}</CardTitle>
                <CardDescription>
                  {t('integrations.securityLead')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">{t('integrations.encryption')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('integrations.encryptionLead')}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">{t('integrations.accessLog')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('integrations.accessLogLead')}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">{t('integrations.gdpr')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('integrations.gdprLead')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

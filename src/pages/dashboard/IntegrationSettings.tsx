import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IntegrationList } from "@/components/integrations/IntegrationList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Settings2, History, Shield, Calendar } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CalendarConnectionCard } from "@/components/settings/CalendarConnectionCard";

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
          <AlertTitle>Keine Organisation</AlertTitle>
          <AlertDescription>
            Sie müssen einer Organisation beitreten, um Integrationen zu verwalten.
          </AlertDescription>
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrationen</h1>
          <p className="text-muted-foreground">
            Verbinden Sie Ihre ATS-Systeme und verwalten Sie die Synchronisierung
          </p>
        </div>

        <Tabs defaultValue="calendar" className="space-y-4">
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <Calendar className="h-4 w-4" />
              Kalender
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Settings2 className="h-4 w-4" />
              ATS-Systeme
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Sync-Historie
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              Sicherheit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar">
            <CalendarConnectionCard />
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
                <CardTitle>Synchronisierungs-Historie</CardTitle>
                <CardDescription>
                  Übersicht der letzten Synchronisierungsvorgänge
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncLogs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Noch keine Synchronisierungen durchgeführt
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
                            {log.started_at && new Date(log.started_at).toLocaleString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium ${
                            log.status === 'completed' ? 'text-green-600' : 
                            log.status === 'failed' ? 'text-destructive' : 'text-muted-foreground'
                          }`}>
                            {log.status === 'completed' ? 'Erfolgreich' : 
                             log.status === 'failed' ? 'Fehlgeschlagen' : log.status}
                          </span>
                          {log.records_processed !== null && (
                            <p className="text-xs text-muted-foreground">
                              {log.records_processed} Datensätze
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
                <CardTitle>Sicherheitseinstellungen</CardTitle>
                <CardDescription>
                  Verwalten Sie Zugriffsberechtigungen und Datenschutz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">Datenverschlüsselung</h4>
                  <p className="text-sm text-muted-foreground">
                    Alle API-Keys und Zugangsdaten werden verschlüsselt gespeichert.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">Zugriffsprotokoll</h4>
                  <p className="text-sm text-muted-foreground">
                    Alle Zugriffe auf Integrationen werden protokolliert und sind für Administratoren einsehbar.
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <h4 className="font-medium mb-2">DSGVO-Konformität</h4>
                  <p className="text-sm text-muted-foreground">
                    Synchronisierte Daten werden gemäß DSGVO verarbeitet und auf Anfrage gelöscht.
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

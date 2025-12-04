import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { IntegrationCard } from "./IntegrationCard";
import { ConnectDialog } from "./ConnectDialog";
import { toast } from "sonner";

interface Integration {
  id: string;
  provider: string;
  status: string | null;
  sync_candidates: boolean | null;
  sync_jobs: boolean | null;
  last_synced_at: string | null;
  error_message: string | null;
}

interface Provider {
  id: string;
  name: string;
  logo: string;
  description: string;
  authType: 'oauth' | 'api_key';
  docsUrl?: string;
}

const availableProviders: Provider[] = [
  { id: 'greenhouse', name: 'Greenhouse', logo: '🌱', description: 'Enterprise Recruiting Software', authType: 'api_key', docsUrl: 'https://developers.greenhouse.io/' },
  { id: 'lever', name: 'Lever', logo: '⚙️', description: 'Modern Talent Acquisition Suite', authType: 'oauth' },
  { id: 'workday', name: 'Workday', logo: '📊', description: 'HR Management Platform', authType: 'oauth' },
  { id: 'bullhorn', name: 'Bullhorn', logo: '📢', description: 'Staffing & Recruiting CRM', authType: 'api_key', docsUrl: 'https://bullhorn.github.io/rest-api-docs/' },
  { id: 'jobvite', name: 'Jobvite', logo: '💼', description: 'Talent Acquisition Platform', authType: 'api_key' },
  { id: 'icims', name: 'iCIMS', logo: '🎯', description: 'Talent Cloud Platform', authType: 'api_key' },
];

interface IntegrationListProps {
  integrations: Integration[];
  organizationId: string;
  onRefresh: () => void;
}

export function IntegrationList({ integrations, organizationId, onRefresh }: IntegrationListProps) {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const connectedProviderIds = integrations.map(i => i.provider);
  const availableToConnect = availableProviders.filter(p => !connectedProviderIds.includes(p.id));

  const handleOpenConnect = (provider: Provider) => {
    setSelectedProvider(provider);
    setConnectDialogOpen(true);
  };

  const handleConnect = async (providerId: string, credentials: { apiKey?: string }) => {
    // In real implementation, this would call an edge function
    toast.success(`${providerId} wird verbunden...`);
    onRefresh();
  };

  const handleSync = async (integrationId: string) => {
    setSyncingId(integrationId);
    try {
      // In real implementation, this would call the sync edge function
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success("Synchronisierung gestartet");
      onRefresh();
    } catch (error) {
      toast.error("Synchronisierung fehlgeschlagen");
    } finally {
      setSyncingId(null);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Möchten Sie diese Integration wirklich trennen?")) return;
    
    try {
      // In real implementation, this would delete the integration
      toast.success("Integration getrennt");
      onRefresh();
    } catch (error) {
      toast.error("Fehler beim Trennen der Integration");
    }
  };

  const handleToggleSync = async (integrationId: string, field: 'sync_candidates' | 'sync_jobs', value: boolean) => {
    try {
      // In real implementation, this would update the integration
      toast.success(`${field === 'sync_candidates' ? 'Kandidaten' : 'Jobs'} Sync ${value ? 'aktiviert' : 'deaktiviert'}`);
      onRefresh();
    } catch (error) {
      toast.error("Fehler beim Aktualisieren");
    }
  };

  return (
    <div className="space-y-6">
      {/* Connected Integrations */}
      {integrations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Verbundene Integrationen</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
                onToggleSync={handleToggleSync}
                isSyncing={syncingId === integration.id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Verfügbare Integrationen</CardTitle>
          <CardDescription>
            Verbinden Sie Ihr ATS-System um Kandidaten und Jobs zu synchronisieren
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableToConnect.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleOpenConnect(provider)}
                className="flex items-center gap-3 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl">
                  {provider.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{provider.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <ConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        provider={selectedProvider}
        onConnect={handleConnect}
      />
    </div>
  );
}

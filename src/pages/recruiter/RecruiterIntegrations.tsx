import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Link as LinkIcon,
  Mail,
  CheckCircle,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
  Unlink,
  Plus,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useRecruiterIntegrations } from '@/hooks/useRecruiterIntegrations';
import { PROVIDERS, getProviderName } from '@/types/integrations';
import type { ProviderInfo, IntegrationProvider } from '@/types/integrations';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export default function RecruiterIntegrations() {
  const {
    integrations,
    loading,
    startOAuthConnect,
    connectApiKey,
    connectClientCredentials,
    disconnectIntegration,
    availableProviders,
  } = useRecruiterIntegrations();

  // Connect dialog state
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // ─── Handlers ───────────────────────────────────────────────────────

  const handleProviderClick = (provider: ProviderInfo) => {
    if (provider.comingSoon) return;

    if (provider.authType === 'oauth') {
      // OAuth: redirect directly, no dialog needed
      startOAuthConnect(provider.id);
    } else {
      // API key or client credentials: show dialog
      setSelectedProvider(provider);
      setApiKeyInput('');
      setClientIdInput('');
      setClientSecretInput('');
      setConnectDialogOpen(true);
    }
  };

  const handleConnectSubmit = async () => {
    if (!selectedProvider) return;

    setIsConnecting(true);
    let success = false;

    if (selectedProvider.authType === 'client_credentials') {
      success = await connectClientCredentials(
        selectedProvider.id,
        clientIdInput,
        clientSecretInput
      );
    } else {
      success = await connectApiKey(selectedProvider.id, apiKeyInput);
    }

    setIsConnecting(false);
    if (success) {
      setConnectDialogOpen(false);
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    await disconnectIntegration(integrationId);
  };

  // ─── Render ─────────────────────────────────────────────────────────

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
          <h1 className="text-3xl font-bold tracking-tight">Integrationen</h1>
          <p className="text-muted-foreground mt-1">
            Verbinde deine CRM- und ATS-Systeme mit einem Klick
          </p>
        </div>

        {/* E-Mail Interview System Info */}
        <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/50">
              <Mail className="h-5 w-5 text-green-700 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 dark:text-green-300">
                E-Mail-basiertes Interview-System aktiv
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                Kandidaten erhalten automatisch Interview-Einladungen per E-Mail mit Kalender-Anhang (.ics).
                Bei Terminbestätigung werden alle Beteiligten automatisch benachrichtigt.
              </p>
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Gebrandete Einladungen
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  iCal-Anhänge
                </div>
                <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Auto-Benachrichtigungen
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Connected Integrations */}
        {integrations.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Verbundene Integrationen</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {integrations.map((integration) => {
                const provider = PROVIDERS.find((p) => p.id === integration.provider);
                const isError = integration.status === 'error' || integration.status === 'expired';

                return (
                  <Card key={integration.id} className={isError ? 'border-red-200' : ''}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl">
                          {provider?.logo || '🔗'}
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            isError
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }
                        >
                          {isError ? (
                            <>
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {integration.status === 'expired' ? 'Abgelaufen' : 'Fehler'}
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Verbunden
                            </>
                          )}
                        </Badge>
                      </div>

                      <h3 className="font-semibold">{provider?.name || integration.provider}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {integration.last_synced_at ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Zuletzt synchronisiert{' '}
                            {formatDistanceToNow(new Date(integration.last_synced_at), {
                              addSuffix: true,
                              locale: de,
                            })}
                          </span>
                        ) : (
                          'Noch nicht synchronisiert'
                        )}
                      </p>

                      {isError && integration.error_message && (
                        <p className="text-xs text-red-600 mt-2">{integration.error_message}</p>
                      )}

                      <div className="flex items-center gap-2 mt-4">
                        {isError && integration.auth_type === 'oauth' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => startOAuthConnect(integration.provider as IntegrationProvider)}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Neu verbinden
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground hover:text-red-600"
                          onClick={() => handleDisconnect(integration.id)}
                        >
                          <Unlink className="h-3.5 w-3.5 mr-1.5" />
                          Trennen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Verfügbare Integrationen</CardTitle>
            <CardDescription>
              Verbinde dein CRM oder ATS-System – einmal klicken, einloggen, fertig
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {availableProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderClick(provider)}
                  disabled={provider.comingSoon}
                  className={`flex items-center gap-3 p-4 rounded-lg border text-left transition-colors ${
                    provider.comingSoon
                      ? 'opacity-50 cursor-not-allowed bg-muted/20'
                      : 'hover:bg-muted/50 hover:border-primary/30 cursor-pointer'
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">
                    {provider.logo}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{provider.name}</p>
                      {provider.comingSoon && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          Bald
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
                  </div>
                  {!provider.comingSoon && (
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Auto-Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Automatische Synchronisation
            </CardTitle>
            <CardDescription>
              Konfiguriere wie oft deine verbundenen Dienste synchronisiert werden sollen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-sync">Auto-Sync aktivieren</Label>
                <p className="text-sm text-muted-foreground">
                  Kandidaten werden automatisch alle 15 Minuten synchronisiert
                </p>
              </div>
              <Switch id="auto-sync" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="notify-sync">Benachrichtigungen bei Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Erhalte eine Benachrichtigung wenn neue Kandidaten importiert werden
                </p>
              </div>
              <Switch id="notify-sync" />
            </div>
          </CardContent>
        </Card>

        {/* API Access */}
        <Card>
          <CardHeader>
            <CardTitle>API Zugang</CardTitle>
            <CardDescription>
              Für Entwickler: Integriere eigene Tools über unsere REST API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline">
              <ExternalLink className="h-4 w-4 mr-2" />
              API Dokumentation öffnen
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── Connect Dialog (API Key / Client Credentials) ─── */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {selectedProvider && (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                  {selectedProvider.logo}
                </div>
              )}
              <div>
                <DialogTitle>{selectedProvider?.name} verbinden</DialogTitle>
                <DialogDescription>
                  {selectedProvider?.authType === 'client_credentials'
                    ? 'Gib deine Client-Zugangsdaten ein'
                    : 'Gib deinen API Key ein um die Verbindung herzustellen'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedProvider?.authType === 'client_credentials' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="client-id">Client ID</Label>
                  <Input
                    id="client-id"
                    type="text"
                    placeholder="Deine Client ID..."
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client-secret">Client Secret</Label>
                  <Input
                    id="client-secret"
                    type="password"
                    placeholder="Dein Client Secret..."
                    value={clientSecretInput}
                    onChange={(e) => setClientSecretInput(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Dein API Key..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
              </div>
            )}

            {selectedProvider?.docsUrl && (
              <a
                href={selectedProvider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Dokumentation öffnen <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleConnectSubmit}
              disabled={
                isConnecting ||
                (selectedProvider?.authType === 'client_credentials'
                  ? !clientIdInput || !clientSecretInput
                  : !apiKeyInput)
              }
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verbinde...
                </>
              ) : (
                'Verbinden'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

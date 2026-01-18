import { useState, useEffect } from 'react';
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
  Upload, 
  Link as LinkIcon, 
  Calendar, 
  MessageSquare, 
  Mail,
  CheckCircle,
  XCircle,
  Settings,
  RefreshCw,
  ExternalLink,
  Zap,
  Video,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  status?: 'active' | 'error' | 'syncing';
  lastSync?: string;
  email?: string;
  provider?: 'microsoft' | 'google';
}

export default function RecruiterIntegrations() {
  const [setupDialogOpen, setSetupDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [connecting, setConnecting] = useState(false);

  // OAuth Hooks
  const { 
    isConnected: msConnected, 
    connectionDetails: msDetails, 
    loading: msLoading,
    connectMicrosoft,
    disconnectMicrosoft 
  } = useMicrosoftAuth();

  const {
    isConnected: googleConnected,
    connectionDetails: googleDetails,
    loading: googleLoading,
    connectGoogle,
    disconnectGoogle
  } = useGoogleAuth();

  const integrations: Integration[] = [
    {
      id: 'microsoft-teams',
      name: 'Microsoft Teams',
      description: 'Erstelle automatisch Teams-Meetings für Interviews und synchronisiere mit Outlook.',
      icon: <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
        <Video className="h-5 w-5 text-blue-700" />
      </div>,
      connected: msConnected,
      email: msDetails?.email || undefined,
      provider: 'microsoft',
      lastSync: msDetails?.connected_at ? format(new Date(msDetails.connected_at), 'dd.MM.yyyy HH:mm', { locale: de }) : undefined
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Synchronisiere Interviews mit Google Calendar und erstelle Google Meet-Links.',
      icon: <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
        <Calendar className="h-5 w-5 text-red-600" />
      </div>,
      connected: googleConnected,
      email: googleDetails?.email || undefined,
      provider: 'google',
      lastSync: googleDetails?.connected_at ? format(new Date(googleDetails.connected_at), 'dd.MM.yyyy HH:mm', { locale: de }) : undefined
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'Importiere Kontakte aus deinem HubSpot CRM und halte deine Kandidaten synchron.',
      icon: <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
        <Upload className="h-5 w-5 text-orange-600" />
      </div>,
      connected: false,
    },
    {
      id: 'salesforce',
      name: 'Salesforce',
      description: 'Verbinde dein Salesforce CRM für nahtlose Kandidatenverwaltung.',
      icon: <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
        <LinkIcon className="h-5 w-5 text-blue-600" />
      </div>,
      connected: false,
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Erhalte Benachrichtigungen und Updates direkt in Slack.',
      icon: <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
        <MessageSquare className="h-5 w-5 text-purple-600" />
      </div>,
      connected: false,
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Verbinde mit 5000+ Apps über Zapier Automationen.',
      icon: <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
        <Zap className="h-5 w-5 text-orange-600" />
      </div>,
      connected: false,
    },
  ];

  const handleConnect = async (integration: Integration) => {
    // Handle OAuth integrations
    if (integration.provider === 'microsoft') {
      await connectMicrosoft();
      return;
    }
    
    if (integration.provider === 'google') {
      await connectGoogle();
      return;
    }

    // Handle API key integrations
    setSelectedIntegration(integration);
    setSetupDialogOpen(true);
    setApiKey('');
  };

  const handleDisconnect = async (integration: Integration) => {
    if (integration.provider === 'microsoft') {
      await disconnectMicrosoft();
      return;
    }
    
    if (integration.provider === 'google') {
      await disconnectGoogle();
      return;
    }

    toast.success(`${integration.name} wurde getrennt`);
  };

  const handleSubmitConnection = async () => {
    if (!selectedIntegration) return;
    
    setConnecting(true);
    
    // Simulate API connection
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success(`${selectedIntegration.name} erfolgreich verbunden!`);
    setSetupDialogOpen(false);
    setConnecting(false);
    setApiKey('');
  };

  const isLoading = msLoading || googleLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrationen</h1>
          <p className="text-muted-foreground mt-1">
            Verbinde externe Tools und CRM-Systeme mit deinem Account
          </p>
        </div>

        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <LinkIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Kalender & Meeting-Integrationen</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Verbinde Microsoft Teams oder Google Calendar, um automatisch Meeting-Links für Interviews zu erstellen 
                und Termine in deinem Kalender zu synchronisieren.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Integrations Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const isOAuth = integration.provider === 'microsoft' || integration.provider === 'google';
            const isIntegrationLoading = 
              (integration.provider === 'microsoft' && msLoading) ||
              (integration.provider === 'google' && googleLoading);

            return (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    {integration.icon}
                    {isIntegrationLoading ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Lädt...
                      </Badge>
                    ) : integration.connected ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Verbunden
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Nicht verbunden
                      </Badge>
                    )}
                  </div>
                  
                  <h3 className="font-semibold">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    {integration.description}
                  </p>

                  {integration.connected && integration.email && (
                    <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {integration.email}
                    </p>
                  )}

                  {integration.connected ? (
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="h-4 w-4 mr-2" />
                        Einstellungen
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDisconnect(integration)}
                        disabled={isIntegrationLoading}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleConnect(integration)}
                      disabled={isIntegrationLoading}
                    >
                      {isIntegrationLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <LinkIcon className="h-4 w-4 mr-2" />
                      )}
                      {isOAuth ? 'Mit OAuth verbinden' : 'Verbinden'}
                    </Button>
                  )}

                  {integration.connected && integration.lastSync && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <RefreshCw className="h-3 w-3" />
                      Verbunden am: {integration.lastSync}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

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

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="auto-meeting">Automatische Meeting-Links</Label>
                <p className="text-sm text-muted-foreground">
                  Erstelle automatisch Meeting-Links beim Planen von Interviews
                </p>
              </div>
              <Switch id="auto-meeting" defaultChecked />
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

      {/* Connection Setup Dialog (for non-OAuth integrations) */}
      <Dialog open={setupDialogOpen} onOpenChange={setSetupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedIntegration?.name} verbinden</DialogTitle>
            <DialogDescription>
              Gib deine API-Zugangsdaten ein um {selectedIntegration?.name} zu verbinden.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Dein API Key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Du findest deinen API Key in den Einstellungen von {selectedIntegration?.name}.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmitConnection} disabled={!apiKey || connecting}>
              {connecting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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

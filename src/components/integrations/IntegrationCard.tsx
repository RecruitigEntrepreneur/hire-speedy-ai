import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Settings, RefreshCw, Unlink } from "lucide-react";
import { SyncStatus } from "./SyncStatus";
import { useTranslation } from "react-i18next";

interface Integration {
  id: string;
  provider: string;
  status: string | null;
  sync_candidates: boolean | null;
  sync_jobs: boolean | null;
  last_synced_at: string | null;
  error_message: string | null;
}

interface IntegrationCardProps {
  integration: Integration;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
  onToggleSync: (id: string, field: 'sync_candidates' | 'sync_jobs', value: boolean) => void;
  isSyncing?: boolean;
}

const providerConfig: Record<string, { name: string; logo: string; color: string }> = {
  greenhouse: { name: "Greenhouse", logo: "🌱", color: "bg-green-500/10 text-green-600" },
  lever: { name: "Lever", logo: "⚙️", color: "bg-blue-500/10 text-blue-600" },
  workday: { name: "Workday", logo: "📊", color: "bg-orange-500/10 text-orange-600" },
  bullhorn: { name: "Bullhorn", logo: "📢", color: "bg-red-500/10 text-red-600" },
  jobvite: { name: "Jobvite", logo: "💼", color: "bg-purple-500/10 text-purple-600" },
  icims: { name: "iCIMS", logo: "🎯", color: "bg-cyan-500/10 text-cyan-600" },
};

export function IntegrationCard({ 
  integration, 
  onSync, 
  onDisconnect, 
  onToggleSync,
  isSyncing 
}: IntegrationCardProps) {
  const { t } = useTranslation('clientSettings');
  const config = providerConfig[integration.provider] || {
    name: integration.provider,
    logo: "🔗",
    color: "bg-muted text-muted-foreground"
  };

  const isConnected = integration.status === 'connected';

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl ${config.color}`}>
              {config.logo}
            </div>
            <div>
              <CardTitle className="text-base">{config.name}</CardTitle>
              <Badge 
                variant={isConnected ? "default" : "secondary"}
                className="mt-1"
              >
                {isConnected ? t('integrations.connected') : t('integrations.disconnectedBadge')}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSync(integration.id)}
              disabled={!isConnected || isSyncing}
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDisconnect(integration.id)}
            >
              <Unlink className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('integrations.syncCandidates')}</span>
              <Switch
                checked={integration.sync_candidates ?? false}
                onCheckedChange={(checked) => onToggleSync(integration.id, 'sync_candidates', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('integrations.syncJobs')}</span>
              <Switch
                checked={integration.sync_jobs ?? false}
                onCheckedChange={(checked) => onToggleSync(integration.id, 'sync_jobs', checked)}
              />
            </div>
            <SyncStatus 
              lastSyncedAt={integration.last_synced_at} 
              errorMessage={integration.error_message}
            />
          </>
        )}
        {integration.error_message && (
          <p className="text-xs text-destructive">{integration.error_message}</p>
        )}
      </CardContent>
    </Card>
  );
}

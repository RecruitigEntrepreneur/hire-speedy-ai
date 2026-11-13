import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Provider {
  id: string;
  name: string;
  logo: string;
  description: string;
  authType: 'oauth' | 'api_key';
  docsUrl?: string;
}

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  onConnect: (provider: string, credentials: { apiKey?: string }) => Promise<void>;
}

export function ConnectDialog({ open, onOpenChange, provider, onConnect }: ConnectDialogProps) {
  const { t } = useTranslation('clientSettings');
  const [apiKey, setApiKey] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!provider) return;
    
    setIsConnecting(true);
    try {
      if (provider.authType === 'oauth') {
        await onConnect(provider.id, {});
      } else {
        await onConnect(provider.id, { apiKey });
      }
      onOpenChange(false);
      setApiKey("");
    } catch (error) {
      console.error("Connection failed:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
              {provider.logo}
            </div>
            <div>
              <DialogTitle>{t('integrations.connectTitle', { provider: provider.name })}</DialogTitle>
              <DialogDescription>{provider.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {provider.authType === 'api_key' ? (
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('integrations.apiKey')}</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={t('integrations.apiKeyPh')}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              {provider.docsUrl && (
                <a
                  href={provider.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  {t('integrations.apiKeyDocs')} <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                {t('integrations.oauthRedirect', { provider: provider.name })}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button 
            onClick={handleConnect} 
            disabled={isConnecting || (provider.authType === 'api_key' && !apiKey)}
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {provider.authType === 'oauth' ? t('integrations.connectOauth') : t('integrations.connect')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

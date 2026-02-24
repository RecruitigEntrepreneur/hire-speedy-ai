import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { RecruiterIntegration, IntegrationProvider, ProviderInfo } from '@/types/integrations';
import { PROVIDERS, getProviderName } from '@/types/integrations';

/** Check if an error is a FunctionsFetchError (edge function not deployed) */
function isEdgeFunctionNotDeployed(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const name = typeof e.name === 'string' ? e.name : '';
  const message = typeof e.message === 'string' ? e.message : String(err);
  return (
    name === 'FunctionsFetchError' ||
    message.includes('FunctionsFetchError') ||
    message.includes('Failed to send a request to the Edge Function') ||
    message.includes('Failed to send a request')
  );
}

interface UseRecruiterIntegrationsReturn {
  integrations: RecruiterIntegration[];
  loading: boolean;
  /** Initiate OAuth flow - redirects to provider */
  startOAuthConnect: (provider: IntegrationProvider) => Promise<void>;
  /** Connect API key integration */
  connectApiKey: (provider: IntegrationProvider, apiKey: string) => Promise<boolean>;
  /** Connect client credentials integration */
  connectClientCredentials: (provider: IntegrationProvider, clientId: string, clientSecret: string) => Promise<boolean>;
  /** Disconnect an integration */
  disconnectIntegration: (integrationId: string) => Promise<boolean>;
  /** Refresh integrations list */
  refresh: () => Promise<void>;
  /** Available (unconnected) providers */
  availableProviders: ProviderInfo[];
  /** Connected providers */
  connectedProviders: ProviderInfo[];
}

export function useRecruiterIntegrations(): UseRecruiterIntegrationsReturn {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<RecruiterIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Fetch integrations ───────────────────────────────────────────

  const fetchIntegrations = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await (supabase as any)
        .from('recruiter_integrations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet (migration not applied) – silently return empty
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as { message: string }).message
          : String(error);
        if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
          console.warn('[useRecruiterIntegrations] Tabelle existiert noch nicht – Migration muss angewendet werden.');
          setIntegrations([]);
          return;
        }
        throw error;
      }
      setIntegrations((data || []) as unknown as RecruiterIntegration[]);
    } catch (err) {
      // Gracefully handle any fetch error – don't show error toast, just log
      console.warn('[useRecruiterIntegrations] Fetch fehlgeschlagen (Infrastruktur evtl. noch nicht deployed):', err);
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // ─── Handle OAuth callback on mount ───────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('connected');
    const error = params.get('error');
    const provider = params.get('provider');

    if (connected) {
      toast.success(`${getProviderName(connected)} erfolgreich verbunden!`);
      window.history.replaceState({}, '', '/recruiter/integrations');
      fetchIntegrations();
    }

    if (error) {
      const providerName = provider ? getProviderName(provider) : 'Provider';
      toast.error(`Verbindung zu ${providerName} fehlgeschlagen: ${error}`);
      window.history.replaceState({}, '', '/recruiter/integrations');
    }
  }, []); // Only on mount

  // ─── OAuth Connect ────────────────────────────────────────────────

  const startOAuthConnect = useCallback(async (provider: IntegrationProvider) => {
    try {
      const { data, error } = await supabase.functions.invoke('oauth-connect', {
        body: { provider },
      });

      if (error) {
        if (isEdgeFunctionNotDeployed(error)) {
          toast.error(`OAuth für ${getProviderName(provider)} ist noch nicht konfiguriert. Die Edge Function muss zuerst deployed werden.`);
          return;
        }
        throw error;
      }

      if (data?.authorization_url) {
        // Redirect to provider's OAuth page
        window.location.href = data.authorization_url;
      } else if (data?.error) {
        toast.error(`${getProviderName(provider)}: ${data.error}`);
      } else {
        throw new Error('Keine Authorization URL erhalten');
      }
    } catch (err) {
      // FunctionsFetchError is THROWN by supabase-js (not returned as error field)
      if (isEdgeFunctionNotDeployed(err)) {
        toast.error(`OAuth für ${getProviderName(provider)} ist noch nicht konfiguriert. Die Edge Function muss zuerst deployed werden.`);
        return;
      }
      console.error('[useRecruiterIntegrations] OAuth connect failed:', err);
      toast.error(`Verbindung zu ${getProviderName(provider)} fehlgeschlagen. Bitte versuche es erneut.`);
    }
  }, []);

  // ─── API Key Connect ──────────────────────────────────────────────

  const connectApiKey = useCallback(async (provider: IntegrationProvider, apiKey: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('integration-api-key', {
        body: { action: 'connect', provider, apiKey },
      });

      if (error) {
        if (isEdgeFunctionNotDeployed(error)) {
          toast.error(`Edge Function für API-Key-Verbindung ist noch nicht deployed.`);
          return false;
        }
        throw error;
      }

      if (data?.success) {
        toast.success(`${getProviderName(provider)} erfolgreich verbunden!`);
        await fetchIntegrations();
        return true;
      }

      throw new Error(data?.error || 'Verbindung fehlgeschlagen');
    } catch (err) {
      if (isEdgeFunctionNotDeployed(err)) {
        toast.error(`Edge Function für API-Key-Verbindung ist noch nicht deployed.`);
        return false;
      }
      console.error('[useRecruiterIntegrations] API key connect failed:', err);
      toast.error(`Verbindung zu ${getProviderName(provider)} fehlgeschlagen`);
      return false;
    }
  }, [fetchIntegrations]);

  // ─── Client Credentials Connect ───────────────────────────────────

  const connectClientCredentials = useCallback(async (
    provider: IntegrationProvider,
    clientId: string,
    clientSecret: string
  ): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('integration-api-key', {
        body: { action: 'connect', provider, clientId, clientSecret },
      });

      if (error) {
        if (isEdgeFunctionNotDeployed(error)) {
          toast.error(`Edge Function für Credentials-Verbindung ist noch nicht deployed.`);
          return false;
        }
        throw error;
      }

      if (data?.success) {
        toast.success(`${getProviderName(provider)} erfolgreich verbunden!`);
        await fetchIntegrations();
        return true;
      }

      throw new Error(data?.error || 'Verbindung fehlgeschlagen');
    } catch (err) {
      if (isEdgeFunctionNotDeployed(err)) {
        toast.error(`Edge Function für Credentials-Verbindung ist noch nicht deployed.`);
        return false;
      }
      console.error('[useRecruiterIntegrations] Client credentials connect failed:', err);
      toast.error(`Verbindung zu ${getProviderName(provider)} fehlgeschlagen`);
      return false;
    }
  }, [fetchIntegrations]);

  // ─── Disconnect ───────────────────────────────────────────────────

  const disconnectIntegration = useCallback(async (integrationId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('integration-disconnect', {
        body: { integrationId },
      });

      if (error) {
        if (isEdgeFunctionNotDeployed(error)) {
          toast.error(`Edge Function für Disconnect ist noch nicht deployed.`);
          return false;
        }
        throw error;
      }

      if (data?.success) {
        toast.success(`${getProviderName(data.provider)} getrennt`);
        await fetchIntegrations();
        return true;
      }

      throw new Error(data?.error || 'Trennen fehlgeschlagen');
    } catch (err) {
      if (isEdgeFunctionNotDeployed(err)) {
        toast.error(`Edge Function für Disconnect ist noch nicht deployed.`);
        return false;
      }
      console.error('[useRecruiterIntegrations] Disconnect failed:', err);
      toast.error('Integration konnte nicht getrennt werden');
      return false;
    }
  }, [fetchIntegrations]);

  // ─── Computed values ──────────────────────────────────────────────

  const connectedProviderIds = integrations
    .filter((i) => i.status === 'connected')
    .map((i) => i.provider);

  const availableProviders = PROVIDERS.filter(
    (p) => !connectedProviderIds.includes(p.id)
  );

  const connectedProviders = PROVIDERS.filter((p) =>
    connectedProviderIds.includes(p.id)
  );

  return {
    integrations,
    loading,
    startOAuthConnect,
    connectApiKey,
    connectClientCredentials,
    disconnectIntegration,
    refresh: fetchIntegrations,
    availableProviders,
    connectedProviders,
  };
}

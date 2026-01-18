import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MicrosoftConnection {
  id: string;
  email: string | null;
  connected_at: string;
  token_expires_at: string | null;
}

export function useMicrosoftAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<MicrosoftConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkConnection = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        setConnectionDetails(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_integrations')
        .select('id, email, connected_at, token_expires_at')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIsConnected(true);
        setConnectionDetails(data);
      } else {
        setIsConnected(false);
        setConnectionDetails(null);
      }
    } catch (error) {
      console.error('Error checking Microsoft connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectMicrosoft = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'get-auth-url' }
      });

      if (error) throw error;

      if (data?.url) {
        // Store state in sessionStorage for callback verification
        sessionStorage.setItem('oauth_state', data.state);
        sessionStorage.setItem('oauth_provider', 'microsoft');
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error starting Microsoft OAuth:', error);
      toast({
        title: 'Fehler',
        description: 'Microsoft-Verbindung konnte nicht gestartet werden.',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const disconnectMicrosoft = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      setIsConnected(false);
      setConnectionDetails(null);
      toast({
        title: 'Verbindung getrennt',
        description: 'Microsoft Teams wurde erfolgreich getrennt.'
      });
    } catch (error) {
      console.error('Error disconnecting Microsoft:', error);
      toast({
        title: 'Fehler',
        description: 'Verbindung konnte nicht getrennt werden.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      setLoading(true);
      const storedState = sessionStorage.getItem('oauth_state');
      
      if (state !== storedState) {
        throw new Error('Invalid state parameter');
      }

      const { data, error } = await supabase.functions.invoke('microsoft-auth', {
        body: { action: 'exchange-code', code }
      });

      if (error) throw error;

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_provider');

      await checkConnection();
      
      toast({
        title: 'Verbunden!',
        description: 'Microsoft Teams wurde erfolgreich verbunden.'
      });

      return { success: true };
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      toast({
        title: 'Fehler',
        description: 'Authentifizierung fehlgeschlagen.',
        variant: 'destructive'
      });
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const createTeamsMeeting = async (params: {
    subject: string;
    startDateTime: string;
    endDateTime: string;
    interviewId: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-teams-meeting', {
        body: params
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating Teams meeting:', error);
      toast({
        title: 'Fehler',
        description: 'Teams-Meeting konnte nicht erstellt werden.',
        variant: 'destructive'
      });
      return null;
    }
  };

  return {
    isConnected,
    connectionDetails,
    loading,
    connectMicrosoft,
    disconnectMicrosoft,
    handleOAuthCallback,
    createTeamsMeeting,
    refreshConnection: checkConnection
  };
}

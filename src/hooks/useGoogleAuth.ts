import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface GoogleConnection {
  id: string;
  email: string | null;
  connected_at: string;
  token_expires_at: string | null;
}

export function useGoogleAuth() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<GoogleConnection | null>(null);
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
        .eq('provider', 'google')
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
      console.error('Error checking Google connection:', error);
      setIsConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const connectGoogle = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('google-auth', {
        body: { action: 'get-auth-url' }
      });

      if (error) throw error;

      if (data?.url) {
        sessionStorage.setItem('oauth_state', data.state);
        sessionStorage.setItem('oauth_provider', 'google');
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error starting Google OAuth:', error);
      toast({
        title: 'Fehler',
        description: 'Google-Verbindung konnte nicht gestartet werden.',
        variant: 'destructive'
      });
      setLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.functions.invoke('google-auth', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      setIsConnected(false);
      setConnectionDetails(null);
      toast({
        title: 'Verbindung getrennt',
        description: 'Google Calendar wurde erfolgreich getrennt.'
      });
    } catch (error) {
      console.error('Error disconnecting Google:', error);
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

      const { data, error } = await supabase.functions.invoke('google-auth', {
        body: { action: 'exchange-code', code }
      });

      if (error) throw error;

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_provider');

      await checkConnection();
      
      toast({
        title: 'Verbunden!',
        description: 'Google Calendar wurde erfolgreich verbunden.'
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

  const createGoogleMeeting = async (params: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    interviewId: string;
    attendees?: string[];
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-google-meeting', {
        body: params
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating Google Meet:', error);
      toast({
        title: 'Fehler',
        description: 'Google Meet konnte nicht erstellt werden.',
        variant: 'destructive'
      });
      return null;
    }
  };

  const getAvailableSlots = async (params: {
    startDate: string;
    endDate: string;
    durationMinutes: number;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-auth', {
        body: { action: 'get-free-busy', ...params }
      });

      if (error) throw error;

      return data?.slots || [];
    } catch (error) {
      console.error('Error getting available slots:', error);
      return [];
    }
  };

  return {
    isConnected,
    connectionDetails,
    loading,
    connectGoogle,
    disconnectGoogle,
    handleOAuthCallback,
    createGoogleMeeting,
    getAvailableSlots,
    refreshConnection: checkConnection
  };
}

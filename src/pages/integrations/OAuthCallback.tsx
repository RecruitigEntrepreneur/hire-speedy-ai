import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

type CallbackStatus = 'processing' | 'success' | 'error';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  
  const { handleOAuthCallback: handleMicrosoftCallback } = useMicrosoftAuth();
  const { handleOAuthCallback: handleGoogleCallback } = useGoogleAuth();

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setErrorMessage(errorDescription || 'Authentifizierung fehlgeschlagen');
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setErrorMessage('Ungültige OAuth-Antwort');
        return;
      }

      const provider = sessionStorage.getItem('oauth_provider');

      try {
        let result;
        
        if (provider === 'microsoft') {
          result = await handleMicrosoftCallback(code, state);
        } else if (provider === 'google') {
          result = await handleGoogleCallback(code, state);
        } else {
          throw new Error('Unbekannter OAuth-Provider');
        }

        if (result?.success) {
          setStatus('success');
          // Redirect after short delay - use stored return path or fallback to dashboard
          const returnPath = sessionStorage.getItem('oauth_return_path');
          sessionStorage.removeItem('oauth_return_path');
          setTimeout(() => {
            navigate(returnPath || '/dashboard/integrations', { replace: true });
          }, 2000);
        } else {
          setStatus('error');
          setErrorMessage('Verbindung konnte nicht hergestellt werden');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unbekannter Fehler');
      }
    };

    processCallback();
  }, [searchParams, handleMicrosoftCallback, handleGoogleCallback, navigate]);

  const provider = sessionStorage.getItem('oauth_provider');
  const providerName = provider === 'microsoft' ? 'Microsoft Teams' : 'Google Calendar';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>
            {status === 'processing' && 'Verbindung wird hergestellt...'}
            {status === 'success' && 'Erfolgreich verbunden!'}
            {status === 'error' && 'Verbindung fehlgeschlagen'}
          </CardTitle>
          <CardDescription>
            {providerName}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-6">
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground text-center">
                Bitte warten Sie, während wir Ihre Verbindung einrichten...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="text-muted-foreground text-center">
                {providerName} wurde erfolgreich verbunden. Sie werden weitergeleitet...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-red-600" />
              </div>
              <p className="text-destructive text-center">
                {errorMessage}
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  const returnPath = sessionStorage.getItem('oauth_return_path');
                  sessionStorage.removeItem('oauth_return_path');
                  navigate(returnPath || '/dashboard/integrations', { replace: true });
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Zurück zu Integrationen
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

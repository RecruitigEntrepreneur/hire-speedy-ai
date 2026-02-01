import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useMicrosoftAuth } from '@/hooks/useMicrosoftAuth';
import { useGoogleAuth } from '@/hooks/useGoogleAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface ProviderConfig {
  configured: boolean;
  provider: string;
}

export function CalendarConnectionCard() {
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

  const [msConfigured, setMsConfigured] = useState<boolean | null>(null);
  const [googleConfigured, setGoogleConfigured] = useState<boolean | null>(null);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Check if providers are configured (secrets available)
  useEffect(() => {
    const checkConfigs = async () => {
      try {
        // Check Microsoft config
        const { data: msData } = await supabase.functions.invoke('microsoft-auth', {
          body: { action: 'check-config' }
        });
        setMsConfigured(msData?.configured ?? false);

        // Check Google config
        const { data: googleData } = await supabase.functions.invoke('google-auth', {
          body: { action: 'check-config' }
        });
        setGoogleConfigured(googleData?.configured ?? false);
      } catch (error) {
        console.error('Error checking calendar configs:', error);
        // If functions don't exist or fail, assume not configured
        setMsConfigured(false);
        setGoogleConfigured(false);
      } finally {
        setCheckingConfig(false);
      }
    };

    checkConfigs();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return format(new Date(dateString), 'dd. MMMM yyyy', { locale: de });
  };

  if (checkingConfig || msLoading || googleLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Kalender-Integration
          </CardTitle>
          <CardDescription>
            Verbinden Sie Ihren Kalender für automatische Interview-Termine
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Kalender-Integration
        </CardTitle>
        <CardDescription>
          Verbinden Sie Ihren Kalender, damit Interview-Termine automatisch eingetragen werden
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Microsoft 365 / Outlook */}
        <div className="border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-[#0078d4] flex items-center justify-center text-white shrink-0">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M21.17 2.06A2.13 2.13 0 0019.92 2H4.08a2.13 2.13 0 00-1.25.06A1.78 1.78 0 002 3.64v16.72a1.78 1.78 0 00.83 1.58 2.13 2.13 0 001.25.06h15.84a2.13 2.13 0 001.25-.06A1.78 1.78 0 0022 20.36V3.64a1.78 1.78 0 00-.83-1.58zM12 17.92l-6.15-3.58v-4.68L12 13.24l6.15-3.58v4.68z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium">Microsoft 365 / Outlook</h4>
                {msConnected && msDetails ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-sm text-green-600">Verbunden</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{msDetails.email}</p>
                    {msDetails.connected_at && (
                      <p className="text-xs text-muted-foreground">
                        Verbunden am {formatDate(msDetails.connected_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nicht verbunden
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {msConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={disconnectMicrosoft}
                  disabled={msLoading}
                >
                  {msLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Trennen
                </Button>
              ) : msConfigured === false ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Nicht konfiguriert
                </Badge>
              ) : (
                <Button 
                  size="sm" 
                  onClick={connectMicrosoft}
                  disabled={msLoading}
                >
                  {msLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verbinden
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="border rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-white border flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="h-6 w-6">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium">Google Calendar</h4>
                {googleConnected && googleDetails ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      <span className="text-sm text-green-600">Verbunden</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{googleDetails.email}</p>
                    {googleDetails.connected_at && (
                      <p className="text-xs text-muted-foreground">
                        Verbunden am {formatDate(googleDetails.connected_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-1">
                    Nicht verbunden
                  </p>
                )}
              </div>
            </div>
            <div className="shrink-0">
              {googleConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={disconnectGoogle}
                  disabled={googleLoading}
                >
                  {googleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Trennen
                </Button>
              ) : googleConfigured === false ? (
                <Badge variant="outline" className="text-muted-foreground">
                  Nicht konfiguriert
                </Badge>
              ) : (
                <Button 
                  size="sm" 
                  onClick={connectGoogle}
                  disabled={googleLoading}
                >
                  {googleLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Verbinden
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Configuration notice */}
        {(msConfigured === false && googleConfigured === false) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Kalender-Integration muss konfiguriert werden</p>
              <p className="text-sm mt-1">
                Für die Outlook-Integration benötigen Sie eine Azure AD App Registration.
                Kontaktieren Sie Ihren Administrator.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Feature description */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <h5 className="text-sm font-medium">Mit verbundenem Kalender:</h5>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Interview-Termine werden automatisch im Kalender erstellt
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Belegte Zeiten werden bei der Terminauswahl angezeigt
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              Meeting-Links werden automatisch generiert (Teams/Meet)
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInviteByToken, useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, CheckCircle2, XCircle, Clock, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

const roleLabels: Record<string, string> = {
  admin: 'Administrator',
  hiring_manager: 'Hiring Manager',
  viewer: 'Betrachter',
  finance: 'Finanzen',
};

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: invite, isLoading: inviteLoading, error: inviteError } = useInviteByToken(token);
  const { acceptInvite } = useOrganizationInvites(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error' | 'expired' | 'not_logged_in'>('loading');

  useEffect(() => {
    if (authLoading || inviteLoading) {
      setStatus('loading');
      return;
    }

    if (!user) {
      setStatus('not_logged_in');
      return;
    }

    if (inviteError || !invite) {
      setStatus('error');
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      setStatus('expired');
      return;
    }

    setStatus('ready');
  }, [user, authLoading, invite, inviteLoading, inviteError]);

  const handleAccept = async () => {
    if (!token) return;
    
    setStatus('loading');
    try {
      const result = await acceptInvite.mutateAsync(token);
      setStatus('success');
      
      // Redirect after success
      setTimeout(() => {
        navigate('/organization/team');
      }, 2000);
    } catch (error) {
      setStatus('error');
    }
  };

  const handleLogin = () => {
    // Store the invite URL to redirect back after login
    sessionStorage.setItem('redirectAfterLogin', `/invite/${token}`);
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        {status === 'loading' && (
          <CardContent className="py-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">Einladung wird geladen...</p>
          </CardContent>
        )}

        {status === 'not_logged_in' && (
          <>
            <CardHeader className="text-center">
              <LogIn className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <CardTitle>Anmeldung erforderlich</CardTitle>
              <CardDescription>
                Bitte melden Sie sich an, um die Einladung anzunehmen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full" onClick={handleLogin}>
                <LogIn className="h-4 w-4 mr-2" />
                Anmelden
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Falls Sie noch kein Konto haben, können Sie sich auf der Anmeldeseite registrieren.
              </p>
            </CardContent>
          </>
        )}

        {status === 'ready' && invite && (
          <>
            <CardHeader className="text-center">
              <Avatar className="h-16 w-16 mx-auto mb-4">
                {invite.organizations?.logo_url ? (
                  <AvatarImage src={invite.organizations.logo_url} />
                ) : (
                  <AvatarFallback>
                    <Building2 className="h-8 w-8" />
                  </AvatarFallback>
                )}
              </Avatar>
              <CardTitle>Sie wurden eingeladen</CardTitle>
              <CardDescription>
                {invite.organizations?.name || 'Eine Organisation'} möchte Sie als Teammitglied hinzufügen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Ihre Rolle</span>
                  <Badge variant="secondary">{roleLabels[invite.role] || invite.role}</Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Eingeladen als</span>
                  <span className="font-medium">{invite.email}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Gültig bis</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatDistanceToNow(new Date(invite.expires_at), {
                      locale: de,
                      addSuffix: true,
                    })}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/')}
                >
                  Ablehnen
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAccept}
                  disabled={acceptInvite.isPending}
                >
                  {acceptInvite.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Annehmen
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {status === 'success' && (
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
            <h3 className="mt-4 text-lg font-semibold">Erfolgreich beigetreten!</h3>
            <p className="text-muted-foreground">
              Sie werden zur Team-Übersicht weitergeleitet...
            </p>
          </CardContent>
        )}

        {status === 'error' && (
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
            <h3 className="mt-4 text-lg font-semibold">Einladung ungültig</h3>
            <p className="text-muted-foreground">
              Diese Einladung ist ungültig oder wurde bereits verwendet.
            </p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          </CardContent>
        )}

        {status === 'expired' && (
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Einladung abgelaufen</h3>
            <p className="text-muted-foreground">
              Diese Einladung ist leider abgelaufen. Bitte fordern Sie eine neue Einladung an.
            </p>
            <Button className="mt-4" onClick={() => navigate('/')}>
              Zur Startseite
            </Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useValidateInvite, useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, CheckCircle2, XCircle, Clock, LogIn } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

export default function AcceptInvite() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: invite, isLoading: inviteLoading } = useValidateInvite(token);
  const { acceptInvite } = useOrganizationInvites(undefined);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const roleLabel = (role?: string) => (role ? t(`team.roles.${role}`, role) : '');

  // Eingeloggt annehmen (Konto existiert)
  const handleAcceptLoggedIn = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await acceptInvite.mutateAsync({ token });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      // Fehler-Toast kommt aus dem Hook
    } finally {
      setSubmitting(false);
    }
  };

  // Neues Konto anlegen + annehmen
  const handleSignupAccept = async () => {
    if (!token || !invite?.email) return;
    if (password.length < 8 || password !== passwordConfirm) return;
    setSubmitting(true);
    try {
      await acceptInvite.mutateAsync({ token, password, full_name: fullName });
      // Direkt einloggen und ins Dashboard
      await supabase.auth.signInWithPassword({ email: invite.email, password });
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch {
      // Fehler-Toast kommt aus dem Hook
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogin = () => {
    sessionStorage.setItem('redirectAfterLogin', `/invite/${token}`);
    navigate('/auth');
  };

  const isLoading = authLoading || inviteLoading;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        {isLoading && (
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{t('team.accept.loading')}</p>
          </CardContent>
        )}

        {!isLoading && success && (
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold">{t('team.accept.success_title')}</h3>
            <p className="text-muted-foreground">{t('team.accept.success_hint')}</p>
          </CardContent>
        )}

        {!isLoading && !success && (!invite || !invite.valid) && (
          <CardContent className="py-12 text-center">
            {invite?.reason === 'expired' ? (
              <>
                <Clock className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">{t('team.accept.expired_title')}</h3>
                <p className="text-muted-foreground">{t('team.accept.expired_hint')}</p>
              </>
            ) : (
              <>
                <XCircle className="mx-auto h-12 w-12 text-destructive" />
                <h3 className="mt-4 text-lg font-semibold">{t('team.accept.invalid_title')}</h3>
                <p className="text-muted-foreground">{t('team.accept.invalid_hint')}</p>
              </>
            )}
            <Button className="mt-4" onClick={() => navigate('/')}>
              {t('team.accept.to_home')}
            </Button>
          </CardContent>
        )}

        {!isLoading && !success && invite?.valid && (
          <>
            <CardHeader className="text-center">
              <Avatar className="mx-auto mb-4 h-16 w-16">
                {invite.organization_logo ? (
                  <AvatarImage src={invite.organization_logo} />
                ) : (
                  <AvatarFallback>
                    <Building2 className="h-8 w-8" />
                  </AvatarFallback>
                )}
              </Avatar>
              <CardTitle>{t('team.accept.title')}</CardTitle>
              <CardDescription>
                {t('team.accept.description', {
                  org: invite.organization_name ?? t('team.accept.an_organization'),
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-muted-foreground">{t('team.accept.your_role')}</span>
                  <Badge variant="secondary">{roleLabel(invite.role)}</Badge>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-muted-foreground">{t('team.accept.invited_as')}</span>
                  <span className="font-medium">{invite.email}</span>
                </div>
                {(invite.job_count ?? 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                    <span className="text-muted-foreground">{t('team.accept.assigned_jobs')}</span>
                    <span className="font-medium">{invite.job_count}</span>
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span className="text-muted-foreground">{t('team.accept.valid_until')}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {invite.expires_at &&
                      formatDistanceToNow(new Date(invite.expires_at), {
                        locale: de,
                        addSuffix: true,
                      })}
                  </span>
                </div>
              </div>

              {/* Fall 1: eingeloggt → direkt annehmen */}
              {user && (
                <Button className="w-full" onClick={handleAcceptLoggedIn} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('team.accept.accept_button')}
                </Button>
              )}

              {/* Fall 2: Konto existiert, aber nicht eingeloggt → Login */}
              {!user && invite.account_exists && (
                <div className="space-y-3">
                  <Button className="w-full" onClick={handleLogin}>
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('team.accept.login_button')}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    {t('team.accept.login_hint')}
                  </p>
                </div>
              )}

              {/* Fall 3: neues Konto → Passwort setzen */}
              {!user && !invite.account_exists && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-name">{t('team.accept.full_name')}</Label>
                    <Input
                      id="invite-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Max Mustermann"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-password">{t('team.accept.password')}</Label>
                    <Input
                      id="invite-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {password.length > 0 && password.length < 8 && (
                      <p className="text-xs text-destructive">{t('team.accept.password_min')}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-password-confirm">
                      {t('team.accept.password_confirm')}
                    </Label>
                    <Input
                      id="invite-password-confirm"
                      type="password"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                    />
                    {passwordConfirm.length > 0 && password !== passwordConfirm && (
                      <p className="text-xs text-destructive">
                        {t('team.accept.password_mismatch')}
                      </p>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSignupAccept}
                    disabled={
                      submitting || password.length < 8 || password !== passwordConfirm
                    }
                  >
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t('team.accept.create_account_button')}
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

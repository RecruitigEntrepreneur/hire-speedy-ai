import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useValidateInvite, useOrganizationInvites } from '@/hooks/useOrganizationInvites';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Building2, Check } from 'lucide-react';
import { fmtDate } from '@/lib/localeFormat';

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

  const jobCount = invite?.job_count ?? 0;
  const feld = 'space-y-1.5';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        {isLoading && (
          <div className="py-10 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">{t('team.accept.loading')}</p>
          </div>
        )}

        {!isLoading && success && (
          <div className="py-10 text-center">
            <Check className="mx-auto h-8 w-8" />
            <h1 className="mt-4 text-lg font-semibold tracking-tight">{t('team.accept.success_title')}</h1>
            <p className="text-sm text-muted-foreground">{t('team.accept.success_hint')}</p>
          </div>
        )}

        {/* Ungültig oder abgelaufen: ein Satz, was zu tun ist, und zwei Wege weiter. */}
        {!isLoading && !success && (!invite || !invite.valid) && (
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{t('team.accept.gone_title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('team.accept.gone_hint')}</p>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button onClick={() => navigate('/auth')}>{t('team.accept.to_login')}</Button>
              <button type="button" onClick={() => navigate('/')} className="text-sm text-klick hover:underline">
                {t('team.accept.to_home')} ›
              </button>
            </div>
          </div>
        )}

        {!isLoading && !success && invite?.valid && (
          <div>
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 shrink-0">
                {invite.organization_logo ? (
                  <AvatarImage src={invite.organization_logo} />
                ) : (
                  <AvatarFallback>
                    <Building2 className="h-5 w-5" />
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0">
                <h1 className="text-lg font-semibold leading-snug tracking-tight">
                  {t('team.accept.heading', { org: invite.organization_name ?? t('team.accept.an_organization') })}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {jobCount > 0
                    ? t('team.accept.lead_jobs', { role: roleLabel(invite.role), count: jobCount })
                    : t('team.accept.lead', { role: roleLabel(invite.role) })}
                </p>
              </div>
            </div>

            <dl className="mt-5 divide-y border-y text-sm">
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-muted-foreground">{t('team.accept.invited_as')}</dt>
                <dd className="min-w-0 truncate font-medium">{invite.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2.5">
                <dt className="text-muted-foreground">{t('team.accept.valid_until')}</dt>
                <dd>{invite.expires_at && fmtDate(new Date(invite.expires_at))}</dd>
              </div>
            </dl>

            <div className="mt-5">
              {/* Fall 1: eingeloggt → direkt annehmen */}
              {user && (
                <Button className="w-full gap-2" onClick={handleAcceptLoggedIn} disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('team.accept.accept_button')}
                </Button>
              )}

              {/* Fall 2: Konto existiert, aber nicht eingeloggt → Login */}
              {!user && invite.account_exists && (
                <div className="space-y-3">
                  <Button className="w-full" onClick={handleLogin}>{t('team.accept.login_button')}</Button>
                  <p className="text-center text-sm text-muted-foreground">{t('team.accept.login_hint')}</p>
                </div>
              )}

              {/* Fall 3: neues Konto → Passwort setzen */}
              {!user && !invite.account_exists && (
                <div className="space-y-4">
                  <div className={feld}>
                    <Label htmlFor="invite-name">{t('team.accept.full_name')}</Label>
                    <Input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('auth.fullNamePlaceholder')} />
                  </div>
                  <div className={feld}>
                    <Label htmlFor="invite-password">{t('team.accept.password')} <span className="font-normal text-muted-foreground">· {t('team.accept.password_min')}</span></Label>
                    <Input id="invite-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className={feld}>
                    <Label htmlFor="invite-password-confirm">{t('team.accept.password_confirm')}</Label>
                    <Input id="invite-password-confirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                    {passwordConfirm.length > 0 && password !== passwordConfirm && (
                      <p className="text-xs text-muted-foreground">{t('team.accept.password_mismatch')}</p>
                    )}
                  </div>
                  <Button className="w-full gap-2" onClick={handleSignupAccept} disabled={submitting || password.length < 8 || password !== passwordConfirm}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {t('team.accept.create_account_button')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

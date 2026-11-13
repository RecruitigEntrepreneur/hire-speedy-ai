import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import type { AuthError } from '@supabase/supabase-js';
import { ArrowRight, KeyRound, Loader2, Mail } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageMenu } from '@/components/language/LanguageMenu';
import { LanguageHint } from '@/components/language/LanguageHint';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { onboardingApi, type CodeSession } from '@/lib/recruiterOnboardingApi';
import { PASSWORD_SET_KEY, safeRecruiterPath, type LoginLinkPeek } from '@/lib/recruiterLogin';
import '@/components/onboarding/onboarding.css';

type Phase = 'email' | 'code' | 'password' | 'done';

const NS = 'recruiterFunnel';
const strong = { strong: <strong/> };

/**
 * Anmeldung für freigeschaltete Headhunter: E-Mail, Code aus der Mail, beim
 * ersten Mal ein Passwort (überspringbar), dann zur gewünschten Seite. Der
 * Server verschickt Codes nur an bestehende Headhunter und legt nie ein Konto an.
 * Mit dem persönlichen Link aus der Willkommensmail (#Schlüssel) kennt die Seite
 * Namen und Adresse schon; der Code bleibt trotzdem nötig.
 */
export default function RecruiterLogin() {
  const [params] = useSearchParams();
  const next = safeRecruiterPath(params.get('next'));
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { t } = useTranslation(NS);
  const passwordError = (e: AuthError) => t(e.code === 'weak_password' ? 'login.weakPassword' : 'login.passwordNotSaved');
  const [phase, setPhase] = useState<Phase>('email');
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState(() => window.location.hash.slice(1));
  const [peek, setPeek] = useState<LoginLinkPeek | null>(null);

  useEffect(() => {
    if (!link) return;
    let active = true;
    void onboardingApi<LoginLinkPeek>(false, { action: 'peek', link })
      .then(result => { if (active) setPeek(result); })
      .catch(() => { if (active) setPeek({ status: 'invalid' }); });
    return () => { active = false; };
  }, [link]);
  const known = !!link && peek?.status === 'open' ? peek : null;
  // Mit gültigem Link geht der Code an die Adresse des Kontos, sonst an die eingetippte.
  const identity = known ? { link } : { email: email.trim() };
  const forgetLink = () => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setLink(''); setPeek(null); setError(''); setNotice('');
  };

  // Weiter erst mit geladener Rolle, sonst öffnet der Headhunter-Bereich kurz ohne Zugangsprüfung.
  // Kommt die Rolle nicht, geht es nach kurzer Zeit trotzdem weiter; dort wird ohnehin geprüft.
  useEffect(() => {
    if (phase !== 'done') return;
    if (user && role) { navigate(next, { replace: true }); return; }
    const timer = window.setTimeout(() => navigate(next, { replace: true }), 4000);
    return () => window.clearTimeout(timer);
  }, [phase, user, role, next, navigate]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : t('common.requestFailed')); } finally { setBusy(false); }
  };
  const requestCode = (again = false) => run(async () => {
    const result = await onboardingApi<{ masked_email: string; code_length?: number }>(false, { action: 'code', ...identity, login: true });
    setSentTo(result.masked_email); setCodeLength(Math.min(10, Math.max(6, result.code_length ?? 6)));
    setCode(''); setPhase('code');
    if (again) setNotice(t('login.newCodeSent'));
  });
  // Prüft von selbst, sobald die letzte Ziffer steht. Ein falscher Code leert die Kästchen.
  const confirmCode = (value: string) => run(async () => {
    let passwordSet = false;
    try {
      const session = await onboardingApi<CodeSession>(false, { action: 'verify', ...identity, code: value, login: true });
      const { data, error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (error) throw error;
      passwordSet = !!data.user?.user_metadata?.[PASSWORD_SET_KEY];
    } catch (e) { setCode(''); throw e; }
    setPhase(passwordSet ? 'done' : 'password');
  });
  const savePassword = () => run(async () => {
    if (password.length < 8) throw new Error(t('login.min8'));
    if (password !== repeat) throw new Error(t('common.passwordMismatch'));
    const data = { [PASSWORD_SET_KEY]: new Date().toISOString() };
    const { error } = await supabase.auth.updateUser({ password, data });
    // Dasselbe Passwort wie bisher: Es ist also schon gesetzt, nur der Merker fehlte.
    if (error?.code === 'same_password') {
      const { error: again } = await supabase.auth.updateUser({ data });
      if (again) throw new Error(passwordError(again));
    } else if (error) throw new Error(passwordError(error));
    setPhase('done');
  });

  // Schon angemeldet, etwa über den Link in der Willkommensmail: direkt weiter.
  if (phase === 'email' && user && (role === 'recruiter' || role === 'admin')) return <Navigate to={next} replace />;

  const checkingLink = !!link && !peek;
  const emailLead = checkingLink ? t('common.oneMoment')
    : known ? <Trans ns={NS} i18nKey="login.codeTo" values={{ email: known.masked_email }} components={strong}/>
    : link && peek?.status === 'expired' ? t('login.linkExpired')
    : link ? t('login.linkInvalid')
    : t('login.welcomeBack');
  const head: Record<Phase, [ReactNode, string, ReactNode]> = {
    email: [<Mail key="i" size={20}/>, known ? (known.name ? t('login.helloName', { name: known.name }) : t('login.hello')) : t('login.signIn'), emailLead],
    code: [<Mail key="i" size={20}/>, t('common.enterCode'), <Trans key="l" ns={NS} i18nKey={known ? 'login.codeSentKnown' : 'login.codeSentMaybe'} values={{ email: sentTo }} components={strong}/>],
    password: [<KeyRound key="i" size={20}/>, t('login.setPassword'), t('login.setPasswordLead')],
    done: [<Loader2 key="i" size={20} className="animate-spin"/>, t('login.signedIn'), t('login.loadingDashboard')],
  };
  const [icon, title, lead] = head[phase];

  return <div className="mh-ui mh-onboarding">
    <header className="mh-header">
      <div className="mh-actions"><a href="/" className="mh-brand" aria-label={t('common.homeAria')}><MatchuntWordmark size="md"/></a><span className="mh-header-tag">{t('login.tag')}</span></div>
      <div className="mh-header-account"><LanguageMenu/><ThemeToggle/></div>
    </header>
    <LanguageHint/>
    <main className="mh-main mh-login">
      <section className="mh-panel" aria-live="polite">
        <div className="mh-verify">
          <div className="mh-verify-icon">{icon}</div>
          <div><h1>{title}</h1><p className="mh-muted">{lead}</p></div>

          {phase === 'email' && !checkingLink && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void requestCode(); }}>
            {!known && <label className="mh-field">{t('common.emailAddress')}<input autoFocus autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
            <button autoFocus={!!known} className="mh-button mh-primary mh-full" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>}{busy ? t('common.oneMoment') : t('common.sendCode')}</button>
            {known
              ? <button type="button" className="mh-link mh-login-later" disabled={busy} onClick={forgetLink}>{t('login.otherAddress')}</button>
              : <p className="mh-muted mh-verify-hint">{t('login.sixDigits')}</p>}
          </form>}

          {phase === 'code' && <>
            <div className="mh-otp" data-length={codeLength}>
              <InputOTP autoFocus maxLength={codeLength} value={code} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" disabled={busy} onChange={value => { setCode(value); setError(''); if (value.length === codeLength) void confirmCode(value); }}>
                <InputOTPGroup>{Array.from({ length: codeLength }, (_, i) => <InputOTPSlot key={i} index={i} className="mh-otp-slot"/>)}</InputOTPGroup>
              </InputOTP>
            </div>
            {busy && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>{t('common.checking')}</p>}
            <div className="mh-verify-row">
              {known ? <span/> : <button type="button" className="mh-link" disabled={busy} onClick={() => { setPhase('email'); setCode(''); setError(''); setNotice(''); }}>{t('common.changeAddress')}</button>}
              <button type="button" className="mh-link" disabled={busy} onClick={() => void requestCode(true)}>{t('login.newCode')}</button>
            </div>
            <p className="mh-muted mh-verify-hint">{t('login.nothingArrived')}</p>
          </>}

          {phase === 'password' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void savePassword(); }}>
            {/* Für Passwortmanager: zu welchem Konto das neue Passwort gehört. */}
            <input type="email" autoComplete="username" value={user?.email ?? email} readOnly hidden/>
            <label className="mh-field">{t('login.newPassword')}<input autoFocus type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><small>{t('common.passwordMin')}</small></label>
            <label className="mh-field">{t('login.repeat')}<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e => setRepeat(e.target.value)}/></label>
            <button className="mh-button mh-primary mh-full" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin"/> : null}{busy ? t('login.saving') : t('login.saveAndContinue')}{!busy && <ArrowRight size={16}/>}</button>
            <button type="button" className="mh-link mh-login-later" disabled={busy} onClick={() => setPhase('done')}>{t('login.later')}</button>
          </form>}

          {notice && <p role="status" className="mh-alert">{notice}</p>}
          {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
        </div>
      </section>
      <footer className="mh-footer"><span>{t('common.footerClaim')}</span><div><a href="/impressum">{t('common.imprint')}</a><a href="/datenschutz">{t('common.privacy')}</a></div></footer>
    </main>
  </div>;
}

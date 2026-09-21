import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import type { AuthError } from '@supabase/supabase-js';
import { ArrowRight, KeyRound, Loader2, Mail } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { MatchuntWordmark } from '@/components/ui/MatchuntWordmark';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { onboardingApi, type CodeSession } from '@/lib/recruiterOnboardingApi';
import { PASSWORD_SET_KEY, safeRecruiterPath } from '@/lib/recruiterLogin';
import '@/components/onboarding/onboarding.css';

type Phase = 'email' | 'code' | 'password' | 'done';

const passwordError = (e: AuthError) => e.code === 'weak_password'
  ? 'Das Passwort ist zu einfach. Nimm ein längeres, gern mit Zahlen oder Sonderzeichen.'
  : 'Das Passwort konnte nicht gespeichert werden. Bitte versuch es noch einmal.';

/**
 * Anmeldung für freigeschaltete Headhunter: E-Mail, Code aus der Mail, beim
 * ersten Mal ein Passwort (überspringbar), dann zur gewünschten Seite. Der
 * Server verschickt Codes nur an bestehende Headhunter und legt nie ein Konto an.
 */
export default function RecruiterLogin() {
  const [params] = useSearchParams();
  const next = safeRecruiterPath(params.get('next'));
  const navigate = useNavigate();
  const { user, role } = useAuth();
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
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); }
  };
  const requestCode = (again = false) => run(async () => {
    const result = await onboardingApi<{ masked_email: string; code_length?: number }>(false, { action: 'code', email: email.trim(), login: true });
    setSentTo(result.masked_email); setCodeLength(Math.min(10, Math.max(6, result.code_length ?? 6)));
    setCode(''); setPhase('code');
    if (again) setNotice('Ein neuer Code ist unterwegs.');
  });
  // Prüft von selbst, sobald die letzte Ziffer steht. Ein falscher Code leert die Kästchen.
  const confirmCode = (value: string) => run(async () => {
    let passwordSet = false;
    try {
      const session = await onboardingApi<CodeSession>(false, { action: 'verify', email: email.trim(), code: value, login: true });
      const { data, error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (error) throw error;
      passwordSet = !!data.user?.user_metadata?.[PASSWORD_SET_KEY];
    } catch (e) { setCode(''); throw e; }
    setPhase(passwordSet ? 'done' : 'password');
  });
  const savePassword = () => run(async () => {
    if (password.length < 8) throw new Error('Bitte mindestens 8 Zeichen.');
    if (password !== repeat) throw new Error('Die beiden Eingaben stimmen nicht überein.');
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

  const head: Record<Phase, [ReactNode, string, ReactNode]> = {
    email: [<Mail key="i" size={20}/>, 'Anmelden', 'Willkommen zurück bei Matchunt.'],
    code: [<Mail key="i" size={20}/>, 'Code eingeben', <>Falls zu <strong>{sentTo}</strong> ein Headhunter-Konto gehört, ist der Code unterwegs. Er ist eine Stunde gültig.</>],
    password: [<KeyRound key="i" size={20}/>, 'Passwort festlegen', 'Damit kannst du dich künftig auch mit Passwort anmelden.'],
    done: [<Loader2 key="i" size={20} className="animate-spin"/>, 'Du bist angemeldet', 'Dein Dashboard wird geladen …'],
  };
  const [icon, title, lead] = head[phase];

  return <div className="mh-ui mh-onboarding">
    <header className="mh-header">
      <div className="mh-actions"><a href="/" className="mh-brand" aria-label="Matchunt.ai – Startseite"><MatchuntWordmark size="md"/></a><span className="mh-header-tag">ANMELDUNG FÜR HEADHUNTER</span></div>
      <div className="mh-header-account"><ThemeToggle/></div>
    </header>
    <main className="mh-main mh-login">
      <section className="mh-panel" aria-live="polite">
        <div className="mh-verify">
          <div className="mh-verify-icon">{icon}</div>
          <div><h1>{title}</h1><p className="mh-muted">{lead}</p></div>

          {phase === 'email' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void requestCode(); }}>
            <label className="mh-field">E-Mail-Adresse<input autoFocus autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
            <button className="mh-button mh-primary mh-full" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>}{busy ? 'Einen Moment …' : 'Code senden'}</button>
            <p className="mh-muted mh-verify-hint">Wir schicken dir einen sechsstelligen Code.</p>
          </form>}

          {phase === 'code' && <>
            <div className="mh-otp" data-length={codeLength}>
              <InputOTP autoFocus maxLength={codeLength} value={code} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" disabled={busy} onChange={value => { setCode(value); setError(''); if (value.length === codeLength) void confirmCode(value); }}>
                <InputOTPGroup>{Array.from({ length: codeLength }, (_, i) => <InputOTPSlot key={i} index={i} className="mh-otp-slot"/>)}</InputOTPGroup>
              </InputOTP>
            </div>
            {busy && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>Wird geprüft</p>}
            <div className="mh-verify-row">
              <button type="button" className="mh-link" disabled={busy} onClick={() => { setPhase('email'); setCode(''); setError(''); setNotice(''); }}>Adresse ändern</button>
              <button type="button" className="mh-link" disabled={busy} onClick={() => void requestCode(true)}>Neuer Code</button>
            </div>
            <p className="mh-muted mh-verify-hint">Nichts angekommen? Schau auch im Spam-Ordner nach.</p>
          </>}

          {phase === 'password' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void savePassword(); }}>
            {/* Für Passwortmanager: zu welchem Konto das neue Passwort gehört. */}
            <input type="email" autoComplete="username" value={user?.email ?? email} readOnly hidden/>
            <label className="mh-field">Neues Passwort<input autoFocus type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><small>Mindestens 8 Zeichen.</small></label>
            <label className="mh-field">Wiederholen<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e => setRepeat(e.target.value)}/></label>
            <button className="mh-button mh-primary mh-full" type="submit" disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin"/> : null}{busy ? 'Wird gespeichert …' : 'Speichern und weiter'}{!busy && <ArrowRight size={16}/>}</button>
            <button type="button" className="mh-link mh-login-later" disabled={busy} onClick={() => setPhase('done')}>Später</button>
          </form>}

          {notice && <p role="status" className="mh-alert">{notice}</p>}
          {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
        </div>
      </section>
      <footer className="mh-footer"><span>Matchunt · Dein Recruiting-Netzwerk</span><div><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></div></footer>
    </main>
  </div>;
}

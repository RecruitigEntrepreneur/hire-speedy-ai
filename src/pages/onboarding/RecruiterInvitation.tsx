import RecruiterProfileForm from '@/components/onboarding/RecruiterProfileForm';
import OnboardingFrame from '@/components/onboarding/OnboardingFrame';
import { ArrowRight, Building2, UserRound, FileText, ArrowUpRight, ShieldCheck, CheckCircle2, RefreshCw, Mail, Loader2, KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi, documentLabels, stateLabels, type StoredOnboarding, type RecruiterProfile, type InvitationPeek, type CodeSession } from '@/lib/recruiterOnboardingApi';
import { cleanProfile } from '../../../supabase/functions/_shared/recruiter-contract-policy';

// Der Link identifiziert die Einladung. Angemeldet wird per Code an die
// Einladungsadresse, ohne Konto und Passwort. Spätere Besuche laufen über die
// bestätigte Sitzung, auch auf einem anderen Gerät.
function invitationToken() {
  return location.pathname.endsWith('/invitation') ? location.hash.slice(1) : '';
}
export default function RecruiterInvitation() {
  const [token] = useState(invitationToken);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [peek, setPeek] = useState<InvitationPeek | null>(null);
  const [phase, setPhase] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [codeError, setCodeError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sentTo, setSentTo] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [kind, setKind] = useState('individual');
  const [c, setCase] = useState<StoredOnboarding | null>(null);
  const [profile, setProfile] = useState<RecruiterProfile>(() => cleanProfile({}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(() => new URLSearchParams(location.search).has('event') ? 'Willkommen zurück. Wir warten auf die bestätigte Rückmeldung von DocuSign. Deine Rückkehr allein bestätigt noch keine Unterschrift.' : '');
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setUser(data.session?.user ?? null); setAuthReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
  // Vorschau der Einladung ohne Sitzung: Vorname, maskierte Adresse, Status.
  useEffect(() => {
    if (!token) return;
    let active = true;
    void onboardingApi<InvitationPeek>(false, { action: 'peek', token }).then(result => { if (active) setPeek(result); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'Einladung konnte nicht geladen werden.'); });
    return () => { active = false; };
  }, [token]);
  useEffect(() => {
    setCase(null); setError('');
    if (!user?.id) return;
    let active = true;
    setBusy(true);
    void (token ? onboardingApi<StoredOnboarding>(false, { action: 'load', token }) : onboardingApi<{onboarding: StoredOnboarding | null}>(false, { action: 'resume' }).then(result => result.onboarding)).then(result => {
      if (active) { setCase(result); if (result) setProfile(result.profile); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Einladung konnte nicht geladen werden.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user?.id, token]);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); } };
  const identity = token ? { token } : { case_id: c?.id };
  // Wohin der Code geht: bei Einladungen entscheidet der Server, sonst die eingetippte Adresse.
  const codeIdentity = token ? { token } : { email };
  const load = async (action = 'load', extra: Record<string, unknown> = {}) => {
    const result = await onboardingApi<StoredOnboarding>(false, { action, ...identity, ...extra }); setCase(result); setProfile(result.profile);
  };
  const packet = c?.contracts.find(p => !['declined','voided'].includes(p.state));
  useEffect(() => {
    if (!user?.id || !c?.id || !new URLSearchParams(location.search).has('event') || packet?.state === 'completed') return;
    const timer = window.setInterval(() => {
      void onboardingApi<StoredOnboarding>(false, {action:'load', ...(token ? {token} : {case_id:c?.id})}).then(result => setCase(result)).catch(() => { /* Keep the explicit refresh available. */ });
    }, 5000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 120000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [user?.id, token, c?.id, packet?.state]);
  // Schritt 1 meldet Fehler direkt unter den Kästchen, nicht oben auf der Seite.
  const verifyStep = async (work: () => Promise<void>) => { setBusy(true); setCodeError(''); try { await work(); } catch (e) { setCodeError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); } };
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const requestCode = () => verifyStep(async () => {
    const result = await onboardingApi<{ sent: boolean; masked_email: string; code_length?: number }>(false, { action: 'code', ...codeIdentity });
    setSentTo(result.masked_email); setCodeLength(Math.min(10, Math.max(6, result.code_length ?? 6)));
    setPhase('code'); setCode(''); setCooldown(60);
  });
  // Prüft von selbst, sobald die letzte Ziffer steht. Ein falscher Code leert die Kästchen.
  const confirmCode = (value: string) => verifyStep(async () => {
    try {
      const session = await onboardingApi<CodeSession>(false, { action: 'verify', ...codeIdentity, code: value });
      const { error } = await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      if (error) throw error;
    } catch (e) { setCode(''); throw e; }
    setCode(''); setPhase('start');
  });
  const savePassword = () => run(async () => {
    if (password !== repeat) throw new Error('Die beiden Eingaben stimmen nicht überein.');
    const { error } = await supabase.auth.updateUser({ password }); if (error) throw error;
    window.location.assign('/recruiter');
  });
  const startSignature = () => run(async () => {
    const result=await onboardingApi<{url?:string;remote?:boolean}>(false,{action:'start',...identity});
    if(result.url) { window.location.assign(result.url); return; }
    await load(); setMessage(result.remote ? 'Der persönliche DocuSign-Zugang wurde für die benannte Person angefordert.' : 'Der Vertragsvorgang wurde aktualisiert.');
  });
  const document = (role: string) => run(async () => {
    const result = await onboardingApi<{ url: string }>(false, { action: 'document', ...identity, contract_id: packet?.id, document: role });
    window.location.assign(result.url);
  });
  const stage = !user || !c ? 0 : c.state === 'draft' ? 1 : packet?.recruiter_signed_at || packet?.state === 'completed' ? 3 : 2;
  const linkBlocked = !!token && (!peek || peek.status === 'expired' || peek.status === 'revoked');
  const titles = [peek?.name ? `Hallo ${peek.name}, schön, dass du dabei bist.` : token ? 'Schön, dass du dabei bist.' : 'Gute Recruiter verdienen gute Partner.', 'Deine Expertise. Unser gemeinsamer Start.', 'Dein Vertrag. Persönlich vorbereitet.', 'Dein nächster Schritt ist in guten Händen.'];
  const descriptions = [token ? 'Bestätige kurz deine E-Mail-Adresse. Danach warten deine vorbereiteten Angaben auf dich.' : 'Werde Teil unseres Recruiter-Netzwerks. Bestätige deine E-Mail-Adresse, ergänze deine Angaben und schließe deinen Vertrag digital ab.', 'Prüfe die vorbereiteten Angaben und ergänze, was noch fehlt. Du kannst deinen Entwurf speichern und später weitermachen.', 'Aus deinen bestätigten Angaben entsteht dein vollständiges Vertragspaket. Du prüfst es in Ruhe und unterschreibst digital mit DocuSign.', 'Deine Unterschrift ist eingegangen. Matchunt prüft deine Angaben, zeichnet gegen und schaltet dich frei. Darüber bekommst du eine Mail.'];
  const completedDescription = c?.activated ? 'Du bist freigeschaltet. Leg dein Passwort fest und starte im Dashboard.' : 'Der Vertrag ist von beiden Seiten unterzeichnet. Hier findest du deine Unterlagen. Sobald wir freigeschaltet haben, bekommst du eine Mail mit deinem Zugang.';
  return <OnboardingFrame stage={stage} title={titles[stage]} description={packet?.state === 'completed' ? completedDescription : descriptions[stage]} email={user?.email}
    accountAction={user && <button className="mh-link" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; })}>Nicht du? Neu starten</button>}>
    {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
    {message && <p role="status" className="mh-alert">{message}</p>}
    {!authReady ? <section className="mh-panel" role="status">Dein Zugang wird geprüft …</section> : !user ? <section className="mh-panel">
      <div className="mh-verify">
        <div className="mh-verify-icon"><Mail size={20}/></div>
        <div>
          <h2>{phase === 'code' ? 'Code eingeben' : token ? (peek?.name ? `Hallo ${peek.name}` : 'Deine Einladung') : 'E-Mail-Adresse bestätigen'}</h2>
          <p className="mh-muted">{phase === 'code' ? <>Wir haben einen Code an <strong>{sentTo}</strong> geschickt.</> : token ? (peek ? <>Wir senden einen Code an <strong>{peek.masked_email}</strong>. Kein Passwort nötig.</> : 'Deine Einladung wird geladen …') : 'Wir senden dir einen Code. Kein Passwort nötig.'}</p>
        </div>
        {token && peek?.status === 'expired' && <p role="alert" className="mh-alert mh-error">Dein Einladungslink ist abgelaufen. Sag uns kurz Bescheid, wir schicken dir einen neuen.</p>}
        {token && peek?.status === 'revoked' && <p role="alert" className="mh-alert mh-error">Dieser Einladungslink wurde zurückgezogen. Sag uns kurz Bescheid, dann bekommst du einen neuen.</p>}
        {phase === 'start' ? <form className="mh-stack" onSubmit={e => { e.preventDefault(); void requestCode(); }}>
          {!token && <label className="mh-field">E-Mail-Adresse<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
          <button className="mh-button mh-primary mh-full" type="submit" disabled={busy || linkBlocked}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>}{busy ? 'Einen Moment …' : 'Code senden'}</button>
          {codeError && <p role="alert" className="mh-alert mh-error">{codeError}</p>}
          {token && peek?.status === 'claimed' && <p className="mh-muted mh-verify-hint">Du hast schon begonnen. Mit dem Code machst du genau dort weiter.</p>}
        </form> : <>
          <div className="mh-otp" data-length={codeLength}>
            <InputOTP maxLength={codeLength} value={code} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" disabled={busy} onChange={value => { setCode(value); setCodeError(''); if (value.length === codeLength) void confirmCode(value); }}>
              <InputOTPGroup>{Array.from({ length: codeLength }, (_, i) => <InputOTPSlot key={i} index={i} className="mh-otp-slot"/>)}</InputOTPGroup>
            </InputOTP>
          </div>
          {busy && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>Wird geprüft</p>}
          <div className="mh-verify-row">
            {token ? <span/> : <button type="button" className="mh-link" disabled={busy} onClick={() => { setPhase('start'); setCode(''); setCodeError(''); }}>Adresse ändern</button>}
            <button type="button" className="mh-link" disabled={busy || cooldown > 0} onClick={() => void requestCode()}>{cooldown > 0 ? `Erneut senden in ${cooldown} s` : 'Code erneut senden'}</button>
          </div>
          {codeError && <p role="alert" className="mh-alert mh-error">{codeError}</p>}
          <p className="mh-muted mh-verify-hint">Der Code ist kurz gültig. Schau auch im Spam-Ordner nach.</p>
        </>}
      </div>
    </section> : !c ? <section className="mh-panel mh-stack">
      <div className="mh-panel-head"><CheckCircle2 size={23}/><div><h2>Deine E-Mail-Adresse ist bestätigt.</h2><p>Ein begonnener Vorgang oder eine gültige Einladung für diese Adresse wird übernommen.</p></div></div>
      {!token && <><h3>Wie möchtest du mit uns zusammenarbeiten?</h3><div className="mh-choices">{[['individual', 'Einzelrecruiter', 'Ich starte als selbstständiger Recruiting-Partner.'], ['agency', 'Recruiting-Agentur', 'Ich vertrete eine Agentur.']].map(([value, label, detail]) => <button key={value} className="mh-choice" type="button" disabled={busy} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'agency' ? <Building2 size={21}/> : <UserRound size={21}/>}<span><strong>{label}</strong><small>{detail}</small></span></button>)}</div></>}
      <div className="mh-note"><ShieldCheck size={21}/><p>Als Nächstes bestätigst du deine Geschäftsdaten. Deine Vertragsunterschrift folgt erst nach deiner Prüfung in DocuSign.</p></div>
      <div className="mh-actions"><button className="mh-button mh-primary" disabled={busy} onClick={() => void run(async () => {
        if (token) { await load(); return; }
        const result = await onboardingApi<{onboarding: StoredOnboarding}>(false, { action: 'begin', kind }); setCase(result.onboarding); setProfile(result.onboarding.profile);
      })}>{busy ? 'Onboarding wird geladen …' : token ? 'Einladung erneut laden' : 'Onboarding starten / fortsetzen'}<ArrowRight size={16}/></button></div>
    </section> : <>
      {c.feedback && <div className="mh-alert"><strong>Eine Ergänzung ist erforderlich</strong><p className="whitespace-pre-wrap">{c.feedback}</p></div>}
      {c.state === 'draft' ? <RecruiterProfileForm profile={profile} kind={c.kind} busy={busy} onChange={setProfile}
        onSave={() => run(async () => { await load('save', { revision: c.revision, profile }); setMessage('Entwurf gespeichert. Du kannst später weiterarbeiten.'); })}
        onSubmit={() => run(async () => { await load('submit', { revision: c.revision, profile }); setMessage('Deine Angaben sind bestätigt. Du kannst jetzt deinen Vertrag erstellen und unterschreiben.'); })}/>
      : <section className="mh-panel mh-stack">
        <div className="mh-panel-head">{stage === 3 ? <CheckCircle2 size={24}/> : <FileText size={24}/>}<div><h2>{packet?.state === 'completed' ? (c.activated ? 'Du bist freigeschaltet.' : 'Dein Vertrag ist unterzeichnet.') : packet?.recruiter_signed_at ? 'Danke für dein Vertrauen.' : 'Bereit für deine Unterschrift.'}</h2><p>{c.activated && packet?.state === 'completed' ? 'Freigeschaltet' : stateLabels[packet?.state || c.state]}</p></div></div>
        <div className="mh-note"><ShieldCheck size={21}/><p>{packet?.state === 'completed' ? (c.activated ? 'Beide Unterschriften sind bestätigt und dein Zugang ist frei. Dein Vertragspaket und das Abschlusszertifikat findest du hier jederzeit.' : 'Beide Unterschriften sind bestätigt. Dein Vertragspaket und das Abschlusszertifikat stehen bereit. Sobald wir freigeschaltet haben, bekommst du eine Mail.') : packet?.recruiter_signed_at ? 'Deine Unterschrift ist bestätigt. Matchunt prüft deine Angaben und zeichnet anschließend ausdrücklich gegen.' : 'Ein persönlicher Rahmenvertrag, sechs Anlagen und eine digitale Unterschrift. Du kannst das gesamte Paket vor der Unterschrift in DocuSign prüfen.'}</p></div>
        {(!packet || ['prepared', 'creating'].includes(packet.state)) && <button className="mh-button mh-primary" disabled={busy} onClick={() => void startSignature()}>{busy ? 'Vertrag wird vorbereitet …' : 'Vertrag erstellen & mit DocuSign unterschreiben'}<ArrowUpRight size={17}/></button>}
        {packet && <>
          <details><summary>Dein Vertragspaket · {packet.package_version}</summary>{packet.documents.map(d => <button className="mh-doc" key={d.role} disabled={busy} onClick={() => void document(d.role)}><FileText size={19}/><span>{documentLabels[d.role] || d.role}<small>Persönliches Vertragsdokument</small></span><ArrowUpRight size={16}/></button>)}</details>
          {packet.state === 'sent' && <>{!packet.recruiter_signed_at && (packet.recruiter_client_user_id === user.id ? <button className="mh-button mh-primary" disabled={busy} onClick={() => void run(async () => { const { url } = await onboardingApi<{url: string}>(false, { action: 'signature', ...identity, contract_id: packet.id }); window.location.assign(url); })}>Mit DocuSign unterschreiben<ArrowUpRight size={17}/></button> : <p>Die benannte unterzeichnende Person erhält ihren persönlichen Zugang direkt von DocuSign per E-Mail. Danach folgt die Gegenzeichnung durch Matchunt.</p>)}<button className="mh-button" disabled={busy} onClick={() => void run(() => load('sync', { contract_id: packet.id }))}><RefreshCw size={15}/>Signaturstatus aktualisieren</button></>}
          {packet.state === 'completed' && <div className="mh-stack">
            <button className="mh-button mh-primary" disabled={busy} onClick={() => void document('signed')}>Unterzeichneten Vertrag öffnen<ArrowUpRight size={16}/></button>
            <button className="mh-button" disabled={busy} onClick={() => void document('certificate')}>Abschlusszertifikat öffnen</button>
            {c.activated ? <>
              <div className="mh-note"><KeyRound size={20}/><p>Leg jetzt dein Passwort fest, damit du dich künftig direkt anmelden kannst.</p></div>
              <form className="mh-stack mh-auth" onSubmit={e => { e.preventDefault(); void savePassword(); }}>
                <label className="mh-field">Passwort<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><small>Mindestens 8 Zeichen.</small></label>
                <label className="mh-field">Passwort wiederholen<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e => setRepeat(e.target.value)}/></label>
                <button className="mh-button mh-primary" type="submit" disabled={busy}>Passwort speichern & zum Dashboard<ArrowRight size={16}/></button>
                <a href="/recruiter" className="mh-link">Ich habe schon ein Passwort. Zum Dashboard<ArrowRight size={14}/></a>
              </form>
            </> : <p className="mh-muted">Sobald wir freigeschaltet haben, bekommst du eine Mail mit deinem Zugang.</p>}
          </div>}
          {packet.state === 'manual_review' && <p className="mh-alert">Die Unterschriftsfrist muss durch das Matchunt-Team geklärt werden.</p>}
        </>}
        <button className="mh-link" disabled={busy} onClick={() => void run(() => load())}><RefreshCw size={14}/>Stand aktualisieren</button>
      </section>}
    </>}
  </OnboardingFrame>;
}

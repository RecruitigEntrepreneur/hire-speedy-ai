import RecruiterProfileForm from '@/components/onboarding/RecruiterProfileForm';
import OnboardingFrame from '@/components/onboarding/OnboardingFrame';
import { ArrowRight, Building2, UserRound, FileText, ArrowUpRight, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi, documentLabels, stateLabels, type StoredOnboarding, type RecruiterProfile } from '@/lib/recruiterOnboardingApi';
import { cleanProfile } from '../../../supabase/functions/_shared/recruiter-contract-policy';

// The link identifies the initial invitation. Later visits resume through the
// confirmed account, including email confirmation on another device.
function invitationToken() {
  return location.pathname.endsWith('/invitation') ? location.hash.slice(1) : '';
}
export default function RecruiterInvitation() {
  const [token] = useState(invitationToken);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signup, setSignup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('individual');
  const [c, setCase] = useState<StoredOnboarding | null>(null);
  const [profile, setProfile] = useState<RecruiterProfile>(() => cleanProfile({}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(() => new URLSearchParams(location.search).has('event') ? 'Willkommen zurück. Wir warten auf die bestätigte Rückmeldung von DocuSign. Ihre Rückkehr allein bestätigt noch keine Unterschrift.' : '');
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active) { setUser(data.session?.user ?? null); setAuthReady(true); } });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { setUser(session?.user ?? null); setAuthReady(true); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, []);
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
  const titles = ['Gute Recruiter verdienen gute Partner.', 'Deine Expertise. Unser gemeinsamer Start.', 'Dein Vertrag. Persönlich vorbereitet.', 'Dein nächster Schritt ist in guten Händen.'];
  const descriptions = [token ? 'Willkommen bei Matchunt. Richte deinen Zugang ein – die vorbereiteten Angaben aus deiner Einladung warten anschließend auf dich.' : 'Werde Teil unseres Recruiter-Netzwerks. Starte mit deinem Konto, ergänze deine Angaben und schließe deinen Vertrag digital ab.', 'Prüfe die vorbereiteten Angaben und ergänze, was noch fehlt. Du kannst deinen Entwurf speichern und später weitermachen.', 'Aus deinen bestätigten Angaben entsteht dein vollständiges Vertragspaket. Du prüfst es in Ruhe und unterschreibst digital mit DocuSign.', 'Deine Unterschrift ist eingegangen. Matchunt prüft deine Angaben, zeichnet gegen und bestätigt deine Freischaltung separat.'];
  return <OnboardingFrame stage={stage} title={titles[stage]} description={packet?.state === 'completed' ? 'Der Vertrag ist von beiden Seiten unterzeichnet. Hier findest du deine Unterlagen. Über die Freischaltung informiert dich das Matchunt-Team separat.' : descriptions[stage]} email={user?.email}
    accountAction={user && <button className="mh-link" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; })}>Konto wechseln</button>}>
    {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
    {message && <p role="status" className="mh-alert">{message}</p>}
    {!authReady ? <section className="mh-panel" role="status">Dein Zugang wird geprüft …</section> : !user ? <section className="mh-panel">
      <div className="mh-panel-head"><UserRound size={23}/><div><h2>{signup ? 'Dein persönlicher Zugang.' : 'Schön, dass du wieder da bist.'}</h2><p>{token ? 'Verwende die E-Mail-Adresse deiner Einladung.' : 'Mit deinem Konto kannst du jederzeit an dieser Stelle weitermachen.'}</p></div></div>
      <form className="mh-stack mh-auth" onSubmit={e => { e.preventDefault(); void run(async () => {
        if (signup) {
          const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role: 'recruiter' }, emailRedirectTo: `${location.origin}/recruiter/onboarding` } });
          if (result.error) throw result.error;
          setMessage('Bitte bestätige deine E-Mail-Adresse. Danach setzt du dein Onboarding mit diesem Konto fort; vorhandene Einladungsdaten werden übernommen.');
        } else {
          const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) throw result.error;
        }
        setPassword('');
      }); }}>
        {signup && <label className="mh-field">Vollständiger Name<input autoComplete="name" required value={name} onChange={e => setName(e.target.value)}/></label>}
        <label className="mh-field">E-Mail-Adresse<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>
        <label className="mh-field">Passwort<input autoComplete={signup ? 'new-password' : 'current-password'} type="password" minLength={signup ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)}/>{signup && <small>Mindestens 12 Zeichen.</small>}</label>
        <button className="mh-button mh-primary mh-full" type="submit" disabled={busy}>{busy ? 'Einen Moment …' : signup ? 'Konto erstellen & starten' : 'Anmelden & fortsetzen'}<ArrowRight size={16}/></button>
        <button className="mh-link" type="button" disabled={busy} onClick={() => { setSignup(!signup); setError(''); }}>{signup ? 'Du hast bereits ein Konto? Jetzt anmelden' : 'Du bist neu hier? Konto erstellen'}</button>
      </form>
    </section> : !c ? <section className="mh-panel mh-stack">
      <div className="mh-panel-head"><CheckCircle2 size={23}/><div><h2>Dein Konto ist der erste Schritt.</h2><p>Ein begonnener Vorgang oder eine gültige Einladung für deine bestätigte E-Mail-Adresse wird übernommen.</p></div></div>
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
        <div className="mh-panel-head">{stage === 3 ? <CheckCircle2 size={24}/> : <FileText size={24}/>}<div><h2>{packet?.state === 'completed' ? 'Dein Vertrag ist unterzeichnet.' : packet?.recruiter_signed_at ? 'Danke für dein Vertrauen.' : 'Bereit für deine Unterschrift.'}</h2><p>{stateLabels[packet?.state || c.state]}</p></div></div>
        <div className="mh-note"><ShieldCheck size={21}/><p>{packet?.state === 'completed' ? 'Beide Unterschriften sind bestätigt. Dein Vertragspaket und das Abschlusszertifikat stehen bereit. Das Matchunt-Team informiert dich separat über die Freischaltung.' : packet?.recruiter_signed_at ? 'Deine Unterschrift ist bestätigt. Matchunt prüft deine Angaben und zeichnet anschließend ausdrücklich gegen.' : 'Ein persönlicher Rahmenvertrag, sechs Anlagen und eine digitale Unterschrift. Du kannst das gesamte Paket vor der Unterschrift in DocuSign prüfen.'}</p></div>
        {(!packet || ['prepared', 'creating'].includes(packet.state)) && <button className="mh-button mh-primary" disabled={busy} onClick={() => void startSignature()}>{busy ? 'Vertrag wird vorbereitet …' : 'Vertrag erstellen & mit DocuSign unterschreiben'}<ArrowUpRight size={17}/></button>}
        {packet && <>
          <details><summary>Dein Vertragspaket · {packet.package_version}</summary>{packet.documents.map(d => <button className="mh-doc" key={d.role} disabled={busy} onClick={() => void document(d.role)}><FileText size={19}/><span>{documentLabels[d.role] || d.role}<small>Persönliches Vertragsdokument</small></span><ArrowUpRight size={16}/></button>)}</details>
          {packet.state === 'sent' && <>{!packet.recruiter_signed_at && (packet.recruiter_client_user_id === user.id ? <button className="mh-button mh-primary" disabled={busy} onClick={() => void run(async () => { const { url } = await onboardingApi<{url: string}>(false, { action: 'signature', ...identity, contract_id: packet.id }); window.location.assign(url); })}>Mit DocuSign unterschreiben<ArrowUpRight size={17}/></button> : <p>Die benannte unterzeichnende Person erhält ihren persönlichen Zugang direkt von DocuSign per E-Mail. Danach folgt die Gegenzeichnung durch Matchunt.</p>)}<button className="mh-button" disabled={busy} onClick={() => void run(() => load('sync', { contract_id: packet.id }))}><RefreshCw size={15}/>Signaturstatus aktualisieren</button></>}
          {packet.state === 'completed' && <div className="mh-stack"><button className="mh-button mh-primary" disabled={busy} onClick={() => void document('signed')}>Unterzeichneten Vertrag öffnen<ArrowUpRight size={16}/></button><button className="mh-button" disabled={busy} onClick={() => void document('certificate')}>Abschlusszertifikat öffnen</button><a href="/recruiter" className="mh-link">Zum Dashboard – nach Freischaltung<ArrowRight size={14}/></a></div>}
          {packet.state === 'manual_review' && <p className="mh-alert">Die Unterschriftsfrist muss durch das Matchunt-Team geklärt werden.</p>}
        </>}
        <button className="mh-link" disabled={busy} onClick={() => void run(() => load())}><RefreshCw size={14}/>Stand aktualisieren</button>
      </section>}
    </>}
  </OnboardingFrame>;
}

import ContractDetailsFields from '@/components/onboarding/ContractDetailsFields';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { onboardingApi, profileLabels, documentLabels, stateLabels, type StoredOnboarding, type RecruiterProfile } from '@/lib/recruiterOnboardingApi';
import { cleanProfile } from '../../../supabase/functions/_shared/recruiter-contract-policy';

// Session storage preserves the invitation when the auth callback replaces the
// fragment. The token never goes into query parameters, analytics or logs.
const TOKEN_KEY = 'matchunt.recruiter.invitation.token';
function invitationToken() {
  const hash = location.hash.slice(1);
  if (/^[A-Za-z0-9_-]{43}$/.test(hash)) { try { sessionStorage.setItem(TOKEN_KEY, hash); } catch { /* In-memory navigation still works. */ } return hash; }
  try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}
export default function RecruiterInvitation() {
  const [token] = useState(invitationToken);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
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
    if (!user?.id || !token) return;
    let active = true;
    setBusy(true);
    void onboardingApi<StoredOnboarding>(false, { action: 'load', token }).then(result => {
      if (active) { setCase(result); setProfile(result.profile); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : 'Einladung konnte nicht geladen werden.'); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [user?.id, token]);
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); } };
  const load = async (action = 'load', extra: Record<string, unknown> = {}) => {
    const result = await onboardingApi<StoredOnboarding>(false, { action, token, ...extra }); setCase(result); setProfile(result.profile);
  };
  const packet = c?.contracts.find(p => !['declined','voided'].includes(p.state));
  useEffect(() => {
    if (!user?.id || !token || !new URLSearchParams(location.search).has('event') || packet?.state === 'completed') return;
    const timer = window.setInterval(() => {
      void onboardingApi<StoredOnboarding>(false, {action:'load', token}).then(result => setCase(result)).catch(() => { /* Keep the explicit refresh available. */ });
    }, 5000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 120000);
    return () => { window.clearInterval(timer); window.clearTimeout(stop); };
  }, [user?.id, token, packet?.state]);
  const startSignature = () => run(async () => {
    const result=await onboardingApi<{url?:string;remote?:boolean}>(false,{action:'start',token});
    if(result.url) { window.location.assign(result.url); return; }
    await load(); setMessage(result.remote ? 'Der persönliche DocuSign-Zugang wurde für die benannte Person angefordert.' : 'Der Vertragsvorgang wurde aktualisiert.');
  });
  const document = (role: string) => run(async () => {
    const result = await onboardingApi<{ url: string }>(false, { action: 'document', token, contract_id: packet?.id, document: role });
    window.location.assign(result.url);
  });
  return <main className="min-h-screen bg-muted/30 px-4 py-8 sm:py-14"><div className="mx-auto max-w-3xl space-y-6">
    <a href="/" className="text-xl font-semibold tracking-tight">Matchunt<span className="text-primary">.ai</span></a>
    <header><p className="text-sm text-muted-foreground">Ihr persönlicher Einstieg</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Willkommen im Recruiter-Netzwerk.</h1><p className="mt-3 text-muted-foreground">Prüfen Sie Ihre Angaben. Wir begleiten Sie durch die Prüfung und den Vertragsabschluss.</p></header>
    <ol className="grid grid-cols-3 gap-2 text-sm"><li className="rounded-md border p-3">1 · Zugang bestätigen</li><li className="rounded-md border p-3">2 · Angaben prüfen</li><li className="rounded-md border p-3">3 · Vertrag & nächste Schritte</li></ol>
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">{error}</p>}
    {message && <p role="status" className="rounded-md border bg-background p-4 text-sm">{message}</p>}
    {!token ? <Card><CardContent className="pt-6">Bitte öffnen Sie den persönlichen Link aus Ihrer Einladung erneut.</CardContent></Card> : !authReady ? <p role="status">Zugang wird geprüft …</p> : !user ? <Card><CardHeader><CardTitle>{signup ? 'Konto einrichten' : 'Zugang bestätigen'}</CardTitle><p className="text-sm text-muted-foreground">Verwenden Sie bitte die E-Mail-Adresse, an die Ihre Einladung gesendet wurde. Ihre vorbereiteten Angaben werden erst danach angezeigt.</p></CardHeader><CardContent>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => {
        if (signup) {
          const result = await supabase.auth.signUp({ email, password, options: { data: { full_name: name, role: 'recruiter' }, emailRedirectTo: `${location.origin}/recruiter/invitation` } });
          if (result.error) throw result.error;
          setMessage('Bitte bestätigen Sie Ihre E-Mail-Adresse und öffnen Sie anschließend Ihren persönlichen Einladungslink erneut.');
        } else {
          const result = await supabase.auth.signInWithPassword({ email, password }); if (result.error) throw result.error;
        }
        setPassword('');
      }); }}>
        {signup && <label className="block space-y-1 text-sm">Vollständiger Name<Input autoComplete="name" required value={name} onChange={e => setName(e.target.value)}/></label>}
        <label className="block space-y-1 text-sm">E-Mail<Input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label><label className="block space-y-1 text-sm">Passwort<Input autoComplete={signup ? 'new-password' : 'current-password'} type="password" minLength={signup ? 12 : undefined} required value={password} onChange={e => setPassword(e.target.value)}/></label>
        <Button className="w-full" type="submit" disabled={busy}>{signup ? 'Konto erstellen' : 'Anmelden'}</Button><Button className="w-full" variant="ghost" type="button" onClick={() => setSignup(!signup)}>{signup ? 'Ich habe bereits ein Konto' : 'Ich benötige ein neues Konto'}</Button>
      </form>
    </CardContent></Card> : <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>Angemeldet als {user.email}</span><Button variant="ghost" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; })}>Konto wechseln</Button></div>
      {!c ? <Button disabled={busy} onClick={() => void run(() => load())}>{busy ? 'Einladung wird geladen …' : 'Einladung erneut laden'}</Button> : <Card><CardHeader><CardTitle>{stateLabels[c.state]}</CardTitle><p className="text-sm text-muted-foreground">{c.email}</p></CardHeader><CardContent className="space-y-5">
        {c.feedback && <div className="rounded-md bg-amber-50 p-4 text-sm text-amber-950"><strong>Eine Ergänzung ist erforderlich</strong><p className="mt-2 whitespace-pre-wrap">{c.feedback}</p></div>}
        {c.state === 'draft' ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); void run(async () => { await load('submit', { revision: c.revision, profile }); setMessage('Ihre Angaben sind bestätigt. Sie können jetzt Ihren Vertrag erstellen und unterschreiben.'); }); }}>
          <div className="grid gap-4 sm:grid-cols-2">{Object.entries(profileLabels).filter(([key]) => !['taxStatus','authorityDeclared'].includes(key)).map(([key,label]) => <label key={key} className="block space-y-1 text-sm">{label}<Input type={key === 'signerEmail' ? 'email' : 'text'} required={!['specialty','region'].includes(key)} value={String(profile[key as keyof RecruiterProfile])} onChange={e => setProfile({ ...profile, [key]: e.target.value })}/></label>)}</div>
          <label className="block space-y-1 text-sm">Steuerstatus<select required className="flex h-10 w-full rounded-md border bg-background px-3" value={profile.taxStatus} onChange={e => setProfile({ ...profile, taxStatus: e.target.value })}><option value="">Bitte wählen</option><option value="regular">Regulär umsatzsteuerpflichtig</option><option value="small_business">Kleinunternehmerregelung</option><option value="foreign">Ausländischer Steuerstatus · Prüfung erforderlich</option></select></label>
          <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" required checked={profile.authorityDeclared} onChange={e => setProfile({ ...profile, authorityDeclared: e.target.checked })}/>Die benannte Person ist zur Unterzeichnung für den angegebenen Vertragspartner berechtigt. Matchunt prüft die erforderlichen Nachweise.</label>
          <ContractDetailsFields value={profile.contractDetails} kind={c.kind} onChange={contractDetails => setProfile({...profile,contractDetails})}/><p className="text-sm text-muted-foreground">Wenn Sie selbst unterschreiben, öffnen Sie DocuSign hier direkt. Eine andere unterzeichnende Person erhält ihren persönlichen Zugang per E-Mail.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} type="submit">Angaben bestätigen und weiter</Button><Button disabled={busy} type="button" variant="outline" onClick={() => void run(async () => { await load('save', { revision: c.revision, profile }); setMessage('Entwurf gespeichert. Sie können später weiterarbeiten.'); })}>Entwurf speichern</Button></div>
        </form> : <><p>{packet?.recruiter_signed_at ? 'Ihre Unterschrift ist eingegangen. Matchunt prüft Ihre Angaben und zeichnet anschließend ausdrücklich gegen.' : 'Ihre Angaben sind bestätigt. Daraus erstellen wir Ihren persönlichen Vertrag mit allen Anlagen.'}</p>{(!packet || ['prepared','creating'].includes(packet.state)) && <Button disabled={busy} onClick={() => void startSignature()}>{busy ? 'Vertrag wird vorbereitet …' : 'Vertrag erstellen und mit DocuSign unterschreiben'}</Button>}<Button variant="outline" disabled={busy} onClick={() => void run(() => load())}>Stand aktualisieren</Button></>}

        {packet && <section className="space-y-3 border-t pt-5"><h2 className="text-lg font-semibold">Ihr Vertragspaket · {packet.package_version}</h2><p className="text-sm">{stateLabels[packet.state]}</p><details><summary className="cursor-pointer text-sm font-medium">Alle Vertragsunterlagen ansehen</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{packet.documents.map(d => <Button key={d.role} variant="outline" disabled={busy} onClick={() => void document(d.role)}>{documentLabels[d.role]}</Button>)}</div></details>
          {packet.state === 'sent' && <>{packet.recruiter_signed_at ? <p className="text-sm">Ihre Unterschrift ist bestätigt. Matchunt zeichnet als Nächstes gegen.</p> : packet.recruiter_client_user_id === user.id ? <><p className="text-sm">Einmal digital unterschreiben: Rahmenvertrag und sechs Anlagen. Sie können das vollständige Paket in DocuSign prüfen, bevor Sie unterschreiben.</p><Button disabled={busy} onClick={() => void run(async () => { const { url } = await onboardingApi<{ url: string }>(false, { action: 'signature', token, contract_id: packet.id }); window.location.assign(url); })}>Mit DocuSign unterschreiben</Button></> : <p className="text-sm">Die benannte unterzeichnende Person erhält ihren eigenen Zugang direkt von DocuSign. Danach folgt die Gegenzeichnung durch Matchunt.</p>}<Button variant="outline" disabled={busy} onClick={() => void run(() => load('sync', { contract_id: packet.id }))}>Signaturstatus aktualisieren</Button></>}
          {packet.state === 'completed' && <><p className="text-sm">Beide Unterschriften sind bestätigt. Ihr Vertragspaket und das Abschlusszertifikat stehen zum Download bereit. Über die Freischaltung Ihres Zugangs informiert Sie das Matchunt-Team separat.</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void document('signed')}>Unterzeichneten Vertrag öffnen</Button><Button variant="outline" disabled={busy} onClick={() => void document('certificate')}>Abschlusszertifikat öffnen</Button></div></>}
          {packet.state === 'manual_review' && <p className="text-sm">Die Unterschriftsfrist muss durch das Matchunt-Team geklärt werden.</p>}
        </section>}
      </CardContent></Card>}
    </>}
    <footer className="flex gap-4 text-sm text-muted-foreground"><a href="/impressum">Impressum</a><a href="/datenschutz">Datenschutz</a></footer>
  </div></main>;
}

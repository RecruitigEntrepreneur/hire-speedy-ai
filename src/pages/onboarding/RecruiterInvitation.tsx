import RecruiterProfileForm from '@/components/onboarding/RecruiterProfileForm';
import OnboardingFrame from '@/components/onboarding/OnboardingFrame';
import { ArrowRight, Building2, UserRound, FileText, ArrowUpRight, ShieldCheck, CheckCircle2, RefreshCw, Mail, Loader2, KeyRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { onboardingApi, documentLabels, stateLabels, type StoredOnboarding, type RecruiterProfile, type InvitationPeek, type CodeSession } from '@/lib/recruiterOnboardingApi';
import { PASSWORD_SET_KEY } from '@/lib/recruiterLogin';
import { applyLinkLanguage } from '@/i18n';
import { cleanProfile } from '../../../supabase/functions/_shared/recruiter-contract-policy';
import type { CompanySuggestion } from '../../../supabase/functions/_shared/recruiter-company';

// Der Link identifiziert die Einladung. Angemeldet wird per Code an die
// Einladungsadresse, ohne Konto und Passwort. Spätere Besuche laufen über die
// bestätigte Sitzung, auch auf einem anderen Gerät.
function invitationToken() {
  return location.pathname.endsWith('/invitation') ? location.hash.slice(1) : '';
}
const NS = 'recruiterFunnel';
const strong = { strong: <strong/> };
// Öffentlicher Link (?via=<kennung>): Die Kennung bleibt für diese Sitzung gemerkt
// und geht bei Code, Prüfung und Start mit, auch wenn die Adresse sie verliert.
const VIA_KEY = 'matchunt-recruiter-via';
function viaFromUrl() {
  try { return new URLSearchParams(location.search).get('via')?.trim() || ''; } catch { return ''; }
}
function rememberedVia() {
  const fromUrl = viaFromUrl();
  try {
    if (fromUrl) { sessionStorage.setItem(VIA_KEY, fromUrl); return fromUrl; }
    return sessionStorage.getItem(VIA_KEY) || '';
  } catch { return fromUrl; }
}
export default function RecruiterInvitation() {
  const { t } = useTranslation(NS);
  const [token] = useState(invitationToken);
  const [via] = useState(() => invitationToken() ? '' : rememberedVia());
  const viaChecked = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [peek, setPeek] = useState<InvitationPeek | null>(null);
  const [phase, setPhase] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeLength, setCodeLength] = useState(6);
  const [codeError, setCodeError] = useState('');
  const [sentTo, setSentTo] = useState('');
  // Für welches Konto der Vorgang schon geladen wurde. Bis dahin zeigt die Seite
  // einen Ladezustand statt für einen Wimpernschlag „Onboarding starten“.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [kind, setKind] = useState('individual');
  const [c, setCase] = useState<StoredOnboarding | null>(null);
  const [profile, setProfile] = useState<RecruiterProfile>(() => cleanProfile({}));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  // Rückkehr von DocuSign: Der Hinweis steht, bis die nächste Aktion ihn ablöst.
  const [returned, setReturned] = useState(() => new URLSearchParams(location.search).has('event'));
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
    void onboardingApi<InvitationPeek>(false, { action: 'peek', token }).then(result => { if (active) { setPeek(result); void applyLinkLanguage(result.language); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : t('invitation.loadFailed')); });
    return () => { active = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  // Öffentlicher Link: Seine Sprache gilt, solange niemand selbst gewählt hat.
  useEffect(() => {
    if (token || viaChecked.current) return;
    const fromUrl = viaFromUrl();
    if (!fromUrl) return;
    viaChecked.current = true;
    void onboardingApi<{ valid: boolean; language: string | null }>(false, { action: 'link', via: fromUrl })
      .then(result => applyLinkLanguage(result?.language))
      .catch(() => { /* Der Server kennt die Aktion evtl. noch nicht; ohne Link-Sprache geht es weiter. */ });
  }, [token]);
  useEffect(() => {
    setCase(null); setError('');
    const userId = user?.id;
    if (!userId) return;
    let active = true;
    setBusy(true);
    void (token ? onboardingApi<StoredOnboarding>(false, { action: 'load', token }) : onboardingApi<{onboarding: StoredOnboarding | null}>(false, { action: 'resume' }).then(result => result.onboarding)).then(result => {
      if (active) { setCase(result); if (result) setProfile(result.profile); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : t('invitation.loadFailed')); }).finally(() => { if (active) { setBusy(false); setLoadedFor(userId); } });
    return () => { active = false; };
  }, [user?.id, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); setReturned(false); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : t('common.requestFailed')); } finally { setBusy(false); } };
  const identity = token ? { token } : { case_id: c?.id };
  // Wohin der Code geht: bei Einladungen entscheidet der Server, sonst die eingetippte Adresse.
  const codeIdentity = token ? { token } : { email, ...(via ? { via } : {}) };
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
  const verifyStep = async (work: () => Promise<void>) => { setBusy(true); setCodeError(''); try { await work(); } catch (e) { setCodeError(e instanceof Error ? e.message : t('common.requestFailed')); } finally { setBusy(false); } };
  const requestCode = () => verifyStep(async () => {
    const result = await onboardingApi<{ sent: boolean; masked_email: string; code_length?: number }>(false, { action: 'code', ...codeIdentity });
    setSentTo(result.masked_email); setCodeLength(Math.min(10, Math.max(6, result.code_length ?? 6)));
    setPhase('code'); setCode('');
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
    if (password !== repeat) throw new Error(t('common.passwordMismatch'));
    // Merker für /recruiter/login: Wer hier schon ein Passwort festgelegt hat, wird dort nicht erneut gefragt.
    const { error } = await supabase.auth.updateUser({ password, data: { [PASSWORD_SET_KEY]: new Date().toISOString() } }); if (error) throw error;
    window.location.assign('/recruiter');
  });
  const startSignature = () => run(async () => {
    const result=await onboardingApi<{url?:string;remote?:boolean}>(false,{action:'start',...identity});
    if(result.url) { window.location.assign(result.url); return; }
    await load(); setMessage(t(result.remote ? 'invitation.remoteRequested' : 'invitation.contractUpdated'));
  });
  const document = (role: string) => run(async () => {
    const result = await onboardingApi<{ url: string }>(false, { action: 'document', ...identity, contract_id: packet?.id, document: role });
    window.location.assign(result.url);
  });
  const stage = !user || !c ? 0 : c.state === 'draft' ? 1 : packet?.recruiter_signed_at || packet?.state === 'completed' ? 3 : 2;
  const linkBlocked = !!token && (!peek || peek.status === 'expired' || peek.status === 'revoked');
  const titles = [peek?.name ? t('invitation.title.helloName', { name: peek.name }) : token ? t('invitation.title.invited') : t('invitation.title.open'), t('invitation.title.details'), t('invitation.title.contract'), t('invitation.title.review')];
  const descriptions = [token ? t('invitation.description.invited') : t('invitation.description.open'), t('invitation.description.details'), t('invitation.description.contract'), t('invitation.description.review')];
  const completedDescription = c?.activated ? t('invitation.description.activated') : t('invitation.description.completed');
  const stateLabel = (state: string) => t(`states.${state}`, { defaultValue: stateLabels[state] ?? '' });
  const documentLabel = (role: string) => t(`documents.${role}`, { defaultValue: documentLabels[role] || role });
  return <OnboardingFrame stage={stage} title={titles[stage]} description={packet?.state === 'completed' ? completedDescription : descriptions[stage]} email={user?.email}
    accountAction={user && <button className="mh-link" disabled={busy} onClick={() => void run(async () => { const { error } = await supabase.auth.signOut(); if (error) throw error; })}>{t('invitation.restart')}</button>}>
    {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
    {(message || returned) && <p role="status" className="mh-alert">{message || t('invitation.eventReturn')}</p>}
    {!authReady ? <section className="mh-panel" role="status">{t('invitation.checkingAccess')}</section> : !user ? <section className="mh-panel">
      <div className="mh-verify">
        <div className="mh-verify-icon"><Mail size={20}/></div>
        <div>
          <h2>{phase === 'code' ? t('common.enterCode') : token ? (peek?.name ? t('invitation.verify.helloName', { name: peek.name }) : t('invitation.verify.yourInvitation')) : t('invitation.verify.confirmEmail')}</h2>
          <p className="mh-muted">{phase === 'code' ? <Trans ns={NS} i18nKey="invitation.verify.sentTo" values={{ email: sentTo }} components={strong}/> : token ? (peek ? <Trans ns={NS} i18nKey="invitation.verify.willSendTo" values={{ email: peek.masked_email }} components={strong}/> : t('invitation.verify.loadingInvitation')) : t('invitation.verify.willSend')}</p>
        </div>
        {token && peek?.status === 'expired' && <p role="alert" className="mh-alert mh-error">{t('invitation.verify.expired')}</p>}
        {token && peek?.status === 'revoked' && <p role="alert" className="mh-alert mh-error">{t('invitation.verify.revoked')}</p>}
        {phase === 'start' ? <form className="mh-stack" onSubmit={e => { e.preventDefault(); void requestCode(); }}>
          {!token && <label className="mh-field">{t('common.emailAddress')}<input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)}/></label>}
          <button className="mh-button mh-primary mh-full" type="submit" disabled={busy || linkBlocked}>{busy ? <Loader2 size={16} className="animate-spin"/> : <Mail size={16}/>}{busy ? t('common.oneMoment') : t('common.sendCode')}</button>
          {codeError && <p role="alert" className="mh-alert mh-error">{codeError}</p>}
          {token && peek?.status === 'claimed' && <p className="mh-muted mh-verify-hint">{t('invitation.verify.claimed')}</p>}
        </form> : <>
          <div className="mh-otp" data-length={codeLength}>
            <InputOTP maxLength={codeLength} value={code} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" disabled={busy} onChange={value => { setCode(value); setCodeError(''); if (value.length === codeLength) void confirmCode(value); }}>
              <InputOTPGroup>{Array.from({ length: codeLength }, (_, i) => <InputOTPSlot key={i} index={i} className="mh-otp-slot"/>)}</InputOTPGroup>
            </InputOTP>
          </div>
          {busy && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>{t('common.checking')}</p>}
          <div className="mh-verify-row">
            {token ? <span/> : <button type="button" className="mh-link" disabled={busy} onClick={() => { setPhase('start'); setCode(''); setCodeError(''); }}>{t('common.changeAddress')}</button>}
            <button type="button" className="mh-link" disabled={busy} onClick={() => void requestCode()}>{t('invitation.verify.resend')}</button>
          </div>
          {codeError && <p role="alert" className="mh-alert mh-error">{codeError}</p>}
          <p className="mh-muted mh-verify-hint">{t('invitation.verify.validity')}</p>
        </>}
      </div>
    </section> : loadedFor !== user.id ? <section className="mh-panel" role="status">{t('invitation.loadingDetails')}</section> : !c ? <section className="mh-panel mh-stack">
      <div className="mh-panel-head"><CheckCircle2 size={23}/><div><h2>{t('invitation.confirmed.title')}</h2><p>{t('invitation.confirmed.text')}</p></div></div>
      {!token && <><h3>{t('invitation.confirmed.howTitle')}</h3><div className="mh-choices">{[['individual', t('invitation.confirmed.individual'), t('invitation.confirmed.individualText')], ['agency', t('invitation.confirmed.agency'), t('invitation.confirmed.agencyText')]].map(([value, label, detail]) => <button key={value} className="mh-choice" type="button" disabled={busy} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'agency' ? <Building2 size={21}/> : <UserRound size={21}/>}<span><strong>{label}</strong><small>{detail}</small></span></button>)}</div></>}
      <div className="mh-note"><ShieldCheck size={21}/><p>{t('invitation.confirmed.note')}</p></div>
      <div className="mh-actions"><button className="mh-button mh-primary" disabled={busy} onClick={() => void run(async () => {
        if (token) { await load(); return; }
        const result = await onboardingApi<{onboarding: StoredOnboarding}>(false, { action: 'begin', kind, ...(via ? { via } : {}) }); setCase(result.onboarding); setProfile(result.onboarding.profile);
      })}>{busy ? t('invitation.confirmed.loading') : token ? t('invitation.confirmed.reload') : t('invitation.confirmed.start')}<ArrowRight size={16}/></button></div>
    </section> : <>
      {c.feedback && <div className="mh-alert"><strong>{t('invitation.feedbackTitle')}</strong><p className="whitespace-pre-wrap">{c.feedback}</p></div>}
      {c.state === 'draft' ? <RecruiterProfileForm profile={profile} kind={c.kind} busy={busy} email={user.email ?? ''} onChange={setProfile}
        onEnrich={async website => (await onboardingApi<{ suggestion: CompanySuggestion }>(false, { action: 'enrich', ...identity, website })).suggestion}
        onSave={async (silent, snapshot) => {
          if (silent) {
            // Zwischenstand beim Weiterklicken: nur den Vorgang aktualisieren, die Eingabe nicht zurücksetzen.
            try { const result = await onboardingApi<StoredOnboarding>(false, { action: 'save', ...identity, revision: c.revision, profile: snapshot ?? profile }); setCase(result); }
            catch { /* Der nächste Schritt speichert erneut; Fehler zeigt das ausdrückliche Speichern. */ }
            return;
          }
          await run(async () => { await load('save', { revision: c.revision, profile }); setMessage(t('invitation.draftSaved')); });
        }}
        onSubmit={() => run(async () => { await load('submit', { revision: c.revision, profile }); setMessage(t('invitation.detailsConfirmed')); })}/>
      : <section className="mh-panel mh-stack">
        <div className="mh-panel-head">{stage === 3 ? <CheckCircle2 size={24}/> : <FileText size={24}/>}<div><h2>{packet?.state === 'completed' ? (c.activated ? t('invitation.contract.activatedTitle') : t('invitation.contract.signedTitle')) : packet?.recruiter_signed_at ? t('invitation.contract.thanksTitle') : t('invitation.contract.readyTitle')}</h2><p>{c.activated && packet?.state === 'completed' ? t('invitation.contract.activatedState') : stateLabel(packet?.state || c.state)}</p></div></div>
        <div className="mh-note"><ShieldCheck size={21}/><p>{packet?.state === 'completed' ? (c.activated ? t('invitation.contract.noteActivated') : t('invitation.contract.noteCompleted')) : packet?.recruiter_signed_at ? t('invitation.contract.noteSigned') : t('invitation.contract.noteReady')}</p></div>
        {(!packet || ['prepared', 'creating'].includes(packet.state)) && <button className="mh-button mh-primary" disabled={busy} onClick={() => void startSignature()}>{busy ? t('invitation.contract.preparing') : t('invitation.contract.create')}<ArrowUpRight size={17}/></button>}
        {packet && <>
          <details><summary>{t('invitation.contract.packet', { version: packet.package_version })}</summary>{packet.documents.map(d => <button className="mh-doc" key={d.role} disabled={busy} onClick={() => void document(d.role)}><FileText size={19}/><span>{documentLabel(d.role)}<small>{t('invitation.contract.personalDocument')}</small></span><ArrowUpRight size={16}/></button>)}</details>
          {packet.state === 'sent' && <>{!packet.recruiter_signed_at && (packet.recruiter_client_user_id === user.id ? <button className="mh-button mh-primary" disabled={busy} onClick={() => void run(async () => { const { url } = await onboardingApi<{url: string}>(false, { action: 'signature', ...identity, contract_id: packet.id }); window.location.assign(url); })}>{t('invitation.contract.sign')}<ArrowUpRight size={17}/></button> : <p>{t('invitation.contract.remoteSigner')}</p>)}<button className="mh-button" disabled={busy} onClick={() => void run(() => load('sync', { contract_id: packet.id }))}><RefreshCw size={15}/>{t('invitation.contract.refreshSignature')}</button></>}
          {packet.state === 'completed' && <div className="mh-stack">
            <button className="mh-button mh-primary" disabled={busy} onClick={() => void document('signed')}>{t('invitation.contract.openSigned')}<ArrowUpRight size={16}/></button>
            <button className="mh-button" disabled={busy} onClick={() => void document('certificate')}>{t('invitation.contract.openCertificate')}</button>
            {c.activated ? <>
              <div className="mh-note"><KeyRound size={20}/><p>{t('invitation.contract.passwordNote')}</p></div>
              <form className="mh-stack mh-auth" onSubmit={e => { e.preventDefault(); void savePassword(); }}>
                <label className="mh-field">{t('invitation.contract.password')}<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)}/><small>{t('common.passwordMin')}</small></label>
                <label className="mh-field">{t('invitation.contract.repeatPassword')}<input type="password" autoComplete="new-password" minLength={8} required value={repeat} onChange={e => setRepeat(e.target.value)}/></label>
                <button className="mh-button mh-primary" type="submit" disabled={busy}>{t('invitation.contract.savePassword')}<ArrowRight size={16}/></button>
                <a href="/recruiter" className="mh-link">{t('invitation.contract.havePassword')}<ArrowRight size={14}/></a>
              </form>
            </> : <p className="mh-muted">{t('invitation.contract.accessMail')}</p>}
          </div>}
          {packet.state === 'manual_review' && <p className="mh-alert">{t('invitation.contract.manualReview')}</p>}
        </>}
        <button className="mh-link" disabled={busy} onClick={() => void run(() => load())}><RefreshCw size={14}/>{t('invitation.contract.refresh')}</button>
      </section>}
    </>}
  </OnboardingFrame>;
}

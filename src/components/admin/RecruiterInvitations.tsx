import { CONTRACT_FIELD_LABELS, cleanContractDetails } from '../../../supabase/functions/_shared/recruiter-contract-data';
import { useEffect, useState } from 'react';
import { ArrowRight, Building2, UserRound, Plus, Mail, Copy, RefreshCw, UsersRound, ShieldCheck } from 'lucide-react';
import '@/components/onboarding/onboarding.css';
import { onboardingApi, profileLabels, documentLabels, stateLabels, type StoredOnboarding, type StoredContract } from '@/lib/recruiterOnboardingApi';
import { requiredReviewChecks, REVIEW_CHECK_LABELS } from '../../../supabase/functions/_shared/recruiter-contract-policy';

const date = (s?: string | null) => s ? new Date(s).toLocaleString('de-DE') : '—';
export default function RecruiterInvitations({ api = onboardingApi }: { api?: typeof onboardingApi }) {
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [cases, setCases] = useState<StoredOnboarding[]>([]);
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [draft, setDraft] = useState({ name: '', email: '', company: '', country: '', specialty: '', region: '', kind: 'individual', days: '7', internal_note: '' });
  const [created, setCreated] = useState<{ id: string; token: string; url: string } | null>(null);
  const [mailNote, setMailNote] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const c = cases.find(row => row.id === selected);
  const packet = contracts.find(row => row.case_id === selected && !['declined','voided'].includes(row.state));
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); } };
  const load = async () => {
    const result = await api<{ cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean; docusign_setup_message?: string }>(true, { action: 'list' });
    setLoaded(true); setCases(result.cases); setContracts(result.contracts); setEnabled(result.docusign_enabled); setSetupMessage(result.docusign_setup_message ?? '');
  };
  useEffect(() => {
    const returning = new URLSearchParams(location.search).get('contract_return');
    void run(async () => {
      const result = await api<{cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean; docusign_setup_message?: string}>(true, {action:'list'});
      setLoaded(true); setCases(result.cases); setContracts(result.contracts); setEnabled(result.docusign_enabled); setSetupMessage(result.docusign_setup_message ?? '');
      const contract = result.contracts.find(row => row.id === returning);
      if (contract) setSelected(contract.case_id);
      if (returning) setMessage('Willkommen zurück. Der Vertragsstatus wird ausschließlich durch die bestätigte DocuSign-Rückmeldung aktualisiert.');
    });
  }, [api]);
  const action = (action: string, extra: Record<string, unknown> = {}) => run(async () => {
    const result = await api<{ url?: string }>(true, { action, case_id: c?.id, revision: c?.revision, contract_id: packet?.id, ...extra });
    if (result.url) { window.location.assign(result.url); return; }
    await load(); setMessage('Vorgang aktualisiert.');
  });
  const visible = cases.filter(row => `${row.profile.name} ${row.email} ${row.profile.company}`.toLowerCase().includes(search.toLowerCase()));
  const recipient = cases.find(row => row.id === created?.id);
  const validInvite = (row: StoredOnboarding) => row.entry_source !== 'website' && !row.revoked_at && !row.claimed_at && !!row.expires_at && Date.parse(row.expires_at) > Date.now();
  const createFields = { name: 'Kontaktname', email: 'E-Mail-Adresse', company: 'Vertragspartner / Firma', country: 'Sitzland', specialty: 'Recruiting-Schwerpunkt', region: 'Zielregion' };
  return <section className="mh-ui mh-admin" aria-label="Einladungen & Verträge">
    <header className="mh-admin-heading"><div><p className="mh-kicker">HEADHUNTER-NETZWERK · EINLADUNGEN & VERTRÄGE</p><h2>Ein guter Start beginnt bei euch.</h2><p className="mh-lead">Bereitet bekannte Angaben vor. Eure Headhunter prüfen sie und ergänzen den Rest.</p></div><button className="mh-button" disabled={busy} onClick={() => void run(load)}><RefreshCw size={15}/>Aktualisieren</button></header>
    <div className="mh-stats"><div><strong>{loaded ? cases.filter(validInvite).length : '—'}</strong><span>Offene Einladungen</span></div><div><strong>{loaded ? cases.filter(row => row.state === 'review' && !row.revoked_at).length : '—'}</strong><span>Angaben zur Prüfung</span></div><div><strong>{loaded ? new Set(contracts.filter(row => row.state === 'completed').map(row => row.case_id)).size : '—'}</strong><span>Verträge abgeschlossen</span></div></div>
    <div className="mh-stack">
      {error && <p role="alert" className="mh-alert mh-error">{error}</p>}
      {message && <p role="status" className="mh-alert">{message}</p>}
      {loaded && !enabled && <p className="mh-alert">{setupMessage || 'Der DocuSign-Versand für Recruiter ist noch nicht aktiviert.'}</p>}
      <div className="mh-admin-grid"><div className="mh-stack">
        <section className="mh-panel">
          <div className="mh-panel-head"><Plus size={23}/><div><h3>Persönliche Einladung vorbereiten</h3><p>Ein Link. Ein persönlicher Einstieg. Alle bekannten Angaben schon dabei.</p></div></div>
          <form className="mh-stack" onSubmit={e => { e.preventDefault(); void run(async () => {
            const result = await api<{ id: string; token: string; url: string }>(true, { action: 'create', ...draft, profile: { name: draft.name, company: draft.company, country: draft.country, specialty: draft.specialty, region: draft.region } });
            setCreated(result); setMailNote(''); await load(); setSelected(result.id); setChecks({}); setFeedback(''); setMessage('Einladung gespeichert. Der persönliche Link wird nur jetzt angezeigt.');
          }); }}>
            <div className="mh-choices">{[['individual', 'Einzelrecruiter', 'Selbstständiger Partner'], ['agency', 'Neue Agentur', 'Zusammenarbeit mit einer Agentur']].map(([value, label, detail]) => <button className="mh-choice" type="button" key={value} disabled={busy} aria-pressed={draft.kind === value} onClick={() => setDraft({ ...draft, kind: value })}>{value === 'agency' ? <Building2 size={18}/> : <UserRound size={18}/>}<span><strong>{label}</strong><small>{detail}</small></span></button>)}</div>
            <div className="mh-grid">{Object.entries(createFields).map(([key, label]) => <label className="mh-field" key={key}>{label}{!['name', 'email'].includes(key) && ' · optional'}<input required={['name', 'email'].includes(key)} type={key === 'email' ? 'email' : 'text'} value={draft[key as keyof typeof draft]} onChange={e => setDraft({ ...draft, [key]: e.target.value })}/></label>)}</div>
            <label className="mh-field">Link gültig für<select value={draft.days} onChange={e => setDraft({ ...draft, days: e.target.value })}><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30">30 Tage</option></select></label>
            <label className="mh-field">Interne Notiz · optional<textarea value={draft.internal_note} onChange={e => setDraft({ ...draft, internal_note: e.target.value })}/><small>Nur für euer Team. Wird nicht in die Einladungs-E-Mail übernommen.</small></label>
            <div className="mh-note"><ShieldCheck size={19}/><p>Nach Bestätigung der Angaben entsteht automatisch der persönliche Vertrag in Fassung 2.1 mit sechs Anlagen. Matchunt prüft und zeichnet am Ende gegen.</p></div>
            <button className="mh-button mh-primary mh-full" disabled={busy} type="submit">Persönlichen Link erstellen<ArrowRight size={16}/></button>
          </form>
        </section>
        {created && <section className="mh-panel mh-stack"><div className="mh-panel-head"><Mail size={22}/><div><h3>Bereit für den persönlichen Einstieg.</h3><p>Empfänger: {recipient?.email || 'Wird geladen …'}</p></div></div>
          <label className="mh-field">Persönlicher Link<input readOnly value={created.url} onFocus={e => e.target.select()}/></label>
          <button type="button" className="mh-button" onClick={() => void run(async () => { await navigator.clipboard.writeText(created.url); setMessage('Einladungslink kopiert.'); })}><Copy size={15}/>Link kopieren</button>
          <label className="mh-field">Persönliche Nachricht · optional<textarea maxLength={1200} value={mailNote} onChange={e => setMailNote(e.target.value)}/></label>
          <details><summary>E-Mail-Inhalt ansehen</summary><div className="mh-email"><header>matchunt.ai</header><div><p className="mh-kicker">IHRE EINLADUNG ZUM MATCHUNT RECRUITER-NETZWERK</p><h3>Willkommen bei Matchunt</h3><p>Guten Tag {recipient?.profile.name},</p><p>wir freuen uns, die Zusammenarbeit mit Ihnen vorzubereiten.</p>{mailNote.trim() && <p className="whitespace-pre-wrap">{mailNote.trim()}</p>}<p>Über Ihren persönlichen Link können Sie Ihre bereits hinterlegten Angaben prüfen, ergänzen und den Vertragsprozess starten. Bitte verwenden Sie dafür die E-Mail-Adresse, an die diese Einladung gesendet wurde.</p><p>Nach Bestätigung Ihrer Angaben wird Ihr persönliches Vertragspaket erstellt. Sie können es direkt mit DocuSign prüfen und unterschreiben. Anschließend prüft Matchunt Ihre Unterlagen und zeichnet ausdrücklich gegen. Danach informieren wir Sie über die Freischaltung.</p><span className="mh-email-cta">Persönliches Onboarding starten</span><p>Bei Fragen antworten Sie gern direkt auf diese Nachricht.</p><p>Mit freundlichen Grüßen<br/>Ihr Matchunt-Team</p></div><footer>Persönlicher Link · bitte nicht weiterleiten. Gültig bis {date(recipient?.expires_at)}.</footer></div></details>
          <button className="mh-button mh-primary" disabled={busy || !recipient || !validInvite(recipient)} onClick={() => void run(async () => { await api(true, { action: 'mail', case_id: created.id, token: created.token, message: mailNote }); setMessage('Einladung vom E-Mail-Dienst zum Versand angenommen.'); })}><Mail size={16}/>Einladung per E-Mail senden</button>
          <p className="mh-muted text-xs">Dieser Link wird nach dem Verlassen nicht erneut angezeigt. Bei Verlust eine neue Einladung erstellen und die alte widerrufen.</p>
        </section>}
      </div><div className="mh-stack">
        <section className="mh-panel mh-stack"><div className="mh-panel-head"><UsersRound size={22}/><div><h3>Euer Netzwerk im Aufbau</h3><p>Einladungen und direkte Website-Registrierungen. Bis zu 100 zuletzt angelegte Vorgänge; die Kennzahlen beziehen sich auf diese Auswahl.</p></div></div>
          <label className="mh-field">Vorgänge durchsuchen<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Name, E-Mail oder Unternehmen"/></label>
          <div className="mh-case-list">{visible.map(row => <button key={row.id} className="mh-case-row" disabled={busy} aria-pressed={selected === row.id} onClick={() => { setSelected(row.id); setChecks({}); setFeedback(''); }}><span className="mh-avatar">{(row.profile.name || row.email).slice(0, 2).toUpperCase()}</span><span><strong>{row.profile.name || 'Neuer Recruiter'}</strong><small>{row.profile.company || row.email}</small><small>{row.entry_source === 'website' ? 'Website-Registrierung' : 'Persönliche Einladung'}</small><span className="mh-status">{row.revoked_at ? 'Widerrufen' : !row.claimed_at && row.expires_at && Date.parse(row.expires_at) <= Date.now() ? 'Link abgelaufen' : stateLabels[row.state]}</span></span></button>)}</div>
          {visible.length === 0 && <div className="mh-empty"><UsersRound size={27}/><h3>{loaded ? search ? 'Keine passenden Vorgänge' : 'Platz für gute Partner.' : 'Vorgänge werden geladen …'}</h3><p>{loaded ? 'Neue Einladungen und Registrierungen erscheinen hier.' : 'Der aktuelle Stand wird aus eurem Adminbereich geladen.'}</p></div>}
        </section>
      {c && <section className="mh-panel mh-stack"><div><p className="mh-kicker">AUSGEWÄHLTER VORGANG</p><h3>{c.profile.name || c.email}</h3><span className="mh-status">{c.revoked_at ? 'Widerrufen' : stateLabels[c.state]}</span></div><p className="text-sm">{c.entry_source === 'website' ? 'Direkte Website-Registrierung' : `Einladungslink gültig bis ${date(c.expires_at)}`} · Gestartet am {date(c.claimed_at)}</p>
        <dl className="mh-review">{Object.entries(profileLabels).map(([key,label]) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{typeof c.profile[key as keyof typeof c.profile] === 'boolean' ? c.profile.authorityDeclared ? 'Ja' : 'Offen' : String(c.profile[key as keyof typeof c.profile] || '—')}</dd></div>)}</dl>
        <details><summary className="cursor-pointer text-sm font-medium">Bestätigte Angaben im Vertragsdatenblatt</summary><dl className="mh-review">{Object.entries(CONTRACT_FIELD_LABELS).map(([key,label])=><div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap">{String(cleanContractDetails(c.profile.contractDetails)[key as keyof ReturnType<typeof cleanContractDetails>] || 'Nicht angegeben')}</dd></div>)}</dl></details>
        {c.state === 'review' && <><div className="grid gap-2">{requiredReviewChecks(c.kind).map(key => [key, REVIEW_CHECK_LABELS[key as keyof typeof REVIEW_CHECK_LABELS]]).map(([k,label]) => <label className="mh-check" key={k}><input type="checkbox" checked={!!checks[k]} onChange={e => setChecks({ ...checks, [k]: e.target.checked })}/>{label}</label>)}</div><button className="mh-button" disabled={busy || requiredReviewChecks(c.kind).some(key => !checks[key])} onClick={() => void action('approve', { checks })}>Prüfung abschließen</button></>}
        {['review','approved'].includes(c.state) && !packet && <div className="space-y-2"><label className="block text-sm">Rückfrage an den Headhunter<textarea className="mh-full rounded-md border border-input bg-card text-foreground p-3" value={feedback} onChange={e => setFeedback(e.target.value)}/></label><button className="mh-button" disabled={busy || feedback.trim().length < 10} onClick={() => void action('changes', { feedback })}>Zur Ergänzung öffnen</button></div>}
        {!c.claimed_at && !c.revoked_at && <button className="mh-button" disabled={busy} onClick={() => void action('revoke')}>Einladung widerrufen</button>}
        {['review','approved'].includes(c.state) && !packet && <p className="rounded-md bg-muted p-4 text-sm">Das Vertragspaket wird automatisch aus den bestätigten Headhunter-Daten und der zugeordneten Fassung 2.1 erzeugt, sobald der Headhunter den Signaturstart auswählt. Manuelles Hochladen ist nicht erforderlich. Die Matchunt-Gegenzeichnung bleibt bis zu eurer abgeschlossenen Prüfung gesperrt.</p>}
        {packet && <div className="space-y-3 border-t pt-4"><h4 className="font-medium">{packet.package_version} · {stateLabels[packet.state]}</h4><p className="text-sm">Recruiter: {date(packet.recruiter_signed_at)} · Matchunt: {date(packet.countersigned_at)}</p><div className="flex flex-wrap gap-2">{packet.documents.map(d => <button className="mh-button" key={d.role} disabled={busy} onClick={() => void action('document', { document: d.role })}>{documentLabels[d.role]}</button>)}</div><div className="flex flex-wrap gap-2">
          {['prepared','creating'].includes(packet.state) && <button className="mh-button" disabled={busy || !enabled} onClick={() => void action('send')}>{packet.state === 'creating' ? 'DocuSign-Erstellung wiederaufnehmen' : 'Vertrag an DocuSign senden'}</button>}
          {packet.state === 'sent' && <button className="mh-button" disabled={busy} onClick={() => void action('sync')}>Signaturstatus prüfen</button>}
          {c.state === 'approved' && packet.state === 'sent' && packet.recruiter_signed_at && <button className="mh-button" disabled={busy} onClick={() => void action('counter')}>In DocuSign gegenzeichnen</button>}
          {packet.signed_document_path && <button className="mh-button" disabled={busy} onClick={() => void action('document', { document: 'signed' })}>Unterzeichnetes Vertragspaket</button>}
          {packet.certificate_path && <button className="mh-button" disabled={busy} onClick={() => void action('document', { document: 'certificate' })}>Abschlusszertifikat</button>}
        </div><details><summary className="cursor-pointer text-sm">Vertragsvorgang zur Korrektur zurücknehmen</summary><label className="block text-sm">Begründung<textarea className="mh-full rounded-md border border-input bg-card text-foreground p-3" value={feedback} onChange={e => setFeedback(e.target.value)}/></label><button className="mh-button" disabled={busy || feedback.trim().length < 10 || !['prepared','sent'].includes(packet.state)} onClick={() => void action('void', { reason: feedback })}>Vertragsvorgang zurücknehmen</button></details><p className="text-xs text-muted-foreground">Der Vertragsabschluss wird über DocuSign bestätigt. Die Freischaltung der Plattform ist ein eigener Schritt.</p></div>}
      </section>}
      </div></div>
    </div>
  </section>;
}

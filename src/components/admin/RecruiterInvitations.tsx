import { CONTRACT_FIELD_LABELS, cleanContractDetails } from '../../../supabase/functions/_shared/recruiter-contract-data';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { onboardingApi, profileLabels, documentLabels, stateLabels, type StoredOnboarding, type StoredContract } from '@/lib/recruiterOnboardingApi';
import { requiredReviewChecks, REVIEW_CHECK_LABELS } from '../../../supabase/functions/_shared/recruiter-contract-policy';

const date = (s?: string | null) => s ? new Date(s).toLocaleString('de-DE') : '—';
export default function RecruiterInvitations() {
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<StoredOnboarding[]>([]);
  const [contracts, setContracts] = useState<StoredContract[]>([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [setupMessage, setSetupMessage] = useState('');
  const [draft, setDraft] = useState({ name: '', email: '', company: '', kind: 'individual', days: '7', internal_note: '' });
  const [created, setCreated] = useState<{ id: string; token: string; url: string } | null>(null);
  const [mailNote, setMailNote] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const c = cases.find(row => row.id === selected);
  const packet = contracts.find(row => row.case_id === selected && !['declined','voided'].includes(row.state));
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setMessage(''); try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Anfrage fehlgeschlagen.'); } finally { setBusy(false); } };
  const load = async () => {
    const result = await onboardingApi<{ cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean; docusign_setup_message?: string }>(true, { action: 'list' });
    setCases(result.cases); setContracts(result.contracts); setEnabled(result.docusign_enabled); setSetupMessage(result.docusign_setup_message ?? '');
  };
  useEffect(() => {
    const returning = new URLSearchParams(location.search).get('contract_return');
    if (!returning) return;
    setOpen(true);
    void run(async () => {
      const result = await onboardingApi<{cases: StoredOnboarding[]; contracts: StoredContract[]; docusign_enabled: boolean; docusign_setup_message?: string}>(true, {action:'list'});
      setCases(result.cases); setContracts(result.contracts); setEnabled(result.docusign_enabled); setSetupMessage(result.docusign_setup_message ?? '');
      const contract = result.contracts.find(row => row.id === returning);
      if (contract) setSelected(contract.case_id);
      setMessage('Willkommen zurück. Der Vertragsstatus wird ausschließlich durch die bestätigte DocuSign-Rückmeldung aktualisiert.');
    });
  }, []);
  const action = (action: string, extra: Record<string, unknown> = {}) => run(async () => {
    const result = await onboardingApi<{ url?: string }>(true, { action, case_id: c?.id, revision: c?.revision, contract_id: packet?.id, ...extra });
    if (result.url) { window.location.assign(result.url); return; }
    await load(); setMessage('Vorgang aktualisiert.');
  });
  return <Card><CardHeader><CardTitle>Einladungen & Verträge</CardTitle><p className="text-sm text-muted-foreground">Persönliches Headhunter-Onboarding vorbereiten und den Vertragsprozess begleiten.</p></CardHeader><CardContent className="space-y-5">
    <Button variant="outline" disabled={busy} onClick={() => { setOpen(true); void run(load); }}>{open ? 'Stand neu laden' : 'Einladungsverwaltung öffnen'}</Button>
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p>}
    {open && <>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void run(async () => {
        const result = await onboardingApi<{ id: string; token: string; url: string }>(true, { action: 'create', ...draft, profile: { name: draft.name, company: draft.company } });
        setCreated(result); await load(); setSelected(result.id); setMessage('Einladung gespeichert. Der Link wird nur jetzt angezeigt.');
      }); }}>
        {(['name','email','company'] as const).map(k => <label key={k} className="space-y-1 text-sm">{({ name: 'Kontaktname', email: 'Einladungs-E-Mail', company: 'Vertragspartner / Firma' })[k]}<Input required={k !== 'company'} type={k === 'email' ? 'email' : 'text'} value={draft[k]} onChange={e => setDraft({ ...draft, [k]: e.target.value })}/></label>)}
        <label className="space-y-1 text-sm">Einladungsart<select className="flex h-10 w-full rounded-md border bg-background px-3" value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })}><option value="individual">Einzelrecruiter</option><option value="agency">Neue Agentur</option></select></label>
        <label className="space-y-1 text-sm">Link gültig für<select className="flex h-10 w-full rounded-md border bg-background px-3" value={draft.days} onChange={e => setDraft({ ...draft, days: e.target.value })}><option value="7">7 Tage</option><option value="14">14 Tage</option><option value="30">30 Tage</option></select></label>
        <label className="space-y-1 text-sm">Interne Notiz<Textarea value={draft.internal_note} onChange={e => setDraft({ ...draft, internal_note: e.target.value })}/></label>
        <p className="text-sm text-muted-foreground sm:col-span-2">Vertragsgrundlage: Fassung 2.1 mit sechs Anlagen. Daraus wird nach Bestätigung der Headhunter-Daten automatisch das persönliche Paket erstellt. Matchunt prüft und zeichnet am Ende ausdrücklich gegen.</p><Button disabled={busy} type="submit">Persönlichen Link erstellen</Button>
      </form>
      {created && <section className="space-y-3 rounded-md border p-4"><h3 className="font-medium">Einladung versenden</h3><p className="text-sm">Empfänger: {cases.find(row => row.id === created.id)?.email}. Die Nachricht enthält die nächsten Schritte, Ihren persönlichen Gruß und den Einladungslink.</p><label className="block text-sm">Persönlicher Link<Input readOnly value={created.url} onFocus={e => e.target.select()}/></label><label className="block text-sm">Persönliche Nachricht · optional<Textarea value={mailNote} onChange={e => setMailNote(e.target.value)}/></label><Button disabled={busy} onClick={() => void run(async () => { await onboardingApi(true, { action: 'mail', case_id: created.id, token: created.token, message: mailNote }); setMessage('Einladung vom E-Mail-Dienst zum Versand angenommen.'); })}>Einladung per E-Mail senden</Button><p className="text-xs text-muted-foreground">Der Link wird nach dem Schließen nicht erneut angezeigt. Bei Verlust eine neue Einladung erstellen und die alte widerrufen.</p></section>}
      {!enabled && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">{setupMessage || 'Der DocuSign-Versand für Recruiter ist noch nicht aktiviert.'}</p>}
      <label className="block text-sm">Vorgang auswählen<select className="mt-1 flex h-10 w-full rounded-md border bg-background px-3" value={selected} onChange={e => { setSelected(e.target.value); setChecks({}); setFeedback(''); }}><option value="">Bitte wählen</option>{cases.map(row => <option key={row.id} value={row.id}>{row.profile.name} · {row.email} · {row.revoked_at ? 'Widerrufen' : stateLabels[row.state]}</option>)}</select></label>
      {c && <section className="space-y-4 rounded-md border p-4"><h3 className="font-semibold">{c.profile.name} · {stateLabels[c.state]}</h3><p className="text-sm">Einladungslink gültig bis {date(c.expires_at)} · Übernommen am {date(c.claimed_at)}</p>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">{Object.entries(profileLabels).map(([key,label]) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{typeof c.profile[key as keyof typeof c.profile] === 'boolean' ? c.profile.authorityDeclared ? 'Ja' : 'Offen' : String(c.profile[key as keyof typeof c.profile] || '—')}</dd></div>)}</dl>
        <details><summary className="cursor-pointer text-sm font-medium">Bestätigte Angaben im Vertragsdatenblatt</summary><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">{Object.entries(CONTRACT_FIELD_LABELS).map(([key,label])=><div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap">{String(cleanContractDetails(c.profile.contractDetails)[key as keyof ReturnType<typeof cleanContractDetails>] || 'Nicht angegeben')}</dd></div>)}</dl></details>
        {c.state === 'review' && <><div className="grid gap-2">{requiredReviewChecks(c.kind).map(key => [key, REVIEW_CHECK_LABELS[key as keyof typeof REVIEW_CHECK_LABELS]]).map(([k,label]) => <label className="flex items-center gap-2 text-sm" key={k}><input type="checkbox" checked={!!checks[k]} onChange={e => setChecks({ ...checks, [k]: e.target.checked })}/>{label}</label>)}</div><Button disabled={busy || requiredReviewChecks(c.kind).some(key => !checks[key])} onClick={() => void action('approve', { checks })}>Prüfung abschließen</Button></>}
        {['review','approved'].includes(c.state) && !packet && <div className="space-y-2"><label className="block text-sm">Rückfrage an den Headhunter<Textarea value={feedback} onChange={e => setFeedback(e.target.value)}/></label><Button disabled={busy || feedback.trim().length < 10} variant="outline" onClick={() => void action('changes', { feedback })}>Zur Ergänzung öffnen</Button></div>}
        {!c.claimed_at && !c.revoked_at && <Button variant="outline" disabled={busy} onClick={() => void action('revoke')}>Einladung widerrufen</Button>}
        {['review','approved'].includes(c.state) && !packet && <p className="rounded-md bg-muted p-4 text-sm">Das Vertragspaket wird automatisch aus den bestätigten Headhunter-Daten und der zugeordneten Fassung 2.1 erzeugt, sobald der Headhunter den Signaturstart auswählt. Manuelles Hochladen ist nicht erforderlich. Die Matchunt-Gegenzeichnung bleibt bis zu eurer abgeschlossenen Prüfung gesperrt.</p>}
        {packet && <div className="space-y-3 border-t pt-4"><h4 className="font-medium">{packet.package_version} · {stateLabels[packet.state]}</h4><p className="text-sm">Recruiter: {date(packet.recruiter_signed_at)} · Matchunt: {date(packet.countersigned_at)}</p><div className="flex flex-wrap gap-2">{packet.documents.map(d => <Button key={d.role} size="sm" variant="outline" disabled={busy} onClick={() => void action('document', { document: d.role })}>{documentLabels[d.role]}</Button>)}</div><div className="flex flex-wrap gap-2">
          {['prepared','creating'].includes(packet.state) && <Button disabled={busy || !enabled} onClick={() => void action('send')}>{packet.state === 'creating' ? 'DocuSign-Erstellung wiederaufnehmen' : 'Vertrag an DocuSign senden'}</Button>}
          {packet.state === 'sent' && <Button variant="outline" disabled={busy} onClick={() => void action('sync')}>Signaturstatus prüfen</Button>}
          {c.state === 'approved' && packet.state === 'sent' && packet.recruiter_signed_at && <Button disabled={busy} onClick={() => void action('counter')}>In DocuSign gegenzeichnen</Button>}
          {packet.signed_document_path && <Button variant="outline" disabled={busy} onClick={() => void action('document', { document: 'signed' })}>Unterzeichnetes Vertragspaket</Button>}
          {packet.certificate_path && <Button variant="outline" disabled={busy} onClick={() => void action('document', { document: 'certificate' })}>Abschlusszertifikat</Button>}
        </div><details><summary className="cursor-pointer text-sm">Vertragsvorgang zur Korrektur zurücknehmen</summary><label className="block text-sm">Begründung<Textarea value={feedback} onChange={e => setFeedback(e.target.value)}/></label><Button variant="outline" disabled={busy || feedback.trim().length < 10 || !['prepared','sent'].includes(packet.state)} onClick={() => void action('void', { reason: feedback })}>Vertragsvorgang zurücknehmen</Button></details><p className="text-xs text-muted-foreground">Der Vertragsabschluss wird über DocuSign bestätigt. Die Freischaltung der Plattform ist ein eigener Schritt.</p></div>}
      </section>}
    </>}
  </CardContent></Card>;
}

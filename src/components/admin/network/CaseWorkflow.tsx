import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ProfileReview } from '@/components/onboarding/RecruiterProfileForm';
import '@/components/onboarding/onboarding.css';
import { documentLabels, stateLabels, type StoredContract, type StoredOnboarding } from '@/lib/recruiterOnboardingApi';
import { CONTRACT_FIELD_LABELS, cleanContractDetails } from '../../../../supabase/functions/_shared/recruiter-contract-data';
import { requiredReviewChecks, REVIEW_CHECK_LABELS } from '../../../../supabase/functions/_shared/recruiter-contract-policy';
import { shortDate } from './mailFormat';

/**
 * Prüfung und Vertrag eines Vorgangs: Prüfpunkte, Rückfrage, Vertragspaket mit
 * DocuSign, Gegenzeichnung, Freischaltung. Die Aktionen laufen über die
 * Function recruiter-onboarding-admin; die Regeln prüft der Server.
 */
export function CaseWorkflow({ c, packet, docusignEnabled, busy, onAction }: {
  c: StoredOnboarding; packet: StoredContract | null; docusignEnabled: boolean; busy: boolean;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
}) {
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState('');
  const [reason, setReason] = useState('');
  const required = requiredReviewChecks(c.kind);
  const signed = !!packet?.recruiter_signed_at;
  const confirmThen = (text: string, action: string, extra?: Record<string, unknown>) => { if (window.confirm(text)) onAction(action, extra); };

  return <div className="space-y-5">
    <p className="text-sm text-muted-foreground">
      {c.revoked_at ? 'Widerrufen' : c.activated ? 'Freigeschaltet' : stateLabels[c.state]}
      {' · '}{c.entry_source === 'website' ? 'Direkte Website-Registrierung' : c.claimed_at ? 'Persönliche Einladung' : `Einladungslink gültig bis ${shortDate(c.expires_at)}`}
      {c.claimed_at && <>{' · '}Begonnen am {shortDate(c.claimed_at)}</>}
    </p>

    {c.state === 'review' && !c.revoked_at && <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="text-sm font-semibold">Prüfung abschließen</h4>
        <p className="text-sm text-muted-foreground">{signed
          ? 'Der Headhunter hat schon unterschrieben. Nach der Prüfung erscheint hier „In DocuSign gegenzeichnen“.'
          : 'Nach der Prüfung kann Matchunt gegenzeichnen, sobald der Headhunter unterschrieben hat.'}</p>
      </div>
      <div className="grid gap-2">{required.map(key => <label key={key} className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={!!checks[key]} onChange={e => setChecks({ ...checks, [key]: e.target.checked })}/>
        {REVIEW_CHECK_LABELS[key as keyof typeof REVIEW_CHECK_LABELS]}
      </label>)}</div>
      <Button disabled={busy || required.some(key => !checks[key])} onClick={() => onAction('approve', { checks })}>Prüfung abschließen</Button>
    </section>}

    {packet && <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h4 className="text-sm font-semibold">Vertrag {packet.package_version} · {stateLabels[packet.state]}</h4>
        <p className="text-sm text-muted-foreground">Headhunter: {shortDate(packet.recruiter_signed_at)} · Matchunt: {shortDate(packet.countersigned_at)}</p>
      </div>
      <div className="flex flex-wrap gap-2">{packet.documents.map(d => <Button key={d.role} variant="outline" size="sm" disabled={busy} onClick={() => onAction('document', { document: d.role })}>{documentLabels[d.role] ?? d.name}</Button>)}</div>
      <div className="flex flex-wrap items-center gap-2">
        {['prepared', 'creating'].includes(packet.state) && <Button size="sm" disabled={busy || !docusignEnabled} onClick={() => onAction('send')}>{packet.state === 'creating' ? 'DocuSign-Erstellung wiederaufnehmen' : 'Vertrag an DocuSign senden'}</Button>}
        {c.state === 'approved' && packet.state === 'sent' && signed && <Button size="sm" disabled={busy} onClick={() => onAction('counter')}>In DocuSign gegenzeichnen</Button>}
        {packet.state === 'sent' && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('sync')}>Signaturstatus prüfen</Button>}
        {packet.signed_document_path && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('document', { document: 'signed' })}>Unterzeichnetes Vertragspaket</Button>}
        {packet.certificate_path && <Button size="sm" variant="outline" disabled={busy} onClick={() => onAction('document', { document: 'certificate' })}>Abschlusszertifikat</Button>}
      </div>
      {c.state === 'review' && packet.state === 'sent' && signed && <p className="rounded-md bg-muted p-3 text-sm">Gegenzeichnen geht erst nach „Prüfung abschließen“ oben.</p>}
      {c.state === 'approved' && packet.state === 'completed' && <div className="space-y-2 rounded-md bg-muted p-3">
        {c.activated && <p className="text-sm">Freigeschaltet. Die Zugangsmail ist raus; bei Bedarf hier erneut senden.</p>}
        <Button size="sm" disabled={busy} onClick={() => onAction('activate')}>{c.activated ? 'Zugangsmail erneut senden' : 'Freischalten & Zugang senden'}</Button>
      </div>}
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Vertragsvorgang zur Korrektur zurücknehmen</summary>
        <div className="mt-2 space-y-2">
          <Textarea placeholder="Begründung, mindestens 10 Zeichen" value={reason} onChange={e => setReason(e.target.value)}/>
          <Button size="sm" variant="destructive" disabled={busy || reason.trim().length < 10 || !['prepared', 'sent'].includes(packet.state)}
            onClick={() => confirmThen('Vertragsvorgang wirklich zurücknehmen? Der DocuSign-Umschlag wird ungültig.', 'void', { reason })}>Vertragsvorgang zurücknehmen</Button>
        </div>
      </details>
      <p className="text-xs text-muted-foreground">Der Vertragsabschluss wird über DocuSign bestätigt. Die Freischaltung ist ein eigener Schritt.</p>
    </section>}

    {['review', 'approved'].includes(c.state) && !packet && <>
      <p className="rounded-md bg-muted p-3 text-sm">Das Vertragspaket entsteht automatisch aus den bestätigten Angaben in Fassung 2.1, sobald der Headhunter den Signaturstart auswählt. Die Gegenzeichnung bleibt bis zu eurer abgeschlossenen Prüfung gesperrt.</p>
      <section className="space-y-2">
        <h4 className="text-sm font-semibold">Rückfrage an den Headhunter</h4>
        <Textarea placeholder="Was fehlt oder muss korrigiert werden? Mindestens 10 Zeichen." value={feedback} onChange={e => setFeedback(e.target.value)}/>
        <Button size="sm" variant="outline" disabled={busy || feedback.trim().length < 10} onClick={() => onAction('changes', { feedback })}>Zur Ergänzung öffnen</Button>
      </section>
    </>}

    <section className="mh-ui space-y-3">
      <h4 className="text-sm font-semibold">Angaben des Headhunters</h4>
      <ProfileReview profile={c.profile}/>
      <details>
        <summary className="cursor-pointer text-sm font-medium">Bestätigte Angaben im Vertragsdatenblatt</summary>
        <dl className="mh-review">{Object.entries(CONTRACT_FIELD_LABELS).map(([key, label]) => <div key={key}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="whitespace-pre-wrap">{String(cleanContractDetails(c.profile.contractDetails)[key as keyof ReturnType<typeof cleanContractDetails>] || 'Nicht angegeben')}</dd>
        </div>)}</dl>
      </details>
    </section>

    {!c.claimed_at && !c.revoked_at && <Button variant="outline" size="sm" disabled={busy}
      onClick={() => confirmThen('Einladung widerrufen? Der Link funktioniert danach nicht mehr.', 'revoke')}>Einladung widerrufen</Button>}
  </div>;
}

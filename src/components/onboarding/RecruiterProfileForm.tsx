import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Save, UserRound, ShieldCheck } from 'lucide-react';
import { profileLabels, type RecruiterProfile } from '@/lib/recruiterOnboardingApi';
import { CONTRACT_FIELD_LABELS, cleanContractDetails, contractDataIssues } from '../../../supabase/functions/_shared/recruiter-contract-data';
import ContractDetailsFields from './ContractDetailsFields';

const taxLabels: Record<string, string> = { regular: 'Regulär umsatzsteuerpflichtig', small_business: 'Kleinunternehmerregelung', foreign: 'Ausländischer Steuerstatus · Prüfung erforderlich' };
export function ProfileReview({ profile }: { profile: RecruiterProfile }) {
  return <dl className="mh-review">{Object.entries(profileLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{key === 'authorityDeclared' ? profile.authorityDeclared ? 'Bestätigt' : 'Offen' : key === 'taxStatus' ? taxLabels[profile.taxStatus] || '—' : String(profile[key as keyof RecruiterProfile] || '—')}</dd></div>)}</dl>;
}
export default function RecruiterProfileForm({ profile, kind, busy, onChange, onSave, onSubmit }: {
  profile: RecruiterProfile; kind: string; busy: boolean; onChange: (p: RecruiterProfile) => void;
  onSave: () => Promise<void>; onSubmit: () => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const move = (next: number) => { setStep(next); setIssues([]); requestAnimationFrame(() => heading.current?.focus()); };
  const baseFields = (keys: (keyof typeof profileLabels)[]) => <div className="mh-grid">{keys.map(key => <label className="mh-field" key={key}>
    {profileLabels[key]}{['specialty', 'region'].includes(key) && ' · optional'}
    <input required={!['specialty', 'region'].includes(key)} type={key === 'signerEmail' ? 'email' : 'text'} value={String(profile[key])} onChange={e => onChange({ ...profile, [key]: e.target.value })}/>
  </label>)}</div>;
  const details = cleanContractDetails(profile.contractDetails);
  return <section className="mh-panel">
    <div className="mh-panel-head"><UserRound size={22}/><div><h2 ref={heading} tabIndex={-1}>{['Lernen wir dich kennen.', 'Die Grundlage für deinen Vertrag.', 'Alles richtig?'][step]}</h2><p>{['Bekannte Angaben sind bereits vorbereitet. Prüfe sie und ergänze den Rest.', 'Damit dein Vertrag vollständig und persönlich erstellt werden kann.', 'Diese Angaben übernehmen wir in dein persönliches Vertragspaket.'][step]}</p></div></div>
    <nav className="mh-substeps" aria-label="Abschnitte deiner Angaben">{['Person & Firma', 'Vertragsangaben', 'Alles prüfen'].map((label, i) => <button key={label} type="button" disabled={busy || i > step} aria-current={i === step ? 'step' : undefined} onClick={() => move(i)}>{i < step ? '✓' : i + 1} · {label}</button>)}</nav>
    {issues.length > 0 && <div role="alert" className="mh-alert mh-error"><strong>Bitte ergänze noch:</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul><button className="mh-link" type="button" onClick={() => move(0)}>Angaben bearbeiten</button></div>}
    <form onSubmit={e => { e.preventDefault(); if (step < 2) { move(step + 1); return; } const missing = contractDataIssues(profile, kind); if (missing.length) { setIssues(missing); return; } void onSubmit(); }}><fieldset disabled={busy} className="mh-form-fields">
      {step === 0 && <div className="mh-stack">
        <h3>Kontakt & Unternehmen</h3>{baseFields(['name', 'company', 'legalForm', 'address', 'country'])}
        <label className="mh-field">Steuerstatus<select required value={profile.taxStatus} onChange={e => onChange({ ...profile, taxStatus: e.target.value })}><option value="">Bitte wählen</option>{Object.entries(taxLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div className="mh-divider"/><h3>Wer unterschreibt?</h3>{baseFields(['signer', 'signerEmail', 'signerRole'])}
        <label className="mh-check"><input required type="checkbox" checked={profile.authorityDeclared} onChange={e => onChange({ ...profile, authorityDeclared: e.target.checked })}/><span>Die benannte Person ist zur Unterzeichnung für den angegebenen Vertragspartner berechtigt. Matchunt prüft die erforderlichen Nachweise.</span></label>
        <div className="mh-note"><ShieldCheck size={19}/><p>Unterschreibst du selbst, öffnest du DocuSign direkt hier. Eine andere unterzeichnende Person erhält ihren eigenen Zugang per E-Mail.</p></div>
        {baseFields(['specialty', 'region'])}
      </div>}
      {step === 1 && <ContractDetailsFields value={profile.contractDetails} kind={kind} onChange={contractDetails => onChange({ ...profile, contractDetails })}/>}
      {step === 2 && <div className="mh-stack"><ProfileReview profile={profile}/><details><summary>Vertragsdaten & freiwillige Entscheidungen ansehen</summary><dl className="mh-review">{Object.entries(CONTRACT_FIELD_LABELS).filter(([key]) => kind === 'agency' || !['userAuthorities', 'insuranceEvidence'].includes(key)).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{String(details[key as keyof typeof details] || '—')}</dd></div>)}{([['creditNoteConsent', 'Gutschriftverfahren'], ['directoryConsent', 'Partnerverzeichnis'], ['profilePublicationConsent', 'Profilveröffentlichung'], ['marketingConsent', 'Marketing']] as const).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{details[key] ? 'Zugestimmt' : 'Nicht zugestimmt'}</dd></div>)}</dl></details><div className="mh-note"><ShieldCheck size={20}/><p>Mit der Bestätigung startest du die Vertragserstellung. Unterschrieben wird erst im nächsten Schritt in DocuSign. Danach prüft Matchunt deine Angaben und zeichnet gegen.</p></div></div>}
      <div className="mh-actions mh-actions-end">{step > 0 ? <button type="button" className="mh-link" disabled={busy} onClick={() => move(step - 1)}><ArrowLeft size={15}/>Zurück</button> : <span/>}<button type="submit" className="mh-button mh-primary" disabled={busy}>{step === 2 ? <><Check size={16}/>Angaben bestätigen</> : <>Weiter<ArrowRight size={16}/></>}</button></div>
      <button className="mh-link" type="button" disabled={busy} onClick={() => void onSave()}><Save size={14}/>Entwurf speichern & später fortsetzen</button>
    </fieldset></form>
  </section>;
}

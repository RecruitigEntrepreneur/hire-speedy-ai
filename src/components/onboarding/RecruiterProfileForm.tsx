import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Save, Building2, Loader2, PenLine, ShieldCheck, Briefcase, Globe, FileText, MessageSquare } from 'lucide-react';
import { profileLabels, type RecruiterProfile } from '@/lib/recruiterOnboardingApi';
import { cleanContractDetails, contractDataIssues, type ContractDetails } from '../../../supabase/functions/_shared/recruiter-contract-data';
import { EXPERTISE_AREAS, EXPERTISE_LEVELS, COMPANY_TYPES, REGIONS, LANGUAGES, METHODS, EXPERIENCE_BANDS, PLACEMENT_BANDS, PARALLEL_BANDS, cleanExpertise, expertiseIssues, expertiseFromText, type RecruiterExpertise } from '../../../supabase/functions/_shared/recruiter-expertise';
import { LEGAL_FORMS, COUNTRIES, SOLO_FORMS, SIGNER_ROLES, applySuggestion, personMatches, type CompanySuggestion } from '../../../supabase/functions/_shared/recruiter-company';

/**
 * Schritt 2 „Deine Angaben“ als fünf Karten. Der Headhunter tippt fast nichts:
 * Firma aus dem Impressum, Profil per Chips, Unterschrift vorbelegt, vier
 * Fragen mit Vorgabe, zum Schluss die Zusammenfassung wie im Datenblatt.
 * Die Vertragsfelder bleiben dieselben wie vorher; nur der Weg dorthin ist neu.
 */

const taxLabels: Record<string, string> = { regular: 'Regulär umsatzsteuerpflichtig', small_business: 'Kleinunternehmerregelung', foreign: 'Ausländischer Steuerstatus' };
const STEPS = ['Wer bist du?', 'Was du besetzt', 'Unterschrift', 'Vier Fragen', 'Vertrag'];
const QUESTIONS = [
  { key: 'accessCountries', text: 'Du greifst nur aus Deutschland oder der EU auf Kandidatendaten zu.', def: (p: RecruiterProfile) => p.country || 'Deutschland', other: 'Aus welchen Ländern greifst du zu, und welche Garantien gibt es dafür?' },
  { key: 'permitsDeclaration', text: 'Du vermittelst nur, keine Arbeitnehmerüberlassung.', def: () => 'Ausschließlich Personalvermittlung, keine Arbeitnehmerüberlassung; keine Erlaubnis nach AÜG erforderlich.', other: 'Welche Erlaubnisse hast du, oder was ist bei dir anders?' },
  { key: 'incomeConcentration', text: 'Matchunt wird weniger als die Hälfte deiner Einkünfte ausmachen.', def: () => 'Nein, unter der Hälfte der Erwerbseinkünfte.', other: 'Wie schätzt du es ein?' },
  { key: 'dualRole', text: 'Du bist an keinem Unternehmen beteiligt, das Kunde von Matchunt sein könnte.', def: () => 'Keine.', other: 'Welche Unternehmen sind das?' },
] as const;
type QKey = typeof QUESTIONS[number]['key'];
const TRANSFER_DEFAULT = 'Keine Drittlandzugriffe vorgesehen; Zugriff nur aus EU/EWR.';
const TRANSFER_OTHER = 'Drittlandzugriffe möglich, siehe Zugriffsländer; Garantien werden mit Matchunt abgestimmt.';
const INSURANCE_DEFAULT = 'Kein zusätzlicher Nachweis hinterlegt; wird auf Anfrage nachgereicht.';
const SMALL_BUSINESS_TAX = 'Kleinunternehmer nach § 19 UStG, keine USt-IdNr.';
const stripSource = (v: string) => v.replace(/\s*\(laut Impressum[^)]*\)/, '');

export function ProfileReview({ profile }: { profile: RecruiterProfile }) {
  const x = cleanExpertise(profile.expertise);
  const lines: [string, string][] = [
    ['Bereiche', [...x.areas, ...x.extras].join(', ')], ['Unterpunkte', x.subareas.join(', ')], ['Ebene', x.levels.join(', ')], ['Unternehmen', x.companyTypes.join(', ')],
    ['Regionen', x.regions.join(', ')], ['Sprachen', x.languages.join(', ')], ['Vorgehen', x.methods.join(', ')],
    ['Erfahrung', x.experience], ['Besetzungen pro Jahr', x.placements], ['Parallele Suchen', x.parallel], ['LinkedIn', x.linkedin],
  ];
  return <dl className="mh-review">
    {Object.entries(profileLabels).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{key === 'authorityDeclared' ? profile.authorityDeclared ? 'Bestätigt' : 'Offen' : key === 'taxStatus' ? taxLabels[profile.taxStatus] || '—' : String(profile[key as keyof RecruiterProfile] || '—')}</dd></div>)}
    {lines.filter(([, v]) => v).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl>;
}

function Chips({ options, value, onToggle }: { options: readonly string[]; value: string[]; onToggle: (v: string) => void }) {
  return <div className="mh-chips">{options.map(o => <button key={o} type="button" className="mh-chip" aria-pressed={value.includes(o)} onClick={() => onToggle(o)}>{o}</button>)}</div>;
}
const toggleIn = (list: string[], v: string) => list.includes(v) ? list.filter(i => i !== v) : [...list, v];

export default function RecruiterProfileForm({ profile, kind, busy, email, onChange, onSave, onSubmit, onEnrich }: {
  profile: RecruiterProfile; kind: string; busy: boolean; email: string;
  onChange: (p: RecruiterProfile) => void;
  onSave: (silent?: boolean, snapshot?: RecruiterProfile) => Promise<void>;
  onSubmit: () => Promise<void>;
  onEnrich: (website?: string) => Promise<CompanySuggestion>;
}) {
  const d = cleanContractDetails(profile.contractDetails);
  const x = cleanExpertise(profile.expertise);
  const agency = kind === 'agency';
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  // Asynchrone Schritte (Impressum lesen) dürfen nicht mit einem veralteten Profil weiterarbeiten,
  // sonst überschreiben sie, was inzwischen angetippt wurde.
  const latest = useRef(profile);
  latest.current = profile;
  const update = (next: RecruiterProfile) => { onChange(next); latest.current = next; return next; };
  const patch = (p: Partial<RecruiterProfile>) => update({ ...profile, ...p });
  const patchDetails = (dd: Partial<ContractDetails>) => update({ ...profile, contractDetails: { ...d, ...dd } });
  const patchExpertise = (e: Partial<RecruiterExpertise>) => update({ ...profile, expertise: { ...x, ...e } });
  const move = (next: number, snapshot?: RecruiterProfile) => {
    setStep(next); setReached(r => Math.max(r, next)); setIssues([]);
    requestAnimationFrame(() => heading.current?.focus());
    if (next > step) void onSave(true, snapshot ?? profile);
  };

  // Karte 1: Firma. Erst automatisch aus der geschäftlichen Adresse, sonst Website, sonst selbst.
  const [companyMode, setCompanyMode] = useState<'auto' | 'website' | 'result' | 'manual'>(profile.company && profile.address ? 'result' : 'auto');
  const [website, setWebsite] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState('');
  // Herkunft der Firmendaten. Nach dem Neuladen eines Entwurfs verrät sie der Vermerk „laut Impressum“.
  const [impressumSource, setImpressumSource] = useState('');
  const fromImpressum = !!impressumSource || /laut Impressum/.test(d.businessEvidence + d.taxNumber);
  const [manual, setManual] = useState({ vat: '', register: '', ceo: '' });
  const readImpressum = async (site?: string) => {
    setEnriching(true); setEnrichError('');
    try {
      const suggestion = await onEnrich(site);
      update(applySuggestion(latest.current, suggestion));
      setImpressumSource(suggestion.source);
      setCompanyMode('result');
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setCompanyMode('website');
      if (!/Website deines Unternehmens/.test(message)) setEnrichError(message || 'Wir konnten die Website nicht lesen. Trag die Angaben bitte selbst ein.');
    } finally { setEnriching(false); }
  };
  useEffect(() => { if (companyMode === 'auto') void readImpressum(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const openManual = () => {
    setManual({ vat: d.taxNumber.match(/[A-Z]{2}[A-Z0-9]{6,}/)?.[0] ?? '', register: stripSource(d.businessEvidence).replace(/^Handelsregister /, ''), ceo: d.responsiblePerson || profile.name });
    setCompanyMode('manual'); setIssues([]);
  };
  const solo = SOLO_FORMS.includes(profile.legalForm);
  const confirmCompany = () => {
    const missing: string[] = [];
    if (!profile.company) missing.push('Firmierung fehlt.');
    if (!profile.legalForm) missing.push('Rechtsform fehlt.');
    if (!profile.address) missing.push('Anschrift fehlt.');
    if (!profile.country) missing.push('Sitzland fehlt.');
    if (!['regular', 'small_business', 'foreign'].includes(profile.taxStatus)) missing.push('Steuerstatus fehlt.');
    if (missing.length) { if (companyMode === 'result') openManual(); setIssues(missing); return; }
    let next = profile;
    if (companyMode === 'manual') {
      const register = manual.register.trim();
      next = update({ ...profile, contractDetails: { ...d,
        businessEvidence: register ? (/^(HRA|HRB|GnR|PR|VR)/i.test(register) ? `Handelsregister ${register}` : register) : (solo ? `Selbstständige Tätigkeit als ${profile.legalForm}` : d.businessEvidence),
        taxNumber: profile.taxStatus === 'small_business' ? SMALL_BUSINESS_TAX : manual.vat.trim() ? (profile.country === 'Deutschland' ? `USt-IdNr. ${manual.vat.trim().toUpperCase()}` : `Steuernummer / UID ${manual.vat.trim()}`) : d.taxNumber,
        responsiblePerson: manual.ceo.trim() || profile.name,
      } });
      if (!next.contractDetails?.businessEvidence) { setIssues(['Registernummer oder Art deiner Tätigkeit fehlt.']); return; }
      if (!next.contractDetails?.taxNumber) { setIssues([profile.country === 'Deutschland' ? 'USt-IdNr. fehlt.' : 'Steuernummer oder UID fehlt.']); return; }
    }
    move(1, next);
  };

  // Karte 2: Chips. Freitext aus der Einladung wird einmal auf Chips abgebildet.
  useEffect(() => {
    const empty = !x.areas.length && !x.regions.length && !x.extras.length && !x.experience;
    if (empty && (profile.specialty || profile.region)) update({ ...profile, expertise: expertiseFromText(profile.specialty, profile.region) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmExpertise = () => { const missing = expertiseIssues(x); if (missing.length) { setIssues(missing); return; } move(2); };

  // Karte 3: Unterschrift, vorbelegt mit der Person selbst.
  const ceoMatch = personMatches(d.responsiblePerson, profile.name);
  const [signSelf, setSignSelf] = useState<boolean>(() => !profile.signer || personMatches(profile.signer, profile.name));
  const chooseSelf = () => {
    setSignSelf(true);
    patch({ signer: profile.name, signerEmail: email, signerRole: profile.signerRole && personMatches(profile.signer, profile.name) ? profile.signerRole : (solo ? 'Inhaber' : 'Geschäftsführer') });
  };
  const chooseOther = () => { setSignSelf(false); patch({ signer: personMatches(profile.signer, profile.name) ? '' : profile.signer, signerEmail: profile.signerEmail === email ? '' : profile.signerEmail, signerRole: '', authorityDeclared: false }); };
  useEffect(() => { if (step === 2 && signSelf && (!profile.signer || !profile.signerRole || !profile.signerEmail)) chooseSelf(); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmSigner = () => {
    const missing: string[] = [];
    if (!profile.signer) missing.push('Name der unterzeichnenden Person fehlt.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.signerEmail)) missing.push('E-Mail der unterzeichnenden Person fehlt.');
    if (!profile.signerRole) missing.push('Funktion fehlt.');
    if (!profile.authorityDeclared) missing.push('Bitte bestätige die Berechtigung zur Unterschrift.');
    if (agency && !d.userAuthorities.trim()) missing.push('Bitte nenne, wer bei euch mit Matchunt arbeitet.');
    if (missing.length) { setIssues(missing); return; }
    const next = update({ ...profile, contractDetails: { ...d,
      authorityEvidence: signSelf ? `${profile.signerRole}${ceoMatch ? ' laut Impressum' : ''}` : `${profile.signerRole}, benannt durch ${profile.name}`,
      insuranceEvidence: d.insuranceEvidence || (agency ? INSURANCE_DEFAULT : ''),
    } });
    move(3, next);
  };

  // Karte 4: vier Fragen. Beim ersten Öffnen ist alles mit „Ja“ vorbelegt.
  const [other, setOther] = useState<Record<QKey, boolean>>(() => Object.fromEntries(QUESTIONS.map(q => [q.key, !!d[q.key] && d[q.key] !== q.def(profile)])) as Record<QKey, boolean>);
  useEffect(() => {
    if (step !== 3) return;
    if (QUESTIONS.every(q => !d[q.key])) {
      update({ ...profile, contractDetails: { ...d,
        ...Object.fromEntries(QUESTIONS.map(q => [q.key, q.def(profile)])),
        transferRecord: TRANSFER_DEFAULT, privacyContact: d.privacyContact || profile.name, creditNoteConsent: true,
      } as ContractDetails });
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  const answerYes = (q: typeof QUESTIONS[number]) => { setOther(o => ({ ...o, [q.key]: false })); patchDetails({ [q.key]: q.def(profile), ...(q.key === 'accessCountries' ? { transferRecord: TRANSFER_DEFAULT } : {}) } as Partial<ContractDetails>); };
  const answerOther = (q: typeof QUESTIONS[number]) => { setOther(o => ({ ...o, [q.key]: true })); patchDetails({ [q.key]: d[q.key] === q.def(profile) ? '' : d[q.key], ...(q.key === 'accessCountries' ? { transferRecord: TRANSFER_OTHER } : {}) } as Partial<ContractDetails>); };
  const [editPrivacy, setEditPrivacy] = useState(false);
  const confirmQuestions = () => {
    const missing = QUESTIONS.filter(q => !d[q.key].trim()).map(q => 'Bitte beantworte: ' + q.text);
    if (!d.privacyContact.trim()) missing.push('Datenschutz-Ansprechpartner fehlt.');
    if (missing.length) { setIssues(missing); return; }
    move(4);
  };

  // Karte 5: bestätigen.
  const finish = () => {
    const missing = [...contractDataIssues(profile, kind), ...expertiseIssues(x)];
    if (missing.length) { setIssues(missing); return; }
    void onSubmit();
  };

  const stepTitle = ['Wer bist du?', 'Was besetzt du?', 'Du unterschreibst selbst?', 'Vier kurze Fragen.', 'So steht es in deinem Vertrag.'][step];
  const stepLead = [
    companyMode === 'result' ? (fromImpressum ? 'Das haben wir in deinem Impressum gefunden. Prüfe kurz.' : 'Diese Angaben liegen schon vor. Prüfe kurz.')
      : companyMode === 'manual' ? 'Trag deine Firmendaten ein. Matchunt prüft sie vor der Gegenzeichnung.'
      : companyMode === 'auto' ? 'Einen Moment, wir lesen dein Impressum und füllen die Vertragsdaten für dich aus.'
      : 'Nenn uns deine Website. Wir lesen dein Impressum und füllen die Vertragsdaten für dich aus.',
    'Tipp an, was passt. Mehrfach ist gut.',
    'Wir haben dich vorbelegt.',
    'Wir haben schon vorbelegt. Stimmt etwas nicht, tipp auf „Anders“.',
    'Jede Zeile lässt sich noch ändern. Unterschrieben wird erst im nächsten Schritt.',
  ][step];
  const icons = [Building2, Briefcase, PenLine, MessageSquare, FileText];
  const Icon = icons[step];
  const summaryRows: [string, string, number][] = [
    ['Vertragspartner', [profile.company, profile.legalForm].filter(Boolean).join(' · '), 0], ['Anschrift', [profile.address, profile.country].filter(Boolean).join(', '), 0],
    ['Register', stripSource(d.businessEvidence), 0], ['Steuer', [taxLabels[profile.taxStatus], stripSource(d.taxNumber)].filter(Boolean).join(' · '), 0],
    ['Schwerpunkt', [...x.areas, ...x.subareas, ...x.extras].join(', ') || profile.specialty, 1], ['Regionen', x.regions.join(', ') || profile.region, 1], ['Erfahrung', [x.experience, x.placements && `${x.placements} Besetzungen/Jahr`].filter(Boolean).join(' · '), 1],
    ['Unterschrift', [profile.signer, profile.signerRole].filter(Boolean).join(', '), 2],
    ['Datenzugriff', d.accessCountries, 3], ['Erlaubnisse', d.permitsDeclaration, 3], ['Einkünfte', d.incomeConcentration, 3], ['Beteiligungen', d.dualRole, 3],
    ['Datenschutz', d.privacyContact, 3], ['Abrechnung', d.creditNoteConsent ? 'Gutschriftverfahren' : 'Eigene Rechnung', 3],
  ];
  const doneRows: [number, string][] = [
    [0, [profile.company, profile.address?.split(',').pop()?.trim()].filter(Boolean).join(' · ')],
    [1, [...x.areas, ...x.extras].slice(0, 3).join(', ') + (x.regions.length ? ' · ' + x.regions.join(', ') : '')],
    [2, signSelf ? 'Du unterschreibst selbst' : `${profile.signer} unterschreibt`],
    [3, 'Vier Fragen beantwortet'],
  ];

  return <section className="mh-panel">
    <div className="mh-panel-head"><Icon size={22}/><div><h2 ref={heading} tabIndex={-1}>{stepTitle}</h2><p>{stepLead}</p></div></div>
    <nav className="mh-substeps" aria-label="Abschnitte deiner Angaben">{STEPS.map((label, i) => <button key={label} type="button" disabled={busy || i > reached} aria-current={i === step ? 'step' : undefined} onClick={() => { setStep(i); setIssues([]); }}>{i < step ? '✓' : i + 1} · {label}</button>)}</nav>
    {step > 0 && step < 4 && <ul className="mh-done-list">{doneRows.filter(([i]) => i < step).map(([i, text]) => <li key={i}><Check size={14}/><span>{text || STEPS[i]}</span><button type="button" className="mh-link" disabled={busy} onClick={() => { setStep(i); setIssues([]); }}>ändern</button></li>)}</ul>}
    {issues.length > 0 && <div role="alert" className="mh-alert mh-error"><strong>Bitte ergänze noch:</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <fieldset disabled={busy} className="mh-form-fields">

      {step === 0 && <div className="mh-stack">
        {companyMode === 'auto' && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>Wir lesen dein Impressum …</p>}
        {companyMode === 'website' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void readImpressum(website); }}>
          {enrichError && <p role="alert" className="mh-alert mh-error">{enrichError}</p>}
          <label className="mh-field">Website oder Firmenname<input type="text" autoComplete="url" placeholder="deine-firma.de" value={website} onChange={e => setWebsite(e.target.value)}/></label>
          <button className="mh-button mh-primary mh-full" type="submit" disabled={enriching || !website.trim()}>{enriching ? <Loader2 size={16} className="animate-spin"/> : <Globe size={16}/>}{enriching ? 'Wir lesen dein Impressum …' : 'Impressum lesen'}</button>
          <button className="mh-link" type="button" onClick={openManual}>Keine Website? Angaben selbst eintragen</button>
        </form>}
        {companyMode === 'result' && <>
          <dl className="mh-facts">
            <div><dt>Firmierung</dt><dd>{profile.company || '—'}{profile.legalForm && <span className="mh-tag">{profile.legalForm}</span>}</dd></div>
            <div><dt>Anschrift</dt><dd>{[profile.address, profile.country].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>Register</dt><dd>{stripSource(d.businessEvidence) || '—'}</dd></div>
            <div><dt>Steuer</dt><dd>{[taxLabels[profile.taxStatus], stripSource(d.taxNumber)].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>Vertreten durch</dt><dd>{d.responsiblePerson || '—'}</dd></div>
          </dl>
          {fromImpressum && <p className="mh-muted mh-verify-hint">Aus deinem Impressum übernommen. Matchunt prüft die Angaben vor der Gegenzeichnung.</p>}
          <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmCompany}><Check size={16}/>Stimmt so</button><button type="button" className="mh-button" onClick={openManual}>Etwas stimmt nicht</button></div>
        </>}
        {companyMode === 'manual' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); confirmCompany(); }}>
          <label className="mh-field">Firmierung<input type="text" autoComplete="organization" value={profile.company} onChange={e => patch({ company: e.target.value })}/></label>
          <div className="mh-field"><span>Rechtsform</span><Chips options={LEGAL_FORMS} value={[profile.legalForm]} onToggle={v => patch({ legalForm: v })}/></div>
          <label className="mh-field">Anschrift<input type="text" autoComplete="street-address" placeholder="Straße Nr., PLZ Ort" value={profile.address} onChange={e => patch({ address: e.target.value })}/></label>
          <div className="mh-field"><span>Sitzland</span><Chips options={[...COUNTRIES, 'Anderes Land']} value={[COUNTRIES.includes(profile.country as typeof COUNTRIES[number]) ? profile.country : profile.country ? 'Anderes Land' : '']} onToggle={v => patch({ country: v === 'Anderes Land' ? '' : v, taxStatus: v === 'Deutschland' ? (profile.taxStatus === 'foreign' ? '' : profile.taxStatus) : v === 'Anderes Land' ? profile.taxStatus : 'foreign' })}/></div>
          {!COUNTRIES.includes(profile.country as typeof COUNTRIES[number]) && <label className="mh-field">Land<input type="text" value={profile.country} onChange={e => patch({ country: e.target.value, taxStatus: e.target.value ? 'foreign' : '' })}/></label>}
          {profile.country === 'Deutschland' ? <>
            <div className="mh-field"><span>Umsatzsteuer</span><Chips options={['USt-IdNr. vorhanden', 'Kleinunternehmer']} value={[profile.taxStatus === 'regular' ? 'USt-IdNr. vorhanden' : profile.taxStatus === 'small_business' ? 'Kleinunternehmer' : '']} onToggle={v => patch({ taxStatus: v === 'Kleinunternehmer' ? 'small_business' : 'regular' })}/></div>
            {profile.taxStatus === 'regular' && <label className="mh-field">USt-IdNr.<input type="text" placeholder="DE123456789" value={manual.vat} onChange={e => setManual({ ...manual, vat: e.target.value })}/></label>}
          </> : profile.country ? <label className="mh-field">Steuernummer oder UID<input type="text" value={manual.vat} onChange={e => setManual({ ...manual, vat: e.target.value })}/></label> : null}
          <label className="mh-field">{solo ? 'Registernummer, falls vorhanden' : 'Registergericht und Nummer'}<input type="text" placeholder={solo ? 'optional' : 'Amtsgericht Hamburg, HRB 12345'} value={manual.register} onChange={e => setManual({ ...manual, register: e.target.value })}/></label>
          <label className="mh-field">Vertreten durch<input type="text" value={manual.ceo} onChange={e => setManual({ ...manual, ceo: e.target.value })}/></label>
          <div className="mh-actions"><button type="submit" className="mh-button mh-primary">Weiter<ArrowRight size={16}/></button></div>
        </form>}
      </div>}

      {step === 1 && <div className="mh-stack">
        <div className="mh-field"><span>Bereiche</span><Chips options={EXPERTISE_AREAS.map(a => a.label)} value={x.areas} onToggle={v => patchExpertise({ areas: toggleIn(x.areas, v) })}/>
          {x.extras.length > 0 && <Chips options={x.extras} value={x.extras} onToggle={v => patchExpertise({ extras: toggleIn(x.extras, v) })}/>}
        </div>
        {EXPERTISE_AREAS.filter(a => x.areas.includes(a.label)).map(a => <div className="mh-field mh-sub" key={a.key}><span>↳ {a.label}</span><Chips options={a.sub} value={x.subareas} onToggle={v => patchExpertise({ subareas: toggleIn(x.subareas, v) })}/></div>)}
        <div className="mh-field"><span>Ebene</span><Chips options={EXPERTISE_LEVELS} value={x.levels} onToggle={v => patchExpertise({ levels: toggleIn(x.levels, v) })}/></div>
        <div className="mh-field"><span>Unternehmen</span><Chips options={COMPANY_TYPES} value={x.companyTypes} onToggle={v => patchExpertise({ companyTypes: toggleIn(x.companyTypes, v) })}/></div>
        <div className="mh-field"><span>Regionen</span><Chips options={REGIONS} value={x.regions} onToggle={v => patchExpertise({ regions: toggleIn(x.regions, v) })}/></div>
        <div className="mh-field"><span>Sprachen</span><Chips options={LANGUAGES} value={x.languages} onToggle={v => patchExpertise({ languages: toggleIn(x.languages, v) })}/></div>
        <div className="mh-divider"/><h3>Wie arbeitest du?</h3>
        <div className="mh-field"><span>Vorgehen</span><Chips options={METHODS} value={x.methods} onToggle={v => patchExpertise({ methods: toggleIn(x.methods, v) })}/></div>
        <div className="mh-field"><span>Erfahrung</span><Chips options={EXPERIENCE_BANDS} value={[x.experience]} onToggle={v => patchExpertise({ experience: v })}/></div>
        <div className="mh-field"><span>Besetzungen pro Jahr</span><Chips options={PLACEMENT_BANDS} value={[x.placements]} onToggle={v => patchExpertise({ placements: v })}/></div>
        <div className="mh-field"><span>Parallel betreute Suchen</span><Chips options={PARALLEL_BANDS} value={[x.parallel]} onToggle={v => patchExpertise({ parallel: v })}/></div>
        <label className="mh-field">LinkedIn-Profil · optional<input type="url" placeholder="linkedin.com/in/…" value={x.linkedin} onChange={e => patchExpertise({ linkedin: e.target.value })}/><small>Zum Einfügen. Hilft uns bei der Prüfung.</small></label>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmExpertise}>Weiter<ArrowRight size={16}/></button></div>
      </div>}

      {step === 2 && <div className="mh-stack">
        <div className="mh-choices">
          <button type="button" className="mh-choice" aria-pressed={signSelf} onClick={chooseSelf}><PenLine size={21}/><span><strong>Ja, ich unterschreibe.</strong><small>{profile.name}{profile.signerRole && signSelf ? ` · ${profile.signerRole}` : ''}{ceoMatch ? ' · laut Impressum vertretungsberechtigt' : ''}</small></span></button>
          <button type="button" className="mh-choice" aria-pressed={!signSelf} onClick={chooseOther}><Building2 size={21}/><span><strong>Nein, jemand anderes unterschreibt.</strong><small>Die Person bekommt ihren eigenen DocuSign-Zugang per E-Mail.</small></span></button>
        </div>
        {signSelf ? <div className="mh-field"><span>Deine Funktion</span><Chips options={SIGNER_ROLES} value={[profile.signerRole]} onToggle={v => patch({ signerRole: v })}/></div>
        : <div className="mh-grid">
          <label className="mh-field">Name<input type="text" value={profile.signer} onChange={e => patch({ signer: e.target.value })}/></label>
          <label className="mh-field">E-Mail<input type="email" value={profile.signerEmail} onChange={e => patch({ signerEmail: e.target.value })}/></label>
          <label className="mh-field">Funktion<input type="text" placeholder="Geschäftsführer" value={profile.signerRole} onChange={e => patch({ signerRole: e.target.value })}/></label>
        </div>}
        <label className="mh-check"><input type="checkbox" checked={profile.authorityDeclared} onChange={e => patch({ authorityDeclared: e.target.checked })}/><span>{signSelf ? `Ich bin berechtigt, für ${profile.company || 'mein Unternehmen'} zu unterschreiben.` : `Die genannte Person ist berechtigt, für ${profile.company || 'das Unternehmen'} zu unterschreiben.`} Matchunt prüft das vor der Gegenzeichnung.</span></label>
        {agency && <label className="mh-field">Wer arbeitet bei euch mit Matchunt?<textarea value={d.userAuthorities} onChange={e => patchDetails({ userAuthorities: e.target.value })}/><small>Name, E-Mail und Befugnis je Person. Zugänge für das Team richten wir nach der Freischaltung ein.</small></label>}
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmSigner}>Weiter<ArrowRight size={16}/></button></div>
      </div>}

      {step === 3 && <div className="mh-stack">
        {QUESTIONS.map(q => <div className="mh-question" key={q.key}>
          <p>{q.text}</p>
          <div className="mh-question-actions">
            <button type="button" className="mh-chip" aria-pressed={!other[q.key] && d[q.key] === q.def(profile)} onClick={() => answerYes(q)}>Ja, so ist es</button>
            <button type="button" className="mh-chip" aria-pressed={!!other[q.key]} onClick={() => answerOther(q)}>Anders</button>
          </div>
          {other[q.key] && <label className="mh-field">{q.other}<textarea value={d[q.key] === q.def(profile) ? '' : d[q.key]} onChange={e => patchDetails({ [q.key]: e.target.value } as Partial<ContractDetails>)}/></label>}
        </div>)}
        <div className="mh-divider"/>
        <div className="mh-question"><p>Datenschutz-Ansprechpartner: <strong>{d.privacyContact || profile.name}</strong> <button type="button" className="mh-link" onClick={() => setEditPrivacy(v => !v)}><PenLine size={13}/>ändern</button></p>
          {editPrivacy && <label className="mh-field">Ansprechpartner für Datenschutz<input type="text" value={d.privacyContact} onChange={e => patchDetails({ privacyContact: e.target.value })}/></label>}
        </div>
        <label className="mh-check"><input type="checkbox" checked={d.creditNoteConsent} onChange={e => patchDetails({ creditNoteConsent: e.target.checked })}/><span>Abrechnung per Gutschrift: Matchunt rechnet deine Vergütung ab, du schreibst keine Rechnung. Ohne Haken stellst du selbst Rechnungen.</span></label>
        <details><summary>Sichtbarkeit, freiwillig</summary><div className="mh-stack">
          {([['directoryConsent', 'Aufnahme in das öffentliche Partnerverzeichnis'], ['profilePublicationConsent', 'Veröffentlichung meines Fotos und meiner Profil-Links'], ['marketingConsent', 'Nennung in Beiträgen von Matchunt']] as const).map(([k, label]) => <label className="mh-check" key={k}><input type="checkbox" checked={d[k]} onChange={e => patchDetails({ [k]: e.target.checked } as Partial<ContractDetails>)}/>{label}</label>)}
          <p className="mh-muted">Freiwillig und jederzeit für die Zukunft widerruflich. Deine Auswahl beeinflusst den Vertrag nicht.</p>
        </div></details>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmQuestions}>Weiter<ArrowRight size={16}/></button></div>
      </div>}

      {step === 4 && <div className="mh-stack">
        <dl className="mh-facts mh-summary">{summaryRows.map(([label, value, target]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}<button type="button" className="mh-link" aria-label={`${label} ändern`} onClick={() => { setStep(target); setIssues([]); }}><PenLine size={13}/></button></dd></div>)}</dl>
        <div className="mh-note"><ShieldCheck size={20}/><p>Mit der Bestätigung erstellen wir dein Vertragspaket. Unterschrieben wird erst im nächsten Schritt in DocuSign. Danach prüft Matchunt deine Angaben und zeichnet gegen.</p></div>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={finish}><Check size={16}/>Angaben bestätigen</button></div>
      </div>}

    </fieldset>
    <button className="mh-link" type="button" disabled={busy} onClick={() => void onSave()}><Save size={14}/>Entwurf speichern & später fortsetzen</button>
  </section>;
}

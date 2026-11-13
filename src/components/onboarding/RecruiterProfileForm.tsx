import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
const NS = 'recruiterFunnel';
const STEP_KEYS = ['company', 'expertise', 'signer', 'questions', 'summary'] as const;
// Die vorbelegten Antworten (def) gehen so ins Datenblatt und bleiben deshalb deutsch;
// Frage und Rückfrage stehen in den Sprachdateien unter form.questions.<key>.
const QUESTIONS = [
  { key: 'accessCountries', def: (p: RecruiterProfile) => p.country || 'Deutschland' },
  { key: 'permitsDeclaration', def: () => 'Ausschließlich Personalvermittlung, keine Arbeitnehmerüberlassung; keine Erlaubnis nach AÜG erforderlich.' },
  { key: 'incomeConcentration', def: () => 'Nein, unter der Hälfte der Erwerbseinkünfte.' },
  { key: 'dualRole', def: () => 'Keine.' },
] as const;
// Meldungen der gemeinsamen Prüfregeln (Server und Formular) kommen deutsch; hier ihre Schlüssel.
const SHARED_ISSUES: Record<string, string> = {
  'Bitte mindestens einen Bereich antippen, den du besetzt.': 'form.issues.area',
  'Bitte mindestens eine Region antippen.': 'form.issues.region',
  'Bitte deine Erfahrung antippen.': 'form.issues.experience',
  'Vertragsdaten bitte vollständig ergänzen.': 'form.issues.incomplete',
  'E-Mail der unterzeichnenden Person fehlt.': 'form.issues.signerEmail',
  'Vertretungsberechtigung bitte angeben.': 'form.issues.authorityMissing',
  'Steuerstatus ist noch offen.': 'form.issues.taxOpen',
};
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

/** `label` übersetzt nur die Anzeige; gespeichert und verglichen wird der Wert selbst. */
function Chips({ options, value, onToggle, label }: { options: readonly string[]; value: string[]; onToggle: (v: string) => void; label?: (v: string) => string }) {
  return <div className="mh-chips">{options.map(o => <button key={o} type="button" className="mh-chip" aria-pressed={value.includes(o)} onClick={() => onToggle(o)}>{label ? label(o) : o}</button>)}</div>;
}
const toggleIn = (list: string[], v: string) => list.includes(v) ? list.filter(i => i !== v) : [...list, v];

export default function RecruiterProfileForm({ profile, kind, busy, email, onChange, onSave, onSubmit, onEnrich }: {
  profile: RecruiterProfile; kind: string; busy: boolean; email: string;
  onChange: (p: RecruiterProfile) => void;
  onSave: (silent?: boolean, snapshot?: RecruiterProfile) => Promise<void>;
  onSubmit: () => Promise<void>;
  onEnrich: (website?: string) => Promise<CompanySuggestion>;
}) {
  const { t } = useTranslation(NS);
  // Anzeige der antippbaren Werte in der gewählten Sprache; fehlt ein Eintrag, steht der gespeicherte Wert.
  const dict = (key: 'options' | 'roles') => { const m = t(key, { returnObjects: true }) as unknown; return m && typeof m === 'object' ? m as Record<string, string> : {}; };
  const options = dict('options');
  const roles = dict('roles');
  const opt = (v: string) => options[v] ?? v;
  const roleLabel = (v: string) => roles[v] ?? v;
  const list = (values: string[]) => values.map(opt).join(', ');
  const taxLabel = (status: string) => status in taxLabels ? t(`form.tax.${status}`) : '';
  const sharedIssue = (issue: string) => SHARED_ISSUES[issue] ? t(SHARED_ISSUES[issue]) : issue;
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
      // Der Server meldet „Website fehlt“ in der Sprache der Person; diese Meldung ist hier kein Fehler.
      if (!/Website deines Unternehmens|your company website|ditt företags webbplats|nettstedet til firmaet ditt/.test(message)) setEnrichError(message || t('form.company.readFailed'));
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
    if (!profile.company) missing.push(t('form.issues.company'));
    if (!profile.legalForm) missing.push(t('form.issues.legalForm'));
    if (!profile.address) missing.push(t('form.issues.address'));
    if (!profile.country) missing.push(t('form.issues.country'));
    if (!['regular', 'small_business', 'foreign'].includes(profile.taxStatus)) missing.push(t('form.issues.taxStatus'));
    if (missing.length) { if (companyMode === 'result') openManual(); setIssues(missing); return; }
    let next = profile;
    if (companyMode === 'manual') {
      const register = manual.register.trim();
      next = update({ ...profile, contractDetails: { ...d,
        businessEvidence: register ? (/^(HRA|HRB|GnR|PR|VR)/i.test(register) ? `Handelsregister ${register}` : register) : (solo ? `Selbstständige Tätigkeit als ${profile.legalForm}` : d.businessEvidence),
        taxNumber: profile.taxStatus === 'small_business' ? SMALL_BUSINESS_TAX : manual.vat.trim() ? (profile.country === 'Deutschland' ? `USt-IdNr. ${manual.vat.trim().toUpperCase()}` : `Steuernummer / UID ${manual.vat.trim()}`) : d.taxNumber,
        responsiblePerson: manual.ceo.trim() || profile.name,
      } });
      if (!next.contractDetails?.businessEvidence) { setIssues([t('form.issues.register')]); return; }
      if (!next.contractDetails?.taxNumber) { setIssues([t(profile.country === 'Deutschland' ? 'form.issues.vatId' : 'form.issues.taxNumber')]); return; }
    }
    move(1, next);
  };

  // Karte 2: Chips. Freitext aus der Einladung wird einmal auf Chips abgebildet.
  useEffect(() => {
    const empty = !x.areas.length && !x.regions.length && !x.extras.length && !x.experience;
    if (empty && (profile.specialty || profile.region)) update({ ...profile, expertise: expertiseFromText(profile.specialty, profile.region) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const confirmExpertise = () => { const missing = expertiseIssues(x).map(sharedIssue); if (missing.length) { setIssues(missing); return; } move(2); };

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
    if (!profile.signer) missing.push(t('form.issues.signer'));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.signerEmail)) missing.push(t('form.issues.signerEmail'));
    if (!profile.signerRole) missing.push(t('form.issues.signerRole'));
    if (!profile.authorityDeclared) missing.push(t('form.issues.authority'));
    if (agency && !d.userAuthorities.trim()) missing.push(t('form.issues.users'));
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
    const missing = QUESTIONS.filter(q => !d[q.key].trim()).map(q => t('form.issues.answer', { question: t(`form.questions.${q.key}.text`) }));
    if (!d.privacyContact.trim()) missing.push(t('form.issues.privacyContact'));
    if (missing.length) { setIssues(missing); return; }
    move(4);
  };

  // Karte 5: bestätigen.
  const finish = () => {
    const missing = [...contractDataIssues(profile, kind), ...expertiseIssues(x)].map(sharedIssue);
    if (missing.length) { setIssues(missing); return; }
    void onSubmit();
  };

  const stepTitle = t(`form.title.${STEP_KEYS[step]}`);
  const stepLead = [
    companyMode === 'result' ? (fromImpressum ? t('form.lead.companyFound') : t('form.lead.companyKnown'))
      : companyMode === 'manual' ? t('form.lead.companyManual')
      : companyMode === 'auto' ? t('form.lead.companyAuto')
      : t('form.lead.companyWebsite'),
    t('form.lead.expertise'),
    t('form.lead.signer'),
    t('form.lead.questions'),
    t('form.lead.summary'),
  ][step];
  const icons = [Building2, Briefcase, PenLine, MessageSquare, FileText];
  const Icon = icons[step];
  // Vorbelegte Antworten erscheinen in der gewählten Sprache; eigene Antworten so, wie sie eingegeben wurden.
  const answer = (q: typeof QUESTIONS[number]) => d[q.key] !== q.def(profile) ? d[q.key] : q.key === 'accessCountries' ? opt(d[q.key]) : t(`form.questions.${q.key}.answer`);
  const summaryRows: [string, string, number][] = [
    [t('form.summary.partner'), [profile.company, opt(profile.legalForm)].filter(Boolean).join(' · '), 0], [t('form.summary.address'), [profile.address, opt(profile.country)].filter(Boolean).join(', '), 0],
    [t('form.summary.register'), stripSource(d.businessEvidence), 0], [t('form.summary.tax'), [taxLabel(profile.taxStatus), stripSource(d.taxNumber)].filter(Boolean).join(' · '), 0],
    [t('form.summary.focus'), list([...x.areas, ...x.subareas, ...x.extras]) || profile.specialty, 1], [t('form.summary.regions'), list(x.regions) || profile.region, 1], [t('form.summary.experience'), [opt(x.experience), x.placements && t('form.summary.placementsPerYear', { band: opt(x.placements) })].filter(Boolean).join(' · '), 1],
    [t('form.summary.signature'), [profile.signer, roleLabel(profile.signerRole)].filter(Boolean).join(', '), 2],
    [t('form.summary.dataAccess'), answer(QUESTIONS[0]), 3], [t('form.summary.permits'), answer(QUESTIONS[1]), 3], [t('form.summary.income'), answer(QUESTIONS[2]), 3], [t('form.summary.holdings'), answer(QUESTIONS[3]), 3],
    [t('form.summary.privacy'), d.privacyContact, 3], [t('form.summary.billing'), d.creditNoteConsent ? t('form.summary.creditNote') : t('form.summary.ownInvoice'), 3],
  ];
  const doneRows: [number, string][] = [
    [0, [profile.company, profile.address?.split(',').pop()?.trim()].filter(Boolean).join(' · ')],
    [1, list([...x.areas, ...x.extras].slice(0, 3)) + (x.regions.length ? ' · ' + list(x.regions) : '')],
    [2, signSelf ? t('form.done.selfSigns') : t('form.done.otherSigns', { name: profile.signer })],
    [3, t('form.done.questions')],
  ];

  return <section className="mh-panel">
    <div className="mh-panel-head"><Icon size={22}/><div><h2 ref={heading} tabIndex={-1}>{stepTitle}</h2><p>{stepLead}</p></div></div>
    <nav className="mh-substeps" aria-label={t('form.substepsAria')}>{STEP_KEYS.map((key, i) => <button key={key} type="button" disabled={busy || i > reached} aria-current={i === step ? 'step' : undefined} onClick={() => { setStep(i); setIssues([]); }}>{i < step ? '✓' : i + 1} · {t(`form.steps.${key}`)}</button>)}</nav>
    {step > 0 && step < 4 && <ul className="mh-done-list">{doneRows.filter(([i]) => i < step).map(([i, text]) => <li key={i}><Check size={14}/><span>{text || t(`form.steps.${STEP_KEYS[i]}`)}</span><button type="button" className="mh-link" disabled={busy} onClick={() => { setStep(i); setIssues([]); }}>{t('common.change')}</button></li>)}</ul>}
    {issues.length > 0 && <div role="alert" className="mh-alert mh-error"><strong>{t('form.issuesTitle')}</strong><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
    <fieldset disabled={busy} className="mh-form-fields">

      {step === 0 && <div className="mh-stack">
        {companyMode === 'auto' && <p className="mh-muted mh-verify-busy"><Loader2 size={14} className="animate-spin"/>{t('form.company.reading')}</p>}
        {companyMode === 'website' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); void readImpressum(website); }}>
          {enrichError && <p role="alert" className="mh-alert mh-error">{enrichError}</p>}
          <label className="mh-field">{t('form.company.website')}<input type="text" autoComplete="url" placeholder={t('form.company.websitePlaceholder')} value={website} onChange={e => setWebsite(e.target.value)}/></label>
          <button className="mh-button mh-primary mh-full" type="submit" disabled={enriching || !website.trim()}>{enriching ? <Loader2 size={16} className="animate-spin"/> : <Globe size={16}/>}{enriching ? t('form.company.reading') : t('form.company.read')}</button>
          <button className="mh-link" type="button" onClick={openManual}>{t('form.company.noWebsite')}</button>
        </form>}
        {companyMode === 'result' && <>
          <dl className="mh-facts">
            <div><dt>{t('form.company.name')}</dt><dd>{profile.company || '—'}{profile.legalForm && <span className="mh-tag">{opt(profile.legalForm)}</span>}</dd></div>
            <div><dt>{t('form.company.address')}</dt><dd>{[profile.address, opt(profile.country)].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>{t('form.company.register')}</dt><dd>{stripSource(d.businessEvidence) || '—'}</dd></div>
            <div><dt>{t('form.company.tax')}</dt><dd>{[taxLabel(profile.taxStatus), stripSource(d.taxNumber)].filter(Boolean).join(' · ') || '—'}</dd></div>
            <div><dt>{t('form.company.representedBy')}</dt><dd>{d.responsiblePerson || '—'}</dd></div>
          </dl>
          {fromImpressum && <p className="mh-muted mh-verify-hint">{t('form.company.fromImprint')}</p>}
          <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmCompany}><Check size={16}/>{t('form.company.correct')}</button><button type="button" className="mh-button" onClick={openManual}>{t('form.company.incorrect')}</button></div>
        </>}
        {companyMode === 'manual' && <form className="mh-stack" onSubmit={e => { e.preventDefault(); confirmCompany(); }}>
          <label className="mh-field">{t('form.company.name')}<input type="text" autoComplete="organization" value={profile.company} onChange={e => patch({ company: e.target.value })}/></label>
          <div className="mh-field"><span>{t('form.company.legalForm')}</span><Chips options={LEGAL_FORMS} label={opt} value={[profile.legalForm]} onToggle={v => patch({ legalForm: v })}/></div>
          <label className="mh-field">{t('form.company.address')}<input type="text" autoComplete="street-address" placeholder={t('form.company.addressPlaceholder')} value={profile.address} onChange={e => patch({ address: e.target.value })}/></label>
          <div className="mh-field"><span>{t('form.company.seat')}</span><Chips options={[...COUNTRIES, 'Anderes Land']} label={v => v === 'Anderes Land' ? t('form.company.otherCountry') : opt(v)} value={[COUNTRIES.includes(profile.country as typeof COUNTRIES[number]) ? profile.country : profile.country ? 'Anderes Land' : '']} onToggle={v => patch({ country: v === 'Anderes Land' ? '' : v, taxStatus: v === 'Deutschland' ? (profile.taxStatus === 'foreign' ? '' : profile.taxStatus) : v === 'Anderes Land' ? profile.taxStatus : 'foreign' })}/></div>
          {!COUNTRIES.includes(profile.country as typeof COUNTRIES[number]) && <label className="mh-field">{t('form.company.country')}<input type="text" value={profile.country} onChange={e => patch({ country: e.target.value, taxStatus: e.target.value ? 'foreign' : '' })}/></label>}
          {profile.country === 'Deutschland' ? <>
            <div className="mh-field"><span>{t('form.company.vat')}</span><Chips options={['USt-IdNr. vorhanden', 'Kleinunternehmer']} label={v => v === 'Kleinunternehmer' ? t('form.company.smallBusiness') : t('form.company.vatHas')} value={[profile.taxStatus === 'regular' ? 'USt-IdNr. vorhanden' : profile.taxStatus === 'small_business' ? 'Kleinunternehmer' : '']} onToggle={v => patch({ taxStatus: v === 'Kleinunternehmer' ? 'small_business' : 'regular' })}/></div>
            {profile.taxStatus === 'regular' && <label className="mh-field">{t('form.company.vatId')}<input type="text" placeholder={t('form.company.vatPlaceholder')} value={manual.vat} onChange={e => setManual({ ...manual, vat: e.target.value })}/></label>}
          </> : profile.country ? <label className="mh-field">{t('form.company.taxNumber')}<input type="text" value={manual.vat} onChange={e => setManual({ ...manual, vat: e.target.value })}/></label> : null}
          <label className="mh-field">{solo ? t('form.company.registerOptional') : t('form.company.registerCourt')}<input type="text" placeholder={solo ? t('form.company.optional') : t('form.company.registerPlaceholder')} value={manual.register} onChange={e => setManual({ ...manual, register: e.target.value })}/></label>
          <label className="mh-field">{t('form.company.representedBy')}<input type="text" value={manual.ceo} onChange={e => setManual({ ...manual, ceo: e.target.value })}/></label>
          <div className="mh-actions"><button type="submit" className="mh-button mh-primary">{t('common.next')}<ArrowRight size={16}/></button></div>
        </form>}
      </div>}

      {step === 1 && <div className="mh-stack">
        <div className="mh-field"><span>{t('form.expertise.areas')}</span><Chips options={EXPERTISE_AREAS.map(a => a.label)} label={opt} value={x.areas} onToggle={v => patchExpertise({ areas: toggleIn(x.areas, v) })}/>
          {x.extras.length > 0 && <Chips options={x.extras} value={x.extras} onToggle={v => patchExpertise({ extras: toggleIn(x.extras, v) })}/>}
        </div>
        {EXPERTISE_AREAS.filter(a => x.areas.includes(a.label)).map(a => <div className="mh-field mh-sub" key={a.key}><span>↳ {opt(a.label)}</span><Chips options={a.sub} label={opt} value={x.subareas} onToggle={v => patchExpertise({ subareas: toggleIn(x.subareas, v) })}/></div>)}
        <div className="mh-field"><span>{t('form.expertise.level')}</span><Chips options={EXPERTISE_LEVELS} label={opt} value={x.levels} onToggle={v => patchExpertise({ levels: toggleIn(x.levels, v) })}/></div>
        <div className="mh-field"><span>{t('form.expertise.companies')}</span><Chips options={COMPANY_TYPES} label={opt} value={x.companyTypes} onToggle={v => patchExpertise({ companyTypes: toggleIn(x.companyTypes, v) })}/></div>
        <div className="mh-field"><span>{t('form.expertise.regions')}</span><Chips options={REGIONS} label={opt} value={x.regions} onToggle={v => patchExpertise({ regions: toggleIn(x.regions, v) })}/></div>
        <div className="mh-field"><span>{t('form.expertise.languages')}</span><Chips options={LANGUAGES} label={opt} value={x.languages} onToggle={v => patchExpertise({ languages: toggleIn(x.languages, v) })}/></div>
        <div className="mh-divider"/><h3>{t('form.expertise.howTitle')}</h3>
        <div className="mh-field"><span>{t('form.expertise.methods')}</span><Chips options={METHODS} label={opt} value={x.methods} onToggle={v => patchExpertise({ methods: toggleIn(x.methods, v) })}/></div>
        <div className="mh-field"><span>{t('form.expertise.experience')}</span><Chips options={EXPERIENCE_BANDS} label={opt} value={[x.experience]} onToggle={v => patchExpertise({ experience: v })}/></div>
        <div className="mh-field"><span>{t('form.expertise.placements')}</span><Chips options={PLACEMENT_BANDS} label={opt} value={[x.placements]} onToggle={v => patchExpertise({ placements: v })}/></div>
        <div className="mh-field"><span>{t('form.expertise.parallel')}</span><Chips options={PARALLEL_BANDS} label={opt} value={[x.parallel]} onToggle={v => patchExpertise({ parallel: v })}/></div>
        <label className="mh-field">{t('form.expertise.linkedin')}<input type="url" placeholder={t('form.expertise.linkedinPlaceholder')} value={x.linkedin} onChange={e => patchExpertise({ linkedin: e.target.value })}/><small>{t('form.expertise.linkedinHint')}</small></label>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmExpertise}>{t('common.next')}<ArrowRight size={16}/></button></div>
      </div>}

      {step === 2 && <div className="mh-stack">
        <div className="mh-choices">
          <button type="button" className="mh-choice" aria-pressed={signSelf} onClick={chooseSelf}><PenLine size={21}/><span><strong>{t('form.signer.self')}</strong><small>{profile.name}{profile.signerRole && signSelf ? ` · ${roleLabel(profile.signerRole)}` : ''}{ceoMatch ? ` · ${t('form.signer.authorisedPerImprint')}` : ''}</small></span></button>
          <button type="button" className="mh-choice" aria-pressed={!signSelf} onClick={chooseOther}><Building2 size={21}/><span><strong>{t('form.signer.other')}</strong><small>{t('form.signer.otherText')}</small></span></button>
        </div>
        {signSelf ? <div className="mh-field"><span>{t('form.signer.yourRole')}</span><Chips options={SIGNER_ROLES} label={roleLabel} value={[profile.signerRole]} onToggle={v => patch({ signerRole: v })}/></div>
        : <div className="mh-grid">
          <label className="mh-field">{t('form.signer.name')}<input type="text" value={profile.signer} onChange={e => patch({ signer: e.target.value })}/></label>
          <label className="mh-field">{t('form.signer.email')}<input type="email" value={profile.signerEmail} onChange={e => patch({ signerEmail: e.target.value })}/></label>
          <label className="mh-field">{t('form.signer.role')}<input type="text" placeholder={t('form.signer.rolePlaceholder')} value={profile.signerRole} onChange={e => patch({ signerRole: e.target.value })}/></label>
        </div>}
        <label className="mh-check"><input type="checkbox" checked={profile.authorityDeclared} onChange={e => patch({ authorityDeclared: e.target.checked })}/><span>{signSelf ? t('form.signer.authoritySelf', { company: profile.company || t('form.signer.myCompany') }) : t('form.signer.authorityOther', { company: profile.company || t('form.signer.theCompany') })}</span></label>
        {agency && <label className="mh-field">{t('form.signer.users')}<textarea value={d.userAuthorities} onChange={e => patchDetails({ userAuthorities: e.target.value })}/><small>{t('form.signer.usersHint')}</small></label>}
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmSigner}>{t('common.next')}<ArrowRight size={16}/></button></div>
      </div>}

      {step === 3 && <div className="mh-stack">
        {QUESTIONS.map(q => <div className="mh-question" key={q.key}>
          <p>{t(`form.questions.${q.key}.text`)}</p>
          <div className="mh-question-actions">
            <button type="button" className="mh-chip" aria-pressed={!other[q.key] && d[q.key] === q.def(profile)} onClick={() => answerYes(q)}>{t('form.questions.yes')}</button>
            <button type="button" className="mh-chip" aria-pressed={!!other[q.key]} onClick={() => answerOther(q)}>{t('form.questions.different')}</button>
          </div>
          {other[q.key] && <label className="mh-field">{t(`form.questions.${q.key}.other`)}<textarea value={d[q.key] === q.def(profile) ? '' : d[q.key]} onChange={e => patchDetails({ [q.key]: e.target.value } as Partial<ContractDetails>)}/></label>}
        </div>)}
        <div className="mh-divider"/>
        <div className="mh-question"><p>{t('form.questions.privacyContactLabel')} <strong>{d.privacyContact || profile.name}</strong> <button type="button" className="mh-link" onClick={() => setEditPrivacy(v => !v)}><PenLine size={13}/>{t('common.change')}</button></p>
          {editPrivacy && <label className="mh-field">{t('form.questions.privacyContactField')}<input type="text" value={d.privacyContact} onChange={e => patchDetails({ privacyContact: e.target.value })}/></label>}
        </div>
        <label className="mh-check"><input type="checkbox" checked={d.creditNoteConsent} onChange={e => patchDetails({ creditNoteConsent: e.target.checked })}/><span>{t('form.questions.creditNote')}</span></label>
        <details><summary>{t('form.questions.visibility')}</summary><div className="mh-stack">
          {(['directoryConsent', 'profilePublicationConsent', 'marketingConsent'] as const).map(k => <label className="mh-check" key={k}><input type="checkbox" checked={d[k]} onChange={e => patchDetails({ [k]: e.target.checked } as Partial<ContractDetails>)}/>{t(`form.questions.${k}`)}</label>)}
          <p className="mh-muted">{t('form.questions.voluntary')}</p>
        </div></details>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={confirmQuestions}>{t('common.next')}<ArrowRight size={16}/></button></div>
      </div>}

      {step === 4 && <div className="mh-stack">
        <dl className="mh-facts mh-summary">{summaryRows.map(([label, value, target]) => <div key={label}><dt>{label}</dt><dd>{value || '—'}<button type="button" className="mh-link" aria-label={t('form.summary.editAria', { label })} onClick={() => { setStep(target); setIssues([]); }}><PenLine size={13}/></button></dd></div>)}</dl>
        <div className="mh-note"><ShieldCheck size={20}/><p>{t('form.summary.note')}</p></div>
        <div className="mh-actions"><button type="button" className="mh-button mh-primary" onClick={finish}><Check size={16}/>{t('form.summary.confirm')}</button></div>
      </div>}

    </fieldset>
    <button className="mh-link" type="button" disabled={busy} onClick={() => void onSave()}><Save size={14}/>{t('form.saveDraft')}</button>
  </section>;
}

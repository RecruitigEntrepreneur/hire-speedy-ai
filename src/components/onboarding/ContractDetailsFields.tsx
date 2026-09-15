import { useId } from 'react';
import { CONTRACT_FIELD_LABELS, cleanContractDetails, type ContractField, type ContractDetails } from '../../../supabase/functions/_shared/recruiter-contract-data';

const hints: Partial<Record<ContractField, string>> = {
  businessEvidence: 'Registergericht und Nummer oder Art deiner selbstständigen Tätigkeit.',
  taxNumber: 'Steuernummer oder USt-ID und gegebenenfalls Referenz auf den Nachweis.',
  authorityEvidence: 'Zum Beispiel Geschäftsführer laut Register oder Vollmacht vom …',
  userAuthorities: 'Name, E-Mail und erlaubte Tätigkeiten der vorgesehenen Nutzer.',
  permitsDeclaration: 'Vorliegende Erlaubnisse nennen oder begründen, wenn keine erforderlich sind.',
  incomeConcentration: 'Ja / Nein – nach deiner aktuellen Einschätzung.',
  dualRole: 'Firmen nennen oder „Keine“.',
  accessCountries: 'Auch Zugriffe durch Teammitglieder berücksichtigen.',
  transferRecord: 'Vorhandenen Nachweis nennen. Bei ausschließlich EU/EWR: „Keine Drittlandzugriffe vorgesehen“. Matchunt prüft diese Angaben.',
};
const groups: { title: string; fields: ContractField[] }[] = [
  { title: 'Unternehmen & Berechtigung', fields: ['businessEvidence', 'taxNumber', 'responsiblePerson', 'authorityEvidence', 'userAuthorities', 'insuranceEvidence'] },
  { title: 'Deine Zusammenarbeit mit Matchunt', fields: ['permitsDeclaration', 'incomeConcentration', 'dualRole'] },
  { title: 'Datenschutz & Zugriff', fields: ['privacyContact', 'accessCountries', 'transferRecord'] },
];
export default function ContractDetailsFields({ value, kind, onChange }: { value?: ContractDetails; kind: string; onChange: (d: ContractDetails) => void }) {
  const id = useId();
  // Preserve whitespace while typing; the server normalizes the saved values.
  const d = { ...cleanContractDetails({}), ...value };
  return <section className="mh-contract-fields">
    <p className="mh-muted">Diese Angaben fließen in dein Vertragsdatenblatt ein. Matchunt prüft sie vor der Gegenzeichnung. Bankdaten ergänzt du später geschützt vor der ersten Auszahlung.</p>
    {groups.map((group, index) => <details className="mh-contract-group" key={group.title} open={index === 0}>
      <summary>{group.title}</summary>
      <div className="mh-grid">{group.fields.filter(k => kind === 'agency' || !['userAuthorities', 'insuranceEvidence'].includes(k)).map(k => <label className="mh-field" key={k}>
        <span id={`${id}-${k}-label`}>{CONTRACT_FIELD_LABELS[k]}</span><textarea aria-labelledby={`${id}-${k}-label`} aria-describedby={hints[k] ? `${id}-${k}-hint` : undefined} required maxLength={1000} value={d[k]} onInvalid={e => { const details = e.currentTarget.closest('details'); if (details) details.open = true; }} onChange={e => onChange({ ...d, [k]: e.target.value })}/>
        {hints[k] && <small id={`${id}-${k}-hint`}>{hints[k]}</small>}
      </label>)}</div>
    </details>)}
    <div className="mh-stack">
      <label className="mh-check"><input type="checkbox" checked={d.creditNoteConsent} onChange={e => onChange({ ...d, creditNoteConsent: e.target.checked })}/><span>Matchunt darf meine Vergütung per Gutschrift abrechnen. Ohne diese Zustimmung stelle ich selbst Rechnungen.</span></label>
      <details><summary>Freiwillige Veröffentlichungen · optional</summary><div className="mh-stack">
        {([['directoryConsent', 'Aufnahme in das öffentliche Partnerverzeichnis'], ['profilePublicationConsent', 'Veröffentlichung meines Fotos und meiner Profil-Links'], ['marketingConsent', 'Nennung in Beiträgen von Matchunt']] as const).map(([k, label]) => <label className="mh-check" key={k}><input type="checkbox" checked={d[k]} onChange={e => onChange({ ...d, [k]: e.target.checked })}/>{label}</label>)}
        <p className="mh-muted">Freiwillig und jederzeit für die Zukunft widerruflich. Deine Auswahl beeinflusst den Vertragsabschluss nicht.</p>
      </div></details>
    </div>
  </section>;
}

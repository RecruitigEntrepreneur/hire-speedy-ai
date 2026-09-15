import { type RecruiterProfile, profileIssues } from './recruiter-contract-policy.ts';
export const CONTRACT_FIELD_LABELS = {
  businessEvidence: 'Registerangaben / Tätigkeitsnachweis', taxNumber: 'Steuerliche Angaben / Nachweisreferenz', responsiblePerson: 'Verantwortliche Person', authorityEvidence: 'Grundlage der Vertretungsberechtigung', userAuthorities: 'Nutzer und ihre Befugnisse', insuranceEvidence: 'Versicherungsnachweis', permitsDeclaration: 'Erlaubnisse / erforderliche Registrierungen', incomeConcentration: 'Mehr als die Hälfte der Erwerbseinkünfte über Matchunt', dualRole: 'Eigene oder verbundene Unternehmen zugleich Kunde', privacyContact: 'Datenschutz-Ansprechpartner', accessCountries: 'Länder, aus denen auf Daten zugegriffen wird', transferRecord: 'Drittlandprüfung / Übermittlungsgarantien',
} as const;
export type ContractField = keyof typeof CONTRACT_FIELD_LABELS;
export type ContractDetails = Record<ContractField, string> & { creditNoteConsent: boolean; directoryConsent: boolean; profilePublicationConsent: boolean; marketingConsent: boolean };
export function cleanContractDetails(input: unknown): ContractDetails {
  const src = input && typeof input === 'object' ? input as Record<string,unknown> : {};
  return { ...Object.fromEntries(Object.keys(CONTRACT_FIELD_LABELS).map(k => [k, typeof src[k] === 'string' ? src[k].trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,1000) : ''])), ...Object.fromEntries(['creditNoteConsent','directoryConsent','profilePublicationConsent','marketingConsent'].map(k => [k,src[k] === true])) } as ContractDetails;
}
export function contractDataIssues(p: RecruiterProfile, kind: string): string[] {
  const d = cleanContractDetails(p.contractDetails);
  const required = Object.keys(CONTRACT_FIELD_LABELS).filter(k => kind === 'agency' || !['userAuthorities','insuranceEvidence'].includes(k));
  return [...profileIssues(p), ...required.filter(k => !d[k as ContractField]).map(k => CONTRACT_FIELD_LABELS[k as ContractField] + ' fehlt.')];
}
export function contractValues(id: string, p: RecruiterProfile, email: string, kind: string): Record<string,string> {
  const issues=contractDataIssues(p,kind); if(issues.length) throw Error(issues.join(' '));
  if (/\/(?:recruiter|matchunt)_sign\//i.test(JSON.stringify(p))) throw Error('Vertragsangaben enthalten reservierte Signaturmarkierungen.');
  const d=cleanContractDetails(p.contractDetails);
  const consent=(v:boolean)=>v?'Ausdrücklich erteilt':'Nicht erteilt';
  return { contract_id:id, company:p.company, legal_form:p.legalForm, address:p.address, country:p.country, business_evidence:d.businessEvidence, tax_details:({regular:'Regelbesteuerung',small_business:'Kleinunternehmerregelung',foreign:'Ausländischer Steuerstatus'}[p.taxStatus] || p.taxStatus)+' · '+d.taxNumber, contact_name:p.name, contact_email:email, responsible_person:d.responsiblePerson, signer_name:p.signer, signer_role:p.signerRole, signer_email:p.signerEmail, authority_evidence:d.authorityEvidence, user_authorities:d.userAuthorities || 'Eigenes persönliches Nutzerkonto des Einzelrecruiters; weitere Befugnisse werden gesondert dokumentiert.', credit_note_consent:d.creditNoteConsent?'Zustimmung zum Gutschriftverfahren erteilt':'Keine Zustimmung; Abrechnung auf Rechnung des Recruiters.', payout_account:'Wird vor der ersten Auszahlung im gesicherten Auszahlungsprozess erfasst und verifiziert.', insurance_evidence:d.insuranceEvidence || 'Keine zusätzliche Versicherungspflicht für natürliche Personen aus diesem Vertrag; freiwilliger Nachweis nicht angegeben.', permits_declaration:d.permitsDeclaration, income_concentration:d.incomeConcentration, dual_role:d.dualRole, privacy_contact:d.privacyContact, transfer_record:'Zugriffsländer: '+d.accessCountries+'. '+d.transferRecord, directory_consent:consent(d.directoryConsent), profile_publication_consent:consent(d.profilePublicationConsent), marketing_consent:consent(d.marketingConsent) };
}

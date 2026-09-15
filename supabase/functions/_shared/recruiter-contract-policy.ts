import { cleanContractDetails, type ContractDetails } from './recruiter-contract-data.ts';
import { recruiterCounterDeadline } from './recruiter-deadline.ts';
// Shared, pure policy: tested with Vitest and used by the Edge Functions.
export const DOCUMENT_ROLES = ['framework','data','pricing','rules','privacy','terms','brand'] as const;
export type DocumentRole = typeof DOCUMENT_ROLES[number];
export const REVIEW_CHECK_LABELS = {
  identity: 'Identität und Kontozuordnung geprüft',
  business: 'Geschäftsdaten und erforderliche Tätigkeitsnachweise geprüft',
  tax: 'Steuerstatus und erforderliche Nachweise geprüft',
  authority: 'Vertretungsberechtigung der unterzeichnenden Person geprüft',
  privacy: 'Datenschutzrollen, Schutzmaßnahmen und gegebenenfalls Drittlandgarantien geprüft',
  user_authority: 'Verantwortliche Person und Befugnisse der Agenturnutzer dokumentiert',
} as const;
export const requiredReviewChecks = (kind: string) => Object.keys(REVIEW_CHECK_LABELS).filter(k => kind === 'agency' || k !== 'user_authority');
export interface ContractDocument { role: DocumentRole; name: string; path: string; sha256: string }
export interface RecruiterProfile {
  name: string; company: string; legalForm: string; address: string; country: string;
  taxStatus: string; signer: string; signerEmail: string; signerRole: string;
  authorityDeclared: boolean; specialty: string; region: string; contractDetails?: ContractDetails;
}
export const normalizeEmail = (v: string) => v.trim().toLowerCase();
export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
export function cleanProfile(input: unknown): RecruiterProfile {
  const src = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const out = {} as RecruiterProfile;
  for (const key of ['name','company','legalForm','address','country','taxStatus','signer','signerEmail','signerRole','specialty','region'] as const) {
    out[key] = typeof src[key] === 'string' ? src[key].trim().slice(0, 500) : '';
  }
  out.signerEmail = normalizeEmail(out.signerEmail);
  out.authorityDeclared = src.authorityDeclared === true;
  out.contractDetails = cleanContractDetails(src.contractDetails);
  return out;
}
export function profileIssues(p: RecruiterProfile): string[] {
  const issues: string[] = [];
  if (['name','company','legalForm','address','country','signer','signerRole'].some(k => !p[k as keyof RecruiterProfile])) issues.push('Vertragsdaten bitte vollständig ergänzen.');
  if (!validEmail(p.signerEmail)) issues.push('E-Mail der unterzeichnenden Person fehlt.');
  if (!p.authorityDeclared) issues.push('Vertretungsberechtigung bitte angeben.');
  if (!['regular','small_business','foreign'].includes(p.taxStatus)) issues.push('Steuerstatus ist noch offen.');
  return issues;
}
export function packageIssues(documents: ContractDocument[], prefix: string): string[] {
  const issues: string[] = [];
  for (const role of DOCUMENT_ROLES) if (documents.filter(d => d.role === role).length !== 1) issues.push(`Genau ein vollständiges Dokument fehlt: ${role}.`);
  if (documents.length !== 7 || new Set(documents.map(d => d.role)).size !== documents.length) issues.push('Vertragspaket enthält doppelte oder unerwartete Dokumente.');
  for (const d of documents) {
    if (!DOCUMENT_ROLES.includes(d.role) || !d.path.startsWith(prefix + '/') || d.path.includes('..') || !/^[a-f0-9]{64}$/.test(d.sha256) || !d.name.endsWith('.pdf')) issues.push('Ungültiger Dokumentnachweis.');
  }
  return issues;
}
export interface ProviderSigner { recipientId: string; status: string; signedDateTime?: string; email?: string; name?: string }
export function signingEvidence(status: string, signers: ProviderSigner[], recruiterEmail: string, counterEmail: string, now = Date.now()) {
  if (new Set(signers.map(s => s.recipientId)).size !== signers.length || signers.length !== 2) throw new Error('Unerwartete DocuSign-Empfänger.');
  const first = signers.find(s => s.recipientId === '1');
  const second = signers.find(s => s.recipientId === '2');
  if (!first || !second || normalizeEmail(first.email ?? '') !== normalizeEmail(recruiterEmail) || normalizeEmail(second.email ?? '') !== normalizeEmail(counterEmail)) throw new Error('DocuSign-Empfänger stimmen nicht mit dem Vertragsvorgang überein.');
  const signedTime = (s: ProviderSigner) => {
    if (s.status !== 'completed') return null;
    const time = Date.parse(s.signedDateTime ?? '');
    if (!Number.isFinite(time) || time > now + 60_000) throw new Error('Ungültiger Unterschriftszeitpunkt.');
    return new Date(time).toISOString();
  };
  const recruiter = signedTime(first);
  const counter = signedTime(second);
  if (counter && (!recruiter || Date.parse(counter) < Date.parse(recruiter))) throw new Error('Unterschriftsreihenfolge ungültig.');
  const late = Boolean(counter && recruiter && Date.parse(counter) >= Date.parse(recruiterCounterDeadline(recruiter)));
  const completed = status === 'completed' && !!recruiter && !!counter && !late;
  return { recruiter, counter, completed, late, terminal: status === 'declined' || status === 'voided' ? status : null };
}

/** Embedded signing is bound to the immutable recipient and the claimed account. */
export function canOpenRecruiterSignature(input: { userId: string; userEmail: string; claimedBy: string | null; clientUserId: string | null; signerEmail: string; state: string; signedAt: string | null }) {
  return Boolean(input.clientUserId && input.userId === input.claimedBy && input.userId === input.clientUserId && normalizeEmail(input.userEmail) === normalizeEmail(input.signerEmail) && input.state === 'sent' && !input.signedAt);
}

import type { StoredContract, StoredOnboarding, AuditEntry } from './recruiterOnboardingApi';
import { cleanContractDetails } from '../../supabase/functions/_shared/recruiter-contract-data';
import { requiredReviewChecks, REVIEW_CHECK_LABELS } from '../../supabase/functions/_shared/recruiter-contract-policy';
import { recruiterCounterDeadline } from '../../supabase/functions/_shared/recruiter-deadline';

/**
 * Vorgangsseite in der Recruiterverwaltung (Entscheidung 21.09.2026): Angaben in
 * Gruppen mit dem passenden Prüfpunkt daneben, Hinweise auf Auffälligkeiten,
 * Prozessleiste und genau ein nächster Schritt. Reine Ableitungen, getestet.
 */
export type CheckKey = keyof typeof REVIEW_CHECK_LABELS;
export type GroupId = 'company' | 'signature' | 'taxPrivacy' | 'activity' | 'agency';
export interface ReviewField { label: string; value: string }
export interface ReviewGroup { id: GroupId; title: string; checks: CheckKey[]; fields: ReviewField[] }
export interface ReviewHint { group: GroupId; text: string }

const TAX_LABELS: Record<string, string> = { regular: 'regulär umsatzsteuerpflichtig', small_business: 'Kleinunternehmerregelung', foreign: 'ausländischer Steuerstatus' };
/** Kurzbezeichnungen der Prüfpunkte für die Gruppenkarten; der volle Text steht in REVIEW_CHECK_LABELS. */
export const CHECK_SHORT: Record<CheckKey, string> = {
  identity: 'Identität', business: 'Geschäftsdaten', tax: 'Steuer', authority: 'Vertretung', privacy: 'Datenschutz', user_authority: 'Agentur-Nutzer',
};

export function reviewGroups(c: Pick<StoredOnboarding, 'kind' | 'email' | 'profile'>): ReviewGroup[] {
  const p = c.profile;
  const d = cleanContractDetails(p.contractDetails);
  const signer = [p.signer, p.signerRole].filter(Boolean).join(', ');
  const groups: ReviewGroup[] = [
    { id: 'company', title: 'Firma und Register', checks: ['business'], fields: [
      { label: 'Firma', value: [p.company, p.legalForm && !p.company.endsWith(p.legalForm) ? p.legalForm : ''].filter(Boolean).join(', ') },
      { label: 'Register und Nachweis', value: d.businessEvidence },
      { label: 'Anschrift', value: p.address },
      { label: 'Sitzland', value: p.country },
    ] },
    { id: 'signature', title: 'Vertretung und Unterschrift', checks: ['identity', 'authority'], fields: [
      { label: 'Unterzeichner', value: signer },
      { label: 'E-Mail des Unterzeichners', value: p.signerEmail },
      { label: 'Vertretungsnachweis', value: d.authorityEvidence },
      { label: 'Verantwortliche Person', value: d.responsiblePerson },
      { label: 'Kontakt', value: [p.name, c.email].filter(Boolean).join(' · ') },
      { label: 'Vertretungsberechtigung erklärt', value: p.authorityDeclared ? 'ja' : 'nein' },
    ] },
    { id: 'taxPrivacy', title: 'Steuer und Datenschutz', checks: ['tax', 'privacy'], fields: [
      { label: 'Steuerstatus', value: TAX_LABELS[p.taxStatus] ?? p.taxStatus },
      { label: 'Steuerliche Angaben', value: d.taxNumber },
      { label: 'Datenschutz-Ansprechpartner', value: d.privacyContact },
      { label: 'Zugriff aus', value: d.accessCountries },
      { label: 'Drittland', value: d.transferRecord },
    ] },
    { id: 'activity', title: 'Tätigkeit', checks: [], fields: [
      { label: 'Erlaubnisse', value: d.permitsDeclaration },
      { label: 'Einkünfte über Matchunt', value: d.incomeConcentration },
      { label: 'Verflechtung mit Kunden', value: d.dualRole },
      { label: 'Versicherungsnachweis', value: d.insuranceEvidence },
    ] },
  ];
  if (c.kind === 'agency') groups.push({ id: 'agency', title: 'Agentur-Nutzer', checks: ['user_authority'], fields: [{ label: 'Nutzer und Befugnisse', value: d.userAuthorities }] });
  const required = new Set<string>(requiredReviewChecks(c.kind));
  return groups.map(g => ({ ...g, checks: g.checks.filter(k => required.has(k)), fields: g.fields.filter(f => f.value.trim()) }));
}

const normalizeName = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Auffälligkeiten, die Matchunt vor der Gegenzeichnung klären sollte. */
export function reviewHints(c: Pick<StoredOnboarding, 'email' | 'profile'>): ReviewHint[] {
  const p = c.profile;
  const d = cleanContractDetails(p.contractDetails);
  const hints: ReviewHint[] = [];
  const responsible = d.responsiblePerson.trim();
  const known = [p.signer, p.name].map(normalizeName).filter(Boolean);
  if (responsible && known.length && !known.includes(normalizeName(responsible))) {
    hints.push({ group: 'signature', text: `Name weicht ab: ${p.signer || p.name} und ${responsible}` });
  }
  if (p.signerEmail && c.email && normalizeName(p.signerEmail) !== normalizeName(c.email)) {
    hints.push({ group: 'signature', text: `Unterschreibt über eine andere Adresse als das Konto: ${p.signerEmail}` });
  }
  if (!p.authorityDeclared) hints.push({ group: 'signature', text: 'Vertretungsberechtigung nicht erklärt' });
  if (d.transferRecord && !/keine drittland/i.test(d.transferRecord)) hints.push({ group: 'taxPrivacy', text: `Zugriff aus Drittländern angegeben: ${d.accessCountries || d.transferRecord}` });
  if (d.permitsDeclaration && !/keine arbeitnehmerüberlassung/i.test(d.permitsDeclaration)) hints.push({ group: 'activity', text: `Eigene Angabe zu Erlaubnissen: ${d.permitsDeclaration}` });
  if (d.incomeConcentration && !/^\s*nein/i.test(d.incomeConcentration)) hints.push({ group: 'activity', text: `Einkünfte über Matchunt prüfen: ${d.incomeConcentration}` });
  if (d.dualRole && !/^\s*keine\.?\s*$/i.test(d.dualRole)) hints.push({ group: 'activity', text: `Verflechtung mit möglichen Kunden: ${d.dualRole}` });
  if (!d.insuranceEvidence || /auf anfrage|kein(en)? (zusätzlich\w* )?nachweis/i.test(d.insuranceEvidence)) hints.push({ group: 'activity', text: 'Versicherungsnachweis nicht hinterlegt, auf Anfrage' });
  return hints;
}

export type StepState = 'done' | 'current' | 'open';
export interface ProcessStep { label: string; state: StepState; at: string | null; note?: string }

/** Letzter Tag der Gegenzeichnungsfrist (die Frist endet exklusiv um Mitternacht). */
export const counterDeadlineDay = (signedAt: string) => new Date(Date.parse(recruiterCounterDeadline(signedAt)) - 1);

export function processSteps(c: StoredOnboarding, contract: StoredContract | null, history: AuditEntry[]): ProcessStep[] {
  const first = (event: string) => history.filter(h => h.event === event).map(h => h.occurred_at).sort()[0] ?? null;
  const submitted = c.state === 'review' || c.state === 'approved';
  const countersigned = !!contract?.countersigned_at || contract?.state === 'completed';
  const done = [true, submitted, c.state === 'approved', !!contract?.recruiter_signed_at, countersigned, !!c.activated];
  // Erledigtes im Perfekt, Offenes als Aufgabe.
  const steps: Omit<ProcessStep, 'state'>[] = [
    { label: c.entry_source === 'website' ? 'Registriert' : 'Eingeladen', at: c.created_at ?? null },
    { label: 'Angaben', at: first('case.review') ?? c.claimed_at ?? null },
    { label: 'Prüfung', at: c.reviewed_at ?? first('case.approved') },
    { label: done[3] ? 'Headhunter unterschrieben' : 'Headhunter unterschreibt', at: contract?.recruiter_signed_at ?? null },
    { label: done[4] ? 'Matchunt gegengezeichnet' : 'Matchunt gegenzeichnen', at: contract?.countersigned_at ?? null,
      note: contract?.recruiter_signed_at && !countersigned ? `bis ${counterDeadlineDay(contract.recruiter_signed_at).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric' })}` : undefined },
    { label: done[5] ? 'Freigeschaltet' : 'Freischalten', at: null, note: countersigned && !c.activated ? 'danach automatisch' : undefined },
  ];
  const current = c.revoked_at ? -1 : done.findIndex(d => !d);
  return steps.map((s, i) => ({ ...s, state: done[i] ? 'done' : i === current ? 'current' : 'open' }));
}

export type NextKind = 'review' | 'counter' | 'activate' | 'wait' | 'done' | 'closed';
export interface NextAction { kind: NextKind; label: string; hint?: string }

/** Genau ein nächster Schritt je Vorgang; „wait“ und „closed“ sind reine Auskünfte. */
export function nextAction(c: StoredOnboarding, contract: StoredContract | null, now = Date.now()): NextAction {
  if (c.revoked_at) return { kind: 'closed', label: 'Einladung widerrufen' };
  if (c.activated) return { kind: 'done', label: 'Freigeschaltet' };
  if (!c.claimed_at && c.entry_source !== 'website') return { kind: 'wait', label: 'Einladung noch nicht angenommen' };
  if (c.state === 'draft') return { kind: 'wait', label: 'Der Headhunter ergänzt seine Angaben' };
  if (c.state === 'review') return { kind: 'review', label: 'Prüfung abschließen', hint: contract?.recruiter_signed_at ? 'Der Headhunter hat schon unterschrieben.' : undefined };
  if (!contract) return { kind: 'wait', label: 'Der Headhunter startet den Vertrag' };
  if (contract.state === 'completed') return { kind: 'activate', label: 'Freischalten und Zugang senden' };
  if (contract.state === 'manual_review') return { kind: 'closed', label: 'Manuelle Klärung nötig' };
  if (['declined', 'voided'].includes(contract.state)) return { kind: 'closed', label: contract.state === 'declined' ? 'Unterschrift abgelehnt' : 'Vertrag zurückgenommen' };
  if (contract.state !== 'sent') return { kind: 'wait', label: 'Vertrag wird an DocuSign übergeben' };
  if (!contract.recruiter_signed_at) return { kind: 'wait', label: 'Wartet auf die Unterschrift des Headhunters' };
  if (now >= Date.parse(recruiterCounterDeadline(contract.recruiter_signed_at))) return { kind: 'closed', label: 'Frist zum Gegenzeichnen abgelaufen', hint: 'Der Vertrag muss neu vereinbart werden.' };
  return { kind: 'counter', label: 'In DocuSign gegenzeichnen' };
}

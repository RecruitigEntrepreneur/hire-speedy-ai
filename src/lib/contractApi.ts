import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { callFunction } from '@/lib/interviewScheduling';

/** Arbeitsvertrag und Unterschrift (Paket 3, 22.10.2026): Typen und Aufrufe der Function employment-contract. */

export type ContractStatus = 'preparing' | 'sent_self' | 'sent_digital' | 'company_signed' | 'reported' | 'signed' | 'final' | 'declined' | 'dropped' | 'voided' | string;

export interface ContractView {
  id: string;
  way: 'digital' | 'self';
  status: ContractStatus;
  sentAt: string | null;
  companySignerName: string | null;
  companySignedAt: string | null;
  candidateSignedAt: string | null;
  reportedRole: 'client' | 'recruiter' | 'admin' | 'docusign' | null;
  reportedAt: string | null;
  reportNote: string | null;
  signedOn: string | null;
  salary: number | null;
  variable: number | null;
  startDate: string | null;
  closeJob: boolean;
  undoUntil: string | null;
  confirmedAt: string | null;
  recruiterCheck: 'ok' | 'differs' | null;
  recruiterCheckNote: string | null;
  declineReason: string | null;
  dropReason: string | null;
  finalAt: string | null;
  hasSignedDocument: boolean;
  /** 'embedded' = Unterschrift über Matchunt (23.10.2026), 'email' = DocuSign mailt (alter Weg) */
  signingMode?: 'email' | 'embedded';
}

export interface SignLinkView { sentAt: string | null; openedAt: string | null; signedAt: string | null; revoked: boolean; expiresAt: string; email: string | null; reminders: number }

/** Unterschrift über Matchunt: wer wie unterschreibt, Link verschickt/geöffnet. */
export interface SigningView {
  mode: 'email' | 'embedded';
  /** Der Betrachter unterschreibt selbst für die Firma */
  youSign: boolean;
  companyViaApp: boolean;
  companyEmail: string | null;
  candidateEmail: string | null;
  company: SignLinkView | null;
  candidate: SignLinkView | null;
}

export interface ContractOffer {
  id: string; salary: number; variable: number | null; startDate: string | null; contractType: string;
  probationMonths: number | null; workModel: string; extras: string[]; acceptedAt: string | null;
}

export interface ContractContext {
  role: 'client' | 'recruiter' | 'admin';
  submissionId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  candidatePhone: string | null;
  /** Kündigungsfrist laut Profil, lesbar */
  candidateNotice?: string | null;
  jobTitle: string;
  companyName: string;
  recruiterName: string | null;
  reporterName: string | null;
  feePercent: number | null;
  digitalAvailable: boolean;
  /** DocuSign im Demo-Betrieb: nicht rechtsverbindlich */
  digitalDemo?: boolean;
  offer: ContractOffer | null;
  contract: ContractView | null;
  signing?: SigningView | null;
  events: { type: string; role: string | null; at: string; details: Record<string, unknown> }[];
}

export interface ReportInput { submissionId: string; signedOn: string; salary: number | null; variable: number | null; startDate: string; closeJob?: boolean; note?: string; evidence?: string }
export interface DigitalInput {
  submissionId: string; fileBase64: string; fileName: string; salary: number | null; variable: number | null; startDate: string;
  signerName: string; signerEmail: string; candidateEmail: string; fixedTerm: boolean; nonCompete: boolean;
  /** „Ich selbst“: unterschreibt mit der Kontoadresse, gleich nach dem Hochladen */
  signerSelf?: boolean;
  /** nach der Unterschrift Stelle als besetzt schließen */
  closeJob?: boolean;
}

type Ok = { ok: true; contract: ContractView };
/** Wohin DocuSign zurückspringt; der Server übernimmt das nur im lokalen Betrieb, sonst gilt die App-Adresse. */
const returnBase = () => (typeof window === 'undefined' ? undefined : window.location.origin);
const call = <T,>(action: string, body: Record<string, unknown>, fallback?: string) => callFunction<T>('employment-contract', { action, ...body }, fallback);

export const contractApi = {
  context: (submissionId: string) => call<ContractContext>('context', { submissionId }),
  sendSelf: (submissionId: string, sentOn: string | null) => call<Ok>('send_self', { submissionId, sentOn }, 'Konnte nicht gespeichert werden.'),
  sendDigital: (input: DigitalInput) => call<Ok & { signUrl: string | null }>('send_digital', { ...input, returnBase: returnBase() }, 'Der Vertrag konnte nicht verschickt werden.'),
  /** Firma unterschreibt im Bewerberprofil: Adresse der Unterschrift bei DocuSign */
  signUrl: (submissionId: string) => call<{ url: string }>('sign_url', { submissionId, returnBase: returnBase() }, 'Die Unterschrift lässt sich gerade nicht starten.'),
  resendLink: (submissionId: string) => call<{ ok: true; sentTo: string | null; role: 'company' | 'candidate' }>('resend_link', { submissionId }, 'Der Link konnte nicht erneut gesendet werden.'),
  changeSigner: (submissionId: string, signer: { signerSelf: true } | { signerName: string; signerEmail: string }) =>
    call<Ok & { signUrl: string | null }>('change_signer', { submissionId, ...signer, returnBase: returnBase() }, 'Der Unterzeichner konnte nicht geändert werden.'),
  voidDigital: (submissionId: string, toSelf: boolean) => call<Ok>('void_digital', { submissionId, toSelf }),
  resend: (submissionId: string) => call<Ok>('resend', { submissionId }, 'Die DocuSign-Mail konnte nicht erneut gesendet werden.'),
  refresh: (submissionId: string, returned = false) => call<Ok>('refresh', { submissionId, returned }),
  report: (input: ReportInput) => call<Ok>('report', { ...input }, 'Die Meldung konnte nicht gespeichert werden.'),
  confirm: (submissionId: string, way: 'yes' | 'values' | 'not_yet', values?: Partial<ReportInput>) => call<Ok>('confirm', { submissionId, way, ...values }),
  undo: (submissionId: string) => call<Ok>('undo', { submissionId }),
  check: (submissionId: string, way: 'ok' | 'differs', note?: string) => call<Ok>('check', { submissionId, way, note }),
  drop: (submissionId: string, reason: string) => call<Ok>('drop', { submissionId, reason }),
  document: (submissionId: string) => call<{ url: string }>('document', { submissionId }),
  adminCases: () => call<{ cases: AdminCase[] }>('admin_cases', {}),
};

export interface AdminCase {
  submissionId: string; candidateName: string; companyName: string; jobTitle: string; recruiterName: string | null;
  acceptedAt: string | null; contract: ContractView; adminCaseAt: string | null;
  signing?: SigningView | null;
}

/** Stand eines Links in einem Halbsatz: „Link an x · geöffnet 23.10. 18:05“ */
export function linkLine(l: SignLinkView | null | undefined, email: string | null | undefined): string | null {
  if (!l) return null;
  const to = l.email ?? email;
  return [to ? `Link an ${to}` : 'Link per Mail', l.openedAt ? `geöffnet ${timeDe(l.openedAt)}` : 'noch nicht geöffnet'].join(' · ');
}

export const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
export const dateDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
export const timeDe = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
export const todayIso = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

/** Vertragsdaten aus der Zusage: zum Übernehmen in den eigenen Vertrag. */
export function contractData(c: Pick<ContractContext, 'jobTitle' | 'offer'>): { label: string; value: string; missing?: boolean }[] {
  const o = c.offer;
  const urlaub = o?.extras.find((e) => /urlaub/i.test(e));
  const extras = (o?.extras ?? []).filter((e) => e !== urlaub);
  return [
    { label: 'Beginn', value: o?.startDate ? dateDe(o.startDate) : 'bitte ergänzen', missing: !o?.startDate },
    { label: 'Tätigkeit', value: c.jobTitle },
    { label: 'Arbeitsort · Modell', value: o?.workModel || 'bitte ergänzen', missing: !o?.workModel },
    { label: 'Gehalt fix', value: o ? `${euro(o.salary)} pro Jahr` : 'bitte ergänzen', missing: !o },
    { label: 'Variabel', value: o?.variable ? `${euro(o.variable)} bei 100 % Zielerreichung` : 'keins vereinbart' },
    { label: 'Vertragsart', value: o?.contractType === 'fixed_term' ? 'befristet' : 'unbefristet' },
    { label: 'Probezeit', value: o?.probationMonths ? `${o.probationMonths} Monate` : 'bitte ergänzen', missing: !o?.probationMonths },
    { label: 'Urlaub', value: urlaub ?? 'bitte ergänzen', missing: !urlaub },
    { label: 'Arbeitszeit', value: 'bitte ergänzen', missing: true },
    { label: 'Kündigungsfrist', value: 'bitte ergänzen', missing: true },
    ...(extras.length ? [{ label: 'Extras', value: extras.join(', ') }] : []),
  ];
}

export function contractDataText(c: Pick<ContractContext, 'jobTitle' | 'offer' | 'candidateName' | 'companyName'>): string {
  return [`Vertragsdaten ${c.candidateName} · ${c.companyName}`, ...contractData(c).map((r) => `${r.label}: ${r.value}`)].join('\n');
}

/** Vertragsdaten als PDF (im Browser erzeugt, nichts verlässt das Gerät). */
export async function contractDataPdf(c: Pick<ContractContext, 'jobTitle' | 'offer' | 'candidateName' | 'companyName'>): Promise<Blob> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.12);
  let y = 770;
  page.drawText('Vertragsdaten aus der Zusage', { x: 60, y, size: 18, font: bold, color: ink }); y -= 26;
  page.drawText(`${c.candidateName} · ${c.companyName}`, { x: 60, y, size: 11, font, color: ink }); y -= 30;
  for (const r of contractData(c)) {
    page.drawText(r.label, { x: 60, y, size: 10, font: bold, color: ink });
    page.drawText(r.value, { x: 200, y, size: 10, font, color: r.missing ? rgb(0.7, 0.4, 0) : ink });
    y -= 20;
  }
  y -= 16;
  const hint = ['Übliche Angaben für den Arbeitsvertrag bzw. den Nachweis der Arbeitsbedingungen.', 'Den Vertragstext formulieren Sie selbst; Matchunt gibt keine Rechtsberatung.'];
  for (const h of hint) { page.drawText(h, { x: 60, y, size: 9, font, color: rgb(0.4, 0.4, 0.45) }); y -= 14; }
  const bytes = await pdf.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------------------------------------------------------------------
// Persönlicher Unterschrifts-Link ohne Konto (/unterschrift/:token, Function contract-sign)
// ---------------------------------------------------------------------------

export type SignLinkState = 'invalid' | 'withdrawn' | 'revoked' | 'done' | 'signed' | 'not_yet' | 'expired' | 'ready';

export interface SignPageView {
  state: SignLinkState;
  role?: 'company' | 'candidate';
  signerName?: string;
  /** gekürzt, z. B. p••••••@kanna.test */
  email?: string;
  companyName?: string;
  candidateName?: string;
  jobTitle?: string;
  startDate?: string | null;
  salary?: number | null;
  variable?: number | null;
  uploadedBy?: string | null;
  recruiterName?: string | null;
  companySignedAt?: string | null;
  candidateSignedAt?: string | null;
  expiresAt?: string;
  canDownload?: boolean;
  demo?: boolean;
}

const signCall = <T,>(action: string, token: string, extra: Record<string, unknown> = {}, fallback?: string) =>
  callFunction<T>('contract-sign', { action, token, ...extra }, fallback);

export const signLinkApi = {
  peek: (token: string) => signCall<SignPageView>('peek', token, {}, 'Der Link konnte nicht geladen werden.'),
  start: (token: string) => signCall<{ url: string }>('start', token, { returnBase: returnBase() }, 'Die Unterschrift lässt sich gerade nicht starten.'),
  returned: (token: string) => signCall<SignPageView>('returned', token),
  renew: (token: string) => signCall<{ ok: true; email: string }>('renew', token, {}, 'Der neue Link konnte nicht verschickt werden.'),
  document: (token: string) => signCall<{ url: string }>('document', token, {}, 'Die Kopie ist gerade nicht abrufbar.'),
};

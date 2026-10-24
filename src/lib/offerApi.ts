import { callFunction } from '@/lib/interviewScheduling';

/** Angebot über den Headhunter (22.10.2026): Typen und Aufrufe der Function offer. */

export type OfferStatus = 'with_recruiter' | 'considering' | 'countered' | 'accepted' | 'declined' | 'withdrawn' | 'superseded' | string;
export type AnswerWay = 'accepted' | 'considering' | 'countered' | 'declined';

export interface OfferResponse {
  way: AnswerWay;
  note?: string | null;
  until?: string;
  wish?: { salary: number | null; variable: number | null; startDate: string | null; other: string | null };
  reason?: string | null;
  reason_category?: string;
  start_confirmed?: string;
  client_keep?: { at: string; note: string | null };
}

export interface OfferView {
  id: string;
  status: OfferStatus;
  version: number;
  salary: number;
  variable: number | null;
  startDate: string | null;
  responseDue: string | null;
  contractType: string;
  probationMonths: number | null;
  workModel: string | null;
  extras: string[];
  message: string | null;
  sentAt: string | null;
  response: OfferResponse | null;
  respondedAt: string | null;
}

export interface RecommendationItem { key: string; label: string; value: string }
export interface Recommendation { intro: string | null; items: RecommendationItem[]; createdAt: string }

export interface OfferContext {
  submissionId: string;
  candidateName: string | null;
  identityUnlocked: boolean;
  recruiterName: string | null;
  jobTitle: string;
  companyName: string;
  salaryMin: number | null;
  salaryMax: number | null;
  feePercent: number | null;
  defaults: { workModel: string; extras: string[]; probationMonths: number; contractType: string };
  recommendation: Recommendation | null;
  currentOffer: OfferView | null;
  otherOpenOffers: number;
}

/** Sicht des Headhunters: Angebot, Empfehlung, Nachgespräch und Akte (Schmerzgrenze nur hier). */
export interface RecruiterOfferContext {
  submissionId: string;
  candidateId: string;
  candidateName: string | null;
  candidatePhone: string | null;
  companyName: string;
  jobTitle: string;
  salaryMin: number | null;
  salaryMax: number | null;
  akte: { expectedSalary: number | null; noticePeriod: string | null; availabilityDate: string | null };
  nachgespraech: Record<string, any> | null;
  recommendation: Recommendation | null;
  currentOffer: OfferView | null;
}

export interface OfferInput {
  submissionId: string;
  salary: number;
  variable: number | null;
  startDate: string;
  responseDue: string;
  contractType: 'permanent' | 'fixed_term';
  probationMonths: number | null;
  workModel: string;
  extras: string[];
  message: string;
}

export interface AnswerInput {
  offerId: string;
  way: AnswerWay;
  note?: string;
  until?: string;
  wishSalary?: number | null;
  wishVariable?: number | null;
  wishStart?: string | null;
  wishOther?: string;
  reason?: string;
  reasonCategory?: string;
  startConfirmed?: string;
}

export const offerApi = {
  context: (submissionId: string) => callFunction<OfferContext>('offer', { action: 'context', submissionId }),
  recruiterContext: (submissionId: string) => callFunction<RecruiterOfferContext>('offer', { action: 'recruiter_context', submissionId }),
  create: (input: OfferInput) => callFunction<{ offerId: string; offer: OfferView }>('offer', { action: 'create', ...input }, 'Das Angebot konnte nicht gesendet werden.'),
  respond: (input: AnswerInput) => callFunction<{ ok: true; offer: OfferView }>('offer', { action: 'respond', ...input }, 'Die Antwort konnte nicht gespeichert werden.'),
  keep: (offerId: string, note: string) => callFunction<{ ok: true }>('offer', { action: 'keep', offerId, note }),
  /** Gegenwunsch annehmen: Version 2 mit genau den Werten des Wunsches */
  acceptCounter: (offerId: string) => callFunction<{ offerId: string; offer: OfferView }>('offer', { action: 'accept_counter', offerId }, 'Der Wunsch konnte nicht angenommen werden.'),
  withdraw: (offerId: string) => callFunction<{ ok: true }>('offer', { action: 'withdraw', offerId }),
  extend: (offerId: string, responseDue: string) => callFunction<{ ok: true }>('offer', { action: 'extend', offerId, responseDue }),
  recommend: (submissionId: string, intro: string, items: RecommendationItem[]) =>
    callFunction<{ ok: true }>('offer', { action: 'recommend', submissionId, intro, items }, 'Die Empfehlung konnte nicht gesendet werden.'),
};

export const DECLINE_REASONS: { key: string; label: string }[] = [
  { key: 'salary', label: 'Gehalt' }, { key: 'counter_offer', label: 'Gegenangebot Arbeitgeber' }, { key: 'other_job', label: 'andere Stelle' },
  { key: 'personal', label: 'persönlich' }, { key: 'other', label: 'anderer Grund' },
];

/** Offene Stände: das Angebot liegt beim Headhunter oder beim Kunden. */
export const OPEN_OFFER = ['with_recruiter', 'considering', 'countered'];

export const euro = (n: number | null | undefined) => (n == null ? '' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
/** „Do., 29.10.“; in einem anderen Jahr mit Jahr: „Fr., 01.01.2027“ */
export const dayDe = (iso: string | null | undefined) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const other = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', ...(other ? { year: 'numeric' } : {}) });
};
export const isoDay = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

/** Fünf Werktage ab heute (Bindefrist im Rahmenvertrag). */
export function plusWorkdays(days: number, from = new Date()): string {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  return isoDay(d);
}

/** Frist überschritten? (offenes Angebot, Antwort bis gestern oder früher) */
export function overdue(o: Pick<OfferView, 'status' | 'responseDue'> | null): boolean {
  return !!o && ['with_recruiter', 'considering'].includes(o.status) && !!o.responseDue && o.responseDue < isoDay(new Date());
}

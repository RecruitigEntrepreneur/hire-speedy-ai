import { callFunction } from '@/lib/interviewScheduling';

/**
 * Antwortseite des Kandidaten (G + H, 25.10.2026): /angebot/:token ohne Anmeldung.
 * Aufrufe der öffentlichen Function offer-answer; Regeln in _shared/offer-candidate.ts.
 */

export type OfferPageState = 'open' | 'confirm' | 'answered' | 'expired' | 'closed';

export interface OfferPageView {
  state: OfferPageState;
  purpose: 'answer' | 'confirm';
  candidateName: string;
  companyName: string;
  jobTitle: string;
  offer: {
    version: number; salary: number; variable: number | null; startDate: string | null; responseDue: string | null;
    contractType: string; probationMonths: number | null; workModel: string | null; extras: string[];
  };
  message: string | null;
  recruiter: { name: string; email: string | null; phone: string | null } | null;
  reportedAt: string | null;
  callbackRequestedAt: string | null;
  answer: 'accepted' | 'declined' | null;
  withdrawn: boolean;
  superseded: boolean;
}

export type AnswerWay = 'accepted' | 'declined' | 'callback' | 'confirmed' | 'not_confirmed';

export const DECLINE_OPTIONS: { key: string; label: string }[] = [
  { key: 'salary', label: 'Gehalt passt nicht' },
  { key: 'counter_offer', label: 'Gegenangebot meines Arbeitgebers' },
  { key: 'other_job', label: 'andere Stelle' },
  { key: 'personal', label: 'persönliche Gründe' },
  { key: 'other', label: 'anderer Grund' },
];

const call = <T,>(action: string, token: string, extra: Record<string, unknown> = {}, fallback?: string) =>
  callFunction<T>('offer-answer', { action, token, ...extra }, fallback);

export const offerAnswerApi = {
  peek: (token: string) => call<OfferPageView>('peek', token, {}, 'Das Angebot konnte nicht geladen werden.'),
  answer: (token: string, input: { way: AnswerWay; reasonCategory?: string; note?: string; topic?: string }) =>
    call<{ ok: true; state: string; answer?: string; recruiterName?: string | null }>('answer', token, input, 'Ihre Antwort konnte nicht gespeichert werden.'),
};

export const euro = (n: number | null | undefined) => (n == null ? '–' : `${new Intl.NumberFormat('de-DE').format(n)} €`);
export const dayDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
export const dateTimeDe = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).replace(',', ' um') : '');

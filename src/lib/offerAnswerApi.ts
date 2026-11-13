import i18n from '@/i18n';
import { callFunction } from '@/lib/interviewScheduling';
import { intlLocale } from '@/i18n/languages';
import { fmtMoney } from '@/lib/localeFormat';

/**
 * Antwortseite des Kandidaten (G + H, 25.10.2026): /angebot/:token ohne Anmeldung.
 * Aufrufe der öffentlichen Function offer-answer; Regeln in _shared/offer-candidate.ts.
 */

export type OfferPageState = 'open' | 'confirm' | 'answered' | 'expired' | 'closed' | 'wish_pending';

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

/** Absagegründe: der Schlüssel geht an die Function, die Anzeige kommt aus offerAnswer:decline.<key>. */
export const DECLINE_KEYS = ['salary', 'counter_offer', 'other_job', 'personal', 'other'] as const;
export const declineLabel = (key: string) => i18n.t(`offerAnswer:decline.${key}`);

const call = <T,>(action: string, token: string, extra: Record<string, unknown> = {}, fallback?: string) =>
  callFunction<T>('offer-answer', { action, token, ...extra }, fallback);

export const offerAnswerApi = {
  peek: (token: string) => call<OfferPageView>('peek', token, {}, i18n.t('offerAnswer:page.loadFailed')),
  answer: (token: string, input: { way: AnswerWay; reasonCategory?: string; note?: string; topic?: string }) =>
    call<{ ok: true; state: string; answer?: string; recruiterName?: string | null }>('answer', token, input, i18n.t('offerAnswer:page.saveFailed')),
};

// Anzeige in der Sprache der Seite; Uhrzeiten in deutscher Zeit.
export const euro = (n: number | null | undefined) => (n == null ? '–' : fmtMoney(n));
export const dayDe = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intlLocale(i18n.language), { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }) : '–');
/** Tag und Uhrzeit getrennt, damit der Satz („am … um … Uhr“) in der Übersetzung steht. */
export const dateTimeParts = (iso: string) => ({
  date: new Date(iso).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }),
  time: new Date(iso).toLocaleTimeString(intlLocale(i18n.language), { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }),
});

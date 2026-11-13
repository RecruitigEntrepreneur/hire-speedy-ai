import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { clientTasksApi, taskHref, useClientTasks, waitingLabel, type ClientTask } from '@/lib/clientTasksApi';
import { interviewApi } from '@/lib/interviewScheduling';
import { offerApi } from '@/lib/offerApi';
import { contractApi } from '@/lib/contractApi';
import { placementApi } from '@/lib/placementApi';
import { besetzungApi } from '@/lib/besetzungApi';
import type { ContractOpen } from '@/components/contracts/ContractBox';
import { TaskContextBlock } from './ClientTaskParts';
import i18n from '@/i18n';
import { useTranslation } from 'react-i18next';

// Texte der Kundenseite (clientTasks), gelesen beim Aufruf (README Regel 7).
// `labelDe` geht ins Protokoll (gespeichert, deutsch).
const tw = (key: string, options?: Record<string, unknown>): string => i18n.t(`clientTasks:${key}`, options);
const twDe = (key: string, options?: Record<string, unknown>): string => i18n.t(`clientTasks:${key}`, { ...options, lng: 'de' });

/**
 * Aufgaben-Fenster des Kunden (23.10.2026): eine Aufgabe, ihre Antworten zum Anklicken,
 * darunter die Felder der gewählten Antwort. Antworten mit eigenem Fenster (Interview
 * anfragen, Angebot, Vertrag, Absage) übergeben an das bekannte Fenster im Profil.
 * Kein Aufschieben (Entscheidung 23.10.); Gründe bei Abbruch Pflicht.
 * Umbau 11.11.2026: Antritt (K7), Absage vor dem Start (K8 → K5 „Besetzung endet“),
 * Position für die Nachbesetzung, Angebot Nachbesetzung (J2), Stelle ruht (F3).
 */

/** Was das Profil für Antworten mit eigenem Fenster bereitstellt. */
export interface TaskHandlers {
  requestInterview: (replacesInterviewId?: string | null) => void;
  reject: () => void;
  askRecruiter: () => void;
  offer: () => void;
  contract: (open: ContractOpen) => void;
}

type Field = 'none' | 'reason' | 'date' | 'text' | 'colleague' | 'po';

interface Option {
  key: string;
  label: string;
  /** Beschriftung auf Deutsch, so steht sie im Protokoll */
  labelDe?: string;
  /** Text auf dem Knopf unten */
  cta: string;
  field?: Field;
  hint?: string;
  /** Pflichtauswahl bei Abbruch */
  reasons?: { key: string; label: string }[];
  /** Felder prüfen; Text = Fehlermeldung */
  check?: (v: Values) => string | null;
  /** Satz nach dem Erledigen */
  doneText?: string;
  /** 'done' = erledigt (Fenster schreibt das Protokoll), 'logged' = erledigt (Server hat protokolliert), 'handoff' = anderes Fenster übernimmt; { logged } = erledigt mit eigenem Satz */
  run: (v: Values) => Promise<'done' | 'logged' | 'handoff' | { logged: string }>;
}

interface Values { reason: string; date: string; text: string; colleague: string; cost: string }

// `key` wird gespeichert (deutsch), angezeigt wird clientTasks:reasons.<…>
const INTERVIEW_CANCEL = () => [
  { key: 'Kandidat passt nicht mehr', label: tw('reasons.notFit') }, { key: 'Stelle ist besetzt', label: tw('reasons.filled') },
  { key: 'Termin entfällt intern', label: tw('reasons.internal') }, { key: 'Anderer Grund', label: tw('reasons.other') },
];
const OFFER_WITHDRAW = () => [
  { key: 'Keine Rückmeldung', label: tw('reasons.noResponse') }, { key: 'Anderer Kandidat', label: tw('reasons.otherCandidate') },
  { key: 'Budget', label: tw('reasons.budget') }, { key: 'Anderer Grund', label: tw('reasons.other') },
];
/** Wie NachbesetzungPanel: Kunde ist zum Anpassen der Stelle gegangen */
const markAdjusted = (placementId: string) => { try { sessionStorage.setItem(`matchunt:nachbesetzung-angepasst:${placementId}`, '1'); } catch { /* nur Komfort */ } };

const todayIso = () => new Date().toISOString().slice(0, 10);
const plusDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
/** Neue Antwortfrist: 3 Tage ab heute, oder ab der Frist, wenn sie noch läuft */
const nextDue = (due?: string) => (due && due > plusDays(0) ? new Date(Date.parse(`${due}T12:00:00Z`) + 3 * 86400000).toISOString().slice(0, 10) : plusDays(3));

function optionsFor(t: ClientTask, h: TaskHandlers | null, extra: { recruiter: string; navigate: (to: string) => void; canManageBilling: boolean }): Option[] {
  const hh = extra.recruiter;
  const go = (to: string): Option['run'] => async () => { extra.navigate(to); return 'handoff'; };
  const besetzung = (melden?: string) => `/dashboard/besetzungen?besetzung=${t.submissionId ?? ''}${melden ? `&melden=${melden}` : ''}`;
  const handoff = (fn: () => void): Option['run'] => async () => { fn(); return 'handoff'; };
  const needH = (fn: (x: TaskHandlers) => void): Option['run'] => async () => { if (h) fn(h); return 'handoff'; };
  const sid = t.submissionId ?? '';
  switch (t.kind) {
    case 'review':
      return [
        { key: 'ja', label: tw('opt.review.ja.label'), labelDe: twDe('opt.review.ja.label'), cta: tw('opt.review.ja.cta'), hint: tw('opt.review.ja.hint'), run: needH((x) => x.requestInterview(null)) },
        { key: 'nein', label: tw('opt.review.nein.label'), labelDe: twDe('opt.review.nein.label'), cta: tw('opt.review.nein.cta'), hint: tw('opt.review.nein.hint'), run: needH((x) => x.reject()) },
        { key: 'frage', label: tw('opt.review.frage.label', { hh }), labelDe: twDe('opt.review.frage.label', { hh }), cta: tw('opt.review.frage.cta'), hint: tw('opt.review.frage.hint'), run: needH((x) => x.askRecruiter()) },
      ];
    case 'alternative':
      return [
        { key: 'ok', label: tw('opt.alternative.ok.label'), labelDe: twDe('opt.alternative.ok.label'), cta: tw('opt.alternative.ok.cta'), hint: tw('opt.alternative.ok.hint'), doneText: tw('opt.alternative.ok.done'), run: async () => { await interviewApi.confirmAlternative(t.ref.interviewId!); return 'done'; } },
        { key: 'neu', label: tw('opt.alternative.neu.label'), labelDe: twDe('opt.alternative.neu.label'), cta: tw('opt.alternative.neu.cta'), hint: tw('opt.alternative.neu.hint'), run: needH((x) => x.requestInterview(t.ref.interviewId ?? null)) },
        { key: 'absagen', label: tw('opt.alternative.absagen.label'), labelDe: twDe('opt.alternative.absagen.label'), cta: tw('opt.alternative.absagen.cta'), doneText: tw('opt.alternative.absagen.done'), field: 'reason', reasons: INTERVIEW_CANCEL(), check: (v) => (v.reason ? null : tw('check.reason')),
          run: async (v) => { await interviewApi.withdraw(t.ref.interviewId!, v.reason); return 'done'; } },
      ];
    case 'expired_request':
      return [
        { key: 'neu', label: tw('opt.expired_request.neu.label'), labelDe: twDe('opt.expired_request.neu.label'), cta: tw('opt.expired_request.neu.cta'), run: needH((x) => x.requestInterview(t.ref.interviewId ?? null)) },
        { key: 'nachfassen', label: tw('opt.expired_request.nachfassen.label', { hh }), labelDe: twDe('opt.expired_request.nachfassen.label', { hh }), cta: tw('opt.expired_request.nachfassen.cta'), hint: tw('opt.expired_request.nachfassen.hint', { hh }),
          run: async () => { await clientTasksApi.askFollowup(sid, tw('followup.noReaction')); return 'handoff'; } },
        { key: 'beenden', label: tw('opt.expired_request.beenden.label'), labelDe: twDe('opt.expired_request.beenden.label'), cta: tw('opt.expired_request.beenden.cta'), run: needH((x) => x.reject()) },
      ];
    case 'decide_unsure':
      return [
        { key: 'angebot', label: tw('opt.decide_unsure.angebot.label'), labelDe: twDe('opt.decide_unsure.angebot.label'), cta: tw('opt.decide_unsure.angebot.cta'), hint: tw('opt.decide_unsure.angebot.hint', { hh }),
          doneText: tw('opt.decide_unsure.angebot.done', { hh }),
          run: async () => { await interviewApi.decideUnsure(t.ref.interviewId!, 'offer'); return 'done'; } },
        { key: 'runde', label: tw('opt.decide_unsure.runde.label'), labelDe: twDe('opt.decide_unsure.runde.label'), cta: tw('opt.decide_unsure.runde.cta'), run: async () => { await interviewApi.decideUnsure(t.ref.interviewId!, 'next_round'); h?.requestInterview(null); return 'handoff'; } },
        { key: 'absage', label: tw('opt.decide_unsure.absage.label'), labelDe: twDe('opt.decide_unsure.absage.label'), cta: tw('opt.decide_unsure.absage.cta'), run: needH((x) => x.reject()) },
      ];
    case 'make_offer':
      return [
        { key: 'angebot', label: tw('opt.make_offer.angebot.label'), labelDe: twDe('opt.make_offer.angebot.label'), cta: tw('opt.make_offer.angebot.cta'), hint: tw('opt.make_offer.angebot.hint'), run: needH((x) => x.offer()) },
        { key: 'frage', label: tw('opt.make_offer.frage.label', { hh }), labelDe: twDe('opt.make_offer.frage.label', { hh }), cta: tw('opt.make_offer.frage.cta'), hint: tw('opt.make_offer.frage.hint'), run: needH((x) => x.askRecruiter()) },
        { key: 'absage', label: tw('opt.make_offer.absage.label'), labelDe: twDe('opt.make_offer.absage.label'), cta: tw('opt.make_offer.absage.cta'), run: needH((x) => x.reject()) },
      ];
    case 'counter':
      return [
        { key: 'anpassen', label: tw('opt.counter.anpassen.label'), labelDe: twDe('opt.counter.anpassen.label'), cta: tw('opt.counter.anpassen.cta'), hint: tw('opt.counter.anpassen.hint'), run: needH((x) => x.offer()) },
        { key: 'bleiben', label: tw('opt.counter.bleiben.label'), labelDe: twDe('opt.counter.bleiben.label'), cta: tw('opt.counter.bleiben.cta'), doneText: tw('opt.counter.bleiben.done'), field: 'text', hint: tw('opt.counter.bleiben.hint'),
          run: async (v) => { await offerApi.keep(t.ref.offerId!, v.text.trim()); return 'done'; } },
        { key: 'absagen', label: tw('opt.counter.absagen.label'), labelDe: twDe('opt.counter.absagen.label'), cta: tw('opt.counter.absagen.cta'), doneText: tw('opt.counter.absagen.done'), field: 'reason', reasons: OFFER_WITHDRAW(), check: (v) => (v.reason ? null : tw('check.reason')),
          run: async () => { await offerApi.withdraw(t.ref.offerId!); return 'done'; } },
      ];
    case 'offer_overdue':
      return [
        { key: 'verlaengern', label: tw('opt.offer_overdue.verlaengern.label'), labelDe: twDe('opt.offer_overdue.verlaengern.label'), cta: tw('opt.offer_overdue.verlaengern.cta'), doneText: tw('opt.offer_overdue.verlaengern.done'), field: 'date', check: (v) => (v.date && v.date >= todayIso() ? null : tw('check.dateFromToday')),
          run: async (v) => { await offerApi.extend(t.ref.offerId!, v.date); return 'done'; } },
        { key: 'nachfassen', label: tw('opt.offer_overdue.nachfassen.label', { hh }), labelDe: twDe('opt.offer_overdue.nachfassen.label', { hh }), cta: tw('opt.offer_overdue.nachfassen.cta'), hint: tw('opt.offer_overdue.nachfassen.hint'),
          run: async () => { await clientTasksApi.askFollowup(sid, t.ref.responseDue && t.ref.responseDue >= plusDays(0) ? tw('followup.offerPending') : tw('followup.offerExpired')); return 'handoff'; } },
        { key: 'zurueck', label: tw('opt.offer_overdue.zurueck.label'), labelDe: twDe('opt.offer_overdue.zurueck.label'), cta: tw('opt.offer_overdue.zurueck.cta'), doneText: tw('opt.offer_overdue.zurueck.done'), field: 'reason', reasons: OFFER_WITHDRAW(), check: (v) => (v.reason ? null : tw('check.reason')),
          run: async () => { await offerApi.withdraw(t.ref.offerId!); return 'done'; } },
      ];
    case 'send_contract':
      return [
        { key: 'digital', label: tw('opt.send_contract.digital.label'), labelDe: twDe('opt.send_contract.digital.label'), cta: tw('opt.send_contract.digital.cta'), hint: tw('opt.send_contract.digital.hint'), run: needH((x) => x.contract('digital')) },
        { key: 'selbst', label: tw('opt.send_contract.selbst.label'), labelDe: twDe('opt.send_contract.selbst.label'), cta: tw('opt.send_contract.selbst.cta'), run: needH((x) => x.contract('verschickt')) },
        { key: 'unterschrieben', label: tw('opt.send_contract.unterschrieben.label'), labelDe: twDe('opt.send_contract.unterschrieben.label'), cta: tw('opt.send_contract.unterschrieben.cta'), run: needH((x) => x.contract('melden')) },
        { key: 'weg', label: tw('opt.send_contract.weg.label'), labelDe: twDe('opt.send_contract.weg.label'), cta: tw('opt.send_contract.weg.cta'), hint: tw('opt.send_contract.weg.hint'), run: needH((x) => x.contract('abgesprungen')) },
      ];
    case 'contract_signed_check':
      return [
        { key: 'ja', label: tw('opt.contract_signed_check.ja.label'), labelDe: twDe('opt.contract_signed_check.ja.label'), cta: tw('opt.contract_signed_check.ja.cta'), run: needH((x) => x.contract('melden')) },
        { key: 'nein', label: tw('opt.contract_signed_check.nein.label'), labelDe: twDe('opt.contract_signed_check.nein.label'), cta: tw('opt.contract_signed_check.nein.cta'), hint: tw('opt.contract_signed_check.nein.hint'), doneText: tw('opt.contract_signed_check.nein.done'), run: async () => 'done' },
        { key: 'weg', label: tw('opt.contract_signed_check.weg.label'), labelDe: twDe('opt.contract_signed_check.weg.label'), cta: tw('opt.contract_signed_check.weg.cta'), run: needH((x) => x.contract('abgesprungen')) },
      ];
    case 'docusign_sign':
      // Über Matchunt (23.10.2026): unterschreiben direkt, ohne DocuSign-Mail
      if (t.ref.signMode === 'embedded' && t.ref.signerExternal) {
        // Jemand anderes unterschreibt für die Firma und hat es seit 2 Tagen nicht getan
        return [
          { key: 'link', label: tw('opt.docusign_sign.link.label'), labelDe: twDe('opt.docusign_sign.link.label'), cta: tw('opt.docusign_sign.link.cta'), hint: tw('opt.docusign_sign.link.hint'),
            run: async () => { const r = await contractApi.resendLink(sid); toast.success(tw('toast.linkSent', { to: r.sentTo ?? tw('theSigner') })); return 'handoff'; } },
          { key: 'anderer', label: tw('opt.docusign_sign.anderer.label'), labelDe: twDe('opt.docusign_sign.anderer.label'), cta: tw('opt.docusign_sign.anderer.cta'), hint: tw('opt.docusign_sign.anderer.hint'), run: needH((x) => x.contract('unterzeichner')) },
          { key: 'selbst', label: tw('opt.docusign_sign.selbst.label'), labelDe: twDe('opt.docusign_sign.selbst.label'), cta: tw('opt.docusign_sign.selbst.cta'),
            run: async () => { await contractApi.voidDigital(sid, true); h?.contract('verschickt'); return 'handoff'; } },
        ];
      }
      if (t.ref.signMode === 'embedded') {
        return [
          { key: 'jetzt', label: tw('opt.docusign_sign.jetzt.label'), labelDe: twDe('opt.docusign_sign.jetzt.label'), cta: tw('opt.docusign_sign.jetzt.cta'), hint: tw('opt.docusign_sign.jetzt.hint'), run: needH((x) => x.contract('unterschreiben')) },
          { key: 'anderer', label: tw('opt.docusign_sign.anderer.label'), labelDe: twDe('opt.docusign_sign.anderer.label'), cta: tw('opt.docusign_sign.anderer.cta'), hint: tw('opt.docusign_sign.anderer1.hint'), run: needH((x) => x.contract('unterzeichner')) },
          { key: 'selbst', label: tw('opt.docusign_sign.selbst.label'), labelDe: twDe('opt.docusign_sign.selbst.label'), cta: tw('opt.docusign_sign.selbst.cta'),
            run: async () => { await contractApi.voidDigital(sid, true); h?.contract('verschickt'); return 'handoff'; } },
        ];
      }
      return [
        { key: 'mail', label: tw('opt.docusign_sign.mail.label'), labelDe: twDe('opt.docusign_sign.mail.label'), cta: tw('opt.docusign_sign.mail.cta'), hint: tw('opt.docusign_sign.mail.hint'),
          run: async () => { await contractApi.resend(sid); toast.success(tw('toast.docusignResent')); return 'handoff'; } },
        { key: 'stand', label: tw('opt.docusign_sign.stand.label'), labelDe: twDe('opt.docusign_sign.stand.label'), cta: tw('opt.docusign_sign.stand.cta'),
          run: async () => { await contractApi.refresh(sid); return 'handoff'; } },
        { key: 'anderer', label: tw('opt.docusign_sign.anderer.label'), labelDe: twDe('opt.docusign_sign.anderer.label'), cta: tw('opt.docusign_sign.anderer.cta'), hint: tw('opt.docusign_sign.anderer2.hint'),
          run: needH((x) => x.contract('unterzeichner')) },
        { key: 'selbst', label: tw('opt.docusign_sign.selbst.label'), labelDe: twDe('opt.docusign_sign.selbst.label'), cta: tw('opt.docusign_sign.selbst.cta'),
          run: async () => { await contractApi.voidDigital(sid, true); h?.contract('verschickt'); return 'handoff'; } },
      ];
    case 'confirm_signature':
      return [
        { key: 'ja', label: tw('opt.confirm_signature.ja.label'), labelDe: twDe('opt.confirm_signature.ja.label'), cta: tw('opt.confirm_signature.ja.cta'), hint: tw('opt.confirm_signature.ja.hint'), doneText: tw('opt.confirm_signature.ja.done'), run: async () => { await contractApi.confirm(sid, 'yes'); return 'done'; } },
        { key: 'werte', label: tw('opt.confirm_signature.werte.label'), labelDe: twDe('opt.confirm_signature.werte.label'), cta: tw('opt.confirm_signature.werte.cta'), run: needH((x) => x.contract('werte')) },
        { key: 'nein', label: tw('opt.confirm_signature.nein.label'), labelDe: twDe('opt.confirm_signature.nein.label'), cta: tw('opt.confirm_signature.nein.cta'), doneText: tw('opt.confirm_signature.nein.done'), run: async () => { await contractApi.confirm(sid, 'not_yet'); return 'done'; } },
      ];
    case 'recruiter_question':
      return [
        { key: 'antworten', label: tw('opt.recruiter_question.antworten.label'), labelDe: twDe('opt.recruiter_question.antworten.label'), cta: tw('opt.recruiter_question.antworten.cta'), doneText: tw('opt.recruiter_question.antworten.done'), field: 'text', check: (v) => (v.text.trim().length >= 2 ? null : tw('check.answer')),
          run: async (v) => { await clientTasksApi.answerQuestion(t.ref.notificationId!, v.text.trim()); return 'logged'; } },
        { key: 'kollege', label: tw('opt.recruiter_question.kollege.label'), labelDe: twDe('opt.recruiter_question.kollege.label'), cta: tw('opt.recruiter_question.kollege.cta'), doneText: tw('opt.recruiter_question.kollege.done'), field: 'colleague', check: (v) => (v.colleague ? null : tw('check.person')),
          run: async (v) => { const r = await clientTasksApi.forwardQuestion(t.ref.notificationId!, v.colleague); toast.success(tw('toast.forwarded', { to: r.to })); return 'logged'; } },
      ];
    case 'confirm_start':
      // K7: Kunde meldet zuerst. „Hat nicht angefangen“ öffnet „Besetzung endet“ mit „Nein“.
      return [
        { key: 'ja', label: tw('opt.confirm_start.ja.label'), labelDe: twDe('opt.confirm_start.ja.label'), cta: tw('opt.confirm_start.ja.cta'), doneText: tw('opt.confirm_start.ja.done'),
          run: async () => { await besetzungApi.startAnswer({ placementId: t.ref.placementId!, way: 'started' }); return 'logged'; } },
        { key: 'spaeter', label: tw('opt.confirm_start.spaeter.label'), labelDe: twDe('opt.confirm_start.spaeter.label'), cta: tw('opt.confirm_start.spaeter.cta'), doneText: tw('opt.confirm_start.spaeter.done'), field: 'date',
          check: (v) => (v.date && v.date > todayIso() ? null : tw('check.newFirstDay')),
          run: async (v) => { await besetzungApi.startAnswer({ placementId: t.ref.placementId!, way: 'later', startDate: v.date }); return 'logged'; } },
        { key: 'nein', label: tw('opt.confirm_start.nein.label'), labelDe: twDe('opt.confirm_start.nein.label'), cta: tw('opt.confirm_start.nein.cta'), hint: tw('opt.confirm_start.nein.hint'), run: go(besetzung('ende')) },
      ];
    case 'start_check':
      // K7: Headhunter hat zuerst gemeldet; ohne Antwort gilt es nach 3 Werktagen als bestätigt
      return [
        { key: 'ja', label: tw('opt.start_check.ja.label'), labelDe: twDe('opt.start_check.ja.label'), cta: tw('opt.start_check.ja.cta'), doneText: tw('opt.start_check.ja.done'),
          run: async () => { await besetzungApi.startAnswer({ placementId: t.ref.placementId!, way: 'agree' }); return 'logged'; } },
        { key: 'nein', label: tw('opt.start_check.nein.label'), labelDe: twDe('opt.start_check.nein.label'), cta: tw('opt.start_check.nein.cta'), field: 'text', hint: tw('opt.start_check.nein.hint'),
          doneText: tw('opt.start_check.nein.done'), check: (v) => (v.text.trim() ? null : tw('check.whatWrong')),
          run: async (v) => { await besetzungApi.startAnswer({ placementId: t.ref.placementId!, way: 'disagree', note: v.text.trim() }); return 'logged'; } },
      ];
    case 'end_confirm':
      return [
        { key: 'ja', label: tw('opt.end_confirm.ja.label'), labelDe: twDe('opt.end_confirm.ja.label'), cta: tw('opt.end_confirm.ja.cta'), hint: tw('opt.end_confirm.ja.hint'), run: go(besetzung('ende')) },
      ];
    case 'research_position':
      return [
        { key: 'so', label: tw('opt.research_position.so.label'), labelDe: twDe('opt.research_position.so.label'), cta: tw('opt.research_position.so.cta'), hint: tw('opt.research_position.so.hint'),
          run: async () => {
            const r = await besetzungApi.confirmPosition(t.ref.placementId!, false);
            return { logged: r.state === 'running' ? i18n.t('clientPlacements:research.confirmedRunning') : i18n.t('clientPlacements:research.confirmedAfterPay') };
          } },
        { key: 'anpassen', label: tw('opt.research_position.anpassen.label'), labelDe: twDe('opt.research_position.anpassen.label'), cta: tw('opt.research_position.anpassen.cta'), hint: tw('opt.research_position.anpassen.hint'),
          run: async () => { if (t.ref.placementId) markAdjusted(t.ref.placementId); extra.navigate(`/dashboard/jobs/${t.jobId ?? ''}`); return 'handoff'; } },
      ];
    case 'research_offer':
      return [
        { key: 'ja', label: tw('opt.research_offer.ja.label'), labelDe: twDe('opt.research_offer.ja.label'), cta: tw('opt.research_offer.ja.cta'),
          run: async () => {
            const r = await besetzungApi.answerOffer(t.ref.placementId!, true);
            return { logged: r.state === 'running' ? i18n.t('clientPlacements:research.acceptedRunning') : tw('toast.acceptedAfterPay') };
          } },
        { key: 'nein', label: tw('opt.research_offer.nein.label'), labelDe: twDe('opt.research_offer.nein.label'), cta: tw('opt.research_offer.nein.cta'), doneText: tw('opt.research_offer.nein.done'),
          run: async () => { await besetzungApi.answerOffer(t.ref.placementId!, false); return 'logged'; } },
        { key: 'ansehen', label: tw('opt.research_offer.ansehen.label'), labelDe: twDe('opt.research_offer.ansehen.label'), cta: tw('opt.research_offer.ansehen.cta'), run: go(besetzung()) },
      ];
    case 'job_paused':
      return [
        { key: 'geben', label: tw('opt.job_paused.geben.label'), labelDe: twDe('opt.job_paused.geben.label'), cta: tw('opt.job_paused.geben.cta'), run: go(`/dashboard/candidates?job=${t.jobId ?? ''}&tab=neu`) },
      ];
    case 'invoice':
      return [
        { key: 'pdf', label: tw('opt.invoice.pdf.label'), labelDe: twDe('opt.invoice.pdf.label'), cta: tw('opt.invoice.pdf.cta'), run: async () => { const { url } = await placementApi.file(t.ref.invoiceId!); window.open(url, '_blank', 'noopener'); return 'handoff'; } },
        // HR sieht Rechnungen nur lesend
        ...(extra.canManageBilling ? [{ key: 'bezahlt', label: tw('opt.invoice.bezahlt.label'), labelDe: twDe('opt.invoice.bezahlt.label'), cta: tw('opt.invoice.bezahlt.cta'), doneText: tw('opt.invoice.bezahlt.done'), field: 'date' as const, hint: tw('opt.invoice.bezahlt.hint'),
          check: (v: Values) => (v.date ? null : tw('check.transferDate')), run: async (v: Values) => { await clientTasksApi.invoicePaid(t.ref.invoiceId!, v.date); return 'logged' as const; } }] : []),
        { key: 'frage', label: tw('opt.invoice.frage.label'), labelDe: twDe('opt.invoice.frage.label'), cta: tw('opt.invoice.frage.cta'), field: 'text', check: (v) => (v.text.trim().length >= 3 ? null : tw('check.question')),
          run: async (v) => { await clientTasksApi.invoiceQuestion(t.ref.invoiceId!, v.text.trim()); toast.success(tw('toast.questionSent')); return 'handoff'; } },
      ];
    case 'purchase_order':
      return [
        { key: 'eintragen', label: tw('opt.purchase_order.eintragen.label'), labelDe: twDe('opt.purchase_order.eintragen.label'), cta: tw('opt.purchase_order.eintragen.cta'), doneText: tw('opt.purchase_order.eintragen.done'), field: 'po',
          check: (v) => (v.text.trim() ? null : tw('check.po')),
          run: async (v) => { await besetzungApi.setPurchaseOrder(t.ref.placementId!, v.text.trim(), v.cost.trim()); return 'logged'; } },
      ];
    default:
      return [{ key: 'open', label: tw('opt.default.open.label'), labelDe: twDe('opt.default.open.label'), cta: tw('opt.default.open.cta'), run: handoff(() => {}) }];
  }
}

interface Props {
  task: ClientTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handlers: TaskHandlers | null;
  recruiterName?: string | null;
}

export function ClientTaskWindow({ task, open, onOpenChange, handlers, recruiterName }: Props) {
  const { t, i18n: { language } } = useTranslation('clientTasks');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const all = useClientTasks();
  const hh = (recruiterName ?? 'Headhunter').split(' ')[0];
  const canManageBilling = all.data?.billing?.canManage ?? true;
  const options = useMemo(() => (task ? optionsFor(task, handlers, { recruiter: hh, navigate, canManageBilling }) : []), [task, handlers, hh, navigate, canManageBilling, language]); // eslint-disable-line react-hooks/exhaustive-deps
  const [choice, setChoice] = useState<string>('');
  const [values, setValues] = useState<Values>({ reason: '', date: '', text: '', colleague: '', cost: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [colleagues, setColleagues] = useState<{ userId: string; name: string }[] | null>(null);

  useEffect(() => {
    if (!open || !task) return;
    setChoice(options[0]?.key ?? '');
    setValues({ reason: '', date: task.kind === 'offer_overdue' ? nextDue(task.ref.responseDue) : task.kind === 'invoice' ? todayIso() : '', text: '', colleague: '', cost: '' });
    setError(null);
    setDone(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.key]);

  const opt = options.find((o) => o.key === choice) ?? null;
  useEffect(() => {
    if (opt?.field === 'colleague' && task?.ref.notificationId && colleagues === null) {
      clientTasksApi.colleagues(task.ref.notificationId).then((r) => setColleagues(r.colleagues)).catch(() => setColleagues([]));
    }
  }, [opt?.field, task?.ref.notificationId, colleagues]);

  if (!task) return null;
  const list = all.data?.tasks ?? [];
  const index = list.findIndex((x) => x.key === task.key);
  const next = list.find((x) => x.key !== task.key) ?? null;

  const submit = async () => {
    if (!opt) return;
    const msg = opt.check?.(values) ?? null;
    if (msg) { setError(msg); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await opt.run(values);
      if (typeof r === 'object') {
        setDone(r.logged);
      } else if (r === 'done' || r === 'logged') {
        if (r === 'done') await clientTasksApi.logDone(task, `${task.title}: ${opt.labelDe ?? opt.label}`, values.reason || undefined).catch(() => undefined);
        setDone(opt.doneText ?? `${opt.label}.`);
      } else {
        onOpenChange(false);
      }
      queryClient.invalidateQueries({ queryKey: ['client-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['submission-state'] });
      queryClient.invalidateQueries({ queryKey: ['contract'] });
      queryClient.invalidateQueries({ queryKey: ['bewerber'] });
      queryClient.invalidateQueries({ queryKey: ['besetzungen'] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader className="text-left">
          <DialogTitle>{task.context?.ask ?? task.title}</DialogTitle>
          <DialogDescription>{task.who}{task.jobTitle && task.who !== task.jobTitle ? ` · ${task.jobTitle}` : ''} · {waitingLabel(task)}</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div><p className="font-medium">{t('done')}</p><p className="text-muted-foreground">{done}</p></div>
            </div>
            {next ? (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground">{t('nextTask')}</p>
                <p className="font-medium">{next.title}</p>
                <p className="text-xs text-muted-foreground">{next.who}{next.jobTitle ? ` · ${next.jobTitle}` : ''} · {waitingLabel(next)}</p>
              </div>
            ) : <p className="text-sm text-muted-foreground">{t('allDone')}</p>}
            <div className="flex justify-end gap-2 border-t pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('close')}</Button>
              {next && <Button onClick={() => { onOpenChange(false); navigate(taskHref(next)); }}>{t('next')}</Button>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <TaskContextBlock task={task} />

            <div className="flex flex-wrap gap-1.5">
              {options.map((o) => (
                <Button key={o.key} type="button" size="sm" variant={choice === o.key ? 'default' : 'outline'} className="h-8 text-xs" onClick={() => { setChoice(o.key); setError(null); }}>
                  {o.label}
                </Button>
              ))}
            </div>

            {opt?.hint && <p className="text-xs text-muted-foreground">{opt.hint}</p>}

            {opt?.field === 'reason' && (
              <div className="flex flex-wrap gap-1.5">
                <span className="w-full text-xs text-muted-foreground">{t('reasonRequired')}</span>
                {(opt.reasons ?? []).map((r) => (
                  <Button key={r.key} type="button" size="sm" variant={values.reason === r.key ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setValues((v) => ({ ...v, reason: r.key }))}>{r.label}</Button>
                ))}
              </div>
            )}
            {opt?.field === 'date' && (
              <label className="block text-sm"><span className="text-muted-foreground">{task.kind === 'invoice' ? t('field.transferredOn') : task.kind === 'confirm_start' ? t('field.newFirstDay') : t('field.newDeadline')}</span>
                <Input type="date" className="mt-1 h-9 w-48" value={values.date} onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))} /></label>
            )}
            {opt?.field === 'text' && (
              <Textarea rows={task.kind === 'recruiter_question' ? 4 : 2} placeholder={task.kind === 'counter' ? t('field.counterPlaceholder') : task.kind === 'invoice' ? t('field.invoicePlaceholder') : task.kind === 'start_check' ? t('field.startCheckPlaceholder') : t('field.answerPlaceholder')}
                value={values.text} onChange={(e) => setValues((v) => ({ ...v, text: e.target.value }))} />
            )}
            {opt?.field === 'po' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="text-muted-foreground">{t('field.po')}</span>
                  <Input className="mt-1 h-9" placeholder={t('field.poPlaceholder')} value={values.text} onChange={(e) => setValues((v) => ({ ...v, text: e.target.value }))} /></label>
                <label className="block text-sm"><span className="text-muted-foreground">{t('field.costCenter')}</span>
                  <Input className="mt-1 h-9" placeholder={t('field.costPlaceholder')} value={values.cost} onChange={(e) => setValues((v) => ({ ...v, cost: e.target.value }))} /></label>
              </div>
            )}
            {opt?.field === 'colleague' && (
              <div className="flex flex-wrap gap-1.5">
                {colleagues === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  : colleagues.length === 0 ? <p className="text-xs text-muted-foreground">{t('noColleagues')}</p>
                  : colleagues.map((c) => (
                    <Button key={c.userId} type="button" size="sm" variant={values.colleague === c.userId ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setValues((v) => ({ ...v, colleague: c.userId }))}>{c.name}</Button>
                  ))}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between gap-2 border-t pt-3">
              <span className={cn('text-xs text-muted-foreground', index < 0 && 'invisible')}>{t('position', { n: index + 1, total: list.length })}</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                <Button disabled={busy || !opt} onClick={() => void submit()}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}{opt?.cta ?? t('continue')}</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

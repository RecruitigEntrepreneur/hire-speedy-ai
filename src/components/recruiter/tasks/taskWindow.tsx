// Aufgaben-Fenster und Handgriffe, gemeinsam für die Seite „Aufgaben“ (RecruiterHeute)
// und das Kandidatenprofil (Entscheidung 14.10.2026: Klick auf eine Aufgabe im
// Dashboard führt ins Kandidatenprofil, dort öffnet sich die Aufgabe).
// Aus RecruiterHeute.tsx herausgelöst, Inhalt unverändert.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import deTexte from '@/i18n/locales/recruiterTasks/de';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { notifyTasksChanged, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useAuth } from '@/lib/auth';
import { candidateLanguage } from '@/lib/localeFormat';
import { messageSetFor, composeClientText, composeCandidateText, clientLangOfLocation } from '@/lib/aufgabenTexte';
import { functionError } from '@/lib/functionError';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, Lock, Mail, NotebookPen, Phone } from 'lucide-react';
import { KundenFrageWindow } from './KundenFrageWindow';
import type { RecruiterOfferContext } from '@/lib/offerApi';
import { NachgespraechWindow, nachTargetFromContext, nachTargetFromItem, type NachTarget } from './NachgespraechWindow';
import { OfferAnswerDialog } from '@/components/offers/OfferAnswerDialog';
import { RecommendationDialog } from '@/components/offers/RecommendationDialog';
import { ContractWindow } from '@/components/contracts/ContractWindow';
import { Honorar } from '@/components/recruiter/Honorar';
import { vorbereitenTexte, type Vorbereitung } from '@/lib/kandidatVorbereiten';
import { clockTime, dayMonth, dayMonthBare, dfLocale, loc } from './sprache';
import { VorbereitenFenster } from './VorbereitenFenster';
// Antritt und Halbzeit (H7, Umbau 11.11.2026): Systemaufgaben aus dem täglichen Lauf, eigenes Fenster
import { StartAufgabeFenster, type StartAufgabe } from '@/components/recruiter/verdienste/StartAufgabeFenster';
import { startTaskKind } from '../../../../supabase/functions/_shared/abrechnung-view';

export const DAY_MS = 86_400_000;

/** Erster Arbeitstag oder Halbzeit: aus `variant` (Titel ist übersetzt), sonst aus dem gespeicherten Titel. */
const startKindOf = (it: UnifiedTaskItem) => (it.itemType !== 'task' ? null
  : it.variant === 'start' || it.variant === 'halfway' ? it.variant : startTaskKind(it.title));

const NS = 'recruiterTasks';
type TT = (key: string, options?: Record<string, unknown>) => string;
/** Texte in der Sprache der Oberfläche, gelesen beim Aufruf (README Regel 7). */
const tr: TT = (key, options) => i18n.t(`${NS}:${key}`, options);
// Was ins Aktivitätslog geschrieben wird (Titel, outcome), bleibt deutsch, egal in welcher Sprache
// die Oberfläche läuft. Darum liegen die deutschen Texte hier immer bereit.
i18n.addResourceBundle('de', NS, deTexte, true, false);
const trDe: TT = (key, options) => i18n.t(`${NS}:${key}`, { ...options, lng: 'de' });

export type Kind = 'call' | 'called' | 'followup' | 'debrief' | 'done' | 'akte' | 'client' | 'candidate' | 'offer' | 'recommend' | 'contract' | 'prep' | 'frage' | 'start';

export interface Guide {
  pill: string;
  advice: string;
  facts: string[];
  consequence: string | null;
  steps: { text: string; hint?: string }[];
  goal: string;
  /** Ziel auf Deutsch, so steht es im Aktivitätslog („Erreicht: …“). */
  goalLog: string;
  primary: { label: string; kind: Kind };
  /** `value` wird gespeichert (deutsch), `label` steht auf dem Knopf. */
  reachedOptions: { value: string; label: string }[];
}

export const euro = (n: number | null) => (n && n > 0 ? tr('money.thousands', { k: Math.round(n / 1000) }) : null);
export const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)) : 0);
export const hoursSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)) : 0);
export const firstName = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : tr('fallback.theCandidate'));
/** Deutsches Kurzdatum für Texte, die an Dritte gehen (Mail an Kandidaten). In der Oberfläche: `dateShort`. */
export const dateDe = (iso: string | null) => (iso ? format(new Date(iso), 'dd.MM.', { locale: de }) : '');
/** Tag und Monat in der Sprache der Oberfläche, deutsch „13.10.“. */
export const dateShort = (iso: string | null) => (iso ? dayMonth(iso) : '');
/** Satzende ohne doppelten Punkt nach einem Datum („am 13.10.“). */
const satz = (s: string) => (s.endsWith('.') ? s : `${s}.`);

const berlinTag = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
/** Kalendertage in Berlin seit dem Zeitpunkt: 0 = heute, 1 = gestern. */
export const daysAgo = (iso: string, now = Date.now()) =>
  Math.round((Date.parse(`${berlinTag(now)}T12:00:00Z`) - Date.parse(`${berlinTag(Date.parse(iso))}T12:00:00Z`)) / DAY_MS);

const aufzaehlung = (l: string[], n: number) => {
  if (l.length <= n) return l.length > 1 ? tr('prep.list.and', { head: l.slice(0, -1).join(', '), last: l[l.length - 1] }) : l[0] ?? '';
  return tr('prep.list.more', { head: l.slice(0, n).join(', '), count: l.length - n });
};

/**
 * Texte der Aufgaben vor der Einreichung: Pille, Satz, Kurzzeile fürs Dashboard, Knopf.
 * Gleiche Regeln wie `vorbereitenTexte` in lib/kandidatVorbereiten.ts (geteilt, deutsch), hier in
 * der Sprache der Oberfläche. Ändert sich dort eine Regel, hier nachziehen.
 */
export function prepTexts(v: Vorbereitung, now = Date.now()) {
  const d = daysAgo(v.seit, now);
  switch (v.art) {
    case 'termin': {
      const t = v.termin!;
      const min = Math.round((Date.parse(t.start) - now) / 60_000);
      const mode = t.mode === 'teams' ? 'teams' : 'phone';
      const time = clockTime(t.start, 'Europe/Berlin');
      return {
        pill: tr('prep.termin.pill'),
        text: tr(`prep.termin.${min <= 0 ? 'running' : min <= 90 ? 'soon' : 'today'}.${mode}`, { time, min }),
        kurz: tr(`prep.termin.kurz.${mode}`, { time }),
        knopf: tr('prep.termin.knopf'),
      };
    }
    case 'war':
      return {
        pill: tr('prep.war.pill'),
        text: d > 2 ? tr('prep.war.textOld', { date: dayMonth(v.seit) })
          : d <= 0 ? tr('prep.war.textToday') : d === 1 ? tr('prep.war.textYesterday') : tr('prep.war.textDays', { count: d }),
        kurz: tr('prep.war.kurz'),
        knopf: tr('prep.war.knopf'),
      };
    case 'entwurf': {
      const seit = d <= 0 ? tr('prep.entwurf.sinceToday') : d === 1 ? tr('prep.entwurf.sinceYesterday') : tr('prep.entwurf.sinceDays', { count: d });
      return {
        pill: tr('prep.entwurf.pill'),
        text: `${seit} ${v.luecken.length ? tr('prep.entwurf.missing', { list: aufzaehlung(v.luecken, 2) }) : tr('prep.entwurf.complete')}`,
        kurz: v.luecken.length ? tr('prep.entwurf.kurzMissing', { list: aufzaehlung(v.luecken, 1) }) : tr('prep.entwurf.kurzComplete'),
        knopf: tr('prep.entwurf.knopf'),
      };
    }
    case 'eingeladen': {
      const opened = v.einladung?.geoeffnetAm ? 'Opened' : 'Unopened';
      return {
        pill: tr('prep.eingeladen.pill'),
        text: d === 1 ? tr(`prep.eingeladen.textYesterday${opened}`) : tr(`prep.eingeladen.textDays${opened}`, { count: d }),
        kurz: d === 1 ? tr('prep.eingeladen.kurzYesterday') : tr('prep.eingeladen.kurzDays', { count: d }),
        knopf: tr('prep.eingeladen.knopf'),
      };
    }
    case 'bereit':
      return {
        pill: tr('prep.bereit.pill'),
        text: v.stellen ? tr('prep.bereit.textJobs', { count: v.stellen }) : tr('prep.bereit.text'),
        kurz: v.stellen ? tr('prep.bereit.kurzJobs', { count: v.stellen }) : tr('prep.bereit.kurz'),
        knopf: tr('prep.bereit.knopf'),
      };
    default:
      return {
        pill: tr('prep.neu.pill'),
        text: d <= 0 ? tr('prep.neu.textToday') : d === 1 ? tr('prep.neu.textYesterday') : tr('prep.neu.textDays', { count: d }),
        kurz: tr('prep.neu.kurz'),
        knopf: tr('prep.neu.knopf'),
      };
  }
}

/** „Hat das Kundenteam das Profil geöffnet?“ – wie `viewText` in lib/kundePrueft.ts (geteilt, deutsch), in der Sprache der Oberfläche. */
export function viewLabel(count: number | null | undefined, lastAt: string | null | undefined): string {
  if (!count || !lastAt) return tr('view.notOpened');
  const date = new Date(lastAt).toLocaleDateString(loc(), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
  return count === 1 ? tr('view.once', { date }) : tr('view.many', { count, date });
}

/** Die Aufgabe in Worten. `t` ist nur für das Aktivitätslog deutsch fest (`guideDe`), sonst die Sprache der Oberfläche. */
export function buildGuide(item: UnifiedTaskItem): Guide {
  const g = (key: string, options?: Record<string, unknown>) => tr(`guide.${key}`, options);
  /** Ziel und „Erreicht?“-Antworten: Anzeige in der Sprache der Oberfläche, gespeichert auf Deutsch. */
  const goalOf = (key: string, options?: Record<string, unknown>) => ({ goal: g(key, options), goalLog: trDe(`guide.${key}`, options) });
  const opt = (key: string, options?: Record<string, unknown>, optionsDe = options) => ({ value: trDe(`guide.${key}`, optionsDe), label: g(key, options) });
  const name = item.candidateName || tr('fallback.candidate');
  const first = firstName(item.candidateName);
  /** Vorname für gespeicherte deutsche Texte */
  const firstDe = item.candidateName ? first : trDe('fallback.theCandidate');
  const job = item.jobTitle || tr('fallback.theJob');
  const fee = euro(item.feeValue);
  const feeFact = fee ? g('feeFact', { fee }) : '';
  const cat = item.taskCategory;

  if (item.prep) {
    const t = prepTexts(item.prep);
    return { pill: t.pill, advice: t.text, facts: [], consequence: null, steps: [], goal: t.pill, goalLog: vorbereitenTexte(item.prep).pill, primary: { label: t.knopf, kind: 'prep' }, reachedOptions: [] };
  }
  if (cat === 'client_review_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: g('reviewStalled.pill'),
      advice: g('reviewStalled.advice', { count: d }),
      facts: [
        g('reviewStalled.fact1', { date: dateShort(item.createdAt), count: d }),
        fee ? feeFact : g('feeUnknown'),
        g('reviewStalled.fact3'),
      ],
      consequence: d >= 14 ? g('reviewStalled.consequenceLate') : g('reviewStalled.consequence'),
      steps: [
        { text: g('reviewStalled.step1'), hint: g('reviewStalled.step1Hint') },
        { text: g('keepPosted', { first }), hint: g('reviewStalled.step2Hint') },
      ],
      ...goalOf('reviewStalled.goal'),
      primary: { label: g('remindClient'), kind: 'client' },
      reachedOptions: [opt('reviewStalled.reached.promised'), opt('reviewStalled.reached.moreInfo'), opt('reviewStalled.reached.declined'), opt('informedGoal', { first }, { first: firstDe })],
    };
  }
  if (cat === 'client_feedback_due') {
    // Kunde gibt nach dem Interview keinen Eindruck (28.10.2026); das Fenster ist das Stellen-Fenster
    const d = daysSince(item.createdAt);
    return {
      pill: g('feedbackDue.pill'),
      advice: g('feedbackDue.advice', { count: d }),
      facts: [
        g('feedbackDue.fact1', { name, date: dateShort(item.interviewAt ?? item.createdAt) }),
        fee ? feeFact : g('feeUnknown'),
      ],
      consequence: g('feedbackDue.consequence', { first }),
      steps: [
        { text: g('feedbackDue.step1'), hint: g('feedbackDue.step1Hint') },
        { text: g('keepPosted', { first }) },
      ],
      ...goalOf('feedbackDue.goal'),
      primary: { label: g('askClient'), kind: 'client' },
      reachedOptions: [],
    };
  }
  if (cat === 'job_closed_inform') {
    // Stelle besetzt oder geschlossen (28.10.2026): Kandidat informieren statt Kunden erinnern
    const besetzt = item.variant === 'filled';
    const art = besetzt ? 'filled' : 'closed';
    return {
      pill: g(`jobClosed.${art}.pill`),
      advice: g(`jobClosed.${art}.advice`, { first }),
      facts: [
        g(`jobClosed.${art}.fact1`, { company: item.companyName ?? tr('fallback.theClient'), job, date: dateShort(item.createdAt) }),
        g('jobClosed.fact2', { name }),
      ],
      consequence: g('jobClosed.consequence', { first }),
      steps: [
        { text: g('informCandidateStep', { first }), hint: g('jobClosed.step1Hint') },
        { text: g('offerOtherJobs') },
      ],
      ...goalOf('informedGoal', { first }),
      goalLog: trDe('guide.informedGoal', { first: firstDe }),
      primary: { label: g('informCandidate', { first }), kind: 'candidate' },
      reachedOptions: [opt('reached.informed'), opt('reached.otherJobs'), opt('reached.noInterest')],
    };
  }
  if (cat === 'interview_debrief_due') {
    // Nachgespräch statt Debrief (20.10.2026): zuerst hören, was der Kandidat sagt.
    const h = hoursSince(item.createdAt);
    return {
      pill: g('debrief.pill'),
      // „solange es frisch ist“ nur in den ersten zwei Tagen (Durchklick 27.10.2026)
      advice: h < 48
        ? g('debrief.adviceFresh', { hours: h, first })
        : g('debrief.adviceLate', { date: dayMonthBare(item.createdAt), first }),
      facts: [
        g('debrief.fact1', { name, job }),
        g('debrief.fact2'),
        feeFact,
      ].filter(Boolean),
      consequence: g('debrief.consequence'),
      steps: [
        { text: g('callCandidateStep', { first }), hint: g('debrief.step1Hint') },
        { text: g('debrief.step2') },
      ],
      ...goalOf('debrief.goal'),
      primary: { label: g('debrief.primary'), kind: 'debrief' },
      reachedOptions: [],
    };
  }
  if (cat === 'offer_deliver') {
    // Angebot über den Headhunter (22.10.2026; G + H 25.10.2026): Der Kandidat antwortet selbst,
    // der Headhunter ruft an, bevor die Mail rausgeht, ruft zurück und fasst nach
    const v = item.variant;
    const considering = v === 'considering';
    // Kalendertage bis zur Frist (heute = 0)
    const left = item.dueAt ? Math.round((Date.parse(`${berlinTag(new Date(item.dueAt).getTime())}T12:00:00Z`) - Date.parse(`${berlinTag(Date.now())}T12:00:00Z`)) / DAY_MS) : null;
    const deadline = left === null ? '' : left < 0 ? g('offer.deadlineOver') : left === 0 ? g('offer.deadlineToday') : g('offer.deadlineLeft', { count: left });
    // Die Spielart steht in `variant`; die Beschreibung (schon in der Sprache der Oberfläche) wird nur angehängt
    const note = item.mailAt ? i18n.t('taskTexts:offer.atTime', { time: clockTime(item.mailAt, 'Europe/Berlin') }) : '';
    const advice = v === 'callback' ? `${g('offer.adviceCallback', { first })} ${item.description ? satz(item.description) : ''}`
      : v === 'deliver' ? (note ? g('offer.adviceDeliverNote', { first, note }) : g('offer.adviceDeliver', { first }))
        : v === 'noAnswer' ? g('offer.adviceNoAnswer', { first, deadline })
          : v === 'notConfirmedYet' ? g('offer.adviceNotConfirmed', { first })
            : considering ? g('offer.adviceConsidering', { first, deadline })
              : g('offer.adviceWritten', { first, deadline });
    return {
      pill: g('offer.pill'),
      advice,
      facts: [
        item.companyName ? g('offer.fact1Company', { job, company: item.companyName }) : g('offer.fact1', { job }),
        g('offer.fact2', { first }),
        feeFact,
      ].filter(Boolean),
      consequence: g('offer.consequence'),
      steps: [
        { text: g('offer.step1', { first }), hint: g('offer.step1Hint') },
        { text: g('offer.step2'), hint: g('offer.step2Hint') },
      ],
      ...goalOf('offer.goal'),
      primary: { label: g('offer.primary'), kind: 'offer' },
      reachedOptions: [],
    };
  }
  if (cat === 'client_unsure') {
    return {
      pill: g('clientQuestion.pill'),
      advice: g('clientQuestion.adviceUnsure', { first }),
      facts: [item.description ? satz(g('clientQuestion.factQuestion', { question: item.description })) : '', feeFact].filter(Boolean),
      consequence: g('clientQuestion.consequenceUnsure'),
      steps: [{ text: g('clientQuestion.stepClarify') }, { text: g('clientQuestion.stepAnswer') }],
      ...goalOf('clientQuestion.goalAnswer'),
      primary: { label: g('clientQuestion.primaryAnswer'), kind: 'frage' },
      reachedOptions: [],
    };
  }
  if (cat === 'client_undecided') {
    const d = daysSince(item.createdAt);
    return {
      pill: g('clientQuestion.pill'),
      advice: g('clientQuestion.adviceUndecided', { count: d, first }),
      facts: [feeFact].filter(Boolean),
      consequence: g('clientQuestion.consequenceUndecided'),
      steps: [{ text: g('clientQuestion.stepNotify'), hint: g('clientQuestion.stepNotifyHint') }, { text: g('clientQuestion.stepTell', { first }) }],
      ...goalOf('clientDecisionGoal'),
      primary: { label: g('clientQuestion.primaryNotify'), kind: 'client' },
      reachedOptions: [],
    };
  }
  if (cat === 'recommendation_due') {
    return {
      pill: g('recommendation.pill'),
      advice: g('recommendation.advice', { first }),
      facts: [
        g('recommendation.fact1', { job }),
        g('recommendation.fact2'),
        feeFact,
      ].filter(Boolean),
      consequence: g('recommendation.consequence'),
      steps: [
        { text: g('recommendation.step1'), hint: g('recommendation.step1Hint') },
        { text: g('recommendation.step2'), hint: g('recommendation.step2Hint') },
      ],
      ...goalOf('recommendation.goal'),
      primary: { label: g('recommendation.primary'), kind: 'recommend' },
      reachedOptions: [],
    };
  }
  if (cat === 'contract_check' || cat === 'contract_nudge' || cat === 'contract_followup' || cat === 'contract_follow' || cat === 'contract_missing') {
    // Arbeitsvertrag (Paket 3)
    const check = cat === 'contract_check';
    const nudge = cat === 'contract_nudge';
    return {
      pill: check ? g('contract.pillCheck') : g('contract.pill'),
      advice: check ? g('contract.adviceCheck', { first })
        : nudge ? g('contract.adviceNudge', { first })
          : cat === 'contract_missing' ? g('contract.adviceMissing', { first })
          : cat === 'contract_follow' && item.variant === 'declined' ? g('contract.adviceDeclined', { first })
          : cat === 'contract_follow' ? g('contract.adviceFollow', { note: item.description ?? '', first })
            : g('contract.adviceAsk', { note: item.description ?? g('contract.noSignature'), first }),
      facts: [
        item.companyName ? g('contract.fact1Company', { job, company: item.companyName }) : g('contract.fact1', { job }),
        feeFact,
      ].filter(Boolean),
      consequence: check ? g('contract.consequenceCheck') : g('contract.consequence'),
      steps: check
        ? [{ text: g('contract.stepAsk', { first }), hint: g('contract.stepAskHint') }, { text: g('contract.stepChoose') }]
        : [{ text: g('callCandidateStep', { first }), hint: nudge ? g('contract.callHintNudge') : g('contract.callHint') }, { text: g('contract.stepStatus') }],
      ...goalOf(check ? 'contract.goalCheck' : 'contract.goal'),
      primary: { label: check ? g('contract.primaryCheck') : g('contract.primary'), kind: 'contract' },
      reachedOptions: [],
    };
  }
  if (cat === 'offer_counter_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: g('counter.pill'),
      advice: g('counter.advice', { count: d, first }),
      facts: [
        g('counter.fact1', { job, date: dayMonthBare(item.createdAt) }),
        item.description ? satz(item.description) : '',
        feeFact,
      ].filter(Boolean),
      consequence: g('counter.consequence'),
      steps: [
        { text: g('counter.step1'), hint: g('counter.step1Hint') },
        { text: g('keepPosted', { first }) },
      ],
      ...goalOf('clientDecisionGoal'),
      primary: { label: g('remindClient'), kind: 'client' },
      reachedOptions: [],
    };
  }
  if (cat === 'opt_in_pending' || cat === 'opt_in_pending_24h' || cat === 'opt_in_pending_48h') {
    const h = hoursSince(item.createdAt);
    const days = Math.floor(h / 24);
    return {
      pill: g('optIn.pill'),
      advice: h < 24
        ? g('optIn.adviceFresh', { first, hours: h })
        : h < 48 ? g('optIn.adviceHours', { hours: h }) : g('optIn.adviceDays', { count: days }),
      facts: [
        g('optIn.fact1', { job }),
        h < 48 ? g('optIn.fact2Hours', { name, hours: h }) : g('optIn.fact2Days', { name, count: days }),
        feeFact,
      ].filter(Boolean),
      consequence: g('optIn.consequence'),
      steps: [
        { text: g('callCandidateStep', { first }), hint: g('optIn.step1Hint') },
        { text: g('optIn.step2') },
        { text: g('optIn.step3') },
      ],
      ...goalOf('optIn.goal'),
      primary: { label: g('call'), kind: 'call' },
      reachedOptions: [opt('optIn.reached.chosen'), opt('optIn.reached.today'), opt('optIn.reached.declines')],
    };
  }
  if (cat === 'rejected_inform') {
    return {
      pill: g('rejected.pill'),
      advice: g('rejected.advice', { first }),
      facts: [
        g('rejected.fact1', { name, job, date: dateShort(item.createdAt) }),
        // Der Grund ist so gezeigt, wie der Kunde ihn gespeichert hat
        item.reason ? i18n.t('taskTexts:rejected.reasonFact', { reason: item.reason }) : g('rejected.noReason'),
        g('rejected.fact3'),
      ],
      consequence: g('rejected.consequence'),
      steps: [
        { text: g('informCandidateStep', { first }), hint: g('rejected.step1Hint') },
        { text: g('offerOtherJobs') },
      ],
      ...goalOf('informedGoal', { first }),
      goalLog: trDe('guide.informedGoal', { first: firstDe }),
      primary: { label: g('informCandidate', { first }), kind: 'candidate' },
      reachedOptions: [opt('reached.informed'), opt('reached.otherJobs'), opt('reached.noInterest')],
    };
  }
  // Erster Arbeitstag und Halbzeit der Garantie (H7): Fenster mit den Antworten
  const startKind = startKindOf(item);
  if (startKind) {
    const k = startKind === 'start' ? 'start' : 'half';
    return {
      pill: g(`startTask.${k}.pill`),
      advice: item.title,
      facts: [item.description ?? ''].filter(Boolean),
      consequence: null,
      steps: [{ text: g(`startTask.${k}.step`, { first }) }],
      ...goalOf(`startTask.${k}.goal`),
      primary: { label: g(`startTask.${k}.primary`), kind: 'start' },
      reachedOptions: [],
    };
  }
  if (item.itemType === 'task') {
    // Eigene Erinnerung (29.10.2026): oben steht, was zu tun ist, die Notiz im Grund
    const due = item.dueAt ? new Date(item.dueAt) : null;
    const dueText = due
      ? due.toDateString() === new Date().toDateString() ? g('own.dueToday', { time: format(due, 'HH:mm') }) : g('own.dueOn', { date: dateShort(item.dueAt), time: format(due, 'HH:mm') })
      : g('own.noDate');
    return {
      pill: g('own.pill'),
      advice: item.title,
      facts: [
        item.description ? g('own.note', { note: item.description }) : '',
        dueText,
        item.jobTitle ? `${item.jobTitle}${item.companyName ? ` · ${item.companyName}` : ''}.` : '',
      ].filter(Boolean),
      consequence: null,
      steps: [{ text: item.title }],
      ...goalOf('done'),
      primary: { label: g('done'), kind: 'done' },
      reachedOptions: [],
    };
  }
  // Historische Engine-Alerts
  return {
    pill: g('legacy.pill'),
    advice: item.description || item.title,
    facts: [item.recommendedAction || item.title],
    consequence: null,
    steps: [{ text: item.recommendedAction || g('legacy.step') }],
    ...goalOf('legacy.goal'),
    primary: { label: item.candidatePhone ? g('call') : g('open'), kind: item.candidatePhone ? 'call' : 'akte' },
    reachedOptions: [opt('legacy.goal')],
  };
}

export interface PersonGroup {
  key: string;
  name: string;
  initials: string;
  primary: UnifiedTaskItem;
  others: UnifiedTaskItem[];
}

export function groupByPerson(items: UnifiedTaskItem[]): PersonGroup[] {
  const map = new Map<string, UnifiedTaskItem[]>();
  for (const it of items) {
    // Vor der Einreichung: eigenes Fenster, nie zusammen mit anderen Aufgaben des Kandidaten
    const key = it.prep ? it.itemId : it.candidateId || it.itemId;
    map.set(key, [...(map.get(key) ?? []), it]);
  }
  const groups: PersonGroup[] = [];
  for (const [key, list] of map) {
    const sorted = [...list].sort((a, b) => a.sortPriority - b.sortPriority || (b.feeValue ?? 0) - (a.feeValue ?? 0));
    const name = sorted[0].candidateName || sorted[0].title;
    const initials = name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
    groups.push({ key, name, initials, primary: sorted[0], others: sorted.slice(1) });
  }
  return groups.sort((a, b) => a.primary.sortPriority - b.primary.sortPriority || (b.primary.feeValue ?? 0) - (a.primary.feeValue ?? 0));
}


type MarkDone = (itemType: UnifiedTaskItem['itemType'], itemId: string) => Promise<{ error: unknown }>;
type Snooze = (itemType: UnifiedTaskItem['itemType'], itemId: string, until: Date) => Promise<{ error: unknown }>;

/**
 * Zustand und Handgriffe rund um das Aufgaben-Fenster. `host` gehört einmal in die
 * Seite (Fenster, „Erreicht?“-Dialog, Details).
 */
export function useTaskHost({ allItems, groups, markDone, snooze, refetch }: {
  allItems: UnifiedTaskItem[];
  groups: PersonGroup[];
  markDone: MarkDone;
  snooze: Snooze;
  refetch: () => void;
}) {
  // Lädt die Texte der Aufgaben, bevor die Seite die Zeilen zeichnet (buildGuide liest sie direkt)
  const { t } = useTranslation(NS);
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [windowKey, setWindowKey] = useState<string | null>(null);
  const [windowTab, setWindowTab] = useState<'client' | 'candidate'>('client');
  const [reached, setReached] = useState<{ item: UnifiedTaskItem; guide: Guide } | null>(null);
  const [detail, setDetail] = useState<TaskDetailItem | null>(null);
  // Nachgespräch: eigenes Fenster, festgehalten, damit Schritt 3 nach dem Neuladen bleibt
  const [nach, setNach] = useState<{ target: NachTarget; item?: UnifiedTaskItem } | null>(null);
  /** Aus Empfehlung und Kundenfrage ins Nachgespräch; es führt danach dorthin zurück. */
  const openNachFor = (c: RecruiterOfferContext) => { const target = nachTargetFromContext(c); if (target) setNach({ target }); };
  // Angebot überbringen bzw. Empfehlung schreiben: eigene Fenster je Einreichung
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [recFor, setRecFor] = useState<string | null>(null);
  const [frageFor, setFrageFor] = useState<string | null>(null);
  const [contractFor, setContractFor] = useState<string | null>(null);
  const [prepItem, setPrepItem] = useState<UnifiedTaskItem | null>(null);
  const [startTask, setStartTask] = useState<StartAufgabe | null>(null);
  const openStart = (it: UnifiedTaskItem) => {
    const kind = startKindOf(it);
    if (!kind) return false;
    setStartTask({ kind, taskId: it.itemId, phone: it.candidatePhone });
    return true;
  };
  /** Aufgaben mit eigenem Fenster direkt öffnen; true = erledigt. */
  const openOwnWindow = (it: UnifiedTaskItem) => {
    if (it.prep) { setPrepItem(it); return true; }
    if (openStart(it)) return true;
    if (it.taskCategory === 'interview_debrief_due') { setNach({ target: nachTargetFromItem(it), item: it }); return true; }
    if (it.taskCategory === 'offer_deliver' && it.submissionId) { setOfferFor(it.submissionId); return true; }
    if (it.taskCategory === 'recommendation_due' && it.submissionId) { setRecFor(it.submissionId); return true; }
    if (it.taskCategory === 'client_unsure' && it.submissionId) { setFrageFor(it.submissionId); return true; }
    if (it.taskCategory.startsWith('contract_') && it.submissionId) { setContractFor(it.submissionId); return true; }
    return false;
  };

  /** Personen-Fenster öffnen; steht ein Nachgespräch vorn, gleich dessen Fenster. */
  const openGroupKey = (key: string | null) => {
    const g = key ? groups.find(x => x.key === key) : null;
    if (g && openOwnWindow(g.primary)) return;
    setWindowKey(key);
  };

  const act = (item: UnifiedTaskItem, guide: Guide) => {
    switch (guide.primary.kind) {
      case 'client':
      case 'candidate': {
        const g = groups.find(x => x.primary.itemId === item.itemId || x.others.some(o => o.itemId === item.itemId));
        if (g) { setWindowTab(guide.primary.kind); setWindowKey(g.key); }
        return;
      }
      case 'debrief':
        setNach({ target: nachTargetFromItem(item), item });
        return;
      case 'offer':
        if (item.submissionId) setOfferFor(item.submissionId);
        return;
      case 'recommend':
        if (item.submissionId) setRecFor(item.submissionId);
        return;
      case 'frage':
        if (item.submissionId) setFrageFor(item.submissionId);
        return;
      case 'contract':
        if (item.submissionId) setContractFor(item.submissionId);
        return;
      case 'prep':
        setPrepItem(item);
        return;
      case 'start':
        openStart(item);
        return;
      case 'call':
        if (item.candidatePhone) window.location.href = `tel:${item.candidatePhone}`;
        setReached({ item, guide });
        return;
      case 'followup':
        setReached({ item, guide });
        return;
      case 'called':
        // „Angerufen“ im Schritt an den Kandidaten: nur festhalten, nicht wählen (29.10.2026)
        setReached({ item, guide: { ...guide, primary: { label: t('guide.call'), kind: 'call' } } });
        return;
      case 'done':
        markDone(item.itemType, item.itemId).then(({ error }) => {
          if (error) toast.error(t('toast.markDoneFailed'));
          else toast.success(t('toast.done'));
        });
        return;
      case 'akte':
        if (item.candidateId) navigate(`/recruiter/candidates/${item.candidateId}`);
        return;
    }
  };

  const sendMessage = async (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action, submissionId: item.submissionId, text, lang: action === 'client_nudge' ? clientLangOfLocation(item.jobLocation) : candidateLanguage(), ...meta },
    });
    let failure = error?.message || (data && (data as any).error) || (data && (data as any).message && !(data as any).ok ? (data as any).message : null);
    // Bei einem Fehler steht der Grund im Antworttext der Function, nicht in error.message (28.10.2026)
    if (error) {
      try {
        const body = await (error as any).context?.json?.();
        if (body?.message || body?.error) failure = body.message ?? body.error;
      } catch { /* kein JSON */ }
    }
    if (failure) {
      const msg = typeof failure === 'string' ? failure : t('toast.sendFailed');
      toast.error(/Failed to send a request/i.test(msg) ? t('toast.notDeployed') : msg);
      return false;
    }
    const anlass = meta.anlass;
    if (action === 'client_nudge') {
      // Gegenwunsch: wartet auf dem Server (Aktivitätslog); Opt-In und Absage: nur ein Stand an den Kunden,
      // die Aufgabe beim Kandidaten bleibt (29.10.2026)
      if (anlass === 'counter') toast.success(t('toast.clientRemindedWaiting'));
      else if (anlass === 'opt_in' || anlass === 'rejected') toast.success(t('toast.clientInformed'));
      else {
        toast.success(t('toast.clientReminded', { count: (data as any)?.recipients ?? 1 }));
        await snooze(item.itemType, item.itemId, new Date(Date.now() + 3 * DAY_MS));
      }
    } else {
      toast.success(t('toast.messageSent'));
      if (item.taskCategory === 'rejected_inform' || item.taskCategory === 'job_closed_inform') await markDone(item.itemType, item.itemId);
      else if (item.taskCategory !== 'offer_counter_stalled') await snooze(item.itemType, item.itemId, new Date(Date.now() + DAY_MS));
    }
    refetch();
    notifyTasksChanged();
    return true;
  };

  const later = async (item: UnifiedTaskItem, until: Date) => {
    const { error } = await snooze(item.itemType, item.itemId, until);
    if (error) toast.error(t('toast.snoozeFailed'));
    else toast.success(t('toast.snoozedUntil', { when: format(until, 'EEEE HH:mm', { locale: dfLocale() }) }));
  };

  const confirmReached = async (yes: boolean, outcome: string | null, note: string) => {
    if (!reached) return;
    const { item, guide } = reached;
    setReached(null);
    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'call',
        // Titel im Aktivitätslog: gespeichert, bleibt deutsch
        yes ? `Erreicht: ${outcome ?? guide.goalLog}` : 'Nicht erreicht',
        note || undefined,
        { reached: yes, outcome, task_category: item.taskCategory },
        item.submissionId || undefined,
      );
    }
    // Gegenwunsch: Der Anruf beim Kandidaten erledigt nichts, der Kunde ist noch dran
    if (yes && item.taskCategory === 'offer_counter_stalled') {
      toast.success(t('toast.callLogged'));
    } else if (yes) {
      const { error } = await markDone(item.itemType, item.itemId);
      const label = guide.reachedOptions.find(o => o.value === outcome)?.label ?? outcome;
      if (error) toast.error(t('toast.savedNotClosed'));
      else toast.success(label ? t('toast.closedWith', { outcome: label }) : t('toast.closed'));
    } else {
      await snooze(item.itemType, item.itemId, new Date(Date.now() + 2 * 3_600_000));
      toast.success(t('toast.again2h'));
    }
  };

  const openDetail = (item: UnifiedTaskItem) => {
    setDetail({
      itemType: item.itemType, itemId: item.itemId, title: item.title, description: item.description,
      recommendedAction: item.recommendedAction, taskCategory: item.taskCategory, priority: item.priority,
      submissionId: item.submissionId, candidateId: item.candidateId, jobId: item.jobId, playbookId: item.playbookId,
      createdAt: item.createdAt, dueAt: item.dueAt, impactScore: item.impactScore, candidateName: item.candidateName,
      candidatePhone: item.candidatePhone, candidateEmail: item.candidateEmail, jobTitle: item.jobTitle, companyName: item.companyName,
    });
  };

  /** Öffnet das Fenster der Person, zu der die Aufgabe gehört. */
  const openItem = (itemId: string) => {
    const it = /^(derived-(debrief|offer|recommend|contract)|prep)-/.test(itemId) ? allItems.find(i => i.itemId === itemId)
      : allItems.find(i => i.itemId === itemId && !!startKindOf(i)) ?? null;
    if (it && openOwnWindow(it)) return true;
    const g = groups.find(x => x.primary.itemId === itemId || x.others.some(o => o.itemId === itemId));
    if (g) openGroupKey(g.key);
    return !!g;
  };

  // Fenster bleibt nach dem Senden offen, auch wenn die Aufgabe danach aus der Liste fällt (29.10.2026)
  const liveGroup = groups.find(g => g.key === windowKey) ?? null;
  const frozen = useRef<PersonGroup | null>(null);
  if (!windowKey) frozen.current = null;
  else if (liveGroup && (!frozen.current || frozen.current.primary.itemId === liveGroup.primary.itemId)) frozen.current = liveGroup;
  const windowGroup = windowKey ? frozen.current ?? liveGroup : null;
  const contractItem = contractFor ? allItems.find(i => i.submissionId === contractFor && i.taskCategory.startsWith('contract_')) : undefined;

  const host = (
    <>
      <TaskDetailDialog
        open={!!detail}
        onOpenChange={o => { if (!o) setDetail(null); }}
        item={detail}
        onMarkDone={async id => { const it = allItems.find(i => i.itemId === id); if (it) { const { error } = await markDone(it.itemType, it.itemId); if (error) toast.error(t('toast.markDoneFailed')); } }}
        onSnooze={async (id, until) => { const it = allItems.find(i => i.itemId === id); if (it) await later(it, until); }}
      />
      <TaskWindow
        group={windowGroup}
        initialTab={windowTab}
        onSend={sendMessage}
        onClose={() => setWindowKey(null)}
        onAct={(item, guide) => { setWindowKey(null); act(item, guide); }}
        onLater={(item, until) => { setWindowKey(null); later(item, until); }}
        onSnooze={async (item, until) => { await snooze(item.itemType, item.itemId, until); }}
        onDetail={item => { setWindowKey(null); openDetail(item); }}
        onChanged={() => { refetch(); notifyTasksChanged(); }}
      />
      <ReachedDialog state={reached} onClose={() => setReached(null)} onConfirm={confirmReached} />
      <NachgespraechWindow
        target={nach?.target ?? null}
        onClose={() => setNach(null)}
        onDone={refetch}
        laterSlot={nach?.item ? <LaterMenu onPick={until => { const it = nach.item!; setNach(null); later(it, until); }} /> : null}
        onEmpfehlung={setRecFor}
        onFrage={setFrageFor}
      />
      <OfferAnswerDialog submissionId={offerFor} onClose={() => setOfferFor(null)} onDone={refetch} />
      <RecommendationDialog submissionId={recFor} onClose={() => setRecFor(null)} onDone={refetch} onNachgespraech={openNachFor} />
      <KundenFrageWindow submissionId={frageFor} onClose={() => setFrageFor(null)} onDone={refetch} onNachgespraech={openNachFor} />
      <ContractWindow
        submissionId={contractFor}
        onClose={() => setContractFor(null)}
        onDone={refetch}
        onLater={contractItem ? until => { setContractFor(null); later(contractItem, until); } : undefined}
      />
      <VorbereitenFenster item={prepItem} onClose={() => setPrepItem(null)} onChanged={() => { refetch(); notifyTasksChanged(); }} />
      <StartAufgabeFenster task={startTask} onClose={() => setStartTask(null)} onDone={() => { refetch(); notifyTasksChanged(); }} />
    </>
  );

  /** Vertrags-Fenster direkt (Vertrag unter „Wartet auf andere“, 28.10.2026). */
  const openContract = (submissionId: string) => setContractFor(submissionId);
  return { act, later, openDetail, openItem, openContract, openPrep: setPrepItem, setWindowKey: openGroupKey, host };
}

type Side = 'call' | 'done' | 'client' | 'candidate';

/** Ergebnis des Anrufs bei Opt-In (29.10.2026). */
type OptInOutcome = 'waehlt' | 'zeit' | 'will_nicht' | 'nicht_erreicht' | 'erreicht';
// Anzeige über outcomes.<key>; ins Aktivitätslog geht der deutsche Text (trDe)
const OPT_IN_OUTCOMES: OptInOutcome[] = ['waehlt', 'zeit', 'will_nicht', 'nicht_erreicht'];
/** Anruf aus einer eigenen Erinnerung oder einem alten Hinweis */
const CALL_OUTCOMES: OptInOutcome[] = ['erreicht', 'nicht_erreicht'];

/**
 * Schritte im Aufgaben-Fenster (29.10.2026, statt zweier Reiter): erst die Pflicht, dann das
 * Optionale. Nach dem Senden bleibt das Fenster offen, der nächste Schritt ist dran.
 */
export function stepPlan(cat: string, first: string, opts: { itemType?: string; title?: string; phone?: boolean; hasCandidate?: boolean } = {}): { side: Side; label: string; optional?: boolean }[] {
  // Eigene Erinnerung (29.10.2026): die Aufgabe selbst, eine Mail an den Kandidaten nur auf Wunsch, nie an den Kunden
  if (opts.itemType === 'task') {
    const mail = opts.hasCandidate ? [{ side: 'candidate' as const, label: tr('plan.mailCandidate', { first }), optional: true }] : [];
    return [{ side: cat === 'call' ? 'call' : 'done', label: opts.title || tr('plan.reminder') }, ...mail];
  }
  if (cat === 'client_undecided') return [{ side: 'client', label: tr('plan.notifyClient') }, { side: 'candidate', label: tr('plan.tellCandidate', { first }), optional: true }];
  if (cat === 'offer_counter_stalled') return [{ side: 'client', label: tr('plan.askDecision') }, { side: 'candidate', label: tr('plan.tellCandidateQ', { first }), optional: true }];
  if (cat === 'rejected_inform') return [{ side: 'candidate', label: tr('plan.inform', { first }) }, { side: 'client', label: tr('plan.askReason'), optional: true }];
  if (cat === 'job_closed_inform') return [{ side: 'candidate', label: tr('plan.inform', { first }) }];
  if (cat.startsWith('opt_in_pending')) return [{ side: 'call', label: tr('plan.call', { first }) }, { side: 'client', label: tr('plan.tellClientQ'), optional: true }, { side: 'candidate', label: tr('plan.remindByMail', { first }), optional: true }];
  // Alte Hinweise: anrufen oder schreiben, keine allgemeine Erinnerung an den Kunden
  return opts.phone
    ? [{ side: 'call', label: tr('plan.call', { first }) }, { side: 'candidate', label: tr('plan.mailCandidate', { first }), optional: true }]
    : [{ side: 'candidate', label: tr('plan.to', { first }) }];
}

/** Anlass der Nachricht an den Kunden: Betreff und Schluss der Mail (recruiter-notify). */
export const anlassOf = (cat: string) =>
  cat === 'client_undecided' ? 'decision' : cat === 'offer_counter_stalled' ? 'counter' : cat.startsWith('opt_in_pending') ? 'opt_in' : cat === 'rejected_inform' ? 'rejected' : undefined;

function afterText(cat: string, first: string): string | null {
  if (cat === 'offer_counter_stalled') return tr('after.counter');
  if (cat === 'rejected_inform' || cat === 'job_closed_inform') return tr('after.informed', { first });
  if (cat.startsWith('opt_in_pending')) return tr('after.optIn', { first });
  return null;
}

/** Die Aufgabe als Fenster: Grund, Deine Aufgabe in Schritten, Ziel, Knöpfe. Die Liste bleibt kompakt. */
export function TaskWindow({ group, initialTab, onSend, onClose, onAct, onLater, onSnooze, onDetail, onChanged }: {
  group: PersonGroup | null;
  initialTab: 'client' | 'candidate';
  onSend: (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
  onAct: (item: UnifiedTaskItem, guide: Guide) => void;
  onLater: (item: UnifiedTaskItem, until: Date) => void;
  /** Vertagen, ohne das Fenster zu schließen (nach dem Anruf bei Opt-In). */
  onSnooze: (item: UnifiedTaskItem, until: Date) => Promise<void>;
  onDetail: (item: UnifiedTaskItem) => void;
  onChanged: () => void;
}) {
  const { t, i18n: lang } = useTranslation(NS);
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [outcome, setOutcome] = useState<OptInOutcome | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [allowAlt, setAllowAlt] = useState(false);
  const item = group?.primary ?? null;
  const [active, setActive] = useState<Side | null>(null);
  const [sent, setSent] = useState<Partial<Record<Side, Date>>>({});
  const [intent, setIntent] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [candKeys, setCandKeys] = useState<string[]>([]);
  const [clientEdit, setClientEdit] = useState<string | null>(null);
  const [candEdit, setCandEdit] = useState<string | null>(null);
  const { user } = useAuth();
  const myName = (user?.user_metadata as any)?.full_name ?? null;
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ title: string; created_at: string; activity_type: string; metadata?: { sent?: boolean } | null }[]>([]);
  const set = useMemo(() => item ? messageSetFor(item.taskCategory, { jobTitle: item.jobTitle, firstName: firstName(item.candidateName), clientLang: clientLangOfLocation(item.jobLocation) }) : null, [item?.itemId, item?.taskCategory, item?.jobTitle, item?.candidateName, item?.jobLocation, lang.language]);
  const canClient = !!item?.submissionId && !!set && set.clientIntents.length > 0;
  const canCandidate = !!item?.submissionId && !!item?.candidateEmail && !!set && set.candidate.length > 0;
  const plan = item ? stepPlan(item.taskCategory, firstName(item.candidateName), { itemType: item.itemType, title: item.title, phone: !!item.candidatePhone, hasCandidate: !!item.candidateId }) : [];
  const [callNote, setCallNote] = useState('');
  const optIn = !!item && item.taskCategory.startsWith('opt_in_pending');
  useEffect(() => {
    const can = (s: Side) => (s === 'call' || s === 'done' ? true : s === 'client' ? canClient : canCandidate);
    const wanted = plan.find(p => p.side === initialTab && can(p.side) && !p.optional)?.side;
    setActive(wanted ?? plan.find(p => can(p.side))?.side ?? null);
    setSent({});
    setClientEdit(null);
    setCandEdit(null);
    setOutcome(null);
    setDeclineReason('');
    // Opt-In: die Bitte an den Kunden ergibt sich erst aus dem Anruf
    setIntent(optIn ? null : set?.clientIntents[0]?.key ?? null);
    setHints([]);
    setCandKeys(set?.candidate[0] ? [set.candidate[0].key] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.itemId, initialTab]);
  const sentCount = Object.keys(sent).length;
  // Opt-In: Darf der Kandidat in der Einladung selbst eine andere Zeit vorschlagen?
  useEffect(() => {
    setAllowAlt(false);
    if (!optIn || !item?.submissionId) return;
    supabase.from('interviews').select('allow_alternative').eq('submission_id', item.submissionId)
      .in('status', ['pending_response', 'counter_proposed']).order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setAllowAlt(!!(data as any)?.[0]?.allow_alternative));
  }, [optIn, item?.submissionId]);
  useEffect(() => {
    if (!item?.submissionId) { setHistory([]); return; }
    supabase
      .from('candidate_activity_log')
      .select('title, created_at, activity_type, metadata')
      .eq('related_submission_id', item.submissionId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setHistory((data ?? []) as any));
  }, [item?.submissionId, sentCount]);
  if (!group || !item || !set) return null;
  const guide = buildGuide(item);
  const fee = euro(item.feeValue);
  const first = firstName(item.candidateName);
  // Text vor dem Senden änderbar (29.10.2026): ein Klick auf einen Baustein setzt ihn neu zusammen
  const clientText = clientEdit ?? composeClientText(set, intent, hints);
  const candidateText = candEdit ?? composeCandidateText(set, candKeys);
  const meFirst = firstName(myName);
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  const can = (s: Side) => (s === 'call' || s === 'done' ? true : s === 'client' ? canClient : canCandidate);
  const outcomes = optIn ? OPT_IN_OUTCOMES : CALL_OUTCOMES;
  // Opt-In „Keine Zeit passt“ ohne eigene Zeitwahl des Kandidaten: der Kunde muss neue Zeiten nennen
  const optionalOf = (p: { side: Side; optional?: boolean }) => (optIn && p.side === 'client' && outcome === 'zeit' && !allowAlt ? false : !!p.optional);
  const stepLabel = (p: { side: Side; label: string }) => (optIn && p.side === 'client' && outcome === 'zeit' ? t('plan.askMoreTimes') : p.label);
  const after = afterText(item.taskCategory, first);
  const outcomeLabel = outcome ? t(`outcomes.${outcome}`) : '';
  // Für den Kandidaten abgesagt: keine weiteren Schritte mehr
  const declined = optIn && outcome === 'will_nicht' && !!sent.call;
  const markDone = (side: Side, nextActive?: Side | null) => {
    const next = { ...sent, [side]: new Date() };
    setSent(next);
    setActive(nextActive !== undefined ? nextActive : plan.find(p => !next[p.side] && can(p.side))?.side ?? null);
  };
  const logCall = (reached: boolean, label: string, note?: string) => item.candidateId
    // Titel und outcome im Aktivitätslog: gespeichert, bleiben deutsch
    ? logActivity(item.candidateId, 'call', reached ? `Erreicht: ${label}` : 'Nicht erreicht', note, { reached, outcome: label, task_category: item.taskCategory }, item.submissionId || undefined)
    : Promise.resolve(null);
  const pickOutcome = async (o: OptInOutcome) => {
    setOutcome(o);
    setClientEdit(null);
    setCandEdit(null);
    if (o === 'will_nicht') return;
    const label = trDe(`outcomes.${o}`);
    await logCall(o !== 'nicht_erreicht', label, callNote.trim() || undefined);
    // Eigene Erinnerung oder alter Hinweis: erreicht = erledigt, sonst in 2 Std. wieder
    if (!optIn) {
      if (o === 'erreicht') { onAct(item, { ...guide, primary: { label: t('guide.done'), kind: 'done' } }); return; }
      await onSnooze(item, new Date(Date.now() + 2 * 3_600_000));
      markDone('call', canCandidate ? 'candidate' : null);
      toast.success(t('toast.loggedAgain2h'));
      onChanged();
      return;
    }
    const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
    if (o === 'waehlt') { setIntent('reached'); await onSnooze(item, tomorrow); markDone('call', 'client'); }
    if (o === 'zeit') { setIntent('newslots'); setCandKeys([allowAlt ? 'alt' : 'notfit']); await onSnooze(item, tomorrow); markDone('call', allowAlt ? 'candidate' : 'client'); }
    if (o === 'nicht_erreicht') { setCandKeys(['remind']); await onSnooze(item, new Date(Date.now() + 2 * 3_600_000)); markDone('call', 'candidate'); }
    toast.success(o === 'nicht_erreicht' ? t('toast.loggedAgain2h') : t('toast.callLogged'));
    onChanged();
  };
  const declineForCandidate = async () => {
    if (!item.submissionId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('interview-request', { body: { action: 'decline_for_candidate', submissionId: item.submissionId, reason: declineReason.trim() } });
    const failure = await functionError(error, data, 'interview-request');
    setSending(false);
    if (failure) { toast.error(failure); return; }
    await logCall(true, trDe('outcomes.will_nicht'), declineReason.trim() || undefined);
    toast.success(t('toast.invitationDeclined', { first }));
    markDone('call', null);
    onChanged();
  };
  const time = (d: Date) => clockTime(d);
  const send = async (side: Side) => {
    setSending(true);
    const ok = side === 'client'
      ? await onSend(item, 'client_nudge', clientText.trim(), { intent, hints, anlass: anlassOf(item.taskCategory) })
      : await onSend(item, 'candidate_message', candidateText.trim(), { kind: candKeys.join(','), subject: set.candidateSubject });
    setSending(false);
    if (!ok) return;
    const next = { ...sent, [side]: new Date() };
    setSent(next);
    setActive(plan.find(p => !next[p.side] && can(p.side))?.side ?? null);
  };
  const called = () => onAct(item, { ...guide, primary: { label: t('window.called'), kind: 'called' } });

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl">
        <DialogHeader className="space-y-2 border-b p-5 pb-4 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{group.initials}</div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex flex-wrap items-center gap-x-2 text-base">
                <span>{group.name}</span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">{guide.pill}</Badge>
                {fee && <span className="text-sm font-medium text-emerald-500 tabular-nums"><Honorar>{fee}</Honorar></span>}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-1 text-xs">
                {item.jobTitle}{item.companyName ? ` · ${item.companyName}` : ''}
                {!item.companyName && <Lock className="h-3 w-3" />}
              </DialogDescription>
            </div>
          </div>
          <p className="text-sm">{guide.advice}</p>
        </DialogHeader>

        <div className="grid gap-3 p-5 md:grid-cols-[1fr_1.25fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.reason')}</p>
              <ul className="space-y-1.5 text-sm">
                {guide.facts.map((f, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{fee && f === t('guide.feeFact', { fee }) ? <Trans ns={NS} i18nKey="guide.feeFactMarked" values={{ fee }} components={{ h: <Honorar>{fee}</Honorar> }} /> : f}</span></li>)}
                {guide.consequence && <li className="flex gap-2 text-muted-foreground"><span>→</span><span>{guide.consequence}</span></li>}
              </ul>
              {group.others.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t('window.also', { list: group.others.map(o => `${o.jobTitle} · ${buildGuide(o).advice}`).join(' · ') })}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.history')}</p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('window.noContact')}</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateShort(h.created_at)}</span><span>{h.metadata?.sent === false ? t('window.notSent', { title: h.title }) : h.title}</span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.yourTask')}</p>
            {(declined ? plan.filter(x => x.side === 'call') : plan).map((p, idx) => {
              const done = sent[p.side];
              const open = active === p.side && !done;
              return (
                <div key={p.side} className="flex gap-2.5">
                  <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium', done ? 'bg-emerald-500 text-white' : open ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground')}>
                    {done ? <Check className="h-3 w-3" /> : idx + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={cn('text-sm', open || done ? 'font-medium' : 'text-muted-foreground')}>
                        {done ? (p.side === 'call' ? t(outcome === 'will_nicht' ? 'stepDone.calledDeclined' : 'stepDone.called', { first, outcome: outcomeLabel }) : p.side === 'client' ? t('stepDone.sentClient', { time: time(done) }) : t('stepDone.sentCandidate', { first, time: time(done) })) : stepLabel(p)}
                        {!done && optionalOf(p) && <span className="font-normal text-muted-foreground"> {t('window.optional')}</span>}
                      </p>
                      {!done && !open && can(p.side) && (
                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setActive(p.side)}>{optionalOf(p) ? t('window.yesWrite') : t('window.now')}</button>
                      )}
                    </div>
                    {open && p.side === 'call' && (
                      <>
                        {item.candidatePhone ? (
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild><a href={`tel:${item.candidatePhone}`}><Phone className="h-3 w-3" />{item.candidatePhone}</a></Button>
                        ) : <p className="text-xs text-muted-foreground">{t('window.noPhone')}</p>}
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.whatCameOut')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {outcomes.map(o => (
                            <Button key={o} size="sm" variant={outcome === o ? 'default' : 'outline'} className="h-7 text-xs" disabled={sending} onClick={() => pickOutcome(o)}>{t(`outcomes.${o}`)}</Button>
                          ))}
                        </div>
                        {!optIn && (
                          <Textarea value={callNote} onChange={e => setCallNote(e.target.value)} placeholder={t('window.notePlaceholder')} rows={2} className="text-sm" />
                        )}
                        {outcome === 'will_nicht' && (
                          <div className="space-y-1.5">
                            <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder={t('window.declineReasonPlaceholder', { first })} rows={2} className="text-sm" />
                            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={sending} onClick={declineForCandidate}>{t('window.declineFor', { first })}</Button>
                            <p className="text-xs text-muted-foreground">{t('window.declineInfo', { first })}</p>
                          </div>
                        )}
                        {outcome === 'zeit' && allowAlt && (
                          <p className="text-xs text-muted-foreground">{t('window.altInfo', { first })}</p>
                        )}
                      </>
                    )}
                    {open && p.side === 'done' && (
                      <p className="text-xs text-muted-foreground">{t('window.doneHint')}</p>
                    )}
                    {!can(p.side) && !done && (
                      <p className="text-xs text-muted-foreground">{p.side === 'candidate' ? t('window.noEmail', { first }) : t('window.notPossible')}</p>
                    )}
                    {open && p.side === 'client' && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {set.clientIntents.map(c => (
                            <Button key={c.key} size="sm" variant={intent === c.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setIntent(c.key); setClientEdit(null); }}>{c.label}</Button>
                          ))}
                        </div>
                        {set.clientHints.length > 0 && (
                          <>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{t('window.addHint')}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {set.clientHints.map(c => (
                                <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setHints(h => toggle(h, c.key)); setClientEdit(null); }}>{c.label}</Button>
                              ))}
                            </div>
                          </>
                        )}
                        <Textarea value={clientText} onChange={e => setClientEdit(e.target.value)} placeholder={t('window.clientPlaceholder')} rows={4} className="text-sm" />
                        <p className="text-[11px] text-muted-foreground">{t('window.clientMailInfo')}</p>
                        <p className="text-xs text-muted-foreground">{t('window.clientChannelInfo')}</p>
                        <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !clientText} onClick={() => send('client')}>
                          <Mail className="h-3 w-3" />{item.taskCategory === 'offer_counter_stalled' ? t('guide.remindClient') : t('window.sendToClient')}
                        </Button>
                      </>
                    )}
                    {open && p.side === 'candidate' && (
                      <>
                        <div className="flex flex-wrap gap-1.5">
                          {set.candidate.filter(c => c.key !== 'alt' || allowAlt).map(c => (
                            <Button key={c.key} size="sm" variant={candKeys.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setCandKeys(k => toggle(k, c.key)); setCandEdit(null); }}>{c.label}</Button>
                          ))}
                        </div>
                        <div className="rounded-md border border-border/60 bg-background/60 p-2 text-sm">
                          {/* Anrede und Gruß gehören zur Mail an den Kandidaten und bleiben deutsch */}
                          <p className="mb-1">Hallo {first},</p>
                          <Textarea value={candidateText} onChange={e => setCandEdit(e.target.value)} placeholder={t('window.candidatePlaceholder')} rows={5} className="text-sm" />
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">{`Viele Grüße\n${meFirst}`}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{t('window.candidateMailInfo')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !candidateText} onClick={() => send('candidate')}>
                            <Mail className="h-3 w-3" />{t('window.sendTo', { first })}
                          </Button>
                          {!plan.some(x => x.side === 'call') && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={called}>
                              <Phone className="h-3 w-3" />{t('window.called')}
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {after && (
              <div className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] text-muted-foreground">{declined ? 2 : plan.length + 1}</span>
                <p className="text-xs leading-5 text-muted-foreground">{declined ? t('after.declined') : after}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground"><Trans ns={NS} i18nKey="window.goalToday" values={{ goal: guide.goal }} components={{ g: <span className="font-medium text-emerald-500" /> }} /></span>
          <div className="flex flex-wrap items-center gap-1.5">
            <LaterMenu onPick={until => onLater(item, until)} />
            {item.candidatePhone && guide.primary.kind !== 'call' && guide.primary.kind !== 'followup' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild><a href={`tel:${item.candidatePhone}`}><Phone className="mr-1 h-3 w-3" />{item.candidateName ? t('plan.call', { first: item.candidateName.split(' ')[0] }) : t('guide.call')}</a></Button>
            )}
            {item.submissionId && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${item.submissionId}`)}>{t('window.submission')}</Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onDetail(item)}>{t('window.details')}</Button>
            {(guide.primary.kind === 'call' || guide.primary.kind === 'followup') && !plan.some(p => p.side === 'call') && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                <Phone className="h-3 w-3" />{guide.primary.kind === 'call' ? t('guide.call') : t('window.followedUp')}
              </Button>
            )}
            {(guide.primary.kind === 'debrief' || guide.primary.kind === 'done' || guide.primary.kind === 'offer' || guide.primary.kind === 'recommend' || guide.primary.kind === 'contract') && (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
                {guide.primary.label}
              </Button>
            )}
            {sentCount > 0 && <Button size="sm" className="h-8 text-xs" onClick={onClose}>{t('window.finish')}</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LaterMenu({ onPick }: { onPick: (until: Date) => void }) {
  const { t } = useTranslation(NS);
  const [open, setOpen] = useState(false);
  const evening = new Date(); evening.setHours(18, 0, 0, 0);
  const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
  const threeDays = new Date(Date.now() + 3 * DAY_MS); threeDays.setHours(9, 0, 0, 0);
  return (
    <span className="relative">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(o => !o)}>{t('later.button')}</Button>
      {open && (
        <span className="absolute right-0 z-20 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
          {[[t('later.evening'), evening], [t('later.tomorrow'), tomorrow], [t('later.threeDays'), threeDays]].map(([label, d]) => (
            <button key={label as string} type="button" className="rounded px-2 py-1 text-left text-xs hover:bg-accent" onClick={() => { setOpen(false); onPick(d as Date); }}>
              {label as string}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

export function ReachedDialog({ state, onClose, onConfirm }: {
  state: { item: UnifiedTaskItem; guide: Guide } | null;
  onClose: () => void;
  onConfirm: (yes: boolean, outcome: string | null, note: string) => void;
}) {
  const { t } = useTranslation(NS);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { setOutcome(null); setNote(''); }, [state?.item.itemId]);
  if (!state) return null;
  const isFollowup = state.guide.primary.kind === 'followup';
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFollowup ? t('reachedDialog.titleFollowup') : t('reachedDialog.title')}</DialogTitle>
          <DialogDescription>{state.item.candidateName || state.item.title} · {state.item.jobTitle}</DialogDescription>
        </DialogHeader>
        {state.guide.reachedOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.guide.reachedOptions.map(o => (
              <Button key={o.value} size="sm" variant={outcome === o.value ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setOutcome(outcome === o.value ? null : o.value)}>{o.label}</Button>
            ))}
          </div>
        )}
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('window.notePlaceholder')} rows={2} className="text-sm" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onConfirm(false, null, note)}>{t('reachedDialog.notReached')}</Button>
          <Button size="sm" onClick={() => onConfirm(true, outcome, note)}>{isFollowup ? t('reachedDialog.yesFollowup') : t('reachedDialog.yes')}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t('reachedDialog.info')}</p>
      </DialogContent>
    </Dialog>
  );
}

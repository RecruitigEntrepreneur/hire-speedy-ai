// Vorgefertigte Sätze je Aufgabentyp: der Headhunter klickt, das System schickt.
// Kunde: Bitte + Hinweise. Kandidat: Was er wissen soll. Alles ohne Firmenname
// (vor Reveal) und ohne Kandidatenname an den Kunden (vor Opt-In) — die Texte
// nennen den Kandidaten nicht, der Server setzt das Bewerber-Kürzel in den Kopf.
//
// Mehrsprachig: `label` steht auf dem Knopf und kommt in der Sprache der Oberfläche
// (src/i18n/locales/recruiterTasks, chips.*). `text` geht an Dritte: an den Kunden in der
// Sprache des Kunden (`clientLang`, sonst Deutsch), an den Kandidaten in der Sprache des
// Headhunters (`candidateLang`, sonst `candidateLanguage()`), ebenso die Frist darin und der
// Betreff (src/i18n/locales/taskMessages). Der Headhunter kann jeden Entwurf noch ändern.
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { candidateLanguage, clientLanguage, tFor } from '@/lib/localeFormat';

const chip = (key: string, options?: Record<string, unknown>): string => i18n.t(`recruiterTasks:chips.${key}`, options);

export interface Chip {
  key: string;
  label: string;
  /** Satz, der in den Text übernommen wird */
  text: string;
}

export interface MessageSet {
  /** Bitte an den Kunden: genau eine */
  clientIntents: Chip[];
  /** Hinweise an den Kunden: beliebig viele */
  clientHints: Chip[];
  /** Sätze an den Kandidaten: beliebig viele */
  candidate: Chip[];
  candidateSubject: string;
}

/** Sprache der Empfänger: Kunde (Standard Deutsch) und Kandidat (Standard: Sprache des Headhunters). */
export interface Recipients {
  clientLang?: string | null;
  candidateLang?: string | null;
}

/**
 * Sprache des Kunden aus dem, was die Aufgabe kennt: das Land am Ende des Stellenorts
 * („Stockholm, Schweden“), sonst Deutsch. Eine eigene Profilsprache des Kunden liegt im
 * Aufgaben-Fenster nicht vor.
 */
export function clientLangOfLocation(location: string | null | undefined): string {
  const parts = (location ?? '').split(/[,·]/).map((p) => p.trim()).filter(Boolean);
  return clientLanguage({ country: parts[parts.length - 1] ?? null });
}

// Frist in n Werktagen, nie am Wochenende; als Wochentag oder, wenn weiter
// als sechs Tage weg, als Datum.
export const inDays = (n: number, locale = 'de-DE') => {
  const d = new Date();
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) left--;
  }
  const diff = (d.getTime() - Date.now()) / 86_400_000;
  return diff < 6 ? d.toLocaleDateString(locale, { weekday: 'long' }) : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
};
/** Dieselbe Frist für die Beschriftung der Knöpfe, in der Sprache der Oberfläche. */
const dayLabel = (n: number) => inDays(n, intlLocale(i18n.language));

const recipients = (r: Recipients = {}) => {
  const clientLang = r.clientLang || 'de';
  const candLang = r.candidateLang || candidateLanguage();
  const tc = tFor(clientLang, 'taskMessages');
  const tk = tFor(candLang, 'taskMessages');
  return {
    /** Satz an den Kunden */
    c: (key: string, options?: Record<string, unknown>) => tc(`client.${key}`, options) as string,
    /** Satz an den Kandidaten */
    k: (key: string, options?: Record<string, unknown>) => tk(`candidate.${key}`, options) as string,
    clientDay: (n: number) => inDays(n, intlLocale(clientLang)),
    candDay: (n: number) => inDays(n, intlLocale(candLang)),
  };
};

export function messageSetFor(category: string, ctx: { jobTitle: string | null; days?: number; hours?: number; firstName: string; reason?: string | null } & Recipients): MessageSet {
  const { c, k, clientDay, candDay } = recipients(ctx);
  const job = ctx.jobTitle || k('theJob');
  // Ton (29.10.2026): wie Julia selbst schreibt, freundlich, mit Bezug und Dank, ohne Behauptungen,
  // die sie nicht anklickt. An Kandidaten per du, an Kunden per Sie.
  const callMe: Chip = { key: 'call', label: chip('call'), text: k('callMe') };
  switch (category) {
    case 'client_review_stalled':
      return {
        clientIntents: [
          { key: 'decision', label: chip('decisionUntil', { day: dayLabel(2) }), text: c('decisionReview', { day: clientDay(2) }) },
          { key: 'question', label: chip('moreInfo'), text: c('moreInfo') },
          { key: 'remind', label: chip('remindOnly'), text: c('remindCandidate') },
        ],
        clientHints: [
          { key: 'parallel', label: chip('parallelTalk'), text: c('parallelTalk') },
          { key: 'interested', label: chip('stillInterested'), text: c('stillInterested') },
          { key: 'available', label: chip('availableSoon'), text: c('availableSoon') },
        ],
        candidate: [
          { key: 'nudged', label: chip('nudgedClient'), text: k('nudged', { job }) },
          { key: 'until', label: chip('decisionUntil', { day: dayLabel(2) }), text: k('expectUntil', { day: candDay(2) }) },
          { key: 'available', label: chip('stillAvailable'), text: k('stillAvailable') },
          { key: 'other', label: chip('otherTalk'), text: k('otherProcess') },
        ],
        candidateSubject: k('subjectStatus', { job }),
      };
    case 'opt_in_pending':
    case 'opt_in_pending_24h':
    case 'opt_in_pending_48h':
      return {
        clientIntents: [
          { key: 'reached', label: chip('reachedChooses'), text: c('reachedChooses') },
          { key: 'busy', label: chip('busy'), text: c('busy') },
          { key: 'newslots', label: chip('newSlots'), text: c('newSlots') },
          // „Kandidat zieht zurück“ entfällt (29.10.2026): echte Absage über „Will nicht“ im Anruf-Schritt
        ],
        clientHints: [],
        candidate: [
          { key: 'remind', label: chip('remindInvitation'), text: k('remindInvitation', { job }) },
          { key: 'notfit', label: chip('noTimeFits'), text: k('noTimeFits') },
          { key: 'alt', label: chip('suggestOwn'), text: k('suggestOwn') },
          { key: 'call', label: chip('callShort'), text: k('callShort') },
        ],
        candidateSubject: k('subjectInvitation', { job }),
      };
    case 'job_closed_inform':
      return {
        clientIntents: [],
        clientHints: [],
        candidate: [
          { key: 'inform', label: chip('jobFilled'), text: k('jobFilled', { job }) },
          { key: 'next', label: chip('otherJobs'), text: k('otherJobs') },
          { key: 'pool', label: chip('keepInView'), text: k('keepInView') },
          callMe,
        ],
        candidateSubject: k('subjectJob', { job }),
      };
    case 'rejected_inform':
      return {
        clientIntents: [
          { key: 'thanks', label: chip('alternative'), text: c('alternative') },
          { key: 'why', label: chip('askReason'), text: c('askReason') },
        ],
        clientHints: [],
        candidate: [
          { key: 'inform', label: chip('rejection'), text: k('rejection', { job }) },
          { key: 'reason_salary', label: chip('reasonSalary'), text: k('reasonSalary') },
          { key: 'reason_fit', label: chip('reasonFit'), text: k('reasonFit') },
          { key: 'next', label: chip('otherJobs'), text: k('otherJobs') },
          { key: 'pool', label: chip('keepInView'), text: k('keepInView') },
          callMe,
        ],
        candidateSubject: k('subjectApplication', { job }),
      };
    case 'client_undecided':
      // Kunde war unsicher und entscheidet seit 7 Tagen nicht (02.11.2026): benachrichtigen, nicht anrufen
      return {
        clientIntents: [
          { key: 'decision', label: chip('decisionUntil', { day: dayLabel(2) }), text: c('undecidedDecision', { day: clientDay(2) }) },
          { key: 'remind', label: chip('remindOnly'), text: c('remindDecision') },
        ],
        clientHints: [
          { key: 'waiting', label: chip('waiting'), text: c('waitingFeedback') },
          { key: 'parallel', label: chip('otherProcess'), text: c('otherProcess') },
        ],
        candidate: [
          { key: 'nudged', label: chip('nudged'), text: k('nudged', { job }) },
          { key: 'change', label: chip('tellMe'), text: k('tellMe') },
        ],
        candidateSubject: k('subjectStatus', { job }),
      };
    case 'offer_counter_stalled':
      // Gegenwunsch liegt beim Kunden (22.10.2026)
      return {
        clientIntents: [
          { key: 'decision', label: chip('decisionUntil', { day: dayLabel(2) }), text: c('counterDecision', { day: clientDay(2) }) },
          { key: 'remind', label: chip('remindOnly'), text: c('remindCounter') },
        ],
        clientHints: [
          { key: 'waiting', label: chip('waiting'), text: c('waitingAnswer') },
          { key: 'parallel', label: chip('otherOffer'), text: c('otherProcess') },
          { key: 'flexible', label: chip('flexible'), text: c('flexible') },
        ],
        candidate: [
          { key: 'nudged', label: chip('nudged'), text: k('nudgedCounter', { job }) },
          { key: 'until', label: chip('answerUntil', { day: dayLabel(2) }), text: k('askedUntil', { day: candDay(2) }) },
          { key: 'change', label: chip('tellMe'), text: k('tellMe') },
        ],
        candidateSubject: k('subjectCounter'),
      };
    default:
      return {
        clientIntents: [{ key: 'remind', label: chip('remindOnly'), text: c('remindCandidate') }],
        clientHints: [],
        candidate: [{ key: 'status', label: chip('status'), text: k('status', { job }) }],
        candidateSubject: k('subjectStatus', { job }),
      };
  }
}

/**
 * Bitte an den Kunden für eine ganze Stelle (Zeile „Kunde prüft“, 20.10.2026): gleiche
 * Wahl wie bei einem Kandidaten, die Sätze passen sich an mehrere Kandidaten an. Die
 * Kandidaten selbst nennt der Server in der Mail (vor Opt-In nur als Kürzel).
 */
export function clientBundleSet(count: number, clientLang?: string | null): Pick<MessageSet, 'clientIntents' | 'clientHints'> {
  const { c, clientDay } = recipients({ clientLang });
  const viele = count > 1;
  return {
    clientIntents: [
      { key: 'decision', label: chip('decisionUntil', { day: dayLabel(2) }), text: c(viele ? 'decisionReviewMany' : 'decisionReview', { day: clientDay(2) }) },
      { key: 'question', label: chip('moreInfo'), text: c('moreInfo') },
      { key: 'remind', label: chip('remindOnly'), text: c(viele ? 'remindCandidates' : 'remindCandidate') },
    ],
    clientHints: [
      { key: 'interested', label: viele ? chip('stillInterestedMany') : chip('stillInterested'), text: c(viele ? 'stillInterestedMany' : 'stillInterested') },
      { key: 'parallel', label: viele ? chip('parallelTalkMany') : chip('parallelTalk'), text: c(viele ? 'parallelTalkMany' : 'parallelTalk') },
      { key: 'available', label: viele ? chip('availableSoonMany') : chip('availableSoon'), text: c(viele ? 'availableSoonMany' : 'availableSoon') },
    ],
  };
}

/** Kunde gibt nach dem Interview keinen Eindruck (28.10.2026): Bitte um Feedback, eine Mail für alle Kandidaten. */
export function feedbackBundleSet(count: number, firstName: string | null, clientLang?: string | null): Pick<MessageSet, 'clientIntents' | 'clientHints'> {
  const { c, clientDay } = recipients({ clientLang });
  const viele = count > 1;
  return {
    clientIntents: [
      {
        key: 'decision', label: chip('impressionUntil', { day: dayLabel(2) }),
        text: viele ? c('impressionMany', { day: clientDay(2) }) : c('impressionOne', { first: firstName || c('theCandidateDat'), day: clientDay(2) }),
      },
      { key: 'remind', label: chip('remindOnly'), text: c(viele ? 'remindFeedbackMany' : 'remindFeedbackOne') },
    ],
    clientHints: [
      { key: 'interested', label: viele ? chip('veryInterestedMany') : chip('veryInterested'), text: c(viele ? 'veryInterestedMany' : 'veryInterested') },
      { key: 'parallel', label: viele ? chip('furtherTalkMany') : chip('furtherTalk'), text: c(viele ? 'furtherTalkMany' : 'furtherTalk') },
    ],
  };
}

export function composeClientText(set: Pick<MessageSet, 'clientIntents' | 'clientHints'>, intentKey: string | null, hintKeys: string[]): string {
  const intent = set.clientIntents.find(c => c.key === intentKey);
  const hints = set.clientHints.filter(c => hintKeys.includes(c.key)).map(c => c.text);
  return [intent?.text ?? '', ...hints].filter(Boolean).join(' ');
}

export function composeCandidateText(set: MessageSet, keys: string[]): string {
  const parts = set.candidate.filter(c => keys.includes(c.key)).map(c => c.text);
  if (!parts.length) return '';
  // Je Baustein ein Absatz, so liest sich die Mail wie geschrieben (29.10.2026)
  return parts.join('\n\n');
}

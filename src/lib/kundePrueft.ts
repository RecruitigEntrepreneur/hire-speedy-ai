// „Kunde prüft“ (Entscheidung 20.10.2026): wann der Headhunter den Kunden erinnert,
// wann er wartet, wann Matchunt übernimmt — und ob der Kandidat einen Zwischenstand
// bekommt. Alles aus dem Aktivitätslog, also auf jedem Gerät gleich (vorher merkte
// sich das nur der Browser).
//
//   Tag 5 beim Kunden  → 1. Erinnerung (du bist dran)
//   + 3 Werktage       → 2. Erinnerung (du bist dran)
//   + 3 Werktage       → Matchunt übernimmt (für dich zu Ende)
//
// Der Kandidat bekommt nie automatisch etwas. Nach dem Erinnern fragt das Fenster
// „Kandidaten Bescheid geben?“ – vorausgewählt nur, wenn der letzte Kontakt mindestens
// 5 Werktage her ist und er in den letzten 7 Tagen keinen Zwischenstand bekam.

import type { UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import i18n from '@/i18n';
import { intlLocale } from '@/i18n/languages';
import { candidateLanguage, fmtDayMonth, fmtTime, tFor } from '@/lib/localeFormat';

export const ERINNERUNG_AB_TAGEN = 5;
export const WERKTAGE_BIS_NAECHSTE = 3;
export const MAX_ERINNERUNGEN = 2;
export const KANDIDAT_UPDATE_AB_WERKTAGEN = 5;
export const ZWISCHENSTAND_SPERRE_TAGE = 7;
/** Interview-Feedback beim Kunden anstoßen: ab 2 Werktagen nach dem Interview (28.10.2026). */
export const FEEDBACK_AB_WERKTAGEN = 2;
/** Stellen-Zeilen statt Personen-Zeilen: „Kunde prüft“ und „Kunde gibt kein Feedback“. */
export const BUNDLED_CATEGORIES = ['client_review_stalled', 'client_feedback_due'];

const DAY_MS = 86_400_000;
const isWorkday = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;

/** n Werktage nach `from` (Uhrzeit bleibt), Wochenenden zählen nicht. */
export function addWorkdays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isWorkday(d)) left--;
  }
  return d;
}

/** Volle Werktage zwischen a und b (a ausgeschlossen, b eingeschlossen, nach Kalendertagen). */
export function workdaysBetween(a: Date, b: Date): number {
  if (b <= a) return 0;
  const d = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  let n = 0;
  while (d < end) {
    d.setDate(d.getDate() + 1);
    if (isWorkday(d)) n++;
  }
  return n;
}

export type WaitState = 'jetzt' | 'wartet' | 'matchunt';

export interface NudgeState {
  nudgeCount: number;
  lastNudgeAt: string | null;
  /** Ab wann die nächste Erinnerung dran wäre (bzw. Matchunt übernimmt). */
  nextNudgeAt: string | null;
  waitState: WaitState;
}

/** Stand einer Einreichung aus den Erinnerungen an den Kunden (ISO-Zeitpunkte). */
export function nudgeState(nudges: string[], now: Date): NudgeState {
  const sorted = [...nudges].sort((a, b) => b.localeCompare(a));
  const count = sorted.length;
  if (count === 0) return { nudgeCount: 0, lastNudgeAt: null, nextNudgeAt: null, waitState: 'jetzt' };
  const last = sorted[0];
  const next = addWorkdays(new Date(last), WERKTAGE_BIS_NAECHSTE);
  if (now < next) return { nudgeCount: count, lastNudgeAt: last, nextNudgeAt: next.toISOString(), waitState: 'wartet' };
  return { nudgeCount: count, lastNudgeAt: last, nextNudgeAt: next.toISOString(), waitState: count >= MAX_ERINNERUNGEN ? 'matchunt' : 'jetzt' };
}

export interface CandidateUpdateChoice {
  preselect: boolean;
  /** Kein Versand möglich (keine E-Mail oder schon Bescheid gegeben). */
  disabled: boolean;
  reason: string;
  /** Zu dieser Erinnerung schon einen Zwischenstand bekommen: Schritt erledigt, nicht noch mal senden. */
  erledigt?: { at: string };
}

// Nach Kalendertagen: gestern 18:22 ist am Morgen danach „gestern“, nicht „heute“.
// Gründe in der Sprache der Oberfläche (taskTexts:choice), gelesen beim Aufruf (README Regel 7)
const tc = (key: string, options?: Record<string, unknown>): string => i18n.t(`taskTexts:choice.${key}`, options);
const tageText = (from: Date, now: Date) => {
  const tag = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const d = Math.max(0, Math.round((tag(now) - tag(from)) / DAY_MS));
  return d === 0 ? tc('today') : d === 1 ? tc('yesterday') : tc('daysAgo', { count: d });
};

/** Soll der Kandidat nach dem Erinnern einen Zwischenstand bekommen? */
export function candidateUpdateChoice(o: {
  hasEmail: boolean;
  /** Letzter Anruf oder letzte Mail an ihn (Aktivitätslog), ohne Erinnerungen an den Kunden. */
  lastContactAt: string | null;
  /** Letzter Zwischenstand (candidate_message). */
  lastUpdateAt: string | null;
  submittedAt: string | null;
  /** Wofür `submittedAt` steht: Einreichung (Kunde prüft) oder Interview (Kunde ohne Feedback). */
  anchor?: 'Einreichung' | 'Interview';
  /** Die Erinnerung an den Kunden, zu der der Zwischenstand gehört. Ohne: die letzte zählt. */
  nudgeAt?: string | null;
}, now: Date): CandidateUpdateChoice {
  if (!o.hasEmail) return { preselect: false, disabled: true, reason: tc('noEmail') };
  if (o.lastUpdateAt && now.getTime() - new Date(o.lastUpdateAt).getTime() < ZWISCHENSTAND_SPERRE_TAGE * DAY_MS) {
    // Zu dieser Erinnerung schon Bescheid gegeben: nicht noch mal (05.11.2026, 5× an Sven).
    // Erst eine neue Erinnerung an den Kunden macht einen neuen Zwischenstand sinnvoll.
    if (!o.nudgeAt || Date.parse(o.lastUpdateAt) >= Date.parse(o.nudgeAt)) {
      const heute = new Date(o.lastUpdateAt).toDateString() === now.toDateString();
      const reason = heute
        ? tc('updateGotToday', { time: fmtTime(o.lastUpdateAt) })
        : tc('updateGot', { when: tageText(new Date(o.lastUpdateAt), now) });
      return { preselect: false, disabled: true, erledigt: { at: o.lastUpdateAt }, reason };
    }
    return { preselect: false, disabled: false, reason: tc('updateGotAlready', { when: tageText(new Date(o.lastUpdateAt), now) }) };
  }
  const candidates = [o.lastContactAt, o.submittedAt].filter(Boolean) as string[];
  if (!candidates.length) return { preselect: true, disabled: false, reason: tc('noContact') };
  const last = candidates.sort((a, b) => b.localeCompare(a))[0];
  const viaSubmission = last === o.submittedAt && last !== o.lastContactAt;
  const when = tageText(new Date(last), now);
  const label = viaSubmission
    ? tc(o.anchor === 'Interview' ? 'lastContactInterview' : 'lastContactSubmission', { when })
    : tc('lastContact', { when });
  const lange = workdaysBetween(new Date(last), now) >= KANDIDAT_UPDATE_AB_WERKTAGEN;
  return { preselect: lange, disabled: false, reason: lange ? label : tc('notChosen', { label }) };
}

/** Zwischenstand passend zur Bitte an den Kunden. Der Server setzt „Hallo <Vorname>,“ davor. */
/**
 * `wann`: „heute“ oder „am 15.10.“ – je nachdem, wann der Kunde erinnert wurde (`updateWhen`).
 * Text an den Kandidaten: in der Sprache des Headhunters (`lang`, sonst `candidateLanguage()`).
 */
export function candidateUpdateText(intent: string | null, jobTitle: string | null, until: string, wann?: string, lang: string = candidateLanguage()): string {
  const t = (key: string, options?: Record<string, unknown>) => tFor(lang, 'taskMessages')(`update.${key}`, options) as string;
  const job = jobTitle || t('theJobDat');
  const when = wann ?? t('today');
  const tail = t('tail');
  const key = intent === 'interview_feedback' ? 'feedback' : intent === 'decision' ? 'decision' : intent === 'question' ? 'question' : 'remind';
  return `${t(key, { when, job, until })}\n\n${tail}`;
}

/** „heute“ oder „am 15.10.“ für den Zwischenstand, in der Sprache des Kandidaten-Texts. */
export function updateWhen(at: Date, lang: string = candidateLanguage()): string {
  const t = tFor(lang, 'taskMessages');
  return at.toDateString() === new Date().toDateString() ? t('update.today') as string : t('update.onDate', { date: fmtDayMonth(at, lang) }) as string;
}

/** Betreff des Zwischenstands an den Kandidaten. */
export function candidateUpdateSubject(jobTitle: string | null, lang: string = candidateLanguage()): string {
  const t = tFor(lang, 'taskMessages');
  return t('update.subject', { job: jobTitle ?? t('update.yourApplication') }) as string;
}

export interface StalledBundle {
  key: string;
  /** review = Kunde prüft die Einreichung · feedback = Kunde gibt nach dem Interview keinen Eindruck */
  kind: 'review' | 'feedback';
  jobId: string | null;
  jobTitle: string | null;
  companyName: string | null;
  items: UnifiedTaskItem[];
  /** Längste Wartezeit beim Kunden in Tagen. */
  days: number;
  feeTotal: number;
  /** 1 = erste Erinnerung fällig, 2 = zweite. */
  erinnerung: 1 | 2;
}

/** „Kunde prüft“- bzw. Feedback-Aufgaben je Stelle bündeln: eine Zeile, eine Bitte für alle Kandidaten. */
export function bundleByJob(items: UnifiedTaskItem[], now: Date): StalledBundle[] {
  const map = new Map<string, UnifiedTaskItem[]>();
  for (const it of items) {
    const base = it.jobId || it.itemId;
    const key = it.taskCategory === 'client_feedback_due' ? `feedback:${base}` : base;
    map.set(key, [...(map.get(key) ?? []), it]);
  }
  return [...map.entries()].map(([key, list]) => {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const days = Math.max(...sorted.map(i => Math.floor((now.getTime() - new Date(i.createdAt).getTime()) / DAY_MS)));
    return {
      key,
      kind: sorted[0].taskCategory === 'client_feedback_due' ? 'feedback' : 'review',
      jobId: sorted[0].jobId,
      jobTitle: sorted[0].jobTitle,
      companyName: sorted[0].companyName,
      items: sorted,
      days,
      feeTotal: sorted.reduce((n, i) => n + (i.feeValue ?? 0), 0),
      erinnerung: sorted.some(i => (i.nudgeCount ?? 0) >= 1) ? 2 : 1,
    } satisfies StalledBundle;
  }).sort((a, b) => b.days - a.days || b.feeTotal - a.feeTotal);
}

/** „In Prüfung“ (29.10.2026): Hat das Kundenteam das Profil geöffnet? Für Zeilen und Fenster. */
export function viewText(count: number | null | undefined, lastAt: string | null | undefined): string {
  if (!count || !lastAt) return i18n.t('recruiterTasks:view.notOpened');
  const date = new Date(lastAt).toLocaleDateString(intlLocale(i18n.language), { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' });
  return count === 1 ? i18n.t('recruiterTasks:view.once', { date }) : i18n.t('recruiterTasks:view.many', { count, date });
}

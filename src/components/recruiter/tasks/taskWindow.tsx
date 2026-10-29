// Aufgaben-Fenster und Handgriffe, gemeinsam für die Seite „Aufgaben“ (RecruiterHeute)
// und das Kandidatenprofil (Entscheidung 14.10.2026: Klick auf eine Aufgabe im
// Dashboard führt ins Kandidatenprofil, dort öffnet sich die Aufgabe).
// Aus RecruiterHeute.tsx herausgelöst, Inhalt unverändert.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { notifyTasksChanged, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { useAuth } from '@/lib/auth';
import { messageSetFor, composeClientText, composeCandidateText } from '@/lib/aufgabenTexte';
import { functionError } from '@/lib/functionError';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Check, Lock, Mail, NotebookPen, Phone } from 'lucide-react';
import { NachgespraechWindow, nachTargetFromItem, type NachTarget } from './NachgespraechWindow';
import { OfferAnswerDialog } from '@/components/offers/OfferAnswerDialog';
import { RecommendationDialog } from '@/components/offers/RecommendationDialog';
import { ContractWindow } from '@/components/contracts/ContractWindow';
import { Honorar } from '@/components/recruiter/Honorar';

export const DAY_MS = 86_400_000;

export type Kind = 'call' | 'called' | 'followup' | 'debrief' | 'done' | 'akte' | 'client' | 'candidate' | 'offer' | 'recommend' | 'contract';

export interface Guide {
  pill: string;
  advice: string;
  facts: string[];
  consequence: string | null;
  steps: { text: string; hint?: string }[];
  goal: string;
  primary: { label: string; kind: Kind };
  reachedOptions: string[];
}

export const euro = (n: number | null) => (n && n > 0 ? `${Math.round(n / 1000)}.000 €` : null);
export const daysSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)) : 0);
export const hoursSince = (iso: string | null) => (iso ? Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)) : 0);
export const firstName = (name: string | null) => (name ? name.trim().split(/\s+/)[0] : 'der Kandidat');
export const dateDe = (iso: string | null) => (iso ? format(new Date(iso), 'dd.MM.', { locale: de }) : '');
/** Satzende ohne doppelten Punkt nach einem Datum („am 13.10.“). */
const satz = (s: string) => (s.endsWith('.') ? s : `${s}.`);

export function buildGuide(item: UnifiedTaskItem): Guide {
  const name = item.candidateName || 'Kandidat';
  const first = firstName(item.candidateName);
  const job = item.jobTitle || 'die Stelle';
  const fee = euro(item.feeValue);
  const cat = item.taskCategory;

  if (cat === 'client_review_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: 'Prüfung',
      advice: `Kunde prüft seit ${d} Tagen ohne Antwort. Nachfassen.`,
      facts: [
        `Eingereicht am ${dateDe(item.createdAt)}, seit ${d} Tagen in Prüfung.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : 'Honorar: noch nicht bekannt.',
        'Der Kunde hat sich seitdem nicht gemeldet.',
      ],
      consequence: d >= 14 ? 'Nach zwei Wochen ohne Antwort ist der Deal meist verloren, wenn niemand nachfasst.' : 'Ohne Nachfassen kühlt der Deal ab, und der Kandidat verliert das Interesse.',
      steps: [
        { text: 'Beim Kunden nachfassen.', hint: 'Entscheidung oder Rückfrage erbitten, Frist nennen.' },
        { text: `${first} auf dem Laufenden halten.`, hint: 'Kurz sagen, dass du nachgefasst hast, und fragen, ob er noch verfügbar ist.' },
      ],
      goal: 'Antwort des Kunden',
      primary: { label: 'Kunden erinnern', kind: 'client' },
      reachedOptions: ['Entscheidung zugesagt', 'Kunde braucht mehr Infos', 'Kunde sagt ab', `${first} informiert`],
    };
  }
  if (cat === 'client_feedback_due') {
    // Kunde gibt nach dem Interview keinen Eindruck (28.10.2026); das Fenster ist das Stellen-Fenster
    const d = daysSince(item.createdAt);
    return {
      pill: 'Feedback',
      advice: `Kunde ohne Feedback zum Interview seit ${d} Tagen. Nachfragen.`,
      facts: [
        `Interview mit ${name} am ${dateDe(item.interviewAt ?? item.createdAt)}, seitdem kein Eindruck des Kunden.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : 'Honorar: noch nicht bekannt.',
      ],
      consequence: `Ohne Eindruck gibt es keinen nächsten Schritt, und ${first} kühlt ab.`,
      steps: [
        { text: 'Den Kunden nach seinem Eindruck fragen.', hint: 'Frist nennen, eine Mail für alle Kandidaten.' },
        { text: `${first} auf dem Laufenden halten.` },
      ],
      goal: 'Feedback des Kunden',
      primary: { label: 'Kunden fragen', kind: 'client' },
      reachedOptions: [],
    };
  }
  if (cat === 'job_closed_inform') {
    // Stelle besetzt oder geschlossen (28.10.2026): Kandidat informieren statt Kunden erinnern
    const besetzt = item.title.startsWith('Stelle besetzt');
    return {
      pill: besetzt ? 'Besetzt' : 'Geschlossen',
      advice: `Die Stelle ist ${besetzt ? 'besetzt' : 'geschlossen'}. ${first} weiß es noch nicht.`,
      facts: [
        `${item.companyName ?? 'Der Kunde'} hat die Stelle ${job} am ${dateDe(item.createdAt)} ${besetzt ? 'besetzt' : 'geschlossen'}.`,
        `${name} hat das noch nicht von dir gehört.`,
      ],
      consequence: `Erfährt ${first} es woanders zuerst, verliert ${first} das Vertrauen in dich.`,
      steps: [
        { text: `${first} informieren.`, hint: 'Wertschätzend, ohne Namen der eingestellten Person.' },
        { text: 'Andere Stellen anbieten oder im Blick behalten.' },
      ],
      goal: `${first} informiert`,
      primary: { label: `${first} informieren`, kind: 'candidate' },
      reachedOptions: ['Informiert', 'Will andere Stellen', 'Kein Interesse mehr'],
    };
  }
  if (cat === 'interview_debrief_due') {
    // Nachgespräch statt Debrief (20.10.2026): zuerst hören, was der Kandidat sagt.
    const h = hoursSince(item.createdAt);
    return {
      pill: 'Nachgespräch',
      // „solange es frisch ist“ nur in den ersten zwei Tagen (Durchklick 27.10.2026)
      advice: h < 48
        ? `Interview war vor ${h} Std. Ruf ${first} an, solange es frisch ist.`
        : `${satz(`Interview am ${dateDe(item.createdAt)}`)} ${first} wartet auf deine Rückmeldung.`,
      facts: [
        `Das Interview mit ${name} für ${job} ist vorbei.`,
        'Wie es lief, Gehalt, Angebot und Start weißt du nur von ihm.',
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Ohne Nachgespräch fehlt dir das Bauchgefühl des Kandidaten, wenn der Kunde entscheidet.',
      steps: [
        { text: `${first} anrufen.`, hint: 'Bauchgefühl, Ansprechpartner, Gehalt, Angebot, Start.' },
        { text: 'Festhalten, dann den Kunden nach seinem Eindruck fragen.' },
      ],
      goal: 'Nachgespräch festgehalten',
      primary: { label: 'Nachgespräch', kind: 'debrief' },
      reachedOptions: [],
    };
  }
  if (cat === 'offer_deliver') {
    // Angebot über den Headhunter (22.10.2026; G + H 25.10.2026): Der Kandidat antwortet selbst,
    // der Headhunter ruft an, bevor die Mail rausgeht, ruft zurück und fasst nach
    const t = item.title;
    const considering = t.startsWith('Kandidat überlegt');
    // Kalendertage bis zur Frist (heute = 0)
    const berlinDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const left = item.dueAt ? Math.round((Date.parse(`${berlinDay(new Date(item.dueAt).getTime())}T12:00:00Z`) - Date.parse(`${berlinDay(Date.now())}T12:00:00Z`)) / DAY_MS) : null;
    const frist = left === null ? '' : left < 0 ? 'Frist abgelaufen.' : left === 0 ? 'Antwort heute fällig.' : `Noch ${left} ${left === 1 ? 'Tag' : 'Tage'}.`;
    const advice = t.startsWith('Rückruf') ? `${first} möchte über das Angebot sprechen. ${item.description ? satz(item.description) : ''}`
      : t === 'Angebot überbringen' ? `Der Kunde macht ${first} ein Angebot. Ruf an, bevor die Mail rausgeht${item.description ? ` (${item.description.replace(/^Mail an Kandidat /, '')})` : ''}.`
        : t.startsWith('Keine Antwort') ? `${first} hat seit 24 Std. nicht auf das Angebot geantwortet. ${frist} Ruf an.`
          : t.startsWith('Zusage noch nicht') ? `${first} hat die Zusage noch nicht per Klick bestätigt. Ruf an.`
            : considering ? `${first} überlegt noch. ${frist} Nachfassen und Antwort eintragen.`
              : `${first} hat das Angebot schriftlich. ${frist} Ruf an und geh es durch.`;
    return {
      pill: 'Angebot',
      advice,
      facts: [
        `Angebot für ${job}${item.companyName ? ` bei ${item.companyName}` : ''}.`,
        `${first} antwortet selbst auf der Angebotsseite (Mail von dir über Matchunt).`,
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Liegt ein Angebot zu lange, kommt das Gegenangebot des Arbeitgebers zuerst.',
      steps: [
        { text: `${first} anrufen und das Angebot durchgehen.`, hint: 'Gehalt, Start, Extras. Was fehlt noch für eine Zusage?' },
        { text: '„Gespräch geführt“ klicken: Die Mail geht sofort raus.', hint: 'Sagt es dir am Telefon zu, ab oder will mehr: hier melden.' },
      ],
      goal: 'Angebot liegt schriftlich vor',
      primary: { label: 'Angebot öffnen', kind: 'offer' },
      reachedOptions: [],
    };
  }
  if (cat === 'recommendation_due') {
    return {
      pill: 'Empfehlung',
      advice: `Der Kunde will ${first} ein Angebot machen. Schick deine Empfehlung, bevor er Zahlen schreibt.`,
      facts: [
        `Feedback des Kunden zu ${job}: Angebot machen.`,
        'Was der Kandidat für eine Zusage braucht, weißt nur du aus dem Nachgespräch.',
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Ohne Empfehlung schreibt der Kunde oft zu niedrig, dann folgt eine Runde Gegenwunsch.',
      steps: [
        { text: 'Punkte aus dem Nachgespräch prüfen.', hint: 'Gehalt, Start, was ihm wichtig ist.' },
        { text: 'Anhaken, was der Kunde sieht, und senden.', hint: 'Die Schmerzgrenze bleibt bei dir.' },
      ],
      goal: 'Empfehlung gesendet',
      primary: { label: 'Empfehlung schreiben', kind: 'recommend' },
      reachedOptions: [],
    };
  }
  if (cat === 'contract_check' || cat === 'contract_nudge' || cat === 'contract_followup' || cat === 'contract_follow' || cat === 'contract_missing') {
    // Arbeitsvertrag (Paket 3)
    const check = cat === 'contract_check';
    const nudge = cat === 'contract_nudge';
    return {
      pill: check ? 'Gegenprobe' : 'Vertrag',
      advice: check ? `Der Kunde meldet: ${first} hat unterschrieben. Stimmt das?`
        : nudge ? `Die Firma hat unterschrieben. Stoß ${first} an, damit die Unterschrift heute kommt.`
          : cat === 'contract_missing' ? `${first} sagt: Der Arbeitsvertrag ist noch nicht da. Der Kunde ist informiert und soll ihn erneut schicken. Ruf ${first} an und frag beim Kunden nach, wenn er sich nicht rührt.`
          : cat === 'contract_follow' && item.description?.startsWith('In DocuSign abgelehnt') ? `${first} hat den Vertrag in DocuSign abgelehnt. Kläre mit ${first} und dem Kunden, ob ein neuer Vertrag kommt.`
          : cat === 'contract_follow' ? `${item.description ?? ''} Halt Kontakt zu ${first} und melde die Unterschrift, sobald sie da ist.`
            : `${item.description ?? 'Noch keine Unterschrift gemeldet.'} Frag bei ${first} nach.`,
      facts: [
        `Arbeitsvertrag für ${job}${item.companyName ? ` bei ${item.companyName}` : ''}.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: check ? 'Weicht etwas ab, klärt Matchunt es, bevor die Rechnung rausgeht.' : 'Je länger der Vertrag liegt, desto mehr Zeit hat der alte Arbeitgeber für ein Gegenangebot.',
      steps: check
        ? [{ text: `Bei ${first} nachfragen.`, hint: 'Datum, Gehalt, Start.' }, { text: '„Stimmt“ oder „Weicht ab“ wählen.' }]
        : [{ text: `${first} anrufen.`, hint: nudge ? 'DocuSign-Mail gefunden? Fragen zum Vertrag?' : 'Vertrag bekommen? Unterschrieben?' }, { text: 'Stand eintragen: unterschrieben oder abgesprungen.' }],
      goal: check ? 'Gegenprobe gemacht' : 'Unterschrift',
      primary: { label: check ? 'Gegenprobe' : 'Vertrag begleiten', kind: 'contract' },
      reachedOptions: [],
    };
  }
  if (cat === 'offer_counter_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: 'Gegenwunsch',
      advice: `Der Kunde antwortet seit ${d} Tagen nicht auf den Gegenwunsch von ${first}. Nachfassen.`,
      facts: [
        satz(`Gegenwunsch zu ${job} eingetragen am ${dateDe(item.createdAt)}`),
        item.description ? satz(item.description) : '',
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Wartet der Kandidat zu lange, nimmt er ein anderes Angebot oder bleibt.',
      steps: [
        { text: 'Beim Kunden eine Entscheidung erbitten.', hint: 'Anpassen, beim Angebot bleiben oder absagen.' },
        { text: `${first} auf dem Laufenden halten.` },
      ],
      goal: 'Entscheidung des Kunden',
      primary: { label: 'Kunden erinnern', kind: 'client' },
      reachedOptions: [],
    };
  }
  if (cat === 'opt_in_pending' || cat === 'opt_in_pending_24h' || cat === 'opt_in_pending_48h') {
    const h = hoursSince(item.createdAt);
    const since = h < 48 ? `${h} Std.` : `${Math.floor(h / 24)} Tagen`;
    return {
      pill: 'Opt-In',
      advice: `Einladung seit ${since} offen, Kunde wartet. Heute erreichen.`,
      facts: [
        `Der Kunde hat ein Interview für ${job} angefragt.`,
        `${name} hat die Einladung seit ${since} nicht beantwortet.`,
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Laufen die Terminvorschläge ab, fragt der Kunde den nächsten Kandidaten.',
      steps: [
        { text: `${first} anrufen.`, hint: 'Welche Zeit passt? Er klickt nur den Link in der Einladung.' },
        { text: 'Wenn keine Zeit passt: Zeiten beim Kunden anfragen.' },
        { text: 'Wenn er nicht will: Grund erfassen, Anfrage zurückziehen.' },
      ],
      goal: 'Termin gewählt',
      primary: { label: 'Anrufen', kind: 'call' },
      reachedOptions: ['Hat gewählt', 'Wählt heute', 'Lehnt ab'],
    };
  }
  if (cat === 'rejected_inform') {
    return {
      pill: 'Absage',
      advice: `Kunde hat abgesagt. ${first} weiß es noch nicht.`,
      facts: [
        `Der Kunde hat ${name} für ${job} abgesagt (${dateDe(item.createdAt)}).`,
        item.description?.includes('Grund:') ? item.description.slice(item.description.indexOf('Grund:')).replace(/\)\.?$/, '').trim() + '.' : 'Kein Grund hinterlegt.',
        'Der Kandidat hat noch keine Nachricht von dir.',
      ],
      consequence: 'Wer von der Absage zuerst vom Kunden erfährt, verliert das Vertrauen in dich.',
      steps: [
        { text: `${first} informieren.`, hint: 'Wertschätzend, Grund in neutraler Sprache, kein Firmenname.' },
        { text: 'Andere Stellen anbieten oder im Blick behalten.' },
      ],
      goal: `${first} informiert`,
      primary: { label: `${first} informieren`, kind: 'candidate' },
      reachedOptions: ['Informiert', 'Will andere Stellen', 'Kein Interesse mehr'],
    };
  }
  if (item.itemType === 'task') {
    // Eigene Erinnerung (29.10.2026): oben steht, was zu tun ist, die Notiz im Grund
    const due = item.dueAt ? new Date(item.dueAt) : null;
    const dueText = due
      ? `Fällig ${due.toDateString() === new Date().toDateString() ? 'heute' : `am ${dateDe(item.dueAt)}`}, ${format(due, 'HH:mm')}`
      : 'Ohne Datum';
    return {
      pill: 'Eigene',
      advice: item.title,
      facts: [
        item.description ? `Deine Notiz: „${item.description}“` : '',
        `${dueText}.`,
        item.jobTitle ? `${item.jobTitle}${item.companyName ? ` · ${item.companyName}` : ''}.` : '',
      ].filter(Boolean),
      consequence: null,
      steps: [{ text: item.title }],
      goal: 'Erledigt',
      primary: { label: 'Erledigt', kind: 'done' },
      reachedOptions: [],
    };
  }
  // Historische Engine-Alerts
  return {
    pill: 'Hinweis',
    advice: item.description || item.title,
    facts: [item.recommendedAction || item.title],
    consequence: null,
    steps: [{ text: item.recommendedAction || 'Prüfen und entscheiden.' }],
    goal: 'Geklärt',
    primary: { label: item.candidatePhone ? 'Anrufen' : 'Öffnen', kind: item.candidatePhone ? 'call' : 'akte' },
    reachedOptions: ['Geklärt'],
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
    const key = it.candidateId || it.itemId;
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
  const navigate = useNavigate();
  const { logActivity } = useActivityLogger();
  const [windowKey, setWindowKey] = useState<string | null>(null);
  const [windowTab, setWindowTab] = useState<'client' | 'candidate'>('client');
  const [reached, setReached] = useState<{ item: UnifiedTaskItem; guide: Guide } | null>(null);
  const [detail, setDetail] = useState<TaskDetailItem | null>(null);
  // Nachgespräch: eigenes Fenster, festgehalten, damit Schritt 3 nach dem Neuladen bleibt
  const [nach, setNach] = useState<{ target: NachTarget; item: UnifiedTaskItem } | null>(null);
  // Angebot überbringen bzw. Empfehlung schreiben: eigene Fenster je Einreichung
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [recFor, setRecFor] = useState<string | null>(null);
  const [contractFor, setContractFor] = useState<string | null>(null);
  /** Aufgaben mit eigenem Fenster direkt öffnen; true = erledigt. */
  const openOwnWindow = (it: UnifiedTaskItem) => {
    if (it.taskCategory === 'interview_debrief_due') { setNach({ target: nachTargetFromItem(it), item: it }); return true; }
    if (it.taskCategory === 'offer_deliver' && it.submissionId) { setOfferFor(it.submissionId); return true; }
    if (it.taskCategory === 'recommendation_due' && it.submissionId) { setRecFor(it.submissionId); return true; }
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
      case 'contract':
        if (item.submissionId) setContractFor(item.submissionId);
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
        setReached({ item, guide: { ...guide, primary: { label: 'Anrufen', kind: 'call' } } });
        return;
      case 'done':
        markDone(item.itemType, item.itemId).then(({ error }) => {
          if (error) toast.error('Konnte nicht als erledigt markiert werden.');
          else toast.success('Erledigt');
        });
        return;
      case 'akte':
        if (item.candidateId) navigate(`/recruiter/candidates/${item.candidateId}`);
        return;
    }
  };

  const sendMessage = async (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('recruiter-notify', {
      body: { action, submissionId: item.submissionId, text, ...meta },
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
      const msg = typeof failure === 'string' ? failure : 'Senden fehlgeschlagen.';
      toast.error(/Failed to send a request/i.test(msg) ? 'Senden nicht möglich: Die Function „recruiter-notify“ ist noch nicht deployt.' : msg);
      return false;
    }
    const anlass = meta.anlass;
    if (action === 'client_nudge') {
      // Gegenwunsch: wartet auf dem Server (Aktivitätslog); Opt-In und Absage: nur ein Stand an den Kunden,
      // die Aufgabe beim Kandidaten bleibt (29.10.2026)
      if (anlass === 'counter') toast.success('Kunde erinnert. Die Zeile wartet unter „Wartet auf andere“.');
      else if (anlass === 'opt_in' || anlass === 'rejected') toast.success('Kunde informiert.');
      else {
        toast.success(`Kunde erinnert (${(data as any)?.recipients ?? 1} Empfänger). Die Zeile ruht bis zur Antwort.`);
        await snooze(item.itemType, item.itemId, new Date(Date.now() + 3 * DAY_MS));
      }
    } else {
      toast.success('Nachricht gesendet.');
      if (item.taskCategory === 'rejected_inform' || item.taskCategory === 'job_closed_inform') await markDone(item.itemType, item.itemId);
      else if (item.taskCategory !== 'offer_counter_stalled') await snooze(item.itemType, item.itemId, new Date(Date.now() + DAY_MS));
    }
    refetch();
    notifyTasksChanged();
    return true;
  };

  const later = async (item: UnifiedTaskItem, until: Date) => {
    const { error } = await snooze(item.itemType, item.itemId, until);
    if (error) toast.error('Konnte nicht vertagt werden.');
    else toast.success(`Vertagt bis ${format(until, 'EEEE HH:mm', { locale: de })}`);
  };

  const confirmReached = async (yes: boolean, outcome: string | null, note: string) => {
    if (!reached) return;
    const { item, guide } = reached;
    setReached(null);
    if (item.candidateId) {
      await logActivity(
        item.candidateId,
        'call',
        yes ? `Erreicht: ${outcome ?? guide.goal}` : 'Nicht erreicht',
        note || undefined,
        { reached: yes, outcome, task_category: item.taskCategory },
        item.submissionId || undefined,
      );
    }
    // Gegenwunsch: Der Anruf beim Kandidaten erledigt nichts, der Kunde ist noch dran
    if (yes && item.taskCategory === 'offer_counter_stalled') {
      toast.success('Anruf festgehalten.');
    } else if (yes) {
      const { error } = await markDone(item.itemType, item.itemId);
      if (error) toast.error('Beleg gespeichert, Zeile konnte nicht geschlossen werden.');
      else toast.success(outcome ? `${outcome}. Zeile geschlossen.` : 'Zeile geschlossen.');
    } else {
      await snooze(item.itemType, item.itemId, new Date(Date.now() + 2 * 3_600_000));
      toast.success('Wiedervorlage in 2 Stunden.');
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
    const it = /^derived-(debrief|offer|recommend|contract)-/.test(itemId) ? allItems.find(i => i.itemId === itemId) : null;
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
        onMarkDone={async id => { const it = allItems.find(i => i.itemId === id); if (it) { const { error } = await markDone(it.itemType, it.itemId); if (error) toast.error('Konnte nicht als erledigt markiert werden.'); } }}
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
        laterSlot={nach ? <LaterMenu onPick={until => { const it = nach.item; setNach(null); later(it, until); }} /> : null}
      />
      <OfferAnswerDialog submissionId={offerFor} onClose={() => setOfferFor(null)} onDone={refetch} />
      <RecommendationDialog submissionId={recFor} onClose={() => setRecFor(null)} onDone={refetch} />
      <ContractWindow
        submissionId={contractFor}
        onClose={() => setContractFor(null)}
        onDone={refetch}
        onLater={contractItem ? until => { setContractFor(null); later(contractItem, until); } : undefined}
      />
    </>
  );

  /** Vertrags-Fenster direkt (Vertrag unter „Wartet auf andere“, 28.10.2026). */
  const openContract = (submissionId: string) => setContractFor(submissionId);
  return { act, later, openDetail, openItem, openContract, setWindowKey: openGroupKey, host };
}

type Side = 'call' | 'done' | 'client' | 'candidate';

/** Ergebnis des Anrufs bei Opt-In (29.10.2026). */
type OptInOutcome = 'waehlt' | 'zeit' | 'will_nicht' | 'nicht_erreicht' | 'erreicht';
const OPT_IN_OUTCOMES: { key: OptInOutcome; label: string }[] = [
  { key: 'waehlt', label: 'Wählt heute selbst' },
  { key: 'zeit', label: 'Keine Zeit passt' },
  { key: 'will_nicht', label: 'Will nicht' },
  { key: 'nicht_erreicht', label: 'Nicht erreicht' },
];
/** Anruf aus einer eigenen Erinnerung oder einem alten Hinweis */
const CALL_OUTCOMES: { key: OptInOutcome; label: string }[] = [
  { key: 'erreicht', label: 'Erreicht' },
  { key: 'nicht_erreicht', label: 'Nicht erreicht' },
];

/**
 * Schritte im Aufgaben-Fenster (29.10.2026, statt zweier Reiter): erst die Pflicht, dann das
 * Optionale. Nach dem Senden bleibt das Fenster offen, der nächste Schritt ist dran.
 */
export function stepPlan(cat: string, first: string, opts: { itemType?: string; title?: string; phone?: boolean; hasCandidate?: boolean } = {}): { side: Side; label: string; optional?: boolean }[] {
  // Eigene Erinnerung (29.10.2026): die Aufgabe selbst, eine Mail an den Kandidaten nur auf Wunsch, nie an den Kunden
  if (opts.itemType === 'task') {
    const mail = opts.hasCandidate ? [{ side: 'candidate' as const, label: `${first} eine Mail schreiben?`, optional: true }] : [];
    return [{ side: cat === 'call' ? 'call' : 'done', label: opts.title || 'Erinnerung' }, ...mail];
  }
  if (cat === 'offer_counter_stalled') return [{ side: 'client', label: 'Kunden um Entscheidung bitten' }, { side: 'candidate', label: `${first} Bescheid geben?`, optional: true }];
  if (cat === 'rejected_inform') return [{ side: 'candidate', label: `${first} informieren` }, { side: 'client', label: 'Kunden nach dem Grund fragen?', optional: true }];
  if (cat === 'job_closed_inform') return [{ side: 'candidate', label: `${first} informieren` }];
  if (cat.startsWith('opt_in_pending')) return [{ side: 'call', label: `${first} anrufen` }, { side: 'client', label: 'Kunden Bescheid geben?', optional: true }, { side: 'candidate', label: `${first} per Mail erinnern?`, optional: true }];
  // Alte Hinweise: anrufen oder schreiben, keine allgemeine Erinnerung an den Kunden
  return opts.phone
    ? [{ side: 'call', label: `${first} anrufen` }, { side: 'candidate', label: `${first} eine Mail schreiben?`, optional: true }]
    : [{ side: 'candidate', label: `An ${first}` }];
}

/** Anlass der Nachricht an den Kunden: Betreff und Schluss der Mail (recruiter-notify). */
export const anlassOf = (cat: string) =>
  cat === 'offer_counter_stalled' ? 'counter' : cat.startsWith('opt_in_pending') ? 'opt_in' : cat === 'rejected_inform' ? 'rejected' : undefined;

function afterText(cat: string, first: string): string | null {
  if (cat === 'offer_counter_stalled') return 'Danach wartest du. Die Zeile steht unter „Wartet auf andere“, bis der Kunde antwortet. Kommt nichts, ist nach 3 Werktagen die 2. Erinnerung dran.';
  if (cat === 'rejected_inform' || cat === 'job_closed_inform') return `Erledigt, sobald ${first} informiert ist: Mail gesendet oder Anruf „erreicht“.`;
  if (cat.startsWith('opt_in_pending')) return `Die Aufgabe bleibt, bis ${first} einen Termin wählt oder absagt. Nach dem Anruf ruht sie bis morgen, bei „Nicht erreicht“ 2 Std.`;
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
  const set = useMemo(() => item ? messageSetFor(item.taskCategory, { jobTitle: item.jobTitle, firstName: firstName(item.candidateName) }) : null, [item?.itemId, item?.taskCategory, item?.jobTitle, item?.candidateName]);
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
  const stepLabel = (p: { side: Side; label: string }) => (optIn && p.side === 'client' && outcome === 'zeit' ? 'Kunden um weitere Zeiten bitten' : p.label);
  const after = afterText(item.taskCategory, first);
  const outcomeLabel = outcomes.find(o => o.key === outcome)?.label ?? '';
  // Für den Kandidaten abgesagt: keine weiteren Schritte mehr
  const declined = optIn && outcome === 'will_nicht' && !!sent.call;
  const markDone = (side: Side, nextActive?: Side | null) => {
    const next = { ...sent, [side]: new Date() };
    setSent(next);
    setActive(nextActive !== undefined ? nextActive : plan.find(p => !next[p.side] && can(p.side))?.side ?? null);
  };
  const logCall = (reached: boolean, label: string, note?: string) => item.candidateId
    ? logActivity(item.candidateId, 'call', reached ? `Erreicht: ${label}` : 'Nicht erreicht', note, { reached, outcome: label, task_category: item.taskCategory }, item.submissionId || undefined)
    : Promise.resolve(null);
  const pickOutcome = async (o: OptInOutcome) => {
    setOutcome(o);
    setClientEdit(null);
    setCandEdit(null);
    if (o === 'will_nicht') return;
    const label = outcomes.find(x => x.key === o)!.label;
    await logCall(o !== 'nicht_erreicht', label, callNote.trim() || undefined);
    // Eigene Erinnerung oder alter Hinweis: erreicht = erledigt, sonst in 2 Std. wieder
    if (!optIn) {
      if (o === 'erreicht') { onAct(item, { ...guide, primary: { label: 'Erledigt', kind: 'done' } }); return; }
      await onSnooze(item, new Date(Date.now() + 2 * 3_600_000));
      markDone('call', canCandidate ? 'candidate' : null);
      toast.success('Festgehalten. In 2 Std. wieder oben.');
      onChanged();
      return;
    }
    const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
    if (o === 'waehlt') { setIntent('reached'); await onSnooze(item, tomorrow); markDone('call', 'client'); }
    if (o === 'zeit') { setIntent('newslots'); setCandKeys([allowAlt ? 'alt' : 'notfit']); await onSnooze(item, tomorrow); markDone('call', allowAlt ? 'candidate' : 'client'); }
    if (o === 'nicht_erreicht') { setCandKeys(['remind']); await onSnooze(item, new Date(Date.now() + 2 * 3_600_000)); markDone('call', 'candidate'); }
    toast.success(o === 'nicht_erreicht' ? 'Festgehalten. In 2 Std. wieder oben.' : 'Anruf festgehalten.');
    onChanged();
  };
  const declineForCandidate = async () => {
    if (!item.submissionId) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke('interview-request', { body: { action: 'decline_for_candidate', submissionId: item.submissionId, reason: declineReason.trim() } });
    const failure = await functionError(error, data, 'interview-request');
    setSending(false);
    if (failure) { toast.error(failure); return; }
    await logCall(true, 'Will nicht', declineReason.trim() || undefined);
    toast.success(`Einladung für ${first} abgesagt. Der Kunde ist informiert.`);
    markDone('call', null);
    onChanged();
  };
  const time = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
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
  const called = () => onAct(item, { ...guide, primary: { label: 'Angerufen', kind: 'called' } });

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
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Grund</p>
              <ul className="space-y-1.5 text-sm">
                {guide.facts.map((f, i) => <li key={i} className="flex gap-2"><span className="text-muted-foreground">•</span><span>{fee && f === `Honorar bei Abschluss: ${fee}.` ? <>Honorar bei Abschluss: <Honorar>{fee}</Honorar>.</> : f}</span></li>)}
                {guide.consequence && <li className="flex gap-2 text-muted-foreground"><span>→</span><span>{guide.consequence}</span></li>}
              </ul>
              {group.others.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Dazu: {group.others.map(o => `${o.jobTitle} · ${buildGuide(o).advice}`).join(' · ')}</p>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Bisher</p>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">Noch kein Kontakt zu diesem Deal.</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateDe(h.created_at)}</span><span>{h.title}{h.metadata?.sent === false ? ' (nicht gesendet)' : ''}</span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Deine Aufgabe</p>
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
                        {done ? (p.side === 'call' ? `${first} angerufen · ${outcomeLabel}${outcome === 'will_nicht' ? ' · Einladung abgesagt' : ''}` : `${p.side === 'client' ? 'Kunde' : first} · gesendet ${time(done)}`) : stepLabel(p)}
                        {!done && optionalOf(p) && <span className="font-normal text-muted-foreground"> · optional</span>}
                      </p>
                      {!done && !open && can(p.side) && (
                        <button type="button" className="text-xs text-primary hover:underline" onClick={() => setActive(p.side)}>{optionalOf(p) ? 'Ja, schreiben' : 'Jetzt'}</button>
                      )}
                    </div>
                    {open && p.side === 'call' && (
                      <>
                        {item.candidatePhone ? (
                          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" asChild><a href={`tel:${item.candidatePhone}`}><Phone className="h-3 w-3" />{item.candidatePhone}</a></Button>
                        ) : <p className="text-xs text-muted-foreground">Keine Telefonnummer hinterlegt.</p>}
                        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Was kam raus?</p>
                        <div className="flex flex-wrap gap-1.5">
                          {outcomes.map(o => (
                            <Button key={o.key} size="sm" variant={outcome === o.key ? 'default' : 'outline'} className="h-7 text-xs" disabled={sending} onClick={() => pickOutcome(o.key)}>{o.label}</Button>
                          ))}
                        </div>
                        {!optIn && (
                          <Textarea value={callNote} onChange={e => setCallNote(e.target.value)} placeholder="Notiz, eine Zeile …" rows={2} className="text-sm" />
                        )}
                        {outcome === 'will_nicht' && (
                          <div className="space-y-1.5">
                            <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder={`Warum will ${first} nicht? Der Kunde sieht den Grund.`} rows={2} className="text-sm" />
                            <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={sending} onClick={declineForCandidate}>Für {first} absagen</Button>
                            <p className="text-xs text-muted-foreground">Die Einladung ist damit abgesagt. Der Kunde bekommt die übliche Mail, dass {first} das Interview abgelehnt hat.</p>
                          </div>
                        )}
                        {outcome === 'zeit' && allowAlt && (
                          <p className="text-xs text-muted-foreground">{first} kann in der Einladung selbst „Andere Zeit“ wählen. Sag es {first} am Telefon oder per Mail.</p>
                        )}
                      </>
                    )}
                    {open && p.side === 'done' && (
                      <p className="text-xs text-muted-foreground">Wenn es erledigt ist: unten „Erledigt“.</p>
                    )}
                    {!can(p.side) && !done && (
                      <p className="text-xs text-muted-foreground">{p.side === 'candidate' ? `Keine E-Mail von ${first} hinterlegt. Ruf an.` : 'Hier nicht möglich.'}</p>
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
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hinweis mitgeben</p>
                            <div className="flex flex-wrap gap-1.5">
                              {set.clientHints.map(c => (
                                <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => { setHints(h => toggle(h, c.key)); setClientEdit(null); }}>{c.label}</Button>
                              ))}
                            </div>
                          </>
                        )}
                        <Textarea value={clientText} onChange={e => setClientEdit(e.target.value)} placeholder="Wähle eine Bitte oder schreib selbst." rows={4} className="text-sm" />
                        <p className="text-[11px] text-muted-foreground">Die Mail beginnt mit „Guten Tag …“ und dem Bezug zur Stelle, danach kommt dein Text, am Ende dein Gruß.</p>
                        <p className="text-xs text-muted-foreground">Geht als Benachrichtigung ins Kunden-Dashboard und als Mail. Vor Opt-In nur das Bewerber-Kürzel, kein Name.</p>
                        <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !clientText} onClick={() => send('client')}>
                          <Mail className="h-3 w-3" />{item.taskCategory === 'offer_counter_stalled' ? 'Kunden erinnern' : 'An den Kunden senden'}
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
                          <p className="mb-1">Hallo {first},</p>
                          <Textarea value={candidateText} onChange={e => setCandEdit(e.target.value)} placeholder="Wähle einen Satz oder schreib selbst." rows={5} className="text-sm" />
                          <p className="mt-1 whitespace-pre-line text-muted-foreground">{`Viele Grüße\n${meFirst}`}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Mail über Matchunt mit deinem Namen, Antworten landen bei dir. Kein Firmenname vor Reveal.</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || !candidateText} onClick={() => send('candidate')}>
                            <Mail className="h-3 w-3" />An {first} senden
                          </Button>
                          {!plan.some(x => x.side === 'call') && (
                            <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={called}>
                              <Phone className="h-3 w-3" />Angerufen
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
                <p className="text-xs leading-5 text-muted-foreground">{declined ? 'Erledigt: Die Einladung ist abgesagt, der Kunde ist informiert.' : after}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-4 text-xs">
          <span className="text-muted-foreground">Ziel heute: <span className="font-medium text-emerald-500">{guide.goal}</span></span>
          <div className="flex flex-wrap items-center gap-1.5">
            <LaterMenu onPick={until => onLater(item, until)} />
            {item.candidatePhone && guide.primary.kind !== 'call' && guide.primary.kind !== 'followup' && (
              <Button size="sm" variant="outline" className="h-8 text-xs" asChild><a href={`tel:${item.candidatePhone}`}><Phone className="mr-1 h-3 w-3" />Anrufen</a></Button>
            )}
            {item.submissionId && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/recruiter/submissions/${item.submissionId}`)}>Einreichung</Button>
            )}
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onDetail(item)}>Details</Button>
            {(guide.primary.kind === 'call' || guide.primary.kind === 'followup') && !plan.some(p => p.side === 'call') && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                <Phone className="h-3 w-3" />{guide.primary.kind === 'call' ? 'Anrufen' : 'Nachgefasst'}
              </Button>
            )}
            {(guide.primary.kind === 'debrief' || guide.primary.kind === 'done' || guide.primary.kind === 'offer' || guide.primary.kind === 'recommend' || guide.primary.kind === 'contract') && (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
                {guide.primary.label}
              </Button>
            )}
            {sentCount > 0 && <Button size="sm" className="h-8 text-xs" onClick={onClose}>Fertig</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function LaterMenu({ onPick }: { onPick: (until: Date) => void }) {
  const [open, setOpen] = useState(false);
  const evening = new Date(); evening.setHours(18, 0, 0, 0);
  const tomorrow = new Date(Date.now() + DAY_MS); tomorrow.setHours(9, 0, 0, 0);
  const threeDays = new Date(Date.now() + 3 * DAY_MS); threeDays.setHours(9, 0, 0, 0);
  return (
    <span className="relative">
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(o => !o)}>Später</Button>
      {open && (
        <span className="absolute right-0 z-20 mt-1 flex flex-col rounded-md border border-border bg-popover p-1 shadow-md">
          {[['Heute Abend', evening], ['Morgen', tomorrow], ['3 Tage', threeDays]].map(([label, d]) => (
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
  const [outcome, setOutcome] = useState<string | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { setOutcome(null); setNote(''); }, [state?.item.itemId]);
  if (!state) return null;
  const isFollowup = state.guide.primary.kind === 'followup';
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isFollowup ? 'Nachgefasst?' : 'Erreicht?'}</DialogTitle>
          <DialogDescription>{state.item.candidateName || state.item.title} · {state.item.jobTitle}</DialogDescription>
        </DialogHeader>
        {state.guide.reachedOptions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.guide.reachedOptions.map(o => (
              <Button key={o} size="sm" variant={outcome === o ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setOutcome(outcome === o ? null : o)}>{o}</Button>
            ))}
          </div>
        )}
        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz, eine Zeile …" rows={2} className="text-sm" />
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onConfirm(false, null, note)}>Nicht erreicht · in 2 Std. erneut</Button>
          <Button size="sm" onClick={() => onConfirm(true, outcome, note)}>{isFollowup ? 'Ja, nachgefasst' : 'Ja, erreicht'}</Button>
        </div>
        <p className="text-xs text-muted-foreground">Die Antwort landet als Beleg im Aktivitätslog. „Ja“ schließt die Zeile; sie kommt wieder, wenn sich am Deal nichts ändert.</p>
      </DialogContent>
    </Dialog>
  );
}

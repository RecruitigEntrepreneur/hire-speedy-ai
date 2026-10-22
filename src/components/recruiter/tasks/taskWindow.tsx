// Aufgaben-Fenster und Handgriffe, gemeinsam für die Seite „Aufgaben“ (RecruiterHeute)
// und das Kandidatenprofil (Entscheidung 14.10.2026: Klick auf eine Aufgabe im
// Dashboard führt ins Kandidatenprofil, dort öffnet sich die Aufgabe).
// Aus RecruiterHeute.tsx herausgelöst, Inhalt unverändert.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TaskDetailDialog, type TaskDetailItem } from '@/components/influence/TaskDetailDialog';
import { notifyTasksChanged, type UnifiedTaskItem } from '@/hooks/useUnifiedTaskInbox';
import { useActivityLogger } from '@/hooks/useCandidateActivityLog';
import { messageSetFor, composeClientText, composeCandidateText } from '@/lib/aufgabenTexte';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { Lock, Mail, NotebookPen, Phone } from 'lucide-react';
import { NachgespraechWindow, nachTargetFromItem, type NachTarget } from './NachgespraechWindow';
import { OfferAnswerDialog } from '@/components/offers/OfferAnswerDialog';
import { RecommendationDialog } from '@/components/offers/RecommendationDialog';
import { Honorar } from '@/components/recruiter/Honorar';

export const DAY_MS = 86_400_000;

export type Kind = 'call' | 'followup' | 'debrief' | 'done' | 'akte' | 'client' | 'candidate' | 'offer' | 'recommend';

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
  if (cat === 'interview_debrief_due') {
    // Nachgespräch statt Debrief (20.10.2026): zuerst hören, was der Kandidat sagt.
    const h = hoursSince(item.createdAt);
    return {
      pill: 'Nachgespräch',
      advice: `${satz(`Interview war ${h < 48 ? `vor ${h} Std.` : `am ${dateDe(item.createdAt)}`}`)} Ruf ${first} an, solange es frisch ist.`,
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
    // Angebot über den Headhunter (22.10.2026): überbringen und Antwort eintragen
    const considering = item.title.startsWith('Kandidat überlegt');
    // Kalendertage bis zur Frist (heute = 0)
    const berlinDay = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const left = item.dueAt ? Math.round((Date.parse(`${berlinDay(new Date(item.dueAt).getTime())}T12:00:00Z`) - Date.parse(`${berlinDay(Date.now())}T12:00:00Z`)) / DAY_MS) : null;
    const frist = left === null ? '' : left < 0 ? 'Frist abgelaufen.' : left === 0 ? 'Antwort heute fällig.' : `Noch ${left} ${left === 1 ? 'Tag' : 'Tage'}.`;
    return {
      pill: 'Angebot',
      advice: considering ? `${first} überlegt noch. ${frist} Nachfassen und Antwort eintragen.` : `Der Kunde macht ${first} ein Angebot. ${frist} Ruf ${first} an.`,
      facts: [
        `Angebot für ${job}${item.companyName ? ` bei ${item.companyName}` : ''}.`,
        item.dueAt ? satz(`Antwort bis ${dateDe(item.dueAt)}`) : '',
        fee ? `Honorar bei Abschluss: ${fee}.` : '',
      ].filter(Boolean),
      consequence: 'Liegt ein Angebot zu lange, kommt das Gegenangebot des Arbeitgebers zuerst.',
      steps: [
        { text: `${first} anrufen und das Angebot durchgehen.`, hint: 'Gehalt, Start, Extras. Was fehlt noch für eine Zusage?' },
        { text: 'Antwort eintragen: Zusage, überlegt noch, Gegenwunsch oder Absage.' },
      ],
      goal: 'Antwort eingetragen',
      primary: { label: 'Antwort eintragen', kind: 'offer' },
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
  if (cat === 'offer_counter_stalled') {
    const d = daysSince(item.createdAt);
    return {
      pill: 'Gegenwunsch',
      advice: `Der Kunde antwortet seit ${d} Tagen nicht auf ${first}s Gegenwunsch. Nachfassen.`,
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
    return {
      pill: 'Eigene',
      advice: item.description || item.title,
      facts: [item.dueAt ? satz(`Fällig am ${dateDe(item.dueAt)}`) : 'Ohne Datum.'],
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
  /** Aufgaben mit eigenem Fenster direkt öffnen; true = erledigt. */
  const openOwnWindow = (it: UnifiedTaskItem) => {
    if (it.taskCategory === 'interview_debrief_due') { setNach({ target: nachTargetFromItem(it), item: it }); return true; }
    if (it.taskCategory === 'offer_deliver' && it.submissionId) { setOfferFor(it.submissionId); return true; }
    if (it.taskCategory === 'recommendation_due' && it.submissionId) { setRecFor(it.submissionId); return true; }
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
      case 'call':
        if (item.candidatePhone) window.location.href = `tel:${item.candidatePhone}`;
        setReached({ item, guide });
        return;
      case 'followup':
        setReached({ item, guide });
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
    const failure = error?.message || (data && (data as any).error) || (data && (data as any).message && !(data as any).ok ? (data as any).message : null);
    if (failure) {
      const msg = typeof failure === 'string' ? failure : 'Senden fehlgeschlagen.';
      toast.error(/Failed to send a request/i.test(msg) ? 'Senden nicht möglich: Die Function „recruiter-notify“ ist noch nicht deployt.' : msg);
      return false;
    }
    if (action === 'client_nudge') {
      toast.success(`Kunde erinnert (${(data as any)?.recipients ?? 1} Empfänger). Die Zeile ruht bis zur Antwort.`);
      await snooze(item.itemType, item.itemId, new Date(Date.now() + 3 * DAY_MS));
    } else {
      toast.success('Nachricht gesendet.');
      if (item.taskCategory === 'rejected_inform') await markDone(item.itemType, item.itemId);
      else await snooze(item.itemType, item.itemId, new Date(Date.now() + DAY_MS));
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
    if (yes) {
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
    const it = /^derived-(debrief|offer|recommend)-/.test(itemId) ? allItems.find(i => i.itemId === itemId) : null;
    if (it && openOwnWindow(it)) return true;
    const g = groups.find(x => x.primary.itemId === itemId || x.others.some(o => o.itemId === itemId));
    if (g) openGroupKey(g.key);
    return !!g;
  };

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
        group={groups.find(g => g.key === windowKey) ?? null}
        initialTab={windowTab}
        onSend={sendMessage}
        onClose={() => setWindowKey(null)}
        onAct={(item, guide) => { setWindowKey(null); act(item, guide); }}
        onLater={(item, until) => { setWindowKey(null); later(item, until); }}
        onDetail={item => { setWindowKey(null); openDetail(item); }}
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
    </>
  );

  return { act, later, openDetail, openItem, setWindowKey: openGroupKey, host };
}

/** Die Aufgabe als Fenster: Grund, Deine Aufgabe, Ziel, Knöpfe. Die Liste bleibt kompakt. */
export function TaskWindow({ group, initialTab, onSend, onClose, onAct, onLater, onDetail }: {
  group: PersonGroup | null;
  initialTab: 'client' | 'candidate';
  onSend: (item: UnifiedTaskItem, action: 'client_nudge' | 'candidate_message', text: string, meta: Record<string, unknown>) => Promise<boolean>;
  onClose: () => void;
  onAct: (item: UnifiedTaskItem, guide: Guide) => void;
  onLater: (item: UnifiedTaskItem, until: Date) => void;
  onDetail: (item: UnifiedTaskItem) => void;
}) {
  const navigate = useNavigate();
  const item = group?.primary ?? null;
  const [tab, setTab] = useState<'client' | 'candidate'>(initialTab);
  const [intent, setIntent] = useState<string | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [candKeys, setCandKeys] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<{ title: string; created_at: string; activity_type: string }[]>([]);
  const set = useMemo(() => item ? messageSetFor(item.taskCategory, { jobTitle: item.jobTitle, firstName: firstName(item.candidateName) }) : null, [item?.itemId, item?.taskCategory, item?.jobTitle, item?.candidateName]);
  useEffect(() => {
    setTab(initialTab);
    setIntent(set?.clientIntents[0]?.key ?? null);
    setHints([]);
    setCandKeys(set?.candidate[0] ? [set.candidate[0].key] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.itemId, initialTab]);
  useEffect(() => {
    if (!item?.submissionId) { setHistory([]); return; }
    supabase
      .from('candidate_activity_log')
      .select('title, created_at, activity_type')
      .eq('related_submission_id', item.submissionId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setHistory((data ?? []) as any));
  }, [item?.submissionId]);
  if (!group || !item || !set) return null;
  const guide = buildGuide(item);
  const fee = euro(item.feeValue);
  const first = firstName(item.candidateName);
  const clientText = composeClientText(set, intent, hints);
  const candidateText = composeCandidateText(set, candKeys);
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]);
  const canClient = !!item.submissionId && set.clientIntents.length > 0;
  const canCandidate = !!item.submissionId && !!item.candidateEmail && set.candidate.length > 0;
  const send = async () => {
    setSending(true);
    const ok = tab === 'client'
      ? await onSend(item, 'client_nudge', clientText, { intent, hints })
      : await onSend(item, 'candidate_message', candidateText, { kind: candKeys.join(','), subject: set.candidateSubject });
    setSending(false);
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="gap-0 p-0 sm:max-w-3xl">
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
                  {history.map((h, i) => <li key={i} className="flex gap-2"><span className="w-12 shrink-0 text-muted-foreground tabular-nums">{dateDe(h.created_at)}</span><span>{h.title}</span></li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="mb-2 inline-flex rounded-md border border-border/60 bg-background p-0.5 text-xs">
              <button type="button" disabled={!canClient} className={cn('rounded px-2.5 py-1', tab === 'client' ? 'bg-accent text-foreground' : 'text-muted-foreground', !canClient && 'opacity-40')} onClick={() => setTab('client')}>An den Kunden</button>
              <button type="button" disabled={!canCandidate} className={cn('rounded px-2.5 py-1', tab === 'candidate' ? 'bg-accent text-foreground' : 'text-muted-foreground', !canCandidate && 'opacity-40')} onClick={() => setTab('candidate')}>An {first}</button>
            </div>
            {tab === 'client' ? (
              <>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Was möchtest du?</p>
                <div className="flex flex-wrap gap-1.5">
                  {set.clientIntents.map(c => (
                    <Button key={c.key} size="sm" variant={intent === c.key ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setIntent(c.key)}>{c.label}</Button>
                  ))}
                </div>
                {set.clientHints.length > 0 && (
                  <>
                    <p className="mb-1 mt-3 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hinweis mitgeben</p>
                    <div className="flex flex-wrap gap-1.5">
                      {set.clientHints.map(c => (
                        <Button key={c.key} size="sm" variant={hints.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setHints(h => toggle(h, c.key))}>{c.label}</Button>
                      ))}
                    </div>
                  </>
                )}
                <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{clientText || 'Wähle eine Bitte.'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Geht als Benachrichtigung ins Kunden-Dashboard und als Mail. Vor Opt-In nur das Bewerber-Kürzel, kein Name. Höchstens einmal in drei Tagen.</p>
              </>
            ) : (
              <>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Was soll {first} wissen?</p>
                <div className="flex flex-wrap gap-1.5">
                  {set.candidate.map(c => (
                    <Button key={c.key} size="sm" variant={candKeys.includes(c.key) ? 'default' : 'outline'} className="h-7 text-xs" onClick={() => setCandKeys(k => toggle(k, c.key))}>{c.label}</Button>
                  ))}
                </div>
                <p className="mt-3 rounded-md border border-dashed border-border px-3 py-2 text-sm italic text-foreground/90">{candidateText ? `Hallo ${first}, ${candidateText}` : 'Wähle einen Satz.'}</p>
                <p className="mt-2 text-xs text-muted-foreground">Mail über Matchunt mit deinem Namen, Antworten landen bei dir. Kein Firmenname vor Reveal.</p>
              </>
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
            {(guide.primary.kind === 'call' || guide.primary.kind === 'followup') && (
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                <Phone className="h-3 w-3" />{guide.primary.kind === 'call' ? 'Anrufen' : 'Nachgefasst'}
              </Button>
            )}
            {guide.primary.kind === 'debrief' || guide.primary.kind === 'done' || guide.primary.kind === 'offer' || guide.primary.kind === 'recommend' ? (
              <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => onAct(item, guide)}>
                {guide.primary.kind === 'debrief' && <NotebookPen className="h-3 w-3" />}
                {guide.primary.label}
              </Button>
            ) : (
              <Button size="sm" className="h-8 gap-1 text-xs" disabled={sending || (tab === 'client' ? !clientText || !canClient : !candidateText || !canCandidate)} onClick={send}>
                <Mail className="h-3 w-3" />{tab === 'client' ? 'An den Kunden senden' : `An ${first} senden`}
              </Button>
            )}
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

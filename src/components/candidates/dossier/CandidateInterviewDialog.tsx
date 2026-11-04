import { Fragment, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Phone, Sparkles, Star, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  CHANGE_READINESS_OPTIONS,
  DISCUSSED_OPTIONS,
  DossierForm,
  INTERVIEW_TYPE_OPTIONS,
  LEADERSHIP_OPTIONS,
  NON_COMPETE_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  RELOCATION_OPTIONS,
  RECOMMENDATION_OPTIONS,
  WOULD_STAY_OPTIONS,
  CLIENT_SUMMARY_KEYS,
  autoClientSummary,
  buildClientSummary,
  changeEvidence,
  computeReadiness,
  abschlussGaps,
  rahmenGaps,
  type ClientSummary,
} from '@/lib/candidateDossier';
import {
  DIDNT_WORK_OPTIONS,
  PROCESS_ISSUE_OPTIONS,
  TIMEFRAME_OPTIONS,
  WORKED_OPTIONS,
  actionsTaken,
  careerDirections,
  locationSuggestions,
  phrasesOf,
} from '@/lib/interviewSuggestions';
import { ALL_GOALS, careerGoalSuggestions } from '@/lib/careerGoals';
import { ASK_NON_COMPETE, FAMILY_CHIPS, NOTICE_HINT, detectRoleFamily, isLeaderTitle } from '@/lib/roleFamily';
import { clientMotivation, earlierGeneratedMotivation, evaluateMotiveFields, incidentHasEvent, incidentParts, incidentSentence, incidentSuggestions, isAutoWhyNow, isOldAutoMotivation, joinMotivation, legacyAddonFields, motiveLabels, splitMotivation, type MotiveFlow } from '@/lib/situationMotives';
import { careerSignals, yearsLabel, type CareerHook, type CareerStation, type SignalStation } from '@/lib/careerSignals';
import { clientTextIssues, type ClientTextField } from '@/lib/clientTextCheck';
import { quickExtract, type CaptureSuggestion } from '@/lib/quickExtract';
import { buildReview, freshText, fromAiFields, mergeSuggestions, type ReviewItem } from '@/lib/captureReview';
import {
  INTERVIEW_VIEWS,
  ROLLE_FIELDS,
  clearInterviewPosition,
  clearLocalCopy,
  firstOpenView,
  isAfterCall,
  markInterviewOpen,
  pickTermin,
  readInterviewLayout,
  readInterviewPosition,
  readLocalCopy,
  resumedElapsed,
  terminArt,
  terminDatum,
  viewAnswered,
  viewIndex,
  viewOfField,
  writeInterviewLayout,
  writeInterviewPosition,
  writeLocalCopy,
  wunschBand,
  type InterviewLayout,
  type InterviewViewKey,
} from '@/lib/interviewViews';
import type { DossierSaveResult } from '@/hooks/useCandidateDossier';
import { useErstgespraeche } from '@/components/recruiter/termin/Erstgespraeche';
import { InterviewInsightsCard } from '../client/ClientCandidateCards';
import type { InterviewInsights } from '../client/useCandidateInsights';
import type { EditFocus } from './CandidateEditSheet';
import { ChipGroup, Field, FieldMissingContext, FieldQuestionContext, NumberField, PhraseChips, TagInput, TextField, fieldId, focusDossierField } from './DossierFields';
import { CareerGoalBlock, ClientMotivationField, IncidentBlock, MotiveBlock } from './MotiveBlock';
import {
  ArbeitsortBlock,
  ArbeitserlaubnisBlock,
  GehaltBlock,
  RolleBlock,
  SperrlisteBlock,
  SprachenBlock,
  VerfuegbarkeitBlock,
} from './DossierBlocks';

// Live-Interview: der Headhunter führt das Gespräch jetzt und geht die Fragen
// direkt mit dem Kandidaten durch. Kein Leitfaden, keine Skripte (die kommen
// in die Akademie). Bekanntes ist vorausgefüllt, links stehen fünf Punkte und der
// Abschluss, rechts die freie Notiz mit Erkennung beim Tippen. Ruhig gehalten
// (02.11.2026: „gelb grün … überfordert“): Gelb nur, wo jetzt etwas zu tun ist.

const NEXT_QUESTION: Record<string, string> = {
  kontakt: 'Wie erreiche ich Sie am besten, per Mail oder Telefon?',
  rolle: 'Was machen Sie aktuell genau, und seit wie vielen Jahren?',
  skills: 'Mit welchen Tools und Themen arbeiten Sie täglich?',
  gehalt: 'Welches Jahresgehalt stellen Sie sich vor?',
  verfuegbarkeit: 'Wie lang ist Ihre Kündigungsfrist?',
  motivation: 'Was ist für Sie der wichtigste Grund für einen Wechsel?',
  change_motivation: 'Was ist für Sie der wichtigste Grund für einen Wechsel?',
  expected_salary: 'Welches Jahresgehalt stellen Sie sich vor?',
  notice_period: 'Wie lang ist Ihre Kündigungsfrist?',
  einschaetzung: 'Deine Einschätzung fehlt noch (Abschluss).',
  why_now: 'Was ist jetzt anders als vor einem Jahr?',
  interview_type: 'Telefon, Video oder vor Ort? Oben im Kopf wählen.',
  interview_date: 'Wann war das Gespräch? Oben im Kopf.',
  arbeitsmodell: 'Wie möchten Sie arbeiten: vor Ort, hybrid oder remote?',
  wohnort: 'Wo wohnen Sie aktuell?',
  pendeln: 'Wie lange darf der Arbeitsweg höchstens dauern?',
  sprachen: 'Welche Sprachen sprechen Sie, und wie gut?',
};

/**
 * Wo eine fehlende Angabe steht, damit „fehlt“ dorthin springt: „frage“ = in einem
 * Punkt, „kopf“ = Datum und Gesprächsart oben, „akte“ = steht nicht im Interview.
 */
const WHERE: Record<string, { ort: 'frage' | 'kopf' | 'akte'; field: string }> = {
  interview_date: { ort: 'kopf', field: 'interview_date' },
  interview_type: { ort: 'kopf', field: 'interview_type' },
  change_motivation: { ort: 'frage', field: 'change_motivation' },
  motivation: { ort: 'frage', field: 'change_motivation' },
  why_now: { ort: 'frage', field: 'specific_incident' },
  rolle: { ort: 'frage', field: 'job_title' },
  expected_salary: { ort: 'frage', field: 'expected_salary' },
  gehalt: { ort: 'frage', field: 'expected_salary' },
  notice_period: { ort: 'frage', field: 'notice_period' },
  verfuegbarkeit: { ort: 'frage', field: 'notice_period' },
  einschaetzung: { ort: 'frage', field: 'recommendation' },
  kontakt: { ort: 'akte', field: 'email' },
  skills: { ort: 'akte', field: 'skills' },
  kundentexte: { ort: 'frage', field: 'summary_motivation' },
  // Rahmen fürs Matching (19.10.2026), Pflicht zum Abschließen
  arbeitsmodell: { ort: 'frage', field: 'remote_preference' },
  wohnort: { ort: 'frage', field: 'city' },
  pendeln: { ort: 'frage', field: 'max_commute_minutes' },
  sprachen: { ort: 'frage', field: 'languages' },
};

/** Name des Kundentexts in Hinweisen am Abschluss. */
const CLIENT_TEXT_LABEL: Record<ClientTextField, string> = {
  summary_motivation: 'Warum wechseln',
  summary_salary: 'Gehaltsrahmen',
  summary_notice: 'Verfügbarkeit',
  summary_key_requirements: 'Key Requirements',
  summary_cultural_fit: 'Cultural Fit',
  expose_summary: 'Kurzprofil',
  expose_highlights: 'Highlights',
};

const TERMIN_TAG = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', day: 'numeric', month: 'numeric' });
const TERMIN_ZEIT = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' });
/** „Di, 3.11. um 14:00“ */
const terminText = (iso: string) => `${TERMIN_TAG.format(new Date(iso)).replace('.,', ',')} um ${TERMIN_ZEIT.format(new Date(iso))}`;

const monthYear = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const uniqChips = (...lists: string[][]) => {
  const seen = new Set<string>();
  return lists.flat().filter((x) => { const k = x.toLowerCase(); if (!x || seen.has(k)) return false; seen.add(k); return true; });
};

/** Hinweis aus dem Werdegang an einer Frage (nur für den Headhunter). */
function HookHint({ hooks }: { hooks: CareerHook[] }) {
  if (!hooks.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {hooks.map((h) => <span key={h.key} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">{h.context}</span>)}
    </div>
  );
}

/** Gelber Hinweis mit Lösung per Klick (Widerspruch zwischen Angaben). */
function FixHint({ text, actions }: { text: string; actions: { label: string; onClick: () => void }[] }) {
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{text}
      {actions.map((a) => <button key={a.label} type="button" className="underline underline-offset-2 hover:text-foreground" onClick={a.onClick}>{a.label}</button>)}
    </p>
  );
}

/** Aus „Was gefällt, was stört“ (Rolle heute) vorgemerkt für „Gehalt und Rahmen“. */
const FLOW_HINT: Record<MotiveFlow, string> = {
  gehalt: 'Aus „Rolle heute“: Geld ist ein Wechselgrund. Wunschgehalt genau erfragen.',
  leaver: 'Aus „Rolle heute“: Beteiligung. Rückkaufregeln beim Ausstieg klären.',
  kundenschutz: 'Aus „Rolle heute“: Kundenbeziehungen. Nach einer Kundenschutzklausel fragen.',
  pendeln: 'Aus „Rolle heute“: Der Arbeitsweg ist wichtig. Pendelzeit genau erfassen.',
  arbeitsmodell: 'Aus „Rolle heute“: Remote oder Flexibilität ist wichtig. Arbeitsmodell genau erfassen.',
};

/** Wofür die Frage gut ist, eine Zeile unter dem Label. */
const Why = ({ children }: { children: ReactNode }) => <p className="-mt-1 text-xs text-muted-foreground">{children}</p>;

// Lokales Datum: toISOString wäre UTC und zeigte zwischen 0 und 2 Uhr den Vortag.
const today = () => format(new Date(), 'yyyy-MM-dd');

function Phase({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {intro && <p className="mt-1 text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </div>
  );
}


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  form: DossierForm;
  pendingColumns: boolean;
  onSave: (form: DossierForm) => Promise<DossierSaveResult>;
  onComplete: () => Promise<void>;
  /** Kam über „Interview abschließen und einreichen“: nach dem Abschluss direkt weiter, ohne Karte. */
  directSubmit?: boolean;
  /** Knopf „Auf Stelle einreichen“ auf der Abschluss-Karte. */
  onSubmitToJob?: () => void;
  /** Knopf „Fehlendes eintragen“, wenn die Angabe nicht im Interview steht (Kontakt, Skills). */
  onEditMissing?: (focus: EditFocus) => void;
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/** Neuer Speicherversuch nach einem Fehler. */
const SAVE_RETRY_MS = 5000;

const uhrzeit = (d: Date | number) => new Date(d).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

export function CandidateInterviewDialog({ open, onOpenChange, candidateId, form, pendingColumns, onSave, onComplete, directSubmit = false, onSubmitToJob, onEditMissing }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<DossierForm>(form);
  // Eine Stelle für beide Darstellungen: Schritt für Schritt die Frage, sonst deren Phase.
  const [view, setView] = useState(0);
  const [layout, setLayout] = useState<InterviewLayout>('steps');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newColumnsPending, setNewColumnsPending] = useState(pendingColumns);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  // Gelbe Kante „fehlt“ am Feld erst nach einem Klick auf eine fehlende Angabe, nicht im ganzen Gespräch.
  const [zeigeFehlt, setZeigeFehlt] = useState(false);
  // Ohne Rolle in der Akte steht „Rolle heute“ ganz oben in Punkt 1 (die Ziel-Vorschläge hängen an der Rolle).
  const [rolleOben, setRolleOben] = useState(false);
  const [rueckkehr, setRueckkehr] = useState<{ savedAt: number | null } | null>(null);
  const [completedAtOpen, setCompletedAtOpen] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<CaptureSuggestion[]>([]);
  // Kundenprofil schreibt sich mit: zuletzt erzeugte Entwürfe und vom Headhunter geänderte Felder
  const lastSummaryRef = useRef<ClientSummary>(buildClientSummary(form));
  const [editedSummaries, setEditedSummaries] = useState<Set<keyof ClientSummary>>(new Set());
  const [formerEmployers, setFormerEmployers] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Werdegang aus der Akte (Stationen) und dem gespeicherten Lebenslauf-Text
  const [stations, setStations] = useState<CareerStation[]>([]);
  const [cvText, setCvText] = useState<string | null>(null);
  const [fromCv, setFromCv] = useState(false);
  const [editRolle, setEditRolle] = useState(false);
  const [editSprachen, setEditSprachen] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [hiddenHooks, setHiddenHooks] = useState<Set<string>>(new Set());
  const [startSaved, setStartSaved] = useState(false);
  const [busyFirm, setBusyFirm] = useState('');
  const lastMotivRef = useRef('');
  const autoBlockedRef = useRef(false);
  // „Wichtig ist“ folgt den Klicks, solange dort nichts Eigenes steht (ältere Top 3 bleiben).
  const wichtigFolgtRef = useRef(false);
  // Einmal ohne Wohnort gesehen, bleibt das Feld stehen (sonst verschwindet es beim Tippen).
  const wohnortFragen = useRef(false);
  const terminFertigRef = useRef<string | null>(null);

  const draftRef = useRef(draft);
  const versionRef = useRef(0);
  const timerRef = useRef<number>();
  const mainRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const baselineNotesRef = useRef('');
  // Erst mit der ersten Antwort entsteht ein Entwurf; bloßes Öffnen schreibt nichts.
  const touchedRef = useRef(false);
  const movedRef = useRef(false);
  const elapsedRef = useRef(0);
  const clockStoppedRef = useRef(false);
  const savedAtRef = useRef<number | null>(null);
  const viewRef = useRef(0);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);
  const writePosRef = useRef<() => void>(() => undefined);

  const stepMode = layout === 'steps';
  const currentView = INTERVIEW_VIEWS[view];

  // Gebuchter Termin von heute: Datum, Gesprächsart, Beitreten oder Anrufen und die Notiz des Kandidaten.
  const termine = useErstgespraeche({ candidateId });
  const termin = useMemo(() => (open ? pickTermin(termine.data ?? [], Date.now()) : null), [open, termine.data]);
  const terminStartRef = useRef(0);
  terminStartRef.current = termin ? Date.parse(termin.starts_at) : 0;

  // Beim Öffnen einmal übernehmen und dort weitermachen, wo der Headhunter war, sonst
  // bei der ersten offenen Frage. Danach nie mehr von außen überschreiben (sonst
  // verschluckt das Nachladen nach dem Speichern die Eingaben – der Fehler aus dem alten Interview).
  useEffect(() => {
    if (!open) return;
    const pos = user ? readInterviewPosition(user.id, candidateId) : null;
    const copy = readLocalCopy(candidateId);
    const start = copy ? { ...form, ...copy.draft } : form;
    setDraft(start);
    draftRef.current = start;
    baselineNotesRef.current = form.additional_notes;
    const completed = form.interview_status === 'completed';
    setCompletedAtOpen(completed);
    setLayout(completed ? 'all' : user ? readInterviewLayout(user.id) : 'steps');
    const startView = completed ? 0 : pos ? viewIndex(pos.view) : firstOpenView(form);
    setView(startView);
    viewRef.current = startView;
    setRueckkehr(pos && !completed ? { savedAt: pos.savedAt } : null);
    savedAtRef.current = pos?.savedAt ?? null;
    elapsedRef.current = completed ? 0 : resumedElapsed(pos, Date.now());
    setElapsed(Math.floor(elapsedRef.current));
    setFinished(false);
    setZeigeFehlt(false);
    setRolleOben(!start.job_title.trim());
    wohnortFragen.current = !start.city.trim();
    const wichtigAuto = evaluateMotiveFields(detectRoleFamily(start), start.current_positive, start.current_negative).weiter.wichtig;
    wichtigFolgtRef.current = !start.offer_requirements.length || [...start.offer_requirements].sort().join('|') === [...wichtigAuto].sort().join('|');
    terminFertigRef.current = null;
    setSaveState('idle');
    setAiSuggestions([]);
    setDismissed(new Set());
    setEditRolle(false);
    // Ohne Sprache in der Akte bleibt das Feld offen, sonst klappt es nach dem ersten Eintrag zu, bevor das Niveau gewählt ist.
    setEditSprachen(!start.languages.length);
    setOnlyMissing(false);
    setHiddenHooks(new Set());
    setStartSaved(false);
    setBusyFirm('');
    lastMotivRef.current = '';
    autoBlockedRef.current = false;
    touchedRef.current = !!copy;
    movedRef.current = false;
    versionRef.current = copy ? 1 : 0;
    markInterviewOpen(candidateId, true);
    if (copy) {
      toast.info('Nicht gespeicherte Eingaben übernommen', { description: `Stand von ${uhrzeit(copy.at)}. Wird jetzt gespeichert.` });
      schedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setNewColumnsPending(pendingColumns), [pendingColumns]);
  // Schritt für Schritt beginnt jeder Punkt oben; auf der langen Seite nur beim Wechsel der Darstellung.
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [stepMode ? view : -1, stepMode, onlyMissing, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // Die Uhr rechnet über Zeitstempel: Hintergrund-Tabs drosseln den Takt.
  const clockStopped = finished || (stepMode && isAfterCall(currentView.key));
  clockStoppedRef.current = clockStopped;
  useEffect(() => {
    if (!open) return;
    let last = Date.now();
    const t = window.setInterval(() => {
      const now = Date.now();
      // Mit Termin startet die Uhr mit dem Gespräch: zur gebuchten Zeit oder mit der ersten Antwort.
      const laeuft = !terminStartRef.current || now >= terminStartRef.current || touchedRef.current;
      if (!clockStoppedRef.current && laeuft) elapsedRef.current += (now - last) / 1000;
      last = now;
      setElapsed(Math.floor(elapsedRef.current));
    }, 1000);
    return () => window.clearInterval(t);
  }, [open]);

  const flush = async (): Promise<boolean> => {
    window.clearTimeout(timerRef.current);
    if (versionRef.current === 0 || !touchedRef.current) return true;
    const version = versionRef.current;
    setSaveState('saving');
    const result = await onSave(draftRef.current);
    if (!result.ok) {
      // Nichts geht verloren: Kopie im Tab, und es wird von selbst neu versucht.
      setSaveState('error');
      writeLocalCopy(candidateId, draftRef.current, Date.now());
      timerRef.current = window.setTimeout(() => { void flushRef.current(); }, SAVE_RETRY_MS);
      return false;
    }
    clearLocalCopy(candidateId);
    savedAtRef.current = Date.now();
    if (result.pendingColumns) setNewColumnsPending(true);
    if (versionRef.current === version) {
      versionRef.current = 0;
      setSaveState('saved');
      setSavedAt(new Date());
    } else {
      schedule();
    }
    return true;
  };
  flushRef.current = flush;

  const schedule = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { void flushRef.current(); }, 900);
  };

  /** Antwort des Headhunters: Ab hier gibt es einen Entwurf, mit Datum. */
  const set = (patch: Partial<DossierForm>) => {
    touchedRef.current = true;
    setRueckkehr(null);
    setDraft((d) => {
      const next = { ...d, ...patch, interview_date: patch.interview_date ?? d.interview_date ?? today() };
      draftRef.current = next;
      return next;
    });
    versionRef.current += 1;
    setSaveState('dirty');
    schedule();
  };

  /** Was sich von selbst füllt (Kundentexte, Sperrliste): wird erst mit der ersten Antwort gespeichert. */
  const setAuto = (patch: Partial<DossierForm>) => {
    setDraft((d) => {
      const next = { ...d, ...patch };
      draftRef.current = next;
      return next;
    });
    versionRef.current += 1;
    if (!touchedRef.current) return;
    setSaveState('dirty');
    schedule();
  };

  const writePos = () => {
    if (!user || !(touchedRef.current || movedRef.current) || draftRef.current.interview_status === 'completed') return;
    writeInterviewPosition(user.id, candidateId, { view: INTERVIEW_VIEWS[viewRef.current].key, at: Date.now(), elapsed: elapsedRef.current, savedAt: savedAtRef.current });
  };
  writePosRef.current = writePos;

  // Tab-Wechsel: nicht auf die 0,9 Sekunden warten. Neuladen: Stelle und Uhr bleiben.
  useEffect(() => {
    if (!open) return;
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      void flushRef.current();
      writePosRef.current();
    };
    const onLeave = () => writePosRef.current();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onLeave);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [open]);

  useEffect(() => () => {
    window.clearTimeout(timerRef.current);
    // Weg von der Seite innerhalb der App: nicht von selbst wieder öffnen. Neuladen kommt hier nicht vorbei.
    markInterviewOpen(candidateId, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readiness = useMemo(() => computeReadiness(draft), [draft]);
  const evidence = useMemo(() => changeEvidence(draft), [draft]);
  const firstName = draft.full_name.split(' ')[0] || 'die Person';

  // Was fehlt -- zum Abschließen (Mindestangaben und Rahmen fürs Matching, wie die
  // Datenbank beim Einreichen) und zusätzlich zum Einreichen. Gelb nur noch auf „Markt“
  // („Bevor du auflegst“), beim Abschluss und am Feld nach dem Klick darauf.
  const gaps = useMemo(() => abschlussGaps(draft), [draft]);
  if (!draft.city.trim()) wohnortFragen.current = true;
  const fuerEinreichen = useMemo(() => {
    const gapFields = new Set(gaps.map((g) => WHERE[g.key]?.field));
    return readiness.missing.filter((m) => m.key !== 'interview' && !gapFields.has(WHERE[m.key]?.field));
  }, [gaps, readiness]);
  // Mindestangaben da, aber „Interview abschließen“ noch nicht geklickt.
  const kannAbschliessen = gaps.length === 0 && !readiness.items.find((i) => i.key === 'interview')?.ok;
  const nurAbschliessen = kannAbschliessen && fuerEinreichen.length === 0;
  const missingFields = useMemo(() => {
    const out = new Set<string>();
    for (const k of [...gaps.map((g) => g.key), ...fuerEinreichen.map((m) => m.key)]) {
      if (k === 'rolle') {
        if (!draft.job_title.trim()) out.add('job_title');
        if (!((draft.experience_years ?? 0) > 0)) out.add('experience_years');
      } else if (WHERE[k]) out.add(WHERE[k].field);
    }
    return out;
  }, [gaps, fuerEinreichen, draft.job_title, draft.experience_years]);

  // Erkennung beim Tippen: Schnellerkennung auf der Notiz und der Notiz aus der Buchung, dazu KI-Vorschläge
  const terminNotiz = termin?.note?.trim() ?? '';
  const liveItems: ReviewItem[] = useMemo(() => {
    const fresh = freshText(draft.additional_notes, baselineNotesRef.current);
    const quick = [
      ...(terminNotiz ? quickExtract(terminNotiz, 'Notiz aus der Buchung').suggestions : []),
      ...(fresh.trim() ? quickExtract(fresh, 'Notiz').suggestions : []),
    ];
    return buildReview(draft, mergeSuggestions(aiSuggestions, quick))
      .filter((i) => i.status !== 'same' && !dismissed.has(`${i.key}:${i.display}`));
  }, [draft, aiSuggestions, dismissed, terminNotiz]);

  const applyItem = (i: ReviewItem) => set({ [i.key]: i.value } as Partial<DossierForm>);

  const goToView = (i: number) => {
    movedRef.current = true;
    viewRef.current = i;
    setView(i);
    setRueckkehr(null);
    setZeigeFehlt(false);
    writePos();
  };

  /** Klick links: zum Punkt, bei „Alle Fragen zeigen“ auf der Seite dorthin scrollen. */
  const openView = (i: number) => {
    setOnlyMissing(false);
    setFinished(false);
    goToView(i);
    if (!stepMode) {
      window.setTimeout(() => {
        document.querySelector(`[data-interview-point="${INTERVIEW_VIEWS[i].key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    }
  };

  const changeLayout = (next: InterviewLayout) => {
    setOnlyMissing(false);
    setLayout(next);
    if (user && !completedAtOpen) writeInterviewLayout(user.id, next);
  };

  /** Punkt eines Felds; die Rolle steht ohne Akte-Eintrag in Punkt 1. */
  const viewFor = (field: string) => (rolleOben && ROLLE_FIELDS.includes(field) ? 0 : viewOfField(field));

  /** Zur fehlenden Angabe springen: Punkt öffnen, Feld fokussieren und gelb markieren. */
  const jump = (key: string) => {
    const w = WHERE[key];
    if (!w || w.ort === 'akte') {
      toast.info('Steht nicht im Interview', { description: 'Kontakt und Skills ergänzt du in der Akte über „Bearbeiten“.' });
      return;
    }
    if (w.ort === 'kopf') {
      const el = document.getElementById(fieldId(w.field));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.matches('input') ? el : el?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
      return;
    }
    setOnlyMissing(false);
    setFinished(false);
    const target = viewFor(w.field);
    if (target >= 0) goToView(target);
    setZeigeFehlt(true);
    window.setTimeout(() => focusDossierField(w.field), 80);
  };

  /** „Nur Fehlendes“: im selben Blick zum Baustein, ohne die Ansicht zu verlassen. */
  const scrollToGap = (key: string) => {
    const w = WHERE[key];
    if (!w || w.ort !== 'frage') { jump(key); return; }
    focusDossierField(w.field);
  };

  // Beim Öffnen: Werdegang (Stationen, Lebenslauf-Text) laden, Entwurfsstand festhalten.
  useEffect(() => {
    if (!open) return;
    lastSummaryRef.current = buildClientSummary(form);
    Promise.all([
      supabase.from('candidate_experiences').select('id, job_title, company_name, start_date, end_date, is_current, location, description').eq('candidate_id', candidateId),
      supabase.from('candidates').select('cv_raw_text, import_source').eq('id', candidateId).maybeSingle(),
    ]).then(([ex, cand]) => {
      const rows = ((ex.data ?? []) as unknown) as CareerStation[];
      setStations(rows);
      setFormerEmployers(rows.map((r) => r.company_name ?? '').filter(Boolean));
      const c = cand.data as { cv_raw_text?: string | null; import_source?: string | null } | null;
      setCvText(c?.cv_raw_text ?? null);
      setFromCv(/cv/i.test(c?.import_source ?? ''));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, candidateId]);

  const signals = useMemo(() => careerSignals(stations, { cvText }), [stations, cvText]);
  // Werdegang rechts: Stationen von neu nach alt, Lücken genau dazwischen.
  type WerdegangRow = { kind: 'station'; st: SignalStation; short: number | null } | { kind: 'gap'; from: Date; to: Date; months: number };
  const werdegang = useMemo<WerdegangRow[]>(() => {
    const rows: { at: number; order: number; row: WerdegangRow }[] = signals.stations.slice(0, 6).map((st) => ({
      at: st.start?.getTime() ?? 0,
      order: 0,
      row: { kind: 'station', st, short: signals.shortStints.find((x) => x.company === st.company && x.title === st.title)?.months ?? null },
    }));
    for (const g of signals.gaps) rows.push({ at: g.to.getTime(), order: 1, row: { kind: 'gap', ...g } });
    return rows.sort((a, b) => b.at - a.at || a.order - b.order).map((r) => r.row);
  }, [signals]);
  const family = useMemo(() => detectRoleFamily(draft), [draft.job_title, draft.seniority, draft.leadership_scope]);
  const fam = FAMILY_CHIPS[family];
  const motives = useMemo(() => evaluateMotiveFields(family, draft.current_positive, draft.current_negative), [family, draft.current_positive, draft.current_negative]);
  const incidentSugs = useMemo(
    () => incidentSuggestions(draft.current_negative, { tenureYears: signals.tenureYears, newJob: signals.hooks.some((h) => h.key === 'new_job') }),
    [draft.current_negative, signals],
  );
  // Gibt es die Felder aus Migration 20261019100000 schon? Vorher werden alte Zusatzknöpfe
  // nicht umgezogen (sonst wären sie aus dem Text weg, aber nirgends gespeichert).
  const [envReady, setEnvReady] = useState<boolean | null>(null);
  useEffect(() => {
    if (!open) return;
    let off = false;
    void (supabase as unknown as { from: (t: string) => any }) // eslint-disable-line @typescript-eslint/no-explicit-any
      .from('candidate_interview_notes').select('company_size_pref').limit(1)
      .then(({ error }: { error: unknown }) => { if (!off) setEnvReady(!error); });
    return () => { off = true; };
  }, [open]);

  // „Bis wann?“ wird nicht mehr gefragt. Der CV-Import legt dort aber das Karriereziel ab: das bleibt sichtbar.
  const cvGoal = phrasesOf(draft.career_3_5_year_plan).filter((p) => !TIMEFRAME_OPTIONS.includes(p)).join(', ');

  // Vorschläge für das Karriereziel: aus Titel, Erfahrung, Führung, stört, Auslöser und Werdegang.
  const goalSugs = useMemo(() => careerGoalSuggestions({
    job_title: draft.job_title,
    experience_years: draft.experience_years,
    leadership_scope: draft.leadership_scope,
    leadership_team_size: draft.leadership_team_size,
    negative: motiveLabels(draft.current_negative, 'neg'),
    incidents: incidentParts(draft.specific_incident).events,
    career: { freelance: signals.freelance, formerLeaderOnly: signals.formerLeaderOnly, shortStints: signals.shortStints.length },
    family,
  }), [draft.job_title, draft.experience_years, draft.leadership_scope, draft.leadership_team_size, draft.current_negative, draft.specific_incident, signals, family]);

  // Ziele, die in den Kundentext fließen: nur angetippte Ziel-Knöpfe, nie freier Text.
  const goalChips = useMemo(() => {
    const known = new Set([...Object.keys(ALL_GOALS), ...careerDirections(draft), ...draft.target_roles]);
    return phrasesOf(draft.career_ultimate_goal).filter((p) => known.has(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.career_ultimate_goal, draft.target_roles, draft.job_title, draft.seniority, draft.leadership_scope, draft.experience_years]);
  const clientMotiv = useMemo(
    () => clientMotivation(family, draft.current_positive, draft.current_negative, draft.specific_incident, {
      companySize: draft.company_size_pref,
      industryChange: draft.industry_change,
      international: draft.international_pref,
      relocation: draft.relocation_willing,
      goals: goalChips,
    }),
    [family, draft.current_positive, draft.current_negative, draft.specific_incident, draft.company_size_pref, draft.industry_change, draft.international_pref, draft.relocation_willing, goalChips],
  );
  const flowHint = (...flows: MotiveFlow[]) => {
    const hits = flows.filter((f) => motives.weiter.phase3.includes(f));
    return hits.length ? <HookHint hooks={hits.map((f) => ({ key: f, field: '', context: FLOW_HINT[f] }))} /> : null;
  };
  const hooksAt = (field: string) => signals.hooks.filter((h) => h.field === field && !h.question);
  const extraHooks = signals.hooks.filter((h) => h.question && !hiddenHooks.has(h.key)).slice(0, 3);
  const textIssues = useMemo(() => clientTextIssues(draft), [draft]);
  const issuesFor = (field: ClientTextField) => textIssues.filter((i) => i.field === field);
  const leadSuggested = !draft.leadership_scope && isLeaderTitle(draft.job_title) ? 'disciplinary' : null;
  const remoteMismatch = draft.target_locations.some((l) => /remote/i.test(l)) && !draft.remote_preference;

  // „Warum gerade jetzt?“ (Pflicht) füllt sich aus dem Auslöser. Ein früher erfasster eigener
  // Text bleibt stehen und wird beim Auslöser als „früher notiert“ gezeigt.
  useEffect(() => {
    if (!open) return;
    const gen = incidentSentence(draft.specific_incident, incidentHasEvent(draft.specific_incident) ? draft.frequency_of_issues : null);
    if (draft.why_now.trim() !== gen && isAutoWhyNow(draft.why_now)) setAuto({ why_now: gen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.specific_incident, draft.frequency_of_issues]);

  // Wechselmotivation (Kundentext): vorn der Satz aus den Klicks, der mitzieht, hinten
  // die Ergänzung, die erhalten bleibt. Selbst geschriebener Text bleibt unangetastet.
  // Der frühere Automatik-Satz („Stört vor allem: …“) wird ersetzt.
  useEffect(() => {
    if (!open) return;
    const gen = clientMotiv.text;
    const cur = draft.change_motivation.trim();
    const last = lastMotivRef.current;
    // Zuletzt erzeugt (diese Sitzung) oder früher erzeugt (ältere Bausteine): dann darf er nachziehen.
    const fromLast = last ? splitMotivation(cur, last) : earlierGeneratedMotivation(cur);
    const fromGen = splitMotivation(cur, gen);
    // Frühere Zusatzknöpfe („Gerne im Mittelstand.“ …) werden zu Antworten in „Ziele“.
    const legacySource = fromLast.auto ? fromLast.addition : fromGen.auto ? fromGen.addition : cur;
    const legacy = legacySource ? legacyAddonFields(legacySource) : null;
    if (envReady && legacy && legacy.rest !== legacySource && (fromLast.auto || fromGen.auto || !legacy.rest)) {
      const patch: Partial<DossierForm> = {};
      if (legacy.env.companySize && !draft.company_size_pref) patch.company_size_pref = legacy.env.companySize;
      if (legacy.env.industryChange && !draft.industry_change) patch.industry_change = legacy.env.industryChange;
      if (legacy.env.international && !draft.international_pref) patch.international_pref = legacy.env.international;
      if (legacy.env.relocation && draft.relocation_willing == null) patch.relocation_willing = true;
      lastMotivRef.current = gen;
      setAuto({ ...patch, change_motivation: joinMotivation(gen, legacy.rest) });
      return;
    }
    if (gen && fromGen.auto) {
      lastMotivRef.current = gen;
    } else if (gen && (cur === '' || isOldAutoMotivation(cur) || fromLast.auto)) {
      lastMotivRef.current = gen;
      setAuto({ change_motivation: joinMotivation(gen, fromLast.auto ? fromLast.addition : '') });
    } else if (!gen && fromLast.auto) {
      lastMotivRef.current = '';
      setAuto({ change_motivation: fromLast.addition });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientMotiv.text, envReady]);

  // Wechselgrund-Themen sind nicht mehr sichtbar und ergeben sich aus den Stör-Knöpfen
  // (sonst landen alte Klicks unbemerkt im Kundenprofil unter „Legt Wert auf“).
  // Ohne Stör-Knöpfe bleiben sie, wie sie sind (z. B. aus „Aus dem Kopf“).
  useEffect(() => {
    if (!open || !motiveLabels(draft.current_negative, 'neg').length) return;
    const themen = motives.weiter.themen;
    const tags = draft.change_motivation_tags;
    if (themen.length !== tags.length || themen.some((t) => !tags.includes(t))) setAuto({ change_motivation_tags: themen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, motives.weiter.themen.join('|'), draft.change_motivation_tags.join('|')]);

  // „Wichtig ist“ beim Kunden und in der KI-Prüfung: Die Frage nach den Top 3 ist raus
  // (02.11.2026), die Zeile füllt sich aus „gefällt“ und „stört“, ohne Gehalt und Bonus.
  useEffect(() => {
    if (!open || !wichtigFolgtRef.current) return;
    const next = motives.weiter.wichtig;
    if (next.join('|') !== draft.offer_requirements.join('|')) setAuto({ offer_requirements: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, motives.weiter.wichtig.join('|')]);

  // Termin aus der Buchung: Datum und Gesprächsart stehen fest, einmal je Termin. Eigene Wahl bleibt.
  useEffect(() => {
    if (!open || !termin || terminFertigRef.current === termin.id || draftRef.current.interview_status === 'completed') return;
    terminFertigRef.current = termin.id;
    const patch: Partial<DossierForm> = {};
    if (!draftRef.current.interview_type) patch.interview_type = terminArt(termin);
    if (!draftRef.current.interview_date || !touchedRef.current) patch.interview_date = terminDatum(termin);
    if (Object.keys(patch).length) setAuto(patch);
  }, [open, termin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Der aktuelle Arbeitgeber steht automatisch auf „Nicht vorstellen bei“ (entfernbar).
  useEffect(() => {
    if (!open || autoBlockedRef.current) return;
    const c = draft.company.trim();
    if (!c) return;
    autoBlockedRef.current = true;
    if (!draft.blocked_companies.length) setAuto({ blocked_companies: [c] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.company]);

  // Gehaltstext für den Kunden nur aus den Klicks (Wunschgehalt, fix/gesamt), nie frei:
  // so können aktuelles Gehalt und Schmerzgrenze nicht hineinrutschen.
  useEffect(() => {
    if (!open) return;
    const gen = buildClientSummary(draft).summary_salary;
    if (draft.summary_salary !== gen) setAuto({ summary_salary: gen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.expected_salary, draft.salary_basis, draft.summary_salary]);

  /** Abgeleiteten Start der aktuellen Station dauerhaft in den Werdegang schreiben. */
  const saveDerivedStart = async () => {
    const cur = signals.current;
    if (!cur?.id || !cur.start) return;
    const iso = `${cur.start.getFullYear()}-${String(cur.start.getMonth() + 1).padStart(2, '0')}-01`;
    const { error } = await supabase.from('candidate_experiences').update({ start_date: iso, is_current: true } as never).eq('id', cur.id);
    if (error) { toast.error('Konnte das Startjahr nicht speichern'); return; }
    setStations((rows) => rows.map((r) => (r.id === cur.id ? { ...r, start_date: iso, is_current: true } : r)));
    setStartSaved(true);
  };

  // Kundenprofil: Entwürfe folgen den Antworten, selbst geänderte Felder bleiben.
  useEffect(() => {
    if (!open) return;
    const { patch, generated, edited } = autoClientSummary(draft, lastSummaryRef.current);
    lastSummaryRef.current = generated;
    setEditedSummaries((prev) => (prev.size === edited.size && [...edited].every((k) => prev.has(k)) ? prev : edited));
    if (Object.keys(patch).length) setAuto(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft]);

  const markMoment = () => {
    const stamp = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const notes = draftRef.current.additional_notes;
    set({ additional_notes: `${notes}${notes && !notes.endsWith('\n') ? '\n' : ''}★ ${stamp} ` });
    window.setTimeout(() => {
      const el = notesRef.current;
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
    }, 0);
  };

  const analyze = async () => {
    // Neu Getipptes zuerst; ohne neue Zeilen die ganze Notiz
    const all = draftRef.current.additional_notes;
    const notes = (freshText(all, baselineNotesRef.current).trim() || all).trim();
    if (!notes) { toast.info('Erst etwas in die Notiz schreiben'); return; }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-candidate-dossier', { body: { candidateId, sources: [{ label: 'Live-Notiz', text: notes }] } });
      if (error || !data?.success) throw error ?? new Error('fehlgeschlagen');
      setAiSuggestions(fromAiFields(data.fields ?? [], 'KI'));
    } catch {
      toast.info('Die KI-Auswertung ist gerade nicht verfügbar. Die Erkennung beim Tippen läuft trotzdem.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleClose = async (next: boolean) => {
    if (next) return onOpenChange(true);
    const ok = await flush();
    if (!ok) {
      toast.error('Die letzten Änderungen sind noch nicht gespeichert', { description: 'Bitte noch einmal versuchen oder die Verbindung prüfen.' });
      return;
    }
    writePos();
    markInterviewOpen(candidateId, false);
    if (touchedRef.current && draftRef.current.interview_status !== 'completed') {
      toast.success('Gespeichert', { description: `Beim nächsten Öffnen geht es bei „${INTERVIEW_VIEWS[viewRef.current].label}“ weiter.` });
    }
    onOpenChange(false);
  };

  const closeAfterFinish = () => {
    markInterviewOpen(candidateId, false);
    onOpenChange(false);
  };

  const complete = async () => {
    setCompleting(true);
    touchedRef.current = true;
    const ok = await flush();
    if (!ok) { setCompleting(false); toast.error('Speichern hat nicht geklappt'); return; }
    // Abschließen nur mit Mindestangaben und Rahmen (gleiche Regel wie die Datenbank beim Einreichen).
    const offen = abschlussGaps(draftRef.current);
    if (offen.length) {
      setCompleting(false);
      // Die gelbe Zeile über dem Knopf nennt alles Offene, der Klick führt zur ersten Lücke.
      jump(offen[0].key);
      return;
    }
    await onComplete();
    const notes = draftRef.current.additional_notes.trim();
    if (user && notes) {
      await supabase.from('candidate_capture_sources' as never).insert({
        candidate_id: candidateId, recruiter_id: user.id, kind: 'live', label: 'Live-Interview', raw_text: notes,
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      } as never).then(() => undefined, () => undefined);
    }
    setCompleting(false);
    if (user) clearInterviewPosition(user.id, candidateId);
    const nachher = computeReadiness({ ...draftRef.current, interview_status: 'completed' });
    if (directSubmit) {
      toast.success('Interview abgeschlossen', { description: nachher.isReady ? `${firstName} ist bereit zum Einreichen.` : `Noch offen: ${nachher.missing.map((m) => m.label).join(', ')}` });
      closeAfterFinish();
      return;
    }
    // Die Karte bleibt stehen, bis der Headhunter wählt.
    const fertig = { ...draftRef.current, interview_status: 'completed' };
    draftRef.current = fertig;
    setDraft(fertig);
    setFinished(true);
  };

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const saveLabel =
    saveState === 'saving' ? 'Speichert …'
    : saveState === 'dirty' ? 'Ungespeicherte Änderungen'
    : saveState === 'error' ? 'Nicht gespeichert'
    : savedAt ? `Gespeichert ${uhrzeit(savedAt)}`
    : 'Speichert automatisch';

  // ---- Bausteine, die in den Phasen und in „Nur Fehlendes“ gleich aussehen ----
  const motivationField = () => (
    <ClientMotivationField
      form={draft}
      set={set}
      motivation={clientMotiv}
      onRegenerate={() => { lastMotivRef.current = clientMotiv.text; set({ change_motivation: clientMotiv.text }); }}
    >
      <HookHint hooks={hooksAt('change_motivation')} />
    </ClientMotivationField>
  );

  // „Warum gerade jetzt?“ ist im Auslöser aufgegangen (Suchstatus-Knöpfe); why_now füllt sich daraus.
  const incidentField = () => (
    <IncidentBlock form={draft} set={set} family={family} suggestions={incidentSugs} whyNowNote={isAutoWhyNow(draft.why_now) ? '' : draft.why_now}>
      <HookHint hooks={[...hooksAt('specific_incident'), ...hooksAt('why_now')]} />
    </IncidentBlock>
  );

  const salaryField = () => (
    <div className="space-y-2">
      <p className="text-sm font-medium">Wo liegen Sie aktuell? Wo möchten Sie hin? Was ist Ihre Schmerzgrenze?</p>
      <Why>Der Kunde sieht nur das Wunschgehalt. Aktuelles Gehalt und Schmerzgrenze bleiben bei dir.</Why>
      <GehaltBlock form={draft} set={set} family={family} />
    </div>
  );

  const noticeField = () => <VerfuegbarkeitBlock form={draft} set={set} hint={NOTICE_HINT[family]} />;

  const recommendationField = () => (
    <div className="space-y-3">
      <Field label={`Würdest du ${firstName} empfehlen?`} field="recommendation">
        <Why>Deine eigene Einschätzung, nur intern. Nie vorausgewählt.</Why>
        <ChipGroup field="recommendation" options={RECOMMENDATION_OPTIONS} value={draft.recommendation} onChange={(v) => set({ recommendation: v })} />
      </Field>
      <Field label="Begründung (intern)" field="recommendation_notes">
        <Why>Warum du so entschieden hast, für dich und dein Team, nie für den Kunden.</Why>
        <PhraseChips field="recommendation_notes" options={uniqChips(fam.staerken, fam.risiken)} value={draft.recommendation_notes} onChange={(v) => set({ recommendation_notes: v })} placeholder="Ein Satz für das Besondere (optional)" />
      </Field>
    </div>
  );

  const rolleFact = () => {
    const cur = signals.current;
    const since = cur?.start ? cur.start.getFullYear() : null;
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">Rolle heute: aktuelle Rolle, Arbeitgeber, Berufserfahrung</p>
        <Why>Steht {fromCv ? 'im Lebenslauf' : 'in der Akte'}. Kurz bestätigen lassen, nicht neu erfragen.</Why>
        {editRolle || !draft.job_title.trim() ? (
          <RolleBlock form={draft} set={set} />
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[15px] font-medium leading-snug">{draft.job_title}</p>
              {(draft.company || since || draft.experience_years) && (
                <p className="mt-0.5 text-xs text-muted-foreground">{[draft.company, since ? `seit ${since}` : null, draft.experience_years ? `${draft.experience_years} Jahre Erfahrung` : null].filter(Boolean).join(' · ')}</p>
              )}
            </div>
            <div className="shrink-0 text-right text-xs leading-relaxed">
              <p className="text-muted-foreground">✓ {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}</p>
              <button type="button" className="text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setEditRolle(true)}>ändern</button>
            </div>
          </div>
        )}
        {cur?.startDerived && !startSaved && cur.id && (
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Startjahr {since} {cur.startDerived === 'cv_text' ? 'aus dem Lebenslauf-Text gelesen' : 'aus dem Ende der Station davor abgeleitet'}.
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => void saveDerivedStart()}>in den Werdegang übernehmen</button>
          </p>
        )}
      </div>
    );
  };

  const hookCards = () => extraHooks.length > 0 && (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Aus dem Werdegang</p>
      {extraHooks.map((h) => {
        const field = h.field as keyof DossierForm;
        const value = String(draft[field] ?? '');
        return (
          <div key={h.key} className="space-y-1.5 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{h.question}</p>
              <button type="button" aria-label="Ausblenden" className="text-muted-foreground hover:text-foreground" onClick={() => setHiddenHooks((s) => new Set(s).add(h.key))}><X className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-xs text-muted-foreground">{h.context}. Die Antwort landet {field === 'recommendation_notes' ? 'in deiner internen Begründung' : 'bei der passenden Frage'}.</p>
            <div className="flex flex-wrap gap-1.5">
              {(h.chips ?? []).map((c) => {
                const active = phrasesOf(value).some((p) => p.toLowerCase() === c.toLowerCase());
                return (
                  <button key={c} type="button" aria-pressed={active}
                    className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
                    onClick={() => {
                      const parts = phrasesOf(value);
                      const next = active ? parts.filter((p) => p.toLowerCase() !== c.toLowerCase()) : [...parts, c];
                      set({ [field]: next.join(', ') } as Partial<DossierForm>);
                    }}>
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const addBusyFirm = () => {
    const f = busyFirm.trim();
    if (!f) return;
    if (!draft.blocked_companies.some((b) => b.toLowerCase() === f.toLowerCase())) set({ blocked_companies: [...draft.blocked_companies, f] });
    setBusyFirm('');
    toast.success(`${f} steht jetzt unter „Nicht vorstellen bei“`);
  };

  // ---- Fragen: Schritt für Schritt und „Alle Fragen zeigen“ nutzen dieselben Bausteine ----
  const careerGoalField = () => (
    <Field label="Was wollen Sie in Ihrer Karriere ultimativ erreichen?" field="career_ultimate_goal">
      <Why>Danach suchst du Stellen aus und so stellst du die Person beim Kunden vor.</Why>
      <HookHint hooks={hooksAt('career_ultimate_goal')} />
      <CareerGoalBlock form={draft} set={set} suggestions={goalSugs} legacy={[...careerDirections(draft), ...draft.target_roles]} candidateId={candidateId} family={family} />
      {cvGoal && <p className="text-xs text-muted-foreground">Aus dem Lebenslauf: {cvGoal}</p>}
    </Field>
  );

  /* Ziel-Nachfragen: ohne eigene Überschrift und Einrückung, gleich wie die anderen Fragen. */
  const zielNachfragen = (collapsible: boolean) => (
    <>
      <Field label="Was haben Sie dafür schon getan?" field="career_actions_taken">
        <Why>Belegt, dass das Ziel ernst gemeint ist.</Why>
        <PhraseChips field="career_actions_taken" collapsible={collapsible} options={uniqChips(actionsTaken(draft), fam.getan)} suggested={actionsTaken(draft).filter((a) => a.startsWith('Weiterbildung:') || a.startsWith('Team von'))} value={draft.career_actions_taken} onChange={(v) => set({ career_actions_taken: v })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Was hat gut funktioniert?" field="career_what_worked">
          <Why>Was hat die Person bisher weitergebracht?</Why>
          <HookHint hooks={hooksAt('career_what_worked')} />
          <PhraseChips field="career_what_worked" collapsible={collapsible} options={uniqChips(fam.funktioniert, WORKED_OPTIONS).slice(0, 7)} value={draft.career_what_worked} onChange={(v) => set({ career_what_worked: v })} />
        </Field>
        <Field label="Was weniger?" field="career_what_didnt_work">
          <Why>Was hat gebremst? Das darf sich beim nächsten Job nicht wiederholen.</Why>
          <PhraseChips field="career_what_didnt_work" collapsible={collapsible} options={uniqChips(fam.weniger, DIDNT_WORK_OPTIONS).slice(0, 7)} value={draft.career_what_didnt_work} onChange={(v) => set({ career_what_didnt_work: v })} />
        </Field>
      </div>
    </>
  );

  const leadershipFields = (stacked: boolean) => (
    <div className={stacked ? 'space-y-4' : 'grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]'}>
      <Field label="Führungsverantwortung: Wie viele Menschen führen Sie disziplinarisch?" field="leadership_scope">
        <Why>Fachlich oder mit Personalverantwortung, und für wie viele. Entscheidet über passende Stellen.</Why>
        <ChipGroup field="leadership_scope" options={LEADERSHIP_OPTIONS} value={draft.leadership_scope} onChange={(v) => set({ leadership_scope: v })}
          suggested={leadSuggested} suggestedHint={`Vorschlag, weil Titel „${draft.job_title}“`} />
        {leadSuggested && <p className="text-xs text-primary">Vorschlag „Disziplinarisch“, weil Titel {draft.job_title}</p>}
      </Field>
      {draft.leadership_scope && draft.leadership_scope !== 'none' && (
        <Field label="Teamgröße" field="leadership_team_size">
          <div className="flex flex-wrap gap-1">
            {[5, 15, 50, 200, 250].map((n, i) => (
              <button key={n} type="button" onClick={() => set({ leadership_team_size: n })}
                className={cn('rounded-md border px-2 py-0.5 text-xs', draft.leadership_team_size === n ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                {['1–5', '6–15', '16–50', '51–200', 'über 200'][i]}
              </button>
            ))}
          </div>
          <NumberField field="leadership_team_size" value={draft.leadership_team_size} onChange={(v) => set({ leadership_team_size: v })} suffix="Personen" />
        </Field>
      )}
    </div>
  );

  /* Gegenangebot-Risiko nur bei einem echten Auslöser (sonst gibt es nichts „zu lösen“); schon Beantwortetes bleibt sichtbar. */
  const gegenangebotFields = () => (incidentHasEvent(draft.specific_incident) || draft.discussed_internally || draft.would_stay) && (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Haben Sie das intern angesprochen?" field="discussed_internally">
        <ChipGroup field="discussed_internally" options={DISCUSSED_OPTIONS} value={draft.discussed_internally} onChange={(v) => set({ discussed_internally: v })} />
      </Field>
      <Field label="Würden Sie bleiben, wenn Ihr Arbeitgeber das löst?" field="would_stay">
        <ChipGroup field="would_stay" options={WOULD_STAY_OPTIONS} value={draft.would_stay} onChange={(v) => set({ would_stay: v })} />
      </Field>
    </div>
  );

  /* Von der früheren Wunschstelle bleiben Zielorte und Umzug: Beides liest das Matching. */
  const zielorteFields = () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Zielorte" field="target_locations">
        <Why>Wo die nächste Stelle sein darf. Das Matching rechnet damit.</Why>
        <TagInput field="target_locations" values={draft.target_locations} onChange={(v) => set({ target_locations: v })} placeholder="Ort eintippen" suggestions={locationSuggestions(draft)} />
      </Field>
      <Field label="Umzug" field="relocation_willing">
        <Why>Für Stellen außerhalb der Pendelzeit.</Why>
        <ChipGroup field="relocation_willing" options={RELOCATION_OPTIONS} value={draft.relocation_willing == null ? null : draft.relocation_willing ? 'yes' : 'no'} onChange={(v) => set({ relocation_willing: v == null ? null : v === 'yes' })} />
      </Field>
    </div>
  );

  const nonCompeteField = () => (ASK_NON_COMPETE[family] || draft.non_compete) && (
    <Field label="Gibt es ein Wettbewerbsverbot oder eine Freistellung?" field="non_compete">
      <Why>Kann den Start um Monate verschieben. Nur intern.</Why>
      {flowHint('kundenschutz')}
      <ChipGroup field="non_compete" options={NON_COMPETE_OPTIONS} value={draft.non_compete} onChange={(v) => set({ non_compete: v })} />
    </Field>
  );

  const wohnortField = () => (
    <Field label="Wohnort" field="city">
      <TextField field="city" value={draft.city} onChange={(v) => set({ city: v })} placeholder="z. B. Bamberg" />
    </Field>
  );

  const arbeitFields = () => (
    <>
      <div className="space-y-4">
        {flowHint('pendeln', 'arbeitsmodell')}
        {/* Ohne Wohnort kann das Matching keinen Arbeitsweg rechnen -- dann hier fragen. */}
        {wohnortFragen.current && wohnortField()}
        {zielorteFields()}
        <ArbeitsortBlock form={draft} set={set} hideRelocation />
        {remoteMismatch && (
          <FixHint text="Zielort ist „Remote“, das Arbeitsmodell ist leer." actions={[{ label: 'Remote übernehmen', onClick: () => set({ remote_preference: 'remote' }) }]} />
        )}
      </div>
      <Field label="Sprachen" field="languages">
        {editSprachen || !draft.languages.length ? (
          <SprachenBlock form={draft} set={set} />
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <span className="text-muted-foreground">✓ {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}:</span>
            <span>{draft.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(' · ')}</span>
            <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setEditSprachen(true)}>ändern</button>
          </div>
        )}
      </Field>
      <Field label="Arbeitserlaubnis" field="work_permit">
        <Why>Nur erfragen, nie aus Name oder Herkunft ableiten.</Why>
        <ArbeitserlaubnisBlock form={draft} set={set} />
      </Field>
    </>
  );

  const marktFields = (collapsible: boolean) => (
    <>
      <Field label="Laufen aktuell andere Bewerbungen? Wo und mit welchem Stand?" field="other_applications">
        <Why>Davon hängt dein Tempo ab. Nur intern, nie für den Kunden.</Why>
        <ChipGroup field="other_applications" options={OTHER_APPLICATIONS_OPTIONS} value={draft.other_applications} onChange={(v) => set({ other_applications: v })} />
        {draft.other_applications && draft.other_applications !== 'none' && (
          <div className="space-y-2 pt-1">
            <TextField field="other_applications_notes" value={draft.other_applications_notes} onChange={(v) => set({ other_applications_notes: v })} placeholder="Wo und mit welchem Stand? z. B. Zweitgespräch nächste Woche" />
            <div className="flex flex-wrap items-center gap-2">
              <Input value={busyFirm} onChange={(e) => setBusyFirm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBusyFirm(); } }} placeholder="Firma, bei der es läuft" className="h-8 w-56 text-xs" />
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={!busyFirm.trim()} onClick={addBusyFirm}>Auf „Nicht vorstellen bei“</Button>
            </div>
          </div>
        )}
      </Field>
      <div className="space-y-1.5">
        <SperrlisteBlock form={draft} set={set} formerEmployers={formerEmployers} />
        <Why>Der aktuelle Arbeitgeber steht automatisch drauf. Entfernen nur, wenn es wirklich passt.</Why>
      </div>
      <Field label="Was lief in früheren Bewerbungsprozessen nicht gut?" field="previous_process_issues">
        <Why>Das musst du diesmal besser machen, z. B. schneller Rückmeldung geben.</Why>
        <PhraseChips field="previous_process_issues" collapsible={collapsible} options={PROCESS_ISSUE_OPTIONS} value={draft.previous_process_issues} onChange={(v) => set({ previous_process_issues: v })} />
      </Field>
      <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
        <Checkbox className="mt-0.5" checked={draft.presentation_consent === true} onCheckedChange={(v) => set({ presentation_consent: v === true, presentation_consent_at: v === true ? new Date().toISOString() : null })} />
        <span>
          {firstName} ist einverstanden, anonym für passende Positionen vorgestellt zu werden.
          {draft.presentation_consent && draft.presentation_consent_at && <span className="text-muted-foreground"> Erfasst am {new Date(draft.presentation_consent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}{draft.interview_type ? `, ${INTERVIEW_TYPE_OPTIONS.find((o) => o.value === draft.interview_type)?.label}` : ''}.</span>}
          <span className="mt-1 block text-xs text-muted-foreground">Vor jeder konkreten Vorstellung stimmst du dich noch einmal ab.</span>
        </span>
      </label>
    </>
  );

  // Abschluss (02.11.2026: Einschätzung und Kundenprofil auf einer Seite): Statt fünf
  // Kundentexten, von denen nur einer beim Kunden ankommt, die Karte, die er wirklich sieht.
  const kundenVorschau: InterviewInsights = {
    interview_date: draft.interview_date,
    interview_type: (draft.interview_type || null) as InterviewInsights['interview_type'],
    // Wie die Kunden-Ansicht: eigener Kundentext vor der Wechselmotivation.
    change_motivation: draft.summary_motivation.trim() || draft.change_motivation,
    change_motivation_tags: draft.change_motivation_tags,
    why_now: draft.why_now,
    offer_requirements: draft.offer_requirements,
    notice_period: draft.notice_period || null,
    earliest_start_date: draft.availability_date || null,
    leadership_scope: (draft.leadership_scope || null) as InterviewInsights['leadership_scope'],
    leadership_team_size: draft.leadership_team_size,
    other_applications: null,
    salary_wish: wunschBand(draft.expected_salary),
  };

  const neuUebernehmen = (key: (typeof CLIENT_SUMMARY_KEYS)[number]) => {
    const g = buildClientSummary(draftRef.current);
    lastSummaryRef.current = { ...lastSummaryRef.current, [key]: g[key] };
    set({ [key]: g[key] } as Partial<DossierForm>);
  };

  const abschlussPunkt = () => {
    const kundentextFehler = textIssues.filter((i) => i.level === 'danger' || i.field === 'summary_motivation');
    return (
      <div className="space-y-6">
        <p className="text-xs text-muted-foreground">Nach dem Gespräch: füllst du allein aus, der Kandidat ist nicht mehr in der Leitung.</p>
        {recommendationField()}
        <div className="space-y-2">
          <Field label="Wechselbereitschaft (setzt du selbst)" field="change_readiness">
            <Why>Aktiv, offen oder passiv. Gibt es nur als deine Einschätzung, nie automatisch.</Why>
            <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
          </Field>
          {evidence.length > 0 && <p className="text-xs text-muted-foreground">Belege aus dem Gespräch: {evidence.join(' · ')}</p>}
        </div>
        <div className="space-y-2 border-t border-border pt-5" data-dossier-field="summary_motivation">
          <p className="text-sm font-medium">So sieht der Kunde {firstName}</p>
          <Why>Diese Karte steht beim Kunden unter „Aus dem Gespräch“. Namen und Firmen werden dort entfernt.</Why>
          {draft.presentation_consent === false && <p className="text-xs text-muted-foreground">Ohne Einverständnis (Markt) sieht der Kunde diese Karte nicht.</p>}
          <InterviewInsightsCard interview={kundenVorschau} recruiterNotes={null} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => openView(viewIndex('motivation'))}>„Warum wechseln“ ändern</button>
            {editedSummaries.has('summary_motivation') && draft.summary_motivation.trim() && (
              <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => neuUebernehmen('summary_motivation')}>Eigenen Text durch den Entwurf ersetzen</button>
            )}
          </div>
          {kundentextFehler.map((i) => {
            const summary = (CLIENT_SUMMARY_KEYS as readonly string[]).includes(i.field) ? (i.field as (typeof CLIENT_SUMMARY_KEYS)[number]) : null;
            return (
              <p key={`${i.field}:${i.message}`} className={cn('flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-xs', i.level === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{CLIENT_TEXT_LABEL[i.field]}: {i.message}
                {summary ? (
                  <button type="button" className="underline underline-offset-2" onClick={() => neuUebernehmen(summary)}>Neu übernehmen</button>
                ) : <span>In der Akte unter „Bearbeiten“ korrigieren.</span>}
              </p>
            );
          })}
        </div>
      </div>
    );
  };

  /** Inhalt eines Punkts. Schritt für Schritt untereinander, auf der langen Seite wie gewohnt nebeneinander. */
  const punkt = (key: InterviewViewKey, schritt: boolean) => {
    switch (key) {
      case 'ziel': return <>{rolleOben && rolleFact()}{careerGoalField()}{zielNachfragen(schritt)}</>;
      case 'rolle': return <>{!rolleOben && rolleFact()}{leadershipFields(schritt)}<MotiveBlock form={draft} set={set} family={family} candidateId={candidateId} stacked={schritt} /></>;
      case 'motivation': return <>{motivationField()}{hookCards()}{incidentField()}{gegenangebotFields()}</>;
      case 'rahmen': return <>{flowHint('gehalt', 'leaver')}{salaryField()}{noticeField()}{nonCompeteField()}{arbeitFields()}</>;
      case 'markt': return marktFields(schritt);
      case 'abschluss': return abschlussPunkt();
      default: return null;
    }
  };

  /** „Alle Fragen zeigen“: alle Punkte auf einer Seite, links springt dorthin. */
  const renderAll = () => (
    <div className="space-y-10">
      {INTERVIEW_VIEWS.map((v) => (
        <section key={v.key} data-interview-point={v.key} className="scroll-mt-4 space-y-5">
          <h3 className="text-base font-semibold">{v.label}</h3>
          {punkt(v.key, false)}
        </section>
      ))}
    </div>
  );

  /** „Nur Fehlendes“: nur die offenen Pflicht- und Einreichen-Punkte, mit denselben Bausteinen. */
  const renderGaps = () => {
    const keys = [...gaps.map((g) => g.key), ...fuerEinreichen.map((m) => m.key)];
    const shown = new Set<string>();
    const blocks: ReactNode[] = [];
    let arbeitsortGezeigt = false;
    for (const k of keys) {
      const w = WHERE[k];
      const id = w?.field ?? k;
      if (shown.has(id)) continue;
      shown.add(id);
      if (k === 'interview_type' || k === 'interview_date') blocks.push(<p key={k} className="text-sm">Gesprächsart und Datum stehen oben im Kopf.</p>);
      else if (k === 'change_motivation' || k === 'motivation') blocks.push(<div key={k}>{motivationField()}</div>);
      else if (k === 'why_now') blocks.push(<div key={k}>{incidentField()}</div>);
      else if (k === 'expected_salary' || k === 'gehalt') blocks.push(<div key={k}>{salaryField()}</div>);
      else if (k === 'notice_period' || k === 'verfuegbarkeit') blocks.push(<div key={k}>{noticeField()}</div>);
      else if (k === 'einschaetzung') blocks.push(<div key={k}>{recommendationField()}</div>);
      else if (k === 'rolle') blocks.push(<div key={k}><RolleBlock form={draft} set={set} /></div>);
      else if (k === 'arbeitsmodell' || k === 'pendeln') {
        if (!arbeitsortGezeigt) blocks.push(<div key="arbeitsort"><ArbeitsortBlock form={draft} set={set} hideRelocation /></div>);
        arbeitsortGezeigt = true;
      }
      else if (k === 'wohnort') blocks.push(<div key={k}>{wohnortField()}</div>);
      else if (k === 'sprachen') blocks.push(<Field key={k} label="Sprachen" field="languages"><SprachenBlock form={draft} set={set} /></Field>);
      else if (k === 'kundentexte') blocks.push(<p key={k} className="text-sm">Ein Kundentext nennt interne Angaben. Unter „Abschluss“ korrigieren.</p>);
      else blocks.push(<p key={k} className="text-sm text-muted-foreground">{readiness.items.find((i) => i.key === k)?.label ?? k}: in der Akte über „Bearbeiten“ ergänzen.</p>);
    }
    return (
      <Phase title="Nur Fehlendes" intro={blocks.length ? 'Nur die Punkte, die zum Abschließen oder Einreichen noch fehlen.' : 'Es fehlt nichts mehr.'}>
        {blocks}
      </Phase>
    );
  };

  /** Die Karte nach dem Abschluss: bleibt stehen, bis der Headhunter wählt. */
  const renderFinished = () => {
    const nachher = computeReadiness(draft);
    const fehlendesEintragen = () => {
      const m = nachher.missing[0];
      const w = m ? WHERE[m.key] : undefined;
      if (w && w.ort === 'frage') { jump(m.key); return; }
      closeAfterFinish();
      if (m) onEditMissing?.({ section: m.section, field: m.field });
    };
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className={cn('w-full max-w-md space-y-3 rounded-lg border p-6 text-center', nachher.isReady ? 'border-success/50' : 'border-border')}>
          <p className={cn('text-base font-semibold', nachher.isReady && 'text-success')}>✓ Interview abgeschlossen</p>
          <p className={cn('text-sm', !nachher.isReady && 'text-warning')}>
            {nachher.isReady ? `${firstName} ist bereit zum Einreichen.` : `Noch offen: ${nachher.missing.map((m) => m.label).join(', ')}`}
          </p>
          <p className={cn('text-xs', nachher.isReady ? 'text-success' : 'text-muted-foreground')}>Bereit zum Einreichen {nachher.done} von {nachher.total}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-1">
            <Button variant="outline" onClick={closeAfterFinish}>Zum Profil</Button>
            {nachher.isReady ? (
              <Button onClick={() => { closeAfterFinish(); onSubmitToJob?.(); }}>Auf Stelle einreichen</Button>
            ) : (
              <Button onClick={fehlendesEintragen}>Fehlendes eintragen</Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openItems = [...gaps, ...fuerEinreichen];
  const openLabel = (m: { key: string; label: string }) => `${m.label}${WHERE[m.key]?.ort === 'kopf' ? ' (oben)' : WHERE[m.key]?.ort === 'akte' ? ' (Akte)' : ''}`;
  const ersteOffene = firstOpenView(draft);

  // Gelb nur in zwei Momenten: auf „Markt“, solange der Kandidat noch in der Leitung ist
  // (was fehlt, muss er jetzt noch sagen), und beim Abschluss bzw. auf der langen Seite.
  const vorDemAuflegen = gaps.filter((g) => WHERE[g.key]?.ort !== 'kopf');
  const hinweisZeile = onlyMissing || finished ? null
    : (!stepMode || currentView.key === 'abschluss') && gaps.length ? { titel: 'Zum Abschließen fehlt noch etwas:', liste: gaps, frage: null as string | null }
    : stepMode && currentView.key === 'markt' && vorDemAuflegen.length ? { titel: 'Bevor du auflegst, fehlt noch:', liste: vorDemAuflegen, frage: NEXT_QUESTION[vorDemAuflegen[0].key] ?? null }
    : null;

  const abschliessenKnopf = (
    <Button onClick={complete} disabled={completing}>
      {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Interview abschließen
    </Button>
  );
  // Von der Abschluss-Karte aus Fehlendes eingetragen: ohne zweites Abschließen zurück zur Karte.
  const zurKarteKnopf = draft.interview_status === 'completed' && !completedAtOpen && (
    <Button onClick={async () => { if (await flush()) setFinished(true); }}>Zum Abschluss</Button>
  );
  const hatVor = view > 0;
  const hatNach = view < INTERVIEW_VIEWS.length - 1;

  // Gelbe Kante „fehlt“ am Feld nur bei „Nur Fehlendes“ und nach einem Klick auf eine fehlende Angabe.
  const fehltAnzeigen = onlyMissing || zeigeFehlt;
  const terminTelefon = (termin?.phone || draft.phone).replace(/[^\d+]/g, '');
  const terminLink = !termin ? null : termin.mode === 'teams' ? termin.join_url : terminTelefon ? `tel:${terminTelefon}` : null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="border-b border-border px-6 pb-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-base">
              {completedAtOpen ? (
                <>{draft.full_name} <span className="ml-1 font-normal text-muted-foreground">· Interview vom {draft.interview_date ? new Date(draft.interview_date).toLocaleDateString('de-DE') : '–'}</span></>
              ) : clockStopped ? (
                <>{draft.full_name} <span className="ml-1 font-normal tabular-nums text-muted-foreground">Gespräch beendet · {clock}</span></>
              ) : (
                <>{draft.full_name} <span className="ml-1 font-normal tabular-nums text-muted-foreground">{clock}</span></>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">Live-Interview in fünf Punkten und dem Abschluss, speichert automatisch in die Kandidatenakte.</DialogDescription>
            {termin && !completedAtOpen ? (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  {termin.mode === 'teams' ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
                  {terminText(termin.starts_at)} · {termin.mode === 'teams' ? 'Teams' : 'Telefon'}
                </span>
                {terminLink && (
                  <Button asChild variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                    <a href={terminLink} target={termin.mode === 'teams' ? '_blank' : undefined} rel="noreferrer">{termin.mode === 'teams' ? 'Beitreten' : 'Anrufen'}</a>
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <Input id={fieldId('interview_date')} type="date" aria-label="Datum des Interviews" className="h-8 w-36 text-xs" value={draft.interview_date ?? today()} onChange={(e) => set({ interview_date: e.target.value || today() })} />
                <ChipGroup field="interview_type" options={INTERVIEW_TYPE_OPTIONS} value={draft.interview_type} onChange={(v) => set({ interview_type: v })} />
              </div>
            )}
          </div>
          {newColumnsPending && (
            <p className="mt-2 rounded-md bg-warning/10 px-3 py-1.5 text-xs text-warning">
              Einige neue Angaben (z. B. fix oder mit Bonus, Wettbewerbsverbot) werden erst nach dem Datenbank-Update dauerhaft gespeichert. Alles andere ist gesichert.
            </p>
          )}
          {saveState === 'error' && (
            <p className="mt-2 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              Nicht gespeichert · neuer Versuch läuft. Deine Eingaben bleiben in diesem Tab, bis es geklappt hat.
            </p>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[160px_minmax(0,1fr)_230px] md:overflow-hidden lg:grid-cols-[180px_minmax(0,1fr)_300px]">
          {/* Links nur die Punkte, ohne Ampel: ✓ heißt beantwortet, hell ist der aktuelle Punkt. */}
          <nav aria-label="Punkte" className="flex flex-wrap items-center gap-1 border-b border-border p-3 text-sm md:min-h-0 md:flex-col md:flex-nowrap md:items-stretch md:overflow-y-auto md:border-b-0 md:border-r">
            {onlyMissing ? (
              <>
                <p className="px-2 pb-1 text-xs text-muted-foreground">Nur Fehlendes</p>
                {openItems.map((m) => (
                  <button key={m.key} type="button" onClick={() => scrollToGap(m.key)} className="rounded-md px-2 py-1.5 text-left leading-snug hover:bg-muted">{openLabel(m)}</button>
                ))}
                {!openItems.length && <p className="px-2 text-xs text-muted-foreground">Es fehlt nichts mehr.</p>}
              </>
            ) : (
              INTERVIEW_VIEWS.map((v, i) => {
                const active = !finished && i === view;
                const done = viewAnswered(v.key, draft);
                return (
                  <Fragment key={v.key}>
                    {v.key === 'abschluss' && <hr className="my-1 hidden border-border md:block" />}
                    <button
                      type="button"
                      aria-current={active ? 'step' : undefined}
                      onClick={() => openView(i)}
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left leading-snug transition-colors',
                        active ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                      )}
                    >
                      <span aria-hidden className="w-3 shrink-0 text-xs text-muted-foreground">{done ? '✓' : ''}</span>
                      {v.label}
                      {done && <span className="sr-only"> (beantwortet)</span>}
                    </button>
                  </Fragment>
                );
              })
            )}
            <div className="md:mt-auto md:pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label="Darstellung" className="rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuCheckboxItem checked={!stepMode && !onlyMissing} onCheckedChange={(c) => changeLayout(c ? 'all' : 'steps')}>Alle Fragen zeigen</DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem checked={onlyMissing} onCheckedChange={(c) => setOnlyMissing(c === true)}>Nur Fehlendes</DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>

          <div ref={mainRef} className="px-6 py-5 md:min-h-0 md:overflow-y-auto">
            {rueckkehr && !onlyMissing && !finished && (
              <p className="mb-4 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>Weiter, wo du warst{rueckkehr.savedAt ? ` · zuletzt gespeichert ${uhrzeit(rueckkehr.savedAt)}` : ''}</span>
                {ersteOffene !== view && (
                  <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => openView(ersteOffene)}>Zum ersten offenen Punkt</button>
                )}
              </p>
            )}
            <FieldMissingContext.Provider value={fehltAnzeigen ? missingFields : null}>
              <FieldQuestionContext.Provider value>
                {finished ? renderFinished() : onlyMissing ? renderGaps() : stepMode ? <div className="space-y-5">{punkt(currentView.key, true)}</div> : renderAll()}
              </FieldQuestionContext.Provider>
            </FieldMissingContext.Provider>
          </div>

          <aside className="space-y-4 border-t border-border bg-muted/30 p-5 md:min-h-0 md:overflow-y-auto md:border-l md:border-t-0">
            <div className="space-y-2">
              {termin && terminNotiz && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Notiz von {termin.first_name || firstName}:</span> „{terminNotiz}“
                </p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Notiz, erkennt beim Tippen</p>
                <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={markMoment}>
                  <Star className="mr-1 h-3.5 w-3.5" />Moment
                </Button>
              </div>
              <Textarea
                ref={notesRef}
                id="dossier-additional_notes"
                value={draft.additional_notes}
                onChange={(e) => set({ additional_notes: e.target.value })}
                placeholder="will 45k, min 40k, Kündigung 3M z. QE, Englisch B2 …"
                rows={7}
              />
              {liveItems.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Erkannt · antippen übernimmt</p>
                  <div className="flex flex-wrap gap-1.5">
                    {liveItems.map((i) => (
                      <span key={`${i.key}:${i.display}`} className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs', i.status === 'conflict' ? 'border-destructive/50' : i.status === 'sensitive' ? 'border-warning/60' : 'border-primary/50')}>
                        <button type="button" onClick={() => applyItem(i)} title={`„${i.quote}“`} className="hover:underline">
                          {i.label}: {i.status === 'conflict' ? `${i.currentDisplay} → ${i.display}` : i.display}
                        </button>
                        <button type="button" aria-label="Vorschlag ausblenden" className="text-muted-foreground hover:text-foreground" onClick={() => setDismissed((d) => new Set(d).add(`${i.key}:${i.display}`))}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Button type="button" variant="ghost" size="sm" className="h-7 px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground" onClick={analyze} disabled={analyzing}>
                {analyzing ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}Tiefer mit KI auswerten
              </Button>
            </div>

            {werdegang.length > 0 && (
              <div className="space-y-1.5 border-t border-border pt-4 text-xs">
                <p className="text-sm font-semibold">Werdegang {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}</p>
                {werdegang.map((w, i) => w.kind === 'gap' ? (
                  <p key={`gap-${i}`} className="border-l-2 border-warning/60 pl-2 leading-tight text-muted-foreground">
                    Lücke {monthYear(w.from)} – {monthYear(w.to)} · {w.months} Monate
                  </p>
                ) : (
                  <p key={w.st.id ?? i} className={cn('border-l-2 pl-2 leading-tight', w.st.current ? 'border-foreground/40' : w.short ? 'border-warning/60' : 'border-border')}>
                    <span className={w.st.current ? 'font-medium' : ''}>{w.st.title || 'Station'}</span>
                    <br />
                    <span className="text-muted-foreground">
                      {w.st.company ? `${w.st.company} · ` : ''}{yearsLabel(w.st)}
                      {w.st.current && signals.tenureYears != null ? ` · ${signals.tenureYears} Jahre` : ''}
                      {w.short ? ` · nur ${w.short} Monate` : ''}
                    </span>
                  </p>
                ))}
              </div>
            )}
          </aside>
        </div>

        {hinweisZeile && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-border bg-warning/10 px-6 py-2 text-xs text-warning">
            <span>{hinweisZeile.titel}</span>
            {hinweisZeile.liste.map((m) => (
              <button key={m.key} type="button" onClick={() => jump(m.key)} className="rounded border border-warning/50 px-1.5 py-0.5 hover:bg-warning/10">{openLabel(m)} ›</button>
            ))}
            {hinweisZeile.frage && <span className="text-muted-foreground">{hinweisZeile.frage}</span>}
          </div>
        )}

        {!finished && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-3">
            {onlyMissing ? (
              <Button variant="outline" onClick={() => setOnlyMissing(false)}>
                <ChevronLeft className="mr-1 h-4 w-4" />Zurück zum Interview
              </Button>
            ) : stepMode ? (
              <Button variant="outline" onClick={() => goToView(view - 1)} disabled={!hatVor}>
                <ChevronLeft className="mr-1 h-4 w-4" />Zurück
              </Button>
            ) : <span />}
            <span className={cn('text-xs text-muted-foreground', saveState === 'error' && 'text-destructive')}>{saveLabel}</span>
            {onlyMissing ? (zurKarteKnopf || (kannAbschliessen ? abschliessenKnopf : <span />))
              : !stepMode ? (zurKarteKnopf || abschliessenKnopf)
              : hatNach ? (
                <div className="flex gap-2">
                  {/* Alle Mindestangaben da: abschließen von überall, nicht erst am Ende. */}
                  <Button variant={kannAbschliessen || zurKarteKnopf ? 'outline' : 'default'} onClick={() => goToView(view + 1)}>
                    Weiter: {INTERVIEW_VIEWS[view + 1].label}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                  {zurKarteKnopf || (kannAbschliessen && abschliessenKnopf)}
                </div>
              ) : (zurKarteKnopf || abschliessenKnopf)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

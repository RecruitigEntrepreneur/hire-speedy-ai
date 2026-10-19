import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Lock, Sparkles, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
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
  COMPANY_SIZE_OPTIONS,
  INDUSTRY_CHANGE_OPTIONS,
  INTERNATIONAL_OPTIONS,
  NON_COMPETE_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  RELOCATION_OPTIONS,
  RECOMMENDATION_OPTIONS,
  WOULD_STAY_OPTIONS,
  autoClientSummary,
  buildClientSummary,
  changeEvidence,
  computeReadiness,
  interviewGaps,
  type ClientSummary,
} from '@/lib/candidateDossier';
import {
  DIDNT_WORK_OPTIONS,
  PROCESS_ISSUE_OPTIONS,
  TIMEFRAME_OPTIONS,
  WORKED_OPTIONS,
  actionsTaken,
  careerDirections,
  phrasesOf,
} from '@/lib/interviewSuggestions';
import { ALL_GOALS, careerGoalSuggestions } from '@/lib/careerGoals';
import { ASK_NON_COMPETE, FAMILY_CHIPS, FAMILY_LABEL, NOTICE_HINT, belowLevel, detectRoleFamily, isLeaderTitle } from '@/lib/roleFamily';
import { clientMotivation, earlierGeneratedMotivation, evaluateMotiveFields, incidentHasEvent, incidentParts, incidentSentence, incidentSuggestions, isAutoWhyNow, isOldAutoMotivation, joinMotivation, legacyAddonFields, motiveLabels, splitMotivation, type MotiveFlow } from '@/lib/situationMotives';
import { careerSignals, yearsLabel, type CareerHook, type CareerStation, type SignalStation } from '@/lib/careerSignals';
import { clientTextIssues, type ClientTextField } from '@/lib/clientTextCheck';
import { quickExtract, type CaptureSuggestion } from '@/lib/quickExtract';
import { buildReview, freshText, fromAiFields, mergeSuggestions, type ReviewItem } from '@/lib/captureReview';
import type { DossierSaveResult } from '@/hooks/useCandidateDossier';
import { AreaField, ChipGroup, Field, FieldMissingContext, FieldQuestionContext, NumberField, PhraseChips, TextField, fieldId, focusDossierField } from './DossierFields';
import { CareerGoalBlock, ClientMotivationField, IncidentBlock, MotiveBlock } from './MotiveBlock';
import {
  AngebotBlock,
  ArbeitsortBlock,
  ArbeitserlaubnisBlock,
  GehaltBlock,
  KundeBlock,
  RolleBlock,
  SperrlisteBlock,
  SprachenBlock,
  VerfuegbarkeitBlock,
  ZieleBlock,
} from './DossierBlocks';

// Live-Interview: der Headhunter führt das Gespräch jetzt und geht die Fragen
// direkt mit dem Kandidaten durch. Kein Leitfaden, keine Skripte (die kommen
// in die Akademie). Bekanntes ist vorausgefüllt, rechts steht die freie Notiz
// mit Erkennung beim Tippen und immer die nächste offene Frage.

const PHASES = [
  { key: 'situation', label: 'Heute, Ziel und Wechsel' },
  { key: 'ziele', label: 'Wunschstelle' },
  { key: 'rahmen', label: 'Rahmen' },
  { key: 'markt', label: 'Markt und Einschätzung' },
  { key: 'kundenprofil', label: 'Kundenprofil' },
] as const;

const NEXT_QUESTION: Record<string, string> = {
  kontakt: 'Wie erreiche ich Sie am besten, per Mail oder Telefon?',
  rolle: 'Was machen Sie aktuell genau, und seit wie vielen Jahren?',
  skills: 'Mit welchen Tools und Themen arbeiten Sie täglich?',
  gehalt: 'Welches Jahresgehalt stellen Sie sich vor?',
  verfuegbarkeit: 'Wie lang ist Ihre Kündigungsfrist?',
  motivation: 'Was ist für Sie der wichtigste Grund für einen Wechsel?',
  einschaetzung: 'Deine Einschätzung fehlt noch (Phase 4).',
  why_now: 'Was ist jetzt anders als vor einem Jahr?',
  interview_type: 'Telefon, Video oder vor Ort? Oben im Kopf wählen.',
  interview_date: 'Wann war das Gespräch? Oben im Kopf.',
};

type PhaseKey = (typeof PHASES)[number]['key'];

/**
 * Wo eine fehlende Angabe steht: Phase und Feld, damit „fehlt“ dorthin springt.
 * „kopf“ = Datum und Gesprächsart oben, „akte“ = steht nicht im Interview.
 */
const WHERE: Record<string, { phase: PhaseKey | 'kopf' | 'akte'; field: string }> = {
  interview_date: { phase: 'kopf', field: 'interview_date' },
  interview_type: { phase: 'kopf', field: 'interview_type' },
  change_motivation: { phase: 'situation', field: 'change_motivation' },
  motivation: { phase: 'situation', field: 'change_motivation' },
  why_now: { phase: 'situation', field: 'specific_incident' },
  rolle: { phase: 'situation', field: 'job_title' },
  expected_salary: { phase: 'rahmen', field: 'expected_salary' },
  gehalt: { phase: 'rahmen', field: 'expected_salary' },
  notice_period: { phase: 'rahmen', field: 'notice_period' },
  verfuegbarkeit: { phase: 'rahmen', field: 'notice_period' },
  einschaetzung: { phase: 'markt', field: 'recommendation' },
  kontakt: { phase: 'akte', field: 'email' },
  skills: { phase: 'akte', field: 'skills' },
  kundentexte: { phase: 'kundenprofil', field: 'summary_motivation' },
};

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

/** Aus „Was gefällt, was stört“ (Phase 1) vorgemerkt für Phase 3. */
const FLOW_HINT: Record<MotiveFlow, string> = {
  gehalt: 'Aus Phase 1: Geld ist ein Wechselgrund. Wunschgehalt genau erfragen.',
  leaver: 'Aus Phase 1: Beteiligung. Rückkaufregeln beim Ausstieg klären.',
  kundenschutz: 'Aus Phase 1: Kundenbeziehungen. Nach einer Kundenschutzklausel fragen.',
  pendeln: 'Aus Phase 1: Der Arbeitsweg ist wichtig. Pendelzeit genau erfassen.',
  arbeitsmodell: 'Aus Phase 1: Remote oder Flexibilität ist wichtig. Arbeitsmodell genau erfassen.',
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
}

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export function CandidateInterviewDialog({ open, onOpenChange, candidateId, form, pendingColumns, onSave, onComplete }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<DossierForm>(form);
  const [phase, setPhase] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [newColumnsPending, setNewColumnsPending] = useState(pendingColumns);
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());
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
  const [keptHints, setKeptHints] = useState<Set<string>>(new Set());
  const [startSaved, setStartSaved] = useState(false);
  const [busyFirm, setBusyFirm] = useState('');
  const lastMotivRef = useRef('');
  const autoBlockedRef = useRef(false);

  const draftRef = useRef(draft);
  const versionRef = useRef(0);
  const timerRef = useRef<number>();
  const mainRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const baselineNotesRef = useRef('');

  const phaseDone = (i: number, f: DossierForm): boolean => {
    switch (PHASES[i].key) {
      case 'situation': return !!(f.change_motivation.trim() || f.change_motivation_tags.length) && !!(f.current_positive.trim() || f.current_negative.trim() || f.leadership_scope || f.specific_incident.trim());
      case 'ziele': return !!(f.target_roles.length || f.target_industries.length || f.target_locations.length || f.company_size_pref);
      case 'rahmen': return !!f.expected_salary && !!(f.notice_period || f.availability_date);
      case 'markt': return !!f.recommendation && !!(f.previous_process_issues.trim() || f.blocked_companies.length);
      case 'kundenprofil': return !!(f.summary_motivation || f.summary_salary || f.summary_notice || f.summary_key_requirements || f.summary_cultural_fit);
      default: return false;
    }
  };

  // Beim Öffnen einmal übernehmen und bei der ersten offenen Phase starten.
  // Danach nie mehr von außen überschreiben (sonst verschluckt das Nachladen
  // nach dem Speichern die Eingaben – der Fehler aus dem alten Interview).
  useEffect(() => {
    if (!open) return;
    setDraft(form);
    draftRef.current = form;
    baselineNotesRef.current = form.additional_notes;
    const firstOpen = PHASES.findIndex((_, i) => !phaseDone(i, form));
    setPhase(firstOpen === -1 ? 0 : firstOpen);
    setSaveState('idle');
    setAiSuggestions([]);
    setDismissed(new Set());
    setEditRolle(false);
    setEditSprachen(false);
    setOnlyMissing(false);
    setHiddenHooks(new Set());
    setKeptHints(new Set());
    setStartSaved(false);
    setBusyFirm('');
    lastMotivRef.current = '';
    autoBlockedRef.current = false;
    setStartedAt(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => setNewColumnsPending(pendingColumns), [pendingColumns]);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [phase]);
  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  const flush = async (): Promise<boolean> => {
    window.clearTimeout(timerRef.current);
    if (versionRef.current === 0) return true;
    const version = versionRef.current;
    setSaveState('saving');
    const result = await onSave(draftRef.current);
    if (!result.ok) {
      setSaveState('error');
      return false;
    }
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

  const schedule = () => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => { flush(); }, 900);
  };

  const set = (patch: Partial<DossierForm>) => {
    setDraft((d) => {
      const next = { ...d, ...patch, interview_date: patch.interview_date ?? d.interview_date ?? today() };
      draftRef.current = next;
      return next;
    });
    versionRef.current += 1;
    setSaveState('dirty');
    schedule();
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const readiness = useMemo(() => computeReadiness(draft), [draft]);
  const evidence = useMemo(() => changeEvidence(draft), [draft]);
  const firstName = draft.full_name.split(' ')[0] || 'die Person';

  // Was fehlt -- zum Abschließen (Mindestangaben, wie die Datenbank beim Einreichen)
  // und zusätzlich zum Einreichen. Gelb im Kopf, an den Reitern, in der Seitenleiste
  // und am Feld (Durchklicken 15.10.2026: „fehlt noch etwas, aber was?“).
  const gaps = useMemo(() => interviewGaps(draft), [draft]);
  const gapKeys = useMemo(() => new Set(gaps.map((g) => g.key)), [gaps]);
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
  const phaseMissing = (i: number) => {
    const key = PHASES[i].key;
    if (key === 'kundenprofil') return kannAbschliessen;
    return [...gaps.map((g) => g.key), ...fuerEinreichen.map((m) => m.key)].some((k) => WHERE[k]?.phase === key);
  };

  // Erkennung beim Tippen: Schnellerkennung auf der Notiz, dazu KI-Vorschläge
  const liveItems: ReviewItem[] = useMemo(() => {
    const fresh = freshText(draft.additional_notes, baselineNotesRef.current);
    const quick = fresh.trim() ? quickExtract(fresh, 'Notiz').suggestions : [];
    return buildReview(draft, mergeSuggestions(aiSuggestions, quick))
      .filter((i) => i.status !== 'same' && !dismissed.has(`${i.key}:${i.display}`));
  }, [draft, aiSuggestions, dismissed]);

  const applyItem = (i: ReviewItem) => set({ [i.key]: i.value } as Partial<DossierForm>);

  const goTo = (i: number) => setPhase(i);

  /** Zur fehlenden Angabe springen: Phase öffnen, Feld fokussieren. */
  const jump = (key: string) => {
    const w = WHERE[key];
    if (!w || w.phase === 'akte') {
      toast.info('Steht nicht im Interview', { description: 'Kontakt und Skills ergänzt du in der Akte über „Bearbeiten“.' });
      return;
    }
    if (w.phase === 'kopf') {
      const el = document.getElementById(fieldId(w.field));
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el?.matches('input') ? el : el?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
      return;
    }
    setOnlyMissing(false);
    goTo(PHASES.findIndex((p) => p.key === w.phase));
    window.setTimeout(() => focusDossierField(w.field), 80);
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
  const lowRoles = draft.target_roles.filter((r) => belowLevel(family, r));
  const remoteMismatch = draft.target_locations.some((l) => /remote/i.test(l)) && !draft.remote_preference;

  // „Warum gerade jetzt?“ (Pflicht) füllt sich aus dem Auslöser. Ein früher erfasster eigener
  // Text bleibt stehen und wird beim Auslöser als „früher notiert“ gezeigt.
  useEffect(() => {
    if (!open) return;
    const gen = incidentSentence(draft.specific_incident, incidentHasEvent(draft.specific_incident) ? draft.frequency_of_issues : null);
    if (draft.why_now.trim() !== gen && isAutoWhyNow(draft.why_now)) set({ why_now: gen });
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
      set({ ...patch, change_motivation: joinMotivation(gen, legacy.rest) });
      return;
    }
    if (gen && fromGen.auto) {
      lastMotivRef.current = gen;
    } else if (gen && (cur === '' || isOldAutoMotivation(cur) || fromLast.auto)) {
      lastMotivRef.current = gen;
      set({ change_motivation: joinMotivation(gen, fromLast.auto ? fromLast.addition : '') });
    } else if (!gen && fromLast.auto) {
      lastMotivRef.current = '';
      set({ change_motivation: fromLast.addition });
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
    if (themen.length !== tags.length || themen.some((t) => !tags.includes(t))) set({ change_motivation_tags: themen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, motives.weiter.themen.join('|'), draft.change_motivation_tags.join('|')]);

  // Der aktuelle Arbeitgeber steht automatisch auf „Nicht vorstellen bei“ (entfernbar).
  useEffect(() => {
    if (!open || autoBlockedRef.current) return;
    const c = draft.company.trim();
    if (!c) return;
    autoBlockedRef.current = true;
    if (!draft.blocked_companies.length) set({ blocked_companies: [c] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draft.company]);

  // Gehaltstext für den Kunden nur aus den Klicks (Wunschgehalt, fix/gesamt), nie frei:
  // so können aktuelles Gehalt und Schmerzgrenze nicht hineinrutschen.
  useEffect(() => {
    if (!open) return;
    const gen = buildClientSummary(draft).summary_salary;
    if (draft.summary_salary !== gen) set({ summary_salary: gen });
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
    if (Object.keys(patch).length) set(patch);
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
    onOpenChange(false);
  };

  const complete = async () => {
    setCompleting(true);
    const ok = await flush();
    if (!ok) { setCompleting(false); toast.error('Speichern hat nicht geklappt'); return; }
    // Abschließen nur mit den Mindestangaben (gleiche Regel wie die Datenbank beim Einreichen).
    const offen = interviewGaps(draftRef.current);
    if (offen.length) {
      setCompleting(false);
      const keys = offen.map((g) => g.key);
      jump(keys[0]);
      toast.error('Zum Abschließen fehlt noch etwas', {
        description: `${offen.map((g) => g.label).join(', ')}.${keys.includes('interview_date') || keys.includes('interview_type') ? ' Datum und Gesprächsart stehen oben im Kopf.' : ''}`,
      });
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
    const nachher = computeReadiness({ ...draftRef.current, interview_status: 'completed' });
    toast.success('Interview abgeschlossen', { description: nachher.isReady ? `${firstName} ist bereit zum Einreichen.` : `Noch offen: ${nachher.missing.map((m) => m.label).join(', ')}` });
    onOpenChange(false);
  };

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const saveLabel =
    saveState === 'saving' ? 'Speichert …'
    : saveState === 'dirty' ? 'Ungespeicherte Änderungen'
    : saveState === 'error' ? 'Nicht gespeichert'
    : savedAt ? `Gespeichert ${savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
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
              <p className="text-success">✓ {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}</p>
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

  const renderPhase = () => {
    switch (PHASES[phase].key) {
      case 'situation':
        return (
          <Phase title="Heute, Ziel und Wechsel">
            <Field label="Was wollen Sie in Ihrer Karriere ultimativ erreichen?" field="career_ultimate_goal">
              <Why>Danach suchst du Stellen aus und so stellst du die Person beim Kunden vor.</Why>
              <HookHint hooks={hooksAt('career_ultimate_goal')} />
              <CareerGoalBlock form={draft} set={set} suggestions={goalSugs} legacy={[...careerDirections(draft), ...draft.target_roles]} candidateId={candidateId} family={family} />
              {cvGoal && <p className="text-xs text-muted-foreground">Aus dem Lebenslauf: {cvGoal}</p>}
            </Field>
            {/* Ziel-Nachfragen: ohne eigene Überschrift und Einrückung, gleich wie die anderen Fragen. */}
            <>
              <Field label="Was haben Sie dafür schon getan?" field="career_actions_taken">
                <Why>Belegt, dass das Ziel ernst gemeint ist.</Why>
                <PhraseChips field="career_actions_taken" options={uniqChips(actionsTaken(draft), fam.getan)} suggested={actionsTaken(draft).filter((a) => a.startsWith('Weiterbildung:') || a.startsWith('Team von'))} value={draft.career_actions_taken} onChange={(v) => set({ career_actions_taken: v })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Was hat gut funktioniert?" field="career_what_worked">
                  <Why>Was hat die Person bisher weitergebracht?</Why>
                  <HookHint hooks={hooksAt('career_what_worked')} />
                  <PhraseChips field="career_what_worked" options={uniqChips(fam.funktioniert, WORKED_OPTIONS).slice(0, 7)} value={draft.career_what_worked} onChange={(v) => set({ career_what_worked: v })} />
                </Field>
                <Field label="Was weniger?" field="career_what_didnt_work">
                  <Why>Was hat gebremst? Das darf sich beim nächsten Job nicht wiederholen.</Why>
                  <PhraseChips field="career_what_didnt_work" options={uniqChips(fam.weniger, DIDNT_WORK_OPTIONS).slice(0, 7)} value={draft.career_what_didnt_work} onChange={(v) => set({ career_what_didnt_work: v })} />
                </Field>
              </div>
            </>
            {rolleFact()}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
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
            <MotiveBlock form={draft} set={set} family={family} candidateId={candidateId} />
            {motivationField()}
            {hookCards()}
            {incidentField()}
            {/* Gegenangebot-Risiko nur bei einem echten Auslöser (sonst gibt es nichts „zu lösen“); schon Beantwortetes bleibt sichtbar. */}
            {(incidentHasEvent(draft.specific_incident) || draft.discussed_internally || draft.would_stay) && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Haben Sie das intern angesprochen?" field="discussed_internally">
                  <ChipGroup field="discussed_internally" options={DISCUSSED_OPTIONS} value={draft.discussed_internally} onChange={(v) => set({ discussed_internally: v })} />
                </Field>
                <Field label="Würden Sie bleiben, wenn Ihr Arbeitgeber das löst?" field="would_stay">
                  <ChipGroup field="would_stay" options={WOULD_STAY_OPTIONS} value={draft.would_stay} onChange={(v) => set({ would_stay: v })} />
                </Field>
              </div>
            )}
          </Phase>
        );
      case 'ziele':
        return (
          <Phase title={`Was für eine Stelle sucht ${firstName}?`} intro="Erst fragen, dann antippen. Vorschläge passen zur Rolle und gehen nie unter die heutige Ebene.">
            <div className="space-y-2">
              <p className="text-sm font-medium">Welche Rollen, Branchen und Orte kommen infrage?</p>
              <Why>Steuert direkt, welche Stellen das Matching vorschlägt.</Why>
              <ZieleBlock form={draft} set={set} />
              {lowRoles.length > 0 && !keptHints.has('lowRoles') && (
                <FixHint text={`„${lowRoles.join('“, „')}“ liegt unter der heutigen Ebene (${FAMILY_LABEL[family]}).`} actions={[
                  { label: 'Entfernen', onClick: () => set({ target_roles: draft.target_roles.filter((r) => !belowLevel(family, r)) }) },
                  { label: 'Ist gewollt', onClick: () => setKeptHints((s) => new Set(s).add('lowRoles')) },
                ]} />
              )}
            </div>
            <Field label="Wie soll das neue Unternehmen sein?" field="company_size_pref">
              <Why>Steht so im Kundentext unter „Warum wechseln“ und wird als Feld gespeichert.</Why>
              {envReady === false && <p className="text-xs text-warning">Größe, Branche und International werden erst gespeichert, wenn das Datenbank-Update in Lovable gelaufen ist.</p>}
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Größe</p>
                <ChipGroup field="company_size_pref" options={COMPANY_SIZE_OPTIONS} value={draft.company_size_pref} onChange={(v) => set({ company_size_pref: v })} />
                <p className="text-xs font-medium">Branche</p>
                <ChipGroup field="industry_change" options={INDUSTRY_CHANGE_OPTIONS} value={draft.industry_change} onChange={(v) => set({ industry_change: v })} />
                <p className="text-xs font-medium">Umzug</p>
                <ChipGroup field="relocation_willing" options={RELOCATION_OPTIONS} value={draft.relocation_willing == null ? null : draft.relocation_willing ? 'yes' : 'no'} onChange={(v) => set({ relocation_willing: v == null ? null : v === 'yes' })} />
                <p className="text-xs font-medium">International</p>
                <ChipGroup field="international_pref" options={INTERNATIONAL_OPTIONS} value={draft.international_pref} onChange={(v) => set({ international_pref: v })} />
              </div>
            </Field>
          </Phase>
        );
      case 'rahmen':
        return (
          <Phase title="Rahmenbedingungen" intro="Erst was das Angebot haben muss, dann das Geld.">
            <div className="space-y-1.5">
              <AngebotBlock form={draft} set={set} />
              <Why>Damit prüfst du später jedes Angebot. Der Kunde sieht es als „Key Requirements“.</Why>
            </div>
            {flowHint('gehalt', 'leaver')}
            {salaryField()}
            {noticeField()}
            {(ASK_NON_COMPETE[family] || draft.non_compete) && (
              <Field label="Gibt es ein Wettbewerbsverbot oder eine Freistellung?" field="non_compete">
                <Why>Kann den Start um Monate verschieben. Nur intern.</Why>
                {flowHint('kundenschutz')}
                <ChipGroup field="non_compete" options={NON_COMPETE_OPTIONS} value={draft.non_compete} onChange={(v) => set({ non_compete: v })} />
              </Field>
            )}
            <div className="space-y-1.5">
              {flowHint('pendeln', 'arbeitsmodell')}
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
                  <span className="text-success">✓ {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}:</span>
                  <span>{draft.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(' · ')}</span>
                  <button type="button" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" onClick={() => setEditSprachen(true)}>ändern</button>
                </div>
              )}
            </Field>
            <Field label="Arbeitserlaubnis" field="work_permit">
              <Why>Nur erfragen, nie aus Name oder Herkunft ableiten.</Why>
              <ArbeitserlaubnisBlock form={draft} set={set} />
            </Field>
          </Phase>
        );
      case 'markt':
        return (
          <Phase title="Markt und Einschätzung">
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
              <PhraseChips field="previous_process_issues" options={PROCESS_ISSUE_OPTIONS} value={draft.previous_process_issues} onChange={(v) => set({ previous_process_issues: v })} />
            </Field>
            <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={draft.presentation_consent === true} onCheckedChange={(v) => set({ presentation_consent: v === true, presentation_consent_at: v === true ? new Date().toISOString() : null })} />
              <span>
                {firstName} ist einverstanden, anonym für passende Positionen vorgestellt zu werden.
                {draft.presentation_consent && draft.presentation_consent_at && <span className="text-muted-foreground"> Erfasst am {new Date(draft.presentation_consent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}{draft.interview_type ? `, ${INTERVIEW_TYPE_OPTIONS.find((o) => o.value === draft.interview_type)?.label}` : ''}.</span>}
                <span className="mt-1 block text-xs text-muted-foreground">Vor jeder konkreten Vorstellung stimmst du dich noch einmal ab.</span>
              </span>
            </label>
            <div className="space-y-4 border-t-2 border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground">Nach dem Gespräch: füllst du allein aus, der Kandidat ist nicht mehr in der Leitung</p>
              {recommendationField()}
              <div className="space-y-2">
                <Field label="Wechselbereitschaft (setzt du selbst)" field="change_readiness">
                  <Why>Aktiv, offen oder passiv. Gibt es nur als deine Einschätzung, nie automatisch.</Why>
                  <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
                </Field>
                {evidence.length > 0 && <p className="text-xs text-muted-foreground">Belege aus dem Gespräch: {evidence.join(' · ')}</p>}
              </div>
            </div>
          </Phase>
        );
      case 'kundenprofil':
        return (
          <Phase title="Kundenprofil" intro="Schreibt sich während des Gesprächs mit, anonym. Jeder Text wird geprüft, bevor er zum Kunden kann.">
            <Button type="button" variant="outline" size="sm" onClick={() => { const g = buildClientSummary(draftRef.current); lastSummaryRef.current = g; set(g); }}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Alle Entwürfe neu erzeugen
            </Button>
            {[
              { key: 'summary_motivation' as const, label: 'Wechselmotivation (Zusammenfassung)' },
              { key: 'summary_salary' as const, label: 'Gehaltsrahmen' },
              { key: 'summary_notice' as const, label: 'Verfügbarkeit und Kündigungsfrist' },
              { key: 'summary_key_requirements' as const, label: 'Key Requirements' },
              { key: 'summary_cultural_fit' as const, label: 'Cultural Fit' },
            ].map((item) => {
              const issues = issuesFor(item.key);
              const locked = item.key === 'summary_salary';
              return (
                <Field
                  key={item.key}
                  label={
                    <span className="flex items-center gap-2">
                      {item.label}
                      {locked ? (
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"><Lock className="h-2.5 w-2.5" />nur aus Klicks</span>
                      ) : draft[item.key].trim() && (
                        <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-normal', editedSummaries.has(item.key) ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                          {editedSummaries.has(item.key) ? 'von dir bearbeitet' : 'Entwurf · aktualisiert sich'}
                        </span>
                      )}
                    </span>
                  }
                  field={item.key}
                >
                  {locked ? (
                    <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{draft.summary_salary || 'Erscheint, sobald das Wunschgehalt gewählt ist.'}</p>
                  ) : (
                    <AreaField field={item.key} value={draft[item.key]} onChange={(v) => set({ [item.key]: v } as Partial<DossierForm>)} rows={2} />
                  )}
                  {issues.map((i) => (
                    <p key={i.message} className={cn('flex flex-wrap items-center gap-2 rounded-md px-2.5 py-1.5 text-xs', i.level === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning')}>
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{i.message}
                      <button type="button" className="underline underline-offset-2" onClick={() => { const g = buildClientSummary(draftRef.current); lastSummaryRef.current = { ...lastSummaryRef.current, [item.key]: g[item.key] }; set({ [item.key]: g[item.key] } as Partial<DossierForm>); }}>Neu übernehmen</button>
                    </p>
                  ))}
                </Field>
              );
            })}
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Kurzprofil für den Kunden · KI-Entwurf, anonym</p>
              <KundeBlock form={draft} set={set} />
              {[...issuesFor('expose_summary'), ...issuesFor('expose_highlights')].filter((i) => i.level === 'danger').map((i) => (
                <p key={i.message} className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><AlertTriangle className="h-3.5 w-3.5" />{i.message}</p>
              ))}
            </div>
            {!textIssues.some((i) => i.level === 'danger') && (
              <p className="flex items-center gap-1.5 rounded-md bg-success/10 px-2.5 py-1.5 text-xs text-success"><Check className="h-3.5 w-3.5" />Geprüft: kein aktuelles Gehalt, keine Schmerzgrenze, keine anderen Bewerbungen, kein Name und kein Arbeitgeber in den Kundentexten.</p>
            )}
          </Phase>
        );
      default:
        return null;
    }
  };

  /** „Nur Fehlendes“: nur die offenen Pflicht- und Einreichen-Punkte, mit denselben Bausteinen. */
  const renderGaps = () => {
    const keys = [...gaps.map((g) => g.key), ...fuerEinreichen.map((m) => m.key)];
    const shown = new Set<string>();
    const blocks: ReactNode[] = [];
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
      else if (k === 'kundentexte') blocks.push(<p key={k} className="text-sm">Ein Kundentext nennt interne Angaben. In Phase 5 „Kundenprofil“ korrigieren.</p>);
      else blocks.push(<p key={k} className="text-sm text-muted-foreground">{readiness.items.find((i) => i.key === k)?.label ?? k}: in der Akte über „Bearbeiten“ ergänzen.</p>);
    }
    return (
      <Phase title="Nur Fehlendes" intro={blocks.length ? 'Nur die Punkte, die zum Abschließen oder Einreichen noch fehlen.' : 'Es fehlt nichts mehr.'}>
        {blocks}
      </Phase>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-border px-6 pb-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-base">Live · {draft.full_name} <span className="ml-1 font-normal tabular-nums text-muted-foreground">{clock}</span></DialogTitle>
            <DialogDescription className="sr-only">Live-Interview in fünf Phasen, speichert automatisch in die Kandidatenakte.</DialogDescription>
            <div className="flex flex-wrap items-center gap-3">
              <span className={cn('text-xs', gaps.length ? 'text-warning' : 'text-success')} title="Pflichtangaben zum Abschließen: Datum, Gesprächsart, Wechselmotivation, Warum jetzt, Wunschgehalt, Kündigungsfrist">Pflicht {6 - gaps.length}/6</span>
              <span className="flex items-center gap-1" title={readiness.missing.length ? `Fehlt: ${readiness.missing.map((m) => m.label).join(', ')}` : 'Bereit zum Einreichen'}>
                {readiness.items.map((i) => (
                  <span key={i.key} className={cn('h-3 w-3 rounded-full border', i.ok ? 'border-success bg-success' : 'border-warning bg-warning')} />
                ))}
                <span className={cn('ml-1 text-xs', readiness.isReady ? 'text-muted-foreground' : 'text-warning')}>{readiness.done} von {readiness.total}</span>
              </span>
              <Input id={fieldId('interview_date')} type="date" aria-label="Datum des Interviews" className={cn('h-8 w-36', gapKeys.has('interview_date') && 'border-warning')} value={draft.interview_date ?? today()} onChange={(e) => set({ interview_date: e.target.value || today() })} />
              <span className={cn('flex items-center gap-2 rounded-md', gapKeys.has('interview_type') && 'ring-2 ring-warning ring-offset-2 ring-offset-background')}>
                {gapKeys.has('interview_type') && <span className="pl-1 text-xs text-warning">Gesprächsart?</span>}
                <ChipGroup field="interview_type" options={INTERVIEW_TYPE_OPTIONS} value={draft.interview_type} onChange={(v) => set({ interview_type: v })} />
              </span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {PHASES.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => { setOnlyMissing(false); goTo(i); }}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  i === phase ? 'border-primary bg-primary/10 text-primary'
                    : phaseMissing(i) ? 'border-warning/60 text-warning'
                    : phaseDone(i, draft) ? 'border-border text-success'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {phaseMissing(i) ? '● ' : phaseDone(i, draft) && i !== phase && '✓ '}
                {i + 1} {p.label}
                {phaseMissing(i) && p.key === 'kundenprofil' && ' · abschließen'}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setOnlyMissing((v) => !v)}
              className={cn('ml-auto rounded-md border px-2.5 py-1 text-xs transition-colors', onlyMissing ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
            >
              {onlyMissing ? 'Alle Fragen zeigen' : 'Nur Fehlendes'}
            </button>
          </div>
          {newColumnsPending && (
            <p className="mt-2 rounded-md bg-warning/10 px-3 py-1.5 text-xs text-warning">
              Einige neue Angaben (z. B. fix oder mit Bonus, Wettbewerbsverbot) werden erst nach dem Datenbank-Update dauerhaft gespeichert. Alles andere ist gesichert.
            </p>
          )}
        </div>
        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div ref={mainRef} className="min-h-0 overflow-y-auto px-6 py-5">
            <FieldMissingContext.Provider value={missingFields}>
              <FieldQuestionContext.Provider value>
                {onlyMissing ? renderGaps() : renderPhase()}
              </FieldQuestionContext.Provider>
            </FieldMissingContext.Provider>
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border bg-muted/30 p-5 md:border-l md:border-t-0">
            {gaps.length > 0 || fuerEinreichen.length > 0 ? (
              <div className="space-y-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                {[
                  { titel: 'Zum Abschließen fehlt', liste: gaps },
                  { titel: gaps.length ? 'Zum Einreichen außerdem' : 'Zum Einreichen fehlt', liste: fuerEinreichen },
                ].filter((g) => g.liste.length).map((g) => (
                  <div key={g.titel} className="space-y-1">
                    <p className="font-semibold">{g.titel}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.liste.map((m) => (
                        <button key={m.key} type="button" onClick={() => jump(m.key)} className="rounded border border-warning/50 px-1.5 py-0.5 hover:bg-warning/10">
                          {m.label}{WHERE[m.key]?.phase === 'kopf' ? ' (oben)' : WHERE[m.key]?.phase === 'akte' ? ' (Akte)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {NEXT_QUESTION[(gaps[0] ?? fuerEinreichen[0]).key] && (
                  <p className="text-muted-foreground">{NEXT_QUESTION[(gaps[0] ?? fuerEinreichen[0]).key]}</p>
                )}
                {kannAbschliessen && (
                  <Button size="sm" className="h-7" onClick={complete} disabled={completing}>
                    {completing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Interview abschließen
                  </Button>
                )}
              </div>
            ) : nurAbschliessen ? (
              <div className="space-y-1.5 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                <p className="font-semibold">Noch 1 Schritt: Interview abschließen</p>
                <p>Alle Mindestangaben sind da.</p>
                <Button size="sm" className="h-7" onClick={complete} disabled={completing}>
                  {completing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}Interview abschließen
                </Button>
              </div>
            ) : readiness.isReady ? (
              <div className="rounded-md bg-success/10 px-3 py-2 text-xs text-success">
                <span className="font-semibold">Bereit zum Einreichen.</span>
              </div>
            ) : null}
            {werdegang.length > 0 && (
              <div className="space-y-1.5 text-xs">
                <p className="text-sm font-semibold">Werdegang {fromCv ? 'aus dem Lebenslauf' : 'aus der Akte'}</p>
                {werdegang.map((w, i) => w.kind === 'gap' ? (
                  <p key={`gap-${i}`} className="border-l-2 border-warning pl-2 leading-tight text-warning">
                    Lücke {monthYear(w.from)} – {monthYear(w.to)} · {w.months} Monate
                  </p>
                ) : (
                  <p key={w.st.id ?? i} className={cn('border-l-2 pl-2 leading-tight', w.st.current ? 'border-success' : w.short ? 'border-warning' : 'border-border')}>
                    <span className={w.st.current ? 'font-medium' : ''}>{w.st.title || 'Station'}</span>
                    <br />
                    <span className="text-muted-foreground">
                      {w.st.company ? `${w.st.company} · ` : ''}{yearsLabel(w.st)}
                      {w.st.current && signals.tenureYears != null ? ` · ${signals.tenureYears} Jahre` : ''}
                    </span>
                    {w.short && <span className="text-warning"> · nur {w.short} Monate</span>}
                  </p>
                ))}
              </div>
            )}
            <div className="space-y-2">
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
              <p className="text-[11px] text-muted-foreground">{saveLabel}</p>
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

            <div className="space-y-1.5 border-t border-border pt-4">
              <div className="flex justify-between text-xs">
                <span className="font-semibold">Bereit zum Einreichen</span>
                <span>{readiness.done} von {readiness.total}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(readiness.done / readiness.total) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-1 text-[11px]">
                {readiness.items.map((i) => (i.ok ? (
                  <span key={i.key} className="text-success">✓ {i.label}</span>
                ) : (
                  <button
                    key={i.key}
                    type="button"
                    className="text-warning hover:underline"
                    onClick={() => (i.key === 'interview' ? (gaps.length ? jump(gaps[0].key) : void complete()) : jump(i.key))}
                  >
                    ● {i.key === 'interview' ? 'Interview abschließen' : i.label}
                  </button>
                )))}
              </div>
            </div>

            <div className="space-y-1 border-t border-border pt-4 text-xs">
              <p className="mb-1 font-semibold">Phasen</p>
              {PHASES.map((p, i) => (
                <button key={p.key} type="button" onClick={() => goTo(i)} className={cn('block w-full text-left hover:underline', phaseMissing(i) ? 'text-warning' : phaseDone(i, draft) ? 'text-success' : 'text-muted-foreground')}>
                  {phaseMissing(i) ? '●' : phaseDone(i, draft) ? '✓' : '○'} {p.label}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <Button variant="outline" onClick={() => goTo(Math.max(0, phase - 1))} disabled={phase === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            {phase > 0 ? PHASES[phase - 1].label : 'Zurück'}
          </Button>
          <span className={cn('hidden text-xs sm:inline', saveState === 'error' ? 'text-destructive' : 'text-muted-foreground')}>{saveLabel}</span>
          {phase < PHASES.length - 1 ? (
            <div className="flex gap-2">
              {/* Alle Mindestangaben da: abschließen aus jeder Phase, nicht erst in Phase 5. */}
              <Button variant={kannAbschliessen ? 'outline' : 'default'} onClick={() => goTo(phase + 1)}>
                Weiter: {PHASES[phase + 1].label}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
              {kannAbschliessen && (
                <Button onClick={complete} disabled={completing}>
                  {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Interview abschließen
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={complete} disabled={completing}>
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Interview abschließen
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

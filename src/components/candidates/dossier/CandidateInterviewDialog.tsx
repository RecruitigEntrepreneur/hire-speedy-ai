import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
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
  FREQUENCY_OPTIONS,
  INTERVIEW_TYPE_OPTIONS,
  LEADERSHIP_OPTIONS,
  OFFER_OPTIONS,
  OTHER_APPLICATIONS_OPTIONS,
  WOULD_STAY_OPTIONS,
  buildClientSummary,
  changeEvidence,
  computeReadiness,
} from '@/lib/candidateDossier';
import { quickExtract, type CaptureSuggestion } from '@/lib/quickExtract';
import { buildReview, freshText, fromAiFields, mergeSuggestions, type ReviewItem } from '@/lib/captureReview';
import type { DossierSaveResult } from '@/hooks/useCandidateDossier';
import { AreaField, ChipGroup, Field, MultiChips, NumberField, TagInput, TextField } from './DossierFields';
import {
  ArbeitsortBlock,
  ArbeitserlaubnisBlock,
  EmpfehlungBlock,
  GehaltBlock,
  KundeBlock,
  MotivationBlock,
  RolleBlock,
  SprachenBlock,
  VerfuegbarkeitBlock,
  ZieleBlock,
} from './DossierBlocks';

// Live-Interview: der Headhunter führt das Gespräch jetzt und geht die Fragen
// direkt mit dem Kandidaten durch. Kein Leitfaden, keine Skripte (die kommen
// in die Akademie). Bekanntes ist vorausgefüllt, rechts steht die freie Notiz
// mit Erkennung beim Tippen und immer die nächste offene Frage.

const PHASES = [
  { key: 'situation', label: 'Situation und Motivation' },
  { key: 'ziele', label: 'Ziele' },
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
};

const today = () => new Date().toISOString().slice(0, 10);

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

function FollowUps({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4 border-l-2 border-border pl-4">
      <p className="text-xs font-semibold text-muted-foreground">Nachfragen</p>
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
  const [analyzing, setAnalyzing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const draftRef = useRef(draft);
  const versionRef = useRef(0);
  const timerRef = useRef<number>();
  const mainRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const baselineNotesRef = useRef('');

  const phaseDone = (i: number, f: DossierForm): boolean => {
    switch (PHASES[i].key) {
      case 'situation': return !!(f.change_motivation.trim() || f.change_motivation_tags.length) && !!(f.current_positive.trim() || f.current_negative.trim() || f.leadership_scope || f.specific_incident.trim());
      case 'ziele': return !!(f.career_ultimate_goal.trim() || f.career_3_5_year_plan.trim() || f.target_roles.length);
      case 'rahmen': return !!f.expected_salary && !!(f.notice_period || f.availability_date);
      case 'markt': return !!f.recommendation && !!(f.other_applications || f.previous_process_issues.trim() || f.blocked_companies.length);
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
  const nextMissing = readiness.missing[0];

  // Erkennung beim Tippen: Schnellerkennung auf der Notiz, dazu KI-Vorschläge
  const liveItems: ReviewItem[] = useMemo(() => {
    const fresh = freshText(draft.additional_notes, baselineNotesRef.current);
    const quick = fresh.trim() ? quickExtract(fresh, 'Notiz').suggestions : [];
    return buildReview(draft, mergeSuggestions(aiSuggestions, quick))
      .filter((i) => i.status !== 'same' && !dismissed.has(`${i.key}:${i.display}`));
  }, [draft, aiSuggestions, dismissed]);

  const applyItem = (i: ReviewItem) => set({ [i.key]: i.value } as Partial<DossierForm>);

  const goTo = (i: number) => {
    setPhase(i);
    if (PHASES[i].key === 'kundenprofil') {
      const f = draftRef.current;
      if (!f.summary_motivation && !f.summary_salary && !f.summary_notice && !f.summary_key_requirements && !f.summary_cultural_fit) {
        const s = buildClientSummary(f);
        if (Object.values(s).some(Boolean)) set(s);
      }
    }
  };

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
    await onComplete();
    const notes = draftRef.current.additional_notes.trim();
    if (user && notes) {
      await supabase.from('candidate_capture_sources' as never).insert({
        candidate_id: candidateId, recruiter_id: user.id, kind: 'live', label: 'Live-Interview', raw_text: notes,
        expires_at: new Date(Date.now() + 365 * 86400000).toISOString(),
      } as never).then(() => undefined, () => undefined);
    }
    setCompleting(false);
    toast.success('Interview gespeichert', { description: readiness.isReady ? `${firstName} ist bereit zum Einreichen.` : `Noch offen: ${readiness.missing.map((m) => m.label).join(', ')}` });
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

  const renderPhase = () => {
    switch (PHASES[phase].key) {
      case 'situation':
        return (
          <Phase title="Situation und Motivation">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Rolle heute (aus der Akte)</p>
              <RolleBlock form={draft} set={set} />
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <Field label="Führungsverantwortung" field="leadership_scope">
                <ChipGroup field="leadership_scope" options={LEADERSHIP_OPTIONS} value={draft.leadership_scope} onChange={(v) => set({ leadership_scope: v })} />
              </Field>
              {draft.leadership_scope && draft.leadership_scope !== 'none' && (
                <Field label="Teamgröße" field="leadership_team_size">
                  <NumberField field="leadership_team_size" value={draft.leadership_team_size} onChange={(v) => set({ leadership_team_size: v })} suffix="Personen" />
                </Field>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Was gefällt Ihnen heute besonders gut?" field="current_positive">
                <AreaField field="current_positive" value={draft.current_positive} onChange={(v) => set({ current_positive: v })} placeholder="Team, Patientenkontakt, …" rows={2} />
              </Field>
              <Field label="Was gefällt Ihnen weniger? Was stört Sie?" field="current_negative">
                <AreaField field="current_negative" value={draft.current_negative} onChange={(v) => set({ current_negative: v })} placeholder="Schichtdienst, …" rows={2} />
              </Field>
            </div>
            <MotivationBlock form={draft} set={set} label="Woher kommt Ihre Wechselmotivation konkret?" />
            <FollowUps>
              <Field label="Gab es einen konkreten Auslöser?" field="specific_incident">
                <TextField field="specific_incident" value={draft.specific_incident} onChange={(v) => set({ specific_incident: v })} placeholder="Neuer Dienstplan, Chefwechsel, …" />
              </Field>
              <Field label="Wie oft kommt das vor?" field="frequency_of_issues">
                <ChipGroup field="frequency_of_issues" options={FREQUENCY_OPTIONS} value={draft.frequency_of_issues} onChange={(v) => set({ frequency_of_issues: v })} />
              </Field>
              <Field label="Warum gerade jetzt?" field="why_now">
                <TextField field="why_now" value={draft.why_now} onChange={(v) => set({ why_now: v })} placeholder="Was ist jetzt anders als vor einem Jahr?" />
              </Field>
              <Field label="Haben Sie das intern angesprochen?" field="discussed_internally">
                <ChipGroup field="discussed_internally" options={DISCUSSED_OPTIONS} value={draft.discussed_internally} onChange={(v) => set({ discussed_internally: v })} />
              </Field>
              <Field label="Würden Sie bleiben, wenn Ihr Arbeitgeber das löst?" field="would_stay" hint="Zeigt dir das Risiko eines Gegenangebots.">
                <ChipGroup field="would_stay" options={WOULD_STAY_OPTIONS} value={draft.would_stay} onChange={(v) => set({ would_stay: v })} />
              </Field>
            </FollowUps>
          </Phase>
        );
      case 'ziele':
        return (
          <Phase title="Karriereziele">
            <Field label="Was wollen Sie ultimativ beruflich erreichen?" field="career_ultimate_goal">
              <AreaField field="career_ultimate_goal" value={draft.career_ultimate_goal} onChange={(v) => set({ career_ultimate_goal: v })} rows={2} />
            </Field>
            <Field label="Was wünschen Sie sich für die nächsten 3–5 Jahre?" field="career_3_5_year_plan">
              <AreaField field="career_3_5_year_plan" value={draft.career_3_5_year_plan} onChange={(v) => set({ career_3_5_year_plan: v })} rows={2} />
            </Field>
            <FollowUps>
              <Field label="Was haben Sie bisher unternommen, um dieses Ziel zu erreichen?" field="career_actions_taken">
                <AreaField field="career_actions_taken" value={draft.career_actions_taken} onChange={(v) => set({ career_actions_taken: v })} rows={2} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Was hat gut funktioniert?" field="career_what_worked">
                  <AreaField field="career_what_worked" value={draft.career_what_worked} onChange={(v) => set({ career_what_worked: v })} rows={2} />
                </Field>
                <Field label="Was weniger?" field="career_what_didnt_work">
                  <AreaField field="career_what_didnt_work" value={draft.career_what_didnt_work} onChange={(v) => set({ career_what_didnt_work: v })} rows={2} />
                </Field>
              </div>
            </FollowUps>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Welche Rollen, Branchen und Orte kommen infrage?</p>
              <ZieleBlock form={draft} set={set} />
            </div>
          </Phase>
        );
      case 'rahmen':
        return (
          <Phase title="Rahmenbedingungen" intro="Vorausgefüllt aus der Akte. Was du hier änderst, steht sofort im Profil.">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Wo liegen Sie aktuell? Wo möchten Sie hin? Was ist Ihre Schmerzgrenze?</p>
              <GehaltBlock form={draft} set={set} />
            </div>
            <Field label="Welche 3 Punkte müsste ein Angebot erfüllen, damit Sie es annehmen?" field="offer_requirements" hint={`${draft.offer_requirements.length} von 3 gewählt`}>
              <MultiChips field="offer_requirements" options={OFFER_OPTIONS} values={draft.offer_requirements} onChange={(v) => set({ offer_requirements: v })} max={3} />
            </Field>
            <VerfuegbarkeitBlock form={draft} set={set} />
            <ArbeitsortBlock form={draft} set={set} />
            <Field label="Sprachen" field="languages">
              <SprachenBlock form={draft} set={set} />
            </Field>
            <Field label="Arbeitserlaubnis" field="work_permit">
              <ArbeitserlaubnisBlock form={draft} set={set} />
            </Field>
          </Phase>
        );
      case 'markt':
        return (
          <Phase title="Markt und Einschätzung">
            <Field label="Laufen aktuell andere Bewerbungen?" field="other_applications">
              <ChipGroup field="other_applications" options={OTHER_APPLICATIONS_OPTIONS} value={draft.other_applications} onChange={(v) => set({ other_applications: v })} />
            </Field>
            {draft.other_applications && draft.other_applications !== 'none' && (
              <Field label="Wo und mit welchem Stand?" field="other_applications_notes">
                <TextField field="other_applications_notes" value={draft.other_applications_notes} onChange={(v) => set({ other_applications_notes: v })} placeholder="Zweites Gespräch nächste Woche, …" />
              </Field>
            )}
            <Field label="Wo sollen wir Sie auf keinen Fall vorstellen?" field="blocked_companies">
              <TagInput field="blocked_companies" values={draft.blocked_companies} onChange={(v) => set({ blocked_companies: v })} placeholder="Aktueller Arbeitgeber, …" />
            </Field>
            <Field label="Was lief in früheren Bewerbungsprozessen nicht gut?" field="previous_process_issues">
              <AreaField field="previous_process_issues" value={draft.previous_process_issues} onChange={(v) => set({ previous_process_issues: v })} placeholder="Lange Wartezeiten, kein Feedback, …" rows={2} />
            </Field>
            <div className="border-t border-border pt-4">
              <EmpfehlungBlock form={draft} set={set} question={`Würdest du ${firstName} empfehlen?`} />
            </div>
            <div className="space-y-2">
              <Field label="Wechselbereitschaft (setzt du selbst)" field="change_readiness">
                <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
              </Field>
              {evidence.length > 0 && <p className="text-xs text-muted-foreground">Belege aus dem Gespräch: {evidence.join(' · ')}</p>}
            </div>
            <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={draft.presentation_consent === true} onCheckedChange={(v) => set({ presentation_consent: v === true, presentation_consent_at: v === true ? new Date().toISOString() : null })} />
              <span>
                {firstName} ist einverstanden, anonym für passende Positionen vorgestellt zu werden.
                {draft.presentation_consent && draft.presentation_consent_at && <span className="text-muted-foreground"> Erfasst am {new Date(draft.presentation_consent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}{draft.interview_type ? `, ${INTERVIEW_TYPE_OPTIONS.find((o) => o.value === draft.interview_type)?.label}` : ''}.</span>}
                <span className="mt-1 block text-xs text-muted-foreground">Vor jeder konkreten Vorstellung stimmst du dich noch einmal ab.</span>
              </span>
            </label>
          </Phase>
        );
      case 'kundenprofil':
        return (
          <Phase title="Kundenprofil" intro="Aus deinen Antworten vorbefüllt. Der Kunde sieht diese Texte anonym im Exposé, nie Schmerzgrenze, aktuelles Gehalt oder andere Bewerbungen.">
            <Button type="button" variant="outline" size="sm" onClick={() => set(buildClientSummary(draftRef.current))}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Aus dem Interview neu übernehmen
            </Button>
            {[
              { key: 'summary_motivation' as const, label: 'Wechselmotivation (Zusammenfassung)' },
              { key: 'summary_salary' as const, label: 'Gehaltsrahmen' },
              { key: 'summary_notice' as const, label: 'Verfügbarkeit und Kündigungsfrist' },
              { key: 'summary_key_requirements' as const, label: 'Key Requirements' },
              { key: 'summary_cultural_fit' as const, label: 'Cultural Fit' },
            ].map((item) => (
              <Field key={item.key} label={item.label} field={item.key}>
                <AreaField field={item.key} value={draft[item.key]} onChange={(v) => set({ [item.key]: v } as Partial<DossierForm>)} rows={2} />
              </Field>
            ))}
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs font-semibold text-muted-foreground">Kurzprofil für den Kunden · KI-Entwurf, anonym</p>
              <KundeBlock form={draft} set={set} />
            </div>
          </Phase>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-border px-6 pb-3 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-base">Live · {draft.full_name} <span className="ml-1 font-normal tabular-nums text-muted-foreground">{clock}</span></DialogTitle>
            <DialogDescription className="sr-only">Live-Interview in fünf Phasen, speichert automatisch in die Kandidatenakte.</DialogDescription>
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1" title={readiness.missing.length ? `Fehlt: ${readiness.missing.map((m) => m.label).join(', ')}` : 'Bereit zum Einreichen'}>
                {readiness.items.map((i) => (
                  <span key={i.key} className={cn('h-3 w-3 rounded-full border', i.ok ? 'border-success bg-success' : 'border-muted-foreground/40')} />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">{readiness.done} von {readiness.total}</span>
              </span>
              <Input type="date" aria-label="Datum des Interviews" className="h-8 w-36" value={draft.interview_date ?? today()} onChange={(e) => set({ interview_date: e.target.value || today() })} />
              <ChipGroup options={INTERVIEW_TYPE_OPTIONS} value={draft.interview_type} onChange={(v) => set({ interview_type: v })} />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PHASES.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs transition-colors',
                  i === phase ? 'border-primary bg-primary/10 text-primary' : phaseDone(i, draft) ? 'border-border text-success' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {phaseDone(i, draft) && i !== phase && '✓ '}
                {i + 1} {p.label}
              </button>
            ))}
          </div>
          {newColumnsPending && (
            <p className="mt-2 rounded-md bg-warning/10 px-3 py-1.5 text-xs text-warning">
              Gesprächsart, Führung, andere Bewerbungen, Sperrliste, Einverständnis, Empfehlungsstufe und Wechselbereitschaft werden erst nach dem Datenbank-Update dauerhaft gespeichert. Alles andere ist gesichert.
            </p>
          )}
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_320px]">
          <div ref={mainRef} className="min-h-0 overflow-y-auto px-6 py-5">
            {renderPhase()}
          </div>

          <aside className="min-h-0 space-y-4 overflow-y-auto border-t border-border bg-muted/30 p-5 md:border-l md:border-t-0">
            {nextMissing && (
              <div className="rounded-md bg-primary/10 px-3 py-2 text-xs text-primary">
                <span className="font-semibold">Noch offen: {nextMissing.label}.</span> {NEXT_QUESTION[nextMissing.key]}
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
            </div>

            <div className="space-y-1 border-t border-border pt-4 text-xs">
              <p className="mb-1 font-semibold">Phasen</p>
              {PHASES.map((p, i) => (
                <button key={p.key} type="button" onClick={() => goTo(i)} className={cn('block w-full text-left hover:underline', phaseDone(i, draft) ? 'text-success' : 'text-muted-foreground')}>
                  {phaseDone(i, draft) ? '✓' : '○'} {p.label}
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
            <Button onClick={() => goTo(phase + 1)}>
              Weiter: {PHASES[phase + 1].label}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
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

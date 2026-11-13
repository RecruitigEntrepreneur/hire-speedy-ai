import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, FileUp, Loader2, MessageCircle, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth';
import { intlLocale } from '@/i18n/languages';
import { term } from '@/lib/candidateTerms';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { docxToText, isDocx } from '@/lib/docxText';
import {
  CHANGE_READINESS_OPTIONS,
  DossierForm,
  INTERVIEW_TYPE_OPTIONS,
  MOTIVATION_TAGS,
  RECOMMENDATION_OPTIONS,
  buildExposeDraft,
  changeEvidence,
  computeReadiness,
  abschlussGaps,
} from '@/lib/candidateDossier';
import { quickExtract, type CaptureSuggestion } from '@/lib/quickExtract';
import {
  CAPTURE_PHASES,
  Decision,
  ReviewItem,
  applyReview,
  buildReview,
  defaultDecisions,
  fromAiFields,
  looksLikeTranscript,
  mergeSuggestions,
  reviewCounts,
} from '@/lib/captureReview';
import type { DossierSaveResult } from '@/hooks/useCandidateDossier';
import { ChipGroup, Field, MoneyInput, MultiChips, TagInput } from './DossierFields';
import { EmpfehlungBlock, KontaktBlock, KundeBlock, MotivationBlock, RolleBlock, VerfuegbarkeitBlock } from './DossierBlocks';
import type { EditFocus } from './CandidateEditSheet';

type Step = 'input' | 'analyzing' | 'review' | 'close' | 'gaps' | 'quick';
type SourceKind = 'notes' | 'transcript';

interface Source {
  id: string;
  label: string;
  text: string;
  kind: SourceKind;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'import' | 'quick';
  candidateId: string;
  form: DossierForm;
  onSave: (form: DossierForm) => Promise<DossierSaveResult>;
  onEdit?: (focus: EditFocus) => void;
  onSubmitToJob?: () => void;
  /** Setzt das Interview auf abgeschlossen (useCandidateDossier.markInterviewCompleted). */
  onComplete?: () => Promise<void>;
  /** Hochgeladener Lebenslauf vorhanden (8. Punkt von „Bereit zum Einreichen“) */
  hasCv?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

const dots = (n: 1 | 2 | 3, label: string) => (
  <span className="inline-flex gap-0.5" aria-label={label}>
    {[1, 2, 3].map((i) => (
      <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i <= n ? 'bg-success' : 'bg-muted-foreground/30')} />
    ))}
  </span>
);

export function CaptureDialog({ open, onOpenChange, mode, candidateId, form, onSave, onEdit, onSubmitToJob, onComplete, hasCv = false }: Props) {
  const { user } = useAuth();
  const { t, i18n } = useTranslation(['candidateCapture', 'candidateTerms', 'candidateInterview']);
  const locale = intlLocale(i18n.language);
  const euro = (n: number) => `${n.toLocaleString(locale)} €`;
  const [step, setStep] = useState<Step>('input');
  const [sources, setSources] = useState<Source[]>([]);
  const [paste, setPaste] = useState('');
  const [consent, setConsent] = useState(false);
  const [reading, setReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [protectedMentions, setProtectedMentions] = useState<string[]>([]);
  const [openPhases, setOpenPhases] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(0);
  const [draft, setDraft] = useState<DossierForm>(form);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(mode === 'quick' ? 'quick' : 'input');
    setSources([]);
    setPaste('');
    setConsent(false);
    setAiNote(null);
    setItems([]);
    setDecisions({});
    setProtectedMentions([]);
    setOpenPhases(new Set());
    setFocusIdx(0);
    setDraft(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const hasTranscript = sources.some((s) => s.kind === 'transcript') || (paste.trim() ? looksLikeTranscript(paste) : false);
  const cards = useMemo(() => items.filter((i) => i.status === 'uncertain' || i.status === 'conflict' || i.status === 'sensitive'), [items]);
  const counts = useMemo(() => reviewCounts(items), [items]);
  const acceptedCount = items.filter((i) => i.status !== 'same' && decisions[i.id] === 'accept').length;
  const readiness = useMemo(() => computeReadiness(draft, hasCv), [draft, hasCv]);
  const firstName = draft.full_name.split(' ')[0] || t('thePerson');

  const set = (patch: Partial<DossierForm>) => setDraft((d) => ({ ...d, ...patch }));

  const addPasted = () => {
    const text = paste.trim();
    if (!text) return;
    const kind: SourceKind = looksLikeTranscript(text) ? 'transcript' : 'notes';
    setSources((s) => [...s, { id: uid(), label: kind === 'transcript' ? 'Eingefügtes Transkript' : 'Eingefügte Notizen', text, kind }]);
    setPaste('');
  };

  const readFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (/\.(txt|md|vtt|srt|csv)$/.test(name) || file.type.startsWith('text/')) return file.text();
    if (isDocx(file)) return docxToText(file);
    if (/\.pdf$/.test(name) || file.type === 'application/pdf') {
      if (!user) throw new Error(t('err.notSignedIn'));
      const path = `${user.id}/capture-${Date.now()}-${name.replace(/[^a-z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('cv-documents').upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke('parse-pdf', { body: { pdfPath: path } });
      if (error) throw error;
      const text = (data as { text?: string; extractedText?: string } | null)?.text ?? (data as { extractedText?: string } | null)?.extractedText ?? '';
      if (!text) throw new Error(t('err.noPdfText'));
      return text;
    }
    if (file.type.startsWith('image/')) throw new Error(t('err.photos'));
    if (file.type.startsWith('audio/')) throw new Error(t('err.audio'));
    throw new Error(t('err.format'));
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setReading(true);
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const text = (await readFile(file)).trim();
        if (!text) continue;
        const kind: SourceKind = /\.(vtt|srt)$/i.test(file.name) || looksLikeTranscript(text) ? 'transcript' : 'notes';
        setSources((s) => [...s, { id: uid(), label: file.name, text, kind }]);
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : t('err.unreadable')}`);
      }
    }
    setReading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const analyze = async () => {
    const all: Source[] = [...sources];
    if (paste.trim()) {
      const text = paste.trim();
      all.push({ id: uid(), label: looksLikeTranscript(text) ? 'Eingefügtes Transkript' : 'Eingefügte Notizen', text, kind: looksLikeTranscript(text) ? 'transcript' : 'notes' });
      setSources(all);
      setPaste('');
    }
    if (!all.length) return;
    if (all.some((s) => s.kind === 'transcript') && !consent) {
      toast.error(t('err.consent'));
      return;
    }
    setStep('analyzing');
    // Schnellerkennung sofort, KI parallel
    let quick: CaptureSuggestion[] = [];
    const prot = new Set<string>();
    for (const s of all) {
      const r = quickExtract(s.text, s.label);
      quick = mergeSuggestions([], [...quick, ...r.suggestions.filter((x) => !quick.some((q) => q.key === x.key && q.confidence >= x.confidence))]);
      r.protectedMentions.forEach((p) => prot.add(p));
    }
    let ai: CaptureSuggestion[] = [];
    try {
      const { data, error } = await supabase.functions.invoke('extract-candidate-dossier', {
        body: { candidateId, sources: all.map((s) => ({ label: s.label, text: s.text })) },
      });
      if (error || !data?.success) throw error ?? new Error(data?.message ?? t('err.analysis'));
      ai = fromAiFields(data.fields ?? [], t('candidateInterview:dlg.ai'));
      (data.protected_mentions ?? []).forEach((p: string) => prot.add(p));
      setAiNote(null);
    } catch {
      setAiNote(t('aiNote'));
    }
    const built = buildReview(form, mergeSuggestions(ai, quick));
    setItems(built);
    setDecisions(defaultDecisions(built));
    setProtectedMentions([...prot]);
    setFocusIdx(0);
    setStep('review');
  };

  const saveSources = async (accepted: number) => {
    if (!user || !sources.length) return;
    const now = Date.now();
    const rows = sources.map((s) => ({
      candidate_id: candidateId,
      recruiter_id: user.id,
      kind: s.kind,
      label: s.label,
      raw_text: s.text,
      recording_consent: s.kind === 'transcript' ? consent : null,
      suggestions_total: items.filter((i) => i.status !== 'same').length,
      suggestions_accepted: accepted,
      expires_at: new Date(now + (s.kind === 'transcript' ? 30 : 365) * 86400000).toISOString(),
    }));
    // Tabelle kommt mit Migration 20260929120000; bis dahin still überspringen
    await supabase.from('candidate_capture_sources' as never).insert(rows as never).then(() => undefined, () => undefined);
  };

  const persist = async (next: DossierForm): Promise<boolean> => {
    setSaving(true);
    const r = await onSave(next);
    setSaving(false);
    if (!r.ok) {
      toast.error(t('toast.saveFailed'), { description: r.error });
      return false;
    }
    return true;
  };

  // Auch ein nachgetragenes Gespräch („Aus dem Kopf“, Notizen) kann das Interview
  // abschließen -- mit denselben Mindestangaben wie das Live-Interview.
  const finishInterview = async () => {
    const next = { ...draft, interview_date: draft.interview_date ?? format(new Date(), 'yyyy-MM-dd') };
    const gaps = abschlussGaps(next);
    if (gaps.length) {
      toast.error(t('toast.missing'), { description: `${gaps.map((g) => term(g.label)).join(', ')}.` });
      return;
    }
    if (!(await persist(next)) || !onComplete) return;
    setSaving(true);
    await onComplete();
    setSaving(false);
    setDraft({ ...next, interview_status: 'completed' });
    toast.success(t('toast.completed'));
  };

  const acceptReview = async () => {
    const next = applyReview(form, items, decisions);
    // Unberührter Entwurf zieht mit, selbst geschriebene Texte bleiben (Hinweis im Kurzprofil)
    if (form.expose_summary.trim() && form.expose_summary.trim() === buildExposeDraft(form)) next.expose_summary = buildExposeDraft(next);
    if (!(await persist(next))) return;
    await saveSources(acceptedCount);
    setDraft(next);
    toast.success(t('toast.applied', { count: acceptedCount }));
    setStep('close');
  };

  // Tastatur im Prüf-Screen: J/K weiter, Enter übernehmen, X verwerfen
  useEffect(() => {
    if (!open || step !== 'review' || !cards.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const card = cards[Math.min(focusIdx, cards.length - 1)];
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx((i) => Math.min(i + 1, cards.length - 1)); }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter' && card) { e.preventDefault(); setDecisions((d) => ({ ...d, [card.id]: 'accept' })); setFocusIdx((i) => Math.min(i + 1, cards.length - 1)); }
      else if ((e.key === 'x' || e.key === 'Backspace') && card) { e.preventDefault(); setDecisions((d) => ({ ...d, [card.id]: 'reject' })); setFocusIdx((i) => Math.min(i + 1, cards.length - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, cards, focusIdx]);

  const whatsappLink = () => {
    const digits = draft.phone.replace(/[^\d]/g, '').replace(/^00/, '').replace(/^0/, '49');
    if (!digits) return null;
    const q: string[] = [];
    if (!draft.expected_salary) q.push(t('candidateInterview:next.gehalt'));
    if (!draft.notice_period && !draft.availability_date) q.push(t('candidateInterview:next.verfuegbarkeit'));
    if (!draft.change_motivation.trim() && !draft.change_motivation_tags.length) q.push(t('candidateInterview:next.motivation'));
    if (!q.length) return null;
    const text = t('whatsapp', { name: firstName, questions: q.join(' ') });
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const title =
    step === 'quick' ? t('title.quick')
    : step === 'review' ? t('title.review')
    : step === 'close' ? t('title.close')
    : step === 'gaps' ? (readiness.isReady ? t('title.complete') : t('title.open'))
    : t('title.input');

  // Am Stand beim Öffnen verankert, damit die Knöpfe nach dem Klick nicht springen
  const salaryBase = Math.round(((form.expected_salary ?? form.current_salary ?? 45000) as number) / 1000) * 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-border px-6 pb-3 pt-5">
          <DialogTitle className="pr-8 text-base">{title} · {draft.full_name}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {step === 'input' && t('desc.input')}
            {step === 'analyzing' && t('desc.analyzing')}
            {step === 'review' && t('desc.review')}
            {step === 'close' && t('desc.close')}
            {step === 'gaps' && (readiness.isReady ? t('desc.gapsReady') : t('desc.gaps'))}
            {step === 'quick' && t('desc.quick')}
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {step === 'input' && (
            <div className="space-y-4">
              <div
                className="rounded-lg border border-dashed border-border p-4"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
              >
                <Textarea
                  value={paste}
                  onChange={(e) => setPaste(e.target.value)}
                  placeholder={t('input.placeholder')}
                  rows={7}
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{t('input.orFile')}</span>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.docx,.pdf,text/plain,application/pdf" className="hidden" onChange={(e) => onFiles(e.target.files)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                      {reading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}{t('input.chooseFile')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addPasted} disabled={!paste.trim()}>{t('input.addSource')}</Button>
                  </div>
                </div>
              </div>
              {sources.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sources.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{term(s.label)} <span className="text-xs text-muted-foreground">· {s.kind === 'transcript' ? t('input.transcript') : t('input.notes')} · {t('input.chars', { n: s.text.length.toLocaleString(locale) })}</span></span>
                      <button type="button" aria-label={t('input.removeSource')} className="text-muted-foreground hover:text-destructive" onClick={() => setSources((all) => all.filter((x) => x.id !== s.id))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {hasTranscript && (
                <label className="flex items-start gap-2.5 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                  <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                  <span>{t('input.recording', { name: firstName })} <span className="block text-xs opacity-90">{t('input.recordingLaw')}</span></span>
                </label>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{t('analyzing')}</span>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {aiNote && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{aiNote}</p>}
              <p className="text-sm">
                {t('review.found', { n: counts.total - counts.same })} · <span className="text-success">{t('review.safe', { n: counts.safe })}</span> · <span className="text-warning">{t('review.check', { n: counts.uncertain })}</span> · <span className="text-destructive">{t('review.conflict', { n: counts.conflict })}</span> · {t('review.sensitive', { n: counts.sensitive })}
                {counts.same > 0 && <span className="text-muted-foreground"> · {t('review.same', { n: counts.same })}</span>}
              </p>
              {counts.total - counts.same === 0 && <p className="text-sm text-muted-foreground">{t('review.nothing')}</p>}

              {CAPTURE_PHASES.map((p) => {
                const safe = items.filter((i) => i.phase === p.key && i.status === 'safe');
                if (!safe.length) return null;
                const isOpen = openPhases.has(p.key);
                const acceptedHere = safe.filter((i) => decisions[i.id] === 'accept').length;
                return (
                  <div key={p.key} className="rounded-md border border-border">
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setOpenPhases((s) => { const n = new Set(s); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; })}>
                      <span>{t('review.phaseApplied', { phase: term(p.label), accepted: acceptedHere, total: safe.length })}</span>
                      <span className="flex items-center gap-1 text-success"><Check className="h-4 w-4" />{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                    </button>
                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {safe.map((i) => (
                          <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="text-muted-foreground">{term(i.label)}: </span>{term(i.display)}
                              <span className="block text-xs italic text-muted-foreground">„{i.quote}“{i.sourceLabel ? ` · ${term(i.sourceLabel)}` : ''}</span>
                            </span>
                            <button type="button" className={cn('shrink-0 text-xs', decisions[i.id] === 'accept' ? 'text-success' : 'text-muted-foreground')} onClick={() => setDecisions((d) => ({ ...d, [i.id]: d[i.id] === 'accept' ? 'reject' : 'accept' }))}>
                              {decisions[i.id] === 'accept' ? t('review.applied') : t('review.rejected')}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}

              {cards.map((c, idx) => {
                const dec = decisions[c.id];
                return (
                  <div key={c.id} onClick={() => setFocusIdx(idx)} className={cn('rounded-md border p-3 text-sm', idx === focusIdx ? 'border-primary' : 'border-border')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{term(c.label)}</span>
                      <span className="flex items-center gap-2 text-xs">
                        {c.status === 'conflict' && <span className="text-destructive">{t('review.conflictWithFile')}</span>}
                        {c.status === 'sensitive' && <span className="text-warning">{t('review.sensitiveConfirm')}</span>}
                        {c.status === 'uncertain' && <span className="text-warning">{t('review.uncertain')}</span>}
                        {dots(c.confidence, t('confidence', { n: c.confidence }))}
                      </span>
                    </div>
                    <div className="mt-1">
                      {c.status === 'conflict' ? (
                        <span><span className="text-muted-foreground line-through">{term(c.currentDisplay)}</span> → {term(c.display)}</span>
                      ) : term(c.display)}
                    </div>
                    <div className="mt-1 text-xs italic text-muted-foreground">„{c.quote}“{c.sourceLabel ? ` · ${term(c.sourceLabel)}` : ''}</div>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" variant={dec === 'reject' ? 'default' : 'outline'} onClick={() => setDecisions((d) => ({ ...d, [c.id]: 'reject' }))}>
                        {c.status === 'conflict' ? t('review.keepFile') : t('review.reject')}
                      </Button>
                      <Button type="button" size="sm" variant={dec === 'accept' ? 'default' : 'outline'} onClick={() => setDecisions((d) => ({ ...d, [c.id]: 'accept' }))}>
                        {c.status === 'conflict' ? t('review.applyNew') : t('review.apply')}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {protectedMentions.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t('review.protected', { list: protectedMentions.map((p) => term(p)).join(', ') })}
                </p>
              )}
            </div>
          )}

          {step === 'close' && (
            <div className="space-y-5">
              <EmpfehlungBlock form={draft} set={set} question={t('close.recommend', { name: firstName })} />
              <div className="space-y-2">
                <Field label={t('close.readiness')} field="change_readiness">
                  <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
                </Field>
                {changeEvidence(draft).length > 0 && (
                  <p className="text-xs text-muted-foreground">{t('close.evidence', { list: changeEvidence(draft).map((e) => term(e)).join(' · ') })}</p>
                )}
              </div>
              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
                <Checkbox className="mt-0.5" checked={draft.presentation_consent === true} onCheckedChange={(v) => set({ presentation_consent: v === true, presentation_consent_at: v === true ? new Date().toISOString() : null })} />
                <span>
                  {t('close.consent', { name: firstName })}
                  {draft.presentation_consent && draft.presentation_consent_at && <span className="text-muted-foreground">{t('close.recorded', { date: new Date(draft.presentation_consent_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }) })}</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">{t('close.consentNote')}</span>
                </span>
              </label>
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">{t('close.clientProfile')}</p>
                <KundeBlock form={draft} set={set} />
              </div>
            </div>
          )}

          {step === 'quick' && (
            <div className="space-y-5">
              <Field label={t('quick.salary')} field="expected_salary">
                <div className="flex flex-wrap items-center gap-2">
                  {[salaryBase - 5000, salaryBase, salaryBase + 5000].filter((v) => v > 0).map((v) => (
                    <button key={v} type="button" onClick={() => set({ expected_salary: v })} className={cn('rounded-md border px-2.5 py-1 text-xs', draft.expected_salary === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                      {euro(v)}
                    </button>
                  ))}
                  <div className="w-36"><MoneyInput value={draft.expected_salary} onChange={(v) => set({ expected_salary: v })} placeholder={t('quick.otherAmount')} /></div>
                </div>
              </Field>
              <VerfuegbarkeitBlock form={draft} set={set} />
              <Field label={t('quick.motivation')} field="change_motivation_tags">
                <MultiChips options={MOTIVATION_TAGS} values={draft.change_motivation_tags} onChange={(v) => set({ change_motivation_tags: v })} />
              </Field>
              <Field label={t('quick.oneSentence')} field="change_motivation">
                <Textarea value={draft.change_motivation} onChange={(e) => set({ change_motivation: e.target.value })} rows={2} placeholder={t('quick.whyPlaceholder')} />
              </Field>
              <EmpfehlungBlock form={draft} set={set} question={t('close.recommend', { name: firstName })} />
              <Field label={t('close.readiness')} field="change_readiness">
                <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
              </Field>
              <p className="text-xs text-muted-foreground">{t('quick.rest')}</p>
            </div>
          )}

          {step === 'gaps' && (
            <div className="space-y-5">
              {readiness.isReady ? (
                <div className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
                  <Check className="mr-1.5 inline h-4 w-4" />{t('gaps.allComplete', { total: readiness.total, name: firstName })}
                </div>
              ) : (
                <p className="text-sm font-medium">{t('gaps.remaining', { n: readiness.missing.length })}</p>
              )}
              {readiness.missing.map((m) => (
                <div key={m.key} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{term(m.label)}</p>
                  {m.key === 'gehalt' && <MoneyInput value={draft.expected_salary} onChange={(v) => set({ expected_salary: v })} />}
                  {m.key === 'verfuegbarkeit' && <VerfuegbarkeitBlock form={draft} set={set} />}
                  {m.key === 'motivation' && <MotivationBlock form={draft} set={set} />}
                  {m.key === 'einschaetzung' && <ChipGroup options={RECOMMENDATION_OPTIONS} value={draft.recommendation} onChange={(v) => set({ recommendation: v })} />}
                  {m.key === 'skills' && <TagInput values={draft.skills} onChange={(v) => set({ skills: v })} placeholder={t('gaps.skillsPlaceholder')} />}
                  {m.key === 'rolle' && <RolleBlock form={draft} set={set} />}
                  {m.key === 'kontakt' && <KontaktBlock form={draft} set={set} />}
                  {m.key === 'interview' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input type="date" aria-label={t('gaps.dateAria')} className="h-8 w-40" value={draft.interview_date ?? format(new Date(), 'yyyy-MM-dd')} onChange={(e) => set({ interview_date: e.target.value || null })} />
                        <ChipGroup options={INTERVIEW_TYPE_OPTIONS} value={draft.interview_type} onChange={(v) => set({ interview_type: v })} />
                      </div>
                      <Textarea value={draft.why_now} onChange={(e) => set({ why_now: e.target.value })} rows={2} placeholder={t('gaps.whyNowPlaceholder')} />
                      {onComplete && (
                        <Button size="sm" variant="outline" onClick={() => void finishInterview()} disabled={saving}>
                          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('gaps.completeInterview')}
                        </Button>
                      )}
                    </div>
                  )}
                  {m.action === 'upload_cv' && <p className="text-xs text-muted-foreground">{t('gaps.cv')}</p>}
                </div>
              ))}
              {!readiness.isReady && whatsappLink() && (
                <a href={whatsappLink()!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                  <MessageCircle className="h-4 w-4" /> {t('gaps.whatsapp', { name: firstName })}
                </a>
              )}
              {onEdit && readiness.missing.some((m) => !m.action) && (
                <button type="button" className="block text-xs text-muted-foreground underline underline-offset-2" onClick={() => { const first = readiness.missing.find((m) => !m.action); onOpenChange(false); onEdit({ field: first?.field, section: first?.section }); }}>
                  {t('gaps.editPanel')}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="mr-1 h-4 w-4" />{t('foot.close')}
          </Button>
          <div className="flex gap-2">
            {step === 'input' && (
              <Button onClick={analyze} disabled={reading || (!sources.length && !paste.trim()) || (hasTranscript && !consent)}>
                <Sparkles className="mr-1.5 h-4 w-4" />{t('foot.analyze')}
              </Button>
            )}
            {step === 'review' && (
              <Button onClick={acceptReview} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {acceptedCount ? t('foot.applyCount', { n: acceptedCount }) : t('foot.next')}
              </Button>
            )}
            {step === 'close' && (
              <>
                <Button variant="outline" onClick={() => setStep('gaps')} disabled={saving}>{t('foot.skip')}</Button>
                <Button onClick={async () => { if (await persist(draft)) setStep('gaps'); }} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('foot.save')}
                </Button>
              </>
            )}
            {step === 'quick' && (
              <Button onClick={async () => { if (await persist(draft)) setStep('gaps'); }} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('foot.saveRest')}
              </Button>
            )}
            {step === 'gaps' && (
              readiness.isReady && onSubmitToJob ? (
                <Button onClick={async () => { if (await persist(draft)) { onOpenChange(false); onSubmitToJob(); } }} disabled={saving}>
                  <Send className="mr-1.5 h-4 w-4" />{t('foot.submit')}
                </Button>
              ) : (
                <Button onClick={async () => { if (await persist(draft)) onOpenChange(false); }} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('foot.done')}
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

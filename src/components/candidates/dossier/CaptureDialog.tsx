import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, FileUp, Loader2, MessageCircle, Send, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { docxToText, isDocx } from '@/lib/docxText';
import {
  CHANGE_READINESS_OPTIONS,
  DossierForm,
  MOTIVATION_TAGS,
  NOTICE_OPTIONS,
  RECOMMENDATION_OPTIONS,
  buildExposeDraft,
  changeEvidence,
  computeReadiness,
  formatEuro,
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
import { EmpfehlungBlock, KontaktBlock, KundeBlock, MotivationBlock, RolleBlock } from './DossierBlocks';
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
}

const uid = () => Math.random().toString(36).slice(2, 10);

const dots = (n: 1 | 2 | 3) => (
  <span className="inline-flex gap-0.5" aria-label={`Sicherheit ${n} von 3`}>
    {[1, 2, 3].map((i) => (
      <span key={i} className={cn('h-1.5 w-1.5 rounded-full', i <= n ? 'bg-success' : 'bg-muted-foreground/30')} />
    ))}
  </span>
);

export function CaptureDialog({ open, onOpenChange, mode, candidateId, form, onSave, onEdit, onSubmitToJob }: Props) {
  const { user } = useAuth();
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
  const readiness = useMemo(() => computeReadiness(draft), [draft]);
  const firstName = draft.full_name.split(' ')[0] || 'die Person';

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
      if (!user) throw new Error('Nicht angemeldet');
      const path = `${user.id}/capture-${Date.now()}-${name.replace(/[^a-z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('cv-documents').upload(path, file);
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke('parse-pdf', { body: { pdfPath: path } });
      if (error) throw error;
      const text = (data as { text?: string; extractedText?: string } | null)?.text ?? (data as { extractedText?: string } | null)?.extractedText ?? '';
      if (!text) throw new Error('Kein Text im PDF gefunden');
      return text;
    }
    if (file.type.startsWith('image/')) throw new Error('Fotos vom Notizblock kommen im nächsten Schritt. Bitte vorerst abtippen oder als PDF/Text einwerfen.');
    if (file.type.startsWith('audio/')) throw new Error('Sprachmemos kommen im nächsten Schritt.');
    throw new Error('Dieses Format wird noch nicht unterstützt.');
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
        toast.error(`${file.name}: ${e instanceof Error ? e.message : 'nicht lesbar'}`);
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
      toast.error('Bitte bestätige, dass der Kandidat der Aufzeichnung zugestimmt hat.');
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
      if (error || !data?.success) throw error ?? new Error(data?.message ?? 'Auswertung fehlgeschlagen');
      ai = fromAiFields(data.fields ?? [], 'KI');
      (data.protected_mentions ?? []).forEach((p: string) => prot.add(p));
      setAiNote(null);
    } catch {
      setAiNote('Die KI-Auswertung ist gerade nicht verfügbar. Gezeigt wird die Schnellerkennung (Gehalt, Fristen, Sprachen, Motivation, Arbeitsort).');
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
      toast.error('Speichern hat nicht geklappt', { description: r.error });
      return false;
    }
    return true;
  };

  const acceptReview = async () => {
    const next = applyReview(form, items, decisions);
    // Unberührter Entwurf zieht mit, selbst geschriebene Texte bleiben (Hinweis im Kurzprofil)
    if (form.expose_summary.trim() && form.expose_summary.trim() === buildExposeDraft(form)) next.expose_summary = buildExposeDraft(next);
    if (!(await persist(next))) return;
    await saveSources(acceptedCount);
    setDraft(next);
    toast.success(`${acceptedCount} Angaben übernommen`);
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
    if (!draft.expected_salary) q.push('Welches Jahresgehalt stellen Sie sich vor?');
    if (!draft.notice_period && !draft.availability_date) q.push('Wie lang ist Ihre Kündigungsfrist?');
    if (!draft.change_motivation.trim() && !draft.change_motivation_tags.length) q.push('Was ist für Sie der wichtigste Grund für einen Wechsel?');
    if (!q.length) return null;
    const text = `Hallo ${firstName}, danke für unser Gespräch! Eine kurze Rückfrage: ${q.join(' ')}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const title =
    step === 'quick' ? 'Aus dem Kopf erfassen'
    : step === 'review' ? 'Prüfen'
    : step === 'close' ? 'Abschluss'
    : step === 'gaps' ? (readiness.isReady ? 'Alles komplett' : 'Noch offen')
    : 'Gespräch einwerfen';

  // Am Stand beim Öffnen verankert, damit die Knöpfe nach dem Klick nicht springen
  const salaryBase = Math.round(((form.expected_salary ?? form.current_salary ?? 45000) as number) / 1000) * 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[96vw] max-w-3xl flex-col gap-0 overflow-hidden p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="border-b border-border px-6 pb-3 pt-5">
          <DialogTitle className="pr-8 text-base">{title} · {draft.full_name}</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            {step === 'input' && 'Eigene Notizen, Transkript oder Mail einfügen oder als Datei ziehen. Das Tool verteilt alles auf die Akte, du prüfst nur noch.'}
            {step === 'analyzing' && 'Wird ausgewertet …'}
            {step === 'review' && 'Sichere Angaben sind eingeklappt. Karten gibt es nur für Unsicheres, Widersprüche und Sensibles.'}
            {step === 'close' && 'Deine Einschätzung und das Kundenprofil. Das setzt immer du, nie die KI.'}
            {step === 'gaps' && (readiness.isReady ? 'Die Akte ist gespeichert. Weitere Fragen kannst du jederzeit nachtragen.' : 'Nur noch die Punkte, die zum Einreichen fehlen.')}
            {step === 'quick' && 'Nichts mitgeschrieben? Die Punkte, die zum Einreichen zählen, per Klick.'}
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
                  placeholder="Hier einfügen (⌘V): Stichpunkte, Word-Text, Teams-/Zoom-Transkript, Mail …"
                  rows={7}
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">oder Datei hierher ziehen: .txt, .docx, .pdf, .vtt</span>
                  <div className="flex gap-2">
                    <input ref={fileRef} type="file" multiple accept=".txt,.md,.vtt,.srt,.docx,.pdf,text/plain,application/pdf" className="hidden" onChange={(e) => onFiles(e.target.files)} />
                    <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={reading}>
                      {reading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileUp className="mr-1.5 h-3.5 w-3.5" />}Datei wählen
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={addPasted} disabled={!paste.trim()}>Als Quelle hinzufügen</Button>
                  </div>
                </div>
              </div>
              {sources.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {sources.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{s.label} <span className="text-xs text-muted-foreground">· {s.kind === 'transcript' ? 'Transkript' : 'Notizen'} · {s.text.length.toLocaleString('de-DE')} Zeichen</span></span>
                      <button type="button" aria-label="Quelle entfernen" className="text-muted-foreground hover:text-destructive" onClick={() => setSources((all) => all.filter((x) => x.id !== s.id))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {hasTranscript && (
                <label className="flex items-start gap-2.5 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                  <Checkbox className="mt-0.5" checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
                  <span>Das ist die Aufzeichnung eines Gesprächs. {firstName} hat der Aufzeichnung zugestimmt. <span className="block text-xs opacity-90">Ohne Zustimmung darf eine Aufnahme nicht verwendet werden (§ 201 StGB). Eigene Notizen brauchen das nicht.</span></span>
                </label>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Verteile die Angaben auf die Akte …</span>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {aiNote && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{aiNote}</p>}
              <p className="text-sm">
                {counts.total - counts.same} gefunden · <span className="text-success">{counts.safe} sicher</span> · <span className="text-warning">{counts.uncertain} prüfen</span> · <span className="text-destructive">{counts.conflict} Widerspruch</span> · {counts.sensitive} sensibel
                {counts.same > 0 && <span className="text-muted-foreground"> · {counts.same} stehen schon so in der Akte</span>}
              </p>
              {counts.total - counts.same === 0 && <p className="text-sm text-muted-foreground">Nichts Neues gefunden. Du kannst trotzdem weiter zum Abschluss.</p>}

              {CAPTURE_PHASES.map((p) => {
                const safe = items.filter((i) => i.phase === p.key && i.status === 'safe');
                if (!safe.length) return null;
                const isOpen = openPhases.has(p.key);
                const acceptedHere = safe.filter((i) => decisions[i.id] === 'accept').length;
                return (
                  <div key={p.key} className="rounded-md border border-border">
                    <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-sm" onClick={() => setOpenPhases((s) => { const n = new Set(s); if (n.has(p.key)) n.delete(p.key); else n.add(p.key); return n; })}>
                      <span>{p.label} · {acceptedHere} von {safe.length} übernommen</span>
                      <span className="flex items-center gap-1 text-success"><Check className="h-4 w-4" />{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                    </button>
                    {isOpen && (
                      <ul className="divide-y divide-border border-t border-border">
                        {safe.map((i) => (
                          <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="text-muted-foreground">{i.label}: </span>{i.display}
                              <span className="block text-xs italic text-muted-foreground">„{i.quote}“{i.sourceLabel ? ` · ${i.sourceLabel}` : ''}</span>
                            </span>
                            <button type="button" className={cn('shrink-0 text-xs', decisions[i.id] === 'accept' ? 'text-success' : 'text-muted-foreground')} onClick={() => setDecisions((d) => ({ ...d, [i.id]: d[i.id] === 'accept' ? 'reject' : 'accept' }))}>
                              {decisions[i.id] === 'accept' ? 'übernommen' : 'verworfen'}
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
                      <span className="font-medium">{c.label}</span>
                      <span className="flex items-center gap-2 text-xs">
                        {c.status === 'conflict' && <span className="text-destructive">Widerspruch zur Akte</span>}
                        {c.status === 'sensitive' && <span className="text-warning">sensibel, bitte bestätigen</span>}
                        {c.status === 'uncertain' && <span className="text-warning">unsicher</span>}
                        {dots(c.confidence)}
                      </span>
                    </div>
                    <div className="mt-1">
                      {c.status === 'conflict' ? (
                        <span><span className="text-muted-foreground line-through">{c.currentDisplay}</span> → {c.display}</span>
                      ) : c.display}
                    </div>
                    <div className="mt-1 text-xs italic text-muted-foreground">„{c.quote}“{c.sourceLabel ? ` · ${c.sourceLabel}` : ''}</div>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" variant={dec === 'reject' ? 'default' : 'outline'} onClick={() => setDecisions((d) => ({ ...d, [c.id]: 'reject' }))}>
                        {c.status === 'conflict' ? 'Akte behalten' : 'Verwerfen'}
                      </Button>
                      <Button type="button" size="sm" variant={dec === 'accept' ? 'default' : 'outline'} onClick={() => setDecisions((d) => ({ ...d, [c.id]: 'accept' }))}>
                        {c.status === 'conflict' ? 'Neu übernehmen' : 'Übernehmen'}
                      </Button>
                    </div>
                  </div>
                );
              })}

              {protectedMentions.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Nicht übernommen (geschützt): {protectedMentions.join(', ')}
                </p>
              )}
            </div>
          )}

          {step === 'close' && (
            <div className="space-y-5">
              <EmpfehlungBlock form={draft} set={set} question={`Würdest du ${firstName} empfehlen?`} />
              <div className="space-y-2">
                <Field label="Wechselbereitschaft (setzt du selbst)" field="change_readiness">
                  <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
                </Field>
                {changeEvidence(draft).length > 0 && (
                  <p className="text-xs text-muted-foreground">Belege aus dem Gespräch: {changeEvidence(draft).join(' · ')}</p>
                )}
              </div>
              <label className="flex items-start gap-2.5 rounded-md border border-border p-3 text-sm">
                <Checkbox className="mt-0.5" checked={draft.presentation_consent === true} onCheckedChange={(v) => set({ presentation_consent: v === true, presentation_consent_at: v === true ? new Date().toISOString() : null })} />
                <span>
                  {firstName} ist einverstanden, anonym für passende Positionen vorgestellt zu werden.
                  {draft.presentation_consent && draft.presentation_consent_at && <span className="text-muted-foreground"> Erfasst am {new Date(draft.presentation_consent_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.</span>}
                  <span className="mt-1 block text-xs text-muted-foreground">Vor jeder konkreten Vorstellung stimmst du dich noch einmal ab.</span>
                </span>
              </label>
              <div className="border-t border-border pt-4">
                <p className="mb-3 text-xs font-semibold text-muted-foreground">Kundenprofil · KI-Entwurf, anonym</p>
                <KundeBlock form={draft} set={set} />
              </div>
            </div>
          )}

          {step === 'quick' && (
            <div className="space-y-5">
              <Field label="Wunschgehalt" field="expected_salary">
                <div className="flex flex-wrap items-center gap-2">
                  {[salaryBase - 5000, salaryBase, salaryBase + 5000].filter((v) => v > 0).map((v) => (
                    <button key={v} type="button" onClick={() => set({ expected_salary: v })} className={cn('rounded-md border px-2.5 py-1 text-xs', draft.expected_salary === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                      {formatEuro(v)}
                    </button>
                  ))}
                  <div className="w-36"><MoneyInput value={draft.expected_salary} onChange={(v) => set({ expected_salary: v })} placeholder="anderer Betrag" /></div>
                </div>
              </Field>
              <Field label="Kündigungsfrist" field="notice_period">
                <ChipGroup field="notice_period" options={NOTICE_OPTIONS} value={draft.notice_period} onChange={(v) => set({ notice_period: v })} />
              </Field>
              <Field label="Wechselmotivation" field="change_motivation_tags">
                <MultiChips options={MOTIVATION_TAGS} values={draft.change_motivation_tags} onChange={(v) => set({ change_motivation_tags: v })} />
              </Field>
              <Field label="In einem Satz (optional)" field="change_motivation">
                <Textarea value={draft.change_motivation} onChange={(e) => set({ change_motivation: e.target.value })} rows={2} placeholder="Warum will sie oder er wechseln?" />
              </Field>
              <EmpfehlungBlock form={draft} set={set} question={`Würdest du ${firstName} empfehlen?`} />
              <Field label="Wechselbereitschaft (setzt du selbst)" field="change_readiness">
                <ChipGroup field="change_readiness" options={CHANGE_READINESS_OPTIONS} value={draft.change_readiness} onChange={(v) => set({ change_readiness: v })} />
              </Field>
              <p className="text-xs text-muted-foreground">Alle weiteren Fragen bleiben als Lücke im Profil. Nichts geht verloren.</p>
            </div>
          )}

          {step === 'gaps' && (
            <div className="space-y-5">
              {readiness.isReady ? (
                <div className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
                  <Check className="mr-1.5 inline h-4 w-4" />7 von 7 · Alle Angaben komplett. {firstName} kann eingereicht werden.
                </div>
              ) : (
                <p className="text-sm font-medium">Noch {readiness.missing.length} bis einreichbar</p>
              )}
              {readiness.missing.map((m) => (
                <div key={m.key} className="space-y-2 rounded-md border border-border p-3">
                  <p className="text-sm font-medium">{m.label}</p>
                  {m.key === 'gehalt' && <MoneyInput value={draft.expected_salary} onChange={(v) => set({ expected_salary: v })} />}
                  {m.key === 'verfuegbarkeit' && <ChipGroup options={NOTICE_OPTIONS} value={draft.notice_period} onChange={(v) => set({ notice_period: v })} />}
                  {m.key === 'motivation' && <MotivationBlock form={draft} set={set} label="Wechselmotivation" />}
                  {m.key === 'einschaetzung' && <ChipGroup options={RECOMMENDATION_OPTIONS} value={draft.recommendation} onChange={(v) => set({ recommendation: v })} />}
                  {m.key === 'skills' && <TagInput values={draft.skills} onChange={(v) => set({ skills: v })} placeholder="mind. 3 Skills" />}
                  {m.key === 'rolle' && <RolleBlock form={draft} set={set} />}
                  {m.key === 'kontakt' && <KontaktBlock form={draft} set={set} />}
                </div>
              ))}
              {!readiness.isReady && whatsappLink() && (
                <a href={whatsappLink()!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                  <MessageCircle className="h-4 w-4" /> Offene Frage per WhatsApp an {firstName}
                </a>
              )}
              {onEdit && !readiness.isReady && (
                <button type="button" className="block text-xs text-muted-foreground underline underline-offset-2" onClick={() => { onOpenChange(false); onEdit({ field: readiness.missing[0]?.field, section: readiness.missing[0]?.section }); }}>
                  Lieber im Bearbeiten-Panel ergänzen
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="mr-1 h-4 w-4" />Schließen
          </Button>
          <div className="flex gap-2">
            {step === 'input' && (
              <Button onClick={analyze} disabled={reading || (!sources.length && !paste.trim()) || (hasTranscript && !consent)}>
                <Sparkles className="mr-1.5 h-4 w-4" />Auswerten
              </Button>
            )}
            {step === 'review' && (
              <Button onClick={acceptReview} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {acceptedCount ? `Übernehmen (${acceptedCount})` : 'Weiter'}
              </Button>
            )}
            {step === 'close' && (
              <>
                <Button variant="outline" onClick={() => setStep('gaps')} disabled={saving}>Überspringen</Button>
                <Button onClick={async () => { if (await persist(draft)) setStep('gaps'); }} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern
                </Button>
              </>
            )}
            {step === 'quick' && (
              <Button onClick={async () => { if (await persist(draft)) setStep('gaps'); }} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Speichern · Rest später
              </Button>
            )}
            {step === 'gaps' && (
              readiness.isReady && onSubmitToJob ? (
                <Button onClick={async () => { if (await persist(draft)) { onOpenChange(false); onSubmitToJob(); } }} disabled={saving}>
                  <Send className="mr-1.5 h-4 w-4" />Auf Stelle einreichen
                </Button>
              ) : (
                <Button onClick={async () => { if (await persist(draft)) onOpenChange(false); }} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Fertig
                </Button>
              )
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

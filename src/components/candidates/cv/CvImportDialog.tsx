/**
 * Kandidat aus Lebenslauf anlegen / Lebenslauf aktualisieren (Wireframes 1, 2 und 4).
 *
 *   Einstieg   ein Bildschirm: PDF, Word oder Text, optional Gesprächsnotizen, Datenschutz
 *   Prüfseite  alle Angaben auf einer Seite, jede mit Herkunft (Lebenslauf + Zitat,
 *              berechnet, Vorschlag), Lücken gehen ins Interview
 *   Aktualisieren  nur Neues und Abweichendes; Interviewdaten werden nie überschrieben
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileUp, Loader2, Plus, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  DossierForm,
  EMPLOYMENT_OPTIONS,
  LEADERSHIP_OPTIONS,
  NOTICE_OPTIONS,
  PERMIT_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODEL_OPTIONS,
  optionLabel,
} from '@/lib/candidateDossier';
import {
  CvChange,
  CvExtraction,
  CvStation,
  OriginMap,
  dossierFromCv,
  emptyDossier,
  interviewGaps,
  mergeCvIntoDossier,
  newStations,
  reviewCounts,
} from '@/lib/cvImport';
import { CvFileInfo, extractCv, findDuplicate, saveCvIntoExisting, saveNewCandidateFromCv } from '@/hooks/useCvImport';
import { fetchDossier } from '@/hooks/useCandidateDossier';
import { AreaField, ChipGroup, Field, FieldOriginContext, NumberField } from '../dossier/DossierFields';
import {
  ArbeitserlaubnisBlock,
  ArbeitsortBlock,
  BerufBlock,
  GehaltBlock,
  KontaktBlock,
  KundeBlock,
  LinksBlock,
  MotivationBlock,
  SperrlisteBlock,
  SprachenBlock,
  VerfuegbarkeitBlock,
  ZieleBlock,
} from '../dossier/DossierBlocks';

type Step = 'start' | 'reading' | 'review' | 'saving';

const READING_STEPS = ['Liest den Lebenslauf …', 'Entfernt Name, Kontakt und geschützte Angaben …', 'Sucht Stationen, Skills und Sprachen …', 'Prüft jedes Zitat …'];

const FIELD_LABELS: Partial<Record<keyof DossierForm, string>> = {
  full_name: 'Name', email: 'E-Mail', phone: 'Telefon', city: 'Wohnort', job_title: 'Rolle', company: 'Arbeitgeber',
  experience_years: 'Berufsjahre', seniority: 'Seniorität', skills: 'Skills', industries: 'Branchen', certificates: 'Zertifikate',
  current_salary: 'Aktuelles Gehalt', expected_salary: 'Wunschgehalt', salary_minimum: 'Schmerzgrenze', notice_period: 'Kündigungsfrist',
  availability_date: 'Verfügbar ab', remote_preference: 'Arbeitsmodell', max_commute_minutes: 'Max. Pendelzeit', employment_type: 'Anstellung',
  relocation_willing: 'Umzugsbereit', target_roles: 'Wunschrollen', target_industries: 'Zielbranchen', target_locations: 'Zielorte',
  work_permit: 'Arbeitserlaubnis', linkedin_url: 'LinkedIn', github_url: 'GitHub', portfolio_url: 'Portfolio', website_url: 'Website',
  expose_summary: 'Kurzprofil', expose_highlights: 'Highlights', languages: 'Sprachen', change_motivation: 'Wechselmotivation',
  career_3_5_year_plan: 'Karriereziel', blocked_companies: 'Nicht vorstellen bei', leadership_scope: 'Führung', leadership_team_size: 'Teamgröße',
};

function display(key: keyof DossierForm, v: unknown): string {
  if (v == null || v === '') return '–';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x && 'language' in x ? `${(x as { language: string }).language} ${(x as { proficiency: string }).proficiency}`.trim() : String(x))).join(', ');
  if (typeof v === 'boolean') return v ? 'Ja' : 'Nein';
  if (typeof v === 'number') return ['current_salary', 'expected_salary', 'salary_minimum'].includes(key) ? `${v.toLocaleString('de-DE')} €` : String(v);
  const map: Partial<Record<keyof DossierForm, typeof NOTICE_OPTIONS>> = {
    notice_period: NOTICE_OPTIONS, remote_preference: WORK_MODEL_OPTIONS, employment_type: EMPLOYMENT_OPTIONS,
    work_permit: PERMIT_OPTIONS, seniority: SENIORITY_OPTIONS, leadership_scope: LEADERSHIP_OPTIONS,
  };
  return map[key] ? optionLabel(map[key]!, String(v)) ?? String(v) : String(v);
}

const period = (s: CvStation) => {
  const f = (ym: string | null) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '?');
  return `${f(s.start)} – ${s.is_current ? 'heute' : f(s.end)}`;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

export function CvImportDialog({
  open,
  onOpenChange,
  onCandidateCreated,
  existingCandidateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCandidateCreated?: (candidateId: string) => void;
  existingCandidateId?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('start');
  const [file, setFile] = useState<File | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState([false, false, false]);
  const [dragging, setDragging] = useState(false);
  const [readingIdx, setReadingIdx] = useState(0);

  const [cv, setCv] = useState<CvExtraction | null>(null);
  const [fileInfo, setFileInfo] = useState<CvFileInfo | null>(null);
  const [form, setForm] = useState<DossierForm>(emptyDossier());
  const [origins, setOrigins] = useState<OriginMap>({});
  const [stations, setStations] = useState<CvStation[]>([]);
  const [duplicate, setDuplicate] = useState<{ id: string; full_name: string; reason: 'name' | 'email' } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Aktualisieren
  const [before, setBefore] = useState<DossierForm | null>(null);
  const [changes, setChanges] = useState<CvChange[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [addStations, setAddStations] = useState<CvStation[]>([]);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [unchanged, setUnchanged] = useState(0);

  const isUpdate = !!existingCandidateId;
  const allConsent = consent.every(Boolean);

  const reset = useCallback(() => {
    setStep('start'); setFile(null); setPasteOpen(false); setText(''); setNotesOpen(false); setNotes('');
    setConsent([false, false, false]); setCv(null); setFileInfo(null); setForm(emptyDossier()); setOrigins({});
    setStations([]); setDuplicate(null); setNameError(null); setBefore(null); setChanges([]); setAccepted(new Set());
    setAddStations([]); setNotesId(null); setUnchanged(0);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  useEffect(() => {
    if (step !== 'reading') return;
    const t = window.setInterval(() => setReadingIdx((i) => (i + 1) % READING_STEPS.length), 2500);
    return () => window.clearInterval(t);
  }, [step]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    const okType = /\.(pdf|docx|txt)$/i.test(f.name);
    if (!okType) { toast.error('Bitte PDF, Word (.docx) oder Text (.txt).'); return; }
    if (f.size > 10 * 1024 * 1024) { toast.error('Die Datei darf höchstens 10 MB groß sein.'); return; }
    setFile(f);
  };

  const set = (patch: Partial<DossierForm>) => setForm((f) => ({ ...f, ...patch }));

  const startReview = async (result: CvExtraction | null, info: CvFileInfo | null) => {
    if (!user) return;
    const fromCv = result ? dossierFromCv(result) : { form: emptyDossier(), origins: {} as OriginMap };
    setCv(result); setFileInfo(info);
    if (isUpdate && existingCandidateId) {
      const [{ form: current }, exps, notesRow] = await Promise.all([
        fetchDossier(existingCandidateId),
        supabase.from('candidate_experiences').select('company_name, start_date').eq('candidate_id', existingCandidateId),
        supabase.from('candidate_interview_notes').select('id').eq('candidate_id', existingCandidateId).order('updated_at', { ascending: false, nullsFirst: false }).limit(1),
      ]);
      const { changes: ch } = mergeCvIntoDossier(current, fromCv.form, fromCv.origins);
      const add = newStations((exps.data ?? []) as { company_name: string | null; start_date: string | null }[], result?.stations ?? []);
      setBefore(current); setChanges(ch); setAddStations(add); setNotesId(((notesRow.data ?? [])[0] as { id?: string } | undefined)?.id ?? null);
      setAccepted(new Set([...ch.filter((c) => c.kind === 'new').map((c) => String(c.key)), ...add.map((s) => `station:${s.company_name}:${s.start}`)]));
      setUnchanged(Math.max(0, Object.keys(fromCv.origins).length - ch.length));
      setForm(current);
    } else {
      setForm(fromCv.form); setOrigins(fromCv.origins); setStations(result?.stations ?? []);
      setDuplicate(await findDuplicate(user.id, fromCv.form));
    }
    setStep('review');
  };

  const read = async () => {
    if (!user) return;
    setStep('reading'); setReadingIdx(0);
    try {
      const { cv: result, fileInfo: info } = await extractCv({ userId: user.id, file, text: pasteOpen ? text : '', notes, candidateId: existingCandidateId });
      await startReview(result, info);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Lebenslauf konnte nicht ausgelesen werden.');
      setStep('start');
    }
  };

  const saveNew = async () => {
    if (!user || !cv && !form.full_name.trim()) return;
    if (!form.full_name.trim()) { setNameError('Bitte einen Namen eintragen.'); return; }
    setStep('saving');
    try {
      const res = await saveNewCandidateFromCv({
        userId: user.id, form, fileInfo, stations,
        cv: cv ?? { version: 'manuell', contact: { full_name: '', email: '', phone: '', city: '', linkedin_url: '', github_url: '', portfolio_url: '', website_url: '' }, removed_sensitive: [], fields: {}, stations: [], educations: [], skills: [], languages: [], suggestions: { summary: '', highlights: [], career_directions: [] }, rejected_quotes: 0, raw_text: '' },
      });
      // Die Erfolgsmeldung zeigt der Aufrufer; hier nur, was schiefging – nie verschluckt.
      if (res.failed.length) toast.warning(`Kandidat angelegt, aber nicht gespeichert: ${res.failed.join(', ')}. Bitte in der Akte nachtragen.`);
      onCandidateCreated?.(res.candidateId);
      onOpenChange(false);
      navigate(`/recruiter/candidates/${res.candidateId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setStep('review');
    }
  };

  const saveUpdate = async () => {
    if (!user || !before || !existingCandidateId || !cv) return;
    setStep('saving');
    try {
      const fromCv = dossierFromCv(cv);
      const merged: DossierForm = { ...before };
      for (const c of changes) {
        if (!accepted.has(String(c.key))) continue;
        if (c.kind === 'conflict') (merged as unknown as Record<string, unknown>)[c.key] = fromCv.form[c.key];
        else if (Array.isArray(c.incoming)) (merged as unknown as Record<string, unknown>)[c.key] = [...(before[c.key] as unknown[]), ...(c.incoming as unknown[])];
        else (merged as unknown as Record<string, unknown>)[c.key] = c.incoming;
      }
      const stationsToAdd = addStations.filter((s) => accepted.has(`station:${s.company_name}:${s.start}`));
      const res = await saveCvIntoExisting({ userId: user.id, candidateId: existingCandidateId, before, merged, cv, fileInfo, addStations: stationsToAdd, notesId });
      if (res.failed.length) toast.warning(`Teilweise gespeichert. Nicht übernommen: ${res.failed.join(', ')}.`);
      else toast.success('Lebenslauf übernommen');
      onCandidateCreated?.(existingCandidateId);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Speichern fehlgeschlagen');
      setStep('review');
    }
  };

  const toggleAccepted = (key: string) => setAccepted((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const counts = cv ? reviewCounts(form, origins, cv) : { taken: 0, check: 0, gaps: interviewGaps(form).length };
  const gaps = interviewGaps(form);

  return (
    <Dialog open={open} onOpenChange={(o) => step !== 'saving' && onOpenChange(o)}>
      <DialogContent className={cn('max-h-[92vh] overflow-y-auto', step === 'review' && !isUpdate ? 'max-w-4xl pb-0' : 'max-w-xl')}>
        {step === 'start' && (
          <>
            <DialogHeader>
              <DialogTitle>{isUpdate ? 'Neuer Lebenslauf' : 'Kandidat anlegen'}</DialogTitle>
              <DialogDescription>Lebenslauf rein, den Rest liest die KI aus. Du prüfst nur noch.</DialogDescription>
            </DialogHeader>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
              className={cn('cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors', dragging || file ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,application/pdf" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              {file ? (
                <p className="text-sm font-medium">{file.name} <button type="button" className="ml-1 text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setFile(null); }} aria-label="Datei entfernen"><X className="inline h-3.5 w-3.5" /></button></p>
              ) : (
                <>
                  <p className="text-sm font-medium">Lebenslauf hier ablegen</p>
                  <p className="text-xs text-muted-foreground">PDF oder Word, bis 10 MB</p>
                </>
              )}
            </div>
            <div className="space-y-2">
              <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setPasteOpen((v) => !v)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Text oder LinkedIn-Profil einfügen
              </button>
              {pasteOpen && <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Lebenslauf oder LinkedIn-Profil hier einfügen" />}
              <button type="button" className="block text-sm text-muted-foreground hover:text-foreground" onClick={() => setNotesOpen((v) => !v)}>
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Gesprächsnotizen gleich mit einwerfen (optional)
              </button>
              {notesOpen && <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="z. B. will 85k, min 80k, 3 Monate zum Quartalsende, nicht zu Firma X" />}
            </div>
            {!isUpdate && (
              <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs">
                {[
                  'Eine gültige Rechtsgrundlage für die Verarbeitung liegt vor (z. B. Einwilligung, Bewerbung oder berechtigtes Interesse nach Art. 6 DSGVO).',
                  'Der Kandidat wurde bzw. wird über die Verarbeitung seiner Daten informiert.',
                  'Ich übernehme nur bewerbungsrelevante Angaben. Geburtsdatum, Familienstand und Herkunft werden automatisch nicht übernommen.',
                ].map((label, i) => (
                  <label key={label} className="flex cursor-pointer items-start gap-2">
                    <Checkbox className="mt-0.5" checked={consent[i]} onCheckedChange={(v) => setConsent((c) => c.map((x, j) => (j === i ? v === true : x)))} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {!isUpdate && <Button variant="outline" disabled={!allConsent} onClick={() => startReview(null, null)}>Ohne Lebenslauf anlegen</Button>}
              <Button disabled={(!file && !(pasteOpen && text.trim().length > 40)) || (!isUpdate && !allConsent)} onClick={read}>Auslesen</Button>
            </div>
          </>
        )}

        {step === 'reading' && (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">{READING_STEPS[readingIdx]}</p>
            <p className="text-xs text-muted-foreground">Dauert meist 20–40 Sekunden.</p>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center gap-3 py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Wird gespeichert …</p>
          </div>
        )}

        {step === 'review' && !isUpdate && (
          <FieldOriginContext.Provider value={origins}>
            <DialogHeader>
              <DialogTitle>{form.full_name ? `${form.full_name} prüfen` : 'Kandidat prüfen'}</DialogTitle>
              <DialogDescription>{fileInfo?.fileName ?? (cv ? 'Eingefügter Text' : 'Ohne Lebenslauf')}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-wrap gap-2 text-xs">
              {cv && <span className="rounded-md bg-success/15 px-2.5 py-1 text-success">{counts.taken} Angaben übernommen</span>}
              {counts.check > 0 && <span className="rounded-md bg-warning/15 px-2.5 py-1 text-warning">{counts.check} bitte prüfen</span>}
              <span className="rounded-md bg-muted px-2.5 py-1 text-muted-foreground">{counts.gaps} fehlen · fragen wir im Interview</span>
            </div>
            {cv && cv.removed_sensitive.length > 0 && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                Nicht übernommen, weil geschützt: {cv.removed_sensitive.join(', ')}.
              </p>
            )}
            {duplicate && (
              <p className="flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
                <span className="flex-1">
                  {duplicate.reason === 'name'
                    ? `„${duplicate.full_name}“ gibt es in deinen Kandidaten schon – lieber dort den Lebenslauf aktualisieren?`
                    : `Diese E-Mail gehört schon zu „${duplicate.full_name}“.`}
                </span>
                <button type="button" className="text-primary hover:underline" onClick={() => { onOpenChange(false); navigate(`/recruiter/candidates/${duplicate.id}`); }}>Öffnen</button>
              </p>
            )}

            <div className="space-y-5">
              <Section title="Kontakt"><KontaktBlock form={form} set={(p) => { setNameError(null); set(p); }} errors={nameError ? { full_name: nameError } : undefined} /></Section>
              <Section title="Rolle und Erfahrung">
                <BerufBlock form={form} set={set} />
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                  <Field label="Führungsverantwortung" field="leadership_scope">
                    <ChipGroup field="leadership_scope" options={LEADERSHIP_OPTIONS} value={form.leadership_scope} onChange={(v) => set({ leadership_scope: v })} />
                  </Field>
                  {form.leadership_scope && form.leadership_scope !== 'none' && (
                    <Field label="Teamgröße" field="leadership_team_size">
                      <NumberField field="leadership_team_size" value={form.leadership_team_size} onChange={(v) => set({ leadership_team_size: v })} suffix="Personen" />
                    </Field>
                  )}
                </div>
              </Section>
              {(stations.length > 0 || (cv?.educations.length ?? 0) > 0) && (
                <Section title="Stationen und Ausbildung">
                  <ul className="divide-y divide-border rounded-md border border-border text-sm">
                    {stations.map((s, i) => (
                      <li key={`${s.company_name}-${s.start}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                        <span className="min-w-0">
                          <span className="block font-medium">{s.job_title || 'Position'}{s.company_name && <span className="font-normal text-muted-foreground"> · {s.company_name}</span>}</span>
                          <span className="block text-xs text-muted-foreground">{period(s)}{s.location ? ` · ${s.location}` : ''}{s.industry ? ` · ${s.industry}` : ''}</span>
                        </span>
                        <button type="button" aria-label="Station entfernen" className="text-muted-foreground hover:text-destructive" onClick={() => setStations((list) => list.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button>
                      </li>
                    ))}
                    {(cv?.educations ?? []).map((e, i) => (
                      <li key={`edu-${i}`} className="px-3 py-2">
                        <span className="block font-medium">{e.degree || 'Abschluss'}{e.field_of_study && ` – ${e.field_of_study}`}</span>
                        <span className="block text-xs text-muted-foreground">{e.institution}{e.graduation_year ? ` · ${e.graduation_year}` : ''}{e.grade ? ` · Note ${e.grade}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </Section>
              )}
              <Section title="Sprachen"><SprachenBlock form={form} set={set} /></Section>
              <Section title="Wechselwunsch">
                <GehaltBlock form={form} set={set} />
                <VerfuegbarkeitBlock form={form} set={set} />
                <ArbeitsortBlock form={form} set={set} />
                <ZieleBlock form={form} set={set} />
                <Field label="Arbeitserlaubnis" field="work_permit"><ArbeitserlaubnisBlock form={form} set={set} /></Field>
                <MotivationBlock form={form} set={set} />
                <Field label="Karriereziel" field="career_3_5_year_plan">
                  <AreaField field="career_3_5_year_plan" value={form.career_3_5_year_plan} onChange={(v) => set({ career_3_5_year_plan: v })} rows={2} />
                </Field>
                <SperrlisteBlock form={form} set={set} formerEmployers={stations.map((s) => s.company_name)} />
              </Section>
              {gaps.length > 0 && (
                <div className="rounded-md bg-muted/60 p-3 text-sm">
                  <p className="font-medium">Steht nicht im Lebenslauf – fragen wir im Interview</p>
                  <p className="text-muted-foreground">{gaps.join(' · ')}</p>
                </div>
              )}
              <Section title="Für den Kunden (Vorschlag)"><KundeBlock form={form} set={set} /></Section>
              <Section title="Links"><LinksBlock form={form} set={set} /></Section>
            </div>
            <div className="sticky bottom-0 z-10 -mx-6 flex justify-between gap-2 border-t border-border bg-background px-6 py-3">
              <Button variant="outline" onClick={() => setStep('start')}>Zurück</Button>
              <Button onClick={saveNew}>Kandidat anlegen</Button>
            </div>
          </FieldOriginContext.Provider>
        )}

        {step === 'review' && isUpdate && before && (
          <>
            <DialogHeader>
              <DialogTitle>Neuer Lebenslauf für {before.full_name.split(' ')[0] || before.full_name}</DialogTitle>
              <DialogDescription>Gehalt, Kündigungsfrist, Motivation und alles aus dem Interview bleiben unverändert.</DialogDescription>
            </DialogHeader>
            {changes.length === 0 && addStations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Keine neuen Angaben im Lebenslauf.</p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {changes.map((c) => (
                  <li key={String(c.key)} className="flex items-start gap-3 py-2.5">
                    <Checkbox className="mt-0.5" checked={accepted.has(String(c.key))} onCheckedChange={() => toggleAccepted(String(c.key))} />
                    <span className="min-w-0 flex-1">
                      <span className={cn('mr-2 rounded px-1.5 py-0.5 text-[11px]', c.kind === 'new' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning')}>{c.kind === 'new' ? 'neu' : 'anders'}</span>
                      <span className="font-medium">{FIELD_LABELS[c.key] ?? String(c.key)}:</span> {display(c.key, c.incoming)}
                      {c.kind === 'conflict' && <span className="block text-xs text-muted-foreground">bisher: {display(c.key, c.current)} · angehakt = neuen Wert übernehmen</span>}
                    </span>
                  </li>
                ))}
                {addStations.map((s) => {
                  const key = `station:${s.company_name}:${s.start}`;
                  return (
                    <li key={key} className="flex items-start gap-3 py-2.5">
                      <Checkbox className="mt-0.5" checked={accepted.has(key)} onCheckedChange={() => toggleAccepted(key)} />
                      <span><span className="mr-2 rounded bg-success/15 px-1.5 py-0.5 text-[11px] text-success">neu</span><span className="font-medium">Station:</span> {s.job_title} · {s.company_name} ({period(s)})</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">{unchanged} Angaben unverändert</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
              <Button onClick={saveUpdate} disabled={changes.length === 0 && addStations.length === 0}>Änderungen übernehmen</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

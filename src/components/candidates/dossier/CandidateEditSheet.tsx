import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DossierForm, DossierSection, computeReadiness, countChanges, isValidEmail } from '@/lib/candidateDossier';
import type { DossierSaveResult } from '@/hooks/useCandidateDossier';
import { AreaField, Field, focusDossierField } from './DossierFields';
import {
  ArbeitsortBlock,
  ArbeitserlaubnisBlock,
  BerufBlock,
  EmpfehlungBlock,
  GehaltBlock,
  KontaktBlock,
  KundeBlock,
  LinksBlock,
  MotivationBlock,
  SprachenBlock,
  VerfuegbarkeitBlock,
  ZieleBlock,
} from './DossierBlocks';

export interface EditFocus {
  section?: DossierSection;
  field?: string;
}

const SECTIONS: Array<{ key: DossierSection; label: string }> = [
  { key: 'kontakt', label: 'Kontakt' },
  { key: 'beruf', label: 'Beruf' },
  { key: 'wechsel', label: 'Wechsel' },
  { key: 'arbeitsort', label: 'Arbeitsort' },
  { key: 'sprachen', label: 'Sprachen' },
  { key: 'arbeitserlaubnis', label: 'Arbeitserlaubnis' },
  { key: 'einschaetzung', label: 'Einschätzung' },
  { key: 'kunde', label: 'Für den Kunden' },
  { key: 'links', label: 'Links' },
];

function Section({ id, title, children }: { id: DossierSection; title: string; children: ReactNode }) {
  return (
    <section id={`dossier-section-${id}`} data-section={id} className="scroll-mt-4 border-t border-border pt-5 first:border-t-0 first:pt-2">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  form: DossierForm;
  onSave: (form: DossierForm) => Promise<DossierSaveResult>;
  focus?: EditFocus | null;
}

export function CandidateEditSheet({ open, onOpenChange, candidateName, form, onSave, focus }: Props) {
  const [draft, setDraft] = useState<DossierForm>(form);
  const [initial, setInitial] = useState<DossierForm>(form);
  const [errors, setErrors] = useState<Partial<Record<keyof DossierForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [active, setActive] = useState<DossierSection>('kontakt');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Beim Öffnen einmal übernehmen, danach nie mehr von außen überschreiben.
  useEffect(() => {
    if (open) {
      setDraft(form);
      setInitial(form);
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !focus) return;
    const t = window.setTimeout(() => {
      if (focus.field) focusDossierField(focus.field);
      else if (focus.section) scrollToSection(focus.section);
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, focus]);

  const set = (patch: Partial<DossierForm>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k as keyof DossierForm];
      return next;
    });
  };

  const changes = useMemo(() => countChanges(draft, initial), [draft, initial]);
  const readiness = useMemo(() => computeReadiness(draft), [draft]);

  const scrollToSection = (key: DossierSection) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-section="${key}"]`);
    if (el && scrollRef.current) scrollRef.current.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
    setActive(key);
  };

  const onScroll = () => {
    const root = scrollRef.current;
    if (!root) return;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-section]'));
    const top = root.scrollTop + 24;
    let current: DossierSection = 'kontakt';
    for (const s of sections) if (s.offsetTop <= top) current = s.dataset.section as DossierSection;
    setActive(current);
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof DossierForm, string>> = {};
    if (!draft.full_name.trim()) next.full_name = 'Bitte einen Namen eintragen.';
    if (draft.email.trim() && !isValidEmail(draft.email)) next.email = 'Das ist keine gültige E-Mail-Adresse.';
    if (!draft.email.trim() && !draft.phone.trim()) next.email = 'Bitte E-Mail oder Telefon eintragen.';
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) focusDossierField(first);
    return !first;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const result = await onSave(draft);
    setSaving(false);
    if (!result.ok) {
      toast.error('Speichern hat nicht geklappt', { description: result.error });
      return;
    }
    toast.success('Gespeichert');
    setInitial(draft);
    onOpenChange(false);
  };

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true);
    if (changes > 0 && !saving) setConfirmClose(true);
    else onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
          <div className="border-b border-border px-6 pb-3 pt-5">
            <SheetTitle className="pr-8 text-base">{candidateName} bearbeiten</SheetTitle>
            <SheetDescription className="sr-only">Alle Angaben zur Kandidatin oder zum Kandidaten auf einer Seite.</SheetDescription>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(readiness.done / readiness.total) * 100}%` }} />
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                Bereit {readiness.done} von {readiness.total}
              </span>
            </div>
            {readiness.missing.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Fehlt noch:{' '}
                {readiness.missing.map((m, i) => (
                  <span key={m.key}>
                    {i > 0 && ', '}
                    <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => focusDossierField(m.field)}>
                      {m.label}
                    </button>
                  </span>
                ))}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => scrollToSection(s.key)}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-xs transition-colors',
                    active === s.key ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-8 pt-3">
            <Section id="kontakt" title="Kontakt">
              <KontaktBlock form={draft} set={set} errors={errors} />
            </Section>
            <Section id="beruf" title="Beruf und Skills">
              <BerufBlock form={draft} set={set} />
            </Section>
            <Section id="wechsel" title="Wechsel">
              <div className="space-y-4">
                <GehaltBlock form={draft} set={set} />
                <VerfuegbarkeitBlock form={draft} set={set} />
                <MotivationBlock form={draft} set={set} />
                <p className="text-xs text-muted-foreground">Dieselben Felder wie im Interview. Was dort eingetragen wird, steht hier, und umgekehrt.</p>
              </div>
            </Section>
            <Section id="arbeitsort" title="Arbeitsort und Präferenzen">
              <div className="space-y-4">
                <ArbeitsortBlock form={draft} set={set} />
                <ZieleBlock form={draft} set={set} />
              </div>
            </Section>
            <Section id="sprachen" title="Sprachen">
              <SprachenBlock form={draft} set={set} />
            </Section>
            <Section id="arbeitserlaubnis" title="Arbeitserlaubnis">
              <ArbeitserlaubnisBlock form={draft} set={set} />
            </Section>
            <Section id="einschaetzung" title="Deine Einschätzung">
              <div className="space-y-3">
                <EmpfehlungBlock form={draft} set={set} />
                <Field label="Interne Notiz (nur für dich)" field="internal_note">
                  <AreaField field="internal_note" value={draft.internal_note} onChange={(v) => set({ internal_note: v })} rows={2} />
                </Field>
              </div>
            </Section>
            <Section id="kunde" title="Für den Kunden, anonym">
              <KundeBlock form={draft} set={set} />
            </Section>
            <Section id="links" title="Links">
              <LinksBlock form={draft} set={set} />
            </Section>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3">
            <span className="text-xs text-muted-foreground">
              {changes === 0 ? 'Keine Änderungen' : changes === 1 ? '1 Änderung' : `${changes} Änderungen`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => requestClose(false)} disabled={saving}>
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={saving || changes === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Speichern
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Änderungen verwerfen?</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast {changes === 1 ? '1 Feld' : `${changes} Felder`} geändert. Die gehen verloren, wenn du jetzt schließt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Weiter bearbeiten</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmClose(false);
                onOpenChange(false);
              }}
            >
              Verwerfen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

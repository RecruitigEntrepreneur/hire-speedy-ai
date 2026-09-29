import { Check, Circle, FileText, MessagesSquare, Pencil, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DossierForm,
  EMPLOYMENT_OPTIONS,
  NOTICE_OPTIONS,
  PERMIT_OPTIONS,
  Readiness,
  WORK_MODEL_OPTIONS,
  formatEuro,
  optionLabel,
} from '@/lib/candidateDossier';
import type { EditFocus } from './CandidateEditSheet';

export function DossierReadinessCard({
  readiness,
  firstName,
  onEdit,
  onStartInterview,
  onViewExpose,
  onSubmit,
}: {
  readiness: Readiness;
  firstName: string;
  onEdit: (focus: EditFocus) => void;
  onStartInterview: () => void;
  onViewExpose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Bereit zum Einreichen</CardTitle>
          <span className="text-xs text-muted-foreground">
            {readiness.done} von {readiness.total}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(readiness.done / readiness.total) * 100}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
          {readiness.items.map((item) => (
            <li key={item.key} className="flex items-center gap-2">
              {item.ok ? <Check className="h-3.5 w-3.5 shrink-0 text-success" /> : <Circle className="h-3.5 w-3.5 shrink-0 text-warning" />}
              <span className={item.ok ? '' : 'text-warning'}>{item.label}</span>
              {!item.ok && (
                <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => onEdit({ section: item.section, field: item.field })}>
                  eintragen
                </button>
              )}
            </li>
          ))}
        </ul>
        {readiness.isReady ? (
          <div className="space-y-2.5">
            <p className="text-sm text-success">Alle Angaben komplett. {firstName} kann eingereicht werden.</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onViewExpose}>
                <FileText className="mr-1.5 h-3.5 w-3.5" /> Exposé ansehen
              </Button>
              <Button size="sm" onClick={onSubmit}>
                <Send className="mr-1.5 h-3.5 w-3.5" /> Auf Stelle einreichen
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" onClick={onStartInterview}>
            <MessagesSquare className="mr-1.5 h-3.5 w-3.5" /> Interview starten
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={value ? 'text-right' : 'text-muted-foreground'}>{value ?? '–'}</span>
    </div>
  );
}

export function DossierFactsCard({ form, onEdit }: { form: DossierForm; onEdit: (focus: EditFocus) => void }) {
  const commute = form.max_commute_minutes ? `max. ${form.max_commute_minutes} Min.` : null;
  const workModel = [optionLabel(WORK_MODEL_OPTIONS, form.remote_preference), commute].filter(Boolean).join(', ') || null;
  const motivation = form.change_motivation.trim() || (form.change_motivation_tags.length ? form.change_motivation_tags.join(', ') : null);
  return (
    <Card>
      <CardHeader className="pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Wechsel-Eckdaten</CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Wechsel-Eckdaten bearbeiten" onClick={() => onEdit({ section: 'wechsel' })}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Row label="Aktuelles Gehalt" value={form.current_salary ? formatEuro(form.current_salary) : null} />
        <Row label="Wunschgehalt" value={form.expected_salary ? formatEuro(form.expected_salary) : null} />
        <Row label="Schmerzgrenze" value={form.salary_minimum ? formatEuro(form.salary_minimum) : null} />
        <Row label="Kündigungsfrist" value={optionLabel(NOTICE_OPTIONS, form.notice_period)} />
        <Row label="Arbeitsmodell" value={workModel} />
        <Row label="Beschäftigung" value={optionLabel(EMPLOYMENT_OPTIONS, form.employment_type)} />
        <Row label="Sprachen" value={form.languages.length ? form.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language)).join(', ') : null} />
        <Row label="Arbeitserlaubnis" value={optionLabel(PERMIT_OPTIONS, form.work_permit)} />
        <Row label="Wechselmotivation" value={motivation} />
      </CardContent>
    </Card>
  );
}

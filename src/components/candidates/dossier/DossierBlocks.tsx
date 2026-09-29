import { AlertTriangle, Plus, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  COMMUTE_OPTIONS,
  DossierForm,
  EMPLOYMENT_OPTIONS,
  LANGUAGE_LEVELS,
  MOTIVATION_TAGS,
  NOTICE_OPTIONS,
  PERMIT_OPTIONS,
  RECOMMENDATION_OPTIONS,
  RELOCATION_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODEL_OPTIONS,
  buildExposeDraft,
  exposeSummaryIssues,
} from '@/lib/candidateDossier';
import { AreaField, ChipGroup, Field, MoneyInput, MultiChips, NumberField, TagInput, TextField, fieldId } from './DossierFields';

// Bausteine der Kandidatenakte. Bearbeiten-Panel und Interview setzen sie
// unterschiedlich zusammen, schreiben aber dieselben Felder.

export interface BlockProps {
  form: DossierForm;
  set: (patch: Partial<DossierForm>) => void;
  errors?: Partial<Record<keyof DossierForm, string>>;
}

export function KontaktBlock({ form, set, errors }: BlockProps) {
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" field="full_name" error={errors?.full_name}>
          <TextField field="full_name" value={form.full_name} onChange={(v) => set({ full_name: v })} />
        </Field>
        <Field label="Wohnort" field="city">
          <TextField field="city" value={form.city} onChange={(v) => set({ city: v })} placeholder="München" />
        </Field>
        <Field label="E-Mail" field="email" error={errors?.email}>
          <TextField field="email" type="email" value={form.email} onChange={(v) => set({ email: v })} placeholder="name@beispiel.de" />
        </Field>
        <Field label="Telefon" field="phone" error={errors?.phone}>
          <TextField field="phone" value={form.phone} onChange={(v) => set({ phone: v })} placeholder="+49 …" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">E-Mail oder Telefon reicht.</p>
    </div>
  );
}

export function RolleBlock({ form, set }: BlockProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Aktuelle Rolle" field="job_title">
        <TextField field="job_title" value={form.job_title} onChange={(v) => set({ job_title: v })} placeholder="Patientenservice" />
      </Field>
      <Field label="Arbeitgeber" field="company">
        <TextField field="company" value={form.company} onChange={(v) => set({ company: v })} />
      </Field>
      <Field label="Berufserfahrung" field="experience_years">
        <NumberField field="experience_years" value={form.experience_years} onChange={(v) => set({ experience_years: v })} suffix="Jahre" />
      </Field>
    </div>
  );
}

export function BerufBlock({ form, set }: BlockProps) {
  return (
    <div className="space-y-4">
      <RolleBlock form={form} set={set} />
      <Field label="Seniorität" field="seniority">
        <ChipGroup field="seniority" options={SENIORITY_OPTIONS} value={form.seniority} onChange={(v) => set({ seniority: v })} />
      </Field>
      <Field label="Skills" field="skills" hint="Enter oder Komma fügt einen Skill hinzu.">
        <TagInput field="skills" values={form.skills} onChange={(v) => set({ skills: v })} placeholder="Zendesk, Patientenkommunikation …" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Branchenerfahrung" field="industries">
          <TagInput field="industries" values={form.industries} onChange={(v) => set({ industries: v })} placeholder="Gesundheitswesen" />
        </Field>
        <Field label="Zertifikate" field="certificates">
          <TagInput field="certificates" values={form.certificates} onChange={(v) => set({ certificates: v })} placeholder="z. B. MFA" />
        </Field>
      </div>
    </div>
  );
}

export function GehaltBlock({ form, set }: BlockProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Aktuelles Gehalt" field="current_salary">
        <MoneyInput field="current_salary" value={form.current_salary} onChange={(v) => set({ current_salary: v })} />
      </Field>
      <Field label="Wunschgehalt" field="expected_salary">
        <MoneyInput field="expected_salary" value={form.expected_salary} onChange={(v) => set({ expected_salary: v })} />
      </Field>
      <Field label="Schmerzgrenze" field="salary_minimum">
        <MoneyInput field="salary_minimum" value={form.salary_minimum} onChange={(v) => set({ salary_minimum: v })} />
      </Field>
    </div>
  );
}

export function VerfuegbarkeitBlock({ form, set }: BlockProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Kündigungsfrist" field="notice_period">
        <Select value={form.notice_period ?? '__none'} onValueChange={(v) => set({ notice_period: v === '__none' ? null : v })}>
          <SelectTrigger id={fieldId('notice_period')}>
            <SelectValue placeholder="Keine Angabe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none">Keine Angabe</SelectItem>
            {NOTICE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Verfügbar ab (optional)" field="availability_date">
        <Input id={fieldId('availability_date')} type="date" value={form.availability_date ?? ''} onChange={(e) => set({ availability_date: e.target.value || null })} />
      </Field>
    </div>
  );
}

export function MotivationBlock({ form, set, label = 'Wechselmotivation' }: BlockProps & { label?: string }) {
  return (
    <div className="space-y-2">
      <Field label={label} field="change_motivation">
        <AreaField field="change_motivation" value={form.change_motivation} onChange={(v) => set({ change_motivation: v })} placeholder="Warum will sie oder er wechseln? In ihren oder seinen Worten." rows={2} />
      </Field>
      <MultiChips options={MOTIVATION_TAGS} values={form.change_motivation_tags} onChange={(v) => set({ change_motivation_tags: v })} />
    </div>
  );
}

export function ArbeitsortBlock({ form, set }: BlockProps) {
  return (
    <div className="space-y-4">
      <Field label="Arbeitsmodell" field="remote_preference">
        <ChipGroup field="remote_preference" options={WORK_MODEL_OPTIONS} value={form.remote_preference} onChange={(v) => set({ remote_preference: v })} noneLabel="Keine Angabe" />
      </Field>
      <Field label="Max. Pendelzeit" field="max_commute_minutes">
        <ChipGroup
          field="max_commute_minutes"
          options={COMMUTE_OPTIONS}
          value={form.max_commute_minutes != null ? String(form.max_commute_minutes) : null}
          onChange={(v) => set({ max_commute_minutes: v ? parseInt(v, 10) : null })}
          noneLabel="Keine Angabe"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Beschäftigungsart" field="employment_type">
          <ChipGroup field="employment_type" options={EMPLOYMENT_OPTIONS} value={form.employment_type} onChange={(v) => set({ employment_type: v })} />
        </Field>
        <Field label="Umzugsbereit" field="relocation_willing">
          <ChipGroup
            field="relocation_willing"
            options={RELOCATION_OPTIONS}
            value={form.relocation_willing == null ? null : form.relocation_willing ? 'yes' : 'no'}
            onChange={(v) => set({ relocation_willing: v == null ? null : v === 'yes' })}
            noneLabel="Keine Angabe"
          />
        </Field>
      </div>
    </div>
  );
}

export function ZieleBlock({ form, set }: BlockProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Wunschrollen" field="target_roles">
        <TagInput field="target_roles" values={form.target_roles} onChange={(v) => set({ target_roles: v })} placeholder="Teamleitung …" />
      </Field>
      <Field label="Zielbranchen" field="target_industries">
        <TagInput field="target_industries" values={form.target_industries} onChange={(v) => set({ target_industries: v })} placeholder="Gesundheit …" />
      </Field>
      <Field label="Zielorte" field="target_locations">
        <TagInput field="target_locations" values={form.target_locations} onChange={(v) => set({ target_locations: v })} placeholder="München, Remote …" />
      </Field>
    </div>
  );
}

export function SprachenBlock({ form, set }: BlockProps) {
  const update = (i: number, patch: Partial<DossierForm['languages'][number]>) =>
    set({ languages: form.languages.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  return (
    <div className="space-y-2" data-dossier-field="languages">
      {form.languages.length === 0 && <p className="text-xs text-muted-foreground">Noch keine Sprache eingetragen.</p>}
      {form.languages.map((l, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] items-center gap-2">
          <Input value={l.language} placeholder="Sprache" onChange={(e) => update(i, { language: e.target.value })} aria-label="Sprache" />
          <Select value={l.proficiency || '__none'} onValueChange={(v) => update(i, { proficiency: v === '__none' ? '' : v })}>
            <SelectTrigger aria-label="Niveau">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Niveau offen</SelectItem>
              {LANGUAGE_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" aria-label="Sprache entfernen" onClick={() => set({ languages: form.languages.filter((_, idx) => idx !== i) })}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => set({ languages: [...form.languages, { language: form.languages.length ? '' : 'Deutsch', proficiency: '' }] })}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Sprache hinzufügen
      </Button>
    </div>
  );
}

export function ArbeitserlaubnisBlock({ form, set }: BlockProps) {
  return (
    <div className="space-y-3">
      <ChipGroup field="work_permit" options={PERMIT_OPTIONS} value={form.work_permit} onChange={(v) => set({ work_permit: v })} noneLabel="Keine Angabe" />
      {(form.work_permit === 'needs_visa' || form.work_permit === 'pending') && (
        <Field label="Hinweis zu Visum oder Erlaubnis" field="work_permit_notes">
          <AreaField field="work_permit_notes" value={form.work_permit_notes} onChange={(v) => set({ work_permit_notes: v })} rows={2} />
        </Field>
      )}
    </div>
  );
}

export function EmpfehlungBlock({ form, set, question = 'Würdest du sie oder ihn empfehlen?' }: BlockProps & { question?: string }) {
  return (
    <div className="space-y-3">
      <Field label={question} field="recommendation">
        <ChipGroup field="recommendation" options={RECOMMENDATION_OPTIONS} value={form.recommendation} onChange={(v) => set({ recommendation: v })} />
      </Field>
      <Field label="Begründung (intern)" field="recommendation_notes">
        <AreaField field="recommendation_notes" value={form.recommendation_notes} onChange={(v) => set({ recommendation_notes: v })} placeholder="Was spricht dafür, was dagegen?" rows={2} />
      </Field>
    </div>
  );
}

export function KundeBlock({ form, set }: BlockProps) {
  const issues = exposeSummaryIssues(form);
  return (
    <div className="space-y-3">
      <Field
        label={
          <span className="flex items-center justify-between gap-2">
            <span>Kurzprofil</span>
          </span>
        }
        field="expose_summary"
        hint="Name, Arbeitgeber und Kontaktdaten gehören hier nie hinein."
      >
        <AreaField field="expose_summary" value={form.expose_summary} onChange={(v) => set({ expose_summary: v })} placeholder="Wird im Exposé und beim Einreichen gezeigt." rows={4} />
      </Field>
      {issues.map((i) => (
        <p key={i.message} className={`flex items-start gap-1.5 text-xs ${i.level === 'danger' ? 'text-destructive' : 'text-warning'}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {i.message}
        </p>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set({ expose_summary: buildExposeDraft(form) })}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {issues.length ? 'Neu aus der Akte' : 'Entwurf aus der Akte'}
      </Button>
      <Field label="Highlights" field="expose_highlights">
        <TagInput field="expose_highlights" values={form.expose_highlights} onChange={(v) => set({ expose_highlights: v })} placeholder="3 Jahre Telemedizin-Service …" />
      </Field>
    </div>
  );
}

export function LinksBlock({ form, set }: BlockProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="LinkedIn" field="linkedin_url">
        <TextField field="linkedin_url" value={form.linkedin_url} onChange={(v) => set({ linkedin_url: v })} placeholder="linkedin.com/in/…" />
      </Field>
      <Field label="Portfolio" field="portfolio_url">
        <TextField field="portfolio_url" value={form.portfolio_url} onChange={(v) => set({ portfolio_url: v })} />
      </Field>
      <Field label="GitHub" field="github_url">
        <TextField field="github_url" value={form.github_url} onChange={(v) => set({ github_url: v })} />
      </Field>
      <Field label="Website" field="website_url">
        <TextField field="website_url" value={form.website_url} onChange={(v) => set({ website_url: v })} />
      </Field>
    </div>
  );
}

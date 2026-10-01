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
  NOTICE_ANCHORS,
  NOTICE_DURATIONS,
  OFFER_GROUPS,
  PERMIT_OPTIONS,
  RECOMMENDATION_OPTIONS,
  RELOCATION_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODEL_OPTIONS,
  buildExposeDraft,
  composeNotice,
  earliestStart,
  exposeSummaryIssues,
  noticeParts,
} from '@/lib/candidateDossier';
import { blockedSuggestions, industrySuggestions, locationSuggestions, offerSuggestions, roleSuggestions } from '@/lib/interviewSuggestions';
import { cn } from '@/lib/utils';
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
        <TextField field="job_title" value={form.job_title} onChange={(v) => set({ job_title: v })} placeholder="z. B. Senior Controller" />
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
        <TagInput field="skills" values={form.skills} onChange={(v) => set({ skills: v })} placeholder="z. B. SAP FI/CO, Excel …" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Branchenerfahrung" field="industries">
          <TagInput field="industries" values={form.industries} onChange={(v) => set({ industries: v })} placeholder="z. B. Maschinenbau" />
        </Field>
        <Field label="Zertifikate" field="certificates">
          <TagInput field="certificates" values={form.certificates} onChange={(v) => set({ certificates: v })} placeholder="z. B. Bilanzbuchhalter IHK" />
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
  const today = new Date();
  const { duration, anchor } = noticeParts(form.notice_period);
  const computed = earliestStart(form.notice_period, today);
  const choose = (d: string | null, a: string | null) => {
    const next = composeNotice(d, a);
    // „Verfügbar ab" folgt der Frist, solange es niemand von Hand gesetzt hat.
    const auto = !form.availability_date || form.availability_date === computed;
    set({ notice_period: next, ...(auto ? { availability_date: earliestStart(next, today) } : {}) });
  };
  return (
    <div className="space-y-3">
      <Field label="Kündigungsfrist" field="notice_period">
        <div className="space-y-1.5">
          <ChipGroup field="notice_period" options={NOTICE_DURATIONS} value={duration} onChange={(d) => choose(d, d === 'immediate' ? null : anchor)} noneLabel="Keine Angabe" />
          {duration && duration !== 'immediate' && (
            <ChipGroup options={NOTICE_ANCHORS} value={anchor} onChange={(a) => choose(duration, a)} />
          )}
        </div>
      </Field>
      {computed && duration !== 'immediate' && (
        <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs text-muted-foreground">
          Frühester Start bei Kündigung heute: <span className="font-medium text-foreground">{new Date(computed).toLocaleDateString('de-DE')}</span>
        </p>
      )}
      <Field label="Verfügbar ab" field="availability_date">
        <Input id={fieldId('availability_date')} type="date" value={form.availability_date ?? ''} onChange={(e) => set({ availability_date: e.target.value || null })} />
      </Field>
    </div>
  );
}

/** Was das nächste Angebot haben muss (Top 3): Vorschläge aus Motivation und Akte, eigener Eintrag möglich. */
export function AngebotBlock({ form, set }: BlockProps) {
  const values = form.offer_requirements;
  const full = values.length >= 3;
  const suggested = offerSuggestions(form);
  const known = new Set(OFFER_GROUPS.flatMap((g) => g.options));
  const custom = values.filter((v) => !known.has(v));
  const toggle = (o: string) => set({ offer_requirements: values.includes(o) ? values.filter((v) => v !== o) : full ? values : [...values, o] });
  const chip = (o: string) => {
    const active = values.includes(o);
    const isSuggested = !active && suggested.includes(o);
    return (
      <button
        key={o}
        type="button"
        aria-pressed={active}
        disabled={!active && full}
        onClick={() => toggle(o)}
        className={cn(
          'rounded-md border px-2.5 py-1 text-xs transition-colors',
          active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-muted',
          isSuggested && 'border-dashed border-primary text-primary',
          !active && full && 'cursor-not-allowed text-muted-foreground hover:bg-transparent',
        )}
      >
        {active && <span className="mr-1">{values.indexOf(o) + 1}</span>}
        {isSuggested && <span className="mr-1">Vorschlag:</span>}
        {o}
      </button>
    );
  };
  return (
    <Field label="Was muss das nächste Angebot haben? (Top 3)" field="offer_requirements" hint={`${values.length} von 3 gewählt`}>
      <div className="space-y-1.5" id={fieldId('offer_requirements')}>
        {OFFER_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{g.label}</span>
            {g.options.map(chip)}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">Eigenes</span>
          <MultiChips options={[]} values={custom} onChange={(next) => set({ offer_requirements: [...values.filter((v) => known.has(v)), ...next].slice(0, 3) })} allowCustom max={3 - (values.length - custom.length)} />
        </div>
      </div>
    </Field>
  );
}

/** Nicht vorstellen bei: aktueller Arbeitgeber als Vorschlag, frühere Arbeitgeber zum Antippen. */
export function SperrlisteBlock({ form, set, formerEmployers = [] }: BlockProps & { formerEmployers?: string[] }) {
  return (
    <Field label="Nicht vorstellen bei" field="blocked_companies" hint="Wirkt sofort im Matching: Stellen dieser Firmen werden nicht vorgeschlagen.">
      <TagInput
        field="blocked_companies"
        values={form.blocked_companies}
        onChange={(v) => set({ blocked_companies: v })}
        placeholder="Firma eintippen"
        suggestions={blockedSuggestions(form, formerEmployers)}
      />
    </Field>
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
        <TagInput field="target_roles" values={form.target_roles} onChange={(v) => set({ target_roles: v })} placeholder="Rolle eintippen" suggestions={roleSuggestions(form)} />
      </Field>
      <Field label="Zielbranchen" field="target_industries">
        <TagInput field="target_industries" values={form.target_industries} onChange={(v) => set({ target_industries: v })} placeholder="Branche eintippen" suggestions={industrySuggestions(form)} />
      </Field>
      <Field label="Zielorte" field="target_locations">
        <TagInput field="target_locations" values={form.target_locations} onChange={(v) => set({ target_locations: v })} placeholder="Ort eintippen" suggestions={locationSuggestions(form)} />
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
        <TagInput field="expose_highlights" values={form.expose_highlights} onChange={(v) => set({ expose_highlights: v })} placeholder="z. B. Abschlussdauer von 8 auf 5 Tage verkürzt" />
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

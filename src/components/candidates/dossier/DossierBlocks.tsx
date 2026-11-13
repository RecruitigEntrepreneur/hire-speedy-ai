import { KeyboardEvent, useContext, useState } from 'react';
import { AlertTriangle, Plus, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  SALARY_BASIS_OPTIONS,
  SENIORITY_OPTIONS,
  WORK_MODEL_OPTIONS,
  buildExposeDraft,
  composeNotice,
  earliestStart,
  exposeSummaryIssues,
  noticeParts,
} from '@/lib/candidateDossier';
import { blockedSuggestions, industrySuggestions, locationSuggestions, offerSuggestions, roleSuggestions } from '@/lib/interviewSuggestions';
import { SPRACHEN, haeufigFehlend, istBekannteSprache, sprachVorschlaege } from '@/lib/sprachen';
import { isGermanUi, term } from '@/lib/candidateTerms';
import { intlLocale } from '@/i18n/languages';
import { cn } from '@/lib/utils';
import type { RoleFamily } from '@/lib/roleFamily';
import { minimumChips, salaryWarnings, wishChips, type SalaryChip } from '@/lib/salaryChips';
import { AreaField, ChipGroup, Field, FieldMissingContext, MoneyInput, MultiChips, NumberField, TagInput, TextField, fieldId } from './DossierFields';

// Bausteine der Kandidatenakte. Bearbeiten-Panel und Interview setzen sie
// unterschiedlich zusammen, schreiben aber dieselben Felder.

export interface BlockProps {
  form: DossierForm;
  set: (patch: Partial<DossierForm>) => void;
  errors?: Partial<Record<keyof DossierForm, string>>;
}

export function KontaktBlock({ form, set, errors }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('blocks.name')} field="full_name" error={errors?.full_name}>
          <TextField field="full_name" value={form.full_name} onChange={(v) => set({ full_name: v })} />
        </Field>
        <Field label={t('blocks.city')} field="city">
          <TextField field="city" value={form.city} onChange={(v) => set({ city: v })} placeholder={t('blocks.cityPlaceholder')} />
        </Field>
        <Field label={t('blocks.email')} field="email" error={errors?.email}>
          <TextField field="email" type="email" value={form.email} onChange={(v) => set({ email: v })} placeholder={t('blocks.emailPlaceholder')} />
        </Field>
        <Field label={t('blocks.phone')} field="phone" error={errors?.phone}>
          <TextField field="phone" value={form.phone} onChange={(v) => set({ phone: v })} placeholder="+49 …" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">{t('blocks.contactHint')}</p>
    </div>
  );
}

export function RolleBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t('blocks.currentRole')} field="job_title">
        <TextField field="job_title" value={form.job_title} onChange={(v) => set({ job_title: v })} placeholder={t('blocks.currentRolePlaceholder')} />
      </Field>
      <Field label={t('blocks.employer')} field="company">
        <TextField field="company" value={form.company} onChange={(v) => set({ company: v })} />
      </Field>
      <Field label={t('blocks.experience')} field="experience_years">
        <NumberField field="experience_years" value={form.experience_years} onChange={(v) => set({ experience_years: v })} suffix={t('blocks.years')} />
      </Field>
    </div>
  );
}

export function BerufBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-4">
      <RolleBlock form={form} set={set} />
      <Field label={t('blocks.seniority')} field="seniority">
        <ChipGroup field="seniority" options={SENIORITY_OPTIONS} value={form.seniority} onChange={(v) => set({ seniority: v })} />
      </Field>
      <Field label={t('blocks.skills')} field="skills" hint={t('blocks.skillsHint')}>
        <TagInput field="skills" values={form.skills} onChange={(v) => set({ skills: v })} placeholder={t('blocks.skillsPlaceholder')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('blocks.industries')} field="industries">
          <TagInput field="industries" values={form.industries} onChange={(v) => set({ industries: v })} placeholder={t('blocks.industriesPlaceholder')} />
        </Field>
        <Field label={t('blocks.certificates')} field="certificates">
          <TagInput field="certificates" values={form.certificates} onChange={(v) => set({ certificates: v })} placeholder={t('blocks.certificatesPlaceholder')} />
        </Field>
      </div>
    </div>
  );
}

function SalaryChipRow({ chips, value, onPick }: { chips: SalaryChip[]; value: number | null; onPick: (v: number) => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <button key={c.value} type="button" onClick={() => onPick(c.value)}
          className={cn('rounded-md border px-2 py-0.5 text-xs transition-colors', value === c.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Gehalt. Mit `family` (Interview): Wunsch und Schmerzgrenze per Klick relativ zum
 * heutigen Gehalt, dazu fix oder mit Bonus und Hinweise bei Unstimmigem.
 */
export function GehaltBlock({ form, set, family }: BlockProps & { family?: RoleFamily }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const warnings = family ? salaryWarnings(form) : [];
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('blocks.currentSalary')} field="current_salary" hint={family ? t('blocks.currentSalaryHint') : undefined}>
          <MoneyInput field="current_salary" value={form.current_salary} onChange={(v) => set({ current_salary: v })} />
        </Field>
        <Field label={t('blocks.expectedSalary')} field="expected_salary">
          <MoneyInput field="expected_salary" value={form.expected_salary} onChange={(v) => set({ expected_salary: v })} />
          {family && <SalaryChipRow chips={wishChips(form.current_salary, family)} value={form.expected_salary} onPick={(v) => set({ expected_salary: v })} />}
        </Field>
        <Field label={t('blocks.salaryMinimum')} field="salary_minimum">
          <MoneyInput field="salary_minimum" value={form.salary_minimum} onChange={(v) => set({ salary_minimum: v })} />
          {family && <SalaryChipRow chips={minimumChips(form.expected_salary, form.current_salary)} value={form.salary_minimum} onPick={(v) => set({ salary_minimum: v })} />}
        </Field>
      </div>
      {family && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{t('blocks.amountsAre')}</span>
          <ChipGroup field="salary_basis" options={SALARY_BASIS_OPTIONS} value={form.salary_basis} onChange={(v) => set({ salary_basis: v })} />
        </div>
      )}
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-xs text-warning"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>
      ))}
    </div>
  );
}

export function VerfuegbarkeitBlock({ form, set, hint }: BlockProps & { hint?: { duration: string; anchor: string | null; label: string } | null }) {
  const { t, i18n } = useTranslation(['candidateDossier', 'candidateTerms']);
  const today = new Date();
  const { duration, anchor } = noticeParts(form.notice_period);
  const computed = earliestStart(form.notice_period, today);
  const choose = (d: string | null, a: string | null) => {
    const next = composeNotice(d, a);
    // „Verfügbar ab" springt bei jeder Wahl auf den frühesten Start (Durchklicken
    // 15.10.2026). Bisher nur, solange es leer war -- ein älteres Datum blieb stehen.
    // „Keine Angabe" lässt ein vorhandenes Datum stehen.
    const start = earliestStart(next, today);
    set({ notice_period: next, ...(start ? { availability_date: start } : {}) });
  };
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(i18n.language));
  const abweichend = !!computed && !!form.availability_date && form.availability_date !== computed;
  const zuFrueh = abweichend && form.availability_date! < computed!;
  return (
    <div className="space-y-3">
      <Field label={t('blocks.notice')} field="notice_period" hint={t('blocks.noticeHint')}>
        <div className="space-y-1.5">
          {hint && !form.notice_period && (
            <p className="flex flex-wrap items-center gap-2 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
              {term(hint.label)}
              <button type="button" className="underline underline-offset-2" onClick={() => choose(hint.duration, hint.anchor)}>{t('blocks.apply')}</button>
            </p>
          )}
          <ChipGroup field="notice_period" options={NOTICE_DURATIONS} value={duration} onChange={(d) => choose(d, d === 'immediate' ? null : anchor)} noneLabel={t('blocks.noAnswer')} />
          {duration && duration !== 'immediate' && (
            <ChipGroup options={NOTICE_ANCHORS} value={anchor} onChange={(a) => choose(duration, a)} />
          )}
        </div>
      </Field>
      {computed && duration !== 'immediate' && (
        <p className={cn('rounded-md px-2.5 py-1.5 text-xs', zuFrueh ? 'bg-warning/10 text-warning' : 'bg-muted/60 text-muted-foreground')}>
          {t('blocks.earliestStart')} <span className={cn('font-medium', !zuFrueh && 'text-foreground')}>{fmt(computed)}</span>
          {abweichend && (
            <>
              {' · '}{t(zuFrueh ? 'blocks.availableFromIsEarly' : 'blocks.availableFromIs', { date: fmt(form.availability_date!) })}{' · '}
              <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => set({ availability_date: computed })}>{t('blocks.apply')}</button>
            </>
          )}
        </p>
      )}
      <Field label={t('blocks.availableFrom')} field="availability_date">
        <Input id={fieldId('availability_date')} type="date" value={form.availability_date ?? ''} onChange={(e) => set({ availability_date: e.target.value || null })} />
      </Field>
    </div>
  );
}

/** Was das nächste Angebot haben muss (Top 3): Vorschläge aus Motivation und Akte, eigener Eintrag möglich. */
export function AngebotBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
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
        {isSuggested && <span className="mr-1">{t('fields.suggestionPrefix')}</span>}
        {term(o)}
      </button>
    );
  };
  return (
    <Field label={t('blocks.offerQuestion')} field="offer_requirements" hint={t('blocks.offerCount', { n: values.length })}>
      <div className="space-y-1.5" id={fieldId('offer_requirements')}>
        {OFFER_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">{term(g.label)}</span>
            {g.options.map(chip)}
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="w-24 shrink-0 text-xs text-muted-foreground">{t('fields.custom')}</span>
          <MultiChips options={[]} values={custom} onChange={(next) => set({ offer_requirements: [...values.filter((v) => known.has(v)), ...next].slice(0, 3) })} allowCustom max={3 - (values.length - custom.length)} />
        </div>
      </div>
    </Field>
  );
}

/** Nicht vorstellen bei: aktueller Arbeitgeber als Vorschlag, frühere Arbeitgeber zum Antippen. */
export function SperrlisteBlock({ form, set, formerEmployers = [] }: BlockProps & { formerEmployers?: string[] }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <Field label={t('blocks.blocked')} field="blocked_companies" hint={t('blocks.blockedHint')}>
      <TagInput
        field="blocked_companies"
        values={form.blocked_companies}
        onChange={(v) => set({ blocked_companies: v })}
        placeholder={t('blocks.blockedPlaceholder')}
        suggestions={blockedSuggestions(form, formerEmployers)}
      />
    </Field>
  );
}

export function MotivationBlock({ form, set, label }: BlockProps & { label?: string }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-2">
      <Field label={label ?? t('blocks.motivation')} field="change_motivation">
        <AreaField field="change_motivation" value={form.change_motivation} onChange={(v) => set({ change_motivation: v })} placeholder={t('blocks.motivationPlaceholder')} rows={2} />
      </Field>
      <MultiChips options={MOTIVATION_TAGS} values={form.change_motivation_tags} onChange={(v) => set({ change_motivation_tags: v })} />
    </div>
  );
}

/** hideRelocation: im Interview steht „Umzug“ schon bei „Wie soll das neue Unternehmen sein?“. */
export function ArbeitsortBlock({ form, set, hideRelocation = false }: BlockProps & { hideRelocation?: boolean }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-4">
      <Field label={t('blocks.workModel')} field="remote_preference">
        <ChipGroup field="remote_preference" options={WORK_MODEL_OPTIONS} value={form.remote_preference} onChange={(v) => set({ remote_preference: v })} noneLabel={t('blocks.noAnswer')} />
      </Field>
      <Field label={t('blocks.maxCommute')} field="max_commute_minutes">
        <ChipGroup
          field="max_commute_minutes"
          options={COMMUTE_OPTIONS}
          value={form.max_commute_minutes != null ? String(form.max_commute_minutes) : null}
          onChange={(v) => set({ max_commute_minutes: v ? parseInt(v, 10) : null })}
          noneLabel={t('blocks.noAnswer')}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('blocks.employmentType')} field="employment_type">
          <ChipGroup field="employment_type" options={EMPLOYMENT_OPTIONS} value={form.employment_type} onChange={(v) => set({ employment_type: v })} />
        </Field>
        {!hideRelocation && (
          <Field label={t('blocks.relocation')} field="relocation_willing">
            <ChipGroup
              field="relocation_willing"
              options={RELOCATION_OPTIONS}
              value={form.relocation_willing == null ? null : form.relocation_willing ? 'yes' : 'no'}
              onChange={(v) => set({ relocation_willing: v == null ? null : v === 'yes' })}
              noneLabel={t('blocks.noAnswer')}
            />
          </Field>
        )}
      </div>
    </div>
  );
}

export function ZieleBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label={t('blocks.targetRoles')} field="target_roles">
        <TagInput field="target_roles" values={form.target_roles} onChange={(v) => set({ target_roles: v })} placeholder={t('blocks.targetRolesPlaceholder')} suggestions={roleSuggestions(form)} />
      </Field>
      <Field label={t('blocks.targetIndustries')} field="target_industries">
        <TagInput field="target_industries" values={form.target_industries} onChange={(v) => set({ target_industries: v })} placeholder={t('blocks.targetIndustriesPlaceholder')} suggestions={industrySuggestions(form)} />
      </Field>
      <Field label={t('blocks.targetLocations')} field="target_locations">
        <TagInput field="target_locations" values={form.target_locations} onChange={(v) => set({ target_locations: v })} placeholder={t('blocks.targetLocationsPlaceholder')} suggestions={locationSuggestions(form)} />
      </Field>
    </div>
  );
}

/**
 * Sprache eintippen mit passenden Vorschlägen darunter (05.11.2026). Klick, Enter oder Tab
 * übernimmt den markierten Vorschlag; was nicht in der Liste steht, bleibt wie getippt.
 */
function SprachFeld({ value, andere, onChange }: { value: string; andere: string[]; onChange: (v: string) => void }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const [offen, setOffen] = useState(false);
  const [markiert, setMarkiert] = useState(0);
  // Gespeichert bleibt der deutsche Name der Sprache (Matching, Kundenansicht); angezeigt und
  // gesucht wird in der Sprache der Oberfläche.
  const deutsch = isGermanUi();
  const norm = (s: string) => s.trim().toLowerCase();
  const kanon = (s: string) => SPRACHEN.find((x) => norm(x) === norm(s)) ?? null;
  const gezeigt = deutsch ? value : kanon(value) ? term(kanon(value)) : value;
  const fremdListe = () => {
    const n = norm(value);
    if (!n || istBekannteSprache(value)) return [];
    const frei = SPRACHEN.filter((x) => !andere.some((a) => norm(a) === norm(x)));
    const anfang = frei.filter((x) => norm(term(x)).startsWith(n));
    const enthalten = n.length >= 3 ? frei.filter((x) => norm(term(x)).includes(n)) : [];
    return [...new Set([...anfang, ...enthalten, ...sprachVorschlaege(value, andere)])].slice(0, 6);
  };
  const liste = !offen ? [] : deutsch ? sprachVorschlaege(value, andere) : fremdListe();
  const nimm = (v: string) => { onChange(v); setOffen(false); };
  const tippen = (v: string) => (deutsch ? v : SPRACHEN.find((x) => norm(term(x)) === norm(v)) ?? v);
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!liste.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setMarkiert((m) => (m + (e.key === 'ArrowDown' ? 1 : liste.length - 1)) % liste.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (e.key === 'Enter') e.preventDefault();
      nimm(liste[Math.min(markiert, liste.length - 1)]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOffen(false);
    }
  };
  return (
    <div className="relative">
      <Input
        value={gezeigt}
        placeholder={t('blocks.language')}
        aria-label={t('blocks.language')}
        role="combobox"
        aria-expanded={liste.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(e) => { onChange(tippen(e.target.value)); setOffen(true); setMarkiert(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => setOffen(false)}
      />
      {liste.length > 0 && (
        <ul role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover p-1 shadow-md">
          {liste.map((x, i) => (
            <li
              key={x}
              role="option"
              aria-selected={i === markiert}
              className={cn('cursor-pointer rounded px-2 py-1.5 text-sm', i === markiert ? 'bg-muted' : 'hover:bg-muted')}
              onMouseDown={(e) => { e.preventDefault(); nimm(x); }}
              onMouseEnter={() => setMarkiert(i)}
            >
              {term(x)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SprachenBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const fehlt = !!useContext(FieldMissingContext)?.has('languages');
  const update = (i: number, patch: Partial<DossierForm['languages'][number]>) =>
    set({ languages: form.languages.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const haeufig = haeufigFehlend(form.languages.map((l) => l.language));
  return (
    <div className={cn('space-y-2', fehlt && 'border-l-2 border-warning pl-3')} data-dossier-field="languages">
      {form.languages.length === 0 && <p className={cn('text-xs', fehlt ? 'text-warning' : 'text-muted-foreground')}>{fehlt ? t('blocks.noLanguageMissing') : t('blocks.noLanguage')}</p>}
      {form.languages.map((l, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] items-center gap-2">
          <SprachFeld value={l.language} andere={form.languages.filter((_, idx) => idx !== i).map((x) => x.language)} onChange={(v) => update(i, { language: v })} />
          <Select value={l.proficiency || '__none'} onValueChange={(v) => update(i, { proficiency: v === '__none' ? '' : v })}>
            <SelectTrigger aria-label={t('blocks.level')}>
              <SelectValue placeholder={t('blocks.level')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{t('blocks.levelOpen')}</SelectItem>
              {LANGUAGE_LEVELS.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>{term(lvl)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" aria-label={t('blocks.removeLanguage')} onClick={() => set({ languages: form.languages.filter((_, idx) => idx !== i) })}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {haeufig.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{t('blocks.frequent')}</span>
          {haeufig.map((x) => (
            <button
              key={x}
              type="button"
              className="rounded-md border border-dashed border-primary px-2 py-0.5 text-xs text-primary hover:bg-primary/10"
              onClick={() => set({ languages: [...form.languages, { language: x, proficiency: '' }] })}
            >
              + {term(x)}
            </button>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={() => set({ languages: [...form.languages, { language: form.languages.length ? '' : 'Deutsch', proficiency: '' }] })}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> {t('blocks.addLanguage')}
      </Button>
    </div>
  );
}

export function ArbeitserlaubnisBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-3">
      <ChipGroup field="work_permit" options={PERMIT_OPTIONS} value={form.work_permit} onChange={(v) => set({ work_permit: v })} noneLabel={t('blocks.noAnswer')} />
      {(form.work_permit === 'needs_visa' || form.work_permit === 'pending') && (
        <Field label={t('blocks.permitNote')} field="work_permit_notes">
          <AreaField field="work_permit_notes" value={form.work_permit_notes} onChange={(v) => set({ work_permit_notes: v })} rows={2} />
        </Field>
      )}
    </div>
  );
}

export function EmpfehlungBlock({ form, set, question }: BlockProps & { question?: string }) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  return (
    <div className="space-y-3">
      <Field label={question ?? t('blocks.recommendQuestion')} field="recommendation">
        <ChipGroup field="recommendation" options={RECOMMENDATION_OPTIONS} value={form.recommendation} onChange={(v) => set({ recommendation: v })} />
      </Field>
      <Field label={t('blocks.reasonInternal')} field="recommendation_notes">
        <AreaField field="recommendation_notes" value={form.recommendation_notes} onChange={(v) => set({ recommendation_notes: v })} placeholder={t('blocks.reasonPlaceholder')} rows={2} />
      </Field>
    </div>
  );
}

export function KundeBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
  const issues = exposeSummaryIssues(form);
  return (
    <div className="space-y-3">
      <Field
        label={
          <span className="flex items-center justify-between gap-2">
            <span>{t('blocks.shortProfile')}</span>
          </span>
        }
        field="expose_summary"
        hint={t('blocks.shortProfileHint')}
      >
        <AreaField field="expose_summary" value={form.expose_summary} onChange={(v) => set({ expose_summary: v })} placeholder={t('blocks.shortProfilePlaceholder')} rows={4} />
      </Field>
      {issues.map((i) => (
        <p key={i.message} className={`flex items-start gap-1.5 text-xs ${i.level === 'danger' ? 'text-destructive' : 'text-warning'}`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {term(i.message)}
        </p>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set({ expose_summary: buildExposeDraft(form) })}>
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {issues.length ? t('blocks.redraft') : t('blocks.draft')}
      </Button>
      <Field label={t('blocks.highlights')} field="expose_highlights">
        <TagInput field="expose_highlights" values={form.expose_highlights} onChange={(v) => set({ expose_highlights: v })} placeholder={t('blocks.highlightsPlaceholder')} />
      </Field>
    </div>
  );
}

export function LinksBlock({ form, set }: BlockProps) {
  const { t } = useTranslation(['candidateDossier', 'candidateTerms']);
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
      <Field label={t('blocks.website')} field="website_url">
        <TextField field="website_url" value={form.website_url} onChange={(v) => set({ website_url: v })} />
      </Field>
    </div>
  );
}

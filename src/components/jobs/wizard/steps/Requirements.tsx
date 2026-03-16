import { useState } from 'react';
import { useWizardContext } from '../JobWizard';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ComboboxTags, ComboboxSingle } from '@/components/ui/combobox-tags';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  COMMON_SKILLS,
  COMMON_LANGUAGES,
  LANGUAGE_LEVELS,
  CERTIFICATIONS_COMMON,
  EXCLUSION_PRESETS,
} from '@/lib/wizard-options';
import { useSkillSuggestions } from '@/hooks/useSkillSuggestions';
import { X, GripVertical, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Requirements() {
  const { formData, updateField } = useWizardContext();
  const [extrasOpen, setExtrasOpen] = useState(false);

  // Skill taxonomy search for must-haves and nice-to-haves
  const mustHaveSkills = useSkillSuggestions();
  const niceToHaveSkills = useSkillSuggestions();

  // Must-Haves
  const addMustHave = (skill: string) => {
    if (!formData.must_haves.includes(skill)) {
      updateField('must_haves', [...formData.must_haves, skill]);
    }
  };
  const removeMustHave = (skill: string) => {
    updateField('must_haves', formData.must_haves.filter(s => s !== skill));
  };

  // Nice-to-Haves
  const addNiceToHave = (skill: string) => {
    if (!formData.nice_to_haves.includes(skill)) {
      updateField('nice_to_haves', [...formData.nice_to_haves, skill]);
    }
  };
  const removeNiceToHave = (skill: string) => {
    updateField('nice_to_haves', formData.nice_to_haves.filter(s => s !== skill));
  };

  // Exclusion criteria
  const addExclusion = (criterion: string) => {
    if (!formData.exclusion_criteria.includes(criterion)) {
      updateField('exclusion_criteria', [...formData.exclusion_criteria, criterion]);
    }
  };
  const removeExclusion = (criterion: string) => {
    updateField('exclusion_criteria', formData.exclusion_criteria.filter(c => c !== criterion));
  };

  // Languages
  const addLanguage = (language?: string) => {
    updateField('required_languages', [
      ...formData.required_languages,
      { language: language || '', level: 'fluent' },
    ]);
  };
  const updateLanguage = (index: number, field: 'language' | 'level', value: string) => {
    const updated = [...formData.required_languages];
    updated[index] = { ...updated[index], [field]: value };
    updateField('required_languages', updated);
  };
  const removeLanguage = (index: number) => {
    updateField('required_languages', formData.required_languages.filter((_, i) => i !== index));
  };

  // Quick-add common languages
  const existingLanguages = formData.required_languages.map(l => l.language);
  const suggestedLanguages = COMMON_LANGUAGES.filter(l => !existingLanguages.includes(l)).slice(0, 6);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Anforderungsprofil</h2>
        <p className="text-sm text-muted-foreground">
          Definieren Sie die fachlichen und persönlichen Anforderungen
        </p>
      </div>

      {/* Must-Haves with priority + autocomplete */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Must-Haves (nach Priorität)
          </Label>
          <span className="text-xs text-muted-foreground">{formData.must_haves.length} Skills</span>
        </div>

        <div className="space-y-1.5">
          {formData.must_haves.map((skill, index) => (
            <div
              key={skill}
              className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab" />
              <span className="text-xs font-medium text-muted-foreground w-5">{index + 1}.</span>
              <span className="text-sm flex-1">{skill}</span>
              <Badge variant="outline" className="text-[10px]">Pflicht</Badge>
              <button onClick={() => removeMustHave(skill)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <ComboboxTags
          tags={[]}
          onAdd={addMustHave}
          onRemove={() => {}}
          suggestions={COMMON_SKILLS.filter(s => !formData.must_haves.includes(s) && !formData.nice_to_haves.includes(s))}
          onSearch={(q, exclude) => mustHaveSkills.search(q, [...exclude, ...formData.must_haves, ...formData.nice_to_haves])}
          asyncResults={mustHaveSkills.suggestions.map(s => ({ label: s.canonical_name, category: s.category }))}
          asyncLoading={mustHaveSkills.loading}
          placeholder="Must-Have Skill eingeben oder auswählen..."
        />
      </div>

      {/* Nice-to-Haves with autocomplete */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Nice-to-Haves
        </Label>
        <ComboboxTags
          tags={formData.nice_to_haves}
          onAdd={addNiceToHave}
          onRemove={removeNiceToHave}
          suggestions={COMMON_SKILLS.filter(s => !formData.must_haves.includes(s) && !formData.nice_to_haves.includes(s))}
          onSearch={(q, exclude) => niceToHaveSkills.search(q, [...exclude, ...formData.must_haves, ...formData.nice_to_haves])}
          asyncResults={niceToHaveSkills.suggestions.map(s => ({ label: s.canonical_name, category: s.category }))}
          asyncLoading={niceToHaveSkills.loading}
          placeholder="Nice-to-Have Skill eingeben oder auswählen..."
        />
      </div>

      {/* Exclusion Criteria with presets */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ausschlusskriterien
        </Label>
        <ComboboxTags
          tags={formData.exclusion_criteria}
          onAdd={addExclusion}
          onRemove={removeExclusion}
          suggestions={EXCLUSION_PRESETS.filter(e => !formData.exclusion_criteria.includes(e))}
          placeholder="Ausschlusskriterium eingeben oder auswählen..."
        />
      </div>

      {/* Languages — Combobox + Quick-Add Chips */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Sprachen & Erfahrung
        </Label>

        {/* Quick-add language chips */}
        {suggestedLanguages.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Schnell hinzufügen:</span>
            <div className="flex flex-wrap gap-1.5">
              {suggestedLanguages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => addLanguage(lang)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-xs font-medium transition-colors border',
                    'bg-muted/50 text-muted-foreground border-transparent',
                    'hover:bg-primary/10 hover:text-primary hover:border-primary/30'
                  )}
                >
                  + {lang}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {formData.required_languages.map((lang, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <ComboboxSingle
                value={lang.language}
                onChange={(v) => updateLanguage(index, 'language', v)}
                suggestions={COMMON_LANGUAGES}
                placeholder="Sprache wählen..."
              />
              <Select
                value={lang.level}
                onValueChange={(v) => updateLanguage(index, 'level', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                onClick={() => removeLanguage(index)}
                className="h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => addLanguage()}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Sprache manuell hinzufügen
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <Label>Erfahrung mindestens (Jahre)</Label>
            <Input
              type="number"
              value={formData.experience_years_min ?? ''}
              onChange={(e) => updateField('experience_years_min', e.target.value ? parseInt(e.target.value) : null)}
              placeholder="z.B. 5"
              min={0}
            />
          </div>
          <div className="space-y-2">
            <Label>Branchenerfahrung nötig</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.industry_experience_required}
                onCheckedChange={(v) => updateField('industry_experience_required', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.industry_experience_required ? 'Ja' : 'Nein'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Extras — Certifications with autocomplete */}
      <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            {extrasOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Weitere Anforderungen (Zertifikate, Sicherheitsüberprüfung, ...)
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card border rounded-lg p-5 space-y-4 mt-2">
            <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Zertifikate
            </Label>
            <ComboboxTags
              tags={formData.required_certifications}
              onAdd={(c) => updateField('required_certifications', [...formData.required_certifications, c])}
              onRemove={(c) => updateField('required_certifications', formData.required_certifications.filter(x => x !== c))}
              suggestions={CERTIFICATIONS_COMMON.filter(c => !formData.required_certifications.includes(c))}
              placeholder="Zertifikat eingeben oder auswählen..."
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.security_clearance_required}
                  onCheckedChange={(v) => updateField('security_clearance_required', v)}
                />
                <Label className="text-sm">Sicherheitsüberprüfung</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.background_check_required}
                  onCheckedChange={(v) => updateField('background_check_required', v)}
                />
                <Label className="text-sm">Background-Check</Label>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Führerschein</Label>
                <Select
                  value={formData.drivers_license_required}
                  onValueChange={(v) => updateField('drivers_license_required', v)}
                >
                  <SelectTrigger><SelectValue placeholder="Nicht nötig" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nicht nötig</SelectItem>
                    <SelectItem value="B">Klasse B</SelectItem>
                    <SelectItem value="C">Klasse C</SelectItem>
                    <SelectItem value="other">Andere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

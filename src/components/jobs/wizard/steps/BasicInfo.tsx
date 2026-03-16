import { useState } from 'react';
import { useWizardContext } from '../JobWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { ComboboxSingle, ComboboxTags } from '@/components/ui/combobox-tags';
import { GERMAN_CITIES, INDUSTRIES, COMMON_SKILLS } from '@/lib/wizard-options';
import { Sparkles, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXPERIENCE_LEVELS = [
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'director', label: 'Director' },
];

const REMOTE_POLICIES = [
  { value: 'onsite', label: 'Vor Ort' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Full Remote' },
  { value: 'flexible', label: 'Flexibel' },
];

function AiSparkle() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary/70" title="Von AI vorausgefüllt">
      <Sparkles className="h-3 w-3" />
    </span>
  );
}

function FieldLabel({ label, required, aiPrefilled, fromProfile }: { label: string; required?: boolean; aiPrefilled?: boolean; fromProfile?: boolean }) {
  return (
    <Label className="flex items-center gap-1.5">
      {label}
      {required && <span className="text-destructive">*</span>}
      {fromProfile && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal text-primary/70 border-primary/30">
          Aus Profil
        </Badge>
      )}
      {aiPrefilled && !fromProfile && <AiSparkle />}
    </Label>
  );
}

export function BasicInfo() {
  const { formData, updateField, companyProfile } = useWizardContext();
  const hasProfile = !!companyProfile;
  const [companyOpen, setCompanyOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  // Check if field was likely AI-prefilled (has value)
  const ai = (field: string) => !!(formData as any)[field];

  // Check if a field value came from company profile
  const fromProfile = (field: string) => {
    if (!companyProfile) return false;
    const profileMap: Record<string, string | undefined> = {
      company_name: companyProfile.company_name,
      industry: companyProfile.industry ?? undefined,
      location: companyProfile.address ?? undefined,
      company_size_band: companyProfile.company_size_band ?? undefined,
      funding_stage: companyProfile.funding_stage ?? undefined,
    };
    return profileMap[field] !== undefined && profileMap[field] === (formData as any)[field];
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Basisdaten</h2>
        <p className="text-sm text-muted-foreground">
          Grundlegende Informationen zur Stelle
        </p>
      </div>

      {/* Company Profile Banner */}
      {hasProfile && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{companyProfile.company_name}</p>
            <p className="text-xs text-muted-foreground">
              Unternehmensdaten aus Ihrem Profil geladen. Änderungen gelten nur für diese Stelle.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0 border-primary/30 text-primary/70">
            Profil verknüpft
          </Badge>
        </div>
      )}

      {/* Section: Stelle */}
      <div className="bg-card border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Stelle</h3>

        <div className="space-y-2">
          <FieldLabel label="Jobtitel" required aiPrefilled={ai('title')} />
          <Input
            value={formData.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="z.B. Senior Backend Developer"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel label="Beschreibung" required aiPrefilled={ai('description')} />
          <Textarea
            value={formData.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Beschreiben Sie die Stelle und die wichtigsten Aufgaben..."
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <FieldLabel label="Erfahrungslevel" required aiPrefilled={ai('experience_level')} />
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => updateField('experience_level', level.value)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border',
                  formData.experience_level === level.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                )}
              >
                {level.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section: Standort & Remote */}
      <div className="bg-card border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Standort & Remote</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FieldLabel label="Standort" required aiPrefilled={ai('location')} fromProfile={fromProfile('location')} />
            <ComboboxSingle
              value={formData.location}
              onChange={(v) => updateField('location', v)}
              suggestions={GERMAN_CITIES}
              placeholder="Stadt eingeben oder auswählen..."
            />
          </div>

          <div className="space-y-2">
            <FieldLabel label="Remote-Policy" required />
            <Select
              value={formData.remote_policy}
              onValueChange={(v) => updateField('remote_policy', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REMOTE_POLICIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.remote_policy === 'hybrid' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel label="Onsite-Tage pro Woche" />
              <Select
                value={String(formData.onsite_days_required)}
                onValueChange={(v) => updateField('onsite_days_required', parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} Tage</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <FieldLabel label="Büroadresse" />
              <Input
                value={formData.office_address}
                onChange={(e) => updateField('office_address', e.target.value)}
                placeholder="Straße, PLZ Ort"
              />
            </div>
          </div>
        )}
      </div>

      {/* Collapsible: Unternehmen */}
      <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
            {companyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Unternehmen (Branche, Größe, Funding...)
            {(formData.industry || formData.company_size_band) && (
              <Badge variant="secondary" className="ml-auto text-[10px]">ausgefüllt</Badge>
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card border rounded-lg p-5 space-y-4 mt-2">
            <div className="space-y-2">
              <FieldLabel label="Unternehmen" required aiPrefilled={ai('company_name')} fromProfile={fromProfile('company_name')} />
              <Input
                value={formData.company_name}
                onChange={(e) => updateField('company_name', e.target.value)}
                placeholder="z.B. TechCorp GmbH"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <FieldLabel label="Branche" fromProfile={fromProfile('industry')} />
                <ComboboxSingle
                  value={formData.industry}
                  onChange={(v) => updateField('industry', v)}
                  suggestions={INDUSTRIES.map(i => i.label)}
                  placeholder="Branche auswählen..."
                />
              </div>
              <div className="space-y-2">
                <FieldLabel label="Unternehmensgröße" fromProfile={fromProfile('company_size_band')} />
                <Select
                  value={formData.company_size_band}
                  onValueChange={(v) => updateField('company_size_band', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10</SelectItem>
                    <SelectItem value="11-50">11-50</SelectItem>
                    <SelectItem value="51-200">51-200</SelectItem>
                    <SelectItem value="201-500">201-500</SelectItem>
                    <SelectItem value="501-1000">501-1.000</SelectItem>
                    <SelectItem value="1001-5000">1.001-5.000</SelectItem>
                    <SelectItem value="5000+">5.000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel label="Funding-Stage" fromProfile={fromProfile('funding_stage')} />
                <Select
                  value={formData.funding_stage}
                  onValueChange={(v) => updateField('funding_stage', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bootstrapped">Bootstrapped</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series-a">Series A</SelectItem>
                    <SelectItem value="series-b">Series B</SelectItem>
                    <SelectItem value="series-c+">Series C+</SelectItem>
                    <SelectItem value="public">Börsennotiert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Collapsible: Extras */}
      <Collapsible open={extrasOpen} onOpenChange={setExtrasOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
            {extrasOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            Zusätzliche Details (Tech-Stack, Reisen, Fokus...)
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="bg-card border rounded-lg p-5 space-y-4 mt-2">
            <div className="space-y-2">
              <FieldLabel label="Tech-Umfeld" aiPrefilled={formData.tech_environment.length > 0} />
              <ComboboxTags
                tags={formData.tech_environment}
                onAdd={(t) => updateField('tech_environment', [...formData.tech_environment, t])}
                onRemove={(t) => updateField('tech_environment', formData.tech_environment.filter(x => x !== t))}
                suggestions={COMMON_SKILLS.filter(s => !formData.tech_environment.includes(s))}
                placeholder="Technologie eingeben oder auswählen..."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel label="Reisetätigkeit" />
                <Select
                  value={formData.travel_required}
                  onValueChange={(v) => updateField('travel_required', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keine</SelectItem>
                    <SelectItem value="occasional">Gelegentlich ({"<"}25%)</SelectItem>
                    <SelectItem value="regular">Regelmäßig (25-50%)</SelectItem>
                    <SelectItem value="frequent">Häufig ({">"}50%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <FieldLabel label="Aufgabenschwerpunkt" />
                <Input
                  value={formData.task_focus}
                  onChange={(e) => updateField('task_focus', e.target.value)}
                  placeholder="z.B. Backend-Architektur, API-Design"
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

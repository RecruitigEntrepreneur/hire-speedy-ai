import { useWizardContext } from '../JobWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, AlertTriangle, Info } from 'lucide-react';
import { ANUE_RATE_BENCHMARKS } from '@/lib/wizard-options';

export function TempStaffingDetails() {
  const { formData, updateField } = useWizardContext();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Arbeitnehmerüberlassung (ANÜ)</h2>
        <p className="text-sm text-muted-foreground">AÜG-konforme Zeitarbeit</p>
      </div>

      {/* AÜG Compliance Alert */}
      <Alert className="border-yellow-500/30 bg-yellow-500/5">
        <ShieldAlert className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-sm">
          <strong>AÜG-Hinweis:</strong> Die maximale Überlassungsdauer beträgt 18 Monate.
          Equal Pay greift nach 9 Monaten ohne Branchenzuschlagstarifvertrag.
        </AlertDescription>
      </Alert>

      {/* Row 1: Verrechnungssatz + Benchmark */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Verrechnungssatz Min (€/h)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.rate_min ?? ''}
                onChange={(e) => updateField('rate_min', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="35"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verrechnungssatz Max (€/h)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.rate_max ?? ''}
                onChange={(e) => updateField('rate_max', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="55"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Inkl. Marge</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.rate_includes_margin}
                onCheckedChange={(v) => updateField('rate_includes_margin', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.rate_includes_margin ? 'Ja, inkl. Marge' : 'Netto'}
              </span>
            </div>
          </div>
        </div>
        {ANUE_RATE_BENCHMARKS[formData.experience_level] && (
          <p className="text-xs text-muted-foreground">
            Marktüblicher Verrechnungssatz ({formData.experience_level}): {ANUE_RATE_BENCHMARKS[formData.experience_level].min}–{ANUE_RATE_BENCHMARKS[formData.experience_level].max} €/h
          </p>
        )}
      </div>

      {/* Row 2: Einsatz */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Einsatzdauer</Label>
            <Input
              value={formData.assignment_duration}
              onChange={(e) => updateField('assignment_duration', e.target.value)}
              placeholder="z.B. 12 Monate"
            />
            {formData.assignment_duration && parseInt(formData.assignment_duration) > 18 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                AÜG: Max. 18 Monate!
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Übernahmeoption</Label>
            <Select value={formData.takeover_option} onValueChange={(v) => updateField('takeover_option', v)}>
              <SelectTrigger><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine</SelectItem>
                <SelectItem value="possible">Möglich</SelectItem>
                <SelectItem value="planned">Geplant</SelectItem>
                <SelectItem value="guaranteed">Garantiert</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Schichtmodell</Label>
            <Select value={formData.shift_model} onValueChange={(v) => updateField('shift_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normalschicht</SelectItem>
                <SelectItem value="2-shift">2-Schicht</SelectItem>
                <SelectItem value="3-shift">3-Schicht</SelectItem>
                <SelectItem value="flexible">Flexibel</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Row 3: Equal Pay & Compliance */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Equal Pay anwendbar</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.equal_pay_applicable === true}
                onCheckedChange={(v) => updateField('equal_pay_applicable', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.equal_pay_applicable ? 'Ja' : 'Nein / Unbekannt'}
              </span>
            </div>
          </div>

          {formData.equal_pay_applicable && (
            <div className="space-y-2">
              <Label>Equal Pay ab</Label>
              <Select value={formData.equal_pay_start} onValueChange={(v) => updateField('equal_pay_start', v)}>
                <SelectTrigger><SelectValue placeholder="Auswählen..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sofort">Ab Tag 1</SelectItem>
                  <SelectItem value="9_monate">Nach 9 Monaten</SelectItem>
                  <SelectItem value="15_monate">Nach 15 Monaten (mit BZ-TV)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tarifvertrag / Branchenzuschlag</Label>
            <Input
              value={formData.collective_agreement}
              onChange={(e) => updateField('collective_agreement', e.target.value)}
              placeholder="z.B. iGZ/BAP-Tarifvertrag"
            />
          </div>

          <div className="space-y-2">
            <Label>Branchenzuschläge anwendbar</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.industry_surcharges}
                onCheckedChange={(v) => updateField('industry_surcharges', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.industry_surcharges ? 'Ja' : 'Nein'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Framework & Council */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Bestehender Rahmenvertrag</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.existing_framework_contract === true}
                onCheckedChange={(v) => updateField('existing_framework_contract', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.existing_framework_contract ? 'Ja, vorhanden' : 'Nein'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Betriebsrat-Status</Label>
            <Select value={formData.works_council_status} onValueChange={(v) => updateField('works_council_status', v)}>
              <SelectTrigger><SelectValue placeholder="Auswählen..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kein Betriebsrat</SelectItem>
                <SelectItem value="exists">Vorhanden</SelectItem>
                <SelectItem value="approval_required">Zustimmung erforderlich</SelectItem>
                <SelectItem value="informed">Wird informiert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Row 5: Start */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Startdatum</Label>
            <Input
              type="date"
              value={formData.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Flexibilität</Label>
            <Select value={formData.start_date_flexibility} onValueChange={(v) => updateField('start_date_flexibility', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fest">Festes Datum</SelectItem>
                <SelectItem value="flexibel">Flexibel</SelectItem>
                <SelectItem value="asap">So schnell wie möglich</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

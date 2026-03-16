import { useWizardContext } from '../JobWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SALARY_BENCHMARKS, type SalaryBenchmark } from '@/lib/wizard-options';
import { BenefitsBuilder } from '../BenefitsBuilder';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

function SalaryBenchmarkHint({ level, min, max }: { level: string; min: number | null; max: number | null }) {
  const benchmark = SALARY_BENCHMARKS[level];
  if (!benchmark) return null;

  const midpoint = min && max ? (min + max) / 2 : min || max;
  const position = midpoint
    ? midpoint < benchmark.min ? 'below' : midpoint > benchmark.max ? 'above' : 'within'
    : null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
      <span>Marktüblich ({level}): {benchmark.min.toLocaleString('de-DE')}–{benchmark.max.toLocaleString('de-DE')} €</span>
      {position === 'below' && <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-400/30"><TrendingDown className="h-3 w-3 mr-0.5" />Unter Markt</Badge>}
      {position === 'above' && <Badge variant="outline" className="text-[10px] text-green-400 border-green-400/30"><TrendingUp className="h-3 w-3 mr-0.5" />Über Markt</Badge>}
      {position === 'within' && <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/30"><Minus className="h-3 w-3 mr-0.5" />Im Markt</Badge>}
    </div>
  );
}

export function PermanentCompensation() {
  const { formData, updateField } = useWizardContext();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Vergütung & Vertrag</h2>
        <p className="text-sm text-muted-foreground">Festanstellung</p>
      </div>

      {/* Row 1: Vertrag */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Vertragsart</Label>
            <Select value={formData.contract_type} onValueChange={(v) => updateField('contract_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unbefristet">Unbefristet</SelectItem>
                <SelectItem value="befristet">Befristet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Arbeitszeit</Label>
            <Select value={formData.employment_type} onValueChange={(v) => updateField('employment_type', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full-time">Vollzeit</SelectItem>
                <SelectItem value="part-time">Teilzeit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Probezeit</Label>
            <Select
              value={formData.probation_months !== null ? String(formData.probation_months) : '6'}
              onValueChange={(v) => updateField('probation_months', parseInt(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Keine</SelectItem>
                <SelectItem value="3">3 Monate</SelectItem>
                <SelectItem value="6">6 Monate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Row 2: Gehalt + Benchmark */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Gehalt Min (brutto/Jahr)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.salary_min ?? ''}
                onChange={(e) => updateField('salary_min', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="60.000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Gehalt Max (brutto/Jahr)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.salary_max ?? ''}
                onChange={(e) => updateField('salary_max', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="85.000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verhandelbar</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.salary_negotiable}
                onCheckedChange={(v) => updateField('salary_negotiable', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.salary_negotiable ? 'Ja' : 'Nein'}
              </span>
            </div>
          </div>
        </div>
        <SalaryBenchmarkHint level={formData.experience_level} min={formData.salary_min} max={formData.salary_max} />
      </div>

      {/* Row 3: Benefits Builder */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Benefits & Vorteile</Label>
          <span className="text-xs text-muted-foreground">
            Klick zum Hinzufügen — DAS Verkaufsargument bei Kandidaten
          </span>
        </div>

        <BenefitsBuilder
          selected={formData.benefits}
          onAdd={(b) => { if (!formData.benefits.includes(b)) updateField('benefits', [...formData.benefits, b]); }}
          onRemove={(b) => updateField('benefits', formData.benefits.filter(x => x !== b))}
          onBulkAdd={(items) => updateField('benefits', [...formData.benefits, ...items])}
        />

        <div className="flex items-center gap-3 pt-2 border-t">
          <Switch
            checked={formData.equity_options}
            onCheckedChange={(v) => updateField('equity_options', v)}
          />
          <Label className="text-sm">Equity / Beteiligung möglich</Label>
        </div>
      </div>

      {/* Row 4: Start */}
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

import { useWizardContext } from '../JobWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RATE_BENCHMARKS } from '@/lib/wizard-options';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function FreelanceProject() {
  const { formData, updateField } = useWizardContext();
  const [deliverableInput, setDeliverableInput] = useState('');

  const addDeliverable = (d: string) => {
    if (d && !formData.deliverables.includes(d)) {
      updateField('deliverables', [...formData.deliverables, d]);
    }
    setDeliverableInput('');
  };

  const removeDeliverable = (d: string) => {
    updateField('deliverables', formData.deliverables.filter(x => x !== d));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Projekt & Vergütung</h2>
        <p className="text-sm text-muted-foreground">Freelancer / Projektbasis</p>
      </div>

      {/* Row 1: Rate Model + Benchmark */}
      <div className="bg-card border rounded-lg p-5 space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Vergütungsmodell</Label>
            <Select value={formData.compensation_model} onValueChange={(v) => updateField('compensation_model', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly_rate">Stundensatz</SelectItem>
                <SelectItem value="daily_rate">Tagessatz</SelectItem>
                <SelectItem value="project_fixed">Projektpauschale</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>
              {formData.compensation_model === 'hourly_rate' ? 'Stundensatz Min' :
               formData.compensation_model === 'daily_rate' ? 'Tagessatz Min' : 'Budget Min'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.rate_min ?? ''}
                onChange={(e) => updateField('rate_min', e.target.value ? parseInt(e.target.value) : null)}
                placeholder={formData.compensation_model === 'hourly_rate' ? '80' : '600'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {formData.compensation_model === 'hourly_rate' ? 'Stundensatz Max' :
               formData.compensation_model === 'daily_rate' ? 'Tagessatz Max' : 'Budget Max'}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.rate_max ?? ''}
                onChange={(e) => updateField('rate_max', e.target.value ? parseInt(e.target.value) : null)}
                placeholder={formData.compensation_model === 'hourly_rate' ? '120' : '900'}
              />
            </div>
          </div>
        </div>
        {formData.compensation_model === 'daily_rate' && RATE_BENCHMARKS[formData.experience_level] && (
          <p className="text-xs text-muted-foreground">
            Marktüblicher Tagessatz ({formData.experience_level}): {RATE_BENCHMARKS[formData.experience_level].min}–{RATE_BENCHMARKS[formData.experience_level].max} €/Tag
          </p>
        )}
      </div>

      {/* Row 2: Duration & Scope */}
      <div className="bg-card border rounded-lg p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Projektlaufzeit</Label>
            <Input
              value={formData.project_duration}
              onChange={(e) => updateField('project_duration', e.target.value)}
              placeholder="z.B. 6 Monate"
            />
          </div>

          <div className="space-y-2">
            <Label>Gesamtbudget (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">&euro;</span>
              <Input
                type="number"
                className="pl-7"
                value={formData.project_budget_total ?? ''}
                onChange={(e) => updateField('project_budget_total', e.target.value ? parseInt(e.target.value) : null)}
                placeholder="50.000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Verlängerung möglich</Label>
            <div className="flex items-center gap-2 h-10">
              <Switch
                checked={formData.extension_possible === true}
                onCheckedChange={(v) => updateField('extension_possible', v)}
              />
              <span className="text-sm text-muted-foreground">
                {formData.extension_possible ? 'Ja' : 'Nein'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Scope & Deliverables */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="space-y-2">
          <Label>Projektbeschreibung / Scope</Label>
          <Textarea
            value={formData.project_scope}
            onChange={(e) => updateField('project_scope', e.target.value)}
            placeholder="Beschreiben Sie den Projektumfang und die Ziele..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Deliverables</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.deliverables.map((d) => (
              <Badge key={d} variant="secondary" className="gap-1 pr-1">
                {d}
                <button onClick={() => removeDeliverable(d)} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={deliverableInput}
            onChange={(e) => setDeliverableInput(e.target.value)}
            placeholder="Deliverable hinzufügen und Enter drücken..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDeliverable(deliverableInput.trim());
              }
            }}
          />
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

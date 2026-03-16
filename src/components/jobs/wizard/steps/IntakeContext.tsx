import { useState } from 'react';
import { useWizardContext } from '../JobWizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { IntakeBriefingSection } from '@/components/jobs/IntakeBriefingSection';
import { INTERVIEW_TEMPLATES, COACHING_TIPS } from '@/lib/wizard-options';
import { X, Lightbulb, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | number | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border',
            String(value) === String(opt.value)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InterviewProcessEditor({
  interviewStages,
  interviewProcess,
  onUpdate,
}: {
  interviewStages: number | null;
  interviewProcess: string;
  onUpdate: (stages: number, process: string) => void;
}) {
  // Parse existing process into steps (split by →)
  const parseSteps = (process: string): string[] => {
    if (!process) return [];
    return process.split(' → ').map(s => s.trim()).filter(Boolean);
  };

  const [steps, setSteps] = useState<string[]>(parseSteps(interviewProcess));

  const syncToForm = (newSteps: string[]) => {
    setSteps(newSteps);
    onUpdate(newSteps.length, newSteps.join(' → '));
  };

  const applyTemplate = (tpl: typeof INTERVIEW_TEMPLATES[0]) => {
    setSteps([...tpl.steps]);
    onUpdate(tpl.stages, tpl.steps.join(' → '));
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index] = value;
    syncToForm(updated);
  };

  const addStep = () => {
    syncToForm([...steps, '']);
  };

  const removeStep = (index: number) => {
    syncToForm(steps.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <Label>Interview-Prozess</Label>
      <div className="flex flex-wrap gap-2">
        {INTERVIEW_TEMPLATES.map((tpl) => {
          const isActive = interviewStages === tpl.stages &&
            interviewProcess === tpl.steps.join(' → ');
          return (
            <button
              key={tpl.id}
              onClick={() => applyTemplate(tpl)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
              )}
            >
              {tpl.label}
            </button>
          );
        })}
      </div>

      {steps.length > 0 && (
        <div className="bg-muted/30 rounded-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Ablauf:</span>
            <Badge variant="secondary" className="text-[10px]">{steps.length} Runden</Badge>
          </div>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">{i + 1}.</span>
              <Input
                value={step}
                onChange={(e) => updateStep(i, e.target.value)}
                className="text-sm h-8"
                placeholder={`Runde ${i + 1}...`}
              />
              <button
                onClick={() => removeStep(i)}
                className="text-muted-foreground hover:text-destructive shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            onClick={addStep}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1"
          >
            <Plus className="h-3 w-3" /> Runde hinzufügen
          </button>
        </div>
      )}
    </div>
  );
}

export function IntakeContext() {
  const { formData, updateField, applyIntakeData, scores } = useWizardContext();
  const [trainableInput, setTrainableInput] = useState('');

  const overallScore = Math.round(
    (scores.profileCompleteness + scores.matchingReadiness + scores.recruiterActionability) / 3
  );

  // Coaching tips - show unfulfilled ones
  const activeTips = COACHING_TIPS.filter(tip => tip.check(formData as unknown as Record<string, unknown>));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Kontext & Qualität</h2>
          <p className="text-sm text-muted-foreground">
            Zusätzliche Informationen für besseres Matching
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Score:</span>
          <Progress value={overallScore} className="w-20 h-2" />
          <span className={cn(
            'text-sm font-medium',
            overallScore >= 80 ? 'text-green-400' :
            overallScore >= 50 ? 'text-yellow-400' : 'text-muted-foreground'
          )}>
            {overallScore}%
          </span>
        </div>
      </div>

      {/* Coaching Panel */}
      {activeTips.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Lightbulb className="h-4 w-4" />
            Tipps für besseres Matching ({activeTips.length} offen)
          </h3>
          <div className="space-y-1">
            {activeTips.slice(0, 4).map((tip) => (
              <div key={tip.field} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{tip.message}</span>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                  {tip.impact}
                </Badge>
              </div>
            ))}
            {activeTips.length > 4 && (
              <span className="text-xs text-muted-foreground">
                +{activeTips.length - 4} weitere Tipps
              </span>
            )}
          </div>
        </div>
      )}

      {/* Section A: Quick Questions with Chips */}
      <div className="bg-card border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          A: Quick Questions
        </h3>

        <div className="space-y-2">
          <Label>Warum ist die Stelle frei? *</Label>
          <ChipSelect
            options={[
              { value: 'growth', label: 'Wachstum' },
              { value: 'succession', label: 'Nachfolge' },
              { value: 'new_position', label: 'Neues Team' },
              { value: 'restructuring', label: 'Umstrukturierung' },
              { value: 'other', label: 'Sonstiges' },
            ]}
            value={formData.vacancy_reason}
            onChange={(v) => updateField('vacancy_reason', v)}
          />
        </div>

        <div className="space-y-2">
          <Label>Dringlichkeit *</Label>
          <ChipSelect
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'urgent', label: 'Dringend' },
              { value: 'hot', label: 'Sofort' },
            ]}
            value={formData.hiring_urgency}
            onChange={(v) => updateField('hiring_urgency', v)}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Entscheider</Label>
            <ChipSelect
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3', label: '3+' },
              ]}
              value={formData.decision_makers_count !== null ? String(formData.decision_makers_count) : null}
              onChange={(v) => updateField('decision_makers_count', parseInt(v))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Pipeline</Label>
            <ChipSelect
              options={[
                { value: '0', label: '0' },
                { value: '3', label: '1-5' },
                { value: '10', label: '5+' },
              ]}
              value={formData.candidates_in_pipeline !== null ? String(formData.candidates_in_pipeline) : null}
              onChange={(v) => updateField('candidates_in_pipeline', parseInt(v))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Teamgröße</Label>
            <ChipSelect
              options={[
                { value: '3', label: '1-5' },
                { value: '10', label: '6-15' },
                { value: '20', label: '16-30' },
                { value: '50', label: '30+' },
              ]}
              value={formData.team_size !== null ? String(formData.team_size) : null}
              onChange={(v) => updateField('team_size', parseInt(v))}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Remote-Tage</Label>
            <ChipSelect
              options={[
                { value: '0', label: '0' },
                { value: '2', label: '1-2' },
                { value: '4', label: '3-4' },
                { value: '5', label: '5' },
              ]}
              value={formData.remote_days !== null ? String(formData.remote_days) : null}
              onChange={(v) => updateField('remote_days', parseInt(v))}
            />
          </div>
        </div>

        {/* Interview Process — Templates + Editable Steps */}
        <InterviewProcessEditor
          interviewStages={formData.interview_stages}
          interviewProcess={formData.interview_process}
          onUpdate={(stages, process) => {
            updateField('interview_stages', stages);
            updateField('interview_process', process);
          }}
        />
      </div>

      {/* Section B: Qualitäts-Vertiefung */}
      <div className="bg-card border rounded-lg p-5 space-y-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          B: Qualitäts-Vertiefung
        </h3>

        <div className="space-y-2">
          <Label>Erfolgsprofil: Was zeichnet den idealen Kandidaten aus?</Label>
          <Textarea
            value={formData.success_profile}
            onChange={(e) => updateField('success_profile', e.target.value)}
            placeholder="Beschreiben Sie den idealen Kandidaten — Persönlichkeit, Arbeitsweise, Erfahrungen..."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Scheiterprofil: Woran sind bisherige Besetzungen gescheitert?</Label>
          <Textarea
            value={formData.failure_profile}
            onChange={(e) => updateField('failure_profile', e.target.value)}
            placeholder="Was sollte der Kandidat NICHT mitbringen? Welche Fehler sollten vermieden werden?"
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label>Trainierbare Skills (was kann erlernt werden)</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {formData.trainable_skills.map((skill) => (
              <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                {skill}
                <button
                  onClick={() => updateField('trainable_skills', formData.trainable_skills.filter(s => s !== skill))}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <Input
            value={trainableInput}
            onChange={(e) => setTrainableInput(e.target.value)}
            placeholder="Trainierbaren Skill hinzufügen..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (trainableInput.trim()) {
                  updateField('trainable_skills', [...formData.trainable_skills, trainableInput.trim()]);
                  setTrainableInput('');
                }
              }
            }}
          />
        </div>

        <div className="space-y-2">
          <Label>Unternehmenskultur</Label>
          <Textarea
            value={formData.company_culture}
            onChange={(e) => updateField('company_culture', e.target.value)}
            placeholder="Wie würden Sie die Unternehmenskultur beschreiben?"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label>Karrierepfad</Label>
          <Input
            value={formData.career_path}
            onChange={(e) => updateField('career_path', e.target.value)}
            placeholder="z.B. Senior → Team Lead → Engineering Manager"
          />
        </div>
      </div>

      {/* Section C: Smart Intake Briefing */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          C: Smart Intake Briefing
        </h3>
        <IntakeBriefingSection
          onDataExtracted={(data, completeness) => applyIntakeData(data, completeness)}
          existingData={{
            vacancy_reason: formData.vacancy_reason || undefined,
            hiring_urgency: formData.hiring_urgency as any || undefined,
            team_size: formData.team_size ?? undefined,
            company_culture: formData.company_culture || undefined,
            success_profile: formData.success_profile || undefined,
          }}
        />
      </div>
    </div>
  );
}

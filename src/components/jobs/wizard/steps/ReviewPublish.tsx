import { useWizardContext } from '../JobWizard';
import { WIZARD_STEPS, WizardStep } from '@/hooks/useJobWizard';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Coins,
  Building2,
  Briefcase,
  Loader2,
  Save,
  Send,
  ArrowRight,
  ShieldAlert,
  Users,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn(
          'font-medium',
          value >= 80 ? 'text-green-400' :
          value >= 50 ? 'text-yellow-400' : 'text-red-400'
        )}>
          {value}%
        </span>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

function ComplianceChecks({ formData }: { formData: any }) {
  const checks: { label: string; status: 'ok' | 'warn' | 'error'; message: string }[] = [];

  if (formData.engagement_model === 'temp_staffing') {
    // AÜG duration check
    const duration = parseInt(formData.assignment_duration);
    if (duration && duration > 18) {
      checks.push({ label: 'AÜG-Dauer', status: 'error', message: 'Überlassungsdauer >18 Monate nicht AÜG-konform' });
    } else if (duration && duration > 15) {
      checks.push({ label: 'AÜG-Dauer', status: 'warn', message: 'Nähert sich der 18-Monats-Grenze' });
    } else {
      checks.push({ label: 'AÜG-Dauer', status: 'ok', message: 'Überlassungsdauer im Rahmen' });
    }

    // Equal Pay
    if (formData.equal_pay_applicable === null) {
      checks.push({ label: 'Equal Pay', status: 'warn', message: 'Equal Pay Status nicht angegeben' });
    } else {
      checks.push({ label: 'Equal Pay', status: 'ok', message: formData.equal_pay_applicable ? 'Equal Pay berücksichtigt' : 'Equal Pay nicht anwendbar' });
    }

    // Works council
    if (!formData.works_council_status) {
      checks.push({ label: 'Betriebsrat', status: 'warn', message: 'Betriebsrat-Status nicht angegeben' });
    } else {
      checks.push({ label: 'Betriebsrat', status: 'ok', message: 'Betriebsrat-Status erfasst' });
    }
  }

  if (formData.engagement_model === 'freelance') {
    // Scheinselbständigkeit warning
    const duration = parseInt(formData.project_duration);
    const isOnsite = formData.remote_policy === 'onsite';
    if (duration && duration > 12 && isOnsite) {
      checks.push({ label: 'Scheinselbständigkeit', status: 'warn', message: 'Laufzeit >12 Monate + Onsite: Prüfen Sie Scheinselbständigkeits-Risiko' });
    }
  }

  if (formData.engagement_model === 'permanent') {
    if (formData.contract_type === 'befristet' && !formData.vacancy_reason) {
      checks.push({ label: 'Befristungsgrund', status: 'warn', message: 'Befristeter Vertrag ohne Vakanz-Grund angegeben' });
    }
  }

  if (checks.length === 0) return null;

  return (
    <div className="bg-card border rounded-lg p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
        <ShieldAlert className="h-4 w-4" />
        Compliance-Prüfung
      </h3>
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-2 text-sm">
          {check.status === 'ok' && <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />}
          {check.status === 'warn' && <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />}
          {check.status === 'error' && <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
          <span className="text-muted-foreground">{check.label}:</span>
          <span className={cn(
            check.status === 'ok' ? 'text-green-400' :
            check.status === 'warn' ? 'text-yellow-400' : 'text-red-400'
          )}>
            {check.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function MatchingSimulation({ formData, scores }: { formData: any; scores: any }) {
  // Simple simulation based on how restrictive the requirements are
  let matchability = 100;

  // More must-haves = fewer matches
  if (formData.must_haves.length > 5) matchability -= 20;
  else if (formData.must_haves.length > 3) matchability -= 10;

  // Narrow salary range = fewer matches
  if (formData.salary_min && formData.salary_max) {
    const range = formData.salary_max - formData.salary_min;
    const mid = (formData.salary_min + formData.salary_max) / 2;
    if (range / mid < 0.15) matchability -= 15;
  }

  // Onsite-only = fewer matches
  if (formData.remote_policy === 'onsite') matchability -= 15;

  // Industry experience required = fewer matches
  if (formData.industry_experience_required) matchability -= 10;

  // More exclusion criteria = fewer matches
  matchability -= formData.exclusion_criteria.length * 5;

  // High experience = smaller pool
  if (formData.experience_years_min && formData.experience_years_min > 8) matchability -= 10;

  matchability = Math.max(20, Math.min(95, matchability));

  return (
    <div className="bg-card border rounded-lg p-5 space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground uppercase tracking-wider">
        <Target className="h-4 w-4" />
        Matching-Prognose
      </h3>
      <div className="flex items-center gap-3">
        <Progress value={matchability} className="h-3 flex-1" />
        <span className={cn(
          'text-lg font-bold',
          matchability >= 70 ? 'text-green-400' :
          matchability >= 40 ? 'text-yellow-400' : 'text-red-400'
        )}>
          ~{matchability}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {matchability >= 70
          ? 'Gute Matching-Chancen — Ihr Profil erreicht einen breiten Kandidatenpool'
          : matchability >= 40
            ? 'Mittlere Matching-Chancen — erwägen Sie, Anforderungen flexibler zu gestalten'
            : 'Eingeschränkte Matching-Chancen — sehr spezifische Anforderungen reduzieren den Kandidatenpool'}
      </p>
    </div>
  );
}

export function ReviewPublish() {
  const {
    formData,
    scores,
    goToStep,
    saveDraft,
    submitForReview,
    saving,
    submitting,
    getStepValidation,
  } = useWizardContext();

  // Find missing fields
  const missingFields: { label: string; step: WizardStep }[] = [];
  if (!formData.title) missingFields.push({ label: 'Jobtitel', step: 2 });
  if (!formData.company_name) missingFields.push({ label: 'Unternehmen', step: 2 });
  if (!formData.location) missingFields.push({ label: 'Standort', step: 2 });
  if (formData.salary_min === null && formData.rate_min === null) {
    missingFields.push({ label: 'Gehalt / Satz', step: 3 });
  }
  if (formData.must_haves.length === 0) missingFields.push({ label: 'Must-Have Skills', step: 4 });
  if (!formData.vacancy_reason) missingFields.push({ label: 'Vakanz-Grund', step: 5 });

  const trackLabel = formData.engagement_model === 'permanent' ? 'Festanstellung' :
    formData.engagement_model === 'freelance' ? 'Freelancer' : 'ANÜ';

  const compensationText = formData.engagement_model === 'permanent'
    ? formData.salary_min && formData.salary_max
      ? `${formData.salary_min.toLocaleString('de-DE')}–${formData.salary_max.toLocaleString('de-DE')} €`
      : 'Nicht angegeben'
    : formData.rate_min && formData.rate_max
      ? `${formData.rate_min}–${formData.rate_max} €/h`
      : 'Nicht angegeben';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">Review & Veröffentlichen</h2>
        <p className="text-sm text-muted-foreground">
          Überprüfen Sie Ihre Eingaben und reichen Sie den Job ein
        </p>
      </div>

      {/* Quality Scores */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Qualitäts-Scores
        </h3>
        <ScoreBar label="Profilvollständigkeit" value={scores.profileCompleteness} />
        <ScoreBar label="Matching-Readiness" value={scores.matchingReadiness} />
        <ScoreBar label="Recruiter-Actionability" value={scores.recruiterActionability} />
      </div>

      {/* Matching Simulation */}
      <MatchingSimulation formData={formData} scores={scores} />

      {/* Compliance Checks */}
      <ComplianceChecks formData={formData} />

      {/* Missing Fields */}
      {missingFields.length > 0 && (
        <div className="bg-card border border-yellow-500/20 rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Fehlende Felder ({missingFields.length})
          </h3>
          {missingFields.map((field) => (
            <div key={field.label} className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{field.label}</span>
              <button
                onClick={() => goToStep(field.step)}
                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
              >
                Jetzt ausfüllen <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Recruiter Preview */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recruiter-Vorschau
        </h3>

        <div className="space-y-3">
          <div>
            <h4 className="text-lg font-bold">{formData.title || 'Kein Titel'}</h4>
            <p className="text-muted-foreground">{formData.company_name || 'Kein Unternehmen'}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {formData.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {formData.location}
                {formData.remote_policy && ` (${formData.remote_policy === 'hybrid' ? `Hybrid, ${formData.onsite_days_required} Tage` : formData.remote_policy})`}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" />
              {compensationText}
            </span>
            <span className="flex items-center gap-1">
              <Briefcase className="h-3.5 w-3.5" />
              {trackLabel}
              {formData.employment_type && formData.engagement_model === 'permanent' &&
                `, ${formData.contract_type === 'unbefristet' ? 'Unbefristet' : 'Befristet'}`}
            </span>
          </div>

          {formData.must_haves.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Must-Haves:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {formData.must_haves.map((skill: string) => (
                  <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {formData.nice_to_haves.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Nice-to-Haves:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {formData.nice_to_haves.map((skill: string) => (
                  <Badge key={skill} variant="secondary" className="text-xs">{skill}</Badge>
                ))}
              </div>
            </div>
          )}

          {formData.required_languages.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Sprachen:</span>
              <span className="text-sm ml-1.5">
                {formData.required_languages.map((l: any) => `${l.language} (${l.level})`).join(', ')}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
            {formData.hiring_urgency && (
              <span>Dringlichkeit: {formData.hiring_urgency}</span>
            )}
            {formData.decision_makers_count !== null && (
              <span>Entscheider: {formData.decision_makers_count}</span>
            )}
            {formData.team_size !== null && (
              <span>Team: {formData.team_size} Personen</span>
            )}
            {formData.interview_stages !== null && (
              <span>Interview: {formData.interview_stages} Runden</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-4 pt-4">
        <Button
          variant="outline"
          onClick={saveDraft}
          disabled={saving}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Als Entwurf speichern
        </Button>

        <Button
          onClick={() => submitForReview(true)}
          disabled={submitting || missingFields.some(f => f.label === 'Jobtitel' || f.label === 'Unternehmen')}
          className="gap-1.5"
          size="lg"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Zur Freigabe einreichen
        </Button>
      </div>
    </div>
  );
}

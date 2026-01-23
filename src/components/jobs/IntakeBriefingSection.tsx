import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Sparkles, Loader2, CheckCircle, Lightbulb } from 'lucide-react';
import { useIntakeBriefing, ExtractedIntakeData, IntakeExtractionResult } from '@/hooks/useIntakeBriefing';
import { cn } from '@/lib/utils';

interface IntakeBriefingSectionProps {
  onDataExtracted: (data: ExtractedIntakeData, completeness: number) => void;
  existingData?: Partial<ExtractedIntakeData>;
  className?: string;
}

const EXAMPLE_PROMPTS = [
  "Team-Größe, Altersstruktur, Kernarbeitszeit",
  "Unternehmenskultur, Karrierepfade",
  "Must-Haves, Nice-to-Haves, Timeline",
  "Remote-Policy, Überstunden-Regelung"
];

export function IntakeBriefingSection({ 
  onDataExtracted, 
  existingData,
  className 
}: IntakeBriefingSectionProps) {
  const [briefingText, setBriefingText] = useState('');
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const { analyzeBriefing, analyzing, lastResult } = useIntakeBriefing();

  const handleAnalyze = async () => {
    const result = await analyzeBriefing(briefingText, existingData);
    if (result) {
      setHasAnalyzed(true);
      onDataExtracted(result.extracted_data, result.completeness);
    }
  };

  return (
    <Card className={cn(
      'border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background',
      className
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-primary" />
          Smart Briefing
          {hasAnalyzed && lastResult && (
            <span className="ml-auto flex items-center gap-1 text-sm font-normal text-emerald-600">
              <CheckCircle className="h-4 w-4" />
              {lastResult.fields_found} Felder erkannt
            </span>
          )}
        </CardTitle>
        <CardDescription>
          Erzählen Sie uns alles über die Stelle – die KI extrahiert automatisch alle relevanten Details
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Textarea
          placeholder="Beschreiben Sie die Stelle, das Team, die Anforderungen und was sie besonders macht...

Beispiel: Wir suchen für unser 12-köpfiges Entwicklerteam in München einen Senior React Developer. Das Team ist zwischen 28-40 Jahre alt, Kernarbeitszeit 10-16 Uhr, 2 Tage Home Office möglich. Budget 75-90k plus Bonus..."
          value={briefingText}
          onChange={(e) => setBriefingText(e.target.value)}
          className="min-h-[140px] resize-y"
          disabled={analyzing}
        />

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            Erwähnen Sie:
          </span>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <span
              key={prompt}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {prompt}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || briefingText.trim().length < 20}
            className="gap-2"
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysiere...
              </>
            ) : hasAnalyzed ? (
              <>
                <Sparkles className="h-4 w-4" />
                Erneut analysieren
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Analysieren & Ausfüllen
              </>
            )}
          </Button>

          {briefingText.length > 0 && briefingText.length < 20 && (
            <span className="text-xs text-muted-foreground">
              Noch {20 - briefingText.length} Zeichen...
            </span>
          )}
        </div>

        {/* Show what was extracted */}
        {hasAnalyzed && lastResult && lastResult.fields_found > 0 && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <p className="font-medium text-emerald-800 mb-1">
              ✓ Automatisch erkannt:
            </p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(lastResult.extracted_data)
                .filter(([_, value]) => {
                  if (Array.isArray(value)) return value.length > 0;
                  return value !== undefined && value !== null && value !== '';
                })
                .map(([key]) => (
                  <span
                    key={key}
                    className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                  >
                    {formatFieldName(key)}
                  </span>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatFieldName(key: string): string {
  const labels: Record<string, string> = {
    team_size: 'Team-Größe',
    team_avg_age: 'Altersstruktur',
    core_hours: 'Kernarbeitszeit',
    company_culture: 'Kultur',
    career_path: 'Karrierepfad',
    vacancy_reason: 'Vakanzgrund',
    hiring_urgency: 'Dringlichkeit',
    must_have_criteria: 'Must-Haves',
    nice_to_have_criteria: 'Nice-to-Haves',
    decision_makers: 'Entscheider',
    remote_days: 'Remote-Tage',
    salary_min: 'Gehalt Min',
    salary_max: 'Gehalt Max',
    daily_routine: 'Arbeitsalltag',
    reports_to: 'Berichtet an',
    works_council: 'Betriebsrat',
    bonus_structure: 'Bonus',
    trainable_skills: 'Nachschulbar',
    success_profile: 'Erfolgsprofil',
    failure_profile: 'Passt nicht',
    unique_selling_points: 'USPs',
    position_advantages: 'Positionsvorteile'
  };
  return labels[key] || key.replace(/_/g, ' ');
}

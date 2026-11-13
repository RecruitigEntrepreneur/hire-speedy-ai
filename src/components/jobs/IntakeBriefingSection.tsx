import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Sparkles, Loader2, CheckCircle, Lightbulb } from 'lucide-react';
import { useIntakeBriefing, ExtractedIntakeData, IntakeExtractionResult } from '@/hooks/useIntakeBriefing';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface IntakeBriefingSectionProps {
  onDataExtracted: (data: ExtractedIntakeData, completeness: number) => void;
  existingData?: Partial<ExtractedIntakeData>;
  className?: string;
}

// Schlüssel des Namespace recruiterJobEdit
const EXAMPLE_PROMPTS = [
  'smart.prompts.p1',
  'smart.prompts.p2',
  'smart.prompts.p3',
  'smart.prompts.p4'
];

export function IntakeBriefingSection({ 
  onDataExtracted, 
  existingData,
  className 
}: IntakeBriefingSectionProps) {
  const { t } = useTranslation('recruiterJobEdit');
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
              {t('smart.fieldsFound', { count: lastResult.fields_found })}
            </span>
          )}
        </CardTitle>
        <CardDescription>
          {t('smart.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Textarea
          placeholder={t('smart.placeholder')}
          value={briefingText}
          onChange={(e) => setBriefingText(e.target.value)}
          className="min-h-[140px] resize-y"
          disabled={analyzing}
        />

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" />
            {t('smart.mention')}
          </span>
          {EXAMPLE_PROMPTS.map((prompt) => (
            <span
              key={prompt}
              className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
            >
              {t(prompt)}
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
                {t('smart.analyzing')}
              </>
            ) : hasAnalyzed ? (
              <>
                <Sparkles className="h-4 w-4" />
                {t('smart.analyzeAgain')}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {t('smart.analyze')}
              </>
            )}
          </Button>

          {briefingText.length > 0 && briefingText.length < 20 && (
            <span className="text-xs text-muted-foreground">
              {t('smart.charsLeft', { count: 20 - briefingText.length })}
            </span>
          )}
        </div>

        {/* Show what was extracted */}
        {hasAnalyzed && lastResult && lastResult.fields_found > 0 && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
            <p className="font-medium text-emerald-800 mb-1">
              {t('smart.detected')}
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
                    {formatFieldName(key, t)}
                  </span>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const FIELD_KEYS = ['team_size', 'core_hours', 'company_culture', 'career_path', 'vacancy_reason', 'hiring_urgency', 'must_have_criteria', 'nice_to_have_criteria', 'decision_makers', 'remote_days', 'salary_min', 'salary_max', 'daily_routine', 'reports_to', 'works_council', 'bonus_structure', 'trainable_skills', 'success_profile', 'failure_profile', 'unique_selling_points', 'position_advantages'];

function formatFieldName(key: string, t: (k: string) => string): string {
  return FIELD_KEYS.includes(key) ? t(`smart.field.${key}`) : key.replace(/_/g, ' ');
}

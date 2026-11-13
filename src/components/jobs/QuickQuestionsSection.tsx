import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface QuickQuestion {
  field: string;
  question: string;
  type: 'radio' | 'input' | 'number';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface QuickQuestionsSectionProps {
  missingFields: string[];
  currentValues: Record<string, unknown>;
  onValueChange: (field: string, value: unknown) => void;
  className?: string;
}

// question, label und placeholder tragen Schlüssel des Namespace recruiterJobEdit; die Werte (value) bleiben wie gespeichert.
const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    field: 'vacancy_reason',
    question: 'quick.vacancy_reason.question',
    type: 'radio',
    options: [
      { value: 'growth', label: 'quick.vacancy_reason.growth' },
      { value: 'succession', label: 'quick.vacancy_reason.succession' },
      { value: 'new_position', label: 'quick.vacancy_reason.new_position' },
      { value: 'restructuring', label: 'quick.vacancy_reason.restructuring' }
    ]
  },
  {
    field: 'hiring_urgency',
    question: 'quick.hiring_urgency.question',
    type: 'radio',
    options: [
      { value: 'standard', label: 'quick.hiring_urgency.standard' },
      { value: 'urgent', label: 'quick.hiring_urgency.urgent' },
      { value: 'hot', label: 'quick.hiring_urgency.hot' }
    ]
  },
  {
    field: 'decision_makers_count',
    question: 'quick.decision_makers_count.question',
    type: 'radio',
    options: [
      { value: '1', label: 'quick.decision_makers_count.one' },
      { value: '2', label: 'quick.decision_makers_count.two' },
      { value: '3+', label: 'quick.decision_makers_count.three' }
    ]
  },
  {
    field: 'candidates_in_pipeline',
    question: 'quick.candidates_in_pipeline.question',
    type: 'radio',
    options: [
      { value: '0', label: 'quick.candidates_in_pipeline.none' },
      { value: '1-3', label: '1-3' },
      { value: '4+', label: 'quick.candidates_in_pipeline.fourPlus' }
    ]
  },
  {
    field: 'team_size',
    question: 'quick.team_size.question',
    type: 'number',
    placeholder: 'quick.team_size.placeholder'
  },
  {
    field: 'remote_days',
    question: 'quick.remote_days.question',
    type: 'radio',
    options: [
      { value: '0', label: 'quick.remote_days.none' },
      { value: '1-2', label: 'quick.remote_days.oneTwo' },
      { value: '3-4', label: 'quick.remote_days.threeFour' },
      { value: '5', label: 'quick.remote_days.full' }
    ]
  }
];

export function QuickQuestionsSection({
  missingFields,
  currentValues,
  onValueChange,
  className
}: QuickQuestionsSectionProps) {
  const { t } = useTranslation('recruiterJobEdit');
  const relevantQuestions = QUICK_QUESTIONS.filter(q => 
    missingFields.includes(q.field)
  );

  if (relevantQuestions.length === 0) {
    return null;
  }

  const answeredCount = relevantQuestions.filter(q => {
    const value = currentValues[q.field];
    return value !== undefined && value !== null && value !== '';
  }).length;

  return (
    <Card className={cn('border-amber-500/30 bg-amber-50/50', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-amber-600" />
          Quick Questions
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {t('quick.answered', { done: answeredCount, total: relevantQuestions.length })}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {relevantQuestions.map((question) => {
          const currentValue = currentValues[question.field];
          const isAnswered = currentValue !== undefined && currentValue !== null && currentValue !== '';

          return (
            <div 
              key={question.field}
              className={cn(
                'p-3 rounded-lg border transition-colors',
                isAnswered 
                  ? 'bg-emerald-50/50 border-emerald-200' 
                  : 'bg-white border-border'
              )}
            >
              <div className="flex items-start gap-2 mb-2">
                {isAnswered ? (
                  <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                )}
                <Label className="text-sm font-medium">{t(question.question)}</Label>
              </div>

              {question.type === 'radio' && question.options && (
                <RadioGroup
                  value={String(currentValue || '')}
                  onValueChange={(value) => onValueChange(question.field, value)}
                  className="flex flex-wrap gap-2 ml-6"
                >
                  {question.options.map((option) => (
                    <div key={option.value} className="flex items-center">
                      <RadioGroupItem
                        value={option.value}
                        id={`${question.field}-${option.value}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`${question.field}-${option.value}`}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors',
                          'border hover:bg-primary/5',
                          currentValue === option.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border'
                        )}
                      >
                        {/^quick\./.test(option.label) ? t(option.label) : option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.type === 'number' && (
                <Input
                  type="number"
                  placeholder={question.placeholder ? t(question.placeholder) : undefined}
                  value={currentValue as number || ''}
                  onChange={(e) => onValueChange(question.field, parseInt(e.target.value) || '')}
                  className="ml-6 w-24"
                />
              )}

              {question.type === 'input' && (
                <Input
                  placeholder={question.placeholder ? t(question.placeholder) : undefined}
                  value={currentValue as string || ''}
                  onChange={(e) => onValueChange(question.field, e.target.value)}
                  className="ml-6"
                />
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

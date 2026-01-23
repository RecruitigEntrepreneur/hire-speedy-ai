import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Zap, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const QUICK_QUESTIONS: QuickQuestion[] = [
  {
    field: 'vacancy_reason',
    question: 'Warum ist die Stelle vakant?',
    type: 'radio',
    options: [
      { value: 'growth', label: 'Wachstum' },
      { value: 'succession', label: 'Nachfolge' },
      { value: 'new_position', label: 'Neu geschaffen' },
      { value: 'restructuring', label: 'Umstrukturierung' }
    ]
  },
  {
    field: 'hiring_urgency',
    question: 'Wie dringend ist die Besetzung?',
    type: 'radio',
    options: [
      { value: 'standard', label: 'Standard (8+ Wochen)' },
      { value: 'urgent', label: 'Dringend (4-8 Wochen)' },
      { value: 'hot', label: 'Sehr dringend (<4 Wochen)' }
    ]
  },
  {
    field: 'decision_makers_count',
    question: 'Wie viele Personen entscheiden final?',
    type: 'radio',
    options: [
      { value: '1', label: 'Nur ich' },
      { value: '2', label: 'HR + Fachbereich' },
      { value: '3+', label: 'Geschäftsführung + Team' }
    ]
  },
  {
    field: 'candidates_in_pipeline',
    question: 'Kandidaten aktuell im Prozess?',
    type: 'radio',
    options: [
      { value: '0', label: 'Keine' },
      { value: '1-3', label: '1-3' },
      { value: '4+', label: '4 oder mehr' }
    ]
  },
  {
    field: 'team_size',
    question: 'Größe des direkten Teams?',
    type: 'number',
    placeholder: 'z.B. 8'
  },
  {
    field: 'remote_days',
    question: 'Home Office Tage pro Woche?',
    type: 'radio',
    options: [
      { value: '0', label: 'Kein HO' },
      { value: '1-2', label: '1-2 Tage' },
      { value: '3-4', label: '3-4 Tage' },
      { value: '5', label: 'Full Remote' }
    ]
  }
];

export function QuickQuestionsSection({
  missingFields,
  currentValues,
  onValueChange,
  className
}: QuickQuestionsSectionProps) {
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
            {answeredCount}/{relevantQuestions.length} beantwortet
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
                <Label className="text-sm font-medium">{question.question}</Label>
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
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {question.type === 'number' && (
                <Input
                  type="number"
                  placeholder={question.placeholder}
                  value={currentValue as number || ''}
                  onChange={(e) => onValueChange(question.field, parseInt(e.target.value) || '')}
                  className="ml-6 w-24"
                />
              )}

              {question.type === 'input' && (
                <Input
                  placeholder={question.placeholder}
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

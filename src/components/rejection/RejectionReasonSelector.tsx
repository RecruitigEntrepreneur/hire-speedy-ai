import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';

// Gespeichert wird nur der Wert (reason_category); Bezeichnung und Erklärung werden beim
// Lesen in der Sprache der Oberfläche geholt (clientCandidates:rejection.reasons).
const category = (value: string) => ({
  value,
  get label(): string {
    return i18n.t(`clientCandidates:rejection.reasons.${value}`);
  },
  get description(): string {
    return i18n.t(`clientCandidates:rejection.reasons.${value}_desc`);
  },
});

const REJECTION_CATEGORIES = ['skills_mismatch', 'experience', 'culture_fit', 'salary', 'timing', 'other'].map(category);

interface RejectionReasonSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RejectionReasonSelector({ value, onChange }: RejectionReasonSelectorProps) {
  // Lädt den Namespace und zeichnet beim Sprachwechsel neu.
  useTranslation('clientCandidates');
  // Apple-Stil (22.11.2026, Vorschlag 1): ruhige Zeilen zum Ankreuzen statt sechs Kästen mit Erklärzeile.
  return (
    <RadioGroup value={value} onValueChange={onChange} className="gap-0 divide-y">
      {REJECTION_CATEGORIES.map((category) => (
        <div
          key={category.value}
          className="flex cursor-pointer items-center gap-2.5 py-2.5"
          onClick={() => onChange(category.value)}
        >
          <RadioGroupItem value={category.value} id={category.value} className={cn(value === category.value ? 'border-klick text-klick' : 'border-muted-foreground/50')} />
          <Label htmlFor={category.value} className={cn('cursor-pointer text-sm', value === category.value ? 'font-medium' : 'font-normal')}>
            {category.label}
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}

export { REJECTION_CATEGORIES };

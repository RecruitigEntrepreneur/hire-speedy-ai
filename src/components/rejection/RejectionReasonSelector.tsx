import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';

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
  return (
    <RadioGroup value={value} onValueChange={onChange} className="space-y-3">
      {REJECTION_CATEGORIES.map((category) => (
        <div
          key={category.value}
          className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => onChange(category.value)}
        >
          <RadioGroupItem value={category.value} id={category.value} className="mt-1" />
          <div className="flex-1">
            <Label htmlFor={category.value} className="font-medium cursor-pointer">
              {category.label}
            </Label>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

export { REJECTION_CATEGORIES };

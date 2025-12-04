import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const REJECTION_CATEGORIES = [
  {
    value: 'skills_mismatch',
    label: 'Fehlende Skills',
    description: 'Die technischen Fähigkeiten entsprechen nicht den Anforderungen'
  },
  {
    value: 'experience',
    label: 'Erfahrungslevel',
    description: 'Das Erfahrungsniveau passt nicht zur Position'
  },
  {
    value: 'culture_fit',
    label: 'Kulturelle Passung',
    description: 'Die Unternehmenskultur passt nicht zum Kandidaten'
  },
  {
    value: 'salary',
    label: 'Gehaltsvorstellung',
    description: 'Die Gehaltsvorstellung liegt außerhalb des Budgets'
  },
  {
    value: 'timing',
    label: 'Verfügbarkeit',
    description: 'Der Eintrittstermin passt nicht'
  },
  {
    value: 'other',
    label: 'Sonstiges',
    description: 'Anderer Grund'
  }
];

interface RejectionReasonSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RejectionReasonSelector({ value, onChange }: RejectionReasonSelectorProps) {
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

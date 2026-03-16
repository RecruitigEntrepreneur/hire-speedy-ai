import { useWizardContext } from '../JobWizard';
import { EngagementModel } from '@/hooks/useJobWizard';
import { cn } from '@/lib/utils';
import { Briefcase, Laptop, Factory, Check, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TRACKS: {
  id: EngagementModel;
  icon: typeof Briefcase;
  title: string;
  description: string;
  features: string[];
}[] = [
  {
    id: 'permanent',
    icon: Briefcase,
    title: 'Festanstellung',
    description: 'Unbefristete oder befristete Direktanstellung in Ihrem Unternehmen',
    features: ['Gehalt', 'Benefits', 'Probezeit', 'Karrierepfad'],
  },
  {
    id: 'freelance',
    icon: Laptop,
    title: 'Freelancer / Projektbasis',
    description: 'Externer Spezialist für ein definiertes Projekt oder eine zeitlich begrenzte Aufgabe',
    features: ['Tagessatz', 'Laufzeit', 'Deliverables', 'Remote'],
  },
  {
    id: 'temp_staffing',
    icon: Factory,
    title: 'Arbeitnehmerüberlassung (ANÜ)',
    description: 'Zeitarbeit mit AÜG-konformer Überlassung inkl. Compliance-Prüfung',
    features: ['Verrechnungssatz', 'Equal Pay', 'Übernahme', 'Compliance'],
  },
];

export function TrackSelection() {
  const { formData, updateField } = useWizardContext();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Neue Stelle anlegen</h1>
        <p className="text-muted-foreground">
          Welche Art von Mitarbeiter suchen Sie?
        </p>
      </div>

      {/* 3 Cards horizontal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TRACKS.map((track) => {
          const Icon = track.icon;
          const isSelected = formData.engagement_model === track.id;

          return (
            <button
              key={track.id}
              onClick={() => updateField('engagement_model', track.id)}
              className={cn(
                'relative flex flex-col items-center text-center p-6 rounded-xl border-2 transition-all duration-200',
                'hover:border-primary/50 hover:bg-primary/5',
                isSelected
                  ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              )}
            >
              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="h-4 w-4 text-primary-foreground" />
                </div>
              )}

              {/* Icon */}
              <div className={cn(
                'h-14 w-14 rounded-xl flex items-center justify-center mb-4 transition-colors',
                isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
              )}>
                <Icon className="h-7 w-7" />
              </div>

              {/* Title */}
              <h3 className="font-semibold text-base mb-2">{track.title}</h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                {track.description}
              </p>

              {/* Feature tags */}
              <div className="flex flex-wrap gap-1.5 justify-center">
                {track.features.map((feature) => (
                  <span
                    key={feature}
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isSelected
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Headcount */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-muted-foreground">
          Anzahl Positionen:
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateField('headcount', Math.max(1, formData.headcount - 1))}
            disabled={formData.headcount <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <Input
            type="number"
            value={formData.headcount}
            onChange={(e) => updateField('headcount', Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center h-8"
            min={1}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateField('headcount', formData.headcount + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

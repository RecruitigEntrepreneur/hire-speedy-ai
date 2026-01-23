import { 
  Train, 
  Clock, 
  Dumbbell, 
  Building2, 
  Euro, 
  Heart, 
  Coffee, 
  Laptop, 
  Car, 
  Gift, 
  Umbrella, 
  BookOpen,
  LucideIcon
} from 'lucide-react';

interface Benefit {
  icon: string;
  text: string;
}

interface ExtractedBenefitsProps {
  benefits: Benefit[];
  maxItems?: number;
}

const iconMap: Record<string, LucideIcon> = {
  train: Train,
  clock: Clock,
  dumbbell: Dumbbell,
  building: Building2,
  euro: Euro,
  heart: Heart,
  coffee: Coffee,
  laptop: Laptop,
  car: Car,
  gift: Gift,
  umbrella: Umbrella,
  book: BookOpen,
};

export function ExtractedBenefits({ benefits, maxItems }: ExtractedBenefitsProps) {
  if (!benefits || benefits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Keine Benefits in der Beschreibung gefunden
      </p>
    );
  }

  const displayBenefits = maxItems ? benefits.slice(0, maxItems) : benefits;
  const remainingCount = maxItems ? Math.max(0, benefits.length - maxItems) : 0;

  return (
    <div className="space-y-2">
      {displayBenefits.map((benefit, index) => {
        const IconComponent = iconMap[benefit.icon] || Gift;
        
        return (
          <div 
            key={index} 
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
              <IconComponent className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-sm text-foreground pt-1">
              {benefit.text}
            </span>
          </div>
        );
      })}
      {remainingCount > 0 && (
        <p className="text-sm text-muted-foreground pl-11">
          +{remainingCount} weitere Benefits
        </p>
      )}
    </div>
  );
}

// Compact horizontal version
export function ExtractedBenefitsCompact({ benefits, maxItems = 4 }: ExtractedBenefitsProps) {
  if (!benefits || benefits.length === 0) return null;

  const displayBenefits = benefits.slice(0, maxItems);

  return (
    <div className="flex flex-wrap gap-2">
      {displayBenefits.map((benefit, index) => {
        const IconComponent = iconMap[benefit.icon] || Gift;
        
        return (
          <div 
            key={index} 
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-xs"
          >
            <IconComponent className="h-3 w-3 text-green-600 dark:text-green-400" />
            <span className="text-green-700 dark:text-green-300 font-medium truncate max-w-[150px]">
              {benefit.text}
            </span>
          </div>
        );
      })}
      {benefits.length > maxItems && (
        <span className="text-xs text-muted-foreground self-center">
          +{benefits.length - maxItems}
        </span>
      )}
    </div>
  );
}

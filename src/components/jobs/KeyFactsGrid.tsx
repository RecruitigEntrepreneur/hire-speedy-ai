import { 
  Euro, 
  Clock, 
  Briefcase, 
  MapPin, 
  Users, 
  Building2, 
  Globe, 
  Award, 
  Calendar,
  TrendingUp,
  LucideIcon
} from 'lucide-react';
import { Card } from '@/components/ui/card';

interface KeyFact {
  icon: string;
  label: string;
  value: string;
}

interface KeyFactsGridProps {
  facts: KeyFact[];
}

const iconMap: Record<string, LucideIcon> = {
  euro: Euro,
  clock: Clock,
  briefcase: Briefcase,
  mapPin: MapPin,
  users: Users,
  building: Building2,
  globe: Globe,
  award: Award,
  calendar: Calendar,
  trending: TrendingUp,
};

export function KeyFactsGrid({ facts }: KeyFactsGridProps) {
  if (!facts || facts.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
      {facts.map((fact, index) => {
        const IconComponent = iconMap[fact.icon] || Briefcase;
        
        return (
          <Card 
            key={index} 
            className="p-4 flex flex-col items-center text-center bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <IconComponent className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {fact.label}
            </span>
            <span className="text-sm font-semibold text-foreground mt-1 line-clamp-2">
              {fact.value}
            </span>
          </Card>
        );
      })}
    </div>
  );
}

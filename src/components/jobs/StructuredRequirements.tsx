import { 
  GraduationCap, 
  Clock, 
  Code, 
  Brain, 
  Award,
  LucideIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RequirementsStructured {
  education: string[];
  experience: string[];
  tools: string[];
  soft_skills: string[];
  certifications: string[];
}

interface StructuredRequirementsProps {
  requirements: RequirementsStructured;
  showLabels?: boolean;
}

interface CategoryConfig {
  key: keyof RequirementsStructured;
  label: string;
  icon: LucideIcon;
  colorClass: string;
  bgClass: string;
}

const categories: CategoryConfig[] = [
  { 
    key: 'education', 
    label: 'Ausbildung', 
    icon: GraduationCap, 
    colorClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800'
  },
  { 
    key: 'experience', 
    label: 'Erfahrung', 
    icon: Clock, 
    colorClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
  },
  { 
    key: 'tools', 
    label: 'Tools & Technologien', 
    icon: Code, 
    colorClass: 'text-emerald-700 dark:text-emerald-300',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800'
  },
  { 
    key: 'soft_skills', 
    label: 'Soft Skills', 
    icon: Brain, 
    colorClass: 'text-orange-700 dark:text-orange-300',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800'
  },
  { 
    key: 'certifications', 
    label: 'Zertifikate', 
    icon: Award, 
    colorClass: 'text-teal-700 dark:text-teal-300',
    bgClass: 'bg-teal-100 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800'
  },
];

export function StructuredRequirements({ requirements, showLabels = true }: StructuredRequirementsProps) {
  if (!requirements) return null;

  const hasAnyRequirements = categories.some(
    cat => requirements[cat.key] && requirements[cat.key].length > 0
  );

  if (!hasAnyRequirements) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Keine strukturierten Anforderungen verfügbar
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {categories.map(({ key, label, icon: Icon, colorClass, bgClass }) => {
        const items = requirements[key];
        if (!items || items.length === 0) return null;

        return (
          <div key={key} className="space-y-2">
            {showLabels && (
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${colorClass}`} />
                <span className={`text-sm font-medium ${colorClass}`}>
                  {label}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {items.map((item, index) => (
                <Badge 
                  key={index} 
                  variant="outline"
                  className={`${bgClass} border font-medium`}
                >
                  {!showLabels && <Icon className={`h-3 w-3 mr-1.5 ${colorClass}`} />}
                  {item}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compact version for inline display
export function StructuredRequirementsCompact({ requirements }: StructuredRequirementsProps) {
  if (!requirements) return null;

  const allItems = categories.flatMap(({ key, icon: Icon, colorClass, bgClass }) => {
    const items = requirements[key];
    if (!items || items.length === 0) return [];
    
    return items.map((item, index) => ({
      key: `${key}-${index}`,
      item,
      Icon,
      colorClass,
      bgClass
    }));
  });

  if (allItems.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {allItems.slice(0, 8).map(({ key, item, Icon, colorClass, bgClass }) => (
        <Badge 
          key={key} 
          variant="outline"
          className={`${bgClass} border font-medium`}
        >
          <Icon className={`h-3 w-3 mr-1.5 ${colorClass}`} />
          {item}
        </Badge>
      ))}
      {allItems.length > 8 && (
        <Badge variant="secondary" className="font-medium">
          +{allItems.length - 8} weitere
        </Badge>
      )}
    </div>
  );
}

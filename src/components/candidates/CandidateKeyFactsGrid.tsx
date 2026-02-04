import { cn } from '@/lib/utils';
import { 
  User, 
  MapPin, 
  Euro, 
  Clock, 
  Briefcase, 
  Home, 
  TrendingUp,
  Users 
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface CandidateKeyFactsGridProps {
  candidate: {
    job_title?: string | null;
    seniority?: string | null;
    experience_years?: number | null;
    city?: string | null;
    expected_salary?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
  };
}

interface KeyFactTile {
  icon: LucideIcon;
  label: string;
  value: string | null;
  fullValue?: string | null; // Full value for tooltip
  missing?: boolean;
  highlight?: 'green' | 'blue' | 'amber';
}

// Helper to truncate text with ellipsis
const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

const seniorityLabels: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead',
  director: 'Director',
  executive: 'Executive',
};

const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort',
  '2_weeks': '2 Wochen',
  '1_month': '1 Monat',
  '2_months': '2 Monate',
  '3_months': '3 Monate',
  '6_months': '6 Monate',
};

const remoteLabels: Record<string, string> = {
  remote: 'Full Remote',
  hybrid: 'Hybrid',
  onsite: 'Vor Ort',
};

export function CandidateKeyFactsGrid({ candidate }: CandidateKeyFactsGridProps) {
  // Format salary range
  const formatSalary = (value: number | null | undefined) => {
    if (!value) return null;
    return `${Math.round(value / 1000)}k€`;
  };

  const salaryRange = candidate.salary_expectation_min && candidate.salary_expectation_max
    ? `${formatSalary(candidate.salary_expectation_min)} - ${formatSalary(candidate.salary_expectation_max)}`
    : candidate.expected_salary
      ? formatSalary(candidate.expected_salary)
      : null;

  // Format availability
  const getAvailabilityText = () => {
    if (candidate.availability_date) {
      const date = new Date(candidate.availability_date);
      if (date <= new Date()) return 'Sofort';
      return `Ab ${format(date, 'MMM yyyy', { locale: de })}`;
    }
    if (candidate.notice_period) {
      return noticePeriodLabels[candidate.notice_period] || candidate.notice_period;
    }
    return null;
  };

  // Format remote preference
  const getRemoteText = () => {
    if (candidate.remote_preference) {
      return remoteLabels[candidate.remote_preference] || candidate.remote_preference;
    }
    if (candidate.remote_possible) {
      return 'Remote möglich';
    }
    return null;
  };

  const tiles: KeyFactTile[] = [
    { 
      icon: User, 
      label: 'Rolle', 
      value: candidate.job_title ? truncateText(candidate.job_title, 25) : null,
      fullValue: candidate.job_title, // Full value for tooltip
      missing: !candidate.job_title 
    },
    { 
      icon: Briefcase, 
      label: 'Erfahrung', 
      value: candidate.experience_years ? `${candidate.experience_years} Jahre` : null,
      missing: !candidate.experience_years 
    },
    { 
      icon: TrendingUp, 
      label: 'Seniority', 
      value: candidate.seniority ? seniorityLabels[candidate.seniority] || candidate.seniority : null,
      missing: !candidate.seniority 
    },
    { 
      icon: MapPin, 
      label: 'Standort', 
      value: candidate.city || null,
      missing: !candidate.city 
    },
    { 
      icon: Euro, 
      label: 'Gehalt', 
      value: salaryRange, 
      highlight: salaryRange ? 'green' : undefined,
      missing: !salaryRange 
    },
    { 
      icon: Clock, 
      label: 'Verfügbar', 
      value: getAvailabilityText(), 
      missing: !getAvailabilityText() 
    },
    { 
      icon: Home, 
      label: 'Remote', 
      value: getRemoteText(), 
      highlight: getRemoteText() ? 'blue' : undefined,
      missing: !getRemoteText() 
    },
    { 
      icon: Users, 
      label: 'Führung', 
      value: null, // TODO: Add leadership data from CV parsing
      missing: true 
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
      {tiles.map((tile, i) => {
        const IconComponent = tile.icon;
        return (
          <div
            key={i}
            className={cn(
              "p-3 rounded-lg border text-center transition-colors",
              tile.missing && "border-dashed border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10",
              tile.highlight === 'green' && !tile.missing && "bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
              tile.highlight === 'blue' && !tile.missing && "bg-blue-50/50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
              !tile.missing && !tile.highlight && "bg-card"
            )}
          >
            <IconComponent className={cn(
              "h-5 w-5 mx-auto mb-1",
              tile.missing ? "text-amber-500" : "text-primary"
            )} />
            <p className="text-xs text-muted-foreground">{tile.label}</p>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className={cn(
                    "text-sm font-medium mt-0.5 line-clamp-2",
                    tile.missing && "text-amber-600 dark:text-amber-400"
                  )}>
                    {tile.value || 'Fehlt'}
                  </p>
                </TooltipTrigger>
                {tile.fullValue && tile.fullValue !== tile.value && (
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="text-sm">{tile.fullValue}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        );
      })}
    </div>
  );
}

import { cn } from '@/lib/utils';
import { 
  Euro, 
  Clock, 
  Home, 
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { LucideIcon } from 'lucide-react';

interface CandidateKeyFactsGridProps {
  candidate: {
    job_title?: string | null;
    seniority?: string | null;
    experience_years?: number | null;
    city?: string | null;
    expected_salary?: number | null;
    current_salary?: number | null;
    salary_fix?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
  };
}

interface KeyFact {
  icon: LucideIcon;
  label: string;
  value: string | null;
  highlight?: 'green' | 'blue';
}

const seniorityLabels: Record<string, string> = {
  junior: 'Junior', mid: 'Mid-Level', senior: 'Senior',
  lead: 'Lead', director: 'Director', executive: 'Executive',
};

const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort', '2_weeks': '2 Wochen', '1_month': '1 Monat', '6_weeks': '6 Wochen',
  '2_months': '2 Monate', '3_months': '3 Monate', '3_months_eoq': '3 Monate zum Quartalsende', '6_months': '6 Monate',
};

const remoteLabels: Record<string, string> = {
  remote: 'Remote', hybrid: 'Hybrid', onsite: 'Vor Ort', flexible: 'Flexibel',
};

export function CandidateKeyFactsGrid({ candidate }: CandidateKeyFactsGridProps) {
  const formatSalary = (value: number | null | undefined) => {
    if (!value) return null;
    return `${Math.round(value / 1000)}k€`;
  };

  // Gleiche Quelle wie die Kandidatenakte: aktuell → Wunsch (Wunsch = expected_salary, alt salary_fix)
  const wish = candidate.expected_salary ?? candidate.salary_fix ?? null;
  const salaryRange = wish
    ? candidate.current_salary && candidate.current_salary !== wish
      ? `${formatSalary(candidate.current_salary)} → ${formatSalary(wish)}`
      : formatSalary(wish)
    : candidate.salary_expectation_min && candidate.salary_expectation_max
      ? `${formatSalary(candidate.salary_expectation_min)} – ${formatSalary(candidate.salary_expectation_max)}`
      : null;

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

  const getRemoteText = () => {
    if (candidate.remote_preference) return remoteLabels[candidate.remote_preference] || candidate.remote_preference;
    if (candidate.remote_possible) return 'Remote möglich';
    return null;
  };

  const facts: KeyFact[] = [
    { icon: TrendingUp, label: 'Seniority', value: candidate.seniority ? seniorityLabels[candidate.seniority] || candidate.seniority : null },
    { icon: Euro, label: 'Gehalt', value: salaryRange, highlight: salaryRange ? 'green' : undefined },
    { icon: Clock, label: 'Verfügbar', value: getAvailabilityText() },
    { icon: Home, label: 'Arbeitsmodell', value: getRemoteText(), highlight: getRemoteText() ? 'blue' : undefined },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      {facts.map((fact, i) => {
        const Icon = fact.icon;
        const missing = !fact.value;
        return (
          <span key={i} className="flex items-center gap-x-1">
            {i > 0 && <span className="text-border mx-1.5">·</span>}
            <Icon className={cn("h-3.5 w-3.5 shrink-0", missing ? "text-muted-foreground/50" : "text-muted-foreground")} />
            <span className="text-muted-foreground">{fact.label}:</span>
            <span className={cn(
              "font-medium",
              missing && "text-muted-foreground/50",
              !missing && fact.highlight === 'green' && "text-green-600 dark:text-green-400",
              !missing && fact.highlight === 'blue' && "text-blue-600 dark:text-blue-400",
              !missing && !fact.highlight && "text-foreground",
            )}>
              {fact.value || '–'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

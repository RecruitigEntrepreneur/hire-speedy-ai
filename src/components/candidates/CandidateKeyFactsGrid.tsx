import { cn } from '@/lib/utils';
import { 
  Euro, 
  Clock, 
  Home, 
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { dateFnsLocale } from '@/lib/candidateDateLocale';
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

// Beschriftung: candidateDetail:facts.seniority.<wert>, facts.notice.<wert>, facts.remote.<wert>
const SENIORITY = ['junior', 'mid', 'senior', 'lead', 'director', 'executive'];
const NOTICE = ['immediate', '2_weeks', '1_month', '6_weeks', '2_months', '3_months', '3_months_eoq', '6_months'];
const REMOTE = ['remote', 'hybrid', 'onsite', 'flexible'];

export function CandidateKeyFactsGrid({ candidate }: CandidateKeyFactsGridProps) {
  const { t, i18n } = useTranslation('candidateDetail');
  // Ausgeschrieben statt „76k€“, ohne Grün (Apple-Stil, 24.11.2026)
  const zahl = (value: number) => Math.round(value).toLocaleString(i18n.language);
  const formatSalary = (value: number | null | undefined) => (value ? `${zahl(value)} €` : null);

  // Gleiche Quelle wie die Kandidatenakte: aktuell → Wunsch (Wunsch = expected_salary, alt salary_fix)
  const wish = candidate.expected_salary ?? candidate.salary_fix ?? null;
  const salaryRange = wish
    ? candidate.current_salary && candidate.current_salary !== wish
      ? `${zahl(candidate.current_salary)} → ${zahl(wish)} €`
      : formatSalary(wish)
    : candidate.salary_expectation_min && candidate.salary_expectation_max
      ? `${zahl(candidate.salary_expectation_min)} – ${zahl(candidate.salary_expectation_max)} €`
      : null;

  const getAvailabilityText = () => {
    if (candidate.availability_date) {
      const date = new Date(candidate.availability_date);
      if (date <= new Date()) return t('facts.now');
      return t('facts.from', { date: format(date, 'MMM yyyy', { locale: dateFnsLocale(i18n.language) }) });
    }
    if (candidate.notice_period) {
      return NOTICE.includes(candidate.notice_period) ? t(`facts.notice.${candidate.notice_period}`) : candidate.notice_period;
    }
    return null;
  };

  const getRemoteText = () => {
    if (candidate.remote_preference) return REMOTE.includes(candidate.remote_preference) ? t(`facts.remote.${candidate.remote_preference}`) : candidate.remote_preference;
    if (candidate.remote_possible) return t('facts.remotePossible');
    return null;
  };

  const facts: KeyFact[] = [
    { icon: TrendingUp, label: t('facts.labelSeniority'), value: candidate.seniority ? (SENIORITY.includes(candidate.seniority) ? t(`facts.seniority.${candidate.seniority}`) : candidate.seniority) : null },
    { icon: Euro, label: t('facts.labelSalary'), value: salaryRange, highlight: salaryRange ? 'green' : undefined },
    { icon: Clock, label: t('facts.labelAvailable'), value: getAvailabilityText() },
    { icon: Home, label: t('facts.labelWorkModel'), value: getRemoteText(), highlight: getRemoteText() ? 'blue' : undefined },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
      {facts.map((fact, i) => {
        const missing = !fact.value;
        return (
          <span key={i} className="flex items-center gap-x-1">
            {i > 0 && <span className="mx-1.5 text-muted-foreground" aria-hidden="true">·</span>}
            <span className="text-muted-foreground">{fact.label}:</span>
            <span className={cn("font-medium", missing ? "text-muted-foreground/50" : "text-foreground")}>
              {fact.value || '–'}
            </span>
          </span>
        );
      })}
    </div>
  );
}

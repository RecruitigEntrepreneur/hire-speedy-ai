import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  User,
  MapPin,
  Euro,
  Clock,
  Briefcase,
  Home,
  Calendar,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CandidateTag } from '@/hooks/useCandidateTags';

interface CandidateKeyFactsCardProps {
  candidate: {
    job_title?: string | null;
    seniority?: string | null;
    experience_years?: number | null;
    city?: string | null;
    expected_salary?: number | null;
    salary_expectation_min?: number | null;
    salary_expectation_max?: number | null;
    current_salary?: number | null;
    notice_period?: string | null;
    availability_date?: string | null;
    remote_possible?: boolean | null;
    remote_preference?: string | null;
    skills?: string[] | null;
    certifications?: string[] | null;
  };
  tags: CandidateTag[];
}

const seniorityLabels: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead',
  director: 'Director',
};

const noticePeriodLabels: Record<string, string> = {
  immediate: 'Sofort',
  '2_weeks': '2 Wo.',
  '1_month': '1 Mo.',
  '2_months': '2 Mo.',
  '3_months': '3 Mo.',
  '6_months': '6 Mo.',
};

export function CandidateKeyFactsCard({ candidate, tags }: CandidateKeyFactsCardProps) {
  const formatSalary = (value: number | null | undefined) => {
    if (!value) return null;
    return `${Math.round(value / 1000)}k`;
  };

  const salaryRange = candidate.salary_expectation_min && candidate.salary_expectation_max
    ? `${formatSalary(candidate.salary_expectation_min)}-${formatSalary(candidate.salary_expectation_max)}€`
    : candidate.expected_salary
      ? `${formatSalary(candidate.expected_salary)}€`
      : null;

  const availabilityText = candidate.notice_period
    ? noticePeriodLabels[candidate.notice_period] || candidate.notice_period
    : candidate.availability_date
      ? `ab ${format(new Date(candidate.availability_date), 'MMM yyyy', { locale: de })}`
      : null;

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        {/* Row 1: Role & Experience */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">{candidate.job_title || 'Keine Rolle'}</span>
          </div>
          {candidate.seniority && (
            <Badge variant="secondary" className="text-xs">
              {seniorityLabels[candidate.seniority] || candidate.seniority}
            </Badge>
          )}
          {candidate.experience_years && (
            <span className="text-muted-foreground flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              {candidate.experience_years}J
            </span>
          )}
          {candidate.city && (
            <span className="text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {candidate.city}
            </span>
          )}
        </div>

        {/* Row 2: Salary & Availability */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {salaryRange && (
            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <Euro className="h-4 w-4" />
              <span className="font-medium">{salaryRange}</span>
              {candidate.current_salary && (
                <span className="text-muted-foreground text-xs">
                  (aktuell {formatSalary(candidate.current_salary)}€)
                </span>
              )}
            </div>
          )}
          {availabilityText && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{availabilityText}</span>
            </div>
          )}
          {candidate.remote_possible && (
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <Home className="h-4 w-4" />
              <span>Remote möglich</span>
            </div>
          )}
        </div>

        {/* Row 3: Skills (top 6) */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {candidate.skills.slice(0, 6).map((skill, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 6 && (
              <Badge variant="secondary" className="text-xs">
                +{candidate.skills.length - 6}
              </Badge>
            )}
          </div>
        )}

        {/* Row 4: Certifications */}
        {candidate.certifications && candidate.certifications.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {candidate.certifications.slice(0, 3).map((cert, i) => (
              <Badge key={i} variant="outline" className="text-xs border-amber-500/50 text-amber-600">
                <Award className="h-3 w-3 mr-1" />
                {cert}
              </Badge>
            ))}
          </div>
        )}

        {/* Row 5: Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1 border-t">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

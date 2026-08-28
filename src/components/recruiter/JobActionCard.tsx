import { Button } from '@/components/ui/button';
import {
  Lock,
  CheckCircle,
  MapPin,
  Users,
  Search,
  Check,
  Flame,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl } from '@/lib/companyLogo';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CompanyProfile {
  logo_url: string | null;
  website: string | null;
  headcount: number | null;
  industry: string | null;
}

interface JobActionCardProps {
  job: {
    id: string;
    // client_id bewusst nicht Teil der Props: recruiter_jobs_view liefert die
    // Spalte seit Welle 1 nicht mehr aus (Identitaetsvektor).
    title: string;
    company_name: string;
    location: string;
    remote_type: string;
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number;
    skills: string[];
    hiring_urgency: string | null;
    industry: string | null;
    company_size_band: string | null;
    funding_stage: string | null;
    tech_environment: string[] | null;
    updated_at?: string | null;
  };
  earning: number | null;
  isRevealed: boolean;
  revealedCompanyName?: string;
  profile?: CompanyProfile;
  isSelected: boolean;
  isActive: boolean;
  recruiterCount: number;
  submittedCount: number;
  onSelect: () => void;
  onToggleActive: (e: React.MouseEvent) => void;
}

const formatSalaryRange = (min: number | null, max: number | null): string | null => {
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  if (min && max) return `€${k(min)}–${k(max)}`;
  if (min) return `ab €${k(min)}`;
  if (max) return `bis €${k(max)}`;
  return null;
};

export function JobActionCard({
  job,
  earning,
  isRevealed,
  revealedCompanyName,
  profile,
  isSelected,
  isActive,
  recruiterCount,
  submittedCount,
  onSelect,
  onToggleActive,
}: JobActionCardProps) {
  const salaryRange = formatSalaryRange(job.salary_min, job.salary_max);
  const topSkills = (job.skills || []).slice(0, 3);
  const moreSkills = Math.max((job.skills?.length || 0) - 3, 0);
  const freshness = job.updated_at
    ? formatDistanceToNow(new Date(job.updated_at), { locale: de, addSuffix: true })
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(); }}
      className={cn(
        'rounded-lg border p-3.5 cursor-pointer transition-all group bg-card',
        isSelected
          ? 'border-l-[3px] border-l-primary border-t-border/50 border-r-border/50 border-b-border/50 shadow-sm'
          : 'border-border/40 hover:border-border/70 hover:shadow-sm',
      )}
    >
      {/* Row 1: Title + Earning */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {job.hiring_urgency === 'urgent' && (
              <Flame className="h-3.5 w-3.5 text-destructive shrink-0" />
            )}
            <h3 className="font-medium text-sm leading-snug">{job.title}</h3>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-sm font-bold text-emerald-500 tabular-nums">
            {earning ? `€${earning.toLocaleString('de-DE')}` : `${job.recruiter_fee_percentage}%`}
          </span>
          {earning != null && (
            <span className="block text-[10px] text-muted-foreground tabular-nums">
              {job.recruiter_fee_percentage} % Fee
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Company */}
      <div className="mt-1">
        {isRevealed ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div className="h-4 w-4 rounded overflow-hidden bg-background border border-border/50 flex items-center justify-center shrink-0">
              <img
                src={getCompanyLogoUrl(profile?.logo_url, profile?.website, revealedCompanyName || '')}
                alt=""
                className="h-3 w-3 object-contain"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(revealedCompanyName || 'U')}&background=1e3a5f&color=fff&size=32&bold=true`;
                }}
              />
            </div>
            <span>{revealedCompanyName}</span>
            <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Lock className="h-3 w-3 shrink-0" />
            {formatAnonymousCompany({
              industry: job.industry,
              companySize: job.company_size_band,
              fundingStage: job.funding_stage,
              techStack: job.tech_environment,
              location: job.location,
              urgency: job.hiring_urgency,
              remoteType: job.remote_type,
            })}
          </p>
        )}
      </div>

      {/* Row 3: Location */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">{job.location}</span>
        <span className="text-border">·</span>
        <span className="capitalize">{job.remote_type}</span>
      </div>

      {/* Row 4: Salary + Skills chips */}
      {(salaryRange || topSkills.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {salaryRange && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/50 text-[11px] text-muted-foreground tabular-nums">
              {salaryRange}
            </span>
          )}
          {topSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted/50 text-[11px] text-muted-foreground max-w-[120px] truncate"
            >
              {skill}
            </span>
          ))}
          {moreSkills > 0 && (
            <span className="text-[11px] text-muted-foreground/70">+{moreSkills}</span>
          )}
        </div>
      )}

      {/* Row 5: Bottom — Competition + Freshness | Ich suche */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-border/20">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground min-w-0">
          {recruiterCount === 0 ? (
            <span className="flex items-center gap-1 text-amber-500 font-medium shrink-0">
              <Sparkles className="h-3 w-3" />
              Noch kein Recruiter — Erster!
            </span>
          ) : (
            <span className="flex items-center gap-1 shrink-0">
              <Users className="h-3 w-3" />
              {recruiterCount} Recruiter · {submittedCount} {submittedCount === 1 ? 'Einreichung' : 'Einreichungen'}
            </span>
          )}
          {freshness && (
            <span className="hidden sm:flex items-center gap-1 truncate">
              <Clock className="h-3 w-3 shrink-0" />
              Aktiv {freshness}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 text-[11px] px-2 shrink-0',
            isActive
              ? 'text-emerald-500 cursor-default pointer-events-none'
              : 'text-muted-foreground hover:text-foreground',
          )}
          onClick={isActive ? undefined : onToggleActive}
        >
          {isActive ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              Aktiv
            </>
          ) : (
            <>
              <Search className="h-3 w-3 mr-1" />
              Ich suche
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

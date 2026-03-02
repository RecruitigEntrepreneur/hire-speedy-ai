import { Button } from '@/components/ui/button';
import {
  Lock,
  CheckCircle,
  MapPin,
  Users,
  Search,
  Check,
  Flame,
} from 'lucide-react';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl } from '@/lib/companyLogo';
import { cn } from '@/lib/utils';

interface CompanyProfile {
  logo_url: string | null;
  website: string | null;
  headcount: number | null;
  industry: string | null;
}

interface JobActionCardProps {
  job: {
    id: string;
    client_id: string;
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
  };
  earning: number | null;
  isRevealed: boolean;
  revealedCompanyName?: string;
  profile?: CompanyProfile;
  isSelected: boolean;
  isActive: boolean;
  recruiterCount: number;
  pipelinePercent: number;
  submittedCount: number;
  onSelect: () => void;
  onToggleActive: (e: React.MouseEvent) => void;
}

export function JobActionCard({
  job,
  earning,
  isRevealed,
  revealedCompanyName,
  profile,
  isSelected,
  isActive,
  recruiterCount,
  pipelinePercent,
  onSelect,
  onToggleActive,
}: JobActionCardProps) {
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
        <span className="text-sm font-bold text-emerald-500 tabular-nums shrink-0">
          {earning ? `€${earning.toLocaleString('de-DE')}` : `${job.recruiter_fee_percentage}%`}
        </span>
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
        <span>{job.location}</span>
        <span className="text-border">·</span>
        <span className="capitalize">{job.remote_type}</span>
      </div>

      {/* Row 4: Bottom — Recruiter count + Pipeline | Ich suche */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/20">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {recruiterCount === 0 ? 'Erster!' : recruiterCount}
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 rounded-full bg-muted/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${Math.min(pipelinePercent, 100)}%` }}
              />
            </div>
            <span className="tabular-nums">{pipelinePercent}%</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-6 text-[11px] px-2',
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

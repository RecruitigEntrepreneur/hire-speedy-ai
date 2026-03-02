import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lock,
  CheckCircle,
  MapPin,
  Building2,
  Search,
  Check,
  Rocket,
  ExternalLink,
  X,
  Clock,
  Briefcase,
  Globe,
  Cpu,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatAnonymousCompany } from '@/lib/anonymousCompanyFormat';
import { getCompanyLogoUrl, formatHeadcount } from '@/lib/companyLogo';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface CompanyProfile {
  logo_url: string | null;
  website: string | null;
  headcount: number | null;
  industry: string | null;
}

interface JobPreviewPanelProps {
  job: {
    id: string;
    client_id: string;
    title: string;
    company_name: string;
    description?: string;
    location: string;
    remote_type: string;
    employment_type: string;
    experience_level: string;
    salary_min: number | null;
    salary_max: number | null;
    recruiter_fee_percentage: number;
    skills: string[];
    created_at: string;
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
  isActive: boolean;
  onToggleActive: () => void;
  onClose: () => void;
}

const formatSalary = (min: number | null, max: number | null) => {
  if (!min && !max) return 'k.A.';
  if (min && max) return `€${min.toLocaleString('de-DE')} – €${max.toLocaleString('de-DE')}`;
  if (min) return `ab €${min.toLocaleString('de-DE')}`;
  return `bis €${max?.toLocaleString('de-DE')}`;
};

const REMOTE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'Vor Ort',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Vollzeit',
  part_time: 'Teilzeit',
  contract: 'Freelance',
  freelance: 'Freelance',
};

const LEVEL_LABELS: Record<string, string> = {
  junior: 'Junior',
  mid: 'Mid-Level',
  senior: 'Senior',
  lead: 'Lead',
  'c-level': 'C-Level',
};

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Dringend', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  high: { label: 'Hoch', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  normal: { label: 'Normal', className: 'bg-muted text-muted-foreground' },
};

export function JobPreviewPanel({
  job,
  earning,
  isRevealed,
  revealedCompanyName,
  profile,
  isActive,
  onToggleActive,
  onClose,
}: JobPreviewPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(job.created_at), { locale: de, addSuffix: true });
  const urgency = job.hiring_urgency ? URGENCY_CONFIG[job.hiring_urgency] : null;

  return (
    <div className="h-full flex flex-col">
      {/* ── Header: Title + Company + Meta ── */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-start gap-3">
          {isRevealed ? (
            <div className="h-10 w-10 rounded-lg overflow-hidden bg-background border border-border/50 flex items-center justify-center shrink-0">
              <img
                src={getCompanyLogoUrl(profile?.logo_url, profile?.website, revealedCompanyName || '')}
                alt=""
                className="h-8 w-8 object-contain"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(revealedCompanyName || 'U')}&background=1e3a5f&color=fff&size=64&bold=true`;
                }}
              />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              <Lock className="h-4 w-4 text-muted-foreground/50" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <Link to={`/recruiter/jobs/${job.id}`} className="font-semibold text-base leading-snug hover:text-primary transition-colors">
              {job.title}
            </Link>
            {isRevealed ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                <span>{revealedCompanyName}</span>
                <CheckCircle className="h-3 w-3 text-emerald-500" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                <Lock className="h-3 w-3" />
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

            {/* Meta line: urgency + time */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {urgency && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 leading-4', urgency.className)}>
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  {urgency.label}
                </Badge>
              )}
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Header actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to={`/recruiter/jobs/${job.id}`}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* CTAs — compact, side by side */}
        <div className="mt-3 flex gap-2">
          <Button
            variant={isActive ? 'outline' : 'secondary'}
            size="sm"
            className={cn(
              'flex-1 h-8 text-xs',
              isActive && 'border-emerald-500/30 text-emerald-500 cursor-default pointer-events-none',
            )}
            onClick={isActive ? undefined : onToggleActive}
            disabled={false}
          >
            {isActive ? (
              <><Check className="h-3.5 w-3.5 mr-1" />Aktiv</>
            ) : (
              <><Search className="h-3.5 w-3.5 mr-1" />Ich suche</>
            )}
          </Button>
          {isActive ? (
            <Button size="sm" className="flex-1 h-8 text-xs" asChild>
              <Link to={`/recruiter/jobs/${job.id}`}>
                <Rocket className="h-3.5 w-3.5 mr-1" />
                Kandidat vorschlagen
              </Link>
            </Button>
          ) : (
            <Button size="sm" className="flex-1 h-8 text-xs" disabled>
              <Lock className="h-3.5 w-3.5 mr-1" />
              Kandidat vorschlagen
            </Button>
          )}
        </div>
      </div>

      {/* ── Scrollable Card-Block Content ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Card: Earning + Gehalt */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/10">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Earning</p>
            <p className="text-lg font-bold text-emerald-500 tabular-nums mt-0.5">
              {earning ? `€${earning.toLocaleString('de-DE')}` : 'k.A.'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Gehalt</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">
              {formatSalary(job.salary_min, job.salary_max)}
            </p>
          </div>
        </div>

        {/* Card: Level/Typ + Arbeitsort */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Anstellung</span>
            </div>
            <p className="text-sm font-medium">
              {LEVEL_LABELS[job.experience_level] || job.experience_level}
            </p>
            <p className="text-xs text-muted-foreground">
              {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Arbeitsort</span>
            </div>
            <p className="text-sm font-medium">{job.location}</p>
            <p className="text-xs text-muted-foreground">
              {REMOTE_LABELS[job.remote_type] || job.remote_type}
            </p>
          </div>
        </div>

        {/* Card: Tech-Stack & Skills */}
        {((job.skills && job.skills.length > 0) || (job.tech_environment && job.tech_environment.length > 0)) && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Cpu className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Skills & Tech-Stack</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {job.skills?.map((skill) => (
                <Badge key={skill} variant="outline" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {job.tech_environment?.map((tech) => (
                <Badge key={tech} variant="secondary" className="text-xs">
                  {tech}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Card: Stellenbeschreibung */}
        {job.description && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-2">Stellenbeschreibung</p>
            <p className={cn(
              'text-sm text-muted-foreground whitespace-pre-line',
              !descExpanded && 'line-clamp-[8]',
            )}>
              {job.description}
            </p>
            <button
              onClick={() => setDescExpanded(!descExpanded)}
              className="text-xs text-primary hover:underline mt-1.5"
            >
              {descExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
            </button>
          </div>
        )}

        {/* Card: Unternehmen */}
        {(job.industry || job.company_size_band || job.funding_stage || (job.tech_environment && job.tech_environment.length > 0)) && (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Unternehmen</span>
            </div>
            <div className="space-y-1.5">
              {job.industry && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Branche</span>
                  <span className="font-medium">{job.industry}</span>
                </div>
              )}
              {job.company_size_band && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Größe</span>
                  <span className="font-medium">{job.company_size_band}</span>
                </div>
              )}
              {job.funding_stage && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Phase</span>
                  <span className="font-medium capitalize">{job.funding_stage}</span>
                </div>
              )}
              {isRevealed && profile?.headcount && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mitarbeiter</span>
                  <span className="font-medium">{formatHeadcount(profile.headcount)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Link to full view */}
        <div className="pt-1">
          <Button variant="outline" size="sm" className="w-full h-8 text-xs text-muted-foreground" asChild>
            <Link to={`/recruiter/jobs/${job.id}`}>
              Vollständig ansehen
              <ExternalLink className="h-3 w-3 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

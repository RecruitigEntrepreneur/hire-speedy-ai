import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  MapPin, 
  Building2, 
  Clock, 
  Edit2, 
  Zap, 
  Pause, 
  Play,
  Users,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ArrowLeft,
  Check,
  Factory,
  Monitor,
} from 'lucide-react';
import { getJobHealthStatus } from '@/lib/jobPipelineStatus';
import { cn } from '@/lib/utils';

interface JobStats {
  totalSubmissions: number;
  inProcess: number;
  interviewed: number;
  hired: number;
  daysOpen: number;
  activeRecruiters: number;
}

interface ClientJobHeroProps {
  job: {
    id: string;
    title: string;
    company_name: string;
    location: string | null;
    remote_type: string | null;
    employment_type?: string | null;
    industry?: string | null;
    salary_min: number | null;
    salary_max: number | null;
    status: string | null;
    paused_at: string | null;
    created_at: string;
  };
  stats: JobStats;
  onEdit: () => void;
  onPauseToggle: () => void;
  onBoost?: () => void;
  showStats?: boolean;
}

const LIFECYCLE_STEPS = [
  { key: 'draft', label: 'Entwurf' },
  { key: 'active', label: 'Aktiv' },
  { key: 'candidates', label: 'Kandidaten' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'hired', label: 'Besetzt' },
];

function getLifecycleStep(status: string | null, isPaused: boolean, totalSubmissions: number, interviewed: number, hired: number): number {
  if (hired > 0) return 4;
  if (interviewed > 0) return 3;
  if (totalSubmissions > 0) return 2;
  if (status === 'published' && !isPaused) return 1;
  return 0;
}

const REMOTE_LABELS: Record<string, string> = {
  onsite: 'Vor Ort',
  hybrid: 'Hybrid',
  remote: 'Remote',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  fulltime: 'Vollzeit',
  parttime: 'Teilzeit',
  contract: 'Freelance',
  internship: 'Praktikum',
};

export function ClientJobHero({ job, stats, onEdit, onPauseToggle, onBoost, showStats = true }: ClientJobHeroProps) {
  const isPaused = !!job.paused_at;
  const healthStatus = getJobHealthStatus(
    stats.totalSubmissions,
    stats.interviewed,
    stats.activeRecruiters,
    stats.daysOpen,
    isPaused
  );

  const currentStep = getLifecycleStep(job.status, isPaused, stats.totalSubmissions, stats.interviewed, stats.hired);

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
    if (min) return `Ab €${(min / 1000).toFixed(0)}k`;
    return `Bis €${(max! / 1000).toFixed(0)}k`;
  };

  const HealthIcon = {
    excellent: CheckCircle2,
    good: TrendingUp,
    warning: AlertTriangle,
    critical: Clock,
    paused: Pause,
  }[healthStatus.level];

  return (
    <div className="space-y-4">
      {/* Back Link */}
      <Link 
        to="/dashboard/jobs" 
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurück zur Job-Übersicht
      </Link>

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card via-card to-accent/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
        
        <div className="relative p-6 md:p-8">
          {/* Top Row: Logo + Title + Status */}
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0 shadow-navy">
              <Briefcase className="h-8 w-8 md:h-10 md:w-10 text-primary-foreground" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{job.title}</h1>
                <Badge 
                  variant="outline"
                  className={cn(
                    healthStatus.color.bg,
                    healthStatus.color.text,
                    healthStatus.color.border,
                    'gap-1.5'
                  )}
                >
                  <HealthIcon className="h-3.5 w-3.5" />
                  {healthStatus.label}
                </Badge>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4" />
                  {job.company_name}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {job.location}
                  </span>
                )}
                {formatSalary(job.salary_min, job.salary_max) && (
                  <span className="font-medium text-foreground">
                    {formatSalary(job.salary_min, job.salary_max)}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Seit {stats.daysOpen} Tagen
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge 
                variant={
                  job.status === 'published' && !isPaused ? 'default' :
                  job.status === 'closed' ? 'destructive' :
                  isPaused ? 'secondary' : 'outline'
                }
                className="h-7 px-3"
              >
                {isPaused ? 'Pausiert' : 
                 job.status === 'published' ? 'Aktiv' :
                 job.status === 'closed' ? 'Geschlossen' : 'Entwurf'}
              </Badge>
            </div>
          </div>

          {/* Lifecycle Stepper */}
          <div className="mt-6 p-4 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50">
            <div className="flex items-center justify-between">
              {LIFECYCLE_STEPS.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                return (
                  <div key={step.key} className="flex items-center flex-1 last:flex-initial">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                        isCompleted && "bg-primary text-primary-foreground",
                        isCurrent && "bg-primary/20 text-primary border-2 border-primary",
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                      )}>
                        {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                      </div>
                      <span className={cn(
                        "text-[11px] font-medium whitespace-nowrap",
                        isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {step.label}
                      </span>
                    </div>
                    {index < LIFECYCLE_STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-2 mt-[-18px]",
                        index < currentStep ? "bg-primary" : "bg-border"
                      )} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Company Info Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {job.industry && (
              <Badge variant="secondary" className="font-normal gap-1">
                <Factory className="h-3 w-3" />
                {job.industry}
              </Badge>
            )}
            {job.remote_type && (
              <Badge variant="secondary" className="font-normal gap-1">
                <Monitor className="h-3 w-3" />
                {REMOTE_LABELS[job.remote_type] || job.remote_type}
              </Badge>
            )}
            {job.employment_type && (
              <Badge variant="secondary" className="font-normal gap-1">
                <Briefcase className="h-3 w-3" />
                {EMPLOYMENT_LABELS[job.employment_type] || job.employment_type}
              </Badge>
            )}
          </div>

          {/* Stats Bar - only show when there are candidates */}
          {showStats && (
            <div className="mt-4 p-4 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.totalSubmissions}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Users className="h-3 w-3" />
                    Kandidaten
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.inProcess}</p>
                  <p className="text-xs text-muted-foreground">In Bearbeitung</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.interviewed}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Interviewt
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600">{stats.hired}</p>
                  <p className="text-xs text-muted-foreground">Eingestellt</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold">{stats.activeRecruiters}</p>
                  <p className="text-xs text-muted-foreground">Recruiter aktiv</p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={onEdit} variant="outline" size="sm">
              <Edit2 className="h-4 w-4 mr-2" />
              Bearbeiten
            </Button>
            {job.status === 'published' && !isPaused && onBoost && (
              <Button onClick={onBoost} variant="outline" size="sm" className="text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50">
                <Zap className="h-4 w-4 mr-2" />
                Boosten
              </Button>
            )}
            <Button asChild variant="outline" size="sm">
              <Link to={`/dashboard/command/${job.id}`}>
                <Users className="h-4 w-4 mr-2" />
                Pipeline öffnen
              </Link>
            </Button>
            <Button onClick={onPauseToggle} variant="ghost" size="sm">
              {isPaused ? (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Reaktivieren
                </>
              ) : (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pausieren
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

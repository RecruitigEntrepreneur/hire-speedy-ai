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
}

export function ClientJobHero({ job, stats, onEdit, onPauseToggle, onBoost }: ClientJobHeroProps) {
  const isPaused = !!job.paused_at;
  const healthStatus = getJobHealthStatus(
    stats.totalSubmissions,
    stats.interviewed,
    stats.activeRecruiters,
    stats.daysOpen,
    isPaused
  );

  const formatSalary = (min: number | null, max: number | null) => {
    if (!min && !max) return null;
    if (min && max) return `€${(min / 1000).toFixed(0)}k - €${(max / 1000).toFixed(0)}k`;
    if (min) return `Ab €${(min / 1000).toFixed(0)}k`;
    return `Bis €${(max! / 1000).toFixed(0)}k`;
  };

  const getRemoteLabel = (type: string | null) => {
    if (!type) return null;
    const labels: Record<string, string> = {
      onsite: 'Vor Ort',
      hybrid: 'Hybrid',
      remote: 'Remote',
    };
    return labels[type] || type;
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
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent" />
        
        <div className="relative p-6 md:p-8">
          {/* Top Row: Logo + Title + Status */}
          <div className="flex flex-col md:flex-row md:items-start gap-4 md:gap-6">
            {/* Logo */}
            <div className="h-16 w-16 md:h-20 md:w-20 rounded-xl bg-gradient-navy flex items-center justify-center flex-shrink-0 shadow-navy">
              <Briefcase className="h-8 w-8 md:h-10 md:w-10 text-primary-foreground" />
            </div>

            {/* Title & Company */}
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
                {job.remote_type && (
                  <Badge variant="secondary" className="font-normal">
                    {getRemoteLabel(job.remote_type)}
                  </Badge>
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

            {/* Status Badge */}
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

          {/* Stats Bar */}
          <div className="mt-6 p-4 rounded-lg bg-background/60 backdrop-blur-sm border border-border/50">
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
              <Link to={`/dashboard/pipeline?job=${job.id}`}>
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

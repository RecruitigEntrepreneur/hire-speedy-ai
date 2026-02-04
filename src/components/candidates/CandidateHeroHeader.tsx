import { Link } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  Edit,
  RefreshCw,
  MapPin,
  CheckCircle,
  XCircle,
  Building2,
  Clock,
  Calendar,
  Briefcase,
  TrendingUp,
} from 'lucide-react';
import { CandidateStagePipeline } from './CandidateStagePipeline';
import { Candidate } from './CandidateCard';

interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { score: number; isReady: boolean } | null;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onCvUpload: () => void;
  submissions: { id: string; status: string; submitted_at: string; job: { id: string; title: string; company_name: string } }[];
  statusMutationPending: boolean;
  availabilityText: string | null;
  salaryText: string | null;
}

const statusLabels: Record<string, string> = {
  submitted: 'Eingereicht',
  accepted: 'Akzeptiert',
  rejected: 'Abgelehnt',
  interview: 'Interview',
  offer: 'Angebot',
  hired: 'Eingestellt',
};

export function CandidateHeroHeader({
  candidate,
  readiness,
  currentStatus,
  onStatusChange,
  onEdit,
  onCvUpload,
  submissions,
  statusMutationPending,
  availabilityText,
  salaryText,
}: CandidateHeroHeaderProps) {
  const initials = candidate.full_name.split(' ').map((n) => n[0]).join('');
  
  // Calculate days in pipeline
  const daysInPipeline = candidate.created_at 
    ? differenceInDays(new Date(), new Date(candidate.created_at))
    : 0;

  const activeSubmissions = submissions.filter(s => !['rejected', 'hired'].includes(s.status));

  return (
    <div className="space-y-0">
      {/* Back Link */}
      <Link
        to="/recruiter/candidates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zu Kandidaten
      </Link>

      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-accent/20 shadow-sm">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Avatar with Status Ring */}
            <div className="relative shrink-0">
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {readiness?.isReady && (
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-success rounded-full border-2 border-background flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              )}
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Name & Meta */}
                <div className="min-w-0">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">{candidate.full_name}</h1>
                  
                  {/* Meta Info Row */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {candidate.job_title || 'Keine Position'}
                    </span>
                    {candidate.city && (
                      <>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {candidate.city}
                        </span>
                      </>
                    )}
                    {candidate.experience_years && (
                      <>
                        <span className="text-border">•</span>
                        <span>{candidate.experience_years} Jahre Erfahrung</span>
                      </>
                    )}
                    {salaryText && (
                      <>
                        <span className="text-border">•</span>
                        <span className="text-success font-medium">{salaryText}</span>
                      </>
                    )}
                  </div>
                  
                  {/* Badges Row */}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {readiness?.isReady ? (
                      <Badge className="bg-success/10 text-success border-success/20">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Exposé-Ready
                      </Badge>
                    ) : readiness && (
                      <Badge variant="outline" className="text-warning border-warning/50">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {readiness.score}% vollständig
                      </Badge>
                    )}
                    {availabilityText && (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {availabilityText}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Quick Actions - Grouped */}
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Contact Group */}
                  <div className="flex items-center gap-2">
                    {candidate.phone && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.location.href = `tel:${candidate.phone}`}
                      >
                        <Phone className="h-4 w-4 mr-1.5" />
                        Anrufen
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = `mailto:${candidate.email}`}
                    >
                      <Mail className="h-4 w-4 mr-1.5" />
                      E-Mail
                    </Button>
                    {candidate.linkedin_url && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                      >
                        <Linkedin className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {/* Action Group */}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit className="h-4 w-4 mr-1.5" />
                      Bearbeiten
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onCvUpload}>
                      <RefreshCw className="h-4 w-4 mr-1.5" />
                      CV
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Stage Pipeline - Inline */}
          {currentStatus !== 'rejected' && (
            <div className="mt-6">
              <CandidateStagePipeline
                currentStage={currentStatus}
                onStageChange={onStatusChange}
                disabled={statusMutationPending}
              />
            </div>
          )}
        </div>
        
        {/* Stats Bar */}
        <div className="px-6 pb-6">
          <div className="p-4 rounded-lg bg-background/60 backdrop-blur-sm border">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{readiness?.score || 0}%</p>
                <p className="text-xs text-muted-foreground">Profil vollständig</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{activeSubmissions.length}</p>
                <p className="text-xs text-muted-foreground">Bewerbungen</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{daysInPipeline}</p>
                <p className="text-xs text-muted-foreground">Tage in Pipeline</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{candidate.experience_years || '-'}</p>
                <p className="text-xs text-muted-foreground">Jahre Erfahrung</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Active Submissions Pills */}
        {activeSubmissions.length > 0 && (
          <div className="px-6 pb-6 flex flex-wrap gap-2">
            {activeSubmissions.slice(0, 3).map(sub => (
              <Link
                key={sub.id}
                to={`/recruiter/jobs/${sub.job.id}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/20 transition-colors text-sm group"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium group-hover:text-primary transition-colors">
                  {sub.job.title}
                </span>
                <Badge variant="outline" className="h-5 text-xs">
                  {statusLabels[sub.status] || sub.status}
                </Badge>
              </Link>
            ))}
            {activeSubmissions.length > 3 && (
              <Badge variant="secondary">+{activeSubmissions.length - 3} weitere</Badge>
            )}
          </div>
        )}

        {/* Rejected Alert */}
        {currentStatus === 'rejected' && (
          <div className="px-6 py-3 bg-destructive/10 border-t flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              <span className="font-medium">Kandidat abgesagt</span>
            </div>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => onStatusChange('new')}
              disabled={statusMutationPending}
            >
              Reaktivieren
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

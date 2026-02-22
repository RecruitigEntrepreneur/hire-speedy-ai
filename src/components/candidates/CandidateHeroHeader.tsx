import { Link } from 'react-router-dom';
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
  TrendingUp,
  Clock,
  MoreHorizontal,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CandidateStagePipeline } from './CandidateStagePipeline';
import { Candidate } from './CandidateCard';

interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { score: number; isReady: boolean } | null;
  currentStatus: string;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onCvUpload: () => void;
  statusMutationPending: boolean;
  availabilityText: string | null;
  salaryText: string | null;
}

export function CandidateHeroHeader({
  candidate,
  readiness,
  currentStatus,
  onStatusChange,
  onEdit,
  onCvUpload,
  statusMutationPending,
  availabilityText,
  salaryText,
}: CandidateHeroHeaderProps) {
  const initials = candidate.full_name.split(' ').map((n) => n[0]).join('');

  return (
    <div className="space-y-0">
      {/* Back Link */}
      <Link
        to="/recruiter/candidates"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zu Kandidaten
      </Link>

      {/* Compact Hero Card */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <Avatar className="h-14 w-14 ring-2 ring-primary/20">
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {readiness?.isReady && (
                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            
            {/* Name + Meta + Badges */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold truncate">{candidate.full_name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {candidate.job_title || 'Keine Position'}
                    </span>
                    {candidate.city && (
                      <>
                        <span className="text-border">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {candidate.city}
                        </span>
                      </>
                    )}
                    {candidate.experience_years && (
                      <>
                        <span className="text-border">•</span>
                        <span>{candidate.experience_years}J Erfahrung</span>
                      </>
                    )}
                  </div>
                  {/* Inline Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {readiness?.isReady ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Exposé-Ready
                      </Badge>
                    ) : readiness && (
                      <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-xs">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {readiness.score}%
                      </Badge>
                    )}
                    {availabilityText && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {availabilityText}
                      </Badge>
                    )}
                    {salaryText && (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-500/50">
                        {salaryText}
                      </Badge>
                    )}
                  </div>
                </div>
                
                {/* Actions Row */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {candidate.phone && (
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.location.href = `tel:${candidate.phone}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.location.href = `mailto:${candidate.email}`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                  </Button>
                  {candidate.linkedin_url && (
                    <Button 
                      variant="outline" 
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(candidate.linkedin_url!, '_blank')}
                    >
                      <Linkedin className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={onEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onCvUpload}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        CV hochladen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>
          
          {/* Pipeline - compact */}
          {currentStatus !== 'rejected' && (
            <div className="mt-4 pt-3 border-t">
              <CandidateStagePipeline
                currentStage={currentStatus}
                onStageChange={onStatusChange}
                disabled={statusMutationPending}
              />
            </div>
          )}

          {/* Rejected Alert */}
          {currentStatus === 'rejected' && (
            <div className="mt-4 pt-3 border-t flex items-center justify-between">
              <span className="text-sm text-destructive font-medium">Kandidat abgesagt</span>
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
    </div>
  );
}

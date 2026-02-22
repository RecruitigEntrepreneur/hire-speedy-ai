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
  MoreHorizontal,
  FileText,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CandidateStagePipeline } from './CandidateStagePipeline';
import { CandidateKeyFactsGrid } from './CandidateKeyFactsGrid';
import { CandidateTasksSection } from './CandidateTasksSection';
import { CandidateActiveProcesses } from './CandidateActiveProcesses';
import { Candidate } from './CandidateCard';
import { useCandidateDocuments } from '@/hooks/useCandidateDocuments';

interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { score: number; isReady: boolean; missingFields?: string[] } | null;
  currentStatus: string;
  candidateId: string;
  activeTaskId?: string;
  onEdit: () => void;
  onCvUpload: () => void;
}

export function CandidateHeroHeader({
  candidate,
  readiness,
  currentStatus,
  candidateId,
  activeTaskId,
  onEdit,
  onCvUpload,
}: CandidateHeroHeaderProps) {
  const initials = candidate.full_name.split(' ').map((n) => n[0]).join('');
  const { getCurrentDocuments } = useCandidateDocuments(candidateId);
  const currentCv = getCurrentDocuments().find(d => d.document_type === 'cv');

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
                      {candidate.company && ` bei ${candidate.company}`}
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
                  {/* Inline Badges with Tooltip */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {readiness?.isReady ? (
                      <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Exposé-Ready
                      </Badge>
                    ) : readiness && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-amber-600 border-amber-500/50 text-xs cursor-help">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {readiness.score}%
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p className="text-xs font-medium">Exposé-Vollständigkeit</p>
                          {readiness.missingFields && readiness.missingFields.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Fehlend: {readiness.missingFields.join(', ')}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
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
                  {currentCv && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(currentCv.file_url, '_blank')}
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>CV öffnen</TooltipContent>
                    </Tooltip>
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
          
          {/* Key Facts Grid - compact inline */}
          <div className="mt-4 pt-3 border-t">
            <CandidateKeyFactsGrid candidate={candidate} />
          </div>

          {/* Skills & Expertise Badges */}
          {(candidate.skills?.length || (candidate as any).certifications?.length) && (
            <div className="flex flex-wrap items-center gap-1 mt-2 px-0">
              {candidate.skills?.slice(0, 8).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-normal">
                  {skill}
                </Badge>
              ))}
              {(candidate.skills?.length ?? 0) > 8 && (
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  +{(candidate.skills?.length ?? 0) - 8}
                </span>
              )}
              {(candidate as any).certifications?.map((cert: string) => (
                <Badge key={cert} variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-amber-600 border-amber-400/50">
                  {cert}
                </Badge>
              ))}
            </div>
          )}

          {/* Pipeline - read-only */}
          {currentStatus !== 'rejected' && (
            <div className="mt-4 pt-3 border-t">
              <CandidateStagePipeline
                currentStage={currentStatus}
              />
            </div>
          )}

          {/* Rejected Alert */}
          {currentStatus === 'rejected' && (
            <div className="mt-4 pt-3 border-t">
              <span className="text-sm text-destructive font-medium">Kandidat abgesagt</span>
            </div>
          )}

          {/* Active Processes */}
          <div className="mt-4 pt-3 border-t">
            <CandidateActiveProcesses candidateId={candidateId} />
          </div>

          {/* Tasks */}
          <div className="mt-4 pt-3 border-t">
            <CandidateTasksSection candidateId={candidateId} activeTaskId={activeTaskId} />
          </div>
        </div>
      </div>
    </div>
  );
}

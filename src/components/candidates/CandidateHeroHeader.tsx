import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  ArrowLeft,
  Mail,
  Phone,
  Linkedin,
  Pencil,
  Upload,
  MapPin,
  CheckCircle,
  TrendingUp,
  FileText,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CandidateKeyFactsGrid } from './CandidateKeyFactsGrid';
import { CandidateTasksSection } from './CandidateTasksSection';
import { CandidateActiveProcesses } from './CandidateActiveProcesses';
import { Candidate } from './CandidateCard';
import { useCandidateDocuments } from '@/hooks/useCandidateDocuments';

interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { done: number; total: number; isReady: boolean; missing: string[] } | null;
  currentStatus: string;
  candidateId: string;
  activeTaskId?: string;
  onEdit: () => void;
  onCvUpload: () => void;
  onStartInterview?: () => void;
}

export function CandidateHeroHeader({
  candidate,
  readiness,
  currentStatus,
  candidateId,
  activeTaskId,
  onEdit,
  onCvUpload,
  onStartInterview,
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
                      <Badge className="bg-success/10 text-success border-success/20 text-xs">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Bereit zum Einreichen
                      </Badge>
                    ) : readiness && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-warning border-warning/50 text-xs cursor-help">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Bereit {readiness.done} von {readiness.total}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p className="text-xs font-medium">Bereit zum Einreichen</p>
                          {readiness.missing.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Fehlt noch: {readiness.missing.join(', ')}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
                
                {/* Actions Row */}
                <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                  <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    Bearbeiten
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={onCvUpload}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    CV hochladen
                  </Button>
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
            <CandidateTasksSection
              candidateId={candidateId}
              activeTaskId={activeTaskId}
              candidate={{
                full_name: candidate.full_name,
                email: candidate.email,
                phone: candidate.phone,
                job_title: candidate.job_title,
                skills: candidate.skills,
                experience_years: candidate.experience_years,
                expected_salary: candidate.expected_salary,
                availability_date: (candidate as any)?.availability_date,
                notice_period: (candidate as any)?.notice_period,
                city: candidate.city,
                cv_ai_summary: (candidate as any)?.cv_ai_summary,
                cv_ai_bullets: (candidate as any)?.cv_ai_bullets,
              }}
              onEdit={onEdit}
              onCvUpload={onCvUpload}
              onStartInterview={onStartInterview}
              showExposeTasks={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

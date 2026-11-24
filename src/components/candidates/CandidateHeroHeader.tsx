import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { term } from '@/lib/candidateTerms';
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
import { initialen } from '@/lib/initialen';

interface CandidateHeroHeaderProps {
  candidate: Candidate;
  readiness: { done: number; total: number; isReady: boolean; missing: string[] } | null;
  currentStatus: string;
  candidateId: string;
  activeTaskId?: string;
  onEdit: () => void;
  onCvUpload: () => void;
  onStartInterview?: () => void;
  /** „Lebenslauf anfragen“ (05.11.2026): nur solange kein Lebenslauf in der Akte liegt. */
  onLebenslaufAnfragen?: () => void;
  /** „Bereit zum Einreichen“ als kleiner Kasten oben rechts (24.11.2026); ersetzt die Marke unter dem Namen. */
  readinessSlot?: ReactNode;
  /** Talent Pool in der Stand-Zeile */
  poolSlot?: ReactNode;
  /** Knopf „Talent Pool“ bei den anderen Knöpfen (25.11.2026) */
  poolButtonSlot?: ReactNode;
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
  onLebenslaufAnfragen,
  readinessSlot,
  poolSlot,
  poolButtonSlot,
}: CandidateHeroHeaderProps) {
  const { t } = useTranslation(['candidateDetail', 'candidateTerms', 'common']);
  const initials = initialen(candidate.full_name);
  // „+3“ klappt die übrigen Skills auf (Marko, 24.11.2026)
  const [alleSkills, setAlleSkills] = useState(false);
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
        {t('hero.back')}
      </Link>

      {/* Compact Hero Card */}
      <div className="rounded-xl border bg-card">
        <div className="p-4 md:p-5">
          {/* Raster statt Flex (16.11.2026): am Handy stehen die Knöpfe unter Bild und Name über die
              volle Breite, ab sm rechts daneben wie bisher. Vorher verdeckten sie am Handy den Namen. */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            {/* Avatar */}
            <div className="relative shrink-0">
              {/* Apple-Stil (24.11.2026): graues Kürzel wie in der Liste, kein schwarzer Kreis mit Ring */}
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-secondary text-lg font-semibold text-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {readiness?.isReady && !readinessSlot && (
                <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 bg-foreground rounded-full border-2 border-background flex items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-background" />
                </div>
              )}
            </div>
            
            {/* Name + Meta + Badges */}
                <div className="min-w-0">
                  <h1 className="text-xl md:text-2xl font-bold truncate">{candidate.full_name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {candidate.job_title || t('hero.noPosition')}
                      {candidate.company && t('common:candidateHero.at', { company: candidate.company })}
                    </span>
                    {candidate.city && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {candidate.city}
                        </span>
                      </>
                    )}
                    {!!candidate.experience_years && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t('common:candidateHero.years', { count: candidate.experience_years })}</span>
                      </>
                    )}
                  </div>
                  {/* Inline Badges with Tooltip */}
                  {!readinessSlot && <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {readiness?.isReady ? (
                      <Badge variant="outline" className="rounded-full border-transparent bg-secondary text-xs font-normal text-muted-foreground">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        {t('hero.ready')}
                      </Badge>
                    ) : readiness && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="cursor-help rounded-full border-transparent bg-secondary text-xs font-normal text-muted-foreground">
                            {t('hero.readyCount', { done: readiness.done, total: readiness.total })}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-[220px]">
                          <p className="text-xs font-medium">{t('hero.ready')}</p>
                          {readiness.missing.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t('hero.stillMissing', { list: readiness.missing.map((x) => term(x)).join(', ') })}
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>}
                </div>
                
                {/* Actions Row; darunter rechts „Bereit zum Einreichen“ als kleiner Kasten (Entwurf A, 24.11.2026) */}
                <div className="col-span-2 flex flex-col gap-2 sm:col-span-1 sm:items-end">
                <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                  <Button variant="outline" size="sm" className="h-8" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {t('common.edit')}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={onCvUpload}>
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    {t('hero.uploadCv')}
                  </Button>
                  {onLebenslaufAnfragen && (
                    <Button variant="outline" size="sm" className="h-8" onClick={onLebenslaufAnfragen}>
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                      {t('hero.requestCv')}
                    </Button>
                  )}
                  {poolButtonSlot}
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
                      <TooltipContent>{t('hero.openCv')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                </div>
          </div>

          {/* Stand-Zeile (25.11.2026): links „Bereit zum Einreichen“, rechts der Talent Pool */}
          {(readinessSlot || poolSlot) && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-3">
              {readinessSlot}
              {poolSlot}
            </div>
          )}
          
          {/* Key Facts Grid - compact inline */}
          <div className="mt-4 pt-3 border-t">
            <CandidateKeyFactsGrid candidate={candidate} />
          </div>

          {/* Skills & Expertise Badges */}
          {(!!candidate.skills?.length || !!(candidate as any).certifications?.length) && (
            <div className="flex flex-wrap items-center gap-1 mt-2 px-0">
              {candidate.skills?.slice(0, alleSkills ? undefined : 8).map((skill) => (
                <Badge key={skill} variant="secondary" className="h-5 rounded-full px-2 py-0 text-[10px] font-normal">
                  {skill}
                </Badge>
              ))}
              {(candidate.skills?.length ?? 0) > 8 && (
                <button type="button" onClick={() => setAlleSkills((v) => !v)} aria-expanded={alleSkills}
                  className="ml-0.5 text-[11px] font-medium text-klick hover:underline">
                  {alleSkills ? t('common.showLess') : `+${(candidate.skills?.length ?? 0) - 8} ›`}
                </button>
              )}
              {(candidate as any).certifications?.map((cert: string) => (
                <Badge key={cert} variant="outline" className="h-5 rounded-full border-transparent bg-secondary px-2 py-0 text-[10px] font-normal text-muted-foreground">
                  {cert}
                </Badge>
              ))}
            </div>
          )}

          {/* Rejected Alert */}
          {currentStatus === 'rejected' && (
            <div className="mt-4 pt-3 border-t">
              <span className="text-sm text-destructive font-medium">{t('hero.rejected')}</span>
            </div>
          )}

          {/* Aktive Prozesse und Aufgaben nebeneinander: halbe Höhe, je Block 2–3 Karten,
              der Rest seitlich mit „+N ›“ (14.10.2026) */}
          <div className="mt-4 grid gap-4 border-t pt-3 md:grid-cols-2">
          <div className="min-w-0">
            <CandidateActiveProcesses candidateId={candidateId} />
          </div>

          <div className="min-w-0">
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
    </div>
  );
}

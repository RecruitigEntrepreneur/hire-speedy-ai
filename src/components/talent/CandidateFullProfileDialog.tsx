import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  User,
  Briefcase,
  GraduationCap,
  MapPin,
  Euro,
  Clock,
  Mail,
  Phone,
  Calendar,
  Target,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Building2,
  FileText,
  Star,
  ThumbsDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { InterviewSchedulingDialog } from './InterviewSchedulingDialog';

interface InterviewDetails {
  scheduledAt: Date;
  durationMinutes: number;
  meetingType: 'video' | 'phone' | 'onsite';
  meetingLink?: string;
  notes?: string;
}

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
  description?: string | null;
}

interface Education {
  id: string;
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  graduation_year?: number | null;
}

interface CandidateFullProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    submissionId: string;
    name: string;
    currentRole: string;
    email?: string;
    phone?: string;
    city?: string;
    company?: string;
    skills?: string[];
    jobSkills?: string[];
    experienceYears?: number;
    matchScore?: number | null;
    stage: string;
    jobTitle: string;
    cvAiSummary?: string;
    exposeHighlights?: string[];
    experiences?: Experience[];
    educations?: Education[];
    currentSalary?: number;
    expectedSalary?: number;
    noticePeriod?: string;
    availabilityDate?: string;
    changeMotivation?: string;
    submittedAt: string;
  } | null;
  onMove: (submissionId: string, stage: string) => void;
  onReject: (submissionId: string) => void;
  onInterviewRequest?: (submissionId: string, details: {
    scheduledAt: Date;
    durationMinutes: number;
    meetingType: 'video' | 'phone' | 'onsite';
    meetingLink?: string;
    notes?: string;
  }) => Promise<void>;
  isProcessing?: boolean;
}

export function CandidateFullProfileDialog({
  open,
  onOpenChange,
  candidate,
  onMove,
  onReject,
  onInterviewRequest,
  isProcessing
}: CandidateFullProfileDialogProps) {
  const [activeTab, setActiveTab] = useState('profil');
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);

  if (!candidate) return null;

  const handleInterviewSubmit = async (details: InterviewDetails) => {
    if (onInterviewRequest) {
      await onInterviewRequest(candidate.submissionId, details);
    }
    setShowInterviewDialog(false);
    onOpenChange(false);
  };

  if (!candidate) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatSalary = (salary?: number) => {
    if (!salary) return null;
    return new Intl.NumberFormat('de-DE', { 
      style: 'currency', 
      currency: 'EUR', 
      maximumFractionDigits: 0 
    }).format(salary);
  };

  const formatExperienceDate = (startDate?: string | null, endDate?: string | null, isCurrent?: boolean | null) => {
    if (!startDate) return '';
    const start = format(new Date(startDate), 'MMM yyyy', { locale: de });
    if (isCurrent) return `${start} - heute`;
    if (!endDate) return start;
    return `${start} - ${format(new Date(endDate), 'MMM yyyy', { locale: de })}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-muted-foreground bg-muted border-muted';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Exzellent';
    if (score >= 70) return 'Sehr gut';
    if (score >= 55) return 'Gut';
    return 'Prüfen';
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  // Normalize skill names for comparison
  const normalizeSkill = (skill: string) => skill.toLowerCase().trim();
  const jobSkillsNormalized = (candidate.jobSkills || []).map(normalizeSkill);
  const matchingSkills = (candidate.skills || []).filter(skill => 
    jobSkillsNormalized.includes(normalizeSkill(skill))
  );
  const otherSkills = (candidate.skills || []).filter(skill => 
    !jobSkillsNormalized.includes(normalizeSkill(skill))
  );

  // Generate fallback match reasons if none provided
  const matchReasons = candidate.exposeHighlights?.length 
    ? candidate.exposeHighlights 
    : generateFallbackReasons();

  function generateFallbackReasons(): string[] {
    const reasons: string[] = [];
    
    if (matchingSkills.length > 0) {
      reasons.push(`${matchingSkills.length} passende Kernkompetenzen: ${matchingSkills.slice(0, 3).join(', ')}`);
    }
    
    if (candidate.experienceYears && candidate.experienceYears >= 3) {
      reasons.push(`${candidate.experienceYears} Jahre Berufserfahrung`);
    }
    
    if ((candidate.experiences?.length || 0) >= 2) {
      reasons.push(`${candidate.experiences!.length} relevante Berufsstationen`);
    }
    
    if (candidate.city) {
      reasons.push(`Standort: ${candidate.city}`);
    }
    
    if (candidate.noticePeriod) {
      reasons.push(`Kündigungsfrist: ${candidate.noticePeriod}`);
    } else if (candidate.availabilityDate) {
      reasons.push('Zeitnah verfügbar');
    }
    
    return reasons;
  }

  const nextStage = getNextStage(candidate.stage);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        {/* Sticky Header */}
        <DialogHeader className="px-6 py-4 border-b bg-background sticky top-0 z-10">
          <div className="flex items-start gap-4">
            {/* Avatar with Match Score */}
            <div className="relative">
              <Avatar className="h-16 w-16 border-2 border-background shadow-md">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                  {getInitials(candidate.name)}
                </AvatarFallback>
              </Avatar>
              {candidate.matchScore && (
                <div className={cn(
                  "absolute -bottom-1 -right-1 w-8 h-8 rounded-full border-2 bg-background flex items-center justify-center text-xs font-bold shadow-sm",
                  candidate.matchScore >= 80 && "border-green-500",
                  candidate.matchScore >= 60 && candidate.matchScore < 80 && "border-amber-500",
                  candidate.matchScore < 60 && "border-muted"
                )}>
                  <span className={cn(
                    "text-[11px]",
                    candidate.matchScore >= 80 && "text-green-600",
                    candidate.matchScore >= 60 && candidate.matchScore < 80 && "text-amber-600"
                  )}>
                    {candidate.matchScore}
                  </span>
                </div>
              )}
            </div>

            {/* Candidate Info */}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-bold">{candidate.name}</DialogTitle>
              <p className="text-muted-foreground">
                {candidate.currentRole}
                {candidate.company && <span className="text-muted-foreground/70"> @ {candidate.company}</span>}
              </p>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                {candidate.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {candidate.city}
                  </span>
                )}
                {candidate.experienceYears && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5" />
                    {candidate.experienceYears} Jahre
                  </span>
                )}
                <Badge variant="outline" className="text-xs">
                  {candidate.jobTitle}
                </Badge>
              </div>
            </div>

            {/* Match Score Badge */}
            {candidate.matchScore && (
              <div className={cn(
                "px-4 py-2 rounded-lg border text-center",
                getScoreColor(candidate.matchScore)
              )}>
                <div className="text-2xl font-bold">{candidate.matchScore}%</div>
                <div className="text-xs font-medium">{getScoreLabel(candidate.matchScore)}</div>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="px-6 border-b rounded-none justify-start h-auto p-0 bg-transparent">
            <TabsTrigger 
              value="profil" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <User className="h-4 w-4 mr-2" />
              Profil
            </TabsTrigger>
            <TabsTrigger 
              value="matching"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <Target className="h-4 w-4 mr-2" />
              Matching
            </TabsTrigger>
            <TabsTrigger 
              value="dokumente"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              <FileText className="h-4 w-4 mr-2" />
              Dokumente
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 max-h-[calc(90vh-280px)]">
            {/* Profil Tab */}
            <TabsContent value="profil" className="p-6 m-0 space-y-6">
              {/* Executive Summary */}
              {candidate.cvAiSummary && (
                <Card className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Star className="h-4 w-4 text-primary" />
                      Executive Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {candidate.cvAiSummary}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="col-span-2 space-y-6">
                  {/* Work Experience */}
                  {candidate.experiences && candidate.experiences.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          Berufserfahrung
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {candidate.experiences.map((exp, idx) => (
                          <div key={exp.id || idx} className="relative pl-4 border-l-2 border-muted pb-4 last:pb-0">
                            <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-primary" />
                            <h4 className="font-medium">{exp.job_title}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5" />
                              <span>{exp.company_name}</span>
                              <span>·</span>
                              <span>{formatExperienceDate(exp.start_date, exp.end_date, exp.is_current)}</span>
                            </div>
                            {exp.description && (
                              <p className="text-sm text-muted-foreground mt-2">{exp.description}</p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Education */}
                  {candidate.educations && candidate.educations.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-muted-foreground" />
                          Ausbildung
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {candidate.educations.map((edu, idx) => (
                          <div key={edu.id || idx} className="border-l-2 border-muted pl-4">
                            <h4 className="font-medium">
                              {edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {edu.institution}
                              {edu.graduation_year && ` · ${edu.graduation_year}`}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Skills */}
                  {candidate.skills && candidate.skills.length > 0 && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          Kompetenzen
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {matchingSkills.map((skill, i) => (
                            <Badge 
                              key={`match-${i}`} 
                              className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {skill}
                            </Badge>
                          ))}
                          {otherSkills.map((skill, i) => (
                            <Badge key={`other-${i}`} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Change Motivation */}
                  {candidate.changeMotivation && (
                    <Card className="border-l-4 border-l-blue-400">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-blue-600" />
                          Wechselmotivation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {candidate.changeMotivation}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Right Column - Quick Facts */}
                <div className="space-y-4">
                  {/* Quick Facts Card */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Quick Facts</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {candidate.city && (
                        <div className="flex items-center gap-3 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{candidate.city}</span>
                        </div>
                      )}
                      {candidate.expectedSalary && (
                        <div className="flex items-center gap-3 text-sm">
                          <Euro className="h-4 w-4 text-muted-foreground" />
                          <span>{formatSalary(candidate.expectedSalary)}</span>
                        </div>
                      )}
                      {candidate.noticePeriod && (
                        <div className="flex items-center gap-3 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{candidate.noticePeriod}</span>
                        </div>
                      )}
                      {candidate.availabilityDate && (
                        <div className="flex items-center gap-3 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Ab {format(new Date(candidate.availabilityDate), 'dd.MM.yyyy')}</span>
                        </div>
                      )}
                      {candidate.currentSalary && candidate.expectedSalary && 
                       candidate.currentSalary !== candidate.expectedSalary && (
                        <Separator />
                      )}
                      {candidate.currentSalary && (
                        <div className="text-xs text-muted-foreground">
                          Aktuell: {formatSalary(candidate.currentSalary)}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Contact Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Kontakt</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {candidate.email && (
                        <div className="flex items-center gap-3 text-sm">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <a href={`mailto:${candidate.email}`} className="text-primary hover:underline truncate">
                            {candidate.email}
                          </a>
                        </div>
                      )}
                      {candidate.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <a href={`tel:${candidate.phone}`} className="text-primary hover:underline">
                            {candidate.phone}
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Timeline */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <p>
                        Eingereicht {formatDistanceToNow(new Date(candidate.submittedAt), { 
                          addSuffix: true, 
                          locale: de 
                        })}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Matching Tab */}
            <TabsContent value="matching" className="p-6 m-0 space-y-6">
              {/* Match Score Card */}
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-semibold">KI-Match-Analyse</h3>
                      <p className="text-sm text-muted-foreground">
                        Automatische Bewertung basierend auf Anforderungsprofil
                      </p>
                    </div>
                    {candidate.matchScore && (
                      <div className={cn(
                        "px-6 py-3 rounded-xl border-2 text-center",
                        getScoreColor(candidate.matchScore)
                      )}>
                        <div className="text-3xl font-bold">{candidate.matchScore}%</div>
                        <div className="text-sm font-medium">{getScoreLabel(candidate.matchScore)}</div>
                      </div>
                    )}
                  </div>

                  {/* Match Reasons */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      Warum dieser Kandidat passt
                    </h4>
                    <div className="grid gap-3">
                      {matchReasons.slice(0, 6).map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                          <span className="text-sm">{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Skill Match Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Skill-Match-Analyse
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Passende Skills</span>
                        <span className="text-sm text-green-600 font-medium">
                          {matchingSkills.length} / {(candidate.jobSkills || []).length}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ 
                            width: `${(candidate.jobSkills?.length || 0) > 0 
                              ? (matchingSkills.length / (candidate.jobSkills?.length || 1)) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {matchingSkills.map((skill, i) => (
                        <Badge 
                          key={`match-${i}`} 
                          className="bg-green-100 text-green-800 border-green-200"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {skill}
                        </Badge>
                      ))}
                    </div>

                    {(candidate.jobSkills || []).filter(s => 
                      !matchingSkills.map(m => m.toLowerCase()).includes(s.toLowerCase())
                    ).length > 0 && (
                      <div className="pt-4 border-t">
                        <p className="text-sm text-muted-foreground mb-2">Fehlende Anforderungen:</p>
                        <div className="flex flex-wrap gap-2">
                          {(candidate.jobSkills || [])
                            .filter(s => !matchingSkills.map(m => m.toLowerCase()).includes(s.toLowerCase()))
                            .map((skill, i) => (
                              <Badge key={i} variant="outline" className="text-muted-foreground">
                                <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
                                {skill}
                              </Badge>
                            ))
                          }
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Dokumente Tab */}
            <TabsContent value="dokumente" className="p-6 m-0">
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground">
                      Dokumente werden hier angezeigt
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      CV, Zeugnisse und weitere Unterlagen
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Sticky Footer with Actions */}
        {candidate.stage !== 'hired' && (
          <DialogFooter className="px-6 py-4 border-t bg-background">
            <div className="flex items-center justify-between w-full">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
              >
                Schließen
              </Button>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => {
                    onReject(candidate.submissionId);
                    onOpenChange(false);
                  }}
                  disabled={isProcessing}
                >
                  <ThumbsDown className="h-4 w-4 mr-2" />
                  Absage
                </Button>
                {(candidate.stage === 'submitted' || candidate.stage === 'interview_1') ? (
                  <>
                    <Button
                      onClick={() => setShowInterviewDialog(true)}
                      disabled={isProcessing}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      {candidate.stage === 'submitted' ? 'Interview 1 anfragen' : 'Interview 2 anfragen'}
                    </Button>
                    <InterviewSchedulingDialog
                      open={showInterviewDialog}
                      onOpenChange={setShowInterviewDialog}
                      candidate={{
                        id: candidate.id,
                        name: candidate.name,
                        jobTitle: candidate.jobTitle
                      }}
                      onSubmit={handleInterviewSubmit}
                    />
                  </>
                ) : nextStage && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      onMove(candidate.submissionId, nextStage);
                      onOpenChange(false);
                    }}
                    disabled={isProcessing}
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    {candidate.stage === 'interview_2' ? 'Angebot erstellen' : 'Einstellen'}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

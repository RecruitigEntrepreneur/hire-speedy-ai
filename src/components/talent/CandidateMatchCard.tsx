import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  AlertTriangle,
  Briefcase,
  GraduationCap,
  MapPin,
  Euro,
  Clock,
  Building2,
  TrendingUp,
  Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

interface Experience {
  id: string;
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean | null;
}

interface Education {
  id: string;
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  graduation_year?: number | null;
}

interface CandidateMatchCardProps {
  matchScore?: number;
  matchReasons?: string[];
  matchRisks?: string[];
  experiences?: Experience[];
  educations?: Education[];
  skills?: string[];
  jobSkills?: string[];
  city?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriod?: string;
  availabilityDate?: string;
  changeMotivation?: string;
  className?: string;
}

export function CandidateMatchCard({
  matchScore,
  matchReasons = [],
  matchRisks = [],
  experiences = [],
  educations = [],
  skills = [],
  jobSkills = [],
  city,
  currentSalary,
  expectedSalary,
  noticePeriod,
  availabilityDate,
  changeMotivation,
  className
}: CandidateMatchCardProps) {
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
    const start = format(new Date(startDate), 'MM/yyyy');
    if (isCurrent) return `${start} - heute`;
    if (!endDate) return start;
    return `${start} - ${format(new Date(endDate), 'MM/yyyy')}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-muted-foreground bg-muted border-muted';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 85) return 'Sehr gut';
    if (score >= 70) return 'Gut';
    if (score >= 55) return 'Passend';
    return 'Prüfen';
  };

  // Normalize skill names for comparison
  const normalizeSkill = (skill: string) => skill.toLowerCase().trim();
  const jobSkillsNormalized = jobSkills.map(normalizeSkill);
  const matchingSkills = skills.filter(skill => 
    jobSkillsNormalized.includes(normalizeSkill(skill))
  );
  const otherSkills = skills.filter(skill => 
    !jobSkillsNormalized.includes(normalizeSkill(skill))
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Match Score & Reasons Section */}
      {(matchScore || matchReasons.length > 0) && (
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 space-y-3">
            {/* Match Score Header */}
            {matchScore && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Matching</span>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full border text-sm font-bold",
                  getScoreColor(matchScore)
                )}>
                  {matchScore}% · {getScoreLabel(matchScore)}
                </div>
              </div>
            )}

            {/* Why this candidate fits */}
            {matchReasons.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Warum dieser Kandidat passt
                </p>
                <div className="space-y-1.5">
                  {matchReasons.slice(0, 4).map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risks (subtle) */}
            {matchRisks.length > 0 && (
              <div className="pt-2 border-t">
                <div className="space-y-1">
                  {matchRisks.slice(0, 2).map((risk, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <span>{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Facts */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {city && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{city}</span>
              </div>
            )}
            {expectedSalary && (
              <div className="flex items-center gap-2">
                <Euro className="h-4 w-4 text-muted-foreground" />
                <span>{formatSalary(expectedSalary)}</span>
              </div>
            )}
            {noticePeriod && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{noticePeriod}</span>
              </div>
            )}
            {availabilityDate && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Ab {format(new Date(availabilityDate), 'dd.MM.yyyy')}</span>
              </div>
            )}
          </div>
          {currentSalary && expectedSalary && currentSalary !== expectedSalary && (
            <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
              Aktuell: {formatSalary(currentSalary)} → Erwartet: {formatSalary(expectedSalary)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Experience */}
      {experiences.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Berufserfahrung</span>
            </div>
            <div className="space-y-3">
              {experiences.slice(0, 3).map((exp, idx) => (
                <div key={exp.id || idx} className="border-l-2 border-muted pl-3">
                  <p className="font-medium text-sm">{exp.job_title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span>{exp.company_name}</span>
                    <span>·</span>
                    <span>{formatExperienceDate(exp.start_date, exp.end_date, exp.is_current)}</span>
                  </div>
                </div>
              ))}
              {experiences.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  +{experiences.length - 3} weitere Positionen
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Education */}
      {educations.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Ausbildung</span>
            </div>
            <div className="space-y-2">
              {educations.slice(0, 2).map((edu, idx) => (
                <div key={edu.id || idx} className="border-l-2 border-muted pl-3">
                  <p className="font-medium text-sm">
                    {edu.degree}{edu.field_of_study ? ` in ${edu.field_of_study}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {edu.institution}
                    {edu.graduation_year && ` · ${edu.graduation_year}`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Kompetenzen</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* Matching skills first - highlighted */}
              {matchingSkills.map((skill, i) => (
                <Badge 
                  key={`match-${i}`} 
                  className="text-xs bg-green-100 text-green-800 border-green-200"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {skill}
                </Badge>
              ))}
              {/* Other skills */}
              {otherSkills.slice(0, 8).map((skill, i) => (
                <Badge key={`other-${i}`} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {otherSkills.length > 8 && (
                <Badge variant="outline" className="text-xs">
                  +{otherSkills.length - 8}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Change Motivation */}
      {changeMotivation && (
        <Card className="border-l-4 border-l-blue-400">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Wechselmotivation</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {changeMotivation}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

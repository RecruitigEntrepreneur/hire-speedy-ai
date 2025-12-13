import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Briefcase, 
  MapPin, 
  Calendar, 
  Star,
  Clock,
  Euro,
  Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DecisionCandidate {
  id: string;
  submissionId: string;
  name: string;
  currentRole: string;
  company?: string | null;
  jobTitle: string;
  matchScore: number | null;
  submittedAt: string;
  hoursInStage: number;
  // Extended fields for decision mode
  skills?: string[] | null;
  experienceYears?: number | null;
  cvAiBullets?: string[] | null;
  cvAiSummary?: string | null;
  noticePeriod?: string | null;
  availabilityDate?: string | null;
  exposeHighlights?: string[] | null;
  currentSalary?: number | null;
  expectedSalary?: number | null;
  city?: string | null;
}

interface DecisionCardProps {
  candidate: DecisionCandidate;
  isActive?: boolean;
}

export function DecisionCard({ candidate, isActive }: DecisionCardProps) {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatSalary = (salary: number | null | undefined) => {
    if (!salary) return null;
    return `${Math.round(salary / 1000)}k`;
  };

  const formatNoticePeriod = (period: string | null | undefined) => {
    if (!period) return null;
    const periodMap: Record<string, string> = {
      'immediate': 'Sofort verfügbar',
      '2_weeks': '2 Wochen',
      '1_month': '1 Monat',
      '2_months': '2 Monate',
      '3_months': '3 Monate',
      '6_months': '6 Monate',
    };
    return periodMap[period] || period;
  };

  const formatAvailability = (date: string | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Get bullet points for the short profile
  const bulletPoints = candidate.cvAiBullets?.slice(0, 4) || [];
  
  // Get top 5 skills
  const topSkills = candidate.skills?.slice(0, 5) || [];
  
  // Get interview highlights
  const highlights = candidate.exposeHighlights?.slice(0, 2) || [];

  return (
    <Card className={cn(
      "w-full max-w-lg mx-auto p-6 transition-all duration-300",
      isActive && "ring-2 ring-primary shadow-lg"
    )}>
      {/* Header with Avatar and Basic Info */}
      <div className="flex flex-col items-center text-center mb-6">
        <Avatar className="h-20 w-20 mb-4">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-medium">
            {getInitials(candidate.name)}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-semibold">{candidate.name}</h2>
        <p className="text-muted-foreground flex items-center gap-2 mt-1">
          <Briefcase className="h-4 w-4" />
          {candidate.currentRole}
          {candidate.experienceYears && (
            <span className="text-sm">• {candidate.experienceYears} Jahre</span>
          )}
        </p>
        {candidate.city && (
          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3" />
            {candidate.city}
          </p>
        )}
        
        {/* Match Score Badge */}
        {candidate.matchScore && (
          <Badge 
            variant="outline" 
            className={cn(
              "mt-3 text-sm",
              candidate.matchScore >= 80 && "border-green-500 bg-green-500/10 text-green-600",
              candidate.matchScore >= 60 && candidate.matchScore < 80 && "border-amber-500 bg-amber-500/10 text-amber-600",
              candidate.matchScore < 60 && "border-muted"
            )}
          >
            {candidate.matchScore}% Match für {candidate.jobTitle}
          </Badge>
        )}
      </div>

      <Separator className="my-4" />

      {/* Short Profile - AI Generated Bullet Points */}
      {bulletPoints.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-primary" />
            Kurzprofil
          </h3>
          <ul className="space-y-2">
            {bulletPoints.map((bullet, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary shrink-0">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* If no AI bullets, show summary */}
      {bulletPoints.length === 0 && candidate.cvAiSummary && (
        <div className="mb-5">
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-primary" />
            Kurzprofil
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-4">
            {candidate.cvAiSummary}
          </p>
        </div>
      )}

      {/* Professional Context */}
      <div className="mb-5">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4 text-primary" />
          Beruflicher Kontext
        </h3>
        <div className="text-sm space-y-1.5 text-muted-foreground">
          {candidate.company && (
            <p>Aktuell: <span className="text-foreground">{candidate.currentRole} @ {candidate.company}</span></p>
          )}
          {(candidate.currentSalary || candidate.expectedSalary) && (
            <p className="flex items-center gap-1">
              <Euro className="h-3 w-3" />
              {candidate.currentSalary && (
                <span>Aktuell {formatSalary(candidate.currentSalary)} </span>
              )}
              {candidate.expectedSalary && (
                <span className="text-foreground">→ Sucht {formatSalary(candidate.expectedSalary)}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Core Competencies */}
      {topSkills.length > 0 && (
        <div className="mb-5">
          <h3 className="text-sm font-medium mb-3">Kernkompetenzen</h3>
          <div className="flex flex-wrap gap-2">
            {topSkills.map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Availability */}
      <div className="mb-5">
        <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-primary" />
          Verfügbarkeit
        </h3>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          {formatNoticePeriod(candidate.noticePeriod) || 'Nicht angegeben'}
          {candidate.availabilityDate && (
            <span>• Ab {formatAvailability(candidate.availabilityDate)}</span>
          )}
        </div>
      </div>

      {/* Interview Highlights */}
      {highlights.length > 0 && (
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
            <Star className="h-4 w-4 text-amber-500" />
            Interview-Highlights
          </h3>
          <div className="space-y-2">
            {highlights.map((highlight, i) => (
              <p key={i} className="text-sm text-muted-foreground italic">
                "{highlight}"
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

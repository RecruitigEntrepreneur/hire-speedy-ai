import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Lock,
  Unlock,
  Star,
  Clock,
  Euro,
  Briefcase,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  FileText,
  Send,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { 
  anonymizeCandidate, 
  HIDDEN_FIELD_PLACEHOLDER,
  AnonymizedCandidate 
} from '@/lib/anonymization';

interface CandidateData {
  id: string;
  full_name: string;
  email: string;
  phone?: string | null;
  skills?: string[] | null;
  experience_years?: number | null;
  expected_salary?: number | null;
  current_salary?: number | null;
  availability_date?: string | null;
  notice_period?: string | null;
  cv_url?: string | null;
  linkedin_url?: string | null;
  summary?: string | null;
}

interface SubmissionData {
  id: string;
  identity_unlocked?: boolean;
  opt_in_requested_at?: string | null;
  opt_in_response?: string | null;
  match_score?: number | null;
}

interface AnonymizedCandidateCardProps {
  candidate: CandidateData;
  submission: SubmissionData;
  jobLocation?: string | null;
  onRequestOptIn?: () => void;
  onViewDetails?: () => void;
  isRequestingOptIn?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

export function AnonymizedCandidateCard({
  candidate,
  submission,
  jobLocation,
  onRequestOptIn,
  onViewDetails,
  isRequestingOptIn = false,
  showActions = true,
  compact = false,
}: AnonymizedCandidateCardProps) {
  const isUnlocked = submission.identity_unlocked;
  const isPending = submission.opt_in_response === 'pending';
  const isDenied = submission.opt_in_response === 'denied';
  
  const anonymized = anonymizeCandidate(
    candidate,
    submission.id,
    submission.match_score,
    jobLocation
  );

  if (isUnlocked) {
    // Show full candidate data
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className={compact ? 'p-4' : 'p-6'}>
          <div className="flex items-start gap-4">
            <Avatar className={compact ? 'h-10 w-10' : 'h-12 w-12'}>
              <AvatarFallback>
                {candidate.full_name.split(' ').map(n => n[0]).join('')}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
                  {candidate.full_name}
                </h3>
                <Badge variant="outline" className="text-emerald border-emerald/30">
                  <Unlock className="h-3 w-3 mr-1" />
                  Freigegeben
                </Badge>
                {submission.match_score && (
                  <Badge variant="secondary">
                    <Star className="h-3 w-3 mr-1" />
                    {submission.match_score}%
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {candidate.email}
                </span>
                {candidate.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {candidate.phone}
                  </span>
                )}
              </div>

              {!compact && (
                <>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {candidate.skills?.slice(0, 5).map((skill) => (
                      <Badge key={skill} variant="outline" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {(candidate.skills?.length || 0) > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{(candidate.skills?.length || 0) - 5}
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                    {candidate.experience_years && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Briefcase className="h-3 w-3" />
                        {candidate.experience_years} Jahre
                      </span>
                    )}
                    {candidate.expected_salary && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Euro className="h-3 w-3" />
                        €{candidate.expected_salary.toLocaleString()}
                      </span>
                    )}
                    {candidate.cv_url && (
                      <a 
                        href={candidate.cv_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        CV ansehen
                      </a>
                    )}
                    {candidate.linkedin_url && (
                      <a 
                        href={candidate.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Linkedin className="h-3 w-3" />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>

            {showActions && onViewDetails && (
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Eye className="h-4 w-4 mr-2" />
                Details
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show anonymized data
  return (
    <Card className="hover:shadow-md transition-shadow border-dashed">
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div className="flex items-start gap-4">
          <Avatar className={`${compact ? 'h-10 w-10' : 'h-12 w-12'} bg-muted`}>
            <AvatarFallback className="bg-muted text-muted-foreground">
              <Lock className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${compact ? 'text-sm' : 'text-base'}`}>
                {anonymized.anonymousId}
              </h3>
              <Badge variant="secondary" className="text-muted-foreground">
                <EyeOff className="h-3 w-3 mr-1" />
                Anonymisiert
              </Badge>
              {anonymized.matchScore && (
                <Badge variant="secondary">
                  <Star className="h-3 w-3 mr-1" />
                  {anonymized.matchScore}%
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {anonymized.experienceRange}
              </span>
              <span className="flex items-center gap-1">
                <Euro className="h-3 w-3" />
                {anonymized.salaryExpectation}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {anonymized.region}
              </span>
            </div>

            {!compact && (
              <div className="flex flex-wrap gap-2 mt-3">
                {anonymized.skills.slice(0, 5).map((skill) => (
                  <Badge key={skill} variant="outline" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {anonymized.skills.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{anonymized.skills.length - 5}
                  </Badge>
                )}
              </div>
            )}

            {!compact && (
              <div className="mt-3 p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                <Lock className="h-3 w-3 inline mr-1" />
                Name, E-Mail, CV und LinkedIn sind bis zur Opt-In-Bestätigung verborgen
              </div>
            )}

            {isPending && (
              <div className="mt-3 p-2 rounded bg-amber-500/10 text-xs text-amber-600">
                <Clock className="h-3 w-3 inline mr-1" />
                Opt-In Anfrage gesendet - Warte auf Antwort des Kandidaten
              </div>
            )}

            {isDenied && (
              <div className="mt-3 p-2 rounded bg-destructive/10 text-xs text-destructive">
                <EyeOff className="h-3 w-3 inline mr-1" />
                Kandidat hat die Freigabe abgelehnt
              </div>
            )}
          </div>

          {showActions && !isPending && !isDenied && onRequestOptIn && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRequestOptIn}
              disabled={isRequestingOptIn}
            >
              {isRequestingOptIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Opt-In anfragen
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

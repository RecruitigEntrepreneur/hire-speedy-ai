import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  MessageSquare, 
  Star, 
  X, 
  CheckCircle2,
  MapPin,
  Briefcase,
  Clock,
  Banknote,
  Monitor,
  AlertTriangle,
  TrendingUp,
  Lock,
  Eye,
  EyeOff,
  Shield
} from 'lucide-react';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';
import { generateAnonymousId, anonymizeRegion, anonymizeExperience, HIDDEN_FIELD_PLACEHOLDER } from '@/lib/anonymization';

interface HardFacts {
  role_seniority: string;
  top_skills: string[];
  location_commute: string;
  work_model: string;
  salary_range: string;
  availability: string;
}

interface CandidateExposeProps {
  candidateId: string;
  submissionId: string;
  candidateName: string;
  isAnonymized?: boolean;
  identityUnlocked?: boolean;
  currentRole: string;
  matchScore: number;
  dealProbability: number;
  dealHealthScore?: number;
  dealHealthRisk?: string;
  dealHealthReason?: string;
  status: string;
  executiveSummary: string[];
  hardFacts: HardFacts;
  experienceYears?: number;
  onRequestInterview: () => void;
  onReject: () => void;
  onAskQuestion: () => void;
  onBookmark: () => void;
  isBookmarked?: boolean;
  className?: string;
}

export function CandidateExpose({
  candidateId,
  submissionId,
  candidateName,
  isAnonymized = true,
  identityUnlocked = false,
  currentRole,
  matchScore,
  dealProbability,
  dealHealthScore,
  dealHealthRisk = 'low',
  dealHealthReason,
  status,
  executiveSummary,
  hardFacts,
  experienceYears,
  onRequestInterview,
  onReject,
  onAskQuestion,
  onBookmark,
  isBookmarked = false,
  className
}: CandidateExposeProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  // Triple-Blind: Use anonymous ID until identity is unlocked
  const showIdentity = identityUnlocked && !isAnonymized;
  const displayName = showIdentity ? candidateName : generateAnonymousId(submissionId);
  
  // Anonymize location for triple-blind mode
  const displayLocation = showIdentity 
    ? hardFacts.location_commute 
    : anonymizeRegion(hardFacts.location_commute);
    
  // Show experience range instead of exact years when anonymized
  const displayExperience = showIdentity 
    ? hardFacts.role_seniority 
    : anonymizeExperience(experienceYears || null);

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 dark:text-yellow-400';
    return 'text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-400';
  };

  const getDealProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600 dark:text-green-400';
    if (probability >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      new: { variant: 'default', label: 'Neu' },
      accepted: { variant: 'secondary', label: 'Akzeptiert' },
      interview: { variant: 'outline', label: 'Interview' },
      offer: { variant: 'outline', label: 'Angebot' },
      rejected: { variant: 'destructive', label: 'Abgelehnt' },
      hired: { variant: 'default', label: 'Eingestellt' }
    };
    const config = statusConfig[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Triple-Blind Badge */}
      {!showIdentity && (
        <div className="bg-primary/5 border-b border-primary/10 px-4 py-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">
            Triple-Blind Mode – Identität geschützt bis Opt-In
          </span>
        </div>
      )}

      {/* Header Section */}
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground truncate">{displayName}</h3>
              {!showIdentity && (
                <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">{currentRole}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getStatusBadge(status)}
          </div>
        </div>

        {/* Score Row - Always visible */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${getMatchScoreColor(matchScore)}`}>
            Match: {matchScore}%
          </div>
          <div className="flex items-center gap-1.5">
            <TrendingUp className={`h-4 w-4 ${getDealProbabilityColor(dealProbability)}`} />
            <span className={`text-sm font-medium ${getDealProbabilityColor(dealProbability)}`}>
              Deal: {dealProbability}%
            </span>
          </div>
          {dealHealthScore !== undefined && (
            <DealHealthBadge 
              score={dealHealthScore} 
              riskLevel={dealHealthRisk as 'low' | 'medium' | 'high' | 'critical'} 
            />
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="pt-4 space-y-5">
        {/* Executive Summary - Always visible (AI-anonymized) */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Warum dieser Kandidat passt
          </h4>
          <ul className="space-y-1.5">
            {executiveSummary.slice(0, 5).map((point, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Hard Facts Grid - Partially anonymized */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            Hard Facts
            {!showIdentity && (
              <Badge variant="outline" className="text-xs font-normal">
                <EyeOff className="h-3 w-3 mr-1" />
                Anonymisiert
              </Badge>
            )}
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Experience - Show range when anonymized */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Briefcase className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Erfahrung</span>
              </div>
              <p className="text-sm font-medium text-foreground">{displayExperience}</p>
            </div>

            {/* Skills - Always visible */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Monitor className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Top Skills</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {hardFacts.top_skills.slice(0, 3).join(', ')}
              </p>
            </div>

            {/* Location - Show region only when anonymized */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Region</span>
              </div>
              <p className="text-sm font-medium text-foreground">{displayLocation}</p>
            </div>

            {/* Work Model - Always visible */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Monitor className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Arbeitsmodell</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.work_model}</p>
            </div>

            {/* Salary Range - Always visible as range */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Banknote className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Gehalt</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.salary_range}</p>
            </div>

            {/* Availability - Always visible */}
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Verfügbarkeit</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.availability}</p>
            </div>
          </div>
        </div>

        {/* Hidden Fields Notice */}
        {!showIdentity && (
          <div className="bg-muted/30 border border-border/50 rounded-lg p-3 flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Identität geschützt</p>
              <p className="text-xs text-muted-foreground">
                Name, E-Mail, Telefon und Firmenhistorie werden nach Opt-In sichtbar
              </p>
            </div>
          </div>
        )}

        {/* Deal Health Reason */}
        {dealHealthReason && dealHealthRisk !== 'low' && (
          <div className={`p-3 rounded-lg flex items-start gap-2 ${
            dealHealthRisk === 'critical' ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200' :
            dealHealthRisk === 'high' ? 'bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200' :
            'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
          }`}>
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p className="text-sm">{dealHealthReason}</p>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex items-center gap-2 pt-2">
          <Button 
            onClick={() => {
              setIsProcessing(true);
              onRequestInterview();
              setTimeout(() => setIsProcessing(false), 500);
            }}
            disabled={isProcessing}
            className="flex-1"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {showIdentity ? 'Interview planen' : 'Interview anfragen'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={onReject}
            size="icon"
          >
            <X className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={onAskQuestion}
            size="icon"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            onClick={onBookmark}
            size="icon"
            className={isBookmarked ? 'text-yellow-500' : ''}
          >
            <Star className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

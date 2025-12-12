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
  TrendingUp
} from 'lucide-react';
import { DealHealthBadge } from '@/components/health/DealHealthBadge';

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
  candidateName: string;
  isAnonymized?: boolean;
  currentRole: string;
  matchScore: number;
  dealProbability: number;
  dealHealthScore?: number;
  dealHealthRisk?: string;
  dealHealthReason?: string;
  status: string;
  executiveSummary: string[];
  hardFacts: HardFacts;
  onRequestInterview: () => void;
  onReject: () => void;
  onAskQuestion: () => void;
  onBookmark: () => void;
  isBookmarked?: boolean;
  className?: string;
}

export function CandidateExpose({
  candidateName,
  isAnonymized = false,
  currentRole,
  matchScore,
  dealProbability,
  dealHealthScore,
  dealHealthRisk = 'low',
  dealHealthReason,
  status,
  executiveSummary,
  hardFacts,
  onRequestInterview,
  onReject,
  onAskQuestion,
  onBookmark,
  isBookmarked = false,
  className
}: CandidateExposeProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getDealProbabilityColor = (probability: number) => {
    if (probability >= 70) return 'text-green-600';
    if (probability >= 40) return 'text-yellow-600';
    return 'text-red-600';
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

  const displayName = isAnonymized ? 'Kandidat (anonymisiert)' : candidateName;

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Header Section */}
      <CardHeader className="pb-3 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground truncate">{displayName}</h3>
            <p className="text-sm text-muted-foreground">{currentRole}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {getStatusBadge(status)}
          </div>
        </div>

        {/* Score Row */}
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
        {/* Executive Summary */}
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

        {/* Hard Facts Grid */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">Hard Facts</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Briefcase className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Rolle & Erfahrung</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.role_seniority}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Monitor className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Top Skills</span>
              </div>
              <p className="text-sm font-medium text-foreground">
                {hardFacts.top_skills.slice(0, 3).join(', ')}
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Standort</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.location_commute}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Monitor className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Arbeitsmodell</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.work_model}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Banknote className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Gehalt</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.salary_range}</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Verfügbarkeit</span>
              </div>
              <p className="text-sm font-medium text-foreground">{hardFacts.availability}</p>
            </div>
          </div>
        </div>

        {/* Deal Health Reason */}
        {dealHealthReason && dealHealthRisk !== 'low' && (
          <div className={`p-3 rounded-lg flex items-start gap-2 ${
            dealHealthRisk === 'critical' ? 'bg-red-50 text-red-800' :
            dealHealthRisk === 'high' ? 'bg-orange-50 text-orange-800' :
            'bg-yellow-50 text-yellow-800'
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
            Interview anfragen
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

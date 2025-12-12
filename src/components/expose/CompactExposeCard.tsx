import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Calendar, 
  X, 
  MessageSquare, 
  Lock,
  TrendingUp,
  Clock,
  MapPin,
  Briefcase
} from 'lucide-react';
import { generateAnonymousId, anonymizeExperience, anonymizeRegion } from '@/lib/anonymization';

interface CompactExposeCardProps {
  submissionId: string;
  currentRole: string;
  matchScore: number;
  dealProbability: number;
  topSkills: string[];
  experienceYears?: number;
  location?: string;
  workModel?: string;
  availability?: string;
  onRequestInterview: () => void;
  onReject: () => void;
  onAskQuestion: () => void;
}

export function CompactExposeCard({
  submissionId,
  currentRole,
  matchScore,
  dealProbability,
  topSkills,
  experienceYears,
  location,
  workModel,
  availability,
  onRequestInterview,
  onReject,
  onAskQuestion
}: CompactExposeCardProps) {
  const anonymousId = generateAnonymousId(submissionId);
  const experienceRange = anonymizeExperience(experienceYears || null);
  const regionDisplay = anonymizeRegion(location || null);

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <TooltipProvider>
      <Card className="hover:shadow-md hover:border-primary/30 transition-all group">
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="font-semibold text-sm truncate">{anonymousId}</h4>
              </div>
              <p className="text-xs text-muted-foreground truncate">{currentRole}</p>
            </div>
            
            {/* Match Score Indicator */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${getMatchScoreColor(matchScore)}`}>
                  {matchScore}%
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Match-Score: {matchScore}%</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Deal Probability */}
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Deal:</span>
            <span className="text-xs font-medium">{dealProbability}%</span>
          </div>

          {/* Skills */}
          <div className="flex flex-wrap gap-1 mb-3">
            {topSkills.slice(0, 3).map((skill, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs px-1.5 py-0">
                {skill}
              </Badge>
            ))}
            {topSkills.length > 3 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0">
                +{topSkills.length - 3}
              </Badge>
            )}
          </div>

          {/* Quick Facts - Shown on hover */}
          <div className="hidden group-hover:block space-y-1 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3 w-3" />
              <span>{experienceRange}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              <span>{regionDisplay}</span>
            </div>
            {availability && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>{availability}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <Button 
              size="sm" 
              className="flex-1 h-8 text-xs"
              onClick={onRequestInterview}
            >
              <Calendar className="h-3.5 w-3.5 mr-1" />
              Interview
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="h-8 w-8"
                  onClick={onReject}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ablehnen</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="h-8 w-8"
                  onClick={onAskQuestion}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rückfrage</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
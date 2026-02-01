import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Calendar,
  ThumbsDown, 
  Clock,
  MapPin,
  Briefcase,
  Video,
  Star,
  ChevronRight,
  Flame,
  CircleCheck,
  HelpCircle,
  EyeOff
} from 'lucide-react';
import { formatDistanceToNow, format, isToday, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES } from '@/hooks/useHiringPipeline';
import { ProfessionalInterviewWizard } from '@/components/dialogs/interview-wizard';
import { QuickFeedbackInline } from './QuickFeedbackInline';

interface InterviewDetails {
  scheduledAt: Date;
  durationMinutes: number;
  meetingType: 'video' | 'phone' | 'onsite';
  meetingLink?: string;
  notes?: string;
}

export interface CandidateActionCardProps {
  id: string;
  submissionId: string;
  name: string; // Now anonymous ID like PR-A7FA2C
  currentRole: string;
  jobId: string;
  jobTitle: string;
  stage: string;
  status: string;
  matchScore: number | null;
  matchPolicy?: string | null; // V3.1 policy: hot, standard, maybe, hidden
  submittedAt: string;
  hoursInStage: number;
  company?: string;
  city?: string;
  skills?: string[];
  experienceYears?: number;
  interview?: {
    id: string;
    scheduled_at: string | null;
    status: string | null;
    meeting_link: string | null;
  } | null;
  feedbackPending?: boolean;
}

interface CardProps {
  candidate: CandidateActionCardProps;
  isSelected?: boolean;
  onSelect: () => void;
  onMove: (submissionId: string, newStage: string) => void;
  onReject: (submissionId: string) => void;
  onInterviewRequest?: (submissionId: string, details: InterviewDetails) => Promise<void>;
  onFeedback?: (submissionId: string, rating: 'positive' | 'neutral' | 'negative', note?: string) => Promise<void>;
  isProcessing?: boolean;
}

// V3.1 Policy configuration
const POLICY_CONFIG = {
  hot: {
    label: 'Hot',
    icon: Flame,
    className: 'bg-green-500 text-white border-green-600',
    ringColor: 'border-green-500',
    textColor: 'text-green-600'
  },
  standard: {
    label: 'Standard',
    icon: CircleCheck,
    className: 'bg-blue-500 text-white border-blue-600',
    ringColor: 'border-blue-500',
    textColor: 'text-blue-600'
  },
  maybe: {
    label: 'Prüfen',
    icon: HelpCircle,
    className: 'bg-amber-500 text-white border-amber-600',
    ringColor: 'border-amber-500',
    textColor: 'text-amber-600'
  },
  hidden: {
    label: 'Nicht geeignet',
    icon: EyeOff,
    className: 'bg-muted text-muted-foreground border-muted',
    ringColor: 'border-muted',
    textColor: 'text-muted-foreground'
  }
};

export function CandidateActionCard({
  candidate,
  isSelected,
  onSelect,
  onMove,
  onReject,
  onInterviewRequest,
  onFeedback,
  isProcessing
}: CardProps) {
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const getInitials = (name: string) => {
    // For anonymous IDs like PR-A7FA2C, use first 2 chars after prefix
    if (name.startsWith('PR-')) {
      return name.slice(3, 5).toUpperCase();
    }
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getNextStage = (currentStage: string) => {
    const stages = ['submitted', 'interview_1', 'interview_2', 'offer', 'hired'];
    const currentIndex = stages.indexOf(currentStage);
    return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null;
  };

  const nextStage = getNextStage(candidate.stage);
  const isUrgent = candidate.hoursInStage >= 48;
  const isWarning = candidate.hoursInStage >= 24 && candidate.hoursInStage < 48;

  // Get policy configuration (fallback based on score if no policy)
  const getPolicy = () => {
    if (candidate.matchPolicy && POLICY_CONFIG[candidate.matchPolicy as keyof typeof POLICY_CONFIG]) {
      return POLICY_CONFIG[candidate.matchPolicy as keyof typeof POLICY_CONFIG];
    }
    // Fallback to score-based policy
    const score = candidate.matchScore || 0;
    if (score >= 75) return POLICY_CONFIG.hot;
    if (score >= 55) return POLICY_CONFIG.standard;
    if (score >= 35) return POLICY_CONFIG.maybe;
    return POLICY_CONFIG.hidden;
  };

  const policy = getPolicy();
  const PolicyIcon = policy.icon;

  // Check for interview status
  const hasInterviewToday = candidate.interview?.scheduled_at && 
    isToday(new Date(candidate.interview.scheduled_at)) && 
    candidate.interview.status !== 'completed';
  
  const hasPastInterview = candidate.interview?.scheduled_at && 
    isPast(new Date(candidate.interview.scheduled_at)) && 
    candidate.interview.status !== 'completed';

  const needsFeedback = hasPastInterview || candidate.feedbackPending;

  const handleInterviewRequest = async (details: InterviewDetails) => {
    if (onInterviewRequest) {
      await onInterviewRequest(candidate.submissionId, details);
    }
    setShowInterviewDialog(false);
  };

  const handleFeedback = async (rating: 'positive' | 'neutral' | 'negative', note?: string) => {
    if (onFeedback) {
      await onFeedback(candidate.submissionId, rating, note);
    }
    setShowFeedback(false);
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all hover:shadow-lg hover:border-primary/40 relative",
        isSelected && "ring-2 ring-primary border-primary",
        isUrgent && "border-l-4 border-l-destructive",
        isWarning && !isUrgent && "border-l-4 border-l-amber-500"
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        {/* Header: Avatar + Anonymous ID + Policy Badge */}
        <div className="flex items-start gap-3 mb-3">
          <div className="relative">
            <Avatar className={cn(
              "h-12 w-12 border-2 shadow-sm",
              policy.ringColor
            )}>
              <AvatarFallback className="bg-primary text-primary-foreground font-medium">
                {getInitials(candidate.name)}
              </AvatarFallback>
            </Avatar>
            {/* Score Ring with Policy Color */}
            {candidate.matchScore !== null && (
              <div className={cn(
                "absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 bg-background flex items-center justify-center text-xs font-bold shadow-sm",
                policy.ringColor
              )}>
                <span className={cn("text-[10px]", policy.textColor)}>
                  {candidate.matchScore}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Anonymous ID + Policy Badge */}
            <div className="flex items-center gap-2">
              <p className="font-mono font-semibold text-sm">{candidate.name}</p>
              <Badge className={cn("text-[10px] h-5 gap-1", policy.className)}>
                <PolicyIcon className="h-3 w-3" />
                {policy.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {candidate.currentRole}
            </p>
            {/* Position/Job */}
            <p className="text-[10px] text-primary/70 font-medium truncate mt-0.5">
              → {candidate.jobTitle}
            </p>
            {/* Location & Experience */}
            <div className="flex items-center gap-2 mt-1">
              {candidate.city && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {candidate.city}
                </span>
              )}
              {candidate.experienceYears && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                  <Briefcase className="h-2.5 w-2.5" />
                  {candidate.experienceYears}J
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Skills Badges */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {candidate.skills.slice(0, 3).map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                {skill}
              </Badge>
            ))}
            {candidate.skills.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-muted-foreground">
                +{candidate.skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Time in Stage & Interview Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className={cn(
            "flex items-center gap-1 text-[11px]",
            isUrgent && "text-destructive font-medium",
            isWarning && "text-amber-600"
          )}>
            <Clock className="h-3 w-3" />
            <span>{formatDistanceToNow(new Date(candidate.submittedAt), { locale: de })}</span>
          </div>
          
          {/* Interview Status Badge */}
          {hasInterviewToday && candidate.interview?.scheduled_at && (
            <Badge className="text-[10px] h-5 bg-blue-500 hover:bg-blue-600">
              <Video className="h-2.5 w-2.5 mr-1" />
              {format(new Date(candidate.interview.scheduled_at), 'HH:mm')}
            </Badge>
          )}
          {needsFeedback && !hasInterviewToday && (
            <Badge variant="outline" className="text-[10px] h-5 border-amber-400 text-amber-600 animate-pulse">
              <Star className="h-2.5 w-2.5 mr-1" />
              Feedback
            </Badge>
          )}
        </div>

        {/* Quick Feedback Inline (shows when feedback is pending) */}
        {showFeedback && needsFeedback && (
          <QuickFeedbackInline
            onSubmit={handleFeedback}
            onCancel={() => setShowFeedback(false)}
          />
        )}

        {/* Action Buttons - 2-Column Layout */}
        {candidate.stage !== 'hired' && !showFeedback && (
          <div 
            className="pt-3 border-t"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Feedback Button (if pending) */}
            {needsFeedback && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 mb-2 text-xs border-amber-400 text-amber-600 hover:bg-amber-50"
                onClick={() => setShowFeedback(true)}
                disabled={isProcessing}
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                Feedback geben
              </Button>
            )}
            
            {/* Main Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(candidate.stage === 'submitted' || candidate.stage === 'interview_1') ? (
                <>
                  <Button
                    size="sm"
                    className="h-9 w-full text-xs"
                    disabled={isProcessing}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowInterviewDialog(true);
                    }}
                  >
                    <Calendar className="h-3.5 w-3.5 mr-1" />
                    {candidate.stage === 'submitted' ? 'Interview 1' : 'Interview 2'}
                  </Button>
                  <ProfessionalInterviewWizard
                    open={showInterviewDialog}
                    onOpenChange={setShowInterviewDialog}
                    submissionId={candidate.submissionId}
                    candidateAnonymousId={candidate.name}
                    jobTitle={candidate.jobTitle}
                    onSuccess={() => {
                      setShowInterviewDialog(false);
                      // Trigger refresh via parent if needed
                    }}
                  />
                </>
              ) : (
                <Button
                  size="sm"
                  className="h-9 w-full text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => nextStage && onMove(candidate.submissionId, nextStage)}
                  disabled={isProcessing || !nextStage}
                >
                  <ChevronRight className="h-3.5 w-3.5 mr-1" />
                  {candidate.stage === 'interview_2' ? 'Angebot' : 'Einstellen'}
                </Button>
              )}

              {/* Reject */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => onReject(candidate.submissionId)}
                disabled={isProcessing}
              >
                <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                Absage
              </Button>
            </div>
          </div>
        )}

        {/* Meeting Link Button for today's interview */}
        {hasInterviewToday && candidate.interview?.meeting_link && (
          <Button
            variant="default"
            size="sm"
            className="w-full mt-2 h-8 text-xs bg-blue-500 hover:bg-blue-600"
            onClick={(e) => {
              e.stopPropagation();
              window.open(candidate.interview!.meeting_link!, '_blank');
            }}
          >
            <Video className="h-3.5 w-3.5 mr-1" />
            Meeting beitreten
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

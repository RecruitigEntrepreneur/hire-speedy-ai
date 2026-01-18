import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Video, Phone, MapPin, Clock, Calendar, 
  ExternalLink, MoreHorizontal, Edit, XCircle, 
  CheckCircle, MessageSquarePlus, User, Star,
  UserX, CalendarClock, AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { format, differenceInHours, differenceInMinutes, isToday, isTomorrow, isPast } from 'date-fns';
import { de } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  notes: string | null;
  feedback: string | null;
  submission: {
    id: string;
    candidate: {
      full_name: string;
      email: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
}

interface ModernInterviewCardProps {
  interview: Interview;
  onEdit: (interview: Interview) => void;
  onComplete: (interview: Interview, hired: boolean) => void;
  onFeedback: (interview: Interview) => void;
  onNoShow?: (interview: Interview, type: 'candidate' | 'client') => void;
  onQuickReschedule?: (interview: Interview) => void;
  processing?: boolean;
}

export function ModernInterviewCard({ 
  interview, 
  onEdit, 
  onComplete, 
  onFeedback,
  onNoShow,
  onQuickReschedule,
  processing 
}: ModernInterviewCardProps) {
  const navigate = useNavigate();
  const scheduledDate = interview.scheduled_at ? new Date(interview.scheduled_at) : null;
  const [quickRating, setQuickRating] = useState<number | null>(null);
  const [isHoveringStars, setIsHoveringStars] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  
  const timeInfo = useMemo(() => {
    if (!scheduledDate) return { label: 'Nicht geplant', color: 'text-muted-foreground', urgent: false };
    
    const now = new Date();
    const minutesUntil = differenceInMinutes(scheduledDate, now);
    const hoursUntil = differenceInHours(scheduledDate, now);
    
    if (isPast(scheduledDate)) {
      return { label: 'Vergangen', color: 'text-muted-foreground', urgent: false };
    }
    
    if (minutesUntil <= 60) {
      return { 
        label: `In ${minutesUntil} Min`, 
        color: 'text-emerald-600', 
        urgent: true,
        pulse: minutesUntil <= 15
      };
    }
    
    if (isToday(scheduledDate)) {
      return { 
        label: `Heute ${format(scheduledDate, 'HH:mm')}`, 
        color: 'text-primary', 
        urgent: hoursUntil <= 2 
      };
    }
    
    if (isTomorrow(scheduledDate)) {
      return { 
        label: `Morgen ${format(scheduledDate, 'HH:mm')}`, 
        color: 'text-muted-foreground', 
        urgent: false 
      };
    }
    
    return { 
      label: format(scheduledDate, 'EEE d. MMM, HH:mm', { locale: de }), 
      color: 'text-muted-foreground', 
      urgent: false 
    };
  }, [scheduledDate]);

  const meetingConfig = useMemo(() => {
    const configs: Record<string, { icon: typeof Video; label: string; gradient: string; iconColor: string }> = {
      video: { 
        icon: Video, 
        label: 'Video', 
        gradient: 'from-blue-500/10 to-blue-600/5',
        iconColor: 'text-blue-600'
      },
      phone: { 
        icon: Phone, 
        label: 'Telefon', 
        gradient: 'from-green-500/10 to-green-600/5',
        iconColor: 'text-green-600'
      },
      onsite: { 
        icon: MapPin, 
        label: 'Vor Ort', 
        gradient: 'from-orange-500/10 to-orange-600/5',
        iconColor: 'text-orange-600'
      },
      teams: { 
        icon: Video, 
        label: 'Teams', 
        gradient: 'from-purple-500/10 to-purple-600/5',
        iconColor: 'text-purple-600'
      },
      meet: { 
        icon: Video, 
        label: 'Google Meet', 
        gradient: 'from-red-500/10 to-red-600/5',
        iconColor: 'text-red-600'
      },
    };
    return configs[interview.meeting_type || 'video'] || configs.video;
  }, [interview.meeting_type]);

  const statusConfig = useMemo(() => {
    const configs: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Ausstehend', variant: 'outline' },
      scheduled: { label: 'Geplant', variant: 'default' },
      completed: { label: 'Abgeschlossen', variant: 'secondary' },
      cancelled: { label: 'Abgesagt', variant: 'destructive' },
    };
    return configs[interview.status || 'pending'] || configs.pending;
  }, [interview.status]);

  const initials = interview.submission.candidate.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isPastInterview = interview.status === 'completed' || interview.status === 'cancelled';
  const needsFeedback = interview.status === 'completed' && !interview.feedback;
  const MeetingIcon = meetingConfig.icon;

  const handleViewProfile = () => {
    // Navigate to candidate profile (using submission's candidate info)
    navigate(`/dashboard/candidates`);
  };

  const handleQuickRating = (rating: number) => {
    setQuickRating(rating);
    // In production, this would save to DB
    onFeedback(interview);
  };

  return (
    <div 
      className={`
        glass-card rounded-xl overflow-hidden
        transition-all duration-300
        hover:shadow-lg hover:border-primary/30
        ${timeInfo.urgent ? 'border-l-4 border-l-emerald-500' : ''}
        ${needsFeedback ? 'border-l-4 border-l-amber-500 ring-1 ring-amber-500/20' : ''}
        ${isPastInterview ? 'opacity-75 hover:opacity-100' : ''}
      `}
    >
      <div className="p-5">
        {/* Header: Time & Status */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {timeInfo.pulse && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
            <span className={`text-sm font-semibold ${timeInfo.color}`}>
              {timeInfo.label}
            </span>
            {scheduledDate && !isPastInterview && (
              <span className="text-xs text-muted-foreground">
                • {interview.duration_minutes || 60} Min
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
            {/* View Profile Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleViewProfile}
                  >
                    <User className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Profil ansehen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-4">
          {/* Avatar */}
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-lg 
            bg-gradient-to-br ${meetingConfig.gradient}
            flex items-center justify-center
            font-semibold text-sm ${meetingConfig.iconColor}
          `}>
            {initials}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {interview.submission.candidate.full_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {interview.submission.job.title}
            </p>
            
            {/* Meeting Type Badge & Clickable Time */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`
                inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full
                bg-gradient-to-r ${meetingConfig.gradient}
                ${meetingConfig.iconColor}
              `}>
                <MeetingIcon className="h-3 w-3" />
                {meetingConfig.label}
              </span>
              
              {/* Clickable Time - Opens Edit Dialog */}
              {scheduledDate && !isPastInterview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(interview)}
                  className={cn(
                    "h-auto py-1 px-2 gap-1.5 text-xs text-muted-foreground",
                    "hover:text-primary hover:bg-primary/5 group"
                  )}
                >
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(scheduledDate, "EEEE, d. MMM 'um' HH:mm", { locale: de })} Uhr
                  </span>
                  <Edit className="h-3 w-3 opacity-0 group-hover:opacity-70 transition-opacity" />
                </Button>
              )}

              {scheduledDate && isPastInterview && (
                <span className="text-xs text-muted-foreground">
                  {format(scheduledDate, 'HH:mm', { locale: de })} Uhr
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Feedback Warning with Quick Rating for past interviews */}
        {needsFeedback && (
          <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <MessageSquarePlus className="h-4 w-4" />
                  <span className="text-sm font-medium">Feedback ausstehend</span>
                </div>
              </div>
              
              {/* Quick Star Rating */}
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center gap-1"
                  onMouseEnter={() => setIsHoveringStars(true)}
                  onMouseLeave={() => {
                    setIsHoveringStars(false);
                    setHoveredStar(0);
                  }}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-0.5 transition-transform hover:scale-110"
                      onClick={() => handleQuickRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                    >
                      <Star
                        className={cn(
                          "h-5 w-5 transition-colors",
                          (isHoveringStars ? hoveredStar >= star : quickRating && quickRating >= star)
                            ? "text-amber-500 fill-amber-500"
                            : "text-amber-300"
                        )}
                      />
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">Quick-Rating</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                  onClick={() => onFeedback(interview)}
                >
                  Detailliert
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2">
            {/* Primary action: Join meeting if available */}
            {interview.meeting_link && !isPastInterview && (
              <Button size="sm" className="gap-1.5" asChild>
                <a href={interview.meeting_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Beitreten
                </a>
              </Button>
            )}
            
            {/* Edit button */}
            {!isPastInterview && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onEdit(interview)}
                className="gap-1.5"
              >
                <Edit className="h-3.5 w-3.5" />
                Bearbeiten
              </Button>
            )}

            {/* Feedback button for completed without feedback */}
            {interview.status === 'completed' && interview.feedback && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Feedback vorhanden
              </Badge>
            )}
          </div>

          {/* Overflow menu */}
          {!isPastInterview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleViewProfile}>
                  <User className="h-4 w-4 mr-2" />
                  Profil ansehen
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(interview)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Bearbeiten
                </DropdownMenuItem>
                {onQuickReschedule && (
                  <DropdownMenuItem onClick={() => onQuickReschedule(interview)}>
                    <CalendarClock className="h-4 w-4 mr-2" />
                    Verschieben
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => onComplete(interview, true)}
                  disabled={processing}
                  className="text-emerald-600"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Einstellen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {onNoShow && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      No-Show melden
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => onNoShow(interview, 'candidate')}>
                        <UserX className="h-4 w-4 mr-2" />
                        Kandidat nicht erschienen
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onNoShow(interview, 'client')}>
                        <UserX className="h-4 w-4 mr-2" />
                        Kunde nicht erschienen
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuItem 
                  onClick={() => onComplete(interview, false)}
                  disabled={processing}
                  className="text-destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Absagen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

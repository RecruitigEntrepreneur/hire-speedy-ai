import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Phone, MapPin, ExternalLink, User, Clock } from 'lucide-react';
import { format, differenceInMinutes, differenceInSeconds } from 'date-fns';
import { de } from 'date-fns/locale';

interface Interview {
  id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_type: string | null;
  meeting_link: string | null;
  status: string | null;
  submission: {
    candidate: {
      full_name: string;
    };
    job: {
      title: string;
      company_name: string;
    };
  };
}

interface NextInterviewBannerProps {
  interviews: Interview[];
  onViewProfile?: (interview: Interview) => void;
  onReschedule?: (interview: Interview) => void;
}

export function NextInterviewBanner({ interviews, onViewProfile, onReschedule }: NextInterviewBannerProps) {
  const [now, setNow] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const nextInterview = useMemo(() => {
    const upcoming = interviews
      .filter(i => 
        i.scheduled_at && 
        i.status !== 'completed' && 
        i.status !== 'cancelled' &&
        new Date(i.scheduled_at) > now
      )
      .sort((a, b) => 
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()
      );
    
    return upcoming[0] || null;
  }, [interviews, now]);

  if (!nextInterview || !nextInterview.scheduled_at) return null;

  const scheduledTime = new Date(nextInterview.scheduled_at);
  const minutesUntil = differenceInMinutes(scheduledTime, now);
  const isUrgent = minutesUntil <= 30;
  const isVeryUrgent = minutesUntil <= 15;

  const getMeetingIcon = (type: string | null) => {
    switch (type) {
      case 'video': return <Video className="h-5 w-5" />;
      case 'phone': return <Phone className="h-5 w-5" />;
      case 'onsite': return <MapPin className="h-5 w-5" />;
      default: return <Video className="h-5 w-5" />;
    }
  };

  const getMeetingLabel = (type: string | null) => {
    switch (type) {
      case 'video': return 'Video-Interview';
      case 'phone': return 'Telefon-Interview';
      case 'onsite': return 'Vor-Ort-Interview';
      default: return 'Interview';
    }
  };

  const formatTimeUntil = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} Min`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} Std`;
    }
    return `${hours} Std ${remainingMinutes} Min`;
  };

  return (
    <div 
      className={`
        relative overflow-hidden rounded-xl p-5
        bg-gradient-to-r from-navy to-navy-dark
        text-primary-foreground
        shadow-lg shadow-navy/20
        ${isVeryUrgent ? 'ring-2 ring-amber-400 animate-pulse-slow' : ''}
      `}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-400 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Info */}
        <div className="flex items-start gap-4">
          {/* Pulsing indicator */}
          <div className="relative flex-shrink-0">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center
              ${isUrgent ? 'bg-amber-500' : 'bg-primary/20'}
            `}>
              {getMeetingIcon(nextInterview.meeting_type)}
            </div>
            {isUrgent && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`
                text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                ${isVeryUrgent ? 'bg-amber-500 text-amber-950' : 
                  isUrgent ? 'bg-amber-500/20 text-amber-200' : 
                  'bg-primary-foreground/10 text-primary-foreground/80'}
              `}>
                <Clock className="inline h-3 w-3 mr-1" />
                In {formatTimeUntil(minutesUntil)}
              </span>
            </div>
            
            <h3 className="text-lg font-semibold">
              {nextInterview.submission.candidate.full_name}
            </h3>
            
            <p className="text-primary-foreground/70 text-sm">
              {nextInterview.submission.job.title} • {getMeetingLabel(nextInterview.meeting_type)} • {nextInterview.duration_minutes || 60} Min
            </p>
            
            <p className="text-primary-foreground/50 text-xs mt-1">
              {format(scheduledTime, "EEEE, d. MMMM 'um' HH:mm 'Uhr'", { locale: de })}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          {onViewProfile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewProfile(nextInterview)}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <User className="h-4 w-4 mr-1" />
              Profil
            </Button>
          )}
          
          {onReschedule && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReschedule(nextInterview)}
              className="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              Verschieben
            </Button>
          )}
          
          {nextInterview.meeting_link && (
            <Button
              size="sm"
              className="bg-primary-foreground text-navy hover:bg-primary-foreground/90 font-semibold"
              asChild
            >
              <a href={nextInterview.meeting_link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Jetzt starten
              </a>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

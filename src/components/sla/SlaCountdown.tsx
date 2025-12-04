import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface SlaCountdownProps {
  deadlineAt: string;
  status?: 'active' | 'warning_sent' | 'completed' | 'breached' | 'escalated';
  ruleName?: string;
  className?: string;
}

export function SlaCountdown({ 
  deadlineAt, 
  status = 'active',
  ruleName,
  className 
}: SlaCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [urgency, setUrgency] = useState<'normal' | 'warning' | 'critical' | 'expired'>('normal');

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadline = new Date(deadlineAt).getTime();
      const now = Date.now();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('Überschritten');
        setUrgency('expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
        setUrgency('normal');
      } else if (hours >= 6) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setUrgency('normal');
      } else if (hours >= 2) {
        setTimeLeft(`${hours}h ${minutes}m`);
        setUrgency('warning');
      } else {
        setTimeLeft(`${hours}h ${minutes}m`);
        setUrgency('critical');
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [deadlineAt]);

  // If completed, show success state
  if (status === 'completed') {
    return (
      <div className={cn(
        'inline-flex items-center gap-1 text-xs text-emerald-600',
        className
      )}>
        <CheckCircle className="h-3 w-3" />
        <span>Erledigt</span>
      </div>
    );
  }

  // If breached or escalated, show error state
  if (status === 'breached' || status === 'escalated') {
    return (
      <div className={cn(
        'inline-flex items-center gap-1 text-xs text-destructive',
        className
      )}>
        <AlertTriangle className="h-3 w-3" />
        <span>{status === 'escalated' ? 'Eskaliert' : 'Überschritten'}</span>
      </div>
    );
  }

  const urgencyClasses = {
    normal: 'text-muted-foreground',
    warning: 'text-amber-600',
    critical: 'text-destructive animate-pulse',
    expired: 'text-destructive',
  };

  const Icon = urgency === 'expired' ? AlertTriangle : Clock;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1 text-xs font-medium',
            urgencyClasses[urgency],
            className
          )}>
            <Icon className="h-3 w-3" />
            <span>{timeLeft}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            {ruleName && <p className="font-medium">{ruleName}</p>}
            <p className="text-xs">
              Deadline: {new Date(deadlineAt).toLocaleString('de-DE')}
            </p>
            {status === 'warning_sent' && (
              <p className="text-xs text-amber-600">Warnung wurde gesendet</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
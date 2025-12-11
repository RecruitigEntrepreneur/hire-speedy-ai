import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Mail, 
  BookOpen, 
  Check, 
  X, 
  Clock, 
  AlertTriangle,
  AlertCircle,
  Info,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';

interface InfluenceAlertCardProps {
  alert: InfluenceAlert;
  onMarkDone: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onOpenPlaybook: (playbookId: string) => void;
  onViewCandidate?: (submissionId: string) => void;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
}

// Dezentere Farben für bessere UX
const priorityConfig = {
  critical: {
    icon: AlertCircle,
    label: 'Kritisch',
    bgColor: 'bg-destructive/5',
    textColor: 'text-destructive',
    borderColor: 'border-destructive/20',
    badgeVariant: 'destructive' as const,
    accentColor: 'bg-destructive',
  },
  high: {
    icon: AlertTriangle,
    label: 'Hoch',
    bgColor: 'bg-muted/50',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/20',
    badgeVariant: 'secondary' as const,
    accentColor: 'bg-amber-500',
  },
  medium: {
    icon: Info,
    label: 'Mittel',
    bgColor: 'bg-muted/30',
    textColor: 'text-blue-600',
    borderColor: 'border-border',
    badgeVariant: 'secondary' as const,
    accentColor: 'bg-blue-500',
  },
  low: {
    icon: Info,
    label: 'Niedrig',
    bgColor: 'bg-background',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border',
    badgeVariant: 'outline' as const,
    accentColor: 'bg-muted-foreground',
  },
};

export function InfluenceAlertCard({
  alert,
  onMarkDone,
  onDismiss,
  onOpenPlaybook,
  onViewCandidate,
  candidateName,
  candidateEmail,
  candidatePhone,
}: InfluenceAlertCardProps) {
  const [isActioning, setIsActioning] = useState(false);
  const config = priorityConfig[alert.priority] || priorityConfig.medium;
  const PriorityIcon = config.icon;

  const handleCall = () => {
    if (candidatePhone) {
      window.open(`tel:${candidatePhone}`, '_blank');
      onMarkDone(alert.id);
    }
  };

  const handleEmail = () => {
    if (candidateEmail) {
      window.open(`mailto:${candidateEmail}`, '_blank');
      onMarkDone(alert.id);
    }
  };

  const handleMarkDone = async () => {
    setIsActioning(true);
    await onMarkDone(alert.id);
    setIsActioning(false);
  };

  const handleViewCandidate = () => {
    if (onViewCandidate) {
      onViewCandidate(alert.submission_id);
    }
  };

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border transition-all hover:shadow-md relative overflow-hidden`}>
      {/* Farbiger Akzent-Streifen links */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accentColor}`} />
      
      <CardContent className="p-4 pl-5">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <PriorityIcon className={`h-4 w-4 ${config.textColor}`} />
              <Badge variant={config.badgeVariant} className="text-xs">
                {config.label}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: de })}
            </div>
          </div>

          {/* Content */}
          <div>
            <h4 className="font-semibold text-sm">{alert.title}</h4>
            {candidateName && (
              <button 
                onClick={handleViewCandidate}
                className="text-sm text-primary hover:underline mt-0.5 flex items-center gap-1 font-medium"
              >
                <User className="h-3 w-3" />
                {candidateName}
              </button>
            )}
            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
          </div>

          {/* Recommended Action - dezenter */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded-md border border-border/50">
            💡 <span className="font-medium">Empfohlen:</span> {alert.recommended_action}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {candidatePhone && (
              <Button size="sm" variant="outline" onClick={handleCall} className="h-8">
                <Phone className="h-3 w-3 mr-1" />
                Anrufen
              </Button>
            )}
            {candidateEmail && (
              <Button size="sm" variant="outline" onClick={handleEmail} className="h-8">
                <Mail className="h-3 w-3 mr-1" />
                Email
              </Button>
            )}
            {alert.playbook_id && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onOpenPlaybook(alert.playbook_id!)}
                className="h-8"
              >
                <BookOpen className="h-3 w-3 mr-1" />
                Playbook
              </Button>
            )}
            <div className="flex-1" />
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleMarkDone}
              disabled={isActioning}
              className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <Check className="h-3 w-3 mr-1" />
              Erledigt
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onDismiss(alert.id)}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>

          {/* Already actioned indicator */}
          {alert.action_taken && (
            <div className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded-md flex items-center gap-1">
              <Check className="h-3 w-3" />
              Aktion durchgeführt: {alert.action_taken}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

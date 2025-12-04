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
  Info
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { InfluenceAlert } from '@/hooks/useInfluenceAlerts';

interface InfluenceAlertCardProps {
  alert: InfluenceAlert;
  onMarkDone: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
  onOpenPlaybook: (playbookId: string) => void;
  candidateName?: string;
  candidateEmail?: string;
  candidatePhone?: string;
}

const priorityConfig = {
  critical: {
    icon: AlertCircle,
    label: 'Kritisch',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-600',
    borderColor: 'border-red-500/30',
    badgeVariant: 'destructive' as const,
  },
  high: {
    icon: AlertTriangle,
    label: 'Hoch',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-600',
    borderColor: 'border-amber-500/30',
    badgeVariant: 'secondary' as const,
  },
  medium: {
    icon: Info,
    label: 'Mittel',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600',
    borderColor: 'border-blue-500/30',
    badgeVariant: 'secondary' as const,
  },
  low: {
    icon: Info,
    label: 'Niedrig',
    bgColor: 'bg-muted',
    textColor: 'text-muted-foreground',
    borderColor: 'border-border',
    badgeVariant: 'outline' as const,
  },
};

export function InfluenceAlertCard({
  alert,
  onMarkDone,
  onDismiss,
  onOpenPlaybook,
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

  return (
    <Card className={`${config.bgColor} ${config.borderColor} border transition-all hover:shadow-md`}>
      <CardContent className="p-4">
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
              <p className="text-sm text-muted-foreground mt-0.5">{candidateName}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
          </div>

          {/* Recommended Action */}
          <div className={`text-xs ${config.textColor} ${config.bgColor} p-2 rounded-md`}>
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

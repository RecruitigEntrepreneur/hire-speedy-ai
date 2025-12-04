import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface Conflict {
  id: string;
  conflict_type: string;
  severity: string;
  resolved: boolean;
  submission_a_id: string;
  submission_b_id: string;
  resolution_notes: string | null;
}

interface JobConflictAlertProps {
  conflicts: Conflict[];
  onResolve?: (conflictId: string) => void;
  onDismiss?: (conflictId: string) => void;
}

const conflictTypeLabels: Record<string, string> = {
  same_client: 'Bereits bei diesem Kunden eingereicht',
  same_industry: 'Aktiv bei Konkurrenten in der gleichen Branche',
  critical_stage: 'Kandidat befindet sich in kritischer Phase bei einer anderen Position',
  duplicate: 'Mögliches Duplikat erkannt'
};

const severityConfig: Record<string, { variant: 'default' | 'destructive' | 'outline'; icon: typeof AlertTriangle }> = {
  low: { variant: 'outline', icon: AlertTriangle },
  medium: { variant: 'default', icon: AlertTriangle },
  high: { variant: 'destructive', icon: AlertTriangle }
};

export function JobConflictAlert({ conflicts, onResolve, onDismiss }: JobConflictAlertProps) {
  const unresolvedConflicts = conflicts.filter(c => !c.resolved);
  
  if (unresolvedConflicts.length === 0) return null;

  return (
    <div className="space-y-3">
      {unresolvedConflicts.map((conflict) => {
        const config = severityConfig[conflict.severity] || severityConfig.medium;
        const Icon = config.icon;
        
        return (
          <Alert key={conflict.id} variant={config.variant === 'destructive' ? 'destructive' : 'default'}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
              Konflikt erkannt
              <Badge variant={config.variant} className="text-xs">
                {conflict.severity === 'high' ? 'Hoch' : conflict.severity === 'medium' ? 'Mittel' : 'Niedrig'}
              </Badge>
            </AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-3">{conflictTypeLabels[conflict.conflict_type] || conflict.conflict_type}</p>
              <div className="flex gap-2">
                {onResolve && (
                  <Button size="sm" variant="outline" onClick={() => onResolve(conflict.id)}>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Als gelöst markieren
                  </Button>
                )}
                {onDismiss && (
                  <Button size="sm" variant="ghost" onClick={() => onDismiss(conflict.id)}>
                    <X className="h-4 w-4 mr-1" />
                    Ignorieren
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}

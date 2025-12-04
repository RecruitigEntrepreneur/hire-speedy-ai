import { AlertTriangle, CheckCircle, Clock, Eye, Shield, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FraudSignal, useFraudSignals } from '@/hooks/useFraudSignals';
import { cn } from '@/lib/utils';

interface FraudSignalCardProps {
  signal: FraudSignal;
  onReview?: (signal: FraudSignal) => void;
  onConfirm?: (signalId: string) => void;
  onDismiss?: (signalId: string) => void;
}

export function FraudSignalCard({ signal, onReview, onConfirm, onDismiss }: FraudSignalCardProps) {
  const { getSeverityColor, getSeverityBgColor, getSignalTypeLabel, getStatusLabel } = useFraudSignals();

  return (
    <Card className={cn(
      'border-l-4',
      signal.severity === 'critical' && 'border-l-red-500',
      signal.severity === 'high' && 'border-l-orange-500',
      signal.severity === 'medium' && 'border-l-amber-500',
      signal.severity === 'low' && 'border-l-blue-500'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className={cn('h-4 w-4', getSeverityColor(signal.severity))} />
              {getSignalTypeLabel(signal.signal_type)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={cn(getSeverityBgColor(signal.severity), getSeverityColor(signal.severity))}>
                {signal.severity.toUpperCase()}
              </Badge>
              <Badge variant="outline">
                {Math.round(signal.confidence_score)}% Konfidenz
              </Badge>
              <Badge variant={signal.status === 'pending' ? 'secondary' : 'outline'}>
                {getStatusLabel(signal.status)}
              </Badge>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {new Date(signal.created_at).toLocaleString('de-DE')}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Evidence */}
        {signal.evidence && signal.evidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Beweise</p>
            <ul className="space-y-1">
              {signal.evidence.map((ev, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  {ev}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Auto Action */}
        {signal.auto_action_taken && (
          <div className={cn(
            'p-2 rounded text-sm',
            signal.auto_action_taken === 'blocked' && 'bg-red-100 text-red-800',
            signal.auto_action_taken === 'flagged' && 'bg-amber-100 text-amber-800',
            signal.auto_action_taken === 'warned' && 'bg-blue-100 text-blue-800'
          )}>
            <span className="font-medium">Auto-Aktion:</span>{' '}
            {signal.auto_action_taken === 'blocked' && 'Automatisch blockiert'}
            {signal.auto_action_taken === 'flagged' && 'Zur Prüfung markiert'}
            {signal.auto_action_taken === 'warned' && 'Warnung versendet'}
          </div>
        )}

        {/* Actions */}
        {signal.status === 'pending' && (
          <div className="flex items-center gap-2 pt-2">
            {onReview && (
              <Button variant="outline" size="sm" onClick={() => onReview(signal)}>
                <Eye className="h-3 w-3 mr-1" />
                Prüfen
              </Button>
            )}
            {onConfirm && (
              <Button variant="destructive" size="sm" onClick={() => onConfirm(signal.id)}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Bestätigen
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={() => onDismiss(signal.id)}>
                <XCircle className="h-3 w-3 mr-1" />
                Ablehnen
              </Button>
            )}
          </div>
        )}

        {/* Review Info */}
        {signal.reviewed_at && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Geprüft: {new Date(signal.reviewed_at).toLocaleString('de-DE')}
            {signal.action_taken && ` • Aktion: ${signal.action_taken}`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
